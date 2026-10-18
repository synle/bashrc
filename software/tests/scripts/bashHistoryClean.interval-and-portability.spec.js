import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { execSync } from "child_process";

import fs from "fs";

import path from "path";

import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const HISTORY_FILE = path.join(ROOT_DIR, "software/scripts/bash-history.profile.bash");

const PROFILE_ADVANCED = path.join(ROOT_DIR, "software/bootstrap/profile-advanced.sh");

const PROFILE_CORE = path.join(ROOT_DIR, "software/bootstrap/profile-core.sh");

let sandbox = "";

beforeEach(() => {
  sandbox = fs.mkdtempSync("/tmp/_bash_history_clean_");
  fs.mkdirSync(path.join(sandbox, "home"));
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

function extractBashFunction(file, fnName) {
  const text = fs.readFileSync(file, "utf-8");
  const openRe = new RegExp(`^function ${fnName}\\(\\)`);
  const lines = text.split("\n");
  const out = [];
  let inFn = false;
  for (const line of lines) {
    if (!inFn && openRe.test(line)) inFn = true;
    if (inFn) {
      out.push(line);
      if (line === "}") return out.join("\n");
    }
  }
  throw new Error(`could not extract function ${fnName} from ${file}`);
}

function runCleanup(input, aliases = {}) {
  const histfile = path.join(sandbox, "histfile");
  fs.writeFileSync(histfile, input);

  const canonicalize = extractBashFunction(PROFILE_ADVANCED, "_canonicalize_command");
  // bash-history.profile.bash has _backup_history call at top level — stub it.
  // Also need is_help_arg (stubbed minimal).
  const histSource = fs.readFileSync(HISTORY_FILE, "utf-8");

  const aliasEntries = Object.entries(aliases)
    .map(([k, v]) => `[${k}]=${JSON.stringify(v)}`)
    .join(" ");

  const script = `
set +e
function is_help_arg() { case "\${1:-}" in help|--help|-h|"?") return 0;; *) return 1;; esac; }
declare -gA BASH_ALIASES=(${aliasEntries})
function _backup_history() { :; }
${canonicalize}
${histSource}
HISTFILE='${histfile}' history_cleanup
`;

  execSync(`bash`, { input: script, stdio: ["pipe", "ignore", "ignore"] });
  return fs.readFileSync(histfile, "utf-8");
}

function runMaybeCleanup(opts) {
  // The gate path is derived by cache_lastrun_path(): <dir>/cache-lastrun-<name>.timestamp.
  // Point <dir> at the sandbox so this test never touches the real /tmp gate.
  const gate = path.join(sandbox, "cache-lastrun-history-cleanup.timestamp");
  const sentinel = path.join(sandbox, "ran_marker");
  let gateBefore = null;
  if (opts.gateContent !== undefined) {
    fs.writeFileSync(gate, opts.gateContent);
    gateBefore = opts.gateContent;
  } else if (opts.gateAgeSeconds !== null && opts.gateAgeSeconds !== undefined) {
    const past = Math.floor(Date.now() / 1000) - opts.gateAgeSeconds;
    fs.writeFileSync(gate, String(past));
    gateBefore = String(past);
  }

  // Extract ONLY _maybe_history_cleanup plus the shared cache_lastrun_* helpers
  // it now delegates to. Sourcing the whole file would invoke its
  // bottom-of-file `_maybe_history_cleanup` + `_backup_history` calls against
  // the real gate AND replace our history_cleanup stub with the real one (which
  // depends on _canonicalize_command, absent here).
  const maybeCleanup = extractBashFunction(HISTORY_FILE, "_maybe_history_cleanup");
  const cachePath = extractBashFunction(PROFILE_CORE, "cache_lastrun_path");
  const cacheDue = extractBashFunction(PROFILE_CORE, "cache_lastrun_due");
  const cacheMark = extractBashFunction(PROFILE_CORE, "cache_lastrun_mark");

  const script = `
set +e
export BASHRC_CACHE_LASTRUN_DIR='${sandbox}'
HISTORY_CLEANUP_INTERVAL_SECONDS=21600
${cachePath}
${cacheDue}
${cacheMark}
# Sentinel stub — touches the marker file when _maybe_history_cleanup lets the
# call through the gate.
function history_cleanup() { command touch '${sentinel}'; }
${maybeCleanup}
_maybe_history_cleanup
`;

  execSync(`bash`, { input: script, stdio: ["pipe", "ignore", "ignore"] });
  const ran = fs.existsSync(sentinel);
  const gateAfter = fs.existsSync(gate) ? fs.readFileSync(gate, "utf-8").trim() : null;
  return { ran, gateBefore, gateAfter };
}

describe("history_cleanup — pipeline", () => {
it("end-to-end: mixed real-world input", () => {
    const input = [
      "#1700000001",
      "git status",
      "#1700000002",
      "g log", // alias expand
      "#1700000003",
      "clear && g status", // marker + alias → dedup with #1
      "#1700000004",
      "clear;ls", // no-space marker
      "#1700000005",
      'echo "broken', // bash -n drop
      "#1700000006",
      '"some json"', // paste residue drop
      "#1700000007",
      "function foo() {", // brace drop
      "#1700000008",
      "Set-ItemProperty x", // PS cmdlet drop
      "#1700000009",
      "0xff, 0xab", // hex byte drop
      "#1700000010",
      "git status", // dup of #1 — newer wins
      "#1700000011",
      "echo done",
      "",
    ].join("\n");
    const out = runCleanup(input, { g: "git" });
    const cmdLines = out.split("\n").filter((l) => l.length > 0 && !l.startsWith("#"));
    expect(cmdLines.sort()).toEqual(["echo done", "git log", "git status", "ls"].sort());
    expect(out).toContain("#1700000002"); // git log ts kept
    expect(out).toContain("#1700000004"); // ls ts kept
    expect(out).toContain("#1700000010"); // newer git status ts kept
    expect(out).toContain("#1700000011"); // echo done ts kept
    expect(out).not.toContain("#1700000001"); // old git status dropped
    expect(out).not.toContain("#1700000003"); // canonicalized duplicate
  });
});

describe("_maybe_history_cleanup — 6h interval gate", () => {
it("runs when no gate file exists (fresh shell after reboot)", () => {
    const { ran, gateAfter } = runMaybeCleanup({ gateAgeSeconds: null });
    expect(ran).toBe(true);
    expect(gateAfter).toMatch(/^\d+$/); // wrote a fresh epoch timestamp
  });

it("runs when gate is older than 6 hours", () => {
    const { ran, gateAfter } = runMaybeCleanup({ gateAgeSeconds: 21601 }); // 6h + 1s
    expect(ran).toBe(true);
    // gate timestamp should have been refreshed to ~now
    const now = Math.floor(Date.now() / 1000);
    expect(Number(gateAfter)).toBeGreaterThanOrEqual(now - 5);
  });

it("skips when gate is fresher than 6 hours", () => {
    const { ran, gateAfter, gateBefore } = runMaybeCleanup({ gateAgeSeconds: 60 }); // 1 minute ago
    expect(ran).toBe(false);
    // gate file unchanged when skipping
    expect(gateAfter).toBe(gateBefore);
  });

it("runs when gate file is empty (treats as last=0)", () => {
    const { ran } = runMaybeCleanup({ gateContent: "" });
    expect(ran).toBe(true);
  });

it("runs when gate file has garbage (non-numeric treated as never-run)", () => {
    // cache_lastrun_due rejects empty / non-numeric content and returns "due",
    // so cleanup runs. Defensive: a corrupted gate can never wedge cleanup.
    const { ran } = runMaybeCleanup({ gateContent: "not a number" });
    expect(ran).toBe(true);
  });

it("runs at exactly the boundary (gate age = interval)", () => {
    // cache_lastrun_due uses `age >= interval` as the "due" condition, so at
    // exactly 21600 it is due and cleanup runs.
    const { ran } = runMaybeCleanup({ gateAgeSeconds: 21600 });
    expect(ran).toBe(true);
  });
});

describe("bash-history.profile.bash — BSD-vs-GNU grep regex guard", () => {
it("contains no BSD-incompatible escaped BRE metacharacters in single-quoted grep patterns", () => {
    // BSD grep treats `\{`, `\(`, `\+`, `\?` as BRE meta-operators. `\{` without
    // a closing `\}` and a numeric repetition count is a hard error on BSD —
    // a previous bug fed empty stdout into `> tmp && mv tmp file`, truncating
    // ~/.bash_history. Use POSIX bracket expressions instead (`[{]`).
    const src = fs.readFileSync(HISTORY_FILE, "utf-8");
    const lines = src.split("\n");
    /** @type {Array<{ line: number, text: string, pattern: string }>} */
    const offenders = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith("#")) continue;
      const grepMatch = line.match(/\bgrep\b[^|]*?'([^']*)'/);
      if (!grepMatch) continue;
      const pattern = grepMatch[1];
      // `\{n\}` / `\{n,m\}` (interval with digit after `\{`) is valid POSIX BRE
      // on both BSD and GNU. Anything else escaping `{`, `(`, `+`, `?` is suspect.
      const badEscapeMatch = pattern.match(/\\([({+?])|\\\{(?!\d)/);
      if (badEscapeMatch) {
        offenders.push({ line: i + 1, text: line.trim(), pattern });
      }
    }
    expect(offenders, `BSD-incompatible grep patterns:\n${offenders.map((o) => `  line ${o.line}: ${o.text}`).join("\n")}`).toEqual([]);
  });
});

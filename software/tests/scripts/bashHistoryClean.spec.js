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
  it("preserves valid commands and their timestamps", () => {
    const input = ["#1700000001", "git status", "#1700000002", "ls -la", ""].join("\n");
    const out = runCleanup(input);
    expect(out).toContain("#1700000001");
    expect(out).toContain("git status");
    expect(out).toContain("#1700000002");
    expect(out).toContain("ls -la");
  });

  it("preserves the (ts, cmd) pairing when an entry is dropped — no orphan timestamps", () => {
    const input = ["#1700000001", "git status", "#1700000002", 'echo "broken', "#1700000003", "ls -la", ""].join("\n");
    const out = runCleanup(input);
    expect(out).toContain("#1700000001");
    expect(out).toContain("git status");
    expect(out).not.toContain("#1700000002"); // dropped with its broken cmd
    expect(out).not.toContain('echo "broken');
    expect(out).toContain("#1700000003");
    expect(out).toContain("ls -la");
  });

  describe("paste-residue drops (patterns bash -n accepts as valid)", () => {
    const cases = [
      { label: 'leading " (JSON / PowerShell quote)', cmd: '"some json fragment"' },
      { label: "leading $ (PowerShell variable)", cmd: '$myVar = "x"' },
      { label: "trailing { (JS/TS/Go block opener)", cmd: "function foo() {" },
      { label: "leading } (JS/TS/Go close residue)", cmd: "}" },
      { label: "leading } chained", cmd: "} catch {" },
      { label: "PowerShell verb-noun cmdlet", cmd: "Set-ItemProperty -Path foo" },
      { label: "hex byte literal", cmd: "0x80, 0x99, 0x19" },
      { label: "try-brace", cmd: "try { foo }" },
      { label: "catch-brace", cmd: "catch { bar }" },
      { label: "finally-brace", cmd: "finally { baz }" },
    ];
    for (const { label, cmd } of cases) {
      it(`drops: ${label}`, () => {
        const input = ["#1700000001", "echo keep", "#1700000002", cmd, "#1700000003", "echo also-keep", ""].join("\n");
        const out = runCleanup(input);
        expect(out).toContain("echo keep");
        expect(out).toContain("echo also-keep");
        expect(out).not.toContain(cmd);
      });
    }
  });

  describe("bash -nc validation drops invalid syntax", () => {
    const invalid = [
      { label: "unterminated single quote", cmd: "ls 'unterminated" },
      { label: "unterminated double quote", cmd: 'echo "broken' },
      { label: "broken redirect", cmd: "< <(" },
      { label: "truncated if (no fi)", cmd: "if [ -f foo ]; then" },
    ];
    for (const { label, cmd } of invalid) {
      it(`drops: ${label}`, () => {
        const input = ["#1", "echo keep", "#2", cmd, ""].join("\n");
        const out = runCleanup(input);
        expect(out).toContain("echo keep");
        expect(out).not.toContain(cmd);
      });
    }

    it("KEEPS valid multi-statement and compound commands", () => {
      const valid = ["echo hello", "for i in 1 2; do echo $i; done", "ls -la | wc -l", 'a="$(echo hi)"'];
      const input = valid.flatMap((c, i) => [`#${i + 1}`, c]).join("\n") + "\n";
      const out = runCleanup(input);
      for (const c of valid) expect(out).toContain(c);
    });
  });

  describe("marker command stripping", () => {
    it("strips leading marker in compound: `clear && cmd` → `cmd`", () => {
      const out = runCleanup("#1\nclear && ls\n");
      expect(out).toContain("ls");
      expect(out).not.toMatch(/clear &&/);
    });

    it("strips leading marker no-space: `clear;cmd` → `cmd`", () => {
      const out = runCleanup("#1\nclear;ls\n");
      expect(out).toContain("ls");
      expect(out).not.toMatch(/clear;/);
    });

    it("strips trailing marker: `cmd ; clear` → `cmd`", () => {
      const out = runCleanup("#1\nls ; clear\n");
      expect(out).toContain("ls");
      expect(out).not.toMatch(/; clear/);
    });

    it("collapses chained markers: `clear && clean && cmd` → `cmd`", () => {
      const out = runCleanup("#1\nclear && clean && ls\n");
      expect(out).toContain("ls");
      expect(out).not.toMatch(/clear|clean/);
    });

    for (const bare of ["clear", "clean", "br"]) {
      it(`drops bare marker '${bare}'`, () => {
        const out = runCleanup(`#1\necho keep\n#2\n${bare}\n#3\necho also\n`);
        expect(out).toContain("echo keep");
        expect(out).toContain("echo also");
        // bare marker line dropped along with its timestamp
        const lines = out.split("\n");
        expect(lines).not.toContain(bare);
      });
    }
  });

  describe("alias expansion via BASH_ALIASES", () => {
    it("expands ≤2-char alias: g → git", () => {
      const out = runCleanup("#1\ng status\n", { g: "git" });
      expect(out).toContain("git status");
      expect(out).not.toMatch(/^g status$/m);
    });

    it("composes with marker strip: `clear && g status` → `git status`", () => {
      const out = runCleanup("#1\nclear && g status\n", { g: "git" });
      expect(out).toContain("git status");
    });

    it("does NOT expand >2-char prefix (only short aliases)", () => {
      // `gst` not in BASH_ALIASES, even if `g` is — no partial-match expansion
      const out = runCleanup("#1\ngst foo\n", { g: "git" });
      expect(out).toContain("gst foo");
    });

    it("leaves real 2-char commands alone when no alias exists", () => {
      const out = runCleanup("#1\nls -la\n#2\ncd /tmp\n#3\nwc -l file\n", {});
      expect(out).toContain("ls -la");
      expect(out).toContain("cd /tmp");
      expect(out).toContain("wc -l file");
    });
  });

  describe("dedup — most recent wins", () => {
    it("collapses duplicates keeping the newest occurrence", () => {
      const input = ["#1700000001", "git status", "#1700000002", "ls", "#1700000003", "git status", ""].join("\n");
      const out = runCleanup(input);
      // Only one git status entry, and it's paired with the newer #1700000003
      const lines = out.split("\n");
      expect(lines.filter((l) => l === "git status").length).toBe(1);
      expect(out).toContain("#1700000003");
      expect(out).not.toContain("#1700000001"); // older git status dropped with its ts
    });

    it("dedup operates on canonical form: `g status` and `git status` collapse", () => {
      const input = ["#1", "g status", "#2", "git status", ""].join("\n");
      const out = runCleanup(input, { g: "git" });
      const lines = out.split("\n").filter((l) => l.length > 0 && !l.startsWith("#"));
      expect(lines.filter((l) => l === "git status").length).toBe(1);
    });
  });
});

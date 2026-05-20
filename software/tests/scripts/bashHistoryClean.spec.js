/**
 * Regression tests for cleanup_history in software/scripts/bash-history.profile.bash.
 *
 * Background (history): there used to be a two-tier split — _clean_history_file
 * (regex-only quick path used by every Ctrl+R) and cleanup_history (deep clean
 * via _canonicalize_command for the daily backup). The two were merged into a
 * single cleanup_history function once all paste-residue heuristics were lifted
 * into _canonicalize_command (which lives in profile-advanced.sh and is shared
 * with the PROMPT_COMMAND hot path via _rewrite_last_history_entry).
 *
 * What this suite asserts:
 *   - timestamp lines (#<epoch>) stay paired with their command (preserved, not
 *     dropped — required for HISTTIMEFORMAT)
 *   - paste-residue patterns are dropped (JSON, PowerShell, JS brace, hex byte,
 *     PowerShell verb-noun cmdlets)
 *   - `bash -nc` rejects invalid syntax (the lifted --strict behavior — now
 *     always-on, since the hot path no longer calls cleanup at all)
 *   - marker commands (clear|clean|br) get stripped in compound chains and
 *     dropped when bare, with whitespace-tolerant matching (`clear;cmd` works)
 *   - short ≤2-char aliases expand via BASH_ALIASES
 *   - dedup keeps the MOST RECENT sighting (last-wins), not the first
 *   - the BSD-vs-GNU grep `\{` interval-expression incompatibility doesn't
 *     reappear in any grep pattern in the file
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
/** Absolute path to the bash-history profile partial under test. */
const HISTORY_FILE = path.join(ROOT_DIR, "software/scripts/bash-history.profile.bash");
/** Absolute path to profile-advanced.sh — source of _canonicalize_command. */
const PROFILE_ADVANCED = path.join(ROOT_DIR, "software/bootstrap/profile-advanced.sh");

/** @type {string} */
let sandbox = "";

beforeEach(() => {
  sandbox = fs.mkdtempSync("/tmp/_bash_history_clean_");
  fs.mkdirSync(path.join(sandbox, "home"));
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

/**
 * Extract a single bash function definition out of a file with many top-level
 * side-effecting statements. Matches the opening `function NAME()` line, then
 * collects until the next line that is exactly `}` at column 0 — the repo's
 * convention for closing function braces. Naïve brace-counting fails on this
 * codebase because `{`/`}` appear inside single-quoted regex patterns
 * (`\{$`, `^\}`) and would falsely inc/dec the depth.
 *
 * @param {string} file - absolute path to the bash file to read
 * @param {string} fnName - exact function name (no parens)
 * @returns {string} the function definition (one continuous block)
 */
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

/**
 * Source the extracted functions + a stubbed environment + sample HISTFILE,
 * run cleanup_history, and return the resulting file content.
 *
 * @param {string} input - raw HISTFILE content to clean
 * @param {Record<string, string>} [aliases] - BASH_ALIASES entries (e.g. { g: "git" })
 * @returns {string} the cleaned HISTFILE content
 */
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
HISTFILE='${histfile}' cleanup_history
`;

  execSync(`bash`, { input: script, stdio: ["pipe", "ignore", "ignore"] });
  return fs.readFileSync(histfile, "utf-8");
}

describe("cleanup_history — pipeline", () => {
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

/**
 * Source bash-history.profile.bash with overridden HISTORY_CLEANUP_GATE and a
 * stubbed `cleanup_history` (replaced by a sentinel echo), then invoke
 * _maybe_cleanup_history. Returns whether the sentinel fired and the final
 * gate-file contents. Used to assert the 6h interval gate behavior.
 *
 * @param {object} opts
 * @param {number|null} opts.gateAgeSeconds - if not null, pre-create the gate
 *   file with timestamp `now - gateAgeSeconds` to simulate a prior run
 * @param {string} [opts.gateContent] - if set, override the literal bytes
 *   written to the gate file (e.g. "" or "garbage")
 * @returns {{ ran: boolean, gateBefore: string|null, gateAfter: string|null }}
 */
function runMaybeCleanup(opts) {
  const gate = path.join(sandbox, "history_cleanup_last");
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

  // Extract ONLY _maybe_cleanup_history. Sourcing the whole file would invoke
  // its bottom-of-file `_maybe_cleanup_history` + `_backup_history` calls
  // against the real /tmp/synle/bashrc/ gate AND replace our cleanup_history
  // stub with the real one (which depends on _canonicalize_command, absent here).
  const maybeCleanup = extractBashFunction(HISTORY_FILE, "_maybe_cleanup_history");

  const script = `
set +e
HISTORY_CLEANUP_GATE='${gate}'
HISTORY_CLEANUP_INTERVAL_SECONDS=21600
# Sentinel stub — touches the marker file when _maybe_cleanup_history lets the
# call through the gate.
function cleanup_history() { command touch '${sentinel}'; }
${maybeCleanup}
_maybe_cleanup_history
`;

  execSync(`bash`, { input: script, stdio: ["pipe", "ignore", "ignore"] });
  const ran = fs.existsSync(sentinel);
  const gateAfter = fs.existsSync(gate) ? fs.readFileSync(gate, "utf-8").trim() : null;
  return { ran, gateBefore, gateAfter };
}

describe("_maybe_cleanup_history — 6h interval gate", () => {
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

  it("runs when gate file has garbage (arithmetic treats non-numeric as 0)", () => {
    // Bash $((now - last)) with last="garbage" treats it as 0 — so now-0=now,
    // which is >> 21600, so cleanup runs. Defensive: corrupted gate doesn't
    // wedge cleanup permanently.
    const { ran } = runMaybeCleanup({ gateContent: "not a number" });
    expect(ran).toBe(true);
  });

  it("runs at exactly the boundary (gate age = interval)", () => {
    // $((now - last)) < 21600 is the skip condition. At exactly 21600, it's
    // NOT less than, so cleanup runs.
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

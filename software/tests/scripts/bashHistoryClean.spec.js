/**
 * Regression tests for software/scripts/bash-history.profile.bash.
 *
 * Guards against the BSD-vs-GNU grep regex incompatibility bug where
 * `command grep -v '\{$'` produced empty output on macOS (BSD grep parses
 * `\{` as the start of an interval expression) — the empty stdout was then
 * piped through `> "$tmp" && mv "$tmp" "$file"`, silently truncating
 * ~/.bash_history and the daily backup to 0 bytes.
 *
 * The fix uses POSIX bracket expressions (`[{]$`) which work identically
 * on both BSD and GNU grep.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
/** Absolute path to the bash-history profile partial under test. */
const HISTORY_FILE = path.join(ROOT_DIR, "software/scripts/bash-history.profile.bash");

/** @type {string} */
let sandbox = "";

beforeEach(() => {
  sandbox = fs.mkdtempSync("/tmp/_bash_history_clean_");
  // _backup_history runs at source time and touches $HOME/.bash_history_backups —
  // override HOME so it lands inside the sandbox.
  fs.mkdirSync(path.join(sandbox, "home"));
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

/**
 * Source bash-history.profile.bash in a hermetic subshell, run
 * `_clean_history_file <inputFile> [--strict]`, and return the cleaned content.
 *
 * @param {string} input - raw history text to clean.
 * @param {{ strict?: boolean }} [opts]
 * @returns {{ stdout: string, stderr: string, content: string }}
 */
function runClean(input, opts = {}) {
  const home = path.join(sandbox, "home");
  const inputFile = path.join(sandbox, "history_input");
  fs.writeFileSync(inputFile, input);
  const strictArg = opts.strict ? " --strict" : "";
  // Pre-create $HOME/.bash_history so _backup_history (which runs at source
  // time) has something to copy and doesn't trip non-zero exits. Use a stub
  // entry so the daily backup file is non-empty (irrelevant to the assertion
  // but avoids ambiguous empty state). Don't run with `set -e` — the sourced
  // file's _backup_history pipeline includes commands that legitimately exit
  // non-zero (e.g. ls of an empty backup dir piped through xargs).
  fs.writeFileSync(path.join(home, ".bash_history"), "echo seed\n");
  const script = `
export HOME="${home}"
. "${HISTORY_FILE}" || exit 1
_clean_history_file "${inputFile}"${strictArg} || exit 2
command cat "${inputFile}"
`;
  const result = execSync(`bash -c '${script.replace(/'/g, "'\\''")}'`, {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { stdout: result, stderr: "", content: fs.readFileSync(inputFile, "utf-8") };
}

describe("_clean_history_file", () => {
  it("regression: strict pass on input with `foo {` does not zero the file (BSD grep `\\{` interval bug)", () => {
    // The bug: `grep -v '\{$'` exits with "invalid repetition count(s)" on BSD
    // grep, producing empty stdout, which then `> "$tmp" && mv "$tmp" "$file"`
    // truncates the history file to 0 bytes.
    const input = ["bar", "foo {", "echo hello"].join("\n") + "\n";
    const { content } = runClean(input, { strict: true });
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain("bar");
    expect(content).toContain("echo hello");
    expect(content).not.toContain("foo {");
  });

  it("non-strict pass also drops lines ending in `{`", () => {
    const input = ["function foo() {", "ls -la", "if (x) {", "pwd"].join("\n") + "\n";
    const { content } = runClean(input);
    expect(content).toContain("ls -la");
    expect(content).toContain("pwd");
    expect(content).not.toMatch(/\{$/m);
  });

  it("preserves a representative mix of valid commands and drops obvious paste residue", () => {
    const input =
      [
        "ls -la", // keep
        "git status", // keep
        "function foo() {", // drop (ends in {)
        "}", // drop (starts with })
        "} catch {", // drop (starts with })
        '"some json fragment"', // drop (starts with ")
        "$myVar = 'x'", // drop (starts with $)
        "Set-ItemProperty -Path foo", // drop (PowerShell verb-noun)
        "0x80, 0x99", // drop (hex byte literal)
        "try { foo }", // drop (try { ... })
        "echo hi", // keep
        "#1700000000", // drop (HISTTIMEFORMAT marker)
        "# real comment", // keep (narrow #N pattern)
        "", // drop (empty)
        "ls -la", // drop (dedupe)
      ].join("\n") + "\n";
    const { content } = runClean(input);
    const lines = content.split("\n").filter((l) => l.length > 0);
    expect(lines).toContain("ls -la");
    expect(lines).toContain("git status");
    expect(lines).toContain("echo hi");
    expect(lines).toContain("# real comment");
    expect(lines.filter((l) => l === "ls -la").length).toBe(1); // deduped
    for (const dropped of [
      "function foo() {",
      "}",
      "} catch {",
      '"some json fragment"',
      "$myVar = 'x'",
      "Set-ItemProperty -Path foo",
      "0x80, 0x99",
      "try { foo }",
      "#1700000000",
    ]) {
      expect(lines, `expected ${JSON.stringify(dropped)} to be dropped`).not.toContain(dropped);
    }
  });

  it("strict pass keeps syntactically valid commands and drops `bash -n` failures", () => {
    const input = ["echo hello", "for i in 1 2; do echo $i; done", "ls 'unterminated", "pwd"].join("\n") + "\n";
    const { content } = runClean(input, { strict: true });
    expect(content).toContain("echo hello");
    expect(content).toContain("for i in 1 2; do echo $i; done");
    expect(content).toContain("pwd");
    expect(content).not.toContain("ls 'unterminated");
  });
});

describe("bash-history.profile.bash grep patterns", () => {
  it("contains no BSD-incompatible escaped BRE metacharacters in single-quoted grep patterns", () => {
    // BSD grep treats `\{`, `\(`, `\+`, `\?` as BRE meta-operators. `\{` without
    // a closing `\}` and a numeric repetition count is a hard error on BSD.
    // The repo convention (CLAUDE.md) is to use POSIX bracket expressions like
    // `[{]` instead. This guard catches future drift back into the broken form.
    const src = fs.readFileSync(HISTORY_FILE, "utf-8");
    const lines = src.split("\n");
    /** @type {Array<{ line: number, text: string, pattern: string }>} */
    const offenders = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments — narrative descriptions of patterns, not actual grep calls.
      if (line.trim().startsWith("#")) continue;
      // Find single-quoted args to grep on this line.
      const grepMatch = line.match(/\bgrep\b[^|]*?'([^']*)'/);
      if (!grepMatch) continue;
      const pattern = grepMatch[1];
      // `\{n\}` / `\{n,m\}` (interval with a digit immediately after `\{`) is
      // valid POSIX BRE on both BSD and GNU. Anything else escaping `{`, `(`,
      // `+`, `?` is suspicious.
      const badEscapeMatch = pattern.match(/\\([({+?])|\\\{(?!\d)/);
      if (badEscapeMatch) {
        offenders.push({ line: i + 1, text: line.trim(), pattern });
      }
    }
    expect(offenders, `BSD-incompatible grep patterns:\n${offenders.map((o) => `  line ${o.line}: ${o.text}`).join("\n")}`).toEqual([]);
  });
});

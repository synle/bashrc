/** Native-analyzer and Make integration for opt-in shell portability validation. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import validator from "../../tools/validate-shell-agnostic.js";

/** Existing analyzers are optional outside an explicitly provisioned validation run. */
const analyzersAvailable = ["shellcheck", "shfmt"].every((binary) => spawnSync(binary, ["--version"], { timeout: 5000 }).status === 0);
/** Standalone command entry point, resolved without relying on process cwd. */
const cli = path.resolve("software/tools/validate-shell-agnostic.js");
/** Each test owns its fixtures and restores any temporary process environment. */
let folder;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "shell-agnostic-"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(folder, { recursive: true, force: true });
});

/**
 * Write an isolated source fixture without executing it.
 * @param {string} source Shell source.
 * @param {string} name Fixture filename.
 * @returns {string} Absolute filename.
 */
function fixture(source, name = "shared.sh") {
  const file = path.join(folder, name);
  fs.writeFileSync(file, source);
  return file;
}

/**
 * Execute the validator, not its input scripts, with personal startup loading disabled.
 * @param {string[]} args CLI arguments.
 * @param {object} env Additional environment values.
 * @returns {import("child_process").SpawnSyncReturns<string>} Captured process result.
 */
function runCli(args, env = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    env: { ...process.env, BASH_ENV: "", ENV: "", HOME: folder, ZDOTDIR: folder, ...env },
    encoding: "utf8",
    timeout: 15000,
  });
}

/**
 * Provide controlled analyzer protocol output for error-boundary tests.
 * @param {string} binary Analyzer name to shadow within this fixture only.
 * @param {string} output Exact stdout.
 * @param {number} status Process exit status.
 * @returns {void} Writes one fixture executable and scopes PATH to this test.
 */
function analyzerFixture(binary, output, status = 0) {
  const file = path.join(folder, binary);
  fs.writeFileSync(file, `#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(output)}); process.exit(${status});\n`, {
    mode: 0o755,
  });
  vi.stubEnv("PATH", folder);
}

describe.skipIf(!analyzersAvailable)("static rule checks (requires ShellCheck and shfmt)", () => {
  it.each([
    { name: "unquoted values", rule: "quoting", source: "value='one two'\nprintf '%s\\n' $value\n", codes: ["SC2086"] },
    { name: "otherwise safe unquoted values", rule: "quoting", source: "value=hello\nprintf '%s\\n' $value\n", codes: ["SC2248"] },
    { name: "unquoted argv", rule: "quoting", source: "printf '%s\\n' $@\n", codes: ["SC2068"] },
    { name: "variable format", rule: "printf", source: 'value=hello\nprintf "$value\\n"\n', codes: ["SC2059"] },
    { name: "echo flags", rule: "printf", source: "echo -e hello\n", codes: ["AGNOSTIC_PRINTF", "SC3037"] },
    { name: "literal echo", rule: "printf", source: "echo hello\n", codes: ["AGNOSTIC_PRINTF"] },
    { name: "wrapped echo", rule: "printf", source: "command -- echo hello\n", codes: ["AGNOSTIC_PRINTF"] },
    { name: "builtin echo", rule: "printf", source: "builtin echo hello\n", codes: ["AGNOSTIC_PRINTF"] },
    { name: "POSIX builtin violation", rule: "syntax", source: "local value=hello\n", codes: ["SC3043"] },
    { name: "all checks", rule: "all", source: "set -eu\necho hello\n", codes: ["AGNOSTIC_OPTIONS", "AGNOSTIC_PRINTF"] },
  ])("reports $name through the selected rule", ({ source, rule, codes }) => {
    const findings = validator.validateShellSource(`#!/bin/sh\n${source}`, rule);
    expect(findings.map((item) => item.code).sort()).toEqual(codes);
    expect(findings[0].line).toBeGreaterThan(1);
    expect(findings[0].column).toBeGreaterThan(0);
  });

  it.each([
    "set -eu",
    "set -ue",
    "set +e",
    "set -o errexit",
    "set +o nounset",
    "set -",
    'set "$@"',
    "shopt -s extglob",
    'shopt "$@"',
    "setopt errexit",
    "unsetopt nounset",
    "command -p set -u",
  ])("flags option mutation or dynamic review: %s", (command) => {
    expect(validator.validateShellSource(`#!/bin/bash\n${command}\n`, "options").map((item) => item.code)).toEqual(["AGNOSTIC_OPTIONS"]);
  });

  it.each([
    "set",
    "set -o",
    "set +o",
    'set -- "$@"',
    "set value",
    "shopt",
    "shopt -p",
    "setopt",
    "unsetopt",
    "command -v echo",
    "command -V echo",
    "printf '%s\\n' \"$@\"",
    "printf '%s\\n' \"${1:-}\"",
    "'printf' '%s\\n' 'safe'",
    "\"printf\" '%s\\n' 'safe'",
  ])("accepts read-only or portable commands: %s", (command) => {
    expect(validator.validateShellSource(`#!/bin/sh\n${command}\n`, "options")).toEqual([]);
  });

  it("accepts portable source across all static rules without executing commands", () => {
    const marker = path.join(folder, "must-not-exist");
    const source = `#!/bin/sh\nhelper() { printf '%s\\n' \"$@\"; }\ntouch '${marker}'\n`;
    expect(validator.validateShellSource(source, "all")).toEqual([]);
    expect(fs.existsSync(marker)).toBe(false);
  });

  it("ignores policy text inside comments, strings and a quoted heredoc", () => {
    const source =
      "#!/bin/sh\n# set -eu; echo -e hello\nprintf '%s\\n' 'set -eu; echo -e hello'\ncat <<'TEXT'\nset -eu\necho -e hello\nTEXT\n";
    expect(validator.validateShellSource(source, "all")).toEqual([]);
  });

  it("detects mutations nested in functions and executable command substitutions", () => {
    const source = "#!/bin/bash\nhelper() { set -u; }\nprintf '%s\\n' \"$(echo hello)\"\n";
    expect(validator.validateShellSource(source, "options").map((item) => item.code)).toEqual(["AGNOSTIC_OPTIONS"]);
    expect(validator.validateShellSource(source, "printf").map((item) => item.code)).toEqual(["AGNOSTIC_PRINTF"]);
  });

  it("accepts an empty source file", () => {
    expect(validator.validateShellSource("", "all")).toEqual([]);
  });

  it("rejects Bash arrays in the POSIX syntax check", () => {
    expect(() => validator.validateShellSource("#!/bin/bash\nitems=(one two)\n", "syntax")).toThrow(/shfmt:/);
  });

  it("reports malformed syntax instead of returning a clean result", () => {
    expect(validator.validateShellSource("#!/bin/sh\nif\n", "quoting").map((item) => item.code)).toEqual(["SC1073", "SC1072"]);
    expect(() => validator.validateShellSource("#!/bin/sh\nif\n", "options")).toThrow(/shfmt:/);
  });

  it("reports one result per distinct file while preserving literal spaced filenames", () => {
    const file = fixture("#!/bin/sh\necho hello\n", "with spaces.sh");
    const result = validator.validateShellFiles([file, file], "printf");
    expect({ ok: result.ok, rule: result.rule, checkedFiles: result.checkedFiles, codes: result.findings.map((item) => item.code) })
      .toMatchInlineSnapshot(`
      {
        "checkedFiles": 1,
        "codes": [
          "AGNOSTIC_PRINTF",
        ],
        "ok": false,
        "rule": "printf",
      }
    `);
    expect(result.findings[0].file).toBe(file);
  });

  it("returns CLI statuses for clean files, findings, and invalid scope", () => {
    const good = fixture("#!/bin/sh\nprintf '%s\\n' \"$@\"\n");
    const bad = fixture("#!/bin/sh\necho hello\n", "bad.sh");
    const clean = runCli(["all", good]);
    expect(clean.status).toBe(0);
    expect(JSON.parse(clean.stdout)).toEqual({ ok: true, rule: "all", checkedFiles: 1, findings: [] });
    const findings = runCli(["printf", bad]);
    expect(findings.status).toBe(1);
    expect(JSON.parse(findings.stdout).findings[0].code).toBe("AGNOSTIC_PRINTF");
    const invalid = runCli([]);
    expect(invalid.status).toBe(2);
    expect(JSON.parse(invalid.stderr).error.message).toMatch(/files:/);
  });

  it("accepts a JSON-array scope transported through the environment", () => {
    const first = fixture("#!/bin/sh\nprintf '%s\\n' \"$@\"\n", "first.sh");
    const second = fixture("#!/bin/sh\nprintf '%s\\n' \"$@\"\n", "second.sh");
    const result = runCli([], { SHELL_AGNOSTIC_FILES: JSON.stringify([first, second]) });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).checkedFiles).toBe(2);
    const invalid = runCli([], { SHELL_AGNOSTIC_FILES: "[" });
    expect(invalid.status).toBe(2);
    expect(JSON.parse(invalid.stderr).ok).toBe(false);
  });

  it.each(["quoting", "printf", "options", "syntax"])("dispatches optional Make rule %s without executing the fixture", (rule) => {
    const file = fixture("#!/bin/sh\nprintf '%s\\n' \"$@\"\n", "literal ; name.sh");
    const result = spawnSync("make", ["-s", `validate_shell_agnostic_${rule}`, `files=${file}`], {
      env: { ...process.env, BASH_ENV: "", ENV: "", HOME: folder, ZDOTDIR: folder },
      encoding: "utf8",
      timeout: 15000,
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ ok: true, rule, checkedFiles: 1, findings: [] });
  });

  it("runs the aggregate optional Make target and rejects an unknown rule", () => {
    const file = fixture("#!/bin/sh\nprintf '%s\\n' \"$@\"\n");
    const result = spawnSync("make", ["-s", "validate_shell_agnostic", `files=${file}`], { encoding: "utf8", timeout: 15000 });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).rule).toBe("all");
    const invalid = runCli(["unknown", file]);
    expect(invalid.status).toBe(2);
    expect(JSON.parse(invalid.stderr).error.message).toMatch(/rule:/);
  });
});

describe("invalid inputs and analyzer boundaries", () => {
  it("does not skip a rule when a same-named file exists", () => {
    fs.writeFileSync(path.join(folder, "validate_shell_agnostic_quoting"), "");
    const result = spawnSync("make", ["-s", "-n", "-f", path.resolve("Makefile"), "validate_shell_agnostic_quoting", "files=shared.sh"], {
      cwd: folder,
      encoding: "utf8",
      timeout: 5000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("node software/tools/validate-shell-agnostic.js");
  });

  it("rejects unsupported rule names and non-string source", () => {
    expect(() => validator.validateShellSource("", "unknown")).toThrow(/rule:/);
    expect(() => validator.validateShellSource(null, "all")).toThrow(/source:/);
  });

  it.each([{ files: null }, { files: [] }, { files: [""] }, { files: [false] }])("rejects invalid file scope $files", ({ files }) => {
    expect(() => validator.validateShellFiles(files, "all")).toThrow(/files:/);
  });

  it("rejects sensitive paths and symlink targets before reading their content", () => {
    expect(() => validator.validateShellFiles([path.join(folder, "sample.secret.sh")], "all")).toThrow(/sensitive/);
    const sensitive = path.join(folder, "sample.secret.sh");
    const link = path.join(folder, "innocent.sh");
    fs.symlinkSync(sensitive, link);
    // A missing target fails before reading; an existing sensitive target is rejected too.
    expect(() => validator.validateShellFiles([link], "all")).toThrow(/ENOENT/);
    fs.writeFileSync(sensitive, "");
    expect(() => validator.validateShellFiles([link], "all")).toThrow(/resolved sensitive/);
  });

  it("rejects directories and unavailable files", () => {
    expect(() => validator.validateShellFiles([folder], "all")).toThrow(/regular file/);
    expect(() => validator.validateShellFiles([path.join(folder, "missing.sh")], "all")).toThrow(/ENOENT/);
  });

  it("fails closed when the required analyzer is missing", () => {
    vi.stubEnv("PATH", folder);
    expect(() => validator.validateShellSource("", "quoting")).toThrow(/shellcheck: ENOENT/);
    expect(() => validator.validateShellSource("", "options")).toThrow(/shfmt: ENOENT/);
  });

  it("rejects malformed JSON and unexpected analyzer schemas", () => {
    analyzerFixture("shellcheck", "not JSON");
    expect(() => validator.validateShellSource("", "quoting")).toThrow(/expected JSON/);
    analyzerFixture("shellcheck", "{}");
    expect(() => validator.validateShellSource("", "quoting")).toThrow(/diagnostic array/);
    analyzerFixture("shellcheck", "[null]");
    expect(() => validator.validateShellSource("", "quoting")).toThrow(/malformed diagnostic/);
    analyzerFixture("shfmt", "{}");
    expect(() => validator.validateShellSource("", "options")).toThrow(/File syntax tree/);
  });

  it("reports an analyzer failure without treating missing output as a pass", () => {
    analyzerFixture("shellcheck", "", 2);
    expect(() => validator.validateShellSource("", "quoting")).toThrow(/analyzer failed/);
  });
});

/** Behavior checks for the advanced profile's on-demand document converter. */
import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

/** Repository root containing the profile source. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Entire conditional definition, so tests exercise the availability guard too. */
const WRAPPER = readFileSync(path.join(ROOT, "software/bootstrap/profile-advanced.sh"), "utf8")
  .split("# --- Document Conversion ---\n")[1]
  .split("# --- Aliases: Git ---")[0];
/** Real help predicate shared by the profile and provisioning scripts. */
const HELP = readFileSync(path.join(ROOT, "software/bootstrap/common-functions.bash"), "utf8").match(
  /function is_help_arg\(\) \{[\s\S]*?\n\}/,
)[0];

/**
 * Source the wrapper twice and invoke it against recording uv/uvx executables.
 * @param {string[]} args - Arguments passed to markitdown without shell interpolation.
 * @param {{available?: boolean, exitCode?: number}} options - Executable availability and exit status.
 * @returns {import("child_process").SpawnSyncReturns<string>} Captured output and status.
 * @throws {Error} When temporary-file setup fails; removes its sandbox in all cases.
 */
function runWrapper(args, { available = true, exitCode = 0 } = {}) {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), "markitdown-wrapper-"));
  try {
    symlinkSync("/usr/bin/tr", path.join(sandbox, "tr"));
    symlinkSync("/bin/cat", path.join(sandbox, "cat"));
    symlinkSync("/bin/date", path.join(sandbox, "date"));
    symlinkSync("/bin/mv", path.join(sandbox, "mv"));
    symlinkSync("/usr/bin/mktemp", path.join(sandbox, "mktemp"));
    if (available) {
      const recorder = `#!/bin/bash
output=""
for arg in "$@"; do
  printf '%s\\0' "$arg"
done
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then
    output="$2"
    shift 2
  else
    shift
  fi
done
if [ -n "$output" ] && [ "\${output#/}" != "$output" ]; then
  printf 'converted markdown\\n' > "$output"
fi
exit ${exitCode}
`;
      writeFileSync(path.join(sandbox, "uv"), recorder, { mode: 0o755 });
      writeFileSync(path.join(sandbox, "uvx"), recorder, { mode: 0o755 });
    }
    return spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", `${HELP}\n${WRAPPER}\n${WRAPPER}\nmarkitdown "$@"`, "test", ...args], {
      encoding: "utf8",
      env: { ...process.env, BASH_ENV: "/dev/null", PATH: sandbox },
      timeout: 5000,
    });
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

describe("markitdown profile wrapper", () => {
  it.each([
    [
      ["input.docx", "-o", "output.md"],
      ["input.docx", "-o", "output.md"],
    ],
    [
      ["input doc.docx", "output file.md"],
      ["input doc.docx", "-o", "output file.md"],
    ],
    [
      ["input.xlsx", "--output=output.md"],
      ["input.xlsx", "--output=output.md"],
    ],
    [
      ["input.docx", "-o", "output.md", "--keep-data-uris"],
      ["input.docx", "-o", "output.md", "--keep-data-uris"],
    ],
    [["--version"], ["--version"]],
  ])("forwards %j with positional output normalization", (args, expected) => {
    const result = runWrapper(args);
    expect(result.status).toBe(0);
    expect(result.stdout.split("\0").slice(0, -1)).toEqual(["--python", "3.12", "--from", "markitdown[all]", "markitdown", ...expected]);
    expect(result.stderr).toBe("");
  });

  it("caches one-input conversion in a timestamped Markdown file before printing it", () => {
    const result = runWrapper(["input.pdf"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("converted markdown\n");
    expect(result.stdout).toContain("\0-o\0");
    expect(result.stderr).toMatch(/>> MarkItDown output: \/tmp\/20[0-9_]+-markitdown-[A-Za-z0-9]+\.md\n/);
  });

  it("installs the converter without starting it when called without arguments", () => {
    const result = runWrapper([]);
    expect(result.status).toBe(0);
    expect(result.stdout.split("\0").slice(0, -1)).toEqual(["tool", "install", "--python", "3.12", "markitdown[all]"]);
    expect(result.stderr).toBe("");
  });

  it("shows local help without starting uvx", () => {
    const result = runWrapper(["--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("markitdown INPUT -o OUTPUT.md");
    expect(result.stdout).toContain("cat INPUT | markitdown");
    expect(result.stdout).toContain("-x, --extension EXTENSION");
    expect(result.stdout).toContain("markitdown with no arguments installs markitdown[all] with Python 3.12.");
    expect(result.stdout).not.toContain("\0");
  });

  it("preserves installation failure status", () => {
    expect(runWrapper([], { exitCode: 7 }).status).toBe(7);
  });

  it("preserves conversion failure status", () => {
    expect(runWrapper(["input.pdf"], { exitCode: 7 }).status).toBe(7);
  });

  it("does not define the wrapper when uvx is unavailable", () => {
    const result = runWrapper(["input.pdf"], { available: false });
    expect(result.status).toBe(127);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("markitdown: command not found");
  });
});

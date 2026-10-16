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
 * Source the wrapper twice and invoke it against a recording uvx executable.
 * @param {string[]} args - Arguments passed to markitdown without shell interpolation.
 * @param {{available?: boolean, exitCode?: number}} options - Executable availability and exit status.
 * @returns {import("child_process").SpawnSyncReturns<string>} Captured output and status.
 * @throws {Error} When temporary-file setup fails; removes its sandbox in all cases.
 */
function runWrapper(args, { available = true, exitCode = 0 } = {}) {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), "markitdown-wrapper-"));
  try {
    symlinkSync("/usr/bin/tr", path.join(sandbox, "tr"));
    if (available) {
      writeFileSync(path.join(sandbox, "uvx"), `#!/bin/bash\nprintf '%s\\0' "$@"\nexit ${exitCode}\n`, { mode: 0o755 });
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
    [["input.pdf"], ["input.pdf"]],
    [
      ["input.xlsx", "--output=output.md"],
      ["input.xlsx", "--output=output.md"],
    ],
    [
      ["input.docx", "-o", "output.md", "--keep-data-uris"],
      ["input.docx", "-o", "output.md", "--keep-data-uris"],
    ],
    [["--version"], ["--version"]],
    [[], []],
  ])("forwards %j with positional output normalization", (args, expected) => {
    const result = runWrapper(args);
    expect(result.status).toBe(0);
    expect(result.stdout.split("\0").slice(0, -1)).toEqual(["--python", "3.12", "--from", "markitdown[all]", "markitdown", ...expected]);
    expect(result.stderr).toBe("");
  });

  it("shows local help without starting uvx", () => {
    const result = runWrapper(["--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: markitdown INPUT [-o OUTPUT | OUTPUT] [OPTIONS]");
    expect(result.stdout).toContain("Without OUTPUT, writes Markdown to stdout.");
    expect(result.stdout).not.toContain("\0");
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

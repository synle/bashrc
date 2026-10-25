/** Subprocess integration tests for timestamped file and folder archives. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

/** Checkout root containing the profile partial and shared prompt helpers. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Full partial loaded exactly as a shell profile loads it. */
const PROFILE = readFileSync(path.join(ROOT, "software/scripts/bash-file-utils.profile.bash"), "utf8");
/** Shared shell helper source; extract only definitions to avoid installer side effects. */
const COMMON = readFileSync(path.join(ROOT, "software/bootstrap/common-functions.bash"), "utf8");
/** Real help and confirmation definitions used by the wrapper. */
const HELPERS = COMMON.match(/^function (?:is_help_arg|prompt_yes_no)\(\) \{[\s\S]*?^\}/gm).join("\n");
/** Frozen local timestamp from the test-owned date executable. */
const STAMP = "20261025-123456";
/** Per-test sandbox containing input, output, and clock fixtures. */
let sandbox;
/** Working folder in which the caller invokes zip. */
let output;

/** Create isolated fixtures and a deterministic clock; throws on filesystem errors. */
beforeEach(() => {
  sandbox = mkdtempSync(path.join(os.tmpdir(), "zip-wrapper-"));
  output = path.join(sandbox, "output");
  mkdirSync(output);
  mkdirSync(path.join(sandbox, "inputs/patch-TOZUe3"), { recursive: true });
  mkdirSync(path.join(sandbox, "bin"));
  writeFileSync(path.join(sandbox, "bin/date"), `#!/bin/sh\nprintf '%s\\n' '${STAMP}'\n`, { mode: 0o755 });
  writeFileSync(path.join(sandbox, "inputs/patch-TOZUe3/bashrc.patch"), "patch bytes\n");
});

/** Remove only the sandbox owned by this test, including after failed assertions. */
afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

/**
 * Invoke the actual profile wrapper in Bash 3.2-compatible mode.
 * @param {string[]} args - Literal caller arguments, never interpolated into shell code.
 * @param {object} [options] - Confirmation and repeated-load controls.
 * @param {number} [options.confirm=1] - Owned prompt boundary status: zero approves.
 * @param {boolean} [options.realPrompt=false] - Use the real no-terminal prompt instead.
 * @param {number} [options.loads=1] - Number of times to load the profile partial.
 * @returns {import("child_process").SpawnSyncReturns<string>} Native exit status and output.
 * @throws {Error} When the subprocess cannot start; writes archives only within the sandbox.
 */
function runZip(args, { confirm = 1, realPrompt = false, loads = 1 } = {}) {
  const prompt = realPrompt ? "" : 'function prompt_yes_no() { printf "PROMPT: %s\\n" "$1" >&2; return "$PROMPT_STATUS"; }';
  return spawnSync(
    "/bin/bash",
    ["--noprofile", "--norc", "-c", `${HELPERS}\n${PROFILE.repeat(loads)}\n${prompt}\nzip "$@"`, "test", ...args],
    {
      encoding: "utf8",
      cwd: output,
      detached: true,
      env: { ...process.env, BASH_ENV: "/dev/null", PATH: `${sandbox}/bin:/usr/bin:/bin`, PROMPT_STATUS: String(confirm), ZIPOPT: "" },
      timeout: 5000,
    },
  );
}

/**
 * Read stored entry names through native unzip, independently of the wrapper.
 * @param {string} archive - Absolute archive filename to inspect.
 * @returns {string[]} Stored member names in archive order.
 * @throws {Error} When unzip fails or the archive is invalid; no filesystem writes.
 */
function entries(archive) {
  const result = spawnSync("unzip", ["-Z1", archive], { encoding: "utf8", timeout: 5000 });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim().split("\n");
}

/**
 * Extract one known member to stdout without creating files.
 * @param {string} archive - Absolute archive filename.
 * @param {string} member - Literal known member to read.
 * @returns {string} Uncompressed bytes interpreted as UTF-8.
 * @throws {Error} When unzip fails; no filesystem writes.
 */
function content(archive, member) {
  const result = spawnSync("unzip", ["-p", archive, member], { encoding: "utf8", timeout: 5000 });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}

describe("zip wrapper subprocess integration", () => {
  it("stores an absolute input file at the archive root in the caller's folder", () => {
    const result = runZip([path.join(sandbox, "inputs/patch-TOZUe3/bashrc.patch")], { loads: 2 });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(readdirSync(output)).toEqual([`bashrc.patch-${STAMP}.zip`]);
    expect(entries(path.join(output, `bashrc.patch-${STAMP}.zip`))).toEqual(["bashrc.patch"]);
    expect(content(path.join(output, `bashrc.patch-${STAMP}.zip`), "bashrc.patch")).toBe("patch bytes\n");
  });

  it.each(["../inputs/patch-TOZUe3", "../inputs/patch-TOZUe3/"])("preserves the folder root for %s", (input) => {
    const result = runZip([input]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(entries(path.join(output, `patch-TOZUe3-${STAMP}.zip`))).toEqual(["patch-TOZUe3/", "patch-TOZUe3/bashrc.patch"]);
    expect(content(path.join(output, `patch-TOZUe3-${STAMP}.zip`), "patch-TOZUe3/bashrc.patch")).toBe("patch bytes\n");
  });

  it("resolves dot to the current folder name without changing the caller's folder", () => {
    writeFileSync(path.join(output, "note.txt"), "note");
    const result = runZip([".", "../current.zip"]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(entries(path.join(sandbox, "current.zip"))).toEqual(["output/", "output/note.txt"]);
    expect(readdirSync(output)).toEqual(["note.txt"]);
  });

  it("stores an empty folder as a top-level entry", () => {
    mkdirSync(path.join(sandbox, "empty"));
    const result = runZip(["../empty"]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(entries(path.join(output, `empty-${STAMP}.zip`))).toEqual(["empty/"]);
  });

  it("treats spaces, quotes, Unicode, leading dashes, and wildcard characters literally", () => {
    writeFileSync(path.join(output, "-patch 'caf\u00e9[1]*.txt"), "literal input");
    writeFileSync(path.join(output, "-patch 'caf\u00e91-other.txt"), "not selected");
    const result = runZip(["./-patch 'caf\u00e9[1]*.txt", "archive with spaces.zip"]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    // macOS unzip sanitizes Unicode in listings but extracts the original filename.
    const extracted = spawnSync("unzip", ["-q", "archive with spaces.zip", "-d", "extracted"], {
      cwd: output,
      encoding: "utf8",
      timeout: 5000,
    });
    expect(extracted.status, extracted.stderr).toBe(0);
    expect(readdirSync(path.join(output, "extracted"))).toEqual(["-patch 'caf\u00e9[1]*.txt"]);
    expect(readFileSync(path.join(output, "extracted/-patch 'caf\u00e9[1]*.txt"), "utf8")).toBe("literal input");
  });

  it.each([
    ["custom.zip", "custom.zip"],
    ["custom", "custom.zip"],
    ["custom.ZIP", "custom.ZIP"],
    [".", `bashrc.patch-${STAMP}.zip`],
  ])("uses explicit destination %s", (destination, expected) => {
    const result = runZip(["../inputs/patch-TOZUe3/bashrc.patch", destination]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(readdirSync(output)).toEqual([expected]);
    expect(entries(path.join(output, expected))).toEqual(["bashrc.patch"]);
  });

  it("honors an absolute destination outside the caller's folder", () => {
    const archive = path.join(sandbox, "chosen.zip");
    const result = runZip(["../inputs/patch-TOZUe3/bashrc.patch", archive]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(entries(archive)).toEqual(["bashrc.patch"]);
    expect(readdirSync(output)).toEqual([]);
  });

  it("prompts and leaves an existing destination unchanged when confirmation is declined", () => {
    writeFileSync(path.join(output, "chosen.zip"), "original archive bytes");
    const result = runZip(["../inputs/patch-TOZUe3/bashrc.patch", "chosen"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("PROMPT:");
    expect(readFileSync(path.join(output, "chosen.zip"), "utf8")).toBe("original archive bytes");
    expect(readdirSync(output)).toEqual(["chosen.zip"]);
  });

  it("refuses a collision without a terminal", () => {
    writeFileSync(path.join(output, `bashrc.patch-${STAMP}.zip`), "keep me");
    const result = runZip(["../inputs/patch-TOZUe3/bashrc.patch"], { realPrompt: true });
    expect(result.status).toBe(1);
    expect(readFileSync(path.join(output, `bashrc.patch-${STAMP}.zip`), "utf8")).toBe("keep me");
    expect(readdirSync(output)).toEqual([`bashrc.patch-${STAMP}.zip`]);
  });

  it("removes stale archive entries only after overwrite confirmation", () => {
    writeFileSync(path.join(output, "stale.txt"), "stale");
    const initial = runZip(["stale.txt", "chosen.zip"]);
    expect(initial.status, initial.stdout + initial.stderr).toBe(0);
    const result = runZip(["../inputs/patch-TOZUe3/bashrc.patch", "chosen.zip"], { confirm: 0 });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stderr).toContain("PROMPT:");
    expect(entries(path.join(output, "chosen.zip"))).toEqual(["bashrc.patch"]);
    expect(content(path.join(output, "chosen.zip"), "bashrc.patch")).toBe("patch bytes\n");
  });

  it.each([{ args: [] }, { args: ["--help"] }])("shows wrapper usage for $args without creating files", ({ args }) => {
    const result = runZip(args);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: zip <input> [destination]");
    expect(readdirSync(output)).toEqual([]);
  });

  it.each([
    [""],
    ["/"],
    ["missing"],
    ["../inputs/patch-TOZUe3/bashrc.patch", ""],
    ["../inputs/patch-TOZUe3/bashrc.patch", "missing/chosen.zip"],
    ["../inputs/patch-TOZUe3/bashrc.patch", "a.zip", "extra"],
  ])("rejects invalid wrapper arguments %j without creating output", (...args) => {
    const result = runZip(args);
    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toBe("");
    expect(readdirSync(output)).toEqual([]);
    expect(readFileSync(path.join(sandbox, "inputs/patch-TOZUe3/bashrc.patch"), "utf8")).toBe("patch bytes\n");
  });

  it("rejects overwriting the input itself", () => {
    writeFileSync(path.join(output, "input.zip"), "input bytes");
    const result = runZip(["input.zip", "./input.zip"], { confirm: 0 });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("input");
    expect(readFileSync(path.join(output, "input.zip"), "utf8")).toBe("input bytes");
    expect(readdirSync(output)).toEqual(["input.zip"]);
  });

  it("rejects a destination symlink without modifying its target", () => {
    writeFileSync(path.join(sandbox, "original.zip"), "target bytes");
    symlinkSync(path.join(sandbox, "original.zip"), path.join(output, "chosen.zip"));
    const result = runZip(["../inputs/patch-TOZUe3/bashrc.patch", "chosen.zip"], { confirm: 0 });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("destination");
    expect(readFileSync(path.join(sandbox, "original.zip"), "utf8")).toBe("target bytes");
    expect(readdirSync(output)).toEqual(["chosen.zip"]);
  });

  it("forwards native option-first syntax without reinterpreting positional arguments", () => {
    const result = runZip(["-qj", "native.zip", "../inputs/patch-TOZUe3/bashrc.patch"]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(entries(path.join(output, "native.zip"))).toEqual(["bashrc.patch"]);
  });

  it("preserves a native zip failure status", () => {
    const result = runZip(["-q", "native.zip", "missing"]);
    expect(result.status).toBe(12);
    expect(result.stdout).toContain("Nothing to do!");
    expect(readdirSync(output)).toEqual([]);
  });
});

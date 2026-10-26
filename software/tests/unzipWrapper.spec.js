/** Native subprocess integration tests for extraction into an archive-named folder. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

/** Checkout root containing the actual shell implementation. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Full profile partial evaluated without loading an interactive shell. */
const PROFILE = readFileSync(path.join(ROOT, "software/scripts/bash-file-utils.profile.bash"), "utf8");
/** Shared source containing the real help and confirmation definitions. */
const COMMON = readFileSync(path.join(ROOT, "software/bootstrap/common-functions.bash"), "utf8");
/** Minimal helper definitions; no installer initialization or external configuration. */
const HELPERS = COMMON.match(/^function (?:is_help_arg|prompt_yes_no)\(\) \{[\s\S]*?^\}/gm).join("\n");
/** Stable example archive filename, unrelated to the test runner's clock. */
const ARCHIVE = "bashrc.patch-20261025-090534.zip";
/** Test-owned temporary root, always removed after the case. */
let sandbox;
/** Caller's working folder, distinct from the archive's source folder. */
let output;

/** Create independent source bytes and output folders; throws on filesystem errors. */
beforeEach(() => {
  sandbox = mkdtempSync(path.join(os.tmpdir(), "unzip-wrapper-"));
  output = path.join(sandbox, "output");
  mkdirSync(output);
  mkdirSync(path.join(sandbox, "source/nested"), { recursive: true });
  writeFileSync(path.join(sandbox, "source/bashrc.patch"), "patch bytes\n");
  writeFileSync(path.join(sandbox, "source/nested/note.txt"), "nested bytes\n");
});

/** Remove only this case's files, including after a failed subprocess assertion. */
afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

/**
 * Build a real archive through native zip, without using the wrapper under test.
 * @param {string} [name=ARCHIVE] - Filename under the sandbox root.
 * @param {string[]} [members=["bashrc.patch"]] - Literal source-relative input paths.
 * @returns {string} Absolute archive filename.
 * @throws {Error} On native zip or fixture failures; creates only test-owned files.
 */
function archive(name = ARCHIVE, members = ["bashrc.patch"]) {
  const filename = path.join(sandbox, name);
  const result = spawnSync("zip", ["-qr", filename, ...members], {
    cwd: path.join(sandbox, "source"),
    env: { ...process.env, BASH_ENV: "/dev/null", ZIPOPT: "" },
    encoding: "utf8",
    timeout: 5000,
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  return filename;
}

/**
 * Evaluate the actual wrapper with literal arguments in a terminal-free Bash process.
 * @param {string[]} args - Caller arguments, never interpolated into shell code.
 * @param {object} [options] - Owned prompt and reload controls.
 * @param {number} [options.confirm=1] - Prompt result; zero approves overwriting.
 * @param {boolean} [options.realPrompt=false] - Exercise the real no-terminal prompt.
 * @param {number} [options.loads=1] - Profile evaluation count.
 * @returns {import("child_process").SpawnSyncReturns<string>} Native status and captured output.
 * @throws {Error} When process creation fails; extraction writes only inside the sandbox.
 */
function runUnzip(args, { confirm = 1, realPrompt = false, loads = 1 } = {}) {
  const prompt = realPrompt ? "" : 'function prompt_yes_no() { printf "PROMPT: %s\\n" "$1" >&2; return "$PROMPT_STATUS"; }';
  return spawnSync("/bin/bash", ["--noprofile", "--norc", "-s", "--", ...args], {
    encoding: "utf8",
    input: `${HELPERS}\n${PROFILE.repeat(loads)}\n${prompt}\nunzip "$@"`,
    cwd: output,
    detached: true,
    env: { ...process.env, BASH_ENV: "/dev/null", PROMPT_STATUS: String(confirm), UNZIP: "", UNZIPOPT: "" },
    timeout: 5000,
  });
}

describe("unzip wrapper subprocess integration", () => {
  it("extracts the example archive into its filename stem instead of scattering members", () => {
    archive();
    const result = runUnzip([`../${ARCHIVE}`], { loads: 2 });
    expect(result.status, [result.error?.message, result.signal, result.stdout, result.stderr].filter(Boolean).join("\n")).toBe(0);
    expect(readdirSync(output)).toEqual(["bashrc.patch-20261025-090534"]);
    expect(readFileSync(path.join(output, "bashrc.patch-20261025-090534/bashrc.patch"), "utf8")).toBe("patch bytes\n");
  });

  it("extracts an archive in the current folder without changing or moving that archive", () => {
    const original = readFileSync(archive());
    writeFileSync(path.join(output, ARCHIVE), original);
    const result = runUnzip([`./${ARCHIVE}`]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(readdirSync(output)).toEqual(["bashrc.patch-20261025-090534", ARCHIVE]);
    expect(readFileSync(path.join(output, ARCHIVE))).toEqual(original);
    expect(readFileSync(path.join(output, "bashrc.patch-20261025-090534/bashrc.patch"), "utf8")).toBe("patch bytes\n");
  });

  it("uses the current working folder even for an absolute archive path", () => {
    const result = runUnzip([archive()]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(readdirSync(output)).toEqual(["bashrc.patch-20261025-090534"]);
    expect(readFileSync(path.join(sandbox, "source/bashrc.patch"), "utf8")).toBe("patch bytes\n");
  });

  it("preserves nested archive members below the extra output folder", () => {
    const result = runUnzip([archive("folder.zip", ["nested"])]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(readdirSync(path.join(output, "folder"))).toEqual(["nested"]);
    expect(readFileSync(path.join(output, "folder/nested/note.txt"), "utf8")).toBe("nested bytes\n");
  });

  it.each([
    ["file.name.ZIP", "file.name"],
    ["patch 'caf\u00e9.zip", "patch 'caf\u00e9"],
    ["-patch.zip", "-patch"],
  ])("uses the literal filename stem for %s", (name, stem) => {
    const result = runUnzip([archive(name)]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(readdirSync(output)).toEqual([stem]);
    expect(readFileSync(path.join(output, stem, "bashrc.patch"), "utf8")).toBe("patch bytes\n");
  });

  it("prompts before overwriting an existing output folder and preserves rejected state", () => {
    const filename = archive("chosen.zip");
    mkdirSync(path.join(output, "chosen"));
    writeFileSync(path.join(output, "chosen/bashrc.patch"), "keep original");
    const result = runUnzip([filename]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("PROMPT:");
    expect(readFileSync(path.join(output, "chosen/bashrc.patch"), "utf8")).toBe("keep original");
    expect(readdirSync(path.join(output, "chosen"))).toEqual(["bashrc.patch"]);
    expect(readdirSync(output)).toEqual(["chosen"]);
  });

  it("overwrites matching members only after confirmation and preserves unrelated files", () => {
    const filename = archive("chosen.zip");
    mkdirSync(path.join(output, "chosen"));
    writeFileSync(path.join(output, "chosen/bashrc.patch"), "old");
    writeFileSync(path.join(output, "chosen/unrelated.txt"), "keep me");
    const result = runUnzip([filename], { confirm: 0 });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stderr).toContain("PROMPT:");
    expect(readFileSync(path.join(output, "chosen/bashrc.patch"), "utf8")).toBe("patch bytes\n");
    expect(readFileSync(path.join(output, "chosen/unrelated.txt"), "utf8")).toBe("keep me");
  });

  it("declines an existing folder without a terminal", () => {
    const filename = archive("chosen.zip");
    mkdirSync(path.join(output, "chosen"));
    const result = runUnzip([filename], { realPrompt: true });
    expect(result.status).toBe(1);
    expect(readdirSync(path.join(output, "chosen"))).toEqual([]);
    expect(readdirSync(output)).toEqual(["chosen"]);
  });

  it("rejects a destination symlink without writing through it", () => {
    const filename = archive("chosen.zip");
    mkdirSync(path.join(sandbox, "target"));
    symlinkSync(path.join(sandbox, "target"), path.join(output, "chosen"));
    const result = runUnzip([filename], { confirm: 0 });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("destination");
    expect(readdirSync(path.join(sandbox, "target"))).toEqual([]);
    expect(readdirSync(output)).toEqual(["chosen"]);
  });

  it("rejects a destination occupied by a file without overwriting it", () => {
    const filename = archive("chosen.zip");
    writeFileSync(path.join(output, "chosen"), "keep me");
    const result = runUnzip([filename], { confirm: 0 });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("destination");
    expect(readFileSync(path.join(output, "chosen"), "utf8")).toBe("keep me");
    expect(readdirSync(output)).toEqual(["chosen"]);
  });

  it.each([{ args: [] }, { args: ["--help"] }])("shows wrapper help for $args without filesystem writes", ({ args }) => {
    const result = runUnzip(args);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: unzip <archive.zip>");
    expect(readdirSync(output)).toEqual([]);
  });

  it.each(["", "missing.zip"])("rejects missing archive %j without output", (input) => {
    const result = runUnzip([input]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toBe("");
    expect(readdirSync(output)).toEqual([]);
  });

  it.each([".zip", "..zip", "...zip", "not-a-zip.txt"])("rejects unsafe or unsupported archive basename %s", (name) => {
    const filename = archive(name);
    const result = runUnzip([filename]);
    expect(result.status).toBe(1);
    expect(result.stderr).not.toBe("");
    expect(readdirSync(output)).toEqual([]);
  });

  it("preserves native option-first listing behavior without extracting", () => {
    const result = runUnzip(["-Z1", archive()]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("bashrc.patch\n");
    expect(readdirSync(output)).toEqual([]);
  });

  it("preserves native multi-argument extraction into an explicit destination", () => {
    const result = runUnzip([archive(), "-d", "chosen"]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(readdirSync(output)).toEqual(["chosen"]);
    expect(readFileSync(path.join(output, "chosen/bashrc.patch"), "utf8")).toBe("patch bytes\n");
  });

  it("propagates native extraction errors without printing a success message", () => {
    writeFileSync(path.join(sandbox, "broken.zip"), "not a zip archive");
    const result = runUnzip([path.join(sandbox, "broken.zip")]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("End-of-central-directory signature not found");
    expect(result.stdout).not.toContain("Extracted:");
    expect(readdirSync(output)).toEqual([]);
  });
});

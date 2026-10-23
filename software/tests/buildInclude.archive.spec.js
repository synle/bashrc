/** Subprocess contracts for immutable instruction archives and normal active targets. */
import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

/** @type {string} Source checkout used only to copy the real generator and its dependency. */
const ROOT = path.resolve(".");
/** @type {string} Frozen corpus path; the similarly named sibling must remain active. */
const ARCHIVE = "software/scripts/advanced/llm/_common/v1";
/** @type {string[]} Per-test disposable repositories, registered before setup writes. */
const fixtures = [];
/** @type {{mode: string, args: string[], expected: string}[]} Literal public CLI contracts for each mode. */
const cases = [
  { mode: "build", args: [], expected: "<!-- BEGIN source.md -->\n\nFresh source\n\n<!-- END source.md -->\n" },
  { mode: "clean", args: ["--clean"], expected: "<!-- BEGIN source.md -->\n\n<!-- END source.md -->\n" },
];

/**
 * Create an isolated tracked repository with differing active/archive include payloads.
 * @returns {string} Temporary repository root, registered for teardown immediately.
 * @throws {Error} If filesystem setup or Git initialization fails.
 */
function createFixture() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "include-archive-"));
  fixtures.push(folder);
  fs.mkdirSync(path.join(folder, "software/tools"), { recursive: true });
  fs.mkdirSync(path.join(folder, ARCHIVE), { recursive: true });
  fs.mkdirSync(path.join(folder, `${ARCHIVE}-notes`), { recursive: true });
  fs.writeFileSync(
    path.join(folder, "software/tools/build-include.js"),
    fs.readFileSync(path.join(ROOT, "software/tools/build-include.js")),
  );
  fs.writeFileSync(path.join(folder, "software/common.js"), fs.readFileSync(path.join(ROOT, "software/common.js")));
  fs.mkdirSync(path.join(folder, "theme/sy"), { recursive: true });
  for (const mode of ["dark", "light"])
    fs.writeFileSync(
      path.join(folder, `theme/sy/_palette_${mode}.jsonc`),
      fs.readFileSync(path.join(ROOT, `theme/sy/_palette_${mode}.jsonc`)),
    );
  fs.writeFileSync(path.join(folder, "source.md"), "Fresh source\n");
  fs.writeFileSync(path.join(folder, ARCHIVE, "instructions.md"), "<!-- BEGIN source.md -->\nFrozen source\n<!-- END source.md -->\n");
  fs.writeFileSync(path.join(folder, "active.md"), "<!-- BEGIN source.md -->\nOld active\n<!-- END source.md -->\n");
  fs.writeFileSync(path.join(folder, `${ARCHIVE}-notes`, "active.md"), "<!-- BEGIN source.md -->\nOld sibling\n<!-- END source.md -->\n");
  execFileSync("git", ["init", "--quiet", folder], { timeout: 10000 });
  execFileSync("git", ["add", "."], { cwd: folder, timeout: 10000 });
  return folder;
}

afterEach(() => {
  for (const folder of fixtures.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

describe("build-include archive protection (subprocess)", () => {
  it.each(cases)("preserves tracked archives during automatic $mode scanning", ({ args, expected }) => {
    const folder = createFixture();
    const frozen = fs.readFileSync(path.join(folder, ARCHIVE, "instructions.md"));
    const output = execFileSync(process.execPath, ["software/tools/build-include.js", ...args], {
      cwd: folder,
      env: { ...process.env, NODE_PATH: path.join(ROOT, "node_modules") },
      encoding: "utf8",
      timeout: 10000,
    });
    expect(fs.readFileSync(path.join(folder, ARCHIVE, "instructions.md"))).toEqual(frozen);
    expect(fs.readFileSync(path.join(folder, "active.md"), "utf8")).toBe(expected);
    expect(fs.readFileSync(path.join(folder, `${ARCHIVE}-notes`, "active.md"), "utf8")).toBe(expected);
    expect(output).toContain("2 file(s) updated");
  });

  it.each(cases)("preserves explicit relative, normalized, and absolute archive targets during $mode", ({ args, expected }) => {
    const folder = createFixture();
    const archiveFile = `${ARCHIVE}/instructions.md`;
    const frozen = fs.readFileSync(path.join(folder, archiveFile));
    const output = execFileSync(
      process.execPath,
      [
        "software/tools/build-include.js",
        ...args,
        archiveFile,
        `./${ARCHIVE}/../v1/instructions.md`,
        path.join(folder, archiveFile),
        "active.md",
        "missing.md",
      ],
      { cwd: folder, env: { ...process.env, NODE_PATH: path.join(ROOT, "node_modules") }, encoding: "utf8", timeout: 10000 },
    );
    expect(fs.readFileSync(path.join(folder, archiveFile))).toEqual(frozen);
    expect(output).toContain("1 file(s) updated");
    expect(output).toContain("File not found: missing.md, skipping");
    expect(fs.readFileSync(path.join(folder, "active.md"), "utf8")).toBe(expected);
  });

  it("keeps archive bytes during repository-wide and explicit formatter traversal", () => {
    const folder = createFixture();
    fs.writeFileSync(path.join(folder, ".oxfmtrc.json"), fs.readFileSync(path.join(ROOT, ".oxfmtrc.json")));
    const archiveFile = path.join(folder, ARCHIVE, "instructions.md");
    const activeFile = path.join(folder, "format.md");
    fs.writeFileSync(archiveFile, "#   Frozen\n\n-    preserve   spacing\n");
    fs.writeFileSync(activeFile, "#   Active\n\n-    normalize   spacing\n");
    const frozen = fs.readFileSync(archiveFile);
    execFileSync(path.join(ROOT, "node_modules/.bin/oxfmt"), ["--write", "."], { cwd: folder, timeout: 10000 });
    expect(fs.readFileSync(archiveFile)).toEqual(frozen);
    expect(fs.readFileSync(activeFile, "utf8")).toBe("# Active\n\n- normalize spacing\n");
    execFileSync(path.join(ROOT, "node_modules/.bin/oxfmt"), ["--write", archiveFile, activeFile], { cwd: folder, timeout: 10000 });
    expect(fs.readFileSync(archiveFile)).toEqual(frozen);
  });
});

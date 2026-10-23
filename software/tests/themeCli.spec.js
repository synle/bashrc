/** Executes the actual compiler against isolated repositories to prove ownership, discovery, and failure atomicity. */
import { describe, expect, it, onTestFinished } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync, spawnSync } from "child_process";

const root = path.resolve(".");
const active = '{\n  "foreground": "#000000" // {{dark.blue}}\n}\n';

/** Creates an owned compiler checkout; cleanup is registered before setup can fail. */
function fixture() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "theme-cli-"));
  onTestFinished(() => fs.rmSync(folder, { recursive: true, force: true }));
  for (const name of ["software/tools", "theme/sy", "theme/baseline"]) fs.mkdirSync(path.join(folder, name), { recursive: true });
  for (const file of [
    "software/tools/build-include.js",
    "software/common.js",
    "theme/sy/_palette_dark.jsonc",
    "theme/sy/_palette_light.jsonc",
  ])
    fs.writeFileSync(path.join(folder, file), fs.readFileSync(path.join(root, file)));
  fs.writeFileSync(path.join(folder, "theme/sy/example_dark.jsonc"), active);
  fs.writeFileSync(path.join(folder, "theme/baseline/example_dark.jsonc"), active);
  return folder;
}

/** Runs the actual CLI with bounded execution and this checkout's existing parser dependency. */
function run(folder, args = []) {
  return spawnSync(process.execPath, ["software/tools/build-include.js", ...args], {
    cwd: folder,
    env: { ...process.env, NODE_PATH: path.join(root, "node_modules") },
    encoding: "utf8",
    timeout: 10000,
  });
}

describe("active theme compiler CLI", () => {
  it("renders explicit targets without Git while preserving baseline and foundation bytes", () => {
    const folder = fixture();
    const original = fs.readFileSync(path.join(folder, "theme/sy/_palette_dark.jsonc"));
    const result = run(folder, ["theme/sy/example_dark.jsonc", "theme/baseline/example_dark.jsonc", "theme/sy/_palette_dark.jsonc"]);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(path.join(folder, "theme/sy/example_dark.jsonc"), "utf8")).toContain('"foreground": "#5ca0d7"');
    expect(fs.readFileSync(path.join(folder, "theme/baseline/example_dark.jsonc"), "utf8")).toBe(active);
    expect(fs.readFileSync(path.join(folder, "theme/sy/_palette_dark.jsonc"))).toEqual(original);
  });

  it("discovers an active template before it has been staged", () => {
    const folder = fixture();
    execFileSync("git", ["init", "--quiet", folder]);
    const result = run(folder);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(path.join(folder, "theme/sy/example_dark.jsonc"), "utf8")).toContain("#5ca0d7");
  });

  it.each([
    ["unknown", '{"x":"#000000"} // {{dark.unknown}}'],
    ["unbound", '{"color":"#000000","fontStyle":"bold"} // {{dark.blue}}'],
    ["malformed", '{"color":"#000000", // {{dark.blue}}\nbroken'],
  ])("rejects %s source before modifying any active file", (_name, source) => {
    const folder = fixture();
    fs.writeFileSync(path.join(folder, "theme/sy/invalid_dark.jsonc"), source);
    const result = run(folder);
    // Automatic discovery requires a Git root; explicit inputs also prove no Git side effect is required.
    const explicit = run(folder, ["theme/sy/example_dark.jsonc", "theme/sy/invalid_dark.jsonc"]);
    expect(explicit.status).not.toBe(0);
    expect(explicit.stderr).toMatch(/unknown inline marker|unbound theme marker|invalid JSONC/);
    expect(fs.readFileSync(path.join(folder, "theme/sy/example_dark.jsonc"), "utf8")).toBe(active);
    expect(fs.readFileSync(path.join(folder, "theme/sy/invalid_dark.jsonc"), "utf8")).toBe(source);
    expect(result.status).not.toBe(0);
  });
});

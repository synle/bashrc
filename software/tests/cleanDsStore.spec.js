/** Behavior tests for clean_ds_store in software/bootstrap/common-functions.bash. */
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

const ROOT_DIR = path.resolve(import.meta.dirname, "../..");
const COMMON_FUNCTIONS = path.join(ROOT_DIR, "software/bootstrap/common-functions.bash");
const TEMP_FOLDERS = [];

afterEach(() => {
  for (const folder of TEMP_FOLDERS.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

/**
 * Run clean_ds_store in an isolated macOS-like shell.
 * @param {string[]} args - Arguments passed to clean_ds_store.
 * @param {string} folder - Working folder for the shell.
 * @returns {string} Helper output.
 */
function runCleanDsStore(args, folder) {
  const script = [
    "set -e",
    "is_os_mac=1",
    `source ${JSON.stringify(COMMON_FUNCTIONS)}`,
    `clean_ds_store${args.length ? ` ${args.map((arg) => JSON.stringify(arg)).join(" ")}` : ""}`,
  ].join("\n");
  return execFileSync("bash", ["-c", script], { cwd: folder, encoding: "utf8" });
}

describe("clean_ds_store", () => {
  it("cleans the current folder when called without a path", () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "clean_ds_store_"));
    TEMP_FOLDERS.push(folder);
    const nested = path.join(folder, "nested");
    const gitFolder = path.join(folder, ".git");
    fs.mkdirSync(nested);
    fs.mkdirSync(gitFolder);
    fs.writeFileSync(path.join(folder, ".DS_Store"), "junk");
    fs.writeFileSync(path.join(nested, ".DS_Store"), "junk");
    fs.writeFileSync(path.join(gitFolder, ".DS_Store"), "keep");

    const output = runCleanDsStore([], folder);

    expect(fs.existsSync(path.join(folder, ".DS_Store"))).toBe(false);
    expect(fs.existsSync(path.join(nested, ".DS_Store"))).toBe(false);
    expect(fs.existsSync(path.join(gitFolder, ".DS_Store"))).toBe(true);
    expect(output).toContain("Removed 2 file(s)");
  });
});

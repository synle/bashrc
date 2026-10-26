/** Subprocess coverage for the global Base85 shell command. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "module";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const require = createRequire(import.meta.url);
const base85 = require("base85");
const PROFILE = path.resolve("software/scripts/bash-base85.profile.bash");
const BASE85_MODULE = path.resolve("node_modules/base85");
let home;

/** Run the real profile function with a private home and installed-module link. */
function run(args, input) {
  const result = spawnSync(
    "/bin/bash",
    [
      "--noprofile",
      "--norc",
      "-c",
      `
        function is_help_arg() { [ "$1" = "--help" ] || [ "$1" = "-h" ]; }
        function _snip_require_binary() { type -P "$1" > /dev/null 2>&1; }
        function prompt_yes_no() { return 1; }
        function _snip_run() { command "$@"; }
        source "$PROFILE"
        base85 "$@"
      `,
      "base85-command",
      ...args,
    ],
    {
      cwd: process.cwd(),
      encoding: null,
      input,
      timeout: 10000,
      env: { ...process.env, HOME: home, PROFILE, BASH_ENV: "/dev/null" },
    },
  );
  return result;
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "base85-command-"));
  const moduleFolder = path.join(home, ".local/lib/node_modules");
  fs.mkdirSync(moduleFolder, { recursive: true });
  fs.symlinkSync(BASE85_MODULE, path.join(moduleFolder, "base85"), "dir");
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

describe("base85 command", () => {
  it("encodes stdin as the known unframed ASCII85 vector", () => {
    const result = run([], Buffer.from("Hello, world!"));

    expect(result.status).toBe(0);
    expect(result.stdout.toString("ascii")).toBe("87cURD_*#TDfTZ)+T\n");
    expect(result.stderr.toString("utf8")).toBe("");
  });

  it("encodes a file whose path contains spaces", () => {
    const file = path.join(home, "input with spaces.bin");
    fs.writeFileSync(file, Buffer.from("Hello, world!"));

    const result = run([file]);

    expect(result.status).toBe(0);
    expect(result.stdout.toString("ascii")).toBe("87cURD_*#TDfTZ)+T\n");
  });

  it("preserves arbitrary binary bytes, including repeated zero blocks", () => {
    const input = Buffer.from([0, 0, 0, 0, 255, 128, 1, 2, 0, 0, 0, 0]);
    const file = path.join(home, "binary.bin");
    fs.writeFileSync(file, input);

    const result = run([file]);
    const encoded = result.stdout.toString("ascii").trimEnd();

    expect(result.status).toBe(0);
    expect(base85.decode(encoded, "a85")).toEqual(input);
  });
});

/** Regression tests for bootstrap help dependencies in source and persisted profiles. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/** Environment source and generated runner definitions, exercised independently. */
const sources = [
  ["common-env.sh", fs.readFileSync(new URL("../bootstrap/common-env.sh", import.meta.url), "utf8")],
  ["run.sh", fs.readFileSync(new URL("../../run.sh", import.meta.url), "utf8")],
];
/** Runner serialization command, rather than a fixture copy of its behavior. */
const persistCommand = sources[1][1].match(/^declare -f [^\n]*\bis_truthy\b[^\n]*$/m)[0];
/** Private generated profile fixture, recreated for each test. */
let sandbox;

beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "bootstrap truthy "));
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

/**
 * Run real bootstrap definitions directly or serialize them for a clean BASH_ENV child.
 * @param {string} source - Environment or generated runner source.
 * @param {string[]} args - Predicate arguments, passed without shell interpolation.
 * @param {"source" | "persisted"} surface - Bootstrap execution surface.
 * @returns {import("child_process").SpawnSyncReturns<string>} Child output and status.
 */
function runTruthy(source, args, surface) {
  const definitions = source.match(/^function (?:is_help_arg|is_truthy)\(\) \{[\s\S]*?^\}/gm).join("\n");
  const command =
    surface === "source"
      ? 'is_truthy "$@"'
      : `${persistCommand}\nBASH_ENV="$BASH_SYLE_COMMON_PATH" /bin/bash --noprofile --norc -c 'is_truthy "$@"' predicate "$@"`;
  return spawnSync("/bin/bash", ["--noprofile", "--norc", "-s", "--", ...args], {
    encoding: "utf8",
    timeout: 5000,
    env: {
      HOME: sandbox,
      PATH: process.env.PATH,
      BASH_SYLE_COMMON_PATH: path.join(sandbox, ".bash_syle_common"),
    },
    input: `${definitions}\n${command}\n`,
  });
}

for (const [label, source] of sources) {
  for (const surface of ["source", "persisted"]) {
    describe(`is_truthy from ${label} (${surface})`, () => {
      it.each([
        ["1", 0],
        ["true", 0],
        ["TrUe", 0],
        ["y", 0],
        ["Y", 0],
        ["yes", 0],
        ["YES", 0],
        ["0", 1],
        ["false", 1],
        ["no", 1],
        ["", 1],
        ["true ", 1],
        ["helpme", 1],
      ])("checks %j before the interactive profile loads", (value, status) => {
        const result = runTruthy(source, [value], surface);
        expect(result.status).toBe(status);
        expect(result.stdout).toBe("");
        expect(result.stderr).toBe("");
      });

      it("returns false without arguments before the interactive profile loads", () => {
        const result = runTruthy(source, [], surface);
        expect(result.status).toBe(1);
        expect(result.stdout).toBe("");
        expect(result.stderr).toBe("");
      });

      it.each(["help", "--help", "-help", "/help", "-h", "?", "-?", "/?", "--HELP"])(
        "prints help for %s before the interactive profile loads",
        (arg) => {
          const result = runTruthy(source, [arg], surface);
          expect(result.status).toBe(0);
          expect(result.stdout).toContain("is_truthy: check if a value is truthy");
          expect(result.stdout).toContain("is_truthy false");
          expect(result.stderr).toBe("");
        },
      );
    });
  }
}

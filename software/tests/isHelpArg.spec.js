/** Tests for is_help_arg in profile-core.sh and common-functions.bash. */
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE_CORE = path.join(ROOT_DIR, "software/bootstrap/profile-core.sh");
const COMMON_FUNCTIONS = path.join(ROOT_DIR, "software/bootstrap/common-functions.bash");

/**
 * Pull just the `is_help_arg` function body out of a file by line markers — the
 * surrounding scripts contain top-level statements (debug-tracing, env exports,
 * sourcing) that cannot run in a hermetic test harness.
 * @param {string} file - absolute path to the source file
 * @returns {string} the function definition block, ready to source in bash -c
 */
function extractIsHelpArg(file) {
  const text = fs.readFileSync(file, "utf-8");
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.startsWith("function is_help_arg()"));
  if (start === -1) throw new Error(`could not locate 'function is_help_arg()' in ${file}`);
  let close = start + 1;
  while (close < lines.length && lines[close] !== "}") close++;
  if (close === lines.length) throw new Error(`could not locate closing brace of is_help_arg in ${file}`);
  return lines.slice(start, close + 1).join("\n");
}

const PROFILE_CORE_BODY = extractIsHelpArg(PROFILE_CORE);
const COMMON_FUNCTIONS_BODY = extractIsHelpArg(COMMON_FUNCTIONS);

/**
 * Source the extracted function in bash, call it with one argument, exit with
 * the function's status. Pipes the script via stdin (not `bash -c "..."`) so
 * real newlines are preserved — `bash -c` over a JSON-stringified multi-line
 * string sees `\n` as literal backslash-n and fails to parse.
 * @param {string} body - extracted is_help_arg function definition
 * @param {string} arg - the argument to pass to is_help_arg
 * @returns {boolean} true if is_help_arg returned 0 (recognized as help trigger)
 */
function callIsHelpArg(body, arg) {
  return runBashScript(`${body}\nis_help_arg ${JSON.stringify(arg)}`);
}

/**
 * Run a bash snippet via stdin, return true on exit 0.
 * @param {string} script
 * @returns {boolean}
 */
function runBashScript(script) {
  try {
    execSync("bash", { input: script, stdio: ["pipe", "ignore", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

describe("is_help_arg — profile-core.sh + common-functions.bash mirrored helper", () => {
  it("the two copies have byte-identical bodies (any drift breaks consistency)", () => {
    expect(COMMON_FUNCTIONS_BODY).toBe(PROFILE_CORE_BODY);
  });

  // Run every case against both copies — guarantees divergence shows up as a test
  // failure, not a runtime surprise on whichever shell sourced the wrong copy.
  for (const [label, body] of [
    ["profile-core.sh", PROFILE_CORE_BODY],
    ["common-functions.bash", COMMON_FUNCTIONS_BODY],
  ]) {
    describe(label, () => {
      describe("recognized triggers (lowercase)", () => {
        for (const arg of ["help", "--help", "-help", "/help", "-h", "?", "-?", "/?"]) {
          it(`'${arg}' → match`, () => {
            expect(callIsHelpArg(body, arg)).toBe(true);
          });
        }
      });

      describe("recognized triggers (case-insensitive)", () => {
        for (const arg of ["HELP", "Help", "--HELP", "--Help", "-HELP", "/HELP", "-H"]) {
          it(`'${arg}' → match`, () => {
            expect(callIsHelpArg(body, arg)).toBe(true);
          });
        }
      });

      describe("non-help args do NOT match", () => {
        for (const arg of [
          "",
          "foo",
          "helpme",
          "--helpme",
          "-help-me",
          "h", // bare 'h' alone is NOT a help trigger; require -h to avoid clobbering legitimate args
          "?h",
          "-h?",
          "//?", // double slash, not a Windows trigger
          "-",
          "--",
          "/",
          "help me",
        ]) {
          it(`'${arg}' → no match`, () => {
            expect(callIsHelpArg(body, arg)).toBe(false);
          });
        }
      });

      describe("edge cases the case-insensitive lowering must handle", () => {
        // tr-based lowercasing is locale-aware on some systems. Pure ASCII input
        // must always work regardless of LC_ALL — these tests catch any
        // accidental switch to a parameter expansion that requires bash 4.
        it("'-h' with weird LC_ALL still matches", () => {
          expect(runBashScript(`LC_ALL=C\n${body}\nis_help_arg "-h"`)).toBe(true);
        });

        it("missing arg (zero positional params) → no match", () => {
          expect(runBashScript(`${body}\nis_help_arg`)).toBe(false);
        });
      });
    });
  }
});

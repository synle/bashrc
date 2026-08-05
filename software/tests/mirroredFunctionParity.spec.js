/**
 * Tests for byte-identical mirrored functions across profile-core.sh,
 * profile-advanced.sh, and common-functions.bash.
 *
 * The following pairs MUST remain byte-identical because the profile copies
 * exist for performance (avoid sourcing common-functions.bash on every
 * interactive shell) while common-functions.bash is the source of truth
 * for scripts:
 *   is_help_arg:   profile-core.sh ←→ common-functions.bash
 *   prompt_yes_no: profile-advanced.sh ←→ common-functions.bash
 *   get_native_arch:    profile-core.sh ←→ common-functions.bash
 *   is_arch_translated: profile-core.sh ←→ common-functions.bash
 *   run_native:         profile-core.sh ←→ common-functions.bash
 *
 * Any divergence between a pair is a bug — interactive shell and script
 * callers would see different behavior for the same function.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE_CORE = path.join(ROOT_DIR, "software/bootstrap/profile-core.sh");
const PROFILE_ADVANCED = path.join(ROOT_DIR, "software/bootstrap/profile-advanced.sh");
const COMMON_FUNCTIONS = path.join(ROOT_DIR, "software/bootstrap/common-functions.bash");

/**
 * Extract a function definition block by name from a bash source file.
 * Matches `^function <name>()` through the closing `}` on its own line.
 * @param {string} file - absolute path to the source file
 * @param {string} name - function name
 * @returns {string}
 */
function extractFunction(file, name) {
  const text = fs.readFileSync(file, "utf-8");
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.startsWith(`function ${name}()`));
  if (start === -1) throw new Error(`could not locate 'function ${name}()' in ${file}`);
  let close = start + 1;
  while (close < lines.length && lines[close] !== "}") close++;
  if (close === lines.length) throw new Error(`could not locate closing brace of ${name} in ${file}`);
  return lines.slice(start, close + 1).join("\n");
}

/** @type {[string, string, string, string][]} */
const PAIRS = [
  ["is_help_arg", "profile-core.sh", PROFILE_CORE, "common-functions.bash", COMMON_FUNCTIONS],
  ["prompt_yes_no", "profile-advanced.sh", PROFILE_ADVANCED, "common-functions.bash", COMMON_FUNCTIONS],
  ["get_native_arch", "profile-core.sh", PROFILE_CORE, "common-functions.bash", COMMON_FUNCTIONS],
  ["is_arch_translated", "profile-core.sh", PROFILE_CORE, "common-functions.bash", COMMON_FUNCTIONS],
  ["run_native", "profile-core.sh", PROFILE_CORE, "common-functions.bash", COMMON_FUNCTIONS],
].map(([name, labelA, fileA, labelB, fileB]) => [name, labelA, extractFunction(fileA, name), labelB, extractFunction(fileB, name)]);

describe("mirrored function parity (byte-identical bodies)", () => {
  for (const [name, labelA, bodyA, labelB, bodyB] of PAIRS) {
    it(`${name}: ${labelA} ←→ ${labelB} identical`, () => {
      expect(bodyA).toBe(bodyB);
    });
  }
});

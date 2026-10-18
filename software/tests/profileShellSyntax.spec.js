/**
 * Syntax check for every shell source that can be inlined into a profile.
 *
 * `profileSyntax.spec.js` only syntax-checks the top-level `software/scripts/*.profile.bash`
 * partials, and only under `make test_profile` (which needs `.build/profile_bashrc_*.sh`
 * artifacts and is excluded from the default vitest run). A botched edit to a partial —
 * e.g. deleting a `function foo() {` header but leaving its closing `}` and body behind —
 * still ships a profile that fails `source ~/.bash_syle`, because nothing in the fast
 * suite parses the partial in isolation.
 *
 * This spec closes that gap: every recursive `*.profile.bash` / `*.bash` under
 * `software/scripts/` and `software/bootstrap/` must pass `bash -n`, under both the bash
 * on PATH and the oldest local bash (the 3.2 portability floor), with no `.build/` needed.
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "child_process";
import { existsSync, readdirSync, realpathSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Recursively lists files under `dir` whose basename satisfies `predicate`.
 * @param {string} dir - Absolute directory path (missing dir yields [])
 * @param {(name: string) => boolean} predicate - Basename filter
 * @param {string[]} out - Accumulator (mutated)
 * @returns {string[]} Sorted absolute file paths
 */
function walkFiles(dir, predicate, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(p, predicate, out);
    else if (entry.isFile() && predicate(entry.name)) out.push(p);
  }
  return out.sort();
}

/**
 * The oldest bash available locally, checked in addition to the bash on PATH. Mirrors
 * `profileSyntax.spec.js`: on macOS `/bin/bash` is 3.2.57 (the portability floor) while
 * PATH bash is often Homebrew 5.x, which parses constructs 3.2 rejects.
 * @type {string | null}
 */
const LEGACY_BASH = (() => {
  const candidate = "/bin/bash";
  if (!existsSync(candidate)) return null;
  try {
    const pathBash = execFileSync("bash", ["-c", "command -v bash"], { encoding: "utf-8" }).trim();
    if (pathBash && realpathSync(pathBash) === realpathSync(candidate)) return null;
  } catch {
    return null;
  }
  return candidate;
})();

const BASH_BINARIES = ["bash", ...(LEGACY_BASH ? [LEGACY_BASH] : [])];

const shellSources = [
  ...walkFiles(path.join(ROOT_DIR, "software/scripts"), (n) => /\.(profile\.bash|bash)$/.test(n) && !n.endsWith(".ps1.bash")),
  ...walkFiles(path.join(ROOT_DIR, "software/bootstrap"), (n) => n.endsWith(".bash")),
];

describe("profile shell source syntax", () => {
  it("should find shell sources to test", () => {
    expect(shellSources.length).toBeGreaterThan(0);
  });

  shellSources.forEach((filePath) => {
    const relPath = path.relative(ROOT_DIR, filePath);

    it(`${relPath} - no syntax errors`, () => {
      for (const bash of BASH_BINARIES) {
        let stderr = "";
        const failed = (() => {
          try {
            execFileSync(bash, ["-n", filePath], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
            return false;
          } catch (err) {
            stderr = (err.stderr || "").trim();
            return true;
          }
        })();
        expect(failed, `${relPath} fails \`${bash} -n\`:\n${stderr}`).toBe(false);
      }
    });
  });
});

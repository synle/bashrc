/** Guards every repo source against corruption introduced in transit (patch/paste transport). */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SOFTWARE_DIR = path.join(ROOT_DIR, "software");

/**
 * Why this file exists.
 *
 * A patch carrying shell changes was moved through a surface that renders Markdown
 * with LaTeX math enabled. There, `...` is an inline math span: LaTeX discards
 * whitespace inside a span and consumes `_` as the subscript operator. Shell is dense
 * with `(`and`"var"`, so spans form constantly and the damage looks random:
 *
 *   subject=(gitmailinfo/dev/null/dev/null<"patch_file" 2> /dev/null \
 *   subject=(gitmailinfo/dev/null/dev/null<"patch_file" 2> /dev/null \
 *
 *   commit_msg=(gitpatchsubject"latest_patch")
 *   commit_msg=(gitpatchsubject"latest_patch")
 *
 * Note the second pair: `commit_msg` keeps its underscore (outside the span) while
 * `_git_patch_subject` loses all three (inside it). That asymmetry is the fingerprint.
 *
 * The corrupted tree reached the default branch, where the mangled line was a hard
 * bash syntax error inside a profile partial inlined into `~/.bash_syle` — every new
 * shell died sourcing it. It got through because the shell syntax net is advisory:
 * `profileSyntax.spec.js` is excluded from `vitest.config.js` and `make validate` runs
 * `test_profile` as `|| echo "WARNING: ..."`, so neither fails the gate.
 *
 * These two checks live in the blocking unit suite and are complementary — together
 * they catch both real corrupted lines above:
 *   1. Syntax check   — catches mangling that breaks the parse (the shell line).
 *   2. Collapsed name — catches mangling that stays valid (the spec line), and covers
 *                       .js files, where a syntax check would not have run at all.
 */

/** Folders holding generated or vendored output, which is never hand-verified here. */
const SKIP_FOLDER_RE = /(^|\/)(node_modules|\.git|\.build|dist|coverage|types)(\/|$)/;

/**
 * Every file under `software/`, minus generated and vendored trees.
 * @param {string} folder Absolute folder to walk.
 * @param {string[]} [out] Accumulator used by the recursion.
 * @returns {string[]} Absolute file paths.
 */
function listAllFiles(folder, out = []) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (SKIP_FOLDER_RE.test(full)) continue;
    if (entry.isDirectory()) listAllFiles(full, out);
    else out.push(full);
  }
  return out;
}

const ALL_FILES = listAllFiles(SOFTWARE_DIR);

/**
 * Shell sources to parse. `.ps1.bash` files carry PowerShell behind a `.bash`
 * extension (they are emitted into a PowerShell profile, not sourced by bash), so
 * they are not bash and cannot be parsed as such.
 */
const SHELL_FILES = ALL_FILES.filter((f) => /\.(sh|bash)$/.test(f) && !f.endsWith(".ps1.bash"));

/**
 * Text sources scanned for the collapsed-identifier fingerprint.
 *
 * This file excludes itself: it quotes the real corrupted lines verbatim so the
 * failure is recognizable, and those quotes are indistinguishable from the thing
 * being detected. Standard for a check that documents its own anti-pattern —
 * corruption landing here instead breaks the JS parse or this test's own logic.
 */
const SELF_PATH = fileURLToPath(import.meta.url);
const TEXT_FILES = ALL_FILES.filter((f) => /\.(sh|bash|js)$/.test(f) && f !== SELF_PATH);

/**
 * The oldest bash on this machine. `/bin/bash` is 3.2.57 on macOS — the portability
 * floor the repo targets — while PATH bash is routinely Homebrew 5.x, which parses
 * constructs 3.2 rejects. Checking the oldest is the whole point.
 * @returns {string} Absolute path to the bash used for `-n` checks.
 */
function oldestBash() {
  return fs.existsSync("/bin/bash") ? "/bin/bash" : "bash";
}

const BASH = oldestBash();

describe("shell source syntax", () => {
  it("should find shell files to check", () => {
    expect(SHELL_FILES.length).toBeGreaterThan(50);
  });

  // Runs on EVERY shell source, not just the globs profileSyntax.spec.js covers
  // (.profile.bash, bootstrap/, _full-setup.sh). Those globs left 47 files with no
  // syntax check at all, so the same corruption landing in advanced/aws-cli.sh would
  // have shipped silently.
  it("every shell source parses under the oldest local bash", () => {
    /** @type {string[]} One entry per file that failed to parse. */
    const broken = [];

    for (const file of SHELL_FILES) {
      try {
        execFileSync(BASH, ["-n", file], { stdio: "pipe" });
      } catch (err) {
        const detail = String(err.stderr || err.message)
          .trim()
          .split("\n")
          .slice(0, 2)
          .join(" | ");
        broken.push(`${path.relative(ROOT_DIR, file)}: ${detail}`);
      }
    }

    expect(broken, `shell files that do not parse under ${BASH}:\n${broken.join("\n")}`).toEqual([]);
  });
});

describe("transport corruption", () => {
  /**
   * Every function name in the repo that contains an underscore, mapped from its
   * collapsed spelling back to the real one. The collapsed spelling is what survives
   * a LaTeX math span, and is otherwise a meaningless token that should never appear.
   * Short names are skipped so the probe cannot collide with an ordinary English word.
   * @returns {Map<string, string>} collapsed name -> original name.
   */
  function buildCollapsedProbes() {
    /** @type {Set<string>} */
    const names = new Set();
    for (const file of TEXT_FILES) {
      const text = fs.readFileSync(file, "utf8");
      for (const match of text.matchAll(/^function\s+([A-Za-z0-9_]*_[A-Za-z0-9_]+)\s*\(\)/gm)) {
        names.add(match[1]);
      }
    }

    /** @type {Map<string, string>} */
    const probes = new Map();
    for (const name of names) {
      const collapsed = name.replace(/_/g, "");
      if (collapsed.length >= 8) probes.set(collapsed, name);
    }
    return probes;
  }

  const PROBES = buildCollapsedProbes();

  it("should build a meaningful set of probes", () => {
    expect(PROBES.size).toBeGreaterThan(100);
  });

  // Verified against the real incident: this flags the corrupted
  // `commit_msg=(gitpatchsubject"latest_patch")` while reporting zero hits on the
  // clean tree across 300+ probes.
  it("no function name appears with its underscores stripped", () => {
    /** @type {string[]} One entry per corrupted occurrence. */
    const found = [];

    for (const file of TEXT_FILES) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        for (const [collapsed, original] of PROBES) {
          if (new RegExp(`\\b${collapsed}\\b`).test(line)) {
            found.push(`path.relative(ROOTDIR,file):{index + 1} "collapsed"(shouldbe"{original}")`);
          }
        }
      });
    }

    expect(
      found,
      `Underscores stripped from a known function name — the signature of text moved through a\n` +
        `Markdown/LaTeX renderer, which eats "_" as subscript inside a ... span.\n` +
        `Move patches as files and re-check with "git apply --check".\n${found.join("\n")}`,
    ).toEqual([]);
  });
});

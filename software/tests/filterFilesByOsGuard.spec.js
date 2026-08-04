/** Tests for _filterFilesByOsGuard — applies the same OS-folder filter as full runs to --files= / --preset= entries, with logging for skipped files. */
import { describe, it, expect, beforeEach } from "vitest";
import { getIndexFunction, getIndexConstant } from "./setup.js";

const _filterFilesByOsGuard = getIndexFunction("_filterFilesByOsGuard");
const OS_SCRIPT_PATHS = getIndexConstant("OS_SCRIPT_PATHS");

/**
 * Helper to set OS_SCRIPT_PATHS state for a single test, then restore it after. The sandbox
 * builds OS_SCRIPT_PATHS once from process.env at load time (empty in tests) — direct mutation
 * is the only way to inject a known platform mix.
 * @param {Array<[boolean, string]>} entries - flag/path pairs to install before the test
 * @param {() => void} fn - test body
 */
function withOsPaths(entries, fn) {
  const original = [...OS_SCRIPT_PATHS];
  OS_SCRIPT_PATHS.length = 0;
  for (const e of entries) OS_SCRIPT_PATHS.push(e);
  try {
    fn();
  } finally {
    OS_SCRIPT_PATHS.length = 0;
    for (const e of original) OS_SCRIPT_PATHS.push(e);
  }
}

describe("_filterFilesByOsGuard", () => {
  beforeEach(() => {
    // sandbox.log is stubbed to () => {} so no output noise during tests.
  });

  it("filters out scripts in non-matching OS folders", () => {
    withOsPaths(
      [
        [true, "software/scripts/mac"],
        [false, "software/scripts/windows"],
        [false, "software/scripts/wsl"],
      ],
      () => {
        const result = _filterFilesByOsGuard(["mac/iterm.js", "windows/windows-terminal.js", "wsl/something.js", "advanced/ghostty.js"]);
        expect(result).toEqual(["mac/iterm.js", "advanced/ghostty.js"]);
      },
    );
  });

  it("keeps scripts in the active OS folder", () => {
    withOsPaths(
      [
        [true, "software/scripts/mac"],
        [false, "software/scripts/windows"],
      ],
      () => {
        const result = _filterFilesByOsGuard(["mac/iterm.js"]);
        expect(result).toEqual(["mac/iterm.js"]);
      },
    );
  });

  it("keeps scripts that live outside any OS folder", () => {
    withOsPaths(
      [
        [false, "software/scripts/mac"],
        [false, "software/scripts/windows"],
      ],
      () => {
        const result = _filterFilesByOsGuard(["git.js", "vim-config.js", "advanced/vs-code.js", "terminator.js"]);
        expect(result).toEqual(["git.js", "vim-config.js", "advanced/vs-code.js", "terminator.js"]);
      },
    );
  });

  it("normalizes leading software/scripts/ prefix before matching", () => {
    withOsPaths([[false, "software/scripts/windows"]], () => {
      const result = _filterFilesByOsGuard(["software/scripts/windows/windows-terminal.js", "software/scripts/git.js"]);
      expect(result).toEqual(["software/scripts/git.js"]);
    });
  });

  it("returns the input unchanged when every OS flag is active", () => {
    withOsPaths(
      [
        [true, "software/scripts/mac"],
        [true, "software/scripts/windows"],
      ],
      () => {
        const input = ["mac/iterm.js", "windows/windows-terminal.js", "git.js"];
        expect(_filterFilesByOsGuard(input)).toEqual(input);
      },
    );
  });

  it("returns the input unchanged when OS_SCRIPT_PATHS is empty", () => {
    withOsPaths([], () => {
      const input = ["mac/iterm.js", "windows/windows-terminal.js"];
      expect(_filterFilesByOsGuard(input)).toEqual(input);
    });
  });
});

/** doWork tests for software/scripts/advanced/fuzzy-patterns.js. */
import { describe, it, expect } from "vitest";
import { fileSystem, runScript, getIndexConstant } from "../../setup.js";

const BASH_SYLE_PATH = getIndexConstant("BASH_SYLE_PATH");
const EDITOR_CONFIGS = getIndexConstant("EDITOR_CONFIGS");

describe("advanced/fuzzy-patterns.js doWork", () => {
  it("should register Fuzzy Filter Patterns profile block", async () => {
    fileSystem[BASH_SYLE_PATH] = "";
    await runScript("software/scripts/advanced/fuzzy-patterns.js");
    expect(fileSystem[BASH_SYLE_PATH]).toContain("Fuzzy Filter Patterns");
  });

  it("should emit _IGNORED_FOLDER_PATTERNS as a bash array with all entries", async () => {
    fileSystem[BASH_SYLE_PATH] = "";
    await runScript("software/scripts/advanced/fuzzy-patterns.js");
    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toMatch(/_IGNORED_FOLDER_PATTERNS=\(/);
    for (const p of EDITOR_CONFIGS.ignoredFoldersRegex) {
      expect(profile, `missing folder pattern: ${p}`).toContain(`"${p}"`);
    }
  });

  it("should emit _FUZZY_IGNORED_FOLDERS_JSON containing valid JSON matching EDITOR_CONFIGS", async () => {
    fileSystem[BASH_SYLE_PATH] = "";
    await runScript("software/scripts/advanced/fuzzy-patterns.js");
    const profile = fileSystem[BASH_SYLE_PATH];
    const m = profile.match(/_FUZZY_IGNORED_FOLDERS_JSON='([^']*)'/);
    expect(m, "_FUZZY_IGNORED_FOLDERS_JSON not found").not.toBeNull();
    expect(JSON.parse(m[1])).toEqual(EDITOR_CONFIGS.ignoredFoldersRegex);
  });

  it("should emit _FUZZY_IGNORED_FILES_JSON containing valid JSON matching EDITOR_CONFIGS", async () => {
    fileSystem[BASH_SYLE_PATH] = "";
    await runScript("software/scripts/advanced/fuzzy-patterns.js");
    const profile = fileSystem[BASH_SYLE_PATH];
    const m = profile.match(/_FUZZY_IGNORED_FILES_JSON='([^']*)'/);
    expect(m, "_FUZZY_IGNORED_FILES_JSON not found").not.toBeNull();
    expect(JSON.parse(m[1])).toEqual(EDITOR_CONFIGS.ignoredFilesRegex);
  });

  it("should emit _FUZZY_TEXT_FILES_JSON containing valid JSON matching EDITOR_CONFIGS", async () => {
    fileSystem[BASH_SYLE_PATH] = "";
    await runScript("software/scripts/advanced/fuzzy-patterns.js");
    const profile = fileSystem[BASH_SYLE_PATH];
    const m = profile.match(/_FUZZY_TEXT_FILES_JSON='([^']*)'/);
    expect(m, "_FUZZY_TEXT_FILES_JSON not found").not.toBeNull();
    expect(JSON.parse(m[1])).toEqual(EDITOR_CONFIGS.textFilesRegex);
  });
});

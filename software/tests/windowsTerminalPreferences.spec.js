/** Windows Terminal global window/tab preferences through serialized installer output. */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";
import { getIndexFunction, readSyThemeFixture } from "./setup.js";

/**
 * Run the existing installer against isolated settings IO without discovering a modern PowerShell installation.
 * @param {object} oldSettings Previously persisted settings.
 * @param {boolean} windows Whether to capture live Windows output instead of portable CI output.
 * @returns {Promise<object>} Serialized settings, as the consuming application would read them.
 */
async function generatePreferences(oldSettings, windows) {
  let output;
  const context = {
    IS_CI: true,
    is_os_windows: windows,
    BUILD_DIR: ".build",
    EDITOR_CONFIGS: {},
    path,
    log: () => {},
    getTheme: () => ({ dark: "Campbell", light: "Campbell" }),
    json: getIndexFunction("json"),
    readSyTheme: readSyThemeFixture,
    readJson: async (strings) => (strings[0].includes("windows-terminal-keys") ? [] : structuredClone(oldSettings)),
    getWindowUserBaseDir: () => "/mnt/c/Users/test",
    findPathFromList: () => null,
    findPath: () => "/mnt/c/Users/test/AppData/Local/Packages/Terminal",
    hasBinary: () => false,
    exitIfPathNotFound: () => {},
    backupConfigFile: async () => {},
    writeBuildArtifact: async ([entry]) => {
      output = JSON.parse(JSON.stringify(entry.data));
    },
    writeJson: async (_target, settings) => {
      output = JSON.parse(JSON.stringify(settings));
    },
  };
  vm.runInNewContext(fs.readFileSync("software/scripts/windows-terminal.js", "utf8"), context);
  await context.doWork();
  return output;
}

describe("Windows Terminal requested window/tab preferences", () => {
  it.each([true, false])("writes the requested defaults for Windows=%s", async (windows) => {
    const settings = await generatePreferences({}, windows);
    expect({ windowingBehavior: settings.windowingBehavior, tabSwitcherMode: settings.tabSwitcherMode, showTabsFullscreen: settings.showTabsFullscreen, newTabPosition: settings.newTabPosition }).toMatchInlineSnapshot(`
      {
        "newTabPosition": "afterCurrentTab",
        "showTabsFullscreen": true,
        "tabSwitcherMode": "inOrder",
        "windowingBehavior": "useAnyExisting",
      }
    `);
  });

  it("overrides old preferences without changing unrelated settings, including on repeated deployment", async () => {
    const settings = await generatePreferences(
      {
        windowingBehavior: "useNew",
        tabSwitcherMode: "disabled",
        showTabsFullscreen: false,
        newTabPosition: "afterLastTab",
        alwaysOnTop: true,
      },
      true,
    );
    expect({ windowingBehavior: settings.windowingBehavior, tabSwitcherMode: settings.tabSwitcherMode, showTabsFullscreen: settings.showTabsFullscreen, newTabPosition: settings.newTabPosition, alwaysOnTop: settings.alwaysOnTop }).toMatchInlineSnapshot(`
      {
        "alwaysOnTop": true,
        "newTabPosition": "afterCurrentTab",
        "showTabsFullscreen": true,
        "tabSwitcherMode": "inOrder",
        "windowingBehavior": "useAnyExisting",
      }
    `);
    expect(await generatePreferences(settings, true)).toEqual(settings);
  });
});

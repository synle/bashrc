import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

import { parseBuildXml, readBuildXml, warnIfBuildArtifactMissing } from "./buildConfigShape.helpers.js";

/** Selects stable Start menu settings without retaining local folder paths.
 * @param {object} document - Parsed XML document.
 * @returns {object} Stable settings and menu counts.
 */
function selectClassicStartSettings(document) {
  const settings = document.Settings;
  return {
    component: settings["@_component"],
    version: settings["@_version"],
    menuStyle: settings.MenuStyle["@_value"],
    shiftClick: settings.ShiftClick["@_value"],
    search: settings.Search["@_value"],
    enableStartButton: settings.EnableStartButton["@_value"],
    customTaskbar: settings.CustomTaskbar["@_value"],
    menuItems2Count: settings.MenuItems2.Line.length,
    menuItems7Count: settings.MenuItems7.Line.length,
  };
}

describe(".build/windows-classic-start-menu.xml", () => {
  it("parses the XML config into stable JSON settings", () => {
    const sourcePath = path.resolve("software/scripts/windows/classic_start.config.xml");
    const sourceConfig = parseBuildXml(fs.readFileSync(sourcePath, "utf-8"));
    const expected = selectClassicStartSettings(sourceConfig);
    expect(expected).toMatchInlineSnapshot(`
      {
        "component": "StartMenu",
        "customTaskbar": "1",
        "enableStartButton": "0",
        "menuItems2Count": 70,
        "menuItems7Count": 74,
        "menuStyle": "Win7",
        "search": "0",
        "shiftClick": "ClassicMenu",
        "version": "4.3.1",
      }
    `);

    const filename = "windows-classic-start-menu.xml";
    if (warnIfBuildArtifactMissing(filename)) return;

    expect(selectClassicStartSettings(readBuildXml(filename))).toEqual(expected);
  });
});

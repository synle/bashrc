import { describe, expect, it } from "vitest";

import { readBuildJson, warnIfBuildArtifactMissing } from "./buildConfigShape.helpers.js";

describe(".build/windows-terminal", () => {
  it("keeps generated tab and window defaults", () => {
    const filename = "windows-terminal";
    if (warnIfBuildArtifactMissing(filename)) return;

    const settings = readBuildJson(filename);
    expect({
      windowingBehavior: settings.windowingBehavior,
      tabSwitcherMode: settings.tabSwitcherMode,
      showTabsFullscreen: settings.showTabsFullscreen,
      newTabPosition: settings.newTabPosition,
    }).toMatchInlineSnapshot(`
      {
        "newTabPosition": "afterCurrentTab",
        "showTabsFullscreen": true,
        "tabSwitcherMode": "inOrder",
        "windowingBehavior": "useAnyExisting",
      }
    `);
  });
});

import { describe, expect, it } from "vitest";

import { readBuildJson, warnIfBuildArtifactMissing } from "./buildConfigShape.helpers.js";

describe(".build/sublime-merge", () => {
  it("keeps generated editor preferences", () => {
    const filename = "sublime-merge";
    if (warnIfBuildArtifactMissing(filename)) return;

    expect(readBuildJson(filename)).toMatchInlineSnapshot(`
      {
        "dark_theme": "Merge Dark.sublime-theme",
        "draw_white_space": "all",
        "expand_merge_commits_by_default": false,
        "font_face": "Courier New",
        "font_size": 16,
        "hardware_acceleration": "opengl",
        "hide_menu": false,
        "light_theme": "Merge.sublime-theme",
        "scroll_speed": 0,
        "side_bar_layout": "tabs",
        "tab_size": 2,
        "theme": "auto",
        "translate_tabs_to_spaces": false,
        "update_check": false,
      }
    `);
  });
});

describe(".build/sublime-merge-keys-mac", () => {
  it("keeps the macOS search shortcut and a bounded binding inventory", () => {
    const filename = "sublime-merge-keys-mac";
    if (warnIfBuildArtifactMissing(filename)) return;

    const bindings = readBuildJson(filename);
    expect(bindings.length).toBeGreaterThanOrEqual(6);
    expect(bindings.length).toBeLessThanOrEqual(20);
    expect(bindings.find(({ command }) => command === "show_search")).toMatchInlineSnapshot(`
      {
        "command": "show_search",
        "keys": [
          "super+f",
        ],
      }
    `);
  });
});

describe(".build/sublime-merge-keys-windows", () => {
  it("keeps the Windows search shortcut and a bounded binding inventory", () => {
    const filename = "sublime-merge-keys-windows";
    if (warnIfBuildArtifactMissing(filename)) return;

    const bindings = readBuildJson(filename);
    expect(bindings.length).toBeGreaterThanOrEqual(16);
    expect(bindings.length).toBeLessThanOrEqual(48);
    expect(bindings.find(({ command }) => command === "show_search")).toMatchInlineSnapshot(`
      {
        "command": "show_search",
        "keys": [
          "alt+f",
        ],
      }
    `);
  });
});

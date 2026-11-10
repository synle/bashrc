/** Verifies managed terminal shortcuts through rendered Ghostty config and parsed Windows Terminal JSONC. */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import { parse } from "jsonc-parser";
import { fileSystem, getIndexFunction, loadScriptHelpers } from "./setup.js";

beforeAll(() => loadScriptHelpers("software/scripts/advanced/ghostty.js"));
beforeEach(() => {
  fileSystem["software/scripts/advanced/ghostty-keys.common.jsonc"] = fs.readFileSync(
    "software/scripts/advanced/ghostty-keys.common.jsonc",
    "utf8",
  );
});

describe.each([
  { platform: "macOS", isMac: true, modifier: "cmd" },
  { platform: "Linux", isMac: false, modifier: "alt" },
])("Ghostty $platform shortcuts", ({ isMac, modifier }) => {
  it.each([
    ["c", "copy_to_clipboard:mixed"],
    ["v", "paste_from_clipboard"],
    ["a", "select_all"],
    ["t", "new_tab"],
    ["n", "new_window"],
    ["1", "goto_tab:1"],
    ["2", "goto_tab:2"],
    ["3", "goto_tab:3"],
    ["4", "goto_tab:4"],
    ["5", "goto_tab:5"],
    ["6", "goto_tab:6"],
    ["7", "goto_tab:7"],
    ["8", "goto_tab:8"],
    ["9", "goto_tab:9"],
    ["shift+[", "previous_tab"],
    ["shift+]", "next_tab"],
    ["q", "close_window"],
    ["d", "new_split:right"],
    ["'", "new_split:down"],
    ["up", "goto_split:up"],
    ["down", "goto_split:down"],
    ["left", "goto_split:left"],
    ["right", "goto_split:right"],
    ["[", "goto_split:previous"],
    ["]", "goto_split:next"],
    ["shift+up", "resize_split:up,10"],
    ["shift+down", "resize_split:down,10"],
    ["shift+left", "resize_split:left,10"],
    ["shift+right", "resize_split:right,10"],
    ["equal", "increase_font_size:1"],
    ["+", "increase_font_size:1"],
    ["minus", "decrease_font_size:1"],
    ["0", "reset_font_size"],
    ["f", "start_search"],
    ["g", "navigate_search:next"],
    ["shift+g", "navigate_search:previous"],
    ["e", "search_selection"],
    ["home", "scroll_to_top"],
    ["end", "scroll_to_bottom"],
    ["ctrl+up", "jump_to_prompt:-1"],
    ["ctrl+down", "jump_to_prompt:1"],
    ["enter", "unbind"],
    ["shift+enter", "unbind"],
    ["shift+\\", "toggle_split_zoom"],
  ])("renders %s as %s without relying on platform defaults", async (key, action) => {
    const config = await getIndexFunction("_buildConfigContent")(isMac, { is_prebuilt_config: true });
    expect(config.split("\n")).toContain(`keybind = ${modifier}+${key}=${action}`);
  });

  it.each([
    ["shift+up", "scroll_page_up"],
    ["shift+down", "scroll_page_down"],
    ["ctrl+shift+up", "scroll_page_up"],
    ["ctrl+shift+down", "scroll_page_down"],
    ["f11", "toggle_fullscreen"],
    ["f2", "prompt_tab_title"],
  ])("renders literal %s as %s", async (key, action) => {
    const config = await getIndexFunction("_buildConfigContent")(isMac, { is_prebuilt_config: true });
    expect(config.split("\n")).toContain(`keybind = ${key}=${action}`);
  });

  it.each([false, true])("closes only the focused surface before its tab or window (prebuilt: %s)", async (isPrebuilt) => {
    const config = await getIndexFunction("_buildConfigContent")(isMac, { is_prebuilt_config: isPrebuilt });
    const actions = config
      .split("\n")
      .filter((line) => line.startsWith(`keybind = ${modifier}+w=`))
      .map((line) => line.split("=")[2]);
    expect(actions).toMatchInlineSnapshot(`
      [
        "close_surface",
      ]
    `);
  });

  it.each([false, true])("starts new windows outside fullscreen (prebuilt: %s)", async (isPrebuilt) => {
    const config = await getIndexFunction("_buildConfigContent")(isMac, { is_prebuilt_config: isPrebuilt });
    expect(config.split("\n").filter((line) => /^fullscreen\s*=/.test(line.trim()))).toMatchInlineSnapshot(`
      [
        "fullscreen = false",
      ]
    `);
  });

  it("keeps quick terminal global with the platform modifier", async () => {
    const config = await getIndexFunction("_buildConfigContent")(isMac, { is_prebuilt_config: true });
    expect(config.split("\n")).toContain(`keybind = global:${modifier}+escape=toggle_quick_terminal`);
  });

  it("resolves every modifier and emits no duplicate managed trigger", async () => {
    const bindings = await getIndexFunction("_getKeyBindings")(isMac);
    const triggers = bindings.map((binding) => binding.keys[0]);
    expect(triggers.filter((trigger, index) => triggers.indexOf(trigger) !== index)).toEqual([]);
    expect(triggers.some((trigger) => trigger.includes("OS_KEY"))).toBe(false);
  });
});

describe("Windows Terminal scroll and resize separation", () => {
  it.each([
    ["shift+up", "scrollUpPage"],
    ["shift+down", "scrollDownPage"],
    ["ctrl+shift+up", "scrollUpPage"],
    ["ctrl+shift+down", "scrollDownPage"],
    ["alt+shift+up", { action: "resizePane", direction: "up" }],
    ["alt+shift+down", { action: "resizePane", direction: "down" }],
    ["alt+shift+left", { action: "resizePane", direction: "left" }],
    ["alt+shift+right", { action: "resizePane", direction: "right" }],
    ["alt+up", { action: "moveFocus", direction: "up" }],
    ["alt+down", { action: "moveFocus", direction: "down" }],
    ["shift+enter", { action: "sendInput", input: "\u001b[13;2u" }],
  ])("maps %s without changing pane navigation or Shift+Enter", (key, command) => {
    const errors = [];
    const bindings = parse(fs.readFileSync("software/scripts/windows-terminal-keys.jsonc", "utf8"), errors, { allowTrailingComma: true });
    expect(errors).toEqual([]);
    expect(bindings.filter((binding) => binding.keys === key).map((binding) => binding.command)).toEqual([command]);
  });
});

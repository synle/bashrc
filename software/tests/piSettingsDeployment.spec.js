/** Verifies Pi setup persists managed settings and keybindings without losing user preferences. */
import { readFileSync } from "fs";
import { beforeEach, describe, expect, it } from "vitest";
import { fileSystem, getIndexFunction, loadScriptHelpers, mockFsExistence, setSandboxGlobal } from "./setup.js";

/** User settings destination in the isolated setup sandbox. */
const SETTINGS_PATH = "/mock/home/.pi/agent/settings.json";
/** User keybinding destination in the isolated setup sandbox. */
const KEYBINDINGS_PATH = "/mock/home/.pi/agent/keybindings.json";
/** Checked-in keymap source consumed by the real deployment writer. */
const KEYMAP_SOURCE = "software/scripts/advanced/llm/pi/pi-keys.common.jsonc";
/** Unrelated deployment boundaries excluded from settings and keybinding regressions. */
const OTHER_DEPLOYMENTS = [
  "deploySharedMcpServers",
  "deploySharedLLMInstructions",
  "deploySharedLLMSkills",
  "deploySharedLLMAgents",
  "_doPiModelsWork",
  "_doPiInstructionsWork",
  "_doPiAppendSystemWork",
  "_doPiPersonaExtensionWork",
  "_doPiToolOutputExtensionWork",
];

beforeEach(() => {
  loadScriptHelpers("software/scripts/advanced/llm/pi/setup.js");
  for (const name of OTHER_DEPLOYMENTS) setSandboxGlobal(name, async () => {});
  setSandboxGlobal("isBinaryFound", async () => true);
  setSandboxGlobal("getOllamaProviderInputs", async () => []);
  // Keep optional theme deployment outside these settings and keybinding regressions.
  setSandboxGlobal("_doPiThemeWork", async (_agentDir, selected) => selected);
  setSandboxGlobal("is_os_mac", false);
  setSandboxGlobal("is_os_wsl", false);
  fileSystem[KEYMAP_SOURCE] = readFileSync(KEYMAP_SOURCE, "utf8");
});

describe("Pi settings and keybinding deployment", () => {
  it("enables the hardware cursor on fresh setup without pinning a theme", async () => {
    await getIndexFunction("doWork")();

    const settings = JSON.parse(fileSystem[SETTINGS_PATH]);
    expect(settings.showHardwareCursor).toBe(true);
    expect(settings).not.toHaveProperty("theme");
  });

  it("preserves an explicit hardware-cursor opt-out and unrelated preferences", async () => {
    fileSystem[SETTINGS_PATH] = JSON.stringify({ showHardwareCursor: false, quietStartup: false, customSetting: "kept" });

    await getIndexFunction("doWork")();

    const settings = JSON.parse(fileSystem[SETTINGS_PATH]);
    expect({ showHardwareCursor: settings.showHardwareCursor, quietStartup: settings.quietStartup, customSetting: settings.customSetting }).toMatchInlineSnapshot(`
      {
        "customSetting": "kept",
        "quietStartup": false,
        "showHardwareCursor": false,
      }
    `);
  });

  it("resets the redundant system theme pair to the native system theme", async () => {
    fileSystem[SETTINGS_PATH] = JSON.stringify({ theme: "system/system" });

    await getIndexFunction("doWork")();

    expect(JSON.parse(fileSystem[SETTINGS_PATH]).theme).toBe("system");
  });

  it.each(["dark", "light/dark", "system"])("preserves the explicit theme %s", async (theme) => {
    fileSystem[SETTINGS_PATH] = JSON.stringify({ theme });

    await getIndexFunction("doWork")();

    expect(JSON.parse(fileSystem[SETTINGS_PATH]).theme).toBe(theme);
  });

  it("deploys word-deletion and transcript-navigation chords through normal setup", async () => {
    await getIndexFunction("doWork")();

    expect(fileSystem[KEYBINDINGS_PATH]).toBeDefined();
    expect(JSON.parse(fileSystem[KEYBINDINGS_PATH])).toMatchInlineSnapshot();
  });

  it("updates managed chords while preserving unrelated user bindings", async () => {
    mockFsExistence[KEYBINDINGS_PATH] = true;
    fileSystem[KEYBINDINGS_PATH] = JSON.stringify({
      "tui.editor.deleteWordBackward": ["alt+w"],
      "tui.altScreen.top": "alt+home",
      "tui.altScreen.bottom": "alt+end",
      "app.session.new": "ctrl+shift+n",
    });

    await getIndexFunction("doWork")();

    expect(JSON.parse(fileSystem[KEYBINDINGS_PATH])).toMatchInlineSnapshot();
  });

  it("keeps settings and keybindings byte-stable on a second setup", async () => {
    fileSystem[SETTINGS_PATH] = JSON.stringify({ theme: "system/system", showHardwareCursor: false });
    await getIndexFunction("doWork")();
    const settings = fileSystem[SETTINGS_PATH];
    const keybindings = fileSystem[KEYBINDINGS_PATH];

    await getIndexFunction("doWork")();

    expect(fileSystem[SETTINGS_PATH]).toBe(settings);
    expect(fileSystem[KEYBINDINGS_PATH]).toBe(keybindings);
  });

  it("leaves existing configuration unchanged when Pi is not installed", async () => {
    setSandboxGlobal("isBinaryFound", async () => false);
    fileSystem[SETTINGS_PATH] = '{"theme":"system/system"}';
    fileSystem[KEYBINDINGS_PATH] = '{"app.session.new":"ctrl+shift+n"}';

    await getIndexFunction("doWork")();

    expect(fileSystem[SETTINGS_PATH]).toBe('{"theme":"system/system"}');
    expect(fileSystem[KEYBINDINGS_PATH]).toBe('{"app.session.new":"ctrl+shift+n"}');
  });
});

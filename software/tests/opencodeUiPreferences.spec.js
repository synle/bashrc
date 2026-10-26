/** Verifies explicit OpenCode startup preferences without writing a running session's state file. */
import vm from "vm";
import { beforeAll, describe, expect, it } from "vitest";
import { fileSystem, getIndexFunction, loadScriptHelpers } from "./setup.js";

/** Fixture configuration home with spaces to exercise local plugin paths. */
const HOME = "/mock/home with spaces";
/** Native TUI config written by the deployment seam. */
const TUI_PATH = `${HOME}/.config/opencode/tui.json`;
/** Generated local plugin loaded by the native TUI. */
const PLUGIN_PATH = `${HOME}/.config/opencode/sy-ui-preferences.mjs`;

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/opencode/setup.js");
});

/**
 * Executes the deployed plugin module using the verified default-object export contract.
 * @returns {{ id: string, tui: (api: object) => Promise<void> }} Generated plugin module.
 */
function deployedPlugin() {
  const context = {};
  vm.runInNewContext(fileSystem[PLUGIN_PATH].replace("export default", "var plugin ="), context);
  return context.plugin;
}

/**
 * Provides the native KV and command seams with independently captured app signals.
 * @param {Record<string, unknown>} initial - Saved state before TUI startup.
 * @returns {{ api: object, saved: object, signals: object, commands: string[] }} Observable startup state.
 */
function startup(initial = {}) {
  const saved = { ...initial };
  const signals = {
    pasteSummary: saved.paste_summary_enabled ?? true,
    terminalTitle: saved.terminal_title_enabled ?? true,
  };
  const commands = [];
  const handlers = {
    "app.toggle.paste_summary": () => {
      signals.pasteSummary = !signals.pasteSummary;
      saved.paste_summary_enabled = signals.pasteSummary;
    },
    "terminal.title.toggle": () => {
      signals.terminalTitle = !signals.terminalTitle;
      saved.terminal_title_enabled = signals.terminalTitle;
    },
  };
  return {
    saved,
    signals,
    commands,
    api: {
      kv: {
        get: (key, fallback) => saved[key] ?? fallback,
        set: (key, value) => {
          saved[key] = value;
        },
      },
      keymap: {
        dispatchCommand: (name) => {
          commands.push(name);
          handlers[name]();
        },
      },
    },
  };
}

describe("OpenCode explicit UI preferences", () => {
  it("registers a local TUI plugin without replacing unrelated plugins", async () => {
    fileSystem[TUI_PATH] = JSON.stringify({ plugin: ["foreign-plugin", ["other-plugin", { enabled: false }]], userPreference: 0 });
    await getIndexFunction("_writeOpencodeTuiConfig")(HOME, false);
    const config = JSON.parse(fileSystem[TUI_PATH]);
    expect({ plugin: config.plugin, userPreference: config.userPreference }).toMatchInlineSnapshot(`
      {
        "plugin": [
          "foreign-plugin",
          [
            "other-plugin",
            {
              "enabled": false,
            },
          ],
          "/mock/home with spaces/.config/opencode/sy-ui-preferences.mjs",
        ],
        "userPreference": 0,
      }
    `);
  });

  it("persists all seven requested values on a fresh startup", async () => {
    await getIndexFunction("_writeOpencodeTuiConfig")(HOME, false);
    const state = startup();
    await deployedPlugin().tui(state.api);
    expect(state.saved).toMatchInlineSnapshot();
    expect(state.commands).toEqual([]);
  });

  it("updates app-local signals as well as saved state when toggles were disabled", async () => {
    await getIndexFunction("_writeOpencodeTuiConfig")(HOME, false);
    const state = startup({ paste_summary_enabled: false, terminal_title_enabled: false });
    await deployedPlugin().tui(state.api);
    expect(state.signals).toEqual({ pasteSummary: true, terminalTitle: true });
    expect(state.commands).toEqual(["app.toggle.paste_summary", "terminal.title.toggle"]);
  });

  it("preserves unrequested preferences while replacing contrary managed values", async () => {
    await getIndexFunction("_writeOpencodeTuiConfig")(HOME, false);
    const state = startup({
      diff_wrap_mode: "none",
      scrollbar_visible: false,
      timestamps: "hide",
      sidebar: "auto",
      tool_details_visibility: false,
      animations_enabled: false,
      thinking_mode: "hide",
      theme: "foreign",
      customPreference: 0,
    });
    await deployedPlugin().tui(state.api);
    expect(state.saved).toMatchInlineSnapshot();
  });

  it("stays byte-stable and avoids duplicate registrations on repeat deployment", async () => {
    await getIndexFunction("_writeOpencodeTuiConfig")(HOME, false);
    const config = fileSystem[TUI_PATH];
    const plugin = fileSystem[PLUGIN_PATH];
    await getIndexFunction("_writeOpencodeTuiConfig")(HOME, false);
    expect(fileSystem[TUI_PATH]).toBe(config);
    expect(fileSystem[PLUGIN_PATH]).toBe(plugin);
    expect(JSON.parse(fileSystem[TUI_PATH]).plugin).toEqual([PLUGIN_PATH]);
  });

  it("does not toggle enabled features off on repeated startup", async () => {
    await getIndexFunction("_writeOpencodeTuiConfig")(HOME, false);
    const state = startup({ paste_summary_enabled: true, terminal_title_enabled: true });
    const plugin = deployedPlugin();
    await plugin.tui(state.api);
    const saved = { ...state.saved };
    await plugin.tui(state.api);
    expect(state.saved).toEqual(saved);
    expect(state.commands).toEqual([]);
  });

  it("does not write the session-owned KV file during deployment", async () => {
    const kvPath = `${HOME}/.local/state/opencode/kv.json`;
    const existing = '{"sidebar":"auto","customPreference":false}';
    fileSystem[kvPath] = existing;
    await getIndexFunction("_writeOpencodeTuiConfig")(HOME, false);
    expect(fileSystem[kvPath]).toBe(existing);
    expect(fileSystem).not.toHaveProperty(`${kvPath}.bak_original`);
  });

  it.each([null, false, "foreign-plugin", {}])("rejects malformed plugin list %j before any writes", async (plugin) => {
    const existing = JSON.stringify({ plugin });
    fileSystem[TUI_PATH] = existing;
    await expect(getIndexFunction("_writeOpencodeTuiConfig")(HOME, false)).rejects.toThrow("OpenCode TUI plugin must be an array");
    expect(fileSystem).toEqual({ [TUI_PATH]: existing });
  });
});

/** Verifies native keymap writers deploy transcript navigation without stealing prompt-editing chords. */
import { readFileSync } from "fs";
import { beforeEach, describe, expect, it } from "vitest";
import { fileSystem, getIndexFunction, loadScriptHelpers, setSandboxGlobal } from "./setup.js";

/** Isolated configuration home containing spaces to exercise native deployment paths. */
const HOME = "/mock/home with spaces";
/** Real checked-in keymaps parsed by the production deployment writers. */
const KEYMAPS = [
  "software/scripts/advanced/llm/claude/claude-keys.common.jsonc",
  "software/scripts/advanced/llm/claude/claude-keys.windows.jsonc",
  "software/scripts/advanced/llm/gemini/gemini-keys.common.jsonc",
  "software/scripts/advanced/llm/gemini/gemini-keys.windows.jsonc",
  "software/scripts/advanced/llm/opencode/opencode-keys.common.jsonc",
  "software/scripts/advanced/llm/opencode/opencode-keys.windows.jsonc",
];

beforeEach(() => {
  loadScriptHelpers("software/scripts/advanced/llm/claude/setup.js");
  loadScriptHelpers("software/scripts/advanced/llm/gemini/setup.js");
  loadScriptHelpers("software/scripts/advanced/llm/opencode/setup.js");
  for (const source of KEYMAPS) fileSystem[source] = readFileSync(source, "utf8");
});

describe("AI CLI transcript navigation deployment", () => {
  it.each([true, false])("deploys Claude Scroll actions and preserves other contexts with is_os_mac=%s", async (isMac) => {
    setSandboxGlobal("is_os_mac", isMac);
    const target = `${HOME}/.claude/keybindings.json`;
    fileSystem[target] = JSON.stringify({
      bindings: [
        { context: "Scroll", bindings: { "ctrl+home": "scroll:bottom", "ctrl+end": "scroll:top", "alt+up": "scroll:lineUp" } },
        { context: "Chat", bindings: { "alt+q": "chat:submit" } },
      ],
    });

    await getIndexFunction("_doKeysWork")(`${HOME}/.claude`);

    const config = JSON.parse(fileSystem[target]);
    expect(config.bindings.find((group) => group.context === "Scroll").bindings).toEqual({
      "ctrl+home": "scroll:top",
      "ctrl+end": "scroll:bottom",
      "alt+up": "scroll:lineUp",
    });
    expect(config.bindings.find((group) => group.context === "Chat").bindings).toMatchObject({
      "alt+q": "chat:submit",
      home: null,
      end: null,
    });
    const first = fileSystem[target];
    await getIndexFunction("_doKeysWork")(`${HOME}/.claude`);
    expect(fileSystem[target]).toBe(first);
  });

  it.each([true, false])("deploys Gemini scroll actions without changing line navigation with is_os_mac=%s", async (isMac) => {
    setSandboxGlobal("is_os_mac", isMac);
    const target = `${HOME}/.gemini/keybindings.json`;
    fileSystem[target] = JSON.stringify([{ command: "scroll.pageUp", key: "alt+up" }]);

    await getIndexFunction("_doGeminiKeysWork")(`${HOME}/.gemini`);

    const config = JSON.parse(fileSystem[target]);
    expect(config.filter((entry) => ["ctrl+home", "ctrl+end"].includes(entry.key))).toEqual([
      { command: "scroll.home", key: "ctrl+home" },
      { command: "scroll.end", key: "ctrl+end" },
    ]);
    expect(config).toContainEqual({ command: "cursor.home", key: "home" });
    expect(config).toContainEqual({ command: "cursor.end", key: "end" });
    expect(config).toContainEqual({ command: "scroll.pageUp", key: "alt+up" });
    const first = fileSystem[target];
    await getIndexFunction("_doGeminiKeysWork")(`${HOME}/.gemini`);
    expect(fileSystem[target]).toBe(first);
  });

  it.each([
    { isWindows: false, inputHome: "super+home", inputEnd: "super+end" },
    { isWindows: true, inputHome: "alt+home", inputEnd: "alt+end" },
  ])("deploys exclusive OpenCode transcript chords with isWindows=$isWindows", async ({ isWindows, inputHome, inputEnd }) => {
    const target = `${HOME}/.config/opencode/tui.json`;
    fileSystem[target] = JSON.stringify({ keybinds: { input_buffer_home: "ctrl+home", input_buffer_end: "ctrl+end", model_list: "f4" } });

    await getIndexFunction("_writeOpencodeTuiConfig")(HOME, isWindows);

    const config = JSON.parse(fileSystem[target]);
    expect(config.keybinds).toMatchObject({
      messages_first: "ctrl+home,ctrl+alt+shift+g",
      messages_last: "ctrl+end,ctrl+alt+g",
      input_buffer_home: inputHome,
      input_buffer_end: inputEnd,
      input_line_home: "ctrl+a,home",
      input_line_end: "ctrl+e,end",
      model_list: "f4",
    });
    const chords = Object.values(config.keybinds).flatMap((value) => value.split(","));
    expect(chords.filter((key) => key === "ctrl+home")).toEqual(["ctrl+home"]);
    expect(chords.filter((key) => key === "ctrl+end")).toEqual(["ctrl+end"]);
    const first = fileSystem[target];
    await getIndexFunction("_writeOpencodeTuiConfig")(HOME, isWindows);
    expect(fileSystem[target]).toBe(first);
  });
});

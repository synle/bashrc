/** Exercises persisted Vim theme configuration and generated colors through the real Vim consumer. */
import { beforeAll, beforeEach, describe, expect, it, onTestFinished } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import {
  fileSystem,
  getIndexConstant,
  getIndexFunction,
  loadScriptHelpers,
  mockFsExistence,
  runScript,
  setSandboxGlobal,
} from "./setup.js";

/** @type {string} Real settings file, sourced without the network-enabled plugin bootstrap. */
const settingsPath = path.resolve("software/scripts/vim-config-settings.vim");
/** @type {string} Sandbox user's native configuration folder. */
const home = getIndexConstant("BASE_HOMEDIR_LINUX");

beforeAll(() => {
  loadScriptHelpers("software/scripts/vim-config.js");
});

beforeEach(() => {
  setSandboxGlobal("is_gui", true);
  setSandboxGlobal("is_os_windows", false);
  setSandboxGlobal("IS_CI", false);
  setSandboxGlobal("getRuntimeOption", () => false);
  fileSystem["software/scripts/vim-color-dark.jsonc"] = fs.readFileSync("software/scripts/vim-color-dark.jsonc", "utf-8");
  fileSystem["software/scripts/vim-color-light.jsonc"] = fs.readFileSync("software/scripts/vim-color-light.jsonc", "utf-8");
  fileSystem["software/scripts/vim-config-settings.vim"] = fs.readFileSync(settingsPath, "utf-8");
});

/**
 * Loads generated themes and selection in isolated Vim, then observes native highlight resolution.
 * @param {string} selection - Generated family-selection Vimscript.
 * @param {string} appearance - Initial native background setting.
 * @param {string[]} commands - Commands dispatched by a zero-delay timer after startup, when OptionSet events are enabled.
 * @param {object} extraSchemes - Optional owned fixture colorschemes, not third-party API mocks.
 * @returns {Promise<object>} Persisted observations; process errors and assertion failures surface directly.
 */
async function probeTheme(selection, appearance, commands = [], extraSchemes = {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "vim theme's "));
  onTestFinished(() => fs.rmSync(folder, { recursive: true, force: true }));
  const colorsFolder = path.join(folder, "colors");
  const output = path.join(folder, "result.json");
  const script = path.join(folder, "probe.vim");
  fs.mkdirSync(colorsFolder);
  fs.writeFileSync(path.join(colorsFolder, "sy-dark.vim"), await getIndexFunction("_buildVimTheme")("dark"));
  fs.writeFileSync(path.join(colorsFolder, "sy-light.vim"), await getIndexFunction("_buildVimTheme")("light"));
  for (const [name, content] of Object.entries(extraSchemes)) fs.writeFileSync(path.join(colorsFolder, `${name}.vim`), content);
  fs.writeFileSync(
    script,
    [
      `let &runtimepath = ${JSON.stringify(folder)} . ',' . &runtimepath`,
      `set background=${appearance}`,
      `execute 'source ' . fnameescape(${JSON.stringify(settingsPath)})`,
      selection,
      "function! RunThemeProbe(timer) abort",
      ...commands,
      "let g:result = {'scheme': g:colors_name, 'background': &background, 'ayu': get(g:, 'ayucolor', ''), 'foreground': synIDattr(synIDtrans(hlID('Normal')), 'fg', 'gui'), 'tag': synIDattr(synIDtrans(hlID('tsxTagName')), 'fg', 'gui'), 'mode': get(get(g:, 'sy_lightline_palette', {}), 'insert', {})}",
      `call writefile([json_encode(g:result)], ${JSON.stringify(output)})`,
      "qall!",
      "endfunction",
      // OptionSet is suppressed during startup, including VimEnter handlers; dispatch from the main loop instead.
      "autocmd VimEnter * call timer_start(0, function('RunThemeProbe'))",
    ].join("\n"),
  );
  const result = spawnSync("vim", ["-N", "-u", "NONE", "-i", "NONE", "-n", "--not-a-term", "-S", script], {
    env: { ...process.env, HOME: folder },
    encoding: "utf-8",
    timeout: 5000,
  });
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(fs.readFileSync(output, "utf-8"));
}

describe("Vim shared theme deployment", () => {
  it.each([true, false])("always declares Ayu when custom selection is %s", async (custom) => {
    setSandboxGlobal("getRuntimeOption", () => !custom);

    await runScript("software/scripts/vim-config.js");

    expect(fileSystem[`${home}/.vimrc`]).toContain("Jetpack 'ayu-theme/ayu-vim'");
    expect(fileSystem[`${home}/.vimrc`]).toContain(`let s:use_custom_theme = ${custom ? 1 : 0}`);
    expect(fileSystem[`${home}/.vimrc`]).not.toMatch(/codedark|vim-code-dark/);
  });

  it("deploys both native Sy scheme files", async () => {
    await runScript("software/scripts/vim-config.js");

    expect(fileSystem[`${home}/.vim/colors/sy-dark.vim`]).toContain("highlight Normal guifg=#e8e8e8 guibg=#0a0a0a");
    expect(fileSystem[`${home}/.vim/colors/sy-light.vim`]).toContain("highlight Normal guifg=#1e1e1e guibg=#f8f8f8");
  });

  it("does not write Sy files when the existing opt-out is enabled", async () => {
    setSandboxGlobal("getRuntimeOption", () => true);

    await runScript("software/scripts/vim-config.js");

    expect(fileSystem).not.toHaveProperty(`${home}/.vim/colors/sy-dark.vim`);
    expect(fileSystem).not.toHaveProperty(`${home}/.vim/colors/sy-light.vim`);
    expect(fileSystem[`${home}/.vimrc`]).toContain("'dark': \"ayu\", 'light': \"ayu\"");
  });

  it("writes the complete plugin and theme configuration to an existing Windows target", async () => {
    setSandboxGlobal("is_os_windows", true);
    setSandboxGlobal("getWindowUserBaseDir", () => "/mock/windows home");
    mockFsExistence["/mock/windows home/.vimrc"] = true;

    await runScript("software/scripts/vim-config.js");

    expect(fileSystem["/mock/windows home/.vimrc"]).toBe(fileSystem[`${home}/.vimrc`]);
    expect(fileSystem["/mock/windows home/vimfiles/colors/sy-light.vim"]).toContain("let g:colors_name = 'sy-light'");
  });

  it.each(["{}", "null", "[]", '{"foreground":"not-a-color"}'])(
    "rejects invalid light palettes before writing either theme: %s",
    async (source) => {
      fileSystem["software/scripts/vim-color-light.jsonc"] = source;

      await expect(getIndexFunction("_doVimTheme")([`${home}/.vim`])).rejects.toThrow("Invalid Vim light palette");

      expect(fileSystem).not.toHaveProperty(`${home}/.vim/colors/sy-dark.vim`);
      expect(fileSystem).not.toHaveProperty(`${home}/.vim/colors/sy-light.vim`);
    },
  );

  it("rejects unknown theme appearances", async () => {
    await expect(getIndexFunction("_buildVimTheme")("mirage")).rejects.toThrow("Vim theme mode must be dark or light");
  });
});

describe("Vim native theme consumer", () => {
  it.each([
    ["dark", "sy-dark", "#e8e8e8", "#5ca0d7", [["#0a0a0a", "#5ca0d7"]]],
    ["light", "sy-light", "#1e1e1e", "#9b2c2c", [["#f8f8f8", "#0252ad"]]],
  ])("loads %s palette, semantic TSX links, and matching Lightline data", async (appearance, scheme, foreground, tag, mode) => {
    const selection = await getIndexFunction("_doVimTheme")([]);
    const result = await probeTheme(selection, appearance);

    expect(result).toMatchObject({ scheme, background: appearance, foreground, tag, mode: { left: mode } });
  });

  it("switches dark to light after startup through the background option", async () => {
    const selection = await getIndexFunction("_doVimTheme")([]);
    const result = await probeTheme(selection, "dark", ["set background=light"]);

    expect(result).toMatchObject({ scheme: "sy-light", background: "light", foreground: "#1e1e1e", tag: "#9b2c2c" });
  });

  it("switches light to dark after startup through the background option", async () => {
    const selection = await getIndexFunction("_doVimTheme")([]);
    const result = await probeTheme(selection, "light", ["set background=dark"]);

    expect(result).toMatchObject({ scheme: "sy-dark", background: "dark", foreground: "#e8e8e8", tag: "#5ca0d7" });
  });

  it("routes disabled custom themes through the registry fallback without loading Sy colors", async () => {
    setSandboxGlobal("getRuntimeOption", () => true);
    const registry = getIndexConstant("APP_TO_THEMES_MAP");
    const original = registry.vim;
    registry.vim = ["owned-fixture"];
    try {
      const selection = await getIndexFunction("_doVimTheme")([]);
      const result = await probeTheme(selection, "light", [], {
        "owned-fixture": "let g:colors_name = 'owned-fixture'\nhighlight Normal guifg=#123456 guibg=#ffffff\n",
      });
      expect(result).toMatchObject({ scheme: "owned-fixture", background: "light", ayu: "light", foreground: "#123456" });
    } finally {
      registry.vim = original;
    }
  });
});

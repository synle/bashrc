/** Exercises persisted Vim theme configuration and generated colors through the real Vim consumer. */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { hasColorResponsePlugin, probeTheme } from "./vimThemes.helpers.js";
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

beforeAll(() => loadScriptHelpers("software/scripts/vim-config.js"));

beforeEach(() => {
  setSandboxGlobal("is_gui", true);
  setSandboxGlobal("is_os_windows", false);
  setSandboxGlobal("IS_CI", false);
  setSandboxGlobal("getRuntimeOption", () => false);
  fileSystem["theme/sy/vim_dark.jsonc"] = fs.readFileSync("theme/sy/vim_dark.jsonc", "utf-8");
  fileSystem["theme/sy/vim_light.jsonc"] = fs.readFileSync("theme/sy/vim_light.jsonc", "utf-8");
  fileSystem["software/scripts/vim-config-settings.vim"] = fs.readFileSync(settingsPath, "utf-8");
});

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
      fileSystem["theme/sy/vim_light.jsonc"] = source;

      await expect(getIndexFunction("_doVimTheme")([`${home}/.vim`])).rejects.toThrow(/Invalid (Sy vim\/light source|Vim light theme)/);

      expect(fileSystem).not.toHaveProperty(`${home}/.vim/colors/sy-dark.vim`);
      expect(fileSystem).not.toHaveProperty(`${home}/.vim/colors/sy-light.vim`);
    },
  );

  it("rejects unknown theme appearances", async () => {
    await expect(getIndexFunction("_buildVimTheme")("mirage")).rejects.toThrow("Invalid Sy theme selector");
  });
});

describe("Vim native theme consumer", () => {
  it("loads both palettes, semantic TSX links, and matching Lightline data", async () => {
    const selection = await getIndexFunction("_doVimTheme")([]);
    const results = await Promise.all(["dark", "light"].map(async (appearance) => {
      const { scheme, background, foreground, tag, mode } = await probeTheme(selection, appearance);
      return { scheme, background, foreground, tag, mode: { left: mode.left } };
    }));
    expect(results).toMatchInlineSnapshot(`
      [
        {
          "background": "dark",
          "foreground": "#e8e8e8",
          "mode": {
            "left": [
              [
                "#0a0a0a",
                "#5ca0d7",
              ],
            ],
          },
          "scheme": "sy-dark",
          "tag": "#5ca0d7",
        },
        {
          "background": "light",
          "foreground": "#1e1e1e",
          "mode": {
            "left": [
              [
                "#f8f8f8",
                "#0252ad",
              ],
            ],
          },
          "scheme": "sy-light",
          "tag": "#9b2c2c",
        },
      ]
    `);
  });

  it("switches dark to light after startup through the background option", async () => {
    const selection = await getIndexFunction("_doVimTheme")([]);
    const result = await probeTheme(selection, "dark", ["set background=light"]);

    expect({ scheme: result.scheme, background: result.background, foreground: result.foreground, tag: result.tag }).toMatchInlineSnapshot(`
      {
        "background": "light",
        "foreground": "#1e1e1e",
        "scheme": "sy-light",
        "tag": "#9b2c2c",
      }
    `);
  });

  it("switches light to dark after startup through the background option", async () => {
    const selection = await getIndexFunction("_doVimTheme")([]);
    const result = await probeTheme(selection, "light", ["set background=dark"]);

    expect({ scheme: result.scheme, background: result.background, foreground: result.foreground, tag: result.tag }).toMatchInlineSnapshot(`
      {
        "background": "dark",
        "foreground": "#e8e8e8",
        "scheme": "sy-dark",
        "tag": "#5ca0d7",
      }
    `);
  });

  it.skipIf(!hasColorResponsePlugin)("selects matching palettes after late terminal replies from either appearance", async () => {
    const selection = await getIndexFunction("_doVimTheme")([]);
    const results = await Promise.all([
      ["dark", "ffff/ffff/ffff"],
      ["light", "0000/0000/0000"],
      ["dark", "0000/0000/0000"],
      ["light", "ffff/ffff/ffff"],
    ].map(async ([initial, rgb]) => {
      const { scheme, background, foreground, tag } = await probeTheme(selection, initial, [
        "set term=xterm",
        "runtime plugin/colorresp.vim",
        `call test_feedinput("\\e]11;rgb:${rgb}\\x07")`,
        "call getchar(0)",
      ]);
      return { initial, rgb, scheme, background, foreground, tag };
    }));
    expect(results).toMatchInlineSnapshot(`
      [
        {
          "background": "light",
          "foreground": "#1e1e1e",
          "initial": "dark",
          "rgb": "ffff/ffff/ffff",
          "scheme": "sy-light",
          "tag": "#9b2c2c",
        },
        {
          "background": "dark",
          "foreground": "#e8e8e8",
          "initial": "light",
          "rgb": "0000/0000/0000",
          "scheme": "sy-dark",
          "tag": "#5ca0d7",
        },
        {
          "background": "dark",
          "foreground": "#e8e8e8",
          "initial": "dark",
          "rgb": "0000/0000/0000",
          "scheme": "sy-dark",
          "tag": "#5ca0d7",
        },
        {
          "background": "light",
          "foreground": "#1e1e1e",
          "initial": "light",
          "rgb": "ffff/ffff/ffff",
          "scheme": "sy-light",
          "tag": "#9b2c2c",
        },
      ]
    `);
  });

  it("preserves the current palette when the terminal background query is unavailable", async () => {
    const selection = await getIndexFunction("_doVimTheme")([]);
    const result = await probeTheme(selection, "light", ["set t_RB=", "doautocmd FocusGained"]);

    expect(result.terminalOutput).not.toContain("\u001b]11;?");
    expect({ scheme: result.scheme, background: result.background, foreground: result.foreground, tag: result.tag }).toMatchInlineSnapshot(`
      {
        "background": "light",
        "foreground": "#1e1e1e",
        "scheme": "sy-light",
        "tag": "#9b2c2c",
      }
    `);
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
      expect({ scheme: result.scheme, background: result.background, ayu: result.ayu, foreground: result.foreground }).toMatchInlineSnapshot(`
        {
          "ayu": "light",
          "background": "light",
          "foreground": "#123456",
          "scheme": "owned-fixture",
        }
      `);
    } finally {
      registry.vim = original;
    }
  });
});

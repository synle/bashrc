/** Opt-in native integration: full generated vimrc with real, already-installed Jetpack/Signify/Lightline plugins. */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import { fileSystem, loadScriptHelpers, setSandboxGlobal } from "../setup.js";
import { pluginRoot, probe } from "./vimThemes.plugins.helpers.js";

beforeAll(() => loadScriptHelpers("software/scripts/vim-config.js"));
beforeEach(() => {
  setSandboxGlobal("is_gui", true);
  setSandboxGlobal("is_os_windows", false);
  setSandboxGlobal("IS_CI", false);
  setSandboxGlobal("getRuntimeOption", () => false);
  fileSystem["software/scripts/vim-config-settings.vim"] = fs.readFileSync("software/scripts/vim-config-settings.vim", "utf8");
});

describe.skipIf(!pluginRoot)("native installed Vim plugin integration", () => {
  it.each([
    ["dark", ["sy-dark", "sy-light", "sy-dark"]],
    ["light", ["sy-light", "sy-dark", "sy-light"]],
  ])("preserves Signify links and Lightline colors after switching from %s", async (appearance, expectedSchemes) => {
    const result = await probe(appearance);
    expect(result.signify).toBe(1);
    expect(result.lightline).toBe(1);
    expect(result.states.map((state) => state.scheme)).toEqual(expectedSchemes);
    expect(result.states[2]).toEqual(result.states[0]);
    expect(
      Object.fromEntries(
        result.states.map((state) => [
          state.scheme,
          {
            lightline: state.lightline,
            groups: state.groups,
          },
        ]),
      ),
    ).toMatchInlineSnapshot(`
      {
        "sy-dark": {
          "groups": {
            "Conceal": {
              "background": "",
              "foreground": "#464646",
              "target": "Conceal",
            },
            "CursorLineConceal": {
              "background": "",
              "foreground": "",
              "target": "",
            },
            "DiffAdd": {
              "background": "#161616",
              "foreground": "#76a762",
              "target": "DiffAdd",
            },
            "DiffChange": {
              "background": "#161616",
              "foreground": "#5ca0d7",
              "target": "DiffChange",
            },
            "DiffDelete": {
              "background": "#161616",
              "foreground": "#f67070",
              "target": "DiffDelete",
            },
            "LightlineLeft_normal_0": {
              "background": "#76a762",
              "foreground": "#0a0a0a",
              "target": "LightlineLeft_normal_0",
            },
            "Normal": {
              "background": "#0a0a0a",
              "foreground": "#e8e8e8",
              "target": "Normal",
            },
            "SignifyLineAdd": {
              "background": "#161616",
              "foreground": "#76a762",
              "target": "DiffAdd",
            },
            "SignifySignAdd": {
              "background": "#161616",
              "foreground": "#76a762",
              "target": "DiffAdd",
            },
            "SignifySignChange": {
              "background": "#161616",
              "foreground": "#5ca0d7",
              "target": "DiffChange",
            },
            "SignifySignDelete": {
              "background": "#161616",
              "foreground": "#f67070",
              "target": "DiffDelete",
            },
            "tsxTagName": {
              "background": "",
              "foreground": "#5ca0d7",
              "target": "Tag",
            },
          },
          "lightline": "sy",
        },
        "sy-light": {
          "groups": {
            "Conceal": {
              "background": "",
              "foreground": "#a4a4a4",
              "target": "Conceal",
            },
            "CursorLineConceal": {
              "background": "",
              "foreground": "",
              "target": "",
            },
            "DiffAdd": {
              "background": "#ececec",
              "foreground": "#004a15",
              "target": "DiffAdd",
            },
            "DiffChange": {
              "background": "#ececec",
              "foreground": "#0252ad",
              "target": "DiffChange",
            },
            "DiffDelete": {
              "background": "#ececec",
              "foreground": "#840000",
              "target": "DiffDelete",
            },
            "LightlineLeft_normal_0": {
              "background": "#004a15",
              "foreground": "#f8f8f8",
              "target": "LightlineLeft_normal_0",
            },
            "Normal": {
              "background": "#f8f8f8",
              "foreground": "#1e1e1e",
              "target": "Normal",
            },
            "SignifyLineAdd": {
              "background": "#ececec",
              "foreground": "#004a15",
              "target": "DiffAdd",
            },
            "SignifySignAdd": {
              "background": "#ececec",
              "foreground": "#004a15",
              "target": "DiffAdd",
            },
            "SignifySignChange": {
              "background": "#ececec",
              "foreground": "#0252ad",
              "target": "DiffChange",
            },
            "SignifySignDelete": {
              "background": "#ececec",
              "foreground": "#840000",
              "target": "DiffDelete",
            },
            "tsxTagName": {
              "background": "",
              "foreground": "#9b2c2c",
              "target": "Tag",
            },
          },
          "lightline": "sy",
        },
      }
    `);
  });
});

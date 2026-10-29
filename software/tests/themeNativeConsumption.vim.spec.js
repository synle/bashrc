import { describe, expect, it } from "vitest";

import { digestNativeEvidence, nativeConsumptionEvidence } from "./themeNativeConsumption.helpers.js";

describe("full Vim startup evidence", () => {
  it("snapshots every recorded observation except the volatile settings digest", () => {
    const vimEvidence = { ...nativeConsumptionEvidence.vim };
    delete vimEvidence.settingsSha256;

    expect(vimEvidence).toMatchInlineSnapshot(`
      {
        "appearances": [
          {
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
            "lightlineScheme": "sy",
            "mode": "dark",
            "scheme": "sy-dark",
            "sourceSha256": "84c8414c95a0a71a915001fa33c51a4a4434bb58f723a2a981fde17cd93a07cd",
          },
          {
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
            "lightlineScheme": "sy",
            "mode": "light",
            "scheme": "sy-light",
            "sourceSha256": "8def8dd07f36787973048e94d2dfb0f2361fd0f8887d2c271c71860833081121",
          },
          {
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
            "lightlineScheme": "sy",
            "mode": "dark",
            "scheme": "sy-dark",
            "sourceSha256": "84c8414c95a0a71a915001fa33c51a4a4434bb58f723a2a981fde17cd93a07cd",
          },
        ],
        "cursorLineConceal": "reference_only_no_consumer_found_in_installed_plugins_or_vim_runtime",
        "lightlineLoaded": true,
        "mechanism": "Full deployed vimrc startup with real installed Jetpack, Signify and Lightline; native highlight setup, then dark/light/dark switches.",
        "remaining": "Native highlight inheritance is verified; real asynchronous VCS hunk creation, terminal glyph rendering and every plugin state are not.",
        "signifyLoaded": true,
        "version": 9011752,
      }
    `);
    expect(vimEvidence.signifyLoaded).toBe(true);
    expect(vimEvidence.lightlineLoaded).toBe(true);
    expect(vimEvidence.appearances.map((record) => record.scheme)).toEqual(["sy-dark", "sy-light", "sy-dark"]);
    for (const record of vimEvidence.appearances) {
      expect(record.sourceSha256).toBe(digestNativeEvidence(`theme/sy/vim_${record.mode}.jsonc`));
      expect(record.lightlineScheme).toBe("sy");
      expect(record.groups.SignifySignAdd.target).toBe("DiffAdd");
      expect(record.groups.SignifySignChange.target).toBe("DiffChange");
      expect(record.groups.SignifySignDelete.target).toBe("DiffDelete");
    }
    expect(vimEvidence.cursorLineConceal).toBe("reference_only_no_consumer_found_in_installed_plugins_or_vim_runtime");
  });
});

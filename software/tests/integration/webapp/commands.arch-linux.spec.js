/** Real browser fingerprints for the Setup Arch Linux command and every direct body child. */
import { describe, expect, it } from "vitest";
import { commandBrowser, selectCommand } from "./commands.helpers.js";

/** A dedicated browser session prevents command state leaking across spec files. */
const browser = commandBrowser();

describe("command snapshots", () => {
  it("Setup Arch Linux keeps its current block titles, content, links, and count", async () => {
    const { blocks, errors } = await selectCommand(browser.page, "command-option-setup-arch-linux");
    expect(blocks).toHaveLength(16);
    expect(errors).toMatchInlineSnapshot(`[]`);
    expect(blocks).toMatchInlineSnapshot(`
      [
        {
          "hash": "b60e4db42a28f9b173d59da31505c9a5",
          "title": "software/bootstrap/setup.sh",
        },
        {
          "hash": "7a2570d84a170b0c465e5ae49eded2cb",
          "title": "docs/linux/README.md",
        },
        {
          "hash": "98af38399b44ba9cbf56ee169f14ddb6",
          "title": "docs/linux/linux-mint-config.sh",
        },
        {
          "hash": "49eb01626020a5e57936610df8b31abc",
          "title": "assets/fonts/install.sh",
        },
        {
          "hash": "d2f652c3439ccc972d9d0281927f0ab0",
          "title": ".build/gitconfig",
        },
        {
          "hash": "eda1482576eb6a03f03bc1595d4b1a49",
          "title": ".build/gitignore_global",
        },
        {
          "hash": "e98cc6b5031ea77aea61eb3d61aa8465",
          "title": ".build/ssh-config",
        },
        {
          "hash": "68b9dca4ae448b2dee02586add3c63c1",
          "title": ".build/inputrc",
        },
        {
          "hash": "f511a4b5a468733093d4b99faa0ef7c8",
          "title": ".build/vimrc",
        },
        {
          "hash": "94d83862edede417a2c58712e6f75a49",
          "title": "docs/android/sponsorblock.json",
        },
        {
          "hash": "aa0f1cfb6f25c3cb9ae491f96c2d01cf",
          "title": "docs/game-streaming-moonlight-steamlink.md",
        },
        {
          "hash": "df935059e1e60ec63960be6fd1d01572",
          "title": "profile_bashrc_arch_linux.sh",
        },
        {
          "hash": "ebcc7cb095f96a8457a749384ddfad8b",
          "title": ".build/sublime-text-setup",
        },
        {
          "hash": "142be3e09289b0f368d5133c2b49d890",
          "title": ".build/sublime-text-ext",
        },
        {
          "hash": "5964e9e48678142d89473bcca6479794",
          "title": "OTHER APPLICATIONS",
        },
        {
          "links": [
            {
              "hash": "https://github.com/synle/bashrc/blob/main/fonts",
              "title": "CUSTOM FONTS",
            },
            {
              "hash": "font-preview.html",
              "title": "FONT PREVIEW",
            },
            {
              "hash": "https://www.sublimetext.com/download",
              "title": "SUBLIME TEXT",
            },
            {
              "hash": "https://www.sublimemerge.com/download",
              "title": "SUBLIME MERGE",
            },
            {
              "hash": "https://www.charlesproxy.com/download/latest-release/",
              "title": "CHARLES PROXY",
            },
            {
              "hash": "https://ultimaker.com/software/ultimaker-cura/#links",
              "title": "ULTIMAKER CURA",
            },
            {
              "hash": "https://design.cricut.com/#/",
              "title": "CRICUT DESIGN SPACE",
            },
            {
              "hash": "https://download.battle.net/en-us/?product=bnetdesk",
              "title": "BATTLE NET",
            },
          ],
          "title": "link-group",
        },
      ]
    `);
  }, 90000);
});

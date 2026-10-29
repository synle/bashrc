/** Real browser fingerprints for the Setup Ubuntu command and every direct body child. */
import { describe, expect, it } from "vitest";
import { commandBrowser, selectCommand } from "./commands.helpers.js";

/** A dedicated browser session prevents command state leaking across spec files. */
const browser = commandBrowser();

describe("command snapshots", () => {
  it("Setup Ubuntu keeps its current block titles, content, links, and count", async () => {
    const { blocks, errors } = await selectCommand(browser.page, "command-option-setup-ubuntu");
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
          "hash": "8d641d61860e71c0e3d0f960b5af94e3",
          "title": ".build/gitconfig",
        },
        {
          "hash": "205278aefeaa96b9cf8aef779f5e91c3",
          "title": ".build/gitignore_global",
        },
        {
          "hash": "39f664726a856bcccc7eb55af2a2e021",
          "title": ".build/ssh-config",
        },
        {
          "hash": "cfc6c9692d3371056ca087e7522a4bb2",
          "title": ".build/inputrc",
        },
        {
          "hash": "7db5b839978da6f90116df1fc54e5816",
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
          "hash": "101a0111feedc0a0a20059fefe1eff0d",
          "title": "profile_bashrc_ubuntu.sh",
        },
        {
          "hash": "9103343a4974a871fe22bf3acc4bcc2a",
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

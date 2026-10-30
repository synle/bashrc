/** Real browser fingerprints for the Setup Mac command and every direct body child. */
import { describe, expect, it } from "vitest";
import { commandBrowser, selectCommand } from "./commands.helpers.js";

/** A dedicated browser session prevents command state leaking across spec files. */
const browser = commandBrowser();

describe("command snapshots", () => {
  it("Setup Mac keeps its current block titles, content, links, and count", async () => {
    const { blocks, errors } = await selectCommand(browser.page, "command-option-setup-mac");
    expect(blocks).toHaveLength(14);
    expect(errors).toMatchInlineSnapshot(`[]`);
    // Hashes fingerprint live-fetched rendered source; legitimate source changes can make this snapshot stale.
    // For hash-only failures, inspect the changed source first; do not accept unexpected content, links, or UI changes.
    // Refresh: npm run test:integration:local -- --update=all software/tests/integration/webapp/commands.mac.spec.js
    // Verify: npm run test:integration:local -- software/tests/integration/webapp/commands.mac.spec.js
    // Review every snapshot change; a different hash alone does not prove that the new output is correct.
    expect(blocks).toMatchInlineSnapshot(`
      [
        {
          "hash": "85e85fc356aea95cb41c2f17e6333bba",
          "title": "This is meant for Mac. Your system is detected as a different OS.",
        },
        {
          "hash": "8a9089acc4c542727e43734581c5ad35",
          "title": "software/bootstrap/setup.sh",
        },
        {
          "hash": "153bcfa79bcd82a9892f7e5169ae078d",
          "title": "docs/mac/README.md",
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
          "hash": "0625485e65536d4ab6aaf33af938822d",
          "title": "profile_bashrc_mac.sh",
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

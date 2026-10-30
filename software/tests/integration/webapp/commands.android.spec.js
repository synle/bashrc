/** Real browser fingerprints for the Setup Android command and every direct body child. */
import { describe, expect, it } from "vitest";
import { commandBrowser, selectCommand } from "./commands.helpers.js";

/** A dedicated browser session prevents command state leaking across spec files. */
const browser = commandBrowser();

describe("command snapshots", () => {
  it("Setup Android keeps its current block titles, content, links, and count", async () => {
    const { blocks, errors } = await selectCommand(browser.page, "command-option-setup-android");
    expect(blocks).toHaveLength(14);
    expect(errors).toMatchInlineSnapshot(`[]`);
    // Hashes fingerprint live-fetched rendered source; legitimate source changes can make this snapshot stale.
    // For hash-only failures, inspect the changed source first; do not accept unexpected content, links, or UI changes.
    // Refresh: npm run test:integration:local -- --update=all software/tests/integration/webapp/commands.android.spec.js
    // Verify: npm run test:integration:local -- software/tests/integration/webapp/commands.android.spec.js
    // Review every snapshot change; a different hash alone does not prove that the new output is correct.
    expect(blocks).toMatchInlineSnapshot(`
      [
        {
          "hash": "65636dea1baae0d36b17505f70bf3903",
          "title": "This is meant for Android. Your system is detected as a different OS.",
        },
        {
          "hash": "8a9089acc4c542727e43734581c5ad35",
          "title": "software/bootstrap/setup.sh",
        },
        {
          "hash": "97017f799ed420e3de67fce2b6f9a91f",
          "title": "docs/android/android.debloat.sh",
        },
        {
          "hash": "3bd61488cf21bc4a7a45c9c3f7e44e10",
          "title": "docs/android/android.restore.sh",
        },
        {
          "hash": "6e762033e08e34daa766977790c0c0fe",
          "title": "docs/android/android.sh",
        },
        {
          "hash": "94d83862edede417a2c58712e6f75a49",
          "title": "docs/android/sponsorblock.json",
        },
        {
          "hash": "540fe49191ea31cc73d4b382dc0e71e0",
          "title": "docs/android/rvx-yt.txt",
        },
        {
          "hash": "76463f48346a61ed71d406f289eae42c",
          "title": "docs/android/rvx-yt-music.txt",
        },
        {
          "hash": "aaf23bb2ba77d651f678364eee226da1",
          "title": "ANDROID APPLICATIONS",
        },
        {
          "links": [
            {
              "hash": "https://vanced.to/gmscore-microg",
              "title": "MICROG",
            },
            {
              "hash": "https://vanced.to/revanced-google-photos",
              "title": "GOOGLE PHOTO",
            },
            {
              "hash": "https://vanced.to/revanced-youtube-extended",
              "title": "YOUTUBE",
            },
            {
              "hash": "https://vanced.to/revanced-youtube-music-extended",
              "title": "YOUTUBE MUSIC",
            },
            {
              "hash": "https://vanced.to/revanced-google-news",
              "title": "GOOGLE NEWS",
            },
            {
              "hash": "https://teslacoilapps.com/tesladirect/download.pl?packageName=com.teslacoilsw.launcherclientproxy&betaType=public",
              "title": "NOVA COMPANION",
            },
          ],
          "title": "link-group",
        },
        {
          "hash": "0a62790019b8e711ab5f7ae0235264e4",
          "title": "ANDROID EMULATORS \u2014 HIGH-END",
        },
        {
          "hash": "e65b2de19ac5bbcc8fb6a2d7ea7b55cf",
          "title": "Nintendo Switch - Eden Emulator / Sudachi",
        },
        {
          "hash": "fe1db510f8cca6df3a96ddcadd3fde0c",
          "title": "ANDROID EMULATORS \u2014 LOW-TO-MID RANGE",
        },
        {
          "hash": "5715434cd7f8c0c10649fd67d29919b0",
          "title": "Nintendo GameCube & Wii - Dolphin",
        },
      ]
    `);
  }, 90000);
});

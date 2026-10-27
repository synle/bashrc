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
    expect(blocks).toMatchInlineSnapshot(`
      [
        {
          "hash": "65636dea1baae0d36b17505f70bf3903",
          "title": "This is meant for Android. Your system is detected as a different OS.",
        },
        {
          "hash": "b60e4db42a28f9b173d59da31505c9a5",
          "title": "software/bootstrap/setup.sh",
        },
        {
          "hash": "1565d2d2c99e6d4c728ce2153b04e284",
          "title": "docs/android/android.debloat.sh",
        },
        {
          "hash": "fbbb3268024e6d1b07475c72a169a366",
          "title": "docs/android/android.restore.sh",
        },
        {
          "hash": "a4bf7f9d28d4d8f74a3e29da0d77675a",
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

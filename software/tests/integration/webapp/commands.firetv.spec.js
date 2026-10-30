/** Real browser fingerprints for the TV - FireTV command and every direct body child. */
import { describe, expect, it } from "vitest";
import { commandBrowser, selectCommand } from "./commands.helpers.js";

/** A dedicated browser session prevents command state leaking across spec files. */
const browser = commandBrowser();

describe("command snapshots", () => {
  it("TV - FireTV keeps its current block titles, content, links, and count", async () => {
    const { blocks, errors } = await selectCommand(browser.page, "command-option-tv---firetv");
    expect(blocks).toHaveLength(3);
    expect(errors).toMatchInlineSnapshot(`[]`);
    expect(blocks).toMatchInlineSnapshot(`
      [
        {
          "hash": "60a2d4007e474c56d70945a7296f0a49",
          "title": "docs/android/firetv.sh",
        },
        {
          "hash": "9b0e437021409a81bbdb216f02be231e",
          "title": "docs/android/firetv.debloat.sh",
        },
        {
          "hash": "6eb581b6c06c94605c93867df8be5a5b",
          "title": "docs/android/firetv.restore.sh",
        },
      ]
    `);
  }, 90000);
});

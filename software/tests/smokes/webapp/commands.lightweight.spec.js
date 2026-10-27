/** Real browser fingerprints for the Setup Lightweight Profile command and every direct body child. */
import { describe, expect, it } from "vitest";
import { commandBrowser, selectCommand } from "./commands.helpers.js";

/** A dedicated browser session prevents command state leaking across spec files. */
const browser = commandBrowser();

describe("command snapshots", () => {
  it("Setup Lightweight Profile keeps its current block titles, content, links, and count", async () => {
    const { blocks, errors } = await selectCommand(browser.page, "command-option-setup-lightweight-profile");
    expect(blocks).toHaveLength(1);
    expect(errors).toMatchInlineSnapshot(`[]`);
    expect(blocks).toMatchInlineSnapshot(`
      [
        {
          "hash": "c0dbd636e7f537009f04059fe454c503",
          "title": "Output",
        },
      ]
    `);
  }, 90000);
});

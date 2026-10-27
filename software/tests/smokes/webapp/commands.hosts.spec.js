/** Real browser fingerprints for the Setup Etc Hosts command and every direct body child. */
import { describe, expect, it } from "vitest";
import { commandBrowser, selectCommand } from "./commands.helpers.js";

/** A dedicated browser session prevents command state leaking across spec files. */
const browser = commandBrowser();

describe("command snapshots", () => {
  it("Setup Etc Hosts keeps its current block titles, content, links, and count", async () => {
    const { blocks, errors } = await selectCommand(browser.page, "command-option-setup-etc-hosts");
    expect(blocks).toHaveLength(1);
    expect(errors).toMatchInlineSnapshot(`[]`);
    expect(blocks).toMatchInlineSnapshot(`
      [
        {
          "hash": "86cac2814e3fd29ec466abaa814fbd59",
          "title": "Output",
        },
      ]
    `);
  }, 90000);
});

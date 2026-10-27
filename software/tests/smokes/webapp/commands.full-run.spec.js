/** Real browser fingerprints for the Test Full Run live command and every direct body child. */
import { describe, expect, it } from "vitest";
import { commandBrowser, selectCommand } from "./commands.helpers.js";

/** A dedicated browser session prevents command state leaking across spec files. */
const browser = commandBrowser();

describe("command snapshots", () => {
  it("Test Full Run live keeps its current block titles, content, links, and count", async () => {
    const { blocks, errors } = await selectCommand(browser.page, "command-option-test-full-run-live");
    expect(blocks).toHaveLength(3);
    expect(errors).toMatchInlineSnapshot(`[]`);
    expect(blocks).toMatchInlineSnapshot(`
      [
        {
          "hash": "224e00039c3b8f2628cf19f59e9fa1f4",
          "title": "OS TYPE",
        },
        {
          "hash": "151fc230a57ac85c9e1e79ec28df3f30",
          "title": "This is meant for Windows. Your system is detected as a different OS.",
        },
        {
          "hash": "82fb7710c351f87a5e585ee53a4900b1",
          "title": "Output",
        },
      ]
    `);
  }, 90000);
});

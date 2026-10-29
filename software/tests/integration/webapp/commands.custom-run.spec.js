/** Real browser fingerprints for the Test Custom Run command and every direct body child. */
import { describe, expect, it } from "vitest";
import { commandBrowser, selectCommand } from "./commands.helpers.js";

/** A dedicated browser session prevents command state leaking across spec files. */
const browser = commandBrowser();

describe("command snapshots", () => {
  it("Test Custom Run keeps its current block titles, content, links, and count", async () => {
    const { blocks, errors } = await selectCommand(browser.page, "command-option-test-custom-run");
    expect(blocks).toHaveLength(6);
    expect(errors).toMatchInlineSnapshot(`[]`);
    expect(blocks).toMatchInlineSnapshot(`
      [
        {
          "hash": "75dfc0d1a977ff3f454e58e48164b07e",
          "title": "RUN MODE",
        },
        {
          "hash": "01e8ea407ad941d723cd70cdbb6b9887",
          "title": "SCRIPTS TO RUN",
        },
        {
          "hash": "e6325277b874f7f8ecea376d4a8f9b52",
          "title": "scriptToRunOptions",
        },
        {
          "hash": "224e00039c3b8f2628cf19f59e9fa1f4",
          "title": "OS TYPE",
        },
        {
          "hash": "151fc230a57ac85c9e1e79ec28df3f30",
          "title": "This is meant for Windows. Your system is detected as a different OS.",
        },
        {
          "hash": "1f7597de977db5d14c3c93465faf5b62",
          "title": "Output",
        },
      ]
    `);
  }, 90000);
});

/** Real browser fingerprints for the Setup Mingw64 command and every direct body child. */
import { describe, expect, it } from "vitest";
import { commandBrowser, selectCommand } from "./commands.helpers.js";

/** A dedicated browser session prevents command state leaking across spec files. */
const browser = commandBrowser();

describe("command snapshots", () => {
  it("Setup Mingw64 keeps its current block titles, content, links, and count", async () => {
    const { blocks, errors } = await selectCommand(browser.page, "command-option-setup-mingw64");
    expect(blocks).toHaveLength(6);
    expect(errors).toMatchInlineSnapshot(`[]`);
    expect(blocks).toMatchInlineSnapshot(`
      [
        {
          "hash": "b60e4db42a28f9b173d59da31505c9a5",
          "title": "software/bootstrap/setup.sh",
        },
        {
          "hash": "c0dbd636e7f537009f04059fe454c503",
          "title": "Output",
        },
        {
          "hash": "8d641d61860e71c0e3d0f960b5af94e3",
          "title": ".build/gitconfig",
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
      ]
    `);
  }, 90000);
});

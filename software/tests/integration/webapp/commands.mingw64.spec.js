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
    // Hashes fingerprint live-fetched rendered source; legitimate source changes can make this snapshot stale.
    // For hash-only failures, inspect the changed source first; do not accept unexpected content, links, or UI changes.
    // Refresh: npm run test:integration:local -- --update=all software/tests/integration/webapp/commands.mingw64.spec.js
    // Verify: npm run test:integration:local -- software/tests/integration/webapp/commands.mingw64.spec.js
    // Review every snapshot change; a different hash alone does not prove that the new output is correct.
    expect(blocks).toMatchInlineSnapshot(`
      [
        {
          "hash": "8a9089acc4c542727e43734581c5ad35",
          "title": "software/bootstrap/setup.sh",
        },
        {
          "hash": "c0dbd636e7f537009f04059fe454c503",
          "title": "Output",
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
      ]
    `);
  }, 90000);
});

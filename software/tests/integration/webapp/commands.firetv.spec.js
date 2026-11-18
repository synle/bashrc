/** Real browser fingerprints for the TV - FireTV command and every direct body child. */
import { describe, expect, it } from "vitest";
import { commandBrowser, selectCommand } from "./commands.helpers.js";

/** A dedicated browser session prevents command state leaking across spec files. */
const browser = commandBrowser();

describe("command snapshots", () => {
  it("TV - FireTV keeps its current block titles, content, links, and count", async () => {
    const { blocks, errors } = await selectCommand(browser.page, "command-option-tv---firetv");
    expect(errors).toMatchInlineSnapshot(`[]`);
    // Hashes fingerprint live-fetched rendered source; legitimate source changes can make this snapshot stale.
    // For hash-only failures, inspect the changed source first; do not accept unexpected content, links, or UI changes.
    // Refresh: npm run test:integration:local -- --update=all software/tests/integration/webapp/commands.firetv.spec.js
    // Verify: npm run test:integration:local -- software/tests/integration/webapp/commands.firetv.spec.js
    // Review every snapshot change; a different hash alone does not prove that the new output is correct.
    expect(blocks).toMatchInlineSnapshot(`
      [
        {
          "hash": "07cd63169f9da659332a12240c50e322",
          "title": "docs/android/android-tv-fire.sh",
        },
        {
          "hash": "754a91d7dbb85222f518e8c706fa3ec9",
          "title": "docs/android/android-tv-fire.debloat.sh",
        },
        {
          "hash": "aaf9164b2364d80e072502ed24787dd8",
          "title": "docs/android/android-tv-fire.restore.sh",
        },
      ]
    `);
  }, 90000);
});

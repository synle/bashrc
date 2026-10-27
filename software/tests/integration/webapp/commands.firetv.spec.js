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
          "hash": "83cbe3addea8ca28429d7cdfc3a9cd91",
          "title": "docs/android/firetv.sh",
        },
        {
          "hash": "ec2c7aa1172085c9463827ee2b63e3ab",
          "title": "docs/android/firetv.debloat.sh",
        },
        {
          "hash": "01d43a79d86c2ab311738ff127fe69cc",
          "title": "docs/android/firetv.restore.sh",
        },
      ]
    `);
  }, 90000);
});

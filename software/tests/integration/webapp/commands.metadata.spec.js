/** Verify command fingerprints ignore only volatile metadata on published profile previews. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import puppeteer from "puppeteer";
import { readCommand } from "./commands.helpers.js";

/** Private browser owned by this spec; pages are isolated per test. */
let browser;
/** Fresh DOM for each fingerprint contract test. */
let page;

beforeAll(async () => {
  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
});
afterAll(async () => {
  if (browser) await browser.close();
});
beforeEach(async () => {
  page = await browser.newPage();
});
afterEach(async () => {
  await page.close();
});

/**
 * Render a controlled code-block DOM through the public fingerprint observer.
 * @param {string} title Exact source title.
 * @returns {Promise<void>} Resolves after the isolated page receives its fixture.
 * @sideEffects Replaces only the current test page's DOM.
 */
async function renderBlock(title) {
  await page.setContent(`<main id="mainBodyContainer"><div class="codeBlockWrapper">
    <div class="codeBlockBanner"><div>${title}</div></div>
    <pre class="prism-code-block"># AUTO-GENERATED - DO NOT EDIT [2026-10-27]
printf '%s' hello</pre>
    <a class="codeBlockShowMore">Show More (100 more lines)</a>
  </div></main>`);
}

describe("published profile fingerprint metadata", () => {
  it("keeps the fingerprint stable across profile build dates and hidden-line counts", async () => {
    await renderBlock("profile_bashrc_mac.sh");
    const before = await readCommand(page);
    await page.$eval(".prism-code-block", (node) => {
      node.textContent = node.textContent.replace("2026-10-27", "2026-10-28");
    });
    await page.$eval(".codeBlockShowMore", (node) => {
      node.textContent = "Show More (101 more lines)";
    });
    expect(await readCommand(page)).toEqual(before);
  });

  it("still detects changes to the visible profile command content", async () => {
    await renderBlock("profile_bashrc_mac.sh");
    const before = await readCommand(page);
    await page.$eval(".prism-code-block", (node) => {
      node.textContent = node.textContent.replace("hello", "changed");
    });
    const after = await readCommand(page);
    expect(after.blocks[0].title).toBe("profile_bashrc_mac.sh");
    expect(after.blocks[0].hash).not.toBe(before.blocks[0].hash);
    expect(after.errors).toEqual([]);
    expect(after.empty).toEqual([]);
  });

  it("retains literal date and line-count changes for ordinary command blocks", async () => {
    await renderBlock(".build/inputrc");
    const before = await readCommand(page);
    await page.$eval(".codeBlockShowMore", (node) => {
      node.textContent = "Show More (101 more lines)";
    });
    const after = await readCommand(page);
    expect(after.blocks[0].hash).not.toBe(before.blocks[0].hash);
  });
});

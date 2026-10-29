/** Verify generated previews normalize volatile metadata without hiding visible content changes. */
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
 * @param {string} commentPrefix Generated header's shell or JSON comment marker.
 * @returns {Promise<void>} Resolves after the isolated page receives its fixture.
 * @sideEffects Replaces only the current test page's DOM.
 */
async function renderBlock(title, commentPrefix = "#") {
  await page.setContent(`<main id="mainBodyContainer"><div class="codeBlockWrapper">
    <div class="codeBlockBanner"><div>${title}</div></div>
    <pre class="prism-code-block">${commentPrefix} AUTO-GENERATED - DO NOT EDIT [2026-10-27]
printf '%s' hello</pre>
    <a class="codeBlockShowMore">Show More (100 more lines)</a>
  </div></main>`);
}

describe("generated preview fingerprint metadata", () => {
  it.each([
    { title: "profile_bashrc_mac.sh", commentPrefix: "#" },
    { title: ".build/gitconfig", commentPrefix: "#" },
    { title: ".build/sublime-text-setup", commentPrefix: "#" },
    { title: ".build/config.json", commentPrefix: "//" },
  ])("keeps $title stable across build dates and hidden-line counts", async ({ title, commentPrefix }) => {
    await renderBlock(title, commentPrefix);
    const before = await readCommand(page);
    await page.$eval(".prism-code-block", (node) => {
      node.textContent = node.textContent.replace("2026-10-27", "2026-10-28");
    });
    await page.$eval(".codeBlockShowMore", (node) => {
      node.textContent = "Show More (101 more lines)";
    });
    expect(await readCommand(page)).toEqual(before);
  });

  it.each(["profile_bashrc_mac.sh", ".build/gitconfig"])("still detects visible command changes in %s", async (title) => {
    await renderBlock(title);
    const before = await readCommand(page);
    await page.$eval(".prism-code-block", (node) => {
      node.textContent = node.textContent.replace("hello", "changed");
    });
    const after = await readCommand(page);
    expect(after.blocks[0].title).toBe(title);
    expect(after.blocks[0].hash).not.toBe(before.blocks[0].hash);
    expect(after.errors).toEqual([]);
    expect(after.empty).toEqual([]);
  });

  it.each([
    { label: "date", selector: ".prism-code-block", text: "# AUTO-GENERATED - DO NOT EDIT [2026-10-28]\nprintf '%s' hello" },
    { label: "line count", selector: ".codeBlockShowMore", text: "Show More (101 more lines)" },
  ])("retains literal $label changes for ordinary command blocks", async ({ selector, text }) => {
    await renderBlock("docs/example.sh");
    const before = await readCommand(page);
    await page.$eval(selector, (node, value) => {
      node.textContent = value;
    }, text);
    const after = await readCommand(page);
    expect(after.blocks[0].hash).not.toBe(before.blocks[0].hash);
  });
});

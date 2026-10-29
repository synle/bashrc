/** Real-browser command snapshots with deterministic platform and settled rendered content. */
import { afterAll, beforeAll, expect } from "vitest";
import puppeteer from "puppeteer";
import { createHash } from "crypto";
import { WEBAPP_URL } from "./urls.js";

/** Maximum time for navigation, asynchronous source downloads, and browser cleanup. */
const BROWSER_TIMEOUT = 60000;
/** Top-level command controls; nested form buttons must not enter the command inventory. */
export const COMMAND_SELECTOR = "#topNavigationContainer > .nav-radio-group > button[data-nav-idx]";

/**
 * Register a private browser lifecycle for one integration spec, with a fixed Linux platform and viewport.
 * @returns {{page: import("puppeteer").Page | undefined}} Page populated before tests; browser closes after failures too.
 */
export function commandBrowser() {
  const state = { page: undefined };
  let browser;
  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
    state.page = await browser.newPage();
    await state.page.setViewport({ width: 1280, height: 900 });
    await state.page.evaluateOnNewDocument(() => Object.defineProperty(navigator, "platform", { get: () => "Linux x86_64" }));
    await state.page.goto(new URL("#command-option-setup-mac", WEBAPP_URL).href, { waitUntil: "networkidle0", timeout: BROWSER_TIMEOUT });
    await state.page.waitForSelector(COMMAND_SELECTOR, { timeout: BROWSER_TIMEOUT });
  }, BROWSER_TIMEOUT);
  afterAll(async () => {
    if (browser) await browser.close();
  }, BROWSER_TIMEOUT);
  return state;
}

/**
 * Observe direct body children, retaining content while normalizing published-profile build dates and hidden-line counts.
 * @param {import("puppeteer").Page} page - The actual application page.
 * @returns {Promise<{blocks: object[], errors: string[], empty: string[]}>} Visible fingerprints and explicit loading/error observations.
 */
export async function readCommand(page) {
  const observed = await page.$eval("#mainBodyContainer", (container) => {
    const children = [...container.children];
    return {
      blocks: children.map((child) => {
        const text = child.innerText.trim();
        const banner = child.querySelector(".codeBlockBanner > div:first-child");
        const title =
          banner?.textContent.trim() || child.id || (child.classList.contains("link-group") ? "link-group" : text.split("\n")[0]);
        if (child.classList.contains("link-group")) {
          return {
            title,
            links: [...child.querySelectorAll("a")].map((link) => ({ title: link.innerText.trim(), hash: link.getAttribute("href") })),
          };
        }
        return { title, text };
      }),
      errors: [...container.querySelectorAll(".codeBlockWrapper .text-error")].map((node) => node.innerText.trim()),
      empty: [...container.querySelectorAll(".codeBlockWrapper")]
        .filter((node) => !node.querySelector(".text-error") && !node.querySelector(".prism-code-block")?.textContent.trim())
        .map((node) => node.querySelector(".codeBlockBanner > div:first-child")?.textContent.trim()),
    };
  });
  return {
    ...observed,
    blocks: observed.blocks.map((block) => {
      if ("links" in block) return block;
      // Published profiles move independently of this checkout; their preview content still stays fingerprinted.
      const text = /^profile_bashrc_[a-z_]+\.sh$/.test(block.title)
        ? block.text
            .replace(/^# AUTO-GENERATED - DO NOT EDIT \[\d{4}-\d{2}-\d{2}\]$/m, "# AUTO-GENERATED - DO NOT EDIT [<build-date>]")
            .replace(/Show More \(\d+ more lines?\)/g, "Show More (<line-count> more lines)")
        : block.text;
      return { title: block.title, hash: createHash("md5").update(text).digest("hex") };
    }),
  };
}

/**
 * Click one actual command and wait until downloads and rendered fingerprints settle.
 * @param {import("puppeteer").Page} page - Private browser page.
 * @param {string} command - Literal data-nav-idx of the command to select.
 * @returns {Promise<{blocks: object[], errors: string[], empty: string[]}>} Settled observations; assertions reject empty bodies and unfinished code blocks.
 */
export async function selectCommand(page, command) {
  const pending = new Set();
  const started = (request) => pending.add(request);
  const finished = (request) => pending.delete(request);
  page.on("request", started);
  page.on("requestfinished", finished);
  page.on("requestfailed", finished);
  try {
    await page.click(`${COMMAND_SELECTOR}[data-nav-idx="${command}"]`);
    await page.waitForFunction(
      (id) => document.querySelector("#topNavigationContainer button.selected")?.getAttribute("data-nav-idx") === id,
      { timeout: BROWSER_TIMEOUT },
      command,
    );
    let previous;
    await expect
      .poll(
        async () => {
          const current = await readCommand(page);
          const fingerprint = JSON.stringify(current);
          const settled = pending.size === 0 && current.empty.length === 0 && current.blocks.length > 0 && fingerprint === previous;
          previous = fingerprint;
          return settled;
        },
        { timeout: BROWSER_TIMEOUT, interval: 200 },
      )
      .toBe(true);
    const result = await readCommand(page);
    expect(result.empty).toEqual([]);
    return result;
  } finally {
    page.off("request", started);
    page.off("requestfinished", finished);
    page.off("requestfailed", finished);
  }
}

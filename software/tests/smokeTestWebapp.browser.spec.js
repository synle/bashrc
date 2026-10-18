import { describe, it, expect } from "vitest";

const WEBAPP_URL = process.env.WEBAPP_URL || "https://synle.github.io/bashrc/";

const TIMEOUT = 30000;

describe("webapp smoke test", () => {
it(
    "phase 10 - global collapse/expand button toggles all blocks",
    async () => {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({ headless: "new", args: ["--no-sandbox"] });
      try {
        const page = await browser.newPage();
        await page.goto(WEBAPP_URL, { waitUntil: "networkidle0", timeout: TIMEOUT });
        await page.waitForSelector('[data-testid="global-collapse"]', { timeout: 10000 });

        // Blocks default to collapsed; the first click on the global toggle expands all.
        await page.click('[data-testid="global-collapse"]');
        await new Promise((r) => setTimeout(r, 1000));

        const expandedAfterExpand = await page.$$eval('[data-testid="code-block"][data-collapsed="false"]', (els) => els.length);
        expect(expandedAfterExpand).toBeGreaterThan(0);

        // Second click collapses everything back.
        await page.click('[data-testid="global-collapse"]');
        await new Promise((r) => setTimeout(r, 1000));

        const expandedAfterCollapse = await page.$$eval('[data-testid="code-block"][data-collapsed="false"]', (els) => els.length);
        expect(expandedAfterCollapse).toBe(0);
      } finally {
        await browser.close();
      }
    },
    TIMEOUT,
  );

it(
    "phase 11 - settings dropdown shows dark mode toggle",
    async () => {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({ headless: "new", args: ["--no-sandbox"] });
      try {
        const page = await browser.newPage();
        await page.goto(WEBAPP_URL, { waitUntil: "networkidle0", timeout: TIMEOUT });
        await page.waitForSelector('[data-testid="settings-toggle"]', { timeout: 10000 });

        // Verify dropdown is not visible initially
        const dropdownVisibleBefore = await page.$(".dropdown-content");
        expect(dropdownVisibleBefore).toBeNull();

        // Click settings to open dropdown
        await page.click('[data-testid="settings-toggle"]');
        await page.waitForSelector('[data-testid="theme-toggle"]', { timeout: 3000 });

        // Verify dark mode button is visible
        const themeText = await page.$eval('[data-testid="theme-toggle"]', (el) => el.textContent);
        expect(themeText).toMatch(/Dark Mode|Light Mode/);

        // Get initial theme
        const initialTheme = await page.$eval("html", (el) => el.getAttribute("data-theme"));

        // Click theme toggle
        await page.click('[data-testid="theme-toggle"]');
        await new Promise((r) => setTimeout(r, 500));

        // Theme should have changed
        const newTheme = await page.$eval("html", (el) => el.getAttribute("data-theme"));
        expect(newTheme).not.toBe(initialTheme);
      } finally {
        await browser.close();
      }
    },
    TIMEOUT,
  );

it("phase 12 - each Setup tab renders non-empty code blocks", async () => {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({ headless: "new", args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage();
      await page.goto(WEBAPP_URL, { waitUntil: "networkidle0", timeout: TIMEOUT });
      await page.waitForSelector('[data-testid="tab-navigation"]', { timeout: 10000 });

      // collect all Setup nav buttons
      const setupButtons = await page.$$eval('[data-testid="tab-navigation"] button[data-nav-idx^="command-option-setup"]', (buttons) =>
        buttons.map((b) => ({ idx: b.dataset.navIdx, text: b.textContent })),
      );
      expect(setupButtons.length).toBeGreaterThan(0);

      for (const { idx, text } of setupButtons) {
        // click the tab
        await page.click(`button[data-nav-idx="${idx}"]`);
        // wait for code block wrappers to mount (fetches start in useEffect after mount)
        await page.waitForSelector('[data-testid="code-block"]', { timeout: 10000 });
        // Poll the assertion until empty-block list is stable empty for two consecutive samples,
        // or until the 40s budget is exhausted. waitForNetworkIdle regressed in puppeteer-core 24.42,
        // and a one-shot waitForFunction is racy: each DynamicTextArea fetches independently in
        // useEffect, blocks can transition empty → filled out of order, and re-renders briefly clear
        // content. Retrying gives the page time to settle and avoids flaking when one fetch lags.
        const queryEmpty = () =>
          page.$$eval('[data-testid="code-block"][data-collapsed="false"] .prism-code-block', (blocks) =>
            blocks
              .filter((b) => b.textContent.trim() === "")
              .map((b) => b.closest('[data-testid="code-block"]')?.querySelector(".codeBlockBanner")?.textContent || "unknown"),
          );
        const deadline = Date.now() + 40000;
        let emptyBlocks = await queryEmpty();
        let stableHits = emptyBlocks.length === 0 ? 1 : 0;
        while (Date.now() < deadline && stableHits < 2) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          emptyBlocks = await queryEmpty();
          stableHits = emptyBlocks.length === 0 ? stableHits + 1 : 0;
        }
        expect(emptyBlocks, `"${text}" tab has empty code blocks: ${emptyBlocks.join(", ")}`).toEqual([]);
      }
    } finally {
      await browser.close();
    }
  }, 120000);
});

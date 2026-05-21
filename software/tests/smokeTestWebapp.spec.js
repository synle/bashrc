/** Smoke test for the webapp. Runs against WEBAPP_URL env var or the live site by default. */
import { describe, it, expect } from "vitest";

const WEBAPP_URL = process.env.WEBAPP_URL || "https://synle.github.io/bashrc/";
const TIMEOUT = 30000;

describe("webapp smoke test", () => {
  it(
    "phase 1 - site is alive and returns HTML",
    async () => {
      const res = await fetch(WEBAPP_URL);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("</html>");
      expect(html.length).toBeGreaterThan(100);
    },
    TIMEOUT,
  );

  it(
    "phase 2 - page loads and JS initializes",
    async () => {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({ headless: "new", args: ["--no-sandbox"] });
      try {
        const page = await browser.newPage();
        await page.goto(WEBAPP_URL, { waitUntil: "networkidle0", timeout: TIMEOUT });

        // wait for the app to render meaningful content
        await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
        const title = await page.$eval("h1", (el) => el.textContent);
        expect(title.toLowerCase()).toContain("bashrc");
      } finally {
        await browser.close();
      }
    },
    TIMEOUT,
  );

  it(
    "phase 3 - no JS errors on page",
    async () => {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({ headless: "new", args: ["--no-sandbox"] });
      try {
        const page = await browser.newPage();
        const jsErrors = [];
        page.on("pageerror", (err) => jsErrors.push(err.message));

        await page.goto(WEBAPP_URL, { waitUntil: "networkidle0", timeout: TIMEOUT });
        await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });

        // give a moment for any deferred errors
        await new Promise((r) => setTimeout(r, 2000));

        expect(jsErrors).toEqual([]);
      } finally {
        await browser.close();
      }
    },
    TIMEOUT,
  );

  it(
    "phase 4 - all expected navigation tabs are present",
    async () => {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({ headless: "new", args: ["--no-sandbox"] });
      try {
        const page = await browser.newPage();
        await page.goto(WEBAPP_URL, { waitUntil: "networkidle0", timeout: TIMEOUT });
        await page.waitForSelector('[data-testid="tab-navigation"]', { timeout: 10000 });

        const tabLabels = await page.$$eval('[data-testid="tab-navigation"] button', (buttons) =>
          buttons.map((b) => b.textContent.trim().toUpperCase()),
        );

        const expectedTabs = [
          "SETUP MAC",
          "SETUP WINDOWS",
          "SETUP UBUNTU",
          "SETUP REDHAT",
          "SETUP ARCH LINUX",
          "SETUP STEAMOS",
          "SETUP ANDROID TERMUX",
          "SETUP CHROMEOS",
          "SETUP MINGW64",
          "SETUP WSL",
          "SETUP LIGHTWEIGHT PROFILE",
          "SETUP ETC HOSTS",
          "TEST FULL RUN LIVE",
          "TEST CUSTOM RUN",
        ];

        for (const expected of expectedTabs) {
          expect(tabLabels, `Missing tab: "${expected}"`).toContain(expected);
        }

        expect(tabLabels.length).toBe(expectedTabs.length);
      } finally {
        await browser.close();
      }
    },
    TIMEOUT,
  );

  it("phase 5 - links in code block banners should open in new tabs", async () => {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({ headless: "new", args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage();
      await page.goto(WEBAPP_URL, { waitUntil: "networkidle0", timeout: TIMEOUT });
      await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
      // Wait for the actual end-state (banner links rendered) instead of waitForNetworkIdle —
      // the latter regressed in puppeteer-core 24.42 against this webapp's continual fetches.
      await page.waitForFunction(
        () => {
          const blocks = document.querySelectorAll('[data-testid="code-block"]');
          if (blocks.length === 0) return false;
          const visibleLinks = [...document.querySelectorAll('[data-testid="code-block"] a[target="_blank"]')].filter(
            (a) => a.offsetParent !== null,
          );
          return visibleLinks.length > 0;
        },
        { timeout: 30000 },
      );

      // All banner links should have target="_blank" for new-tab behavior
      const allBlank = await page.$$eval('[data-testid="code-block"] a[target="_blank"]', (links) =>
        links.filter((a) => a.offsetParent !== null).every((a) => a.target === "_blank"),
      );
      expect(allBlank).toBe(true);
    } finally {
      await browser.close();
    }
  }, 60000); // Larger timeout: phase 5 performs a goto networkidle0 + a waitForFunction (each up to 30s).

  it(
    "phase 6 - copy button triggers clipboard copy and shows alert modal",
    async () => {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({ headless: "new", args: ["--no-sandbox"] });
      try {
        const context = browser.defaultBrowserContext();
        await context.overridePermissions(WEBAPP_URL, ["clipboard-read", "clipboard-write"]);

        const page = await browser.newPage();
        await page.goto(WEBAPP_URL, { waitUntil: "networkidle0", timeout: TIMEOUT });
        await page.waitForSelector('[data-testid="code-block"][data-collapsed="false"] [data-testid="copy-button"]', { timeout: 10000 });

        // Click the first visible copy button
        await page.click('[data-testid="code-block"][data-collapsed="false"] [data-testid="copy-button"]');

        // Wait for the alert modal to appear
        await page.waitForSelector('[data-testid="alert-ok"]', { timeout: 5000 });
        const modalText = await page.$eval('[data-testid="alert-message"]', (el) => el.textContent);
        expect(modalText).toContain("Copied to clipboard");

        // Dismiss the modal
        await page.click('[data-testid="alert-ok"]');
        await page.waitForFunction(() => !document.querySelector('[data-testid="alert-ok"]'), { timeout: 3000 });
      } finally {
        await browser.close();
      }
    },
    TIMEOUT,
  );

  it(
    "phase 7 - fullscreen modal opens with copy and close buttons",
    async () => {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({ headless: "new", args: ["--no-sandbox"] });
      try {
        const page = await browser.newPage();
        await page.goto(WEBAPP_URL, { waitUntil: "networkidle0", timeout: TIMEOUT });
        await page.waitForSelector('[data-testid="code-block"][data-collapsed="false"] [data-testid="fullscreen-button"]', {
          timeout: 10000,
        });

        // Click the first visible fullscreen button
        await page.click('[data-testid="code-block"][data-collapsed="false"] [data-testid="fullscreen-button"]');

        // Wait for the fullscreen modal to appear
        await page.waitForSelector('[data-testid="fullscreen-dialog"]', { timeout: 5000 });

        // Verify copy and close buttons exist in the modal
        const modalCopyBtn = await page.$('[data-testid="fullscreen-copy"]');
        const modalCloseBtn = await page.$('[data-testid="fullscreen-close"]');
        expect(modalCopyBtn).toBeTruthy();
        expect(modalCloseBtn).toBeTruthy();

        // Verify the modal contains code content
        const hasCode = await page.$eval('[data-testid="fullscreen-dialog"] .prism-code-block', (el) => el.textContent.trim().length > 0);
        expect(hasCode).toBe(true);

        // Close the modal
        await page.click('[data-testid="fullscreen-close"]');
        await page.waitForFunction(() => !document.querySelector('[data-testid="fullscreen-dialog"]'), { timeout: 3000 });
      } finally {
        await browser.close();
      }
    },
    TIMEOUT,
  );

  it(
    "phase 8 - fullscreen modal copy button works",
    async () => {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({ headless: "new", args: ["--no-sandbox"] });
      try {
        const context = browser.defaultBrowserContext();
        await context.overridePermissions(WEBAPP_URL, ["clipboard-read", "clipboard-write"]);

        const page = await browser.newPage();
        await page.goto(WEBAPP_URL, { waitUntil: "networkidle0", timeout: TIMEOUT });
        await page.waitForSelector('[data-testid="code-block"][data-collapsed="false"] [data-testid="fullscreen-button"]', {
          timeout: 10000,
        });

        // Open fullscreen modal
        await page.click('[data-testid="code-block"][data-collapsed="false"] [data-testid="fullscreen-button"]');
        await page.waitForSelector('[data-testid="fullscreen-copy"]', { timeout: 5000 });

        // Click copy in the modal
        await page.click('[data-testid="fullscreen-copy"]');

        // Wait for the alert modal
        await page.waitForSelector('[data-testid="alert-ok"]', { timeout: 5000 });
        const modalText = await page.$eval('[data-testid="alert-message"]', (el) => el.textContent);
        expect(modalText).toContain("Copied to clipboard");

        // Dismiss alert
        await page.click('[data-testid="alert-ok"]');
      } finally {
        await browser.close();
      }
    },
    TIMEOUT,
  );

  it(
    "phase 9 - collapse and expand code blocks",
    async () => {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({ headless: "new", args: ["--no-sandbox"] });
      try {
        const page = await browser.newPage();
        await page.goto(WEBAPP_URL, { waitUntil: "networkidle0", timeout: TIMEOUT });
        await page.waitForSelector('[data-testid="code-block"][data-collapsed="false"] [data-testid="collapse-toggle"]', {
          timeout: 10000,
        });

        // Count initially expanded blocks
        const initialExpanded = await page.$$eval('[data-testid="code-block"][data-collapsed="false"]', (els) => els.length);
        expect(initialExpanded).toBeGreaterThan(0);

        // Click collapse on the first expanded block
        await page.click('[data-testid="code-block"][data-collapsed="false"] [data-testid="collapse-toggle"]');
        await new Promise((r) => setTimeout(r, 500));

        // That block should now be collapsed
        const afterCollapse = await page.$$eval('[data-testid="code-block"][data-collapsed="false"]', (els) => els.length);
        expect(afterCollapse).toBeLessThan(initialExpanded);

        // Click the same toggle to expand it back
        await page.click('[data-testid="code-block"][data-collapsed="true"] [data-testid="collapse-toggle"]');
        await new Promise((r) => setTimeout(r, 500));

        const afterExpand = await page.$$eval('[data-testid="code-block"][data-collapsed="false"]', (els) => els.length);
        expect(afterExpand).toBe(initialExpanded);
      } finally {
        await browser.close();
      }
    },
    TIMEOUT,
  );

  it(
    "phase 10 - global collapse/expand button toggles all blocks",
    async () => {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({ headless: "new", args: ["--no-sandbox"] });
      try {
        const page = await browser.newPage();
        await page.goto(WEBAPP_URL, { waitUntil: "networkidle0", timeout: TIMEOUT });
        await page.waitForSelector('[data-testid="global-collapse"]', { timeout: 10000 });

        // Click global collapse
        await page.click('[data-testid="global-collapse"]');
        await new Promise((r) => setTimeout(r, 1000));

        // All blocks should be collapsed
        const expandedAfterCollapse = await page.$$eval('[data-testid="code-block"][data-collapsed="false"]', (els) => els.length);
        expect(expandedAfterCollapse).toBe(0);

        // Click global expand
        await page.click('[data-testid="global-collapse"]');
        await new Promise((r) => setTimeout(r, 1000));

        // Blocks should be expanded again
        const expandedAfterExpand = await page.$$eval('[data-testid="code-block"][data-collapsed="false"]', (els) => els.length);
        expect(expandedAfterExpand).toBeGreaterThan(0);
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

import { describe, it, expect } from "vitest";

import { WEBAPP_URL } from "./urls.js";
import { COMMAND_SELECTOR } from "./commands.helpers.js";

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
        // This ordered snapshot describes a Mac browser, not the runner\'s host OS.
        await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, "platform", { get: () => "MacIntel" }));
        await page.goto(WEBAPP_URL, { waitUntil: "networkidle0", timeout: TIMEOUT });
        await page.waitForSelector('[data-testid="tab-navigation"]', { timeout: 10000 });

        const tabLabels = await page.$$eval(COMMAND_SELECTOR, (buttons) => buttons.map((button) => button.textContent.trim()));
        expect(tabLabels).toHaveLength(15);
        expect(tabLabels).toMatchInlineSnapshot(`
          [
            "Setup Mac",
            "Setup Windows",
            "Setup Ubuntu",
            "Setup Redhat",
            "Setup Arch Linux",
            "Setup Steamos",
            "Setup Android",
            "Setup Chromeos",
            "Setup Mingw64",
            "Setup WSL",
            "TV - FireTV",
            "Setup Lightweight Profile",
            "Setup Etc Hosts",
            "Test Full Run live",
            "Test Custom Run",
          ]
        `);
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
      // Wait for the actual end-state (banner links rendered) instead of waitForNetworkIdle \u2014
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
  }, 60000);

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
        await page.waitForSelector('[data-testid="code-block"] [data-testid="copy-button"]', { timeout: 10000 });

        // Click the first visible copy button
        await page.click('[data-testid="code-block"] [data-testid="copy-button"]');

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
        await page.waitForSelector('[data-testid="code-block"] [data-testid="fullscreen-button"]', {
          timeout: 10000,
        });

        // Click the first visible fullscreen button
        await page.click('[data-testid="code-block"] [data-testid="fullscreen-button"]');

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
        await page.waitForSelector('[data-testid="code-block"] [data-testid="fullscreen-button"]', {
          timeout: 10000,
        });

        // Open fullscreen modal
        await page.click('[data-testid="code-block"] [data-testid="fullscreen-button"]');
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
    "phase 9 - expand a collapsed code block via Show More",
    async () => {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({ headless: "new", args: ["--no-sandbox"] });
      try {
        const page = await browser.newPage();
        await page.goto(WEBAPP_URL, { waitUntil: "networkidle0", timeout: TIMEOUT });
        // Blocks default to collapsed; long blocks render a Show More link.
        await page.waitForSelector('[data-testid="code-block"][data-collapsed="true"] [data-testid="show-more-toggle"]', {
          timeout: 10000,
        });

        const initialCollapsed = await page.$$eval('[data-testid="code-block"][data-collapsed="true"]', (els) => els.length);
        expect(initialCollapsed).toBeGreaterThan(0);

        // Click Show More on the first collapsed block to expand it.
        await page.click('[data-testid="code-block"][data-collapsed="true"] [data-testid="show-more-toggle"]');
        await page.waitForFunction(
          (collapsedCount) => document.querySelectorAll('[data-testid="code-block"][data-collapsed="true"]').length < collapsedCount,
          { timeout: 10000 },
          initialCollapsed,
        );

        const afterExpand = await page.$$eval('[data-testid="code-block"][data-collapsed="true"]', (els) => els.length);
        expect(afterExpand).toBeLessThan(initialCollapsed);
      } finally {
        await browser.close();
      }
    },
    TIMEOUT,
  );
});

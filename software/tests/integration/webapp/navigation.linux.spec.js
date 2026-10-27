/** Ordered navigation follows the explicit browser platform rather than the test runner host. */
import { describe, expect, it } from "vitest";
import { COMMAND_SELECTOR, commandBrowser } from "./commands.helpers.js";

/** Existing shared browser fixture pins Linux before application code loads. */
const browser = commandBrowser();

describe("platform-specific navigation", () => {
  it("keeps Ubuntu first for a Linux browser", async () => {
    const labels = await browser.page.$$eval(COMMAND_SELECTOR, (buttons) => buttons.map((button) => button.textContent.trim()));
    expect(labels).toHaveLength(15);
    expect(labels).toMatchInlineSnapshot(`
      [
        "Setup Ubuntu",
        "Setup Windows",
        "Setup Mac",
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
  });
});

/** Real application DOM mutations prove fingerprints observe labels, text, titles, links, and missing children. */
import { afterEach, describe, expect, it } from "vitest";
import { COMMAND_SELECTOR, commandBrowser, readCommand, selectCommand } from "./commands.helpers.js";

/** Private browser state is reloaded after every mutation, including assertion failures. */
const browser = commandBrowser();
afterEach(async () => {
  if (browser.page) await browser.page.reload({ waitUntil: "networkidle0", timeout: 60000 });
}, 60000);

describe("browser fingerprint sensitivity", () => {
  it("observes a changed command label", async () => {
    const before = await browser.page.$$eval(COMMAND_SELECTOR, (buttons) => buttons.map((button) => button.textContent.trim()));
    await browser.page.$eval(COMMAND_SELECTOR, (button) => {
      button.textContent = "Changed command";
    });
    const after = await browser.page.$$eval(COMMAND_SELECTOR, (buttons) => buttons.map((button) => button.textContent.trim()));
    expect(after[0]).toBe("Changed command");
    expect(after).not.toEqual(before);
  });

  it("observes a changed block title", async () => {
    await selectCommand(browser.page, "command-option-setup-mac");
    await browser.page.$eval("#mainBodyContainer .codeBlockBanner > div:first-child", (banner) => {
      banner.textContent = "changed-title";
    });
    expect((await readCommand(browser.page)).blocks[1].title).toBe("changed-title");
  });

  it("hashes trimmed visible innerText rather than hidden text or markup", async () => {
    await selectCommand(browser.page, "command-option-setup-mac");
    await browser.page.$eval("#mainBodyContainer .codeBlockWrapper", (block) => {
      block.innerHTML = '  abc  <span style="display:none">hidden</span>';
    });
    expect((await readCommand(browser.page)).blocks[1].hash).toBe("900150983cd24fb0d6963f7d28e17f72");
  });

  it("preserves literal relative URLs and trimmed visible link labels", async () => {
    await selectCommand(browser.page, "command-option-setup-mac");
    await browser.page.$eval("#mainBodyContainer .link-group a", (link) => {
      link.textContent = "  Raw link  ";
      link.setAttribute("href", "../raw-link?value=1");
    });
    expect((await readCommand(browser.page)).blocks[13].links[0]).toEqual({ title: "RAW LINK", hash: "../raw-link?value=1" });
  });

  it("observes a missing direct main-body child", async () => {
    await selectCommand(browser.page, "command-option-setup-mac");
    expect((await readCommand(browser.page)).blocks).toHaveLength(14);
    await browser.page.$eval("#mainBodyContainer", (body) => body.firstElementChild.remove());
    expect((await readCommand(browser.page)).blocks).toHaveLength(13);
  });
});

/** Real browser fingerprints for the Setup Steamos command and every direct body child. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { commandBrowser, selectCommand } from "./commands.helpers.js";

/** Own source served from this checkout so unpublished edits cannot fingerprint a different remote revision. */
const STEAMOS_SETUP_PATH = "software/scripts/steamos/setup.bash";

/** A dedicated browser session prevents command state leaking across spec files. */
const browser = commandBrowser();

describe("command snapshots", () => {
  it("Setup Steamos keeps its current block titles, content, links, and count", async () => {
    const source = readFileSync(STEAMOS_SETUP_PATH, "utf8");
    const requestErrors = [];
    await browser.page.setRequestInterception(true);
    // Keep the real renderer and all other downloads; only this owned source comes from the checked-out revision.
    browser.page.on("request", (request) => {
      const response = request.url().endsWith(`/${STEAMOS_SETUP_PATH}`)
        ? request.respond({ status: 200, contentType: "text/plain", headers: { "access-control-allow-origin": "*" }, body: source })
        : request.continue();
      response.catch((error) => requestErrors.push(error.message));
    });
    const { blocks, errors } = await selectCommand(browser.page, "command-option-setup-steamos", [STEAMOS_SETUP_PATH]);
    expect(requestErrors).toEqual([]);
    expect(blocks).toHaveLength(15);
    expect(blocks.slice(0, 2).map((block) => block.title)).toEqual(["software/scripts/steamos/setup.bash", "software/bootstrap/setup.sh"]);
    expect(errors).toMatchInlineSnapshot(`[]`);
    // The full source is checked below; formatter versions may change hidden-line counts without changing this preview.
    // For hash-only failures, inspect the changed source first; do not accept unexpected content, links, or UI changes.
    // Refresh: npm run test:integration:local -- --update=all software/tests/integration/webapp/commands.steamos.spec.js
    // Verify: npm run test:integration:local -- software/tests/integration/webapp/commands.steamos.spec.js
    // Review every snapshot change; a different hash alone does not prove that the new output is correct.
    expect(blocks).toMatchInlineSnapshot(`
      [
        {
          "hash": "274273ad07625221746b0a4d73f05cf3",
          "title": "software/scripts/steamos/setup.bash",
        },
        {
          "hash": "8a9089acc4c542727e43734581c5ad35",
          "title": "software/bootstrap/setup.sh",
        },
        {
          "hash": "7a2570d84a170b0c465e5ae49eded2cb",
          "title": "docs/linux/README.md",
        },
        {
          "hash": "49eb01626020a5e57936610df8b31abc",
          "title": "assets/fonts/install.sh",
        },
        {
          "hash": "d2f652c3439ccc972d9d0281927f0ab0",
          "title": ".build/gitconfig",
        },
        {
          "hash": "eda1482576eb6a03f03bc1595d4b1a49",
          "title": ".build/gitignore_global",
        },
        {
          "hash": "e98cc6b5031ea77aea61eb3d61aa8465",
          "title": ".build/ssh-config",
        },
        {
          "hash": "68b9dca4ae448b2dee02586add3c63c1",
          "title": ".build/inputrc",
        },
        {
          "hash": "f511a4b5a468733093d4b99faa0ef7c8",
          "title": ".build/vimrc",
        },
        {
          "hash": "94d83862edede417a2c58712e6f75a49",
          "title": "docs/android/sponsorblock.json",
        },
        {
          "hash": "aa0f1cfb6f25c3cb9ae491f96c2d01cf",
          "title": "docs/game-streaming-moonlight-steamlink.md",
        },
        {
          "hash": "ebcc7cb095f96a8457a749384ddfad8b",
          "title": ".build/sublime-text-setup",
        },
        {
          "hash": "142be3e09289b0f368d5133c2b49d890",
          "title": ".build/sublime-text-ext",
        },
        {
          "hash": "5964e9e48678142d89473bcca6479794",
          "title": "OTHER APPLICATIONS",
        },
        {
          "links": [
            {
              "hash": "https://github.com/synle/bashrc/blob/main/fonts",
              "title": "CUSTOM FONTS",
            },
            {
              "hash": "font-preview.html",
              "title": "FONT PREVIEW",
            },
            {
              "hash": "https://www.sublimetext.com/download",
              "title": "SUBLIME TEXT",
            },
            {
              "hash": "https://www.sublimemerge.com/download",
              "title": "SUBLIME MERGE",
            },
            {
              "hash": "https://www.charlesproxy.com/download/latest-release/",
              "title": "CHARLES PROXY",
            },
            {
              "hash": "https://ultimaker.com/software/ultimaker-cura/#links",
              "title": "ULTIMAKER CURA",
            },
            {
              "hash": "https://design.cricut.com/#/",
              "title": "CRICUT DESIGN SPACE",
            },
            {
              "hash": "https://download.battle.net/en-us/?product=bnetdesk",
              "title": "BATTLE NET",
            },
          ],
          "title": "link-group",
        },
      ]
    `);
    await browser.page.$$eval(
      ".codeBlockWrapper",
      (wrappers, title) => {
        const wrapper = wrappers.find((node) => node.querySelector(".codeBlockBanner > div:first-child")?.textContent.trim() === title);
        wrapper.querySelector(".codeBlockShowMore").click();
      },
      STEAMOS_SETUP_PATH,
    );
    await expect
      .poll(
        () =>
          browser.page.$$eval(
            ".codeBlockWrapper",
            (wrappers, title) => {
              const wrapper = wrappers.find(
                (node) => node.querySelector(".codeBlockBanner > div:first-child")?.textContent.trim() === title,
              );
              return wrapper.querySelector(".prism-code-block").textContent;
            },
            STEAMOS_SETUP_PATH,
          ),
        { timeout: 10000 },
      )
      .toBe(source.trim());
  }, 90000);
});

/** doWork tests for software/scripts/advanced/browser-launchers.js. */
import { describe, it, expect } from "vitest";
import { fileSystem, runScript, getIndexConstant } from "../../setup.js";

const BASH_SYLE_PATH = getIndexConstant("BASH_SYLE_PATH");

describe("advanced/browser-launchers.js doWork", () => {
  it("should register Brave launcher profile block", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/browser-launchers.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("Browser Launchers - Brave");
    expect(profile).toContain("_BRAVE_PATHS");
  });

  it("should register Chrome launcher profile block", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/browser-launchers.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("Browser Launchers - Chrome");
    expect(profile).toContain("_CHROME_PATHS");
  });

  it("should register Edge launcher profile block", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/browser-launchers.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("Browser Launchers - Edge");
    expect(profile).toContain("_EDGE_PATHS");
  });

  it("should register Chromium launcher profile block", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/browser-launchers.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("Browser Launchers - Chromium");
    expect(profile).toContain("_CHROMIUM_PATHS");
  });

  it("should register Vivaldi launcher profile block", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/browser-launchers.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("Browser Launchers - Vivaldi");
    expect(profile).toContain("_VIVALDI_PATHS");
  });

  it("should register Opera launcher profile block", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/browser-launchers.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("Browser Launchers - Opera");
    expect(profile).toContain("_OPERA_PATHS");
  });

  it("should register Arc launcher profile block", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/browser-launchers.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("Browser Launchers - Arc");
    expect(profile).toContain("_ARC_PATHS");
  });

  it("should define brave() wrapper and reference run_browser in Brave block", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/browser-launchers.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("brave()");
    expect(profile).toContain(`run_browser "brave"`);
  });
});

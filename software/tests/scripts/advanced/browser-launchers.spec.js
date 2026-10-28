/** doWork tests for software/scripts/advanced/browser-launchers.js. */
import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { fileSystem, getIndexConstant, runScript, setSandboxGlobal } from "../../setup.js";

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

  it("adds VA-API video decoding only to Linux launch options", async () => {
    fileSystem[BASH_SYLE_PATH] = "";
    const osFlags = [
      "is_os_mac",
      "is_os_windows",
      "is_os_mingw64",
      "is_os_android_termux",
      "is_os_ubuntu",
      "is_os_arch_linux",
      "is_os_steamos",
      "is_os_redhat",
      "is_os_chromeos",
    ];
    const previousFlags = Object.fromEntries(osFlags.map((flag) => [flag, getIndexConstant(flag)]));

    try {
      for (const flag of osFlags) setSandboxGlobal(flag, 0);
      setSandboxGlobal("is_os_ubuntu", 1);
      await runScript("software/scripts/advanced/browser-launchers.js");

      const profile = fileSystem[BASH_SYLE_PATH];
      expect(profile).toContain('"--enable-features=VaapiVideoDecoder" # Enables hardware video decoding on Linux.');
    } finally {
      for (const [flag, value] of Object.entries(previousFlags)) setSandboxGlobal(flag, value);
    }
  });

  it("shares documented launch options and keeps the unsafe debug flag commented", async () => {
    fileSystem[BASH_SYLE_PATH] = "";

    await runScript("software/scripts/advanced/browser-launchers.js");

    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("_BROWSER_COMMON_ARGS=(");
    expect(profile).toContain("_CHROME_LAUNCH_OPTIONS=(");
    expect(profile).toContain("_BRAVE_LAUNCH_OPTIONS=(");
    expect(profile).toContain("_EDGE_LAUNCH_OPTIONS=(");
    expect(profile).toContain('"--disable-breakpad" # Disables crash reporting.');
    expect(profile).toContain('"--no-pings" # Disables hyperlink-auditing pings.');
    expect(profile).toContain('"--enable-gpu-rasterization" # Rasterizes page content on the GPU.');
    expect(profile).toContain('"--enable-zero-copy" # Enables zero-copy GPU raster uploads.');
    expect(profile).toContain(
      '"--ignore-gpu-blocklist" # Forces GPU acceleration on blocked hardware; this can cause glitches on some systems.',
    );
    expect(profile).toContain('"--disk-cache-size=1073741824" # Sets the disk cache size to 1 GB.');
    expect(profile).toContain('"--disable-brave-rewards-extension" # Brave only: disables the Brave Rewards extension.');
    expect(profile).toContain("msUndersideButton,msEdgeSidebarV2");
    expect(profile).toContain('# "--disable-web-security" # Local testing/debugging only:');
    expect(profile).not.toContain('\n  "--disable-web-security"');

    const syntax = spawnSync("/bin/bash", ["-n"], { input: profile, encoding: "utf8" });
    expect(syntax.status, syntax.stderr).toBe(0);
  });
});

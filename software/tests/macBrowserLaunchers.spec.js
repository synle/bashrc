/** Mac flags-only browser app deployment regression checks. */
import { spawnSync } from "child_process";
import { describe, expect, it } from "vitest";
import {
  fileSystem,
  getIndexConstant,
  mockExecCommands,
  mockFsDirEntries,
  mockFsExistence,
  runScript,
  setMockExecSyncReturn,
} from "./setup.js";

const BASH_SYLE_PATH = getIndexConstant("BASH_SYLE_PATH");
const SIGNING_MARKER = "BROWSER_FLAGS_APP_SIGNED";

/**
 * Adds installed browser bundle fixtures to the mocked Mac filesystem.
 * @param {{bundleName: string, executableName: string}[]} browsers - Installed app bundles to expose.
 * @returns {void}
 */
function installBrowserFixtures(browsers) {
  mockFsDirEntries["/Applications"] = browsers.map(({ bundleName }) => ({
    name: bundleName,
    isDirectory: () => true,
    isFile: () => false,
  }));

  for (const { bundleName, executableName } of browsers) {
    const bundlePath = `/Applications/${bundleName}`;
    const executablePath = `${bundlePath}/Contents/MacOS/${executableName}`;
    const iconPath = `${bundlePath}/Contents/Resources/app.icns`;
    fileSystem[`${bundlePath}/Contents/Info.plist`] =
      `<plist><dict><key>CFBundleExecutable</key><string>${executableName}</string><key>CFBundleIconFile</key><string>app.icns</string></dict></plist>`;
    mockFsExistence[executablePath] = true;
    mockFsExistence[iconPath] = true;
  }
}

describe("Mac flags-only browser launchers", () => {
  it("creates signed apps with inferred binaries, shared options, and browser icons", async () => {
    installBrowserFixtures([
      { bundleName: "Brave Browser.app", executableName: "Brave Browser" },
      { bundleName: "Google Chrome.app", executableName: "Google Chrome" },
      { bundleName: "Microsoft Edge.app", executableName: "Microsoft Edge" },
    ]);
    setMockExecSyncReturn(SIGNING_MARKER);

    await runScript("software/scripts/mac/_only.js");

    const braveLauncher = fileSystem["/Applications/Brave With Flags.app/Contents/MacOS/launcher"];
    const chromeLauncher = fileSystem["/Applications/Chrome With Flags.app/Contents/MacOS/launcher"];
    const edgeLauncher = fileSystem["/Applications/Edge With Flags.app/Contents/MacOS/launcher"];
    expect(braveLauncher).toContain("exec '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'");
    expect(chromeLauncher).toContain("exec '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'");
    expect(edgeLauncher).toContain("exec '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'");
    expect(chromeLauncher).toContain("'--disk-cache-size=1073741824' # Sets the disk cache size to 1 GB.");
    expect(chromeLauncher).toContain("'--no-pings' # Disables hyperlink-auditing pings.");
    expect(braveLauncher).toContain("'--disable-brave-rewards-extension' # Brave only:");
    expect(edgeLauncher).toContain("msUndersideButton,msEdgeSidebarV2");
    expect(chromeLauncher).toContain("# '--disable-web-security' # Local testing/debugging only:");
    expect(chromeLauncher).not.toMatch(/^\s+'--disable-web-security'/m);
    expect(fileSystem["/Applications/Chrome With Flags.app/Contents/Info.plist"]).toContain("local.synle.chrome-with-flags");
    expect(fileSystem["/Applications/Chrome With Flags.app/Contents/Info.plist"]).toContain(
      "<key>CFBundleIconFile</key><string>app.icns</string>",
    );
    expect(fileSystem["/Applications/Chrome With Flags.app/Contents/Resources/app.icns"]).toBeDefined();
    expect(mockExecCommands.filter((command) => command.includes("codesign --force --sign -"))).toHaveLength(3);

    const syntax = spawnSync("/bin/bash", ["-n"], { input: chromeLauncher, encoding: "utf8" });
    expect(syntax.status, syntax.stderr).toBe(0);
    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("function brave()");
    expect(profile).toContain("function chrome()");
    expect(profile).toContain("function edge()");
    expect(profile).toContain('open "$launcher_app" --args "$@"');
    expect(profile).toContain('echo "Error: $display_name browser not installed." >&2');
    expect(profile).toContain("'/Applications/Chrome With Flags.app' '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'");
    const profileSyntax = spawnSync("/bin/bash", ["-n"], { input: profile, encoding: "utf8" });
    expect(profileSyntax.status, profileSyntax.stderr).toBe(0);
    expect(profile).not.toContain("alias brave=");
    expect(profile).not.toContain("alias chrome=");
    expect(profile).not.toContain("alias edge=");
  });

  it("skips launcher apps for browsers that are not installed", async () => {
    installBrowserFixtures([{ bundleName: "Google Chrome.app", executableName: "Google Chrome" }]);
    setMockExecSyncReturn(SIGNING_MARKER);

    await runScript("software/scripts/mac/_only.js");

    expect(fileSystem["/Applications/Chrome With Flags.app/Contents/MacOS/launcher"]).toContain("Google Chrome.app");
    expect(fileSystem["/Applications/Brave With Flags.app/Contents/MacOS/launcher"]).toBeUndefined();
    expect(fileSystem["/Applications/Edge With Flags.app/Contents/MacOS/launcher"]).toBeUndefined();
    expect(fileSystem[BASH_SYLE_PATH]).toContain("'/Applications/Brave With Flags.app' ''");
    expect(mockExecCommands.filter((command) => command.includes("codesign --force --sign -"))).toHaveLength(1);
  });
});

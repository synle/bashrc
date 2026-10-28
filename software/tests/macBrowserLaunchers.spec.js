/** Mac browser app launcher deployment and migration regression checks. */
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
const APP_ACTION_MARKER = "BROWSER_FLAGS_APP_ACTION_OK";

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

/**
 * Adds a previous managed app fixture for migration tests.
 * @param {string} appName - Legacy app bundle name without the .app suffix.
 * @param {string} bundleIdentifier - Expected legacy bundle identifier.
 * @param {string} [launcherContent] - Launcher body used to verify ownership.
 * @returns {string} Legacy app bundle path.
 */
function installLegacyBrowserLauncherFixture(
  appName,
  bundleIdentifier,
  launcherContent = "#!/bin/bash\n# Managed flags-only launcher; regular browser app remains unchanged.",
) {
  const appPath = `/Applications/${appName}.app`;
  const launcherPath = `${appPath}/Contents/MacOS/launcher`;
  mockFsExistence[appPath] = true;
  mockFsExistence[launcherPath] = true;
  fileSystem[`${appPath}/Contents/Info.plist`] =
    `<plist><dict><key>CFBundleIdentifier</key><string>${bundleIdentifier}</string></dict></plist>`;
  fileSystem[launcherPath] = launcherContent;
  return appPath;
}

describe("Mac browser app launchers", () => {
  it("creates signed Browser apps with inferred binaries, shared options, and browser icons", async () => {
    installBrowserFixtures([
      { bundleName: "Brave Browser.app", executableName: "Brave Browser" },
      { bundleName: "Google Chrome.app", executableName: "Google Chrome" },
      { bundleName: "Microsoft Edge.app", executableName: "Microsoft Edge" },
    ]);
    setMockExecSyncReturn(APP_ACTION_MARKER);

    await runScript("software/scripts/mac/_only.js");

    const braveLauncher = fileSystem["/Applications/Browser Brave.app/Contents/MacOS/launcher"];
    const chromeLauncher = fileSystem["/Applications/Browser Chrome.app/Contents/MacOS/launcher"];
    const edgeLauncher = fileSystem["/Applications/Browser Edge.app/Contents/MacOS/launcher"];
    expect(braveLauncher).toContain("exec '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'");
    expect(chromeLauncher).toContain("exec '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'");
    expect(edgeLauncher).toContain("exec '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'");
    expect(chromeLauncher).toContain("'--disk-cache-size=1073741824' # Sets the disk cache size to 1 GB.");
    expect(chromeLauncher).toContain("'--no-pings' # Disables hyperlink-auditing pings.");
    expect(braveLauncher).toContain("'--disable-brave-rewards-extension' # Brave only:");
    expect(edgeLauncher).toContain("msUndersideButton,msEdgeSidebarV2");
    expect(chromeLauncher).toContain("# '--disable-web-security' # Local testing/debugging only:");
    expect(chromeLauncher).not.toMatch(/^\s+'--disable-web-security'/m);
    expect(fileSystem["/Applications/Browser Chrome.app/Contents/Info.plist"]).toContain("local.synle.browser-chrome");
    expect(fileSystem["/Applications/Browser Chrome.app/Contents/Info.plist"]).toContain(
      "<key>CFBundleIconFile</key><string>app.icns</string>",
    );
    expect(fileSystem["/Applications/Browser Chrome.app/Contents/Resources/app.icns"]).toBeDefined();
    expect(mockExecCommands.filter((command) => command.includes("codesign --force --sign -"))).toHaveLength(3);

    const syntax = spawnSync("/bin/bash", ["-n"], { input: chromeLauncher, encoding: "utf8" });
    expect(syntax.status, syntax.stderr).toBe(0);
    const profile = fileSystem[BASH_SYLE_PATH];
    expect(profile).toContain("function brave()");
    expect(profile).toContain("function chrome()");
    expect(profile).toContain("function edge()");
    expect(profile).toContain('open "$launcher_app" --args "$@"');
    expect(profile).toContain('echo "Error: $display_name browser not installed." >&2');
    expect(profile).toContain("'/Applications/Browser Chrome.app' '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'");
    const profileSyntax = spawnSync("/bin/bash", ["-n"], { input: profile, encoding: "utf8" });
    expect(profileSyntax.status, profileSyntax.stderr).toBe(0);
    expect(profile).not.toContain("alias brave=");
    expect(profile).not.toContain("alias chrome=");
    expect(profile).not.toContain("alias edge=");
  });

  it("removes recognized legacy apps only after all Browser replacements sign", async () => {
    installBrowserFixtures([
      { bundleName: "Brave Browser.app", executableName: "Brave Browser" },
      { bundleName: "Google Chrome.app", executableName: "Google Chrome" },
      { bundleName: "Microsoft Edge.app", executableName: "Microsoft Edge" },
    ]);
    const legacyAppPaths = [
      installLegacyBrowserLauncherFixture("Brave With Flags", "local.synle.brave-with-flags"),
      installLegacyBrowserLauncherFixture("Chrome With Flags", "local.synle.chrome-with-flags"),
      installLegacyBrowserLauncherFixture("Edge With Flags", "local.synle.edge-with-flags"),
    ];
    setMockExecSyncReturn(APP_ACTION_MARKER);

    await runScript("software/scripts/mac/_only.js");

    expect(fileSystem["/Applications/Browser Brave.app/Contents/MacOS/launcher"]).toContain("Brave Browser.app");
    expect(fileSystem["/Applications/Browser Chrome.app/Contents/MacOS/launcher"]).toContain("Google Chrome.app");
    expect(fileSystem["/Applications/Browser Edge.app/Contents/MacOS/launcher"]).toContain("Microsoft Edge.app");
    expect(mockExecCommands.filter((command) => command.includes("command rm -rf"))).toEqual([
      `command rm -rf '${legacyAppPaths[0]}' && test ! -e '${legacyAppPaths[0]}' && printf '%s' '${APP_ACTION_MARKER}'`,
      `command rm -rf '${legacyAppPaths[1]}' && test ! -e '${legacyAppPaths[1]}' && printf '%s' '${APP_ACTION_MARKER}'`,
      `command rm -rf '${legacyAppPaths[2]}' && test ! -e '${legacyAppPaths[2]}' && printf '%s' '${APP_ACTION_MARKER}'`,
    ]);
  });

  it("leaves a same-named app untouched when its bundle identity is not managed", async () => {
    installBrowserFixtures([{ bundleName: "Google Chrome.app", executableName: "Google Chrome" }]);
    const legacyAppPath = installLegacyBrowserLauncherFixture("Chrome With Flags", "local.example.chrome-with-flags", "User launcher");
    setMockExecSyncReturn(APP_ACTION_MARKER);

    await runScript("software/scripts/mac/_only.js");

    expect(fileSystem[`${legacyAppPath}/Contents/MacOS/launcher`]).toBe("User launcher");
    expect(mockExecCommands.some((command) => command.includes(`command rm -rf '${legacyAppPath}'`))).toBe(false);
  });

  it("skips launcher apps and keeps legacy bundles when browsers are not installed", async () => {
    installBrowserFixtures([{ bundleName: "Google Chrome.app", executableName: "Google Chrome" }]);
    const legacyAppPath = installLegacyBrowserLauncherFixture("Brave With Flags", "local.synle.brave-with-flags");
    setMockExecSyncReturn(APP_ACTION_MARKER);

    await runScript("software/scripts/mac/_only.js");

    expect(fileSystem["/Applications/Browser Chrome.app/Contents/MacOS/launcher"]).toContain("Google Chrome.app");
    expect(fileSystem["/Applications/Browser Brave.app/Contents/MacOS/launcher"]).toBeUndefined();
    expect(fileSystem["/Applications/Browser Edge.app/Contents/MacOS/launcher"]).toBeUndefined();
    expect(fileSystem[`${legacyAppPath}/Contents/MacOS/launcher`]).toContain("Managed flags-only launcher");
    expect(mockExecCommands.some((command) => command.includes(`command rm -rf '${legacyAppPath}'`))).toBe(false);
  });
});

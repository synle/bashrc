/** Platform tweaks for macOS - registers Mac profile, Homebrew paths, and shell config. */
// SOURCE software/scripts/advanced/browser-launch-options.common.js

/** Browser app bundles used to resolve each installed executable and create a signed flags-only launcher. */
const _MAC_BROWSER_LAUNCHER_APPS = [
  {
    command: "brave",
    displayName: "Brave",
    bundlePattern: /^Brave.*Browser\.app$/i,
    appName: "Browser Brave",
    bundleIdentifier: "local.synle.browser-brave",
    legacyAppName: "Brave With Flags",
    legacyBundleIdentifier: "local.synle.brave-with-flags",
  },
  {
    command: "chrome",
    displayName: "Chrome",
    bundlePattern: /^Google.*Chrome\.app$/i,
    appName: "Browser Chrome",
    bundleIdentifier: "local.synle.browser-chrome",
    legacyAppName: "Chrome With Flags",
    legacyBundleIdentifier: "local.synle.chrome-with-flags",
  },
  {
    command: "edge",
    displayName: "Edge",
    bundlePattern: /^Microsoft.*Edge\.app$/i,
    appName: "Browser Edge",
    bundleIdentifier: "local.synle.browser-edge",
    legacyAppName: "Edge With Flags",
    legacyBundleIdentifier: "local.synle.edge-with-flags",
  },
];

/** Marker used to verify signed launcher creation and managed legacy-bundle removal. */
const _MAC_BROWSER_APP_ACTION_MARKER = "BROWSER_FLAGS_APP_ACTION_OK";

/**
 * Reads one supported string property from an XML or binary app property list.
 * @param {string} plistContent - Property-list contents.
 * @param {string} key - Supported browser app key to read.
 * @param {string} plistPath - Property-list path for the binary plist fallback.
 * @returns {Promise<string|null>} Decoded value, or null when the key is absent.
 */
async function _readMacPlistString(plistContent, key, plistPath) {
  if (!["CFBundleExecutable", "CFBundleIconFile"].includes(key)) return null;
  const propertyKey = `<key>${key}</key>`;
  const keyIndex = plistContent.indexOf(propertyKey);
  if (keyIndex >= 0) {
    const valueMatch = plistContent.slice(keyIndex + propertyKey.length).match(/^\s*<string>([^<]+)<\/string>/);
    if (valueMatch) return valueMatch[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  }

  const command = `/usr/libexec/PlistBuddy -c ${_quoteMacShellArgument(`Print :${key}`)} ${_quoteMacShellArgument(plistPath)} 2>/dev/null || true`;
  return (await execBash(command)).trim() || null;
}

/**
 * Quotes one argument for a Bash single-quoted string.
 * @param {string} value - Argument value to quote.
 * @returns {string} Shell-safe single-quoted argument.
 */
function _quoteMacShellArgument(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * Resolves an installed browser executable and optional icon from its app bundle.
 * @param {{bundlePattern: RegExp}} browser - Browser bundle search definition.
 * @returns {Promise<{bundlePath: string, executablePath: string, iconPath: string|null, iconFileName: string|null}|null>} Resolved bundle data, or null when unavailable.
 */
async function _resolveMacBrowserBundle(browser) {
  const bundlePath = findPath("/Applications", browser.bundlePattern, { type: "folder" });
  if (!bundlePath) return null;

  const infoPlistPath = path.join(bundlePath, "Contents/Info.plist");
  const infoPlist = await readText`${infoPlistPath}`;
  const executableName = await _readMacPlistString(infoPlist, "CFBundleExecutable", infoPlistPath);
  if (!executableName || path.basename(executableName) !== executableName || /[\\/]/.test(executableName)) return null;

  const executablePath = path.join(bundlePath, "Contents/MacOS", executableName);
  if (!pathExists(executablePath, undefined, "file")) return null;

  const iconName = await _readMacPlistString(infoPlist, "CFBundleIconFile", infoPlistPath);
  if (!iconName || path.basename(iconName) !== iconName || iconName.startsWith(".") || iconName.includes("..") || /[\\/]/.test(iconName)) {
    return { bundlePath, executablePath, iconPath: null, iconFileName: null };
  }

  const iconFileName = path.extname(iconName) ? iconName : `${iconName}.icns`;
  const iconPath = path.join(bundlePath, "Contents/Resources", iconFileName);
  const hasBrowserIcon = pathExists(iconPath, undefined, "file");
  return {
    bundlePath,
    executablePath,
    iconPath: hasBrowserIcon ? iconPath : null,
    iconFileName: hasBrowserIcon ? iconFileName : null,
  };
}

/**
 * Builds a minimal app-bundle property list for a flags launcher.
 * @param {{appName: string, bundleIdentifier: string}} browser - Launcher app metadata.
 * @param {string|null} iconFileName - Optional copied browser icon filename.
 * @returns {string} XML property-list contents.
 */
function _buildMacLauncherInfoPlist(browser, iconFileName) {
  const safeIconFileName = iconFileName?.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const iconEntry = safeIconFileName ? `<key>CFBundleIconFile</key><string>${safeIconFileName}</string>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>launcher</string>
  <key>CFBundleIdentifier</key><string>${browser.bundleIdentifier}</string>
  <key>CFBundleName</key><string>${browser.appName}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  ${iconEntry}
</dict></plist>`;
}

/**
 * Builds a launcher script with shared browser options and forwarded arguments.
 * @param {string} executablePath - Resolved browser executable path.
 * @param {{flag: string, description: string}[]} options - Shared launch options.
 * @returns {string} Executable Bash script contents.
 */
function _buildMacLauncherScript(executablePath, options) {
  const optionLines = options.map(({ flag, description }) => `  ${_quoteMacShellArgument(flag)} # ${description}`);
  return `#!/bin/bash
# Managed flags-only launcher; regular browser app remains unchanged.
# '${_BROWSER_UNSAFE_DEBUG_OPTION.flag}' # ${_BROWSER_UNSAFE_DEBUG_OPTION.description}
browser_flags=(
${optionLines.join("\n")}
)
exec ${_quoteMacShellArgument(executablePath)} "\${browser_flags[@]}" "$@"`;
}

/**
 * Creates or refreshes one signed launcher app when its browser is installed.
 * @param {{command: string, displayName: string, appName: string, bundleIdentifier: string, bundlePattern: RegExp}} browser - Launcher definition.
 * @returns {Promise<string|null>} Resolved browser executable path, or null when skipped.
 * @throws {Error} If launcher files cannot be written and signed successfully.
 */
async function _installMacBrowserLauncher(browser) {
  const installedBrowser = await _resolveMacBrowserBundle(browser);
  if (!installedBrowser) {
    log(`>>> ${browser.appName} skipped: browser app or executable not found.`);
    return null;
  }

  const appPath = path.join("/Applications", `${browser.appName}.app`);
  const infoPlistPath = path.join(appPath, "Contents/Info.plist");
  if (pathExists(appPath)) {
    const existingInfoPlist = await readText`${infoPlistPath}`;
    if (!existingInfoPlist.includes(`<string>${browser.bundleIdentifier}</string>`)) {
      log(`>>> ${browser.appName}.app skipped: an unmanaged app already uses that path.`);
      return null;
    }
  }

  const macOSFolder = path.join(appPath, "Contents/MacOS");
  const resourcesFolder = path.join(appPath, "Contents/Resources");
  const launcherPath = path.join(macOSFolder, "launcher");
  await mkdir(macOSFolder);
  await mkdir(resourcesFolder);

  const infoPlist = _buildMacLauncherInfoPlist(browser, installedBrowser.iconFileName);
  const launcherScript = _buildMacLauncherScript(installedBrowser.executablePath, getBrowserLaunchOptions(browser.command, "mac"));
  await backupConfigFile(launcherPath);
  await writeText(launcherPath, launcherScript);
  await backupConfigFile(infoPlistPath);
  await writeText(infoPlistPath, infoPlist);

  if (installedBrowser.iconPath && installedBrowser.iconFileName) {
    const iconDestination = path.join(resourcesFolder, installedBrowser.iconFileName);
    await backupConfigFile(iconDestination);
    copyFile(installedBrowser.iconPath, iconDestination);
  }

  const signingCommand = [
    `chmod +x ${_quoteMacShellArgument(launcherPath)}`,
    `codesign --force --sign - ${_quoteMacShellArgument(appPath)}`,
    `codesign --verify --deep --strict ${_quoteMacShellArgument(appPath)}`,
    `printf '%s' ${_quoteMacShellArgument(_MAC_BROWSER_APP_ACTION_MARKER)}`,
  ].join(" && ");
  const signingOutput = await execBash(signingCommand);
  if (signingOutput.trim() !== _MAC_BROWSER_APP_ACTION_MARKER) throw new Error(`Could not sign ${browser.appName}.app.`);

  log(`>>> Signed ${browser.appName}.app with shared browser launch options.`);
  return installedBrowser.executablePath;
}

/**
 * Removes a previous flags app only when its bundle identifier and launcher prove repo ownership.
 * @param {{legacyAppName: string, legacyBundleIdentifier: string, displayName: string}} browser - Legacy bundle identity.
 * @returns {Promise<void>} Resolves when no managed legacy bundle exists or removal succeeds.
 * @throws {Error} If verified removal does not complete.
 */
async function _removeLegacyMacBrowserLauncher(browser) {
  const legacyAppPath = path.join("/Applications", `${browser.legacyAppName}.app`);
  if (!pathExists(legacyAppPath)) return;

  const infoPlist = await readText`${path.join(legacyAppPath, "Contents/Info.plist")}`;
  const launcherScript = await readText`${path.join(legacyAppPath, "Contents/MacOS/launcher")}`;
  const hasManagedBundleIdentifier = infoPlist.includes(`<string>${browser.legacyBundleIdentifier}</string>`);
  const hasManagedLauncher = launcherScript.includes("# Managed flags-only launcher; regular browser app remains unchanged.");
  if (!hasManagedBundleIdentifier || !hasManagedLauncher) {
    log(`>>> Left ${legacyAppPath} untouched: it is not a recognized managed launcher.`);
    return;
  }

  // TODO: DECOMMISION THIS REMOVE THIS when fully migrated to Browser *.App.
  // deleteFolder rejects shallow /Applications paths; the exact bundle identity above narrows this removal.
  const removalCommand = [
    `command rm -rf ${_quoteMacShellArgument(legacyAppPath)}`,
    `test ! -e ${_quoteMacShellArgument(legacyAppPath)}`,
    `printf '%s' ${_quoteMacShellArgument(_MAC_BROWSER_APP_ACTION_MARKER)}`,
  ].join(" && ");
  const removalOutput = await execBash(removalCommand);
  if (removalOutput.trim() !== _MAC_BROWSER_APP_ACTION_MARKER) {
    throw new Error(`Could not remove managed ${browser.legacyAppName}.app.`);
  }

  log(`>>> Removed prior managed launcher app: ${legacyAppPath}`);
}

/**
 * Builds Mac shell functions that open the dedicated launcher apps.
 * @param {Object<string, string|null>} executablePaths - Resolved browser executables by command name.
 * @returns {string} Bash function definitions for Brave, Chrome, and Edge.
 */
function _getMacBrowserLauncherFunctions(executablePaths) {
  const functionLines = [
    "function _open_browser_with_flags() {",
    '  local display_name="$1" launcher_app="$2" browser_binary="$3"',
    "  shift 3",
    '  if [ -z "$browser_binary" ] || [ ! -x "$browser_binary" ]; then',
    '    echo "Error: $display_name browser not installed." >&2',
    "    return 1",
    "  fi",
    '  if [ ! -x "$launcher_app/Contents/MacOS/launcher" ]; then',
    '    echo "Error: Browser $display_name app not installed; rerun setup." >&2',
    "    return 1",
    "  fi",
    '  open "$launcher_app" --args "$@"',
    "}",
  ];

  for (const browser of _MAC_BROWSER_LAUNCHER_APPS) {
    const appPath = path.join("/Applications", `${browser.appName}.app`);
    functionLines.push(
      `function ${browser.command}() {\n  _open_browser_with_flags ${_quoteMacShellArgument(browser.displayName)} ${_quoteMacShellArgument(appPath)} ${_quoteMacShellArgument(executablePaths[browser.command] || "")} "$@"\n}`,
    );
  }
  return functionLines.join("\n\n");
}

/** Creates signed browser launcher apps and registers the Mac profile. */
async function doWork() {
  const browserExecutablePaths = {};
  for (const browser of _MAC_BROWSER_LAUNCHER_APPS) {
    browserExecutablePaths[browser.command] = await _installMacBrowserLauncher(browser);
  }

  for (const browser of _MAC_BROWSER_LAUNCHER_APPS) {
    if (browserExecutablePaths[browser.command]) await _removeLegacyMacBrowserLauncher(browser);
  }

  const macBrowserLauncherFunctions = _getMacBrowserLauncherFunctions(browserExecutablePaths);
  const onlyMacProfile = code`
    # Suppress bash legacy warning in Catalina+
    export BASH_SILENCE_DEPRECATION_WARNING=1

    # Raise the open-file soft limit from macOS's default 256 for this shell and its
    # children (node, watchers, dev servers). Capped by the hard limit; errors ignored.
    ulimit -n 65536 2> /dev/null || true

    ##########################################################
    # Mac-Only Commands
    ##########################################################

    alias find2='fd'
    ${macBrowserLauncherFunctions}
    alias sqluinative='open "/Applications/sqlui-native.app" --args --disable-smooth-scrolling'
    alias sql="sqluinative"
    alias displaydj='open "/Applications/Display DJ.app"'
    alias skiff='open "/Applications/Skiff Files.app"'
    alias proxie='open "/Applications/Proxie.app"'

    # accessibility: jump straight to System Settings > Privacy & Security > Accessibility
    # (where you grant input-event permission to apps like Display DJ, Ghostty, etc.)
    alias accessibility='open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"'

    # make: use GNU Make (gmake) for .ONESHELL support (macOS ships Make 3.81)
    if type -P gmake &> /dev/null; then alias make='gmake'; fi

    # update: OS package manager update/upgrade only. \`command brew\` bypasses the
    # brew wrapper (snip), which swallows interactive Y/N prompts and hangs the run.
    # --greedy also upgrades casks that self-update (auto_updates / version :latest).
    alias update='command brew update && command brew upgrade --greedy && command brew cleanup'

    # unquarantine: clear the macOS Gatekeeper quarantine attribute on demand
    #
    # Apps installed by this repo are already cleared at install time by
    # installMacDmg -> clearMacQuarantine in software/index.js, and macOS only
    # stamps com.apple.quarantine when a file is downloaded. Re-clearing it on
    # every shell start was redundant work, so this covers the one case the
    # install path does not: an app you sideload by hand.
    alias unquarantine='xattr -cr'
  `;
  log(">>> Only Mac profile loaded:", onlyMacProfile.split("\n").length, "lines");

  // register platform tweaks for mac
  await registerPlatformTweaks("Mac", onlyMacProfile);

  // mac system setup (homebrew paths)
  log(">>> Register mac system setup with bashrc", BASH_SYLE_PATH);
  await registerWithBashSyleProfile(
    "mac-system-setup",
    code`
    # homebrew paths
    for brew_prefix in /opt/homebrew /usr/local; do
      if [ -d "$brew_prefix" ] && [ -x "$brew_prefix/bin/brew" ]; then
        export HOMEBREW_PREFIX="$brew_prefix"
        export HOMEBREW_CELLAR="$brew_prefix/Cellar"
        export HOMEBREW_REPOSITORY="$brew_prefix"
        export PATH="$brew_prefix/bin:$brew_prefix/sbin:$PATH"
        export MANPATH="$brew_prefix/share/man:$MANPATH"
        export INFOPATH="$brew_prefix/share/info:$INFOPATH"
        break
      fi
    done
  `,
  );
}

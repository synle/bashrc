/**
 * Configures Windows Terminal settings - deploys high contrast dark/light color schemes, keybindings, and profile defaults.
 */
async function doWork() {
  const targetPath = path.join(_getPath(), "LocalState/settings.json");
  exitIfPathNotFound(targetPath, "Windows Terminal settings not found");

  log(">> Setting up Microsoft Windows Terminal", targetPath);

  // ----------------------------------------------------------
  // High contrast dark color scheme (matches VS Code "Default High Contrast" / Sublime "High Contrast Dark")
  // ----------------------------------------------------------
  const syDarkScheme = {
    name: "Sy Dark",
    background: "#000000",
    foreground: "#FFFFFF",
    cursorColor: "#FFFFFF",
    selectionBackground: "#264F78",
    black: "#000000",
    blue: "#569CD6",
    brightBlack: "#858585",
    brightBlue: "#4FC1FF",
    brightCyan: "#A4FFFF",
    brightGreen: "#69FF94",
    brightPurple: "#FF92DF",
    brightRed: "#FF6E6E",
    brightWhite: "#FFFFFF",
    brightYellow: "#FFFFA5",
    cyan: "#4EC9B0",
    green: "#608B4E",
    purple: "#C586C0",
    red: "#F44747",
    white: "#CCCCCC",
    yellow: "#DCDCAA",
  };

  // ----------------------------------------------------------
  // High contrast light color scheme (matches VS Code "Default High Contrast Light" / Sublime "High Contrast Light")
  // ----------------------------------------------------------
  const syLightScheme = {
    name: "Sy Light",
    background: "#FFFFFF",
    foreground: "#000000",
    cursorColor: "#000000",
    selectionBackground: "#ADD6FF",
    black: "#000000",
    blue: "#0000FF",
    brightBlack: "#6E7681",
    brightBlue: "#0451A5",
    brightCyan: "#267F99",
    brightGreen: "#098658",
    brightPurple: "#AF00DB",
    brightRed: "#A31515",
    brightWhite: "#FFFFFF",
    brightYellow: "#795E26",
    cyan: "#0070C1",
    green: "#008000",
    purple: "#800080",
    red: "#800000",
    white: "#CCCCCC",
    yellow: "#795E26",
  };

  // ----------------------------------------------------------
  // Default profile appearance
  // ----------------------------------------------------------
  const defaultProfileStyles = {
    cursorShape: "vintage",
    cursorHeight: 50,
    fontFace: EDITOR_CONFIGS.fontFamily,
    fontSize: Math.min(EDITOR_CONFIGS.fontSize, 9),
    padding: "2 0 2 0",
    bellStyle: "all",
    historySize: 50000,
    scrollbarState: "visible",
    antialiasingMode: "cleartype",
    intenseTextStyle: "bright",
    adjustIndistinguishableColors: "indexed",
    colorScheme: {
      dark: "Sy Dark",
      light: "Sy Light",
    },
  };

  // ----------------------------------------------------------
  // Keybindings (loaded from external jsonc file)
  // ----------------------------------------------------------
  const keybindings = parseJsonWithComments(await fetchUrlAsString("software/scripts/window/windows-terminal-keys.jsonc")) || [];

  // ----------------------------------------------------------
  // Build new settings from existing config
  // ----------------------------------------------------------
  const oldSettings = readJson(targetPath);

  const newSettings = {
    ...oldSettings,

    // theme - auto dark/light switching
    theme: "system",

    // clipboard
    copyOnSelect: false,
    copyFormatting: false,

    // tabs
    useTabSwitcher: false,
    tabWidthMode: "compact",
    confirmCloseAllTabs: true,

    // input
    multiLinePasteWarning: false,
    focusFollowMouse: true,

    // window
    launchMode: "maximized",
    showTerminalTitleInTitlebar: true,
    startOnUserLogin: true,
    snapToGridOnResize: true,

    // window size and position
    initialCols: 80,
    initialRows: 30,
    initialPosition: "5,5",
    rowsToScroll: 5,

    // performance
    disableAnimations: true,
    "experimental.rendering.forceFullRepaint": true,

    // misc
    trimBlockSelection: true,
    wordDelimiters: " /\\()\"'-.,:;<>~!@#$%^&*|+=[]{}~?\u2502",
    snapOnInput: true,
    altGrAliasing: true,

    // color schemes
    schemes: [syDarkScheme, syLightScheme],

    // keybindings
    keybindings: [...(oldSettings.actions || []), ...keybindings],
  };

  // apply default styles to all profiles
  const allProfiles = newSettings.profiles?.list || newSettings.profiles || [];
  newSettings.profiles = {
    defaults: defaultProfileStyles,
    list: allProfiles.map((profile) => {
      delete profile.colorScheme;
      return profile;
    }),
  };

  // set default profile to first WSL distro (Debian or Ubuntu)
  const wslProfile = allProfiles.find((p) => [/Debian/i, /Ubuntu/i].some((re) => p.name?.match(re)));
  newSettings.defaultProfile = wslProfile ? wslProfile.guid : allProfiles[0]?.guid;

  delete newSettings.actions;

  writeJson(targetPath, newSettings);
}

/**
 * Returns the Windows Terminal LocalState directory path by searching for the installed package folder.
 * @returns {string|null} Path to the Windows Terminal package directory, or null if not found.
 */
function _getPath() {
  try {
    if (is_os_window) {
      const localPackgesPath = path.join(getWindowUserBaseDir(), "AppData/Local/Packages/");
      return findDirSingle(localPackgesPath, /Microsoft\.WindowsTerminal/i);
    }
    return null;
  } catch (e) {
    log(">> Skipped Windows Terminal Config - Error");
    return process.exit();
  }
}

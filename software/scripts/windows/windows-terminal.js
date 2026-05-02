/** Configures Windows Terminal settings with color schemes, keybindings, and profile defaults. */
/**
 * Configures Windows Terminal settings - deploys high contrast dark/light color schemes, keybindings, and profile defaults.
 *
 * Writes a prebuilt `.build/windows-terminal` artifact (used by the webapp/setup
 * scripts) and, when running on Windows, merges those values into the live
 * `LocalState/settings.json` for the installed Windows Terminal package.
 */
async function doWork() {
  log(">> Setting up Microsoft Windows Terminal");

  // ----------------------------------------------------------
  // High contrast dark/light color schemes (matches VS Code "Default High Contrast" / Sublime "High Contrast Dark/Light")
  // ----------------------------------------------------------
  const syDarkScheme = json`
    {
      "name": "Sy Dark", // {{dark.themeName}}
      "background": "#0a0a0a", // {{dark.background}}
      "foreground": "#e0e0e0", // {{dark.foreground}}
      "cursorColor": "#569cd6", // {{dark.cursorColor}}
      "selectionBackground": "#264f78", // {{dark.selection}}
      "black": "#000000", // {{dark.black}}
      "blue": "#569cd6", // {{dark.blue}}
      "brightBlack": "#858585", // {{dark.brightBlack}}
      "brightBlue": "#4fc1ff", // {{dark.brightBlue}}
      "brightCyan": "#a4ffff", // {{dark.brightCyan}}
      "brightGreen": "#69ff94", // {{dark.brightGreen}}
      "brightPurple": "#ff92df", // {{dark.brightPurple}}
      "brightRed": "#ff6e6e", // {{dark.brightRed}}
      "brightWhite": "#ffffff", // {{dark.brightWhite}}
      "brightYellow": "#ffffa5", // {{dark.brightYellow}}
      "cyan": "#4ec9b0", // {{dark.cyan}}
      "green": "#608b4e", // {{dark.green}}
      "purple": "#c586c0", // {{dark.purple}}
      "red": "#f44747", // {{dark.red}}
      "white": "#cccccc", // {{dark.white}}
      "yellow": "#dcdcaa", // {{dark.yellow}}
    }
  `;
  const syLightScheme = json`
    {
      "name": "Sy Light", // {{light.themeName}}
      "background": "#f8f8f8", // {{light.background}}
      "foreground": "#1e1e1e", // {{light.foreground}}
      "cursorColor": "#0451a5", // {{light.cursorColor}}
      "selectionBackground": "#add6ff", // {{light.selection}}
      "black": "#000000", // {{light.black}}
      "blue": "#0033b3", // {{light.blue}}
      "brightBlack": "#595959", // {{light.brightBlack}}
      "brightBlue": "#1a85ff", // {{light.brightBlue}}
      "brightCyan": "#1a7a7a", // {{light.brightCyan}}
      "brightGreen": "#16825d", // {{light.brightGreen}}
      "brightPurple": "#9400d3", // {{light.brightPurple}}
      "brightRed": "#cd3131", // {{light.brightRed}}
      "brightWhite": "#ffffff", // {{light.brightWhite}}
      "brightYellow": "#b68a00", // {{light.brightYellow}}
      "cyan": "#005fa3", // {{light.cyan}}
      "green": "#006b1e", // {{light.green}}
      "purple": "#6c0099", // {{light.purple}}
      "red": "#b30000", // {{light.red}}
      "white": "#a0a0a0", // {{light.white}}
      "yellow": "#bf8803", // {{light.yellow}}
    }
  `;

  // ----------------------------------------------------------
  // Default profile appearance
  // ----------------------------------------------------------
  const defaultProfileStyles = {
    cursorShape: "vintage",
    cursorHeight: 50,
    fontFace: EDITOR_CONFIGS.fontFamily,
    fontSize: Math.min(EDITOR_CONFIGS.fontSize, 14),
    fontWeight: EDITOR_CONFIGS.fontWeightKeyword,
    padding: "10, 8, 10, 8",
    bellStyle: "all",
    historySize: EDITOR_CONFIGS.terminalScrollback,
    scrollbarState: "visible",
    antialiasingMode: "cleartype",
    intenseTextStyle: "bright",
    adjustIndistinguishableColors: "indexed",
    colorScheme: {
      dark: syDarkScheme.name,
      light: syLightScheme.name,
    },
  };

  // ----------------------------------------------------------
  // Keybindings (loaded from external jsonc file)
  // ----------------------------------------------------------
  const keybindings = (await readJson`software/scripts/windows/windows-terminal-keys.jsonc`) || [];

  // ----------------------------------------------------------
  // Script-contributed settings (merged on top of the user's existing
  // settings.json on Windows; emitted as a prebuilt artifact for the webapp).
  // ----------------------------------------------------------
  /**
   * Build the settings.json slice contributed by this script.
   * @param {object} oldSettings Existing user settings.json contents (or `{}` for the prebuilt artifact).
   * @returns {object} Merged settings object ready to serialize.
   */
  const buildSettings = (oldSettings) => ({
    ...oldSettings,

    // theme - auto dark/light switching
    theme: "system",

    // clipboard
    copyOnSelect: false,
    copyFormatting: false,

    // tabs
    useTabSwitcher: false,
    tabWidthMode: "equal",
    confirmCloseAllTabs: true,

    // input
    multiLinePasteWarning: false,
    focusFollowMouse: false, // require click to focus pane (like iTerm), set to true for hover-to-focus

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
  });

  /**
   * Apply profile defaults, sort/hide profiles, and resolve the default profile.
   * Mutates and returns the passed-in settings object.
   * @param {object} settings Settings object produced by `buildSettings`.
   * @returns {object} The mutated settings object.
   */
  const applyProfileDefaults = (settings) => {
    const allProfiles = settings.profiles?.list || settings.profiles || [];
    settings.profiles = {
      defaults: defaultProfileStyles,
      list: allProfiles
        .map((profile) => {
          delete profile.colorScheme;
          profile.hidden = ![/PowerShell/i, /Ubuntu/i].some((re) => profile.name?.match(re));
          return profile;
        })
        .sort((a, b) => {
          const rank = (p) => (/Ubuntu/i.test(p.name) ? 0 : /PowerShell/i.test(p.name) ? 1 : 2);
          return rank(a) - rank(b);
        }),
    };

    // set default profile to first WSL distro (Debian or Ubuntu)
    const wslProfile = allProfiles.find((p) => [/Debian/i, /Ubuntu/i].some((re) => p.name?.match(re)));
    settings.defaultProfile = wslProfile ? wslProfile.guid : allProfiles[0]?.guid;

    delete settings.actions;
    return settings;
  };

  // ---- Prebuilt artifact (used by setup scripts and webapp downloads) ----
  // Empty `oldSettings` so the artifact captures only this script's contributions.
  const prebuiltSettings = applyProfileDefaults(buildSettings({}));

  await writeBuildArtifact([
    {
      file: `${BUILD_DIR}/windows-terminal`,
      data: prebuiltSettings,
      isJson: true,
    },
  ]);

  // ---- Skip writing locally on platforms where Windows Terminal is unavailable ----
  if (!is_os_windows) {
    log(">>> Skipped (Windows Terminal not supported on this OS)");
    return;
  }

  // ---- Deploy to local install ----
  const targetPath = path.join(_getPath(), "LocalState/settings.json");
  exitIfPathNotFound(targetPath, "Windows Terminal settings not found");
  log(">>> Windows Terminal settings path:", targetPath);

  const oldSettings = await readJson`${targetPath}`;
  const newSettings = applyProfileDefaults(buildSettings(oldSettings));

  await backupConfigFile(targetPath);
  writeJson(targetPath, newSettings);
}

/**
 * Returns the Windows Terminal LocalState directory path by searching for the installed package folder.
 * @returns {string|null} Path to the Windows Terminal package directory, or null if not found.
 */
function _getPath() {
  try {
    if (is_os_windows) {
      const localPackgesPath = path.join(getWindowUserBaseDir(), "AppData/Local/Packages/");
      return findPath(localPackgesPath, /Microsoft\.WindowsTerminal/i, { type: "folder" });
    }
    return null;
  } catch (e) {
    log(">> Skipped Windows Terminal Config - Error");
    throw new ScriptSkipError("Windows Terminal Config error");
  }
}

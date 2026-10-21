/** Configures Windows Terminal settings with color schemes, keybindings, and profile defaults. */
// SOURCE software/scripts/advanced/editor.common.js

/** Installer-owned identity for the dedicated PowerShell 7 Terminal profile. @type {string} */
const WINDOWS_TERMINAL_PWSH_GUID = "{91c9f255-5190-4a5e-9ee5-d05d36dece87}";

/** Supported legacy and managed PowerShell display names. @type {string[]} */
const WINDOWS_TERMINAL_POWERSHELL_NAMES = ["Windows PowerShell", "Powershell v5", "Powershell v7"];
/**
 * Configures Windows Terminal settings - deploys high contrast dark/light color schemes, keybindings, and profile defaults.
 *
 * Writes a prebuilt `.build/windows-terminal` artifact (used by the webapp/setup
 * scripts) and, when running on Windows, merges those values into the live
 * `LocalState/settings.json` for the installed Windows Terminal package.
 *
 * Lives at the top of `software/scripts/` (not under `windows/`) because the
 * prebuilt artifact must be emitted on Linux/Mac CI runners too — otherwise the
 * webapp's `DynamicTextArea` for `/.build/windows-terminal` 404s on the
 * published site. The `windows/` OS-folder filter would drop this script before
 * it ever ran on those runners.
 */
async function doWork() {
  // Skip on non-Windows local dev machines: nothing to install, and we don't
  // want to spam local developers with an artifact-only run. CI runners always
  // emit the artifact; Windows hosts always run end-to-end.
  if (!IS_CI && !is_os_windows) {
    return;
  }

  log(">> Setting up Microsoft Windows Terminal");

  // Windows Terminal embeds its schemes in the same settings.json it reads them from, so
  // the gate decides both whether `schemes` is emitted and which names `colorScheme` points
  // at. Forced on under CI because the prebuilt artifact is generated on Linux runners
  // where `is_gui` is 0 — the shipped artifact must always carry the full custom schemes.
  const useCustomTheme = IS_CI || shouldInstallCustomTheme();
  const { dark: fallbackDarkScheme, light: fallbackLightScheme } = getTheme("windows-terminal");

  // ----------------------------------------------------------
  // High contrast dark/light color schemes (matches VS Code "Default High Contrast" / Sublime "High Contrast Dark/Light")
  // ----------------------------------------------------------
  const syDarkScheme = json`
    {
      "name": "Sy Dark", // {{dark.themeName}}
      "background": "#0a0a0a", // {{dark.background}}
      "foreground": "#e8e8e8", // {{dark.foreground}}
      "cursorColor": "#5ca0d7", // {{dark.cursorColor}}
      "selectionBackground": "#1b3c5e", // {{dark.selection}}
      "black": "#6e6e6e", // {{dark.brightGray}}
      "blue": "#5ca0d7", // {{dark.blue}}
      "brightBlack": "#a0a0a0", // {{dark.brightBlack}}
      "brightBlue": "#4fc1ff", // {{dark.brightBlue}}
      "brightCyan": "#a4ffff", // {{dark.brightCyan}}
      "brightGreen": "#69ff94", // {{dark.brightGreen}}
      "brightPurple": "#ff92df", // {{dark.brightPurple}}
      "brightRed": "#ff6e6e", // {{dark.brightRed}}
      "brightWhite": "#ffffff", // {{dark.brightWhite}}
      "brightYellow": "#ffffa5", // {{dark.brightYellow}}
      "cyan": "#4ec9b0", // {{dark.cyan}}
      "green": "#76a762", // {{dark.green}}
      "purple": "#c586c0", // {{dark.purple}}
      "red": "#f67070", // {{dark.red}}
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
      "selectionBackground": "#96c6fa", // {{light.selection}}
      "black": "#000000", // {{light.black}}
      "blue": "#0033b3", // {{light.blue}}
      "brightBlack": "#4a4a4a", // {{light.brightBlack}}
      "brightBlue": "#0051ae", // {{light.brightBlue}}
      "brightCyan": "#145e5e", // {{light.brightCyan}}
      "brightGreen": "#106145", // {{light.brightGreen}}
      "brightPurple": "#8700c1", // {{light.brightPurple}}
      "brightRed": "#a12626", // {{light.brightRed}}
      "brightWhite": "#8b8b8b", // {{light.brightWhite}}
      "brightYellow": "#7f6000", // {{light.brightYellow}}
      "cyan": "#00416f", // {{light.cyan}}
      "green": "#004a15", // {{light.green}}
      "purple": "#6c0099", // {{light.purple}}
      "red": "#840000", // {{light.red}}
      "white": "#6d6d6d", // {{light.white}}
      "yellow": "#775502", // {{light.yellow}}
    }
  `;

  // ----------------------------------------------------------
  // Default profile appearance
  // ----------------------------------------------------------
  const defaultProfileStyles = {
    cursorShape: "vintage",
    cursorHeight: 50,
    fontFace: EDITOR_CONFIGS.fontFamily,
    fontSize: Math.min(EDITOR_CONFIGS.fontSize, 12),
    fontWeight: EDITOR_CONFIGS.fontWeightKeyword,
    padding: "10, 8, 10, 8",
    bellStyle: "all",
    historySize: EDITOR_CONFIGS.terminalScrollback,
    scrollbarState: "visible",
    antialiasingMode: "cleartype",
    intenseTextStyle: "bright",
    adjustIndistinguishableColors: "indexed",
    colorScheme: {
      dark: useCustomTheme ? syDarkScheme.name : fallbackDarkScheme,
      light: useCustomTheme ? syLightScheme.name : fallbackLightScheme,
    },
  };

  // ----------------------------------------------------------
  // Keybindings (loaded from external jsonc file)
  // ----------------------------------------------------------
  const keybindings = (await readJson`software/scripts/windows-terminal-keys.jsonc`) || [];

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
    tabSwitcherMode: "disabled",
    tabWidthMode: "equal",
    confirmCloseAllTabs: true,

    // input
    "warning.multiLinePaste": false,
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

    // performance
    disableAnimations: true,
    "experimental.rendering.forceFullRepaint": true,

    // misc
    trimBlockSelection: true,
    wordDelimiters: " /\\()\"'-.,:;<>~!@#$%^&*|+=[]{}~?\u2502",
    snapOnInput: true,
    altGrAliasing: true,

    // Keep user-defined schemes needed by the preserved PowerShell and Command Prompt styles.
    schemes: [
      ...(oldSettings.schemes || []).filter((scheme) => !useCustomTheme || ![syDarkScheme.name, syLightScheme.name].includes(scheme.name)),
      ...(useCustomTheme ? [syDarkScheme, syLightScheme] : []),
    ],

    // keybindings
    keybindings: [...(oldSettings.actions || []), ...keybindings],
  });

  // Discover Windows installations only on Windows; CI artifacts must not embed host paths.
  const windowsHome = is_os_windows ? getWindowUserBaseDir() : null;
  const modernExecutable = is_os_windows
    ? findPathFromList(
        [
          ["/mnt/c/Program Files/PowerShell/7", "pwsh.exe"],
          ...(windowsHome ? [[path.join(windowsHome, "AppData/Local/Microsoft/WindowsApps"), "pwsh.exe"]] : []),
        ],
        { type: "file" },
      )
    : null;
  /** Discovered Windows-native PowerShell 7 command, or null when unavailable. @type {string|null} */
  const modernCommand = modernExecutable
    ? `"${toWindowsPath(modernExecutable)}" -NoLogo`
    : is_os_windows && hasBinary("pwsh.exe")
      ? "pwsh.exe"
      : is_os_windows && hasBinary("pwsh")
        ? "pwsh"
        : null;

  /**
   * Apply profile defaults and resolve the default profile.
   * Mutates and returns the passed-in settings object.
   * @param {object} settings Settings object produced by `buildSettings`.
   * @param {string|null} powershellCommand Discovered modern command; omitted for portable artifacts.
   * @returns {object} The mutated settings object.
   */
  const applyProfileDefaults = (settings, powershellCommand = null) => {
    const allProfiles = settings.profiles?.list || settings.profiles || [];
    const commandPromptScheme = allProfiles.find((profile) => profile.name === "Command Prompt")?.colorScheme ?? "Campbell";
    const shellProfiles = allProfiles.map((profile) => {
      if (profile.name === "Windows PowerShell" || profile.name === "Powershell v5") {
        // Freeze inherited appearance and use the inbox executable, even if an old command points at absent pwsh.
        return {
          ...defaultProfileStyles,
          ...settings.profiles?.defaults,
          ...profile,
          name: "Powershell v5",
          commandline: "powershell.exe",
        };
      }
      if (profile.guid === WINDOWS_TERMINAL_PWSH_GUID) {
        return {
          ...profile,
          name: "Powershell v7",
          ...(powershellCommand ? { commandline: powershellCommand } : {}),
          colorScheme: commandPromptScheme,
        };
      }
      return profile;
    });
    if (powershellCommand && !shellProfiles.some((profile) => profile.guid === WINDOWS_TERMINAL_PWSH_GUID)) {
      shellProfiles.push({
        guid: WINDOWS_TERMINAL_PWSH_GUID,
        name: "Powershell v7",
        commandline: powershellCommand,
        startingDirectory: "%USERPROFILE%",
        colorScheme: commandPromptScheme,
      });
    }
    const profiles = _prioritizeWindowsTerminalProfiles(shellProfiles);

    settings.profiles = {
      defaults: defaultProfileStyles,
      list: profiles,
    };

    // Respect explicitly hidden profiles when choosing a launch target.
    const visibleProfiles = profiles.filter((profile) => !profile.hidden && profile.guid);
    const preferredProfile =
      visibleProfiles.find(_isWindowsTerminalWslProfile) ||
      visibleProfiles.find((profile) => WINDOWS_TERMINAL_POWERSHELL_NAMES.includes(profile.name)) ||
      visibleProfiles[0];
    if (preferredProfile) settings.defaultProfile = preferredProfile.guid;

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
  const newSettings = applyProfileDefaults(buildSettings(oldSettings), modernCommand);

  await backupConfigFile(targetPath);
  writeJson(targetPath, newSettings);
}

/**
 * Order profiles and default visibility without overriding explicit boolean hidden values.
 * @param {Array<object>} profiles - Profiles from Windows Terminal settings.
 * @returns {Array<object>} New ordered list preserving shell/Command Prompt schemes and explicit hidden flags.
 */
function _prioritizeWindowsTerminalProfiles(profiles) {
  const prioritizedProfiles = profiles.map((profile) => {
    const prioritizedProfile = { ...profile };
    if (!WINDOWS_TERMINAL_POWERSHELL_NAMES.includes(profile.name) && profile.name !== "Command Prompt") {
      delete prioritizedProfile.colorScheme;
    }
    if (typeof profile.hidden !== "boolean") {
      prioritizedProfile.hidden = !(
        _isWindowsTerminalWslProfile(profile) ||
        WINDOWS_TERMINAL_POWERSHELL_NAMES.includes(profile.name) ||
        profile.source === "Windows.Terminal.Azure"
      );
    }
    return prioritizedProfile;
  });

  return prioritizedProfiles.sort((a, b) => _getWindowsTerminalProfileRank(a) - _getWindowsTerminalProfileRank(b));
}

/**
 * Identify Ubuntu/Debian profiles by name and other WSL distros by their dynamic profile source.
 * @param {object} profile - Windows Terminal profile.
 * @returns {boolean} Whether profile represents a WSL distribution.
 */
function _isWindowsTerminalWslProfile(profile) {
  return (
    [/Ubuntu/i, /Debian/i].some((re) => re.test(profile.name || "")) || ["Microsoft.WSL", "Windows.Terminal.Wsl"].includes(profile.source)
  );
}

/**
 * Rank WSL distributions, modern/legacy PowerShell, Azure, then other profiles.
 * @param {object} profile - Windows Terminal profile.
 * @returns {number} Sort rank: Ubuntu/Debian 0, other WSL 1, v7 2, legacy 3, Azure 4, other 5.
 */
function _getWindowsTerminalProfileRank(profile) {
  if (/Ubuntu|Debian/i.test(profile.name || "")) return 0;
  if (_isWindowsTerminalWslProfile(profile)) return 1;
  if (WINDOWS_TERMINAL_POWERSHELL_NAMES.includes(profile.name)) return profile.name === "Powershell v7" ? 2 : 3;
  if (profile.source === "Windows.Terminal.Azure") return 4;
  return 5;
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

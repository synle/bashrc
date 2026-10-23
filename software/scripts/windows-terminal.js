/** Configures Windows Terminal settings with color schemes, keybindings, and profile defaults. */
// SOURCE software/scripts/advanced/editor.common.js

/** Installer-owned identity for the dedicated PowerShell 7 Terminal profile. @type {string} */
const WINDOWS_TERMINAL_PWSH_GUID = "{91c9f255-5190-4a5e-9ee5-d05d36dece87}";

/** Supported legacy and managed PowerShell display names. @type {string[]} */
const WINDOWS_TERMINAL_POWERSHELL_NAMES = ["Windows PowerShell", "Powershell v5", "Powershell v7"];

/** Shell tab colors; independent of terminal backgrounds and window title-bar themes. @type {{wsl: string, powershell7: string, powershell5: string}} */
const WINDOWS_TERMINAL_TAB_COLORS = { wsl: "#e95420", powershell7: "#000000", powershell5: "#012456" };

/** Official black PowerShell logo, cached beside Terminal settings for offline rendering. @type {string} */
const WINDOWS_TERMINAL_PWSH_ICON_URL = "https://raw.githubusercontent.com/PowerShell/PowerShell/master/assets/Powershell_black_64.png";
/**
 * Configures Windows Terminal settings - deploys high contrast dark/light color schemes, keybindings, and profile defaults.
 *
 * Writes a prebuilt `.build/windows-terminal` artifact (used by the webapp/setup
 * scripts) and, when running on Windows, merges those values into the live
 * `LocalState/settings.json` for the installed Windows Terminal package. Caches
 * the official black icon beside settings when a managed PowerShell 7 profile exists.
 *
 * Lives at the top of `software/scripts/` (not under `windows/`) because the
 * prebuilt artifact must be emitted on Linux/Mac CI runners too — otherwise the
 * webapp's `DynamicTextArea` for `/.build/windows-terminal` 404s on the
 * published site. The `windows/` OS-folder filter would drop this script before
 * it ever ran on those runners.
 * @returns {Promise<void>} Resolves after deployment or a platform-specific skip.
 * @throws {Error} If settings IO or an uncached icon download fails; download failures precede the settings backup/write.
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
  const syDarkScheme = await readSyTheme("windows_terminal", "dark");
  const syLightScheme = await readSyTheme("windows_terminal", "light");

  // ----------------------------------------------------------
  // Default profile appearance
  // ----------------------------------------------------------
  /** Requested appearance shared by defaults and saved per-profile overrides. */
  const requiredProfileStyles = {
    // Terminal parses cellHeight as a CSS length string, not a JSON number.
    font: { weight: "semi-bold", cellHeight: "1.1" },
    showMarksOnScrollbar: true,
    suppressApplicationTitle: false,
    scrollbarState: "visible",
    adjustIndistinguishableColors: "always",
  };
  /** Default appearance for profiles without explicit styling. */
  const defaultProfileStyles = {
    ...requiredProfileStyles,
    cursorShape: "underscore",
    font: {
      face: EDITOR_CONFIGS.fontFamily,
      size: Math.min(EDITOR_CONFIGS.fontSize, 12),
      ...requiredProfileStyles.font,
    },
    padding: "10, 8, 10, 8",
    bellStyle: "all",
    historySize: EDITOR_CONFIGS.terminalScrollback,
    antialiasingMode: "cleartype",
    intenseTextStyle: "bright",
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

    // Window/title-bar theme is independent of terminal content; preserve the saved chrome choice.
    theme: oldSettings.theme === undefined ? "system" : oldSettings.theme,

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

    // misc
    trimBlockSelection: true,
    wordDelimiters: " /\\()\"'-.,:;<>~!@#$%^&*|+=[]{}~?\u2502",
    snapOnInput: true,
    altGrAliasing: true,

    // Retain user-defined scheme records; every profile selects the shared content pair below.
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
   * Unify content colors while preserving explicit tab/window chrome, then apply existing profile defaults.
   * Mutates and returns the passed-in settings object.
   * @param {object} settings Settings object produced by `buildSettings`.
   * @param {string|null} powershellCommand Discovered modern command; omitted for portable artifacts.
   * @returns {object} The mutated settings object.
   */
  const applyProfileDefaults = (settings, powershellCommand = null) => {
    const allProfiles = settings.profiles?.list || settings.profiles || [];
    const inheritedStyles = _modernizeWindowsTerminalProfileFont(settings.profiles?.defaults || {});
    const shellProfiles = allProfiles.map((oldProfile) => {
      const profile = _modernizeWindowsTerminalProfileFont(oldProfile);
      if (profile.name === "Windows PowerShell" || profile.name === "Powershell v5") {
        // Freeze inherited appearance and use the inbox executable, even if an old command points at absent pwsh.
        return {
          ...defaultProfileStyles,
          ...inheritedStyles,
          ...profile,
          font: { ...defaultProfileStyles.font, ...inheritedStyles.font, ...profile.font },
          name: "Powershell v5",
          commandline: "powershell.exe",
        };
      }
      if (profile.guid === WINDOWS_TERMINAL_PWSH_GUID) {
        return {
          ...profile,
          name: "Powershell v7",
          ...(powershellCommand ? { commandline: powershellCommand } : {}),
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
      });
    }
    const profiles = _prioritizeWindowsTerminalProfiles(shellProfiles).map((profile) =>
      _withWindowsTerminalContentColors(profile, defaultProfileStyles.colorScheme),
    );
    for (const profile of profiles) {
      // Saved profile fields override defaults, so apply requested preferences at both levels.
      Object.assign(profile, requiredProfileStyles, { font: { ...profile.font, ...requiredProfileStyles.font } });
      if (/Ubuntu|Debian/i.test(profile.name || "")) profile.elevate = true;
      if ((profile.cursorShape ?? defaultProfileStyles.cursorShape) !== "vintage") delete profile.cursorHeight;
      if (profile.tabColor === undefined) {
        if (_isWindowsTerminalWslProfile(profile)) profile.tabColor = WINDOWS_TERMINAL_TAB_COLORS.wsl;
        else if (profile.name === "Powershell v7") profile.tabColor = WINDOWS_TERMINAL_TAB_COLORS.powershell7;
        else if (profile.name === "Powershell v5") profile.tabColor = WINDOWS_TERMINAL_TAB_COLORS.powershell5;
      }
    }

    settings.profiles = {
      defaults: _withWindowsTerminalContentColors(
        {
          ...defaultProfileStyles,
          ...(inheritedStyles.icon !== undefined ? { icon: inheritedStyles.icon } : {}),
          ...(inheritedStyles.tabColor !== undefined ? { tabColor: inheritedStyles.tabColor } : {}),
          ...(inheritedStyles.unfocusedAppearance !== undefined ? { unfocusedAppearance: inheritedStyles.unfocusedAppearance } : {}),
        },
        defaultProfileStyles.colorScheme,
      ),
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
    delete settings["experimental.rendering.forceFullRepaint"];
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
  const powershell7Profile = newSettings.profiles.list.find((profile) => profile.guid === WINDOWS_TERMINAL_PWSH_GUID);
  if (powershell7Profile) {
    // Use the black upstream logo without changing legacy PowerShell or distro-provided icons.
    const iconPath = path.join(path.dirname(targetPath), "powershell7.png");
    await downloadAsset(WINDOWS_TERMINAL_PWSH_ICON_URL, iconPath);
    // downloadAsset can resolve after a failed curl; verify the result before saving settings.
    if (!IS_DRY_RUN && (!pathExists(iconPath, undefined, "file") || fs.statSync(iconPath).size === 0)) {
      throw new Error("PowerShell 7 icon download did not produce a non-empty file");
    }
    powershell7Profile.icon = toWindowsPath(iconPath);
  }

  await backupConfigFile(targetPath);
  writeJson(targetPath, newSettings);
}

/**
 * Migrate saved flat font fields without changing input or overriding nested font values.
 * @param {object} profile Existing profile or inherited profile defaults.
 * @returns {object} Shallow copy with deprecated font fields migrated and removed.
 */
function _modernizeWindowsTerminalProfileFont(profile) {
  const modernProfile = { ...profile };
  const legacyFont = {
    ...(profile.fontFace !== undefined ? { face: profile.fontFace } : {}),
    ...(profile.fontSize !== undefined ? { size: profile.fontSize } : {}),
    ...(profile.fontWeight !== undefined ? { weight: profile.fontWeight } : {}),
  };
  if (Object.keys(legacyFont).length) modernProfile.font = { ...legacyFont, ...profile.font };
  delete modernProfile.fontFace;
  delete modernProfile.fontSize;
  delete modernProfile.fontWeight;
  return modernProfile;
}

/**
 * Applies the shared content scheme without changing tab/title-bar or non-color appearance controls.
 * @param {object} profile - Existing profile or inherited defaults.
 * @param {{dark: string, light: string}} schemes - Selected Sy or native fallback scheme pair.
 * @returns {object} Copied profile with normalized focused/unfocused content colors; input objects are not mutated.
 */
function _withWindowsTerminalContentColors(profile, schemes) {
  const result = { ...profile, colorScheme: { ...schemes } };
  const targets = [result];
  const unfocused = profile.unfocusedAppearance;
  if (unfocused !== null && typeof unfocused === "object" && !Array.isArray(unfocused)) {
    result.unfocusedAppearance = { ...unfocused, colorScheme: { ...schemes } };
    targets.push(result.unfocusedAppearance);
  }
  for (const target of targets) {
    for (const key of ["foreground", "background", "cursorColor", "selectionBackground"]) delete target[key];
  }
  return result;
}

/**
 * Order profiles and default visibility without overriding explicit boolean hidden values.
 * @param {Array<object>} profiles - Profiles from Windows Terminal settings.
 * @returns {Array<object>} Ordered copies preserving appearance fields and explicit hidden flags; content normalization belongs to the caller.
 */
function _prioritizeWindowsTerminalProfiles(profiles) {
  const prioritizedProfiles = profiles.map((profile) => {
    const prioritizedProfile = { ...profile };
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

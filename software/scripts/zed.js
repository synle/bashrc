/** Zed editor setup: settings + custom dark/light themes. Reads zed-config.jsonc and zed-color-{dark,light}.jsonc, augments with shared EDITOR_CONFIGS, and writes to the local Zed config dir + build artifacts for prebuilt configs. */
// SOURCE software/scripts/advanced/editor.common.js

/** @type {string} Filename for the dark theme written into Zed's themes/ folder. Must match `dark_color_scheme` in the merged settings (currently `Sy Dark`). */
const ZED_DARK_THEME_FILE = "Sy Dark.json";
/** @type {string} Filename for the light theme written into Zed's themes/ folder. */
const ZED_LIGHT_THEME_FILE = "Sy Light.json";

/**
 * Locates the Zed config directory across platforms.
 * Returns the path containing settings.json + themes/ subfolder, or null if not found.
 * macOS / Linux: ~/.config/zed
 * Windows native: %APPDATA%/Zed
 * WSL → Windows host: /mnt/c/Users/<user>/AppData/Roaming/Zed
 * @returns {Promise<string|null>} Absolute path to the Zed config dir, or null.
 */
async function _getPathZed() {
  /** @type {string[]} Candidate config-dir locations to probe in order. First existing folder wins. */
  const candidates = [];
  if (is_os_windows) {
    candidates.push(path.join(getWindowAppDataRoamingUserPath(), "Zed"));
  }
  if (is_os_mac || is_os_ubuntu || is_os_arch_linux || is_os_redhat || is_os_steamos || is_os_chromeos) {
    candidates.push(path.join(BASE_HOMEDIR_LINUX, ".config/zed"));
  }
  for (const candidate of candidates) {
    if (pathExists(candidate)) return candidate;
  }
  return null;
}

/**
 * Builds the merged Zed settings object: starts from zed-config.jsonc and overlays
 * shared EDITOR_CONFIGS values (fonts, tab size, ruler, terminal scrollback, ignored files).
 * @param {object} baseConfig - Parsed zed-config.jsonc.
 * @param {object} options - Build options.
 * @param {boolean} [options.is_prebuilt_config] - When true, use safe fallback fonts/sizes for shipped artifacts.
 * @returns {object} The fully resolved settings.json content.
 */
function _getZedSettings(baseConfig, { is_prebuilt_config = false } = {}) {
  const fontFamily = is_prebuilt_config ? EDITOR_CONFIGS.fontFamilyDefaultFallback : EDITOR_CONFIGS.fontFamily;
  const fontSize = is_prebuilt_config ? EDITOR_CONFIGS.fontSizeDefaultFallback : EDITOR_CONFIGS.fontSize;

  return {
    ...baseConfig,

    // --- Typography ---
    buffer_font_family: fontFamily,
    buffer_font_size: fontSize,
    buffer_font_weight: EDITOR_CONFIGS.fontWeightNumber,
    ui_font_size: fontSize,

    // --- Editing ---
    tab_size: EDITOR_CONFIGS.tabSize,
    preferred_line_length: EDITOR_CONFIGS.maxLineSize,

    // --- Terminal ---
    terminal: {
      ...(baseConfig.terminal || {}),
      max_scroll_history_lines: EDITOR_CONFIGS.terminalScrollback,
    },

    // --- Theme: light/dark variants point to our custom themes ---
    theme: { mode: "system", light: "Sy Light", dark: "Sy Dark" },

    // --- File hiding ---
    file_scan_exclusions: EDITOR_CONFIGS.ignoredFolders.concat(EDITOR_CONFIGS.ignoredFiles),
  };
}

/**
 * Reads the three Zed JSONC source files. Falls back to empty objects if a file is missing
 * so a partially-populated repo (e.g. mid-rebase) doesn't crash the run.
 * @returns {Promise<{baseConfig: object, darkTheme: object, lightTheme: object}>}
 */
async function _readZedSources() {
  const baseConfig = (await readJson`software/scripts/zed-config.jsonc`) || {};
  const darkTheme = (await readJson`software/scripts/zed-color-dark.jsonc`) || {};
  const lightTheme = (await readJson`software/scripts/zed-color-light.jsonc`) || {};
  return { baseConfig, darkTheme, lightTheme };
}

/**
 * Main entry: writes Zed settings + themes to the local install (if found) and queues
 * prebuilt build artifacts. Build artifacts are batched into one writeBuildArtifact call
 * because in CI it throws ScriptSkipError after the first invocation.
 */
async function doWork() {
  const targetPath = await _getPathZed();
  log(">>> Zed config path:", targetPath || "[not found]");

  const { baseConfig, darkTheme, lightTheme } = await _readZedSources();

  // --- Local system: write directly to the Zed config dir if Zed is installed ---
  if (targetPath) {
    log(">>> Deploying to local Zed install:", targetPath);

    const settingsPath = path.join(targetPath, "settings.json");
    await backupConfigFile(settingsPath);
    await writeJson(settingsPath, _getZedSettings(baseConfig, { is_prebuilt_config: false }));

    const darkThemePath = path.join(targetPath, "themes", ZED_DARK_THEME_FILE);
    await backupConfigFile(darkThemePath);
    await writeJson(darkThemePath, darkTheme);

    const lightThemePath = path.join(targetPath, "themes", ZED_LIGHT_THEME_FILE);
    await backupConfigFile(lightThemePath);
    await writeJson(lightThemePath, lightTheme);
  }

  // --- Prebuilt artifacts (used by setup scripts and the webapp) ---
  log(">>> Writing prebuilt Zed build artifacts");
  await writeBuildArtifact([
    {
      file: `${BUILD_DIR}/zed-config`,
      data: _getZedSettings(baseConfig, { is_prebuilt_config: true }),
      isJson: true,
      comments: "Zed settings.json",
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/zed-color-dark`,
      data: darkTheme,
      isJson: true,
      comments: "Zed dark theme (drop into ~/.config/zed/themes/)",
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/zed-color-light`,
      data: lightTheme,
      isJson: true,
      comments: "Zed light theme (drop into ~/.config/zed/themes/)",
      commentStyle: "json",
    },
  ]);
}

/** Sublime Merge settings and keybinding configuration. */
// SOURCE software/scripts/advanced/editor.common.js

/**
 * Builds the Sublime Merge settings object matching Sublime Text conventions.
 * @param {object} options - Configuration options.
 * @param {boolean} [options.is_prebuilt_config] - Whether to use fallback font sizes for prebuilt configs.
 * @returns {object} The Sublime Merge settings object.
 */
function _getConfigs({ is_prebuilt_config = false } = {}) {
  const fontSizeToUse = is_prebuilt_config ? EDITOR_CONFIGS.fontSizeDefaultFallback : EDITOR_CONFIGS.fontSize;

  return {
    // --- Core Performance & Behavior ---
    hardware_acceleration: "opengl",
    update_check: false,

    // --- Typography & Rendering ---
    font_face: is_prebuilt_config ? EDITOR_CONFIGS.fontFamilyDefaultFallback : EDITOR_CONFIGS.fontFamily,
    font_size: fontSizeToUse,

    // --- UI ---
    side_bar_layout: "tabs",
    hide_menu: false,
    theme: "auto",
    dark_theme: "Merge Dark.sublime-theme",
    light_theme: "Merge.sublime-theme",

    // --- Diff & Merge ---
    expand_merge_commits_by_default: false,
    tab_size: EDITOR_CONFIGS.tabSize,
    translate_tabs_to_spaces: false,
    draw_white_space: "all",
    scroll_speed: 0.0,
  };
}

/**
 * Returns the Sublime Merge config directory path based on the current OS.
 * Uses hardcoded paths matching Sublime Merge's default config locations.
 * @returns {string|null} Path to Sublime Merge config directory, or null if not found.
 */
function _getPathSublimeMerge() {
  if (is_os_windows) {
    return findPath(getWindowAppDataRoamingUserPath(), /Sublime[ ]*Merge/, { type: "folder" });
  }
  if (is_os_mac) {
    return path.join(getOsxApplicationSupportCodeUserPath(), "Sublime Merge");
  }
  return null;
}

/**
 * Returns the Sublime Text/Merge platform suffix for keymap filenames (e.g., " (OSX)" on macOS, empty on other platforms).
 * @returns {string} Platform suffix string.
 */
function _getSublimeKeymapPlatformSuffix() {
  if (is_os_mac) return " (OSX)";
  return "";
}

/**
 * Returns the merged keybinding config for the given OS.
 * @param {object[]} commonKeyBindings - Common keybindings shared across platforms.
 * @param {object[]} windowsKeyBindings - Windows/Linux-only keybindings.
 * @param {boolean} [isOsMac] - Override for macOS detection. When omitted, uses the global is_os_mac flag.
 * @returns {object[]} Array of resolved keybinding objects.
 */
function _getKeyConfigs(commonKeyBindings, windowsKeyBindings, isOsMac) {
  const isMac = isOsMac !== undefined ? isOsMac : is_os_mac;
  const osKey = getEditorOsKey("sublime", isMac);
  return isMac
    ? formatEditorKeybindings(commonKeyBindings, osKey)
    : formatEditorKeybindings([...commonKeyBindings, ...windowsKeyBindings], osKey);
}

/**
 * Writes Sublime Merge settings and keybindings to the build output and applies them to the local installation.
 */
async function doWork() {
  const targetPath = _getPathSublimeMerge();

  log(">> Sublime Merge Configurations / Settings:");

  // load keybindings
  const commonKeyBindings = (await readJson`software/scripts/advanced/sublime-merge-keys.common.jsonc`) || [];
  const windowsKeyBindings = (await readJson`software/scripts/advanced/sublime-merge-keys.windows.jsonc`) || [];

  // write all build artifacts (single call — writeBuildArtifact exits the process in CI)
  log(">>> For prebuilt configs and keybindings");
  await writeBuildArtifact([
    {
      file: `${BUILD_DIR}/sublime-merge`,
      data: _getConfigs({ is_prebuilt_config: true }),
      isJson: true,
      comments: "Preferences Settings",
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/sublime-merge-keys-windows`,
      data: _getKeyConfigs(commonKeyBindings, windowsKeyBindings, false),
      isJson: true,
      comments: "Preferences Key Bindings",
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/sublime-merge-keys-mac`,
      data: _getKeyConfigs(commonKeyBindings, windowsKeyBindings, true),
      isJson: true,
      comments: "Preferences Key Bindings",
      commentStyle: "json",
    },
  ]);

  // for my own system
  log(">>> For my own system", targetPath);
  exitIfPathNotFound(targetPath);

  log(">>> Deployed config:", targetPath);
  await backupConfigFile(path.join(targetPath, "Packages/User/Preferences.sublime-settings"));
  await writeConfigToFile(targetPath, "Packages/User/Preferences.sublime-settings", _getConfigs());

  // deploy keybindings
  log(">>> Deployed keybindings:", targetPath);
  const keymapFile = `Packages/User/Default${_getSublimeKeymapPlatformSuffix()}.sublime-keymap`;
  await backupConfigFile(path.join(targetPath, keymapFile));
  await writeConfigToFile(targetPath, keymapFile, _getKeyConfigs(commonKeyBindings, windowsKeyBindings));
}

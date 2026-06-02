/** Sublime Text setup: config, mouse bindings, plugins, keybindings, extensions, and download script generation. */
// SOURCE software/scripts/advanced/editor.common.js

////// Config / Settings //////

const USE_CUSTOM_HIGH_CONTRAST_THEME = true;

let mySublimeTextBaseConfigs = {};

/**
 * Converts lists of files and folders into Sublime Text compatible arrays.
 * @param {string[]} list - The array of files, folders, or binary patterns.
 * @returns {string[]} A cleaned array for Sublime Text settings.
 */
function _convertIgnoredFilesAndFoldersForSublimeText(list = []) {
  // Sublime Text patterns don't use the '**/ ' prefix.
  // We ensure we return a clean array of strings.
  return list.map((item) => {
    // If a pattern was accidentally passed with VS Code globs, strip them
    return item.replace(/^\*\*\//, "");
  });
}

/**
 * Builds the full Sublime Text settings object with editor, performance, and OS-specific configs.
 * @param {object} options - Configuration options.
 * @param {boolean} [options.is_prebuilt_config] - Whether to use fallback font sizes for prebuilt configs.
 * @param {boolean} [options.is_os_mac] - Whether the target OS is macOS.
 * @returns {object} The Sublime Text settings object.
 */
function _getConfigs({ is_prebuilt_config = false, is_os_mac = false }) {
  const fontSizeToUse = is_prebuilt_config ? EDITOR_CONFIGS.fontSizeDefaultFallback : EDITOR_CONFIGS.fontSize;

  const configs = {
    ...mySublimeTextBaseConfigs,

    // --- Core Performance & Behavior ---
    hardware_acceleration: "opengl",

    // --- Typography & Rendering ---
    font_face: is_prebuilt_config ? EDITOR_CONFIGS.fontFamilyDefaultFallback : EDITOR_CONFIGS.fontFamily, // Primary editor font
    font_size: fontSizeToUse, // Base font size for the editor
    font_options: [...(mySublimeTextBaseConfigs.font_options || []), EDITOR_CONFIGS.fontWeightKeyword], // Add font weight to base font options

    // --- UI Cleanliness ---
    sidebar_font_size: fontSizeToUse, // Match sidebar font size to editor font size (ST4 4200+)

    // --- Editing & Whitespace ---
    tab_size: EDITOR_CONFIGS.tabSize, // Number of spaces per tab

    // --- Project & Search ---
    rulers: [EDITOR_CONFIGS.maxLineSize], // Show a vertical ruler at the max line length

    // --- Misc ---
    dark_color_scheme:
      is_prebuilt_config || !USE_CUSTOM_HIGH_CONTRAST_THEME ? SUBLIME_DARK_COLOR_SCHEME : SUBLIME_DARK_HIGH_CONTRAST_COLOR_SCHEME,
    light_color_scheme:
      is_prebuilt_config || !USE_CUSTOM_HIGH_CONTRAST_THEME ? SUBLIME_LIGHT_COLOR_SCHEME : SUBLIME_LIGHT_HIGH_CONTRAST_COLOR_SCHEME,

    // --- Ignored Files ---
    file_exclude_patterns: _convertIgnoredFilesAndFoldersForSublimeText(EDITOR_CONFIGS.ignoredFiles), // Files hidden from sidebar and Goto Anything
    folder_exclude_patterns: _convertIgnoredFilesAndFoldersForSublimeText(EDITOR_CONFIGS.ignoredFolders), // Folders hidden from sidebar and Goto Anything
  };

  return configs;
}

/**
 * Writes Sublime Text settings to prebuilt config files and applies them to the local Sublime Text installation.
 * Build artifacts are queued onto `artifacts` and written in one batch at the end of `doWork()`
 * because `writeBuildArtifact` throws `ScriptSkipError` in CI after its first call — bundling ensures
 * every subsequent `_do*Work` step's artifacts actually reach `.build/`.
 * @param {string|null} targetPath - Path to the local Sublime Text config directory.
 * @param {object[]} artifacts - Shared list to which prebuilt-config build artifacts are pushed.
 */
async function _doConfigWork(targetPath, artifacts) {
  log(`>> Sublime Text Configurations / Settings:`);

  // load base hardcoded configs from JSONC
  mySublimeTextBaseConfigs = await readJson`software/scripts/advanced/sublime-text-config.jsonc`;

  // for my own system
  if (targetPath) {
    log(">>> For my own system", targetPath);

    // deploy custom color schemes (only when high contrast theme is enabled)
    if (USE_CUSTOM_HIGH_CONTRAST_THEME) {
      const colorSchemes = [
        { src: "software/scripts/advanced/sublime-text-color-dark.jsonc", dest: SUBLIME_DARK_HIGH_CONTRAST_COLOR_SCHEME },
        { src: "software/scripts/advanced/sublime-text-color-light.jsonc", dest: SUBLIME_LIGHT_HIGH_CONTRAST_COLOR_SCHEME },
      ];
      for (const { src, dest } of colorSchemes) {
        log(`>>> Deploying color scheme: ${dest}`);
        const data = await readJson`${src}`;

        log(`>>>> Parsing: ${dest}`, src);
        await backupConfigFile(path.join(targetPath, `Packages/User/${dest}`));
        await writeConfigToFile(targetPath, `Packages/User/${dest}`, data);
      }
    }

    log(`>>> Deployed config:`, targetPath);
    await backupConfigFile(path.join(targetPath, "Packages/User/Preferences.sublime-settings"));
    await writeConfigToFile(targetPath, "Packages/User/Preferences.sublime-settings", _getConfigs({ is_os_mac: is_os_mac }));

    // JsPrettier — format-on-save for JS/TS/JSON/CSS/HTML/MD/YAML/GraphQL/Vue. Mirrors VS Code's editor.formatOnSave + Zed's format_on_save="on".
    await backupConfigFile(path.join(targetPath, "Packages/User/JsPrettier.sublime-settings"));
    await writeConfigToFile(targetPath, "Packages/User/JsPrettier.sublime-settings", {
      auto_format_on_save: true,
      auto_format_on_save_requires_prettier_config: false,
      allow_inline_formatting: true,
    });
  }

  // queue build artifacts (written in bulk at end of doWork)
  const comments = "Preferences Settings";
  log(`>>> For prebuilt configs`);
  artifacts.push(
    {
      file: `${BUILD_DIR}/sublime-text-config`,
      data: _getConfigs({ is_prebuilt_config: true, is_os_mac: false }),
      isJson: true,
      comments,
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/sublime-text-config-mac`,
      data: _getConfigs({ is_prebuilt_config: true, is_os_mac: true }),
      isJson: true,
      comments,
      commentStyle: "json",
    },
  );
}

////// Mouse Bindings //////

const MOUSE_WINDOWS_OS_KEY = "alt";
const MOUSE_MAC_OSX_KEY = "super";

/** @type {object[]} Sublime Text mouse map bindings with OS_KEY placeholders. */
let MOUSE_MAPS = [
  {
    button: "button1",
    count: 1,
    modifiers: ["OS_KEY"],
    press_command: "drag_select",
    command: "goto_definition",
  },
  {
    button: "button2",
    count: 1,
    modifiers: ["OS_KEY"],
    command: "goto_reference",
  },
  { button: "button4", command: "jump_back" },
  { button: "button5", command: "jump_forward" },
  // tripple click to select scope
  {
    button: "button1",
    count: 3,
    command: "expand_selection",
    args: { to: "scope" },
  },
];

/**
 * Replaces OS_KEY placeholders in mouse map modifier arrays with the actual OS-specific key.
 * @param {object[]} mouseMaps - Array of Sublime Text mouse map objects.
 * @param {string} osKeyToUse - The OS-specific modifier key to substitute.
 * @returns {object[]} Mouse maps with resolved modifier keys.
 */
function _formatMouseKey(mouseMaps, osKeyToUse) {
  mouseMaps = clone(mouseMaps);

  for (const mouseMap of mouseMaps) {
    mouseMap.modifiers = mouseMap.modifiers?.map((s) => s.replace(/OS_KEY/g, osKeyToUse));
  }

  return mouseMaps;
}

/**
 * Writes prebuilt mouse map configs per platform and applies the config to the local Sublime Text installation.
 * @param {string|null} targetPath - Path to the local Sublime Text config directory.
 * @param {object[]} artifacts - Shared list to which prebuilt mouse-map build artifacts are pushed.
 */
async function _doMouseWork(targetPath, artifacts) {
  log(`>> Setting up Sublime Text MouseMaps`);

  // queue build artifacts (written in bulk at end of doWork)
  log(`>>> For prebuilt configs`);
  artifacts.push(
    { file: `${BUILD_DIR}/sublime-text-mouse`, data: _formatMouseKey(MOUSE_MAPS, MOUSE_WINDOWS_OS_KEY), isJson: true },
    { file: `${BUILD_DIR}/sublime-text-mouse-mac`, data: _formatMouseKey(MOUSE_MAPS, MOUSE_MAC_OSX_KEY), isJson: true },
  );

  // for my own system
  if (targetPath) {
    log(">>> For my system", targetPath);
    const fileDestPath = path.join(targetPath, "Packages/User/Default.sublime-mousemap");
    log(">>>> fileDestPath", fileDestPath);
    await backupConfigFile(fileDestPath);
    await writeJson(fileDestPath, _formatMouseKey(MOUSE_MAPS, is_os_mac ? MOUSE_MAC_OSX_KEY : MOUSE_WINDOWS_OS_KEY));
  }
}

////// Plugins //////

/**
 * Copies Sublime Text plugin files to both the prebuilt build directory and the local Sublime Text installation.
 * @param {string|null} targetPath - Path to the local Sublime Text config directory.
 * @param {object[]} artifacts - Shared list to which prebuilt plugin build artifacts are pushed.
 */
async function _doPluginsWork(targetPath, artifacts) {
  log(`>> Sublime Text Plugins:`);
  const allPlugins = [`sublime-text-plugins-refresh-on-focus.py`];

  // queue build artifacts (written in bulk at end of doWork)
  log(`>>> For prebuilt configs`);
  for (const pluginCodePath of allPlugins) {
    log(`>>>> ${pluginCodePath}`);
    const pluginContent = await readText`${path.join("software/scripts", pluginCodePath)}`;
    artifacts.push({ file: `${BUILD_DIR}/${pluginCodePath}`, data: pluginContent });
  }

  // for my own system
  if (targetPath) {
    log(">>> For my own system", targetPath);
    for (const pluginCodePath of allPlugins) {
      const fileDestPath = path.join(targetPath, path.join("Packages/User/", pluginCodePath));
      log(">>>> fileDestPath", fileDestPath);
      await backupConfigFile(fileDestPath);
      const pluginContent = await readText`${path.join("software/scripts", pluginCodePath)}`;
      await writeText(fileDestPath, pluginContent);
    }
  }
}

////// Keybindings //////

/** @type {object[]} Common keybindings loaded from JSONC. */
let COMMON_KEY_BINDINGS;
/** @type {object[]} Windows-only keybindings loaded from JSONC. */
let WINDOWS_ONLY_KEY_BINDINGS;
/** @type {object[]} Mac-only keybindings. */
let MAC_ONLY_KEY_BINDINGS;

/**
 * Returns the Sublime Text platform suffix for keymap filenames (e.g., " (OSX)" on macOS, empty on other platforms).
 * @returns {string} Platform suffix string.
 */
function _getSublimeKeymapPlatformSuffix() {
  if (is_os_mac) return " (OSX)";
  return "";
}

/**
 * Returns the merged keybinding config for the given OS.
 * @param {boolean} [isOsMac] - Override for macOS detection. When omitted, uses the global is_os_mac flag.
 * @returns {object[]} Array of resolved keybinding objects.
 */
function _getKeyConfigs(isOsMac) {
  const isMac = isOsMac !== undefined ? isOsMac : is_os_mac;
  const osKey = getEditorOsKey("sublime", isMac);
  return isMac
    ? formatEditorKeybindings([...COMMON_KEY_BINDINGS, ...MAC_ONLY_KEY_BINDINGS], osKey)
    : formatEditorKeybindings([...COMMON_KEY_BINDINGS, ...WINDOWS_ONLY_KEY_BINDINGS], osKey);
}

/**
 * Loads keybinding configs, writes prebuilt configs per platform, and applies to the local Sublime Text installation.
 * @param {string|null} targetPath - Path to the local Sublime Text config directory.
 * @param {object[]} artifacts - Shared list to which prebuilt keybinding build artifacts are pushed.
 */
async function _doKeysWork(targetPath, artifacts) {
  COMMON_KEY_BINDINGS = (await readJson`software/scripts/advanced/sublime-text-keys.common.jsonc`) || [];
  WINDOWS_ONLY_KEY_BINDINGS = (await readJson`software/scripts/advanced/sublime-text-keys.windows.jsonc`) || [];
  MAC_ONLY_KEY_BINDINGS = [];

  log(`>> Sublime Text Keybindings:`);

  // queue build artifacts (written in bulk at end of doWork)
  const comments = "Preferences Key Bindings";
  artifacts.push(
    {
      file: `${BUILD_DIR}/sublime-text-keys-windows`,
      data: _getKeyConfigs(false),
      isJson: true,
      comments,
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/sublime-text-keys-linux`,
      data: _getKeyConfigs(false),
      isJson: true,
      comments,
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/sublime-text-keys-mac`,
      data: _getKeyConfigs(true),
      isJson: true,
      comments,
      commentStyle: "json",
    },
  );

  // for my own system
  if (targetPath) {
    log(">>> For my own system", targetPath);
    const keymapFile = `Packages/User/Default${_getSublimeKeymapPlatformSuffix()}.sublime-keymap`;
    await backupConfigFile(path.join(targetPath, keymapFile));
    await writeConfigToFile(targetPath, keymapFile, _getKeyConfigs());
  }
}

////// Setup Script Generation //////

const buildFiles = [
  { buildName: "sublime-text-config", dest: "Preferences.sublime-settings", os: "windows" },
  { buildName: "sublime-text-keys-windows", dest: "Default.sublime-keymap", os: "windows" },
  { buildName: "sublime-text-mouse", dest: "Default.sublime-mousemap", os: "windows" },
  { buildName: "sublime-text-plugins-refresh-on-focus.py", dest: "sublime-text-plugins-refresh-on-focus.py", os: "windows" },

  { buildName: "sublime-text-config", dest: "Preferences.sublime-settings", os: "linux" },
  { buildName: "sublime-text-keys-linux", dest: "Default.sublime-keymap", os: "linux" },
  { buildName: "sublime-text-mouse", dest: "Default.sublime-mousemap", os: "linux" },
  { buildName: "sublime-text-plugins-refresh-on-focus.py", dest: "sublime-text-plugins-refresh-on-focus.py", os: "linux" },

  { buildName: "sublime-text-config-mac", dest: "Preferences.sublime-settings", os: "mac" },
  { buildName: "sublime-text-keys-mac", dest: "Default (OSX).sublime-keymap", os: "mac" },
  { buildName: "sublime-text-mouse-mac", dest: "Default.sublime-mousemap", os: "mac" },
  { buildName: "sublime-text-plugins-refresh-on-focus.py", dest: "sublime-text-plugins-refresh-on-focus.py", os: "mac" },
];

/**
 * Generates curl download commands for Sublime Text config files for a given OS.
 * @param {string} os - The target OS ('windows', 'linux', or 'mac').
 * @returns {string} Formatted curl commands.
 */
function getCurlLines(os) {
  return buildFiles
    .filter((f) => f.os === os)
    .map((f) => `    curl -fsSL "$REPO_BUILD/${f.buildName}?raw=1" -o "$TARGET_PATH/${f.dest}"`)
    .join("\n");
}

/**
 * Generates PowerShell download commands for Sublime Text config files on Windows.
 * @returns {string} Formatted PowerShell Invoke-WebRequest commands.
 */
function getPowershellLines() {
  return buildFiles
    .filter((f) => f.os === "windows")
    .map((f) => `    Invoke-WebRequest -Uri "$RepoBuild/${f.buildName}?raw=1" -OutFile "$W_Path/${f.dest}" -UseBasicParsing`)
    .join("\n");
}

/**
 * Generates the Sublime Text setup download script for bash and PowerShell environments.
 * @param {object[]} artifacts - Shared list to which the setup-script build artifact is pushed.
 */
async function _doSetupScriptWork(artifacts) {
  log(`>> Sublime Text Setup Script:`);

  const script = `
# ${getAutoGeneratedText()}

${LINE_BREAK_HASH}
# for Linux using bash
${LINE_BREAK_HASH}
REPO_BUILD="${BASH_PROFILE_CODE_REPO_RAW_URL}/.build"

# Resolve potential paths with wildcards
W_PATH=$(ls -d {/mnt/c,/c}/Users/*/AppData/Roaming/Sublime*Text*/Packages/User 2>/dev/null | head -n 1)
L_PATH=$(ls -d $HOME/.config/sublime-text*/Packages/User 2>/dev/null | head -n 1)
M_PATH=$(ls -d "$HOME/Library/Application Support/Sublime Text"*/Packages/User 2>/dev/null | head -n 1)

if [ -n "$W_PATH" ] && [ -d "$W_PATH" ]; then
    echo "Installing for Windows/WSL ($W_PATH)..."
    TARGET_PATH="$W_PATH"
${getCurlLines("windows")}
elif [ -n "$L_PATH" ] && [ -d "$L_PATH" ]; then
    echo "Installing for Linux ($L_PATH)..."
    TARGET_PATH="$L_PATH"
${getCurlLines("linux")}
elif [ -n "$M_PATH" ] && [ -d "$M_PATH" ]; then
    echo "Installing for Mac ($M_PATH)..."
    TARGET_PATH="$M_PATH"
${getCurlLines("mac")}
else
    echo "Sublime Text User directory not found. Skipping installation."
fi


${LINE_BREAK_HASH}
# for Windows using powershell
${LINE_BREAK_HASH}
# for windows with powershell, last effort (final fallback)
$RepoBuild = "${BASH_PROFILE_CODE_REPO_RAW_URL}/.build"
$W_Path = "$env:AppData/Sublime Text/Packages/User"
if (Test-Path $W_Path) {
    Write-Host "Installing for Windows with PowerShell..."
${getPowershellLines()}
}
`;

  artifacts.push({ file: `${BUILD_DIR}/sublime-text-setup`, data: script });
}

////// Extensions //////

const toInstallExtensions = set`
  // icons and themes
  A File Icon

  // language server and intelligence
  LSP
  LSP-css
  LSP-html
  LSP-json
  LSP-pyright
  LSP-typescript

  // syntax highlighting
  Sass
  TypeScript

  // code formatting
  CodeFormatter
  JsPrettier

  // editing
  Alignment
  All Autocomplete
  BracketHighlighter
  Case Conversion
  DocBlockr
  // ui
  SideBarEnhancements
  SyncedSideBar

  // git
  GitGutter

  // utilities
  Compare Side-By-Side
  MarkdownPreview
  SublimeLinter
`;

/**
 * Installs Sublime Text packages via Package Control and writes extension list to build file.
 * @param {string|null} targetPath - Path to the local Sublime Text config directory.
 * @param {object[]} artifacts - Shared list to which the extensions build artifact is pushed.
 */
async function _doExtWork(targetPath, artifacts) {
  log(`>> Sublime Text Extensions:`);

  // queue build artifact (written in bulk at end of doWork)
  artifacts.push({
    file: `${BUILD_DIR}/sublime-text-ext`,
    data: `# Use Preferences > Package Control > Package Control: Advanced Install Package. \n${toInstallExtensions.join(",")}`,
  });

  // write Package Control settings to local Sublime Text installation
  if (targetPath) {
    log(">>> For my own system", targetPath);

    const pkgControlPath = path.join(targetPath, "Packages/User/Package Control.sublime-settings");
    let existingPackages = [];
    try {
      const existing = await readJson`${pkgControlPath}`;
      existingPackages = existing.installed_packages || [];
    } catch (e) {}

    // merge: keep existing packages and add new ones
    const mergedPackages = [...new Set([...existingPackages, ...toInstallExtensions])].sort();

    await backupConfigFile(path.join(targetPath, "Packages/User/Package Control.sublime-settings"));
    await writeConfigToFile(targetPath, "Packages/User/Package Control.sublime-settings", {
      installed_packages: mergedPackages,
    });
  }
}

////// Main Entry Point //////

/**
 * Orchestrates all Sublime Text setup: mouse bindings, plugins, keybindings, extensions, and download script generation.
 */
async function doWork() {
  // resolve local Sublime Text path (shared across sub-tasks)
  let targetPath = await _getPathSublimeText();
  log(">>> Sublime Text path", targetPath);

  // Collect all build artifacts into one list and flush in a single writeBuildArtifact call
  // at the end — in CI, writeBuildArtifact throws ScriptSkipError after its first invocation,
  // so calling it per sub-task would drop every artifact except the first.
  const artifacts = [];

  await _doConfigWork(targetPath, artifacts);
  await _doMouseWork(targetPath, artifacts);
  await _doPluginsWork(targetPath, artifacts);
  await _doKeysWork(targetPath, artifacts);
  await _doExtWork(targetPath, artifacts);
  await _doSetupScriptWork(artifacts);

  if (artifacts.length) {
    await writeBuildArtifact(artifacts);
  }
}

/** Shared constants and helpers for editor configuration scripts (Sublime Text, VS Code, Zed). Run: `bash run.sh --files="sublime-text.js,sublime-merge.js,vs-code-ext.sh"` */
/** Color theme constants */
const SUBLIME_DARK_COLOR_SCHEME = "Monokai.sublime-color-scheme";
const SUBLIME_LIGHT_COLOR_SCHEME = "Breakers.sublime-color-scheme";
const SUBLIME_DARK_HIGH_CONTRAST_COLOR_SCHEME = "Sy Dark.sublime-color-scheme";
const SUBLIME_LIGHT_HIGH_CONTRAST_COLOR_SCHEME = "Sy Light.sublime-color-scheme";
const VSCODE_DARK_COLOR_THEME = "Default High Contrast";
const VSCODE_LIGHT_COLOR_THEME = "Default High Contrast Light";
const ZED_DARK_COLOR_SCHEME = "One Dark";
const ZED_LIGHT_COLOR_SCHEME = "One Light";
const ZED_DARK_HIGH_CONTRAST_COLOR_SCHEME = "Sy Dark";
const ZED_LIGHT_HIGH_CONTRAST_COLOR_SCHEME = "Sy Light";

/** Glob patterns for locating the Zed editor binary across platforms */
const _ZED_PATHS = [
  // macOS
  "/Applications/Zed.app/Contents/MacOS/cli",
  "/usr/local/bin/zed",
  "/opt/homebrew/bin/zed",

  // Windows (WSL paths) — winget/MSI installs ship the binary as "Zed.exe"
  // (capital Z). Bash globs are case-sensitive even on DrvFs (matching happens
  // in bash, not in the kernel), so use a [Zz] character class to tolerate any
  // installer variant.
  "/mnt/c/Program*Files/[Zz]ed*/[Zz]ed.exe",
  "/mnt/c/Users/*/AppData/Local/Programs/[Zz]ed*/[Zz]ed.exe",
  "/mnt/c/Users/*/AppData/Local/[Zz]ed*/[Zz]ed.exe",

  // Linux
  "/usr/bin/zed",
  "/usr/local/bin/zed",
  "~/.local/bin/zed",
];

/** Glob patterns for locating the Sublime Text binary across platforms */
const _SUBL_PATHS = [
  // macOS (Sublime 3 & 4)
  "/Applications/Sublime*Text.app/Contents/SharedSupport/bin/subl",
  "/Applications/Sublime*Text.app/Contents/MacOS/sublime_text",

  // Windows (WSL paths)
  "/mnt/c/Program*Files/Sublime*Text*/sublime*.exe",
  "/mnt/c/Program*Files/Sublime*Text*/subl*.exe",
  "/mnt/c/Users/*/AppData/Local/Programs/Sublime*Text/sublime*.exe",

  // Linux
  "/opt/sublime_text/subl*",
  "/usr/bin/subl",
  "/usr/local/bin/subl",
];

/** Glob patterns for locating the Sublime Merge binary across platforms */
const _SMERGE_PATHS = [
  // macOS
  "/Applications/Sublime*Merge.app/Contents/SharedSupport/bin/smerge",

  // Windows (WSL paths)
  "/mnt/c/Program*Files/Sublime*Merge*/smerge.exe",
  "/mnt/c/Program*Files/Sublime*Merge*/sublime_merge.exe",
  "/mnt/c/Users/*/AppData/Local/Programs/Sublime*Merge/smerge.exe",

  // Linux
  "/opt/sublime_merge/smerge",
  "/usr/bin/smerge",
  "/usr/local/bin/smerge",
];

/** Glob patterns for locating the VS Code binary across platforms */
const _CODE_PATHS = [
  // macOS
  "/Applications/Visual*Studio*Code.app/Contents/Resources/app/bin/code",
  "/Applications/Visual*Studio*Code*Insiders.app/Contents/Resources/app/bin/code",

  // macOS (Homebrew / manual CLI install)
  "/opt/homebrew/bin/code",
  "/usr/local/bin/code",

  // Windows (WSL paths)
  "/mnt/c/Users/*/AppData/Local/Programs/Microsoft*Code/Code.exe",
  "/mnt/c/Users/*/AppData/Local/Programs/Microsoft*Code*Insiders/Code*.exe",
  "/mnt/c/Program*Files/Microsoft*VS*Code/Code.exe",

  // Linux
  "/usr/bin/code",
  "/usr/local/bin/code",
  "/snap/bin/code",
];

/** @type {string} OS modifier key for Windows/Linux keybindings (alt for modern mode) */
const EDITOR_WINDOWS_OS_KEY = "alt";
/** @type {Record<string, string>} Mac OS modifier keys by editor source */
const EDITOR_MAC_OS_KEYS = { sublime: "super", zed: "cmd", ghostty: "cmd" };

/**
 * Returns the OS-specific modifier key for the given editor source.
 * Windows/Linux always returns "alt". macOS returns "super" (Sublime) or "cmd" (Zed).
 * @param {string} source - The editor source ("sublime", "zed", or "ghostty").
 * @param {boolean} [isOsMac] - Override for macOS detection. When omitted, uses the global is_os_mac flag.
 * @returns {string} The resolved OS modifier key.
 */
function getEditorOsKey(source, isOsMac) {
  const isMac = isOsMac !== undefined ? isOsMac : is_os_mac;
  return isMac ? EDITOR_MAC_OS_KEYS[source] || "super" : EDITOR_WINDOWS_OS_KEY;
}

/**
 * Replaces OS_KEY placeholders in keybinding key/keys arrays with the actual OS-specific modifier key.
 * @param {object[]} keybindings - Array of keybinding objects with key/keys properties.
 * @param {string} osKeyToUse - The OS-specific modifier key to substitute (e.g. "alt", "super").
 * @returns {object[]} Keybindings with resolved key strings.
 */
function formatEditorKeybindings(keybindings, osKeyToUse) {
  keybindings = clone(keybindings);

  for (const keybinding of keybindings) {
    keybinding.keys = []
      .concat(keybinding.keys || [])
      .concat(keybinding.key || [])
      .map((s) => s.replace("OS_KEY", osKeyToUse));

    delete keybinding.key;
  }

  return keybindings;
}

/**
 * Searches standard OS paths for VS Code installation directories.
 * @returns {string[]} Array of absolute paths to found VS Code config directories.
 */
function _getVSCodePaths() {
  const res = [];
  const home = BASE_HOMEDIR_LINUX;

  // 1. Initialize search roots with standard OS locations
  const searchRoots = [
    process.env.APPDATA, // Windows Native
    path.join(home, "Library/Application Support"), // macOS
    path.join(home, ".config"), // Linux Standard
    path.join(home, ".var/app/com.visualstudio.code/config"), // Linux Flatpak
  ];

  // 2. Account for WSL Windows mount (gated on is_os_windows — getWindowAppDataRoamingUserPath
  // calls path.join on getWindowUserBaseDir() which is undefined on non-WSL hosts and would
  // throw "path argument must be of type string" before the fs.existsSync guard is reached).
  if (is_os_windows) {
    try {
      const windowsRoamingPath = getWindowAppDataRoamingUserPath();
      if (windowsRoamingPath && fs.existsSync(windowsRoamingPath)) {
        searchRoots.push(windowsRoamingPath);
      }
    } catch (e) {
      // No Windows host reachable from WSL — skip silently.
    }
  }

  // 3. Execution logic using findPath
  searchRoots.forEach((root) => {
    if (!root || !fs.existsSync(root)) return;

    try {
      const foundAppPath = findPath(root, /Code/i, { type: "folder" });

      if (foundAppPath && fs.existsSync(foundAppPath)) {
        const absolutePath = path.resolve(foundAppPath);
        if (!res.includes(absolutePath)) {
          res.push(absolutePath);
        }
      }
    } catch (err) {
      // Silent fail for locked directories
    }
  });

  return res;
}

/**
 * Searches for the Sublime Text config directory based on the current OS.
 * @returns {Promise<string|null>} Path to the Sublime Text config directory, or null if not found.
 */
async function _getPathSublimeText() {
  const regexBinary = /Sublime[ -]*Text[0-9]*[0-9]*/i;

  try {
    if (is_os_windows) {
      return findPath(getWindowAppDataRoamingUserPath(), regexBinary, { type: "folder" });
    }

    if (is_os_mac) {
      return findPath(getOsxApplicationSupportCodeUserPath(), regexBinary, { type: "folder" });
    }

    if (is_os_arch_linux) {
      return findPath(path.join(process.env.HOME, ".var/app/com.sublimetext.three/config"), regexBinary, { type: "folder" });
    }

    // for debian or chrome os debian linux
    return findPath(BASE_HOMEDIR_LINUX + "/.config", regexBinary, { type: "folder" });
  } catch (err) {
    log(">>>> Failed to get the path", err);
  }

  return null;
}

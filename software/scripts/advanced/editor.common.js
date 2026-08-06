/**
 * Shared constants and helpers for editor configuration scripts (Sublime Text,
 * VS Code, Zed). Run: `bash run.sh --files="sublime-text.js,sublime-merge.js,vs-code-ext.sh"`
 *
 * Editor visual/format settings (tab size, line-wrap column, font, etc.) come
 * from `EDITOR_CONFIGS` in software/index.js — the single source of truth.
 * Notably:
 *   - `EDITOR_CONFIGS.tabSize`     ← driven by TAB_SIZE constant in index.js,
 *                                    also referenced by Makefile (`shfmt -i`)
 *                                    and package.json `format` (--tab-width).
 *   - `EDITOR_CONFIGS.maxLineSize` ← driven by PRINT_WIDTH_BREAK_COUNT in
 *                                    index.js, matched by `--print-width` in
 *                                    package.json `format`.
 * All editor scripts consume these via `EDITOR_CONFIGS.<key>` — do not
 * hard-code the values here.
 */
// --- Custom theme gate ---

/**
 * Runtime opt-out for the generated `Sy Dark` / `Sy Light` themes, read as a boolean
 * (`true`/`1` both count) from either `--IS_CUSTOM_THEME_DISABLED=1` or the environment.
 *
 * Read lazily inside {@link shouldInstallCustomTheme} rather than captured at module
 * scope for two reasons: a module-scope `getRuntimeOption` call would run on every
 * `// SOURCE editor.common.js` import (including inside the `vm` sandbox the unit tests
 * build, which does not define it), and capturing it once would freeze the value at
 * import time instead of reflecting the flag actually passed to this run.
 */
const IS_CUSTOM_THEME_DISABLED_KEY = "IS_CUSTOM_THEME_DISABLED";

/**
 * Whether to build and install the custom `Sy Dark` / `Sy Light` themes.
 *
 * True only when this machine has a GUI *and* the caller has not opted out. A headless
 * box has no editor or terminal UI to theme, so generating theme files there is pure
 * churn; the opt-out exists so a run can be rehearsed against the stock themes without
 * editing any script.
 *
 * When false, callers must fall back to {@link getTheme}, which names only themes that
 * ship with each app — so the fallback path never depends on an extension or package
 * being installed first.
 *
 * @returns {boolean} True when custom themes should be generated and installed.
 */
function shouldInstallCustomTheme() {
  return !!is_gui && !getRuntimeOption(IS_CUSTOM_THEME_DISABLED_KEY, parseBoolean);
}

// --- Fallback themes ---

/**
 * App name → `[darkTheme, lightTheme]`, naming **only themes that ship with the app**.
 * This is the fallback used whenever {@link shouldInstallCustomTheme} is false, so every
 * entry here must work with a stock install — no extension, no Package Control, no
 * marketplace download.
 *
 * Two things to know before editing:
 *
 * 1. **Order is `[dark, light]`.** Read entries through {@link getTheme}, which returns a
 *    named `{ dark, light }` pair so a call site can never silently swap them.
 * 2. **Values are each app's own name for the theme, and those names disagree.** Ghostty
 *    calls its dark variant `Ayu` while Zed calls the same thing `Ayu Dark`; Sublime wants
 *    a filename with an extension. Copy the name from the app, never from a sibling entry.
 *
 * Ayu is the preferred family (measured worst-case ANSI hue 6.34:1 dark — the strongest of
 * the families bundled by more than one of these apps), but it only ships with Ghostty and
 * Zed. VS Code, Sublime, Windows Terminal and vim have no bundled Ayu, so each falls back
 * to its own highest-contrast built-in instead of pulling in a download.
 */
const APP_TO_THEMES_MAP = {
  // Bundled with Ghostty. Note the dark variant is plain "Ayu", not "Ayu Dark".
  ghostty: ["Ayu", "Ayu Light"],

  // Built into Zed. Swap to ["One Dark", "One Light"] to switch families — also built in,
  // but measured lower contrast (worst hue 4.38:1 dark vs Ayu's 6.34:1).
  zed: ["Ayu Dark", "Ayu Light"],

  // VS Code bundles no Ayu. These are theme *ids*, not the labels shown in the picker
  // ("Dark High Contrast" / "Light High Contrast") — the id is what settings.json stores.
  // They are VS Code's dedicated accessibility themes at 21:1 UI contrast.
  vscode: ["Default High Contrast", "Default High Contrast Light"],

  // Sublime bundles no Ayu and ships only five schemes. Mariana and Breakers are the
  // highest-contrast dark and light of those five (worst token 3.62:1 and 1.84:1) —
  // weak, but they are the ceiling without installing a package.
  sublime: ["Mariana.sublime-color-scheme", "Breakers.sublime-color-scheme"],

  // Windows Terminal bundles no Ayu; One Half is its only built-in dark/light pair.
  "windows-terminal": ["One Half Dark", "One Half Light"],

  // Single-entry form: vim ships no high-contrast light scheme worth pairing here, so the
  // one value is reused for both modes by getTheme() rather than being padded with a
  // second, worse pick. `industry` is a vim built-in.
  vim: ["industry"],
};

/**
 * Look up an app's fallback themes, normalizing the single-entry form.
 *
 * An entry may list one theme instead of two (see `vim` above); that single value is
 * reused for both modes so every call site can destructure `{ dark, light }` without
 * having to length-check the array first.
 *
 * @param {string} appName - Key into {@link APP_TO_THEMES_MAP}, e.g. `"zed"`.
 * @returns {{dark: string, light: string}} The app's dark and light theme names.
 * @throws {Error} If `appName` is unknown or its entry is empty, since silently returning
 *   an undefined theme name would write a broken value into a real user config.
 */
function getTheme(appName) {
  const themes = APP_TO_THEMES_MAP[appName];

  if (!Array.isArray(themes) || themes.length === 0) {
    throw new Error(`No fallback theme registered for "${appName}". Known apps: ${Object.keys(APP_TO_THEMES_MAP).join(", ")}`);
  }

  const [dark, light = dark] = themes;
  return { dark, light };
}

// --- Color theme constants ---

/** @type {string} Sublime fallback dark scheme. Built in; see APP_TO_THEMES_MAP. */
const SUBLIME_DARK_COLOR_SCHEME = getTheme("sublime").dark;
/** @type {string} Sublime fallback light scheme. Built in; see APP_TO_THEMES_MAP. */
const SUBLIME_LIGHT_COLOR_SCHEME = getTheme("sublime").light;
/** @type {string} Sublime custom dark scheme, generated from COLOR_MAP. */
const SUBLIME_DARK_HIGH_CONTRAST_COLOR_SCHEME = "Sy Dark.sublime-color-scheme";
/** @type {string} Sublime custom light scheme, generated from COLOR_MAP. */
const SUBLIME_LIGHT_HIGH_CONTRAST_COLOR_SCHEME = "Sy Light.sublime-color-scheme";
/** @type {string} VS Code dark theme id. Built in; VS Code has no custom Sy theme — it layers tokenColorCustomizations over this. */
const VSCODE_DARK_COLOR_THEME = getTheme("vscode").dark;
/** @type {string} VS Code light theme id. Built in; see VSCODE_DARK_COLOR_THEME. */
const VSCODE_LIGHT_COLOR_THEME = getTheme("vscode").light;
/** @type {string} Zed fallback dark scheme. Built in; see APP_TO_THEMES_MAP. */
const ZED_DARK_COLOR_SCHEME = getTheme("zed").dark;
/** @type {string} Zed fallback light scheme. Built in; see APP_TO_THEMES_MAP. */
const ZED_LIGHT_COLOR_SCHEME = getTheme("zed").light;
/** @type {string} Zed custom dark scheme, generated from COLOR_MAP. */
const ZED_DARK_HIGH_CONTRAST_COLOR_SCHEME = "Sy Dark";
/** @type {string} Zed custom light scheme, generated from COLOR_MAP. */
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
      // Anchor to VS Code's actual directory names ("Code", "Code - Insiders").
      // A bare /Code/i would substring-match unrelated folders like "opencode".
      const foundAppPath = findPath(root, /^Code( - Insiders)?$/i, { type: "folder" });

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

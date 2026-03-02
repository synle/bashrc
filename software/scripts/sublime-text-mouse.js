// BEGIN software/scripts/editor.common.js
/** Color theme constants */
const SUBLIME_DARK_COLOR_SCHEME = "Monokai.sublime-color-scheme";
const SUBLIME_LIGHT_COLOR_SCHEME = "Breakers.sublime-color-scheme";
const SUBLIME_DARK_HIGH_CONTRAST_COLOR_SCHEME = "High Contrast Dark.sublime-color-scheme";
const SUBLIME_LIGHT_HIGH_CONTRAST_COLOR_SCHEME = "High Contrast Light.sublime-color-scheme";
const VSCODE_DARK_COLOR_THEME = "Default High Contrast";
const VSCODE_LIGHT_COLOR_THEME = "Default High Contrast Light";

/** Glob patterns for locating the Sublime Text binary across platforms */
const _SUBL_PATHS = [
  "/Applications/Sublime*Text.app/Contents/SharedSupport/bin/subl",
  "/mnt/c/Program*Files/Sublime*Text*/sublime*.exe",
  "/mnt/c/Program*Files/Sublime*Text*/subl*",
  "/opt/sublime_text/subl*",
  "/usr/bin/subl",
  "/usr/local/bin/subl",
];

/** Glob patterns for locating the VS Code / VSCodium binary across platforms */
const _CODE_PATHS = [
  "/mnt/c/Users/Sy*/AppData/Local/Programs/Microsoft*Code/Code.exe",
  "/mnt/c/Users/Le*/AppData/Local/Programs/Microsoft*Code/Code.exe",
  "/mnt/c/Program*Files/VSCodium/VSCodium.exe",
  "/mnt/c/Program*Files/Microsoft*VS*Code/Code.exe",
  "/usr/local/bin/codium",
  "/usr/local/bin/code",
  "/usr/bin/codium",
  "/usr/bin/code",
];

/**
 * Searches standard OS paths for VS Code and VSCodium installation directories.
 * @returns {string[]} Array of absolute paths to found VS Code/VSCodium config directories.
 */
function _getVSCodeAndVSCodiumPaths() {
  const res = [];
  const home = process.env.HOME || process.env.USERPROFILE;

  // 1. Initialize search roots with standard OS locations
  const searchRoots = [
    process.env.APPDATA, // Windows Native
    path.join(home, "Library/Application Support"), // macOS
    path.join(home, ".config"), // Linux Standard
    path.join(home, ".var/app/com.visualstudio.code/config"), // Linux Flatpak
    path.join(home, ".var/app/com.vscodium/config"), // Linux Flatpak
  ];

  // 2. Account for WSL and Git Bash Windows mounts
  // Iterates through C:\Users\* to find Roaming folders
  const windowsMounts = ["/mnt/c/Users", "/c/Users"];
  windowsMounts.forEach((mount) => {
    if (fs.existsSync(mount)) {
      try {
        const directoryItems = fs.readdirSync(mount);
        for (const item of directoryItems) {
          const roamingPath = path.join(mount, item, "AppData/Roaming");
          if (fs.existsSync(roamingPath)) {
            searchRoots.push(roamingPath);
          }
        }
      } catch (e) {
        // Skip folders with permission issues (like System folders)
      }
    }
  });

  // 3. Patterns for the apps we want to find
  const patterns = [/Code/i, /VSCodium/i];

  // 4. Execution logic using your findDirSingle method
  searchRoots.forEach((root) => {
    if (!root || !fs.existsSync(root)) return;

    patterns.forEach((pattern) => {
      try {
        // Use your method to find the matching directory (e.g., "Code")
        const foundAppPath = findDirSingle(root, pattern);

        if (foundAppPath && fs.existsSync(foundAppPath)) {
          // Normalize the path and ensure it's not already in the array
          const absolutePath = path.resolve(foundAppPath);
          if (!res.includes(absolutePath)) {
            res.push(absolutePath);
          }
        }
      } catch (err) {
        // Silent fail for locked directories
      }
    });
  });

  return res;
}

/**
 * Searches for the Sublime Text config directory based on the current OS.
 * @returns {Promise<string|null>} Path to the Sublime Text config directory, or null if not found.
 */
async function _getPathSublimeText() {
  exitIfLimitedSupportOs();
  const regexBinary = /Sublime[ -]*Text[0-9]*[0-9]*/i;

  try {
    if (is_os_windows) {
      return findDirSingle(getWindowAppDataRoamingUserPath(), regexBinary);
    }

    if (is_os_mac) {
      return findDirSingle(getOsxApplicationSupportCodeUserPath(), regexBinary);
    }

    if (is_os_arch_linux) {
      return findDirSingle(path.join(process.env.HOME, ".var/app/com.sublimetext.three/config"), regexBinary);
    }

    // for debian or chrome os debian linux
    return findDirSingle(BASE_HOMEDIR_LINUX + "/.config", regexBinary);
  } catch (err) {
    log(">>>> Failed to get the path", err);
  }

  return null;
}
// END software/scripts/editor.common.js

let SUBLIME_VERSION;

let OS_KEY;

const WINDOWS_OS_KEY = "alt";
const MAC_OSX_KEY = "super";
const LINUX_OS_KEY = "alt";

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
function _formatKey(mouseMaps, osKeyToUse) {
  osKeyToUse = osKeyToUse || OS_KEY;

  mouseMaps = clone(mouseMaps);

  for (const mouseMap of mouseMaps) {
    mouseMap.modifiers = mouseMap.modifiers?.map((s) => s.replace(/OS_KEY/g, osKeyToUse));
  }

  return mouseMaps;
}

/**
 * Resolves OS key, writes prebuilt mouse map configs per platform, and applies the config to the local Sublime Text installation.
 */
async function doWork() {
  exitIfLimitedSupportOs();
  OS_KEY = resolveOsKey({ windows: WINDOWS_OS_KEY, mac: MAC_OSX_KEY, linux: LINUX_OS_KEY });

  log(`>> Setting up Sublime Text MouseMaps`);

  // write to build file
  log(`>>> For prebuilt configs`);
  writeToBuildFile([
    { file: "sublime-text-mouse", data: _formatKey(MOUSE_MAPS, WINDOWS_OS_KEY), isJson: true },
    { file: "sublime-text-mouse-macosx", data: _formatKey(MOUSE_MAPS, MAC_OSX_KEY), isJson: true },
  ]);

  // for my own system
  let targetPath = await _getPathSublimeText();
  log(">>> For my system", targetPath);
  exitIfPathNotFound(targetPath);

  const fileDestPath = path.join(targetPath, "Packages/User/Default.sublime-mousemap");
  log(">>>> fileDestPath", fileDestPath);
  writeJson(fileDestPath, _formatKey(MOUSE_MAPS, is_os_mac ? MAC_OSX_KEY : WINDOWS_OS_KEY));
}

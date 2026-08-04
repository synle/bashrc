/** Shared constants for browser launcher scripts (Brave, Chrome, Edge, Chromium, Vivaldi, Opera, Arc). */

/** Glob patterns for locating the Brave Browser binary across platforms */
const _BRAVE_PATHS = [
  // macOS
  "/Applications/Brave*Browser.app/Contents/MacOS/Brave*Browser",

  // Windows (WSL paths)
  "/mnt/c/Program*Files/BraveSoftware/Brave-Browser/Application/brave.exe",
  "/mnt/c/Program*Files*86*/BraveSoftware/Brave-Browser/Application/brave.exe",
  "/mnt/c/Users/*/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe",

  // Linux
  "/usr/bin/brave-browser",
  "/usr/bin/brave-browser-stable",
  "/usr/bin/brave",
  "/opt/brave.com/brave/brave-browser",
  "/opt/brave.com/brave/brave",
  "/snap/bin/brave",
  "/var/lib/flatpak/exports/bin/com.brave.Browser",
];

/** Glob patterns for locating the Google Chrome binary across platforms */
const _CHROME_PATHS = [
  // macOS
  "/Applications/Google*Chrome.app/Contents/MacOS/Google*Chrome",

  // Windows (WSL paths)
  "/mnt/c/Program*Files/Google/Chrome/Application/chrome.exe",
  "/mnt/c/Program*Files*86*/Google/Chrome/Application/chrome.exe",
  "/mnt/c/Users/*/AppData/Local/Google/Chrome/Application/chrome.exe",

  // Linux
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/opt/google/chrome/google-chrome",
  "/opt/google/chrome/chrome",
  "/snap/bin/google-chrome",
  "/var/lib/flatpak/exports/bin/com.google.Chrome",
];

/** Glob patterns for locating the Microsoft Edge binary across platforms */
const _EDGE_PATHS = [
  // macOS
  "/Applications/Microsoft*Edge.app/Contents/MacOS/Microsoft*Edge",

  // Windows (WSL paths)
  "/mnt/c/Program*Files/Microsoft/Edge/Application/msedge.exe",
  "/mnt/c/Program*Files*86*/Microsoft/Edge/Application/msedge.exe",

  // Linux
  "/usr/bin/microsoft-edge",
  "/usr/bin/microsoft-edge-stable",
  "/opt/microsoft/msedge/microsoft-edge",
  "/opt/microsoft/msedge/msedge",
];

/** Glob patterns for locating the Chromium binary across platforms */
const _CHROMIUM_PATHS = [
  // macOS
  "/Applications/Chromium.app/Contents/MacOS/Chromium",

  // Windows (WSL paths)
  "/mnt/c/Program*Files/Chromium/Application/chrome.exe",
  "/mnt/c/Users/*/AppData/Local/Chromium/Application/chrome.exe",

  // Linux
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
  "/var/lib/flatpak/exports/bin/org.chromium.Chromium",
];

/** Glob patterns for locating the Vivaldi binary across platforms */
const _VIVALDI_PATHS = [
  // macOS
  "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi",

  // Windows (WSL paths)
  "/mnt/c/Program*Files/Vivaldi/Application/vivaldi.exe",
  "/mnt/c/Users/*/AppData/Local/Vivaldi/Application/vivaldi.exe",

  // Linux
  "/usr/bin/vivaldi",
  "/usr/bin/vivaldi-stable",
  "/opt/vivaldi/vivaldi",
];

/** Glob patterns for locating the Opera binary across platforms */
const _OPERA_PATHS = [
  // macOS
  "/Applications/Opera.app/Contents/MacOS/Opera",

  // Windows (WSL paths)
  "/mnt/c/Program*Files/Opera/opera.exe",
  "/mnt/c/Users/*/AppData/Local/Programs/Opera/opera.exe",

  // Linux
  "/usr/bin/opera",
  "/snap/bin/opera",
];

/** Glob patterns for locating the Arc browser binary (macOS-only) */
const _ARC_PATHS = [
  // macOS
  "/Applications/Arc.app/Contents/MacOS/Arc",
];

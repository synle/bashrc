/**
 * @file software/index.js - Bootstrap & utility library for the bashrc software setup system.
 *
 * This file serves two purposes:
 * 1. **Utility library** - Provides shared functions (file I/O, text processing, network,
 *    platform detection, console output) that individual setup scripts depend on.
 * 2. **Bootstrap entry point** - When executed directly, discovers and orchestrates the
 *    execution of platform-specific setup scripts via bash pipelines.
 *
 * Individual scripts (software/scripts/*.js) are fetched and evaluated with this file
 * pre-loaded, giving them access to all exported utilities as globals.
 *
 * @module software/index
 */

/**
 * Parses a value to a trimmed string, defaulting to empty string.
 * @param {*} v - The value to parse
 * @returns {string} The trimmed string representation
 */
const parseString = (v) => (v || "").trim();

/**
 * Parses a value to an integer.
 * With 2 arguments: (v, defaultValue) - returns parsed int or defaultValue on failure.
 * With 3 arguments: (v, minValue, maxValue) - clamps result between min and max (defaultValue is minValue).
 * @param {*} v - The value to parse
 * @param {number} [defaultValueOrMin] - Fallback value (2 args) or minimum value (3 args)
 * @param {number} [maxValue] - Maximum value (only when 3 args are provided)
 * @returns {number}
 */
const parseInteger = function (v) {
  let defaultValue, minValue, maxValue;
  if (arguments.length === 3) {
    // 3 arguments: (v, minValue, maxValue)
    minValue = arguments[1];
    maxValue = arguments[2];
    defaultValue = minValue;
  } else {
    // 2 arguments: (v, defaultValue)
    defaultValue = arguments[1];
  }

  let parsed = parseInt(parseString(v)) || defaultValue;
  if (minValue !== undefined) {
    parsed = Math.max(parsed, minValue);
  }
  if (maxValue !== undefined) {
    parsed = Math.min(parsed, maxValue);
  }
  return parsed;
};

/**
 * Parses a value to a boolean. Recognizes "true" (case-insensitive) and "1".
 * @param {*} v - The value to parse
 * @returns {boolean}
 */
const parseBoolean = (v) => parseString(v).toLowerCase() === "true" || parseInteger(v, 0) === 1;

/**
 * Retrieves a runtime option by key. Checks command-line arguments first (--key=value or -key=value),
 * then falls back to process.env. Uses the provided parse function to coerce the value.
 * @param {string} optionKey - The option key to look up
 * @param {function} [parseFunc=parseString] - Parser function to apply to the raw value
 * @returns {*} The parsed option value
 */
const getRuntimeOption = (optionKey, parseFunc = parseString) => {
  // check CLI args first: --optionKey=value or -optionKey=value
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(new RegExp(`^--?${optionKey}=(.*)$`));
    if (match) {
      return parseFunc(match[1]);
    }
  }
  // fallback to environment variable
  return parseFunc(process.env[optionKey] || "");
};

//////////////////////////////////////////////////////
// Arg Parsing (from BASHRC_RAW_ARGS)
//////////////////////////////////////////////////////

/**
 * Loads the presets map from the PRESETS_JSON env var (set by run.sh from software/metadata/presets.json).
 * Each preset is a named file-list bundle that --preset=<name> expands into.
 * @returns {Record<string, { description?: string, files?: string[] }>}
 */
function loadPresets() {
  const raw = process.env.PRESETS_JSON || "{}";
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Parses the raw CLI arguments passed from run.sh via the BASHRC_RAW_ARGS env var.
 * Sets process.env variables (TEST_SCRIPT_FILES, IS_FORCE_REFRESH, etc.)
 * so that subsequent getRuntimeOption() calls pick them up.
 * Must be called before any getRuntimeOption() reads of flag env vars.
 * @returns {{ files: string, forceRefresh: boolean, refreshFiles: string, debug: boolean, dryrun: boolean, remove: boolean, presets: string[], setup: boolean }}
 */
function parseRawArgs() {
  const rawJson = process.env.BASHRC_RAW_ARGS || "[]";
  let args;
  try {
    args = JSON.parse(rawJson);
  } catch {
    args = [];
  }

  let files = "";
  let refreshFiles = "";
  let forceRefresh = false;
  let setup = false;
  let debug = false;
  let dryrun = false;
  let remove = false;
  /** @type {string[]} Preset names requested via --preset= or --presets= (composable). */
  const presets = [];

  for (const arg of args) {
    if (/^-?-files=/.test(arg)) {
      const val = arg.replace(/^-?-files=/, "").trim();
      if (val) files = files ? `${files},${val}` : val;
    } else if (/^-?-refresh=/.test(arg)) {
      const val = arg.replace(/^-?-refresh=/, "").trim();
      if (val) {
        files = files ? `${files},${val}` : val;
        refreshFiles = refreshFiles ? `${refreshFiles},${val}` : val;
      }
      forceRefresh = true;
    } else if (/^-?-(force-refresh|force|f)$/.test(arg)) {
      forceRefresh = true;
    } else if (/^-?-presets?=/.test(arg)) {
      const val = arg.replace(/^-?-presets?=/, "").trim();
      if (val) {
        for (const name of val
          .split(/[,;\s]/)
          .map((s) => s.trim())
          .filter(Boolean)) {
          presets.push(name);
        }
      }
    } else if (/^-?-(setup|is-setup)$/.test(arg)) {
      setup = true;
    } else if (/^-?-(debug|D)$/.test(arg)) {
      debug = true;
    } else if (/^-?-(dryrun|dry-run)$/.test(arg)) {
      dryrun = true;
    } else if (/^-?-remove$/.test(arg)) {
      remove = true;
    } else if (/^-?-no-color$/.test(arg)) {
      process.env.NO_COLOR = "1";
    } else if (!arg.startsWith("-")) {
      files = files ? `${files},${arg}` : arg;
    }
  }

  // Expand presets last so explicit --files= and presets compose.
  // Files: union (preset files appended in order).
  // Name resolution: exact match wins. If no exact match, try case-insensitive
  // substring match — exactly one hit auto-resolves; zero hits or 2+ hits error.
  if (presets.length > 0) {
    const presetMap = loadPresets();
    const known = Object.keys(presetMap);
    for (let i = 0; i < presets.length; i++) {
      const name = presets[i];
      let resolvedName = name;
      let preset = presetMap[name];

      // Fuzzy fallback: case-insensitive substring match across known preset names.
      if (!preset) {
        const needle = name.toLowerCase();
        const matches = known.filter((k) => k.toLowerCase().includes(needle));
        if (matches.length === 1) {
          resolvedName = matches[0];
          preset = presetMap[resolvedName];
        } else if (matches.length > 1) {
          const suggestions = matches.map((m) => `  bash run.sh --preset=${m}`).join("\n");
          throw new Error(
            `Preset "${name}" is ambiguous — matched ${matches.length}: ${matches.join(", ")}.\n` + `Pick one and re-run:\n${suggestions}`,
          );
        }
      }

      if (!preset) {
        const list = known.length ? known.join(", ") : "(none defined)";
        throw new Error(`Unknown preset "${name}". Available presets: ${list}`);
      }

      // Replace the user's input with the canonical name so debug output / printRunInfo
      // reflect what actually ran.
      presets[i] = resolvedName;

      if (Array.isArray(preset.files)) {
        for (const f of preset.files) {
          if (f) files = files ? `${files},${f}` : f;
        }
      }
    }
  }

  if (files) process.env.TEST_SCRIPT_FILES = files;
  if (refreshFiles) process.env.REFRESH_FILES = refreshFiles;
  if (forceRefresh) process.env.IS_FORCE_REFRESH = "1";
  if (setup) process.env.IS_SETUP = "1";
  if (debug) process.env.IS_DEBUG = "1";
  if (dryrun) process.env.IS_DRY_RUN = "1";
  if (remove) process.env.IS_REMOVE_MODE = "1";

  return { files, forceRefresh, refreshFiles, debug, dryrun, remove, presets, setup };
}

/** @type {{ files: string, forceRefresh: boolean, refreshFiles: string, debug: boolean, dryrun: boolean, remove: boolean, presets: string[], setup: boolean }} */
const _parsedArgs = parseRawArgs();

//////////////////////////////////////////////////////
// Global Imports & Path Constants
//////////////////////////////////////////////////////
process.env.TZ = "UTC";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec, execSync } = require("child_process");
/** @type {string} Base home directory path for the current user. Read from env var set by run.sh before any sudo runs. RHEL/Fedora sudoers has `always_set_home` which resets $HOME to /root even with `sudo -E`, and os.homedir() reads /etc/passwd which also returns /root. This custom env var survives sudo because sudoers only resets HOME, not arbitrary vars. Falls back to os.homedir() for non-run.sh contexts (tests, direct invocation). */
const BASE_HOMEDIR_LINUX = process.env.BASE_HOMEDIR_LINUX || process.env.HOME || os.homedir();

/** @type {string} Path to the main ~/.bash_syle profile file */
const BASH_SYLE_PATH = getRuntimeOption("BASH_SYLE_PATH");
/** @type {string} Path to the ~/.bash_syle_common shared config file */
const BASH_SYLE_COMMON_PATH = getRuntimeOption("BASH_SYLE_COMMON_PATH");
/** @type {string} Path to the ~/.powershell_syle working copy of the PowerShell profile */
const POWERSHELL_SYLE_PATH = path.join(BASE_HOMEDIR_LINUX, ".powershell_syle");

/** @type {string} Target Node.js version for fnm to install */
const NODE_JS_VERSION = getRuntimeOption("NODE_JS_VERSION");
/** @type {string} Path to the fnm (Fast Node Manager) installation directory */
const FNM_DIR = getRuntimeOption("FNM_DIR");
/** @type {string} Path to the default Node.js binary managed by fnm */
const FNM_DEFAULT_NODE_PATH = getRuntimeOption("FNM_DEFAULT_NODE_PATH");
/** @type {string} Base URL for fetching raw files from the repo (e.g. GitHub raw content URL) */
const BASH_PROFILE_CODE_REPO_RAW_URL = getRuntimeOption("BASH_PROFILE_CODE_REPO_RAW_URL");
/** @type {string} GitHub repo identifier in "owner/repo" format */
const REPO_PATH_IDENTIFIER = getRuntimeOption("REPO_PATH_IDENTIFIER");
/** @type {string} Git branch name to fetch remote content from */
const REPO_BRANCH_NAME = getRuntimeOption("REPO_BRANCH_NAME");
/** @type {string} Hardcoded build output directory for writeBuildArtifact */
const BUILD_DIR = ".build";
/** @type {string} Comma-separated list of specific script files to run (empty for full run) */
const TEST_SCRIPT_FILES = getRuntimeOption("TEST_SCRIPT_FILES");
/** @type {boolean} When true, prints active OS detection flags at startup */
const SHOULD_PRINT_OS_FLAGS = getRuntimeOption("SHOULD_PRINT_OS_FLAGS", parseBoolean);
/** @type {boolean} When true, deletes and re-downloads resources before installing */
const IS_FORCE_REFRESH = getRuntimeOption("IS_FORCE_REFRESH", parseBoolean);
/** @type {boolean} When true, reads files from disk instead of fetching remotely. Auto-detected from CWD. */
const IS_LOCAL_REPO = fs.existsSync("software/index.js");
/** @type {boolean} When true, runs setup mode (bootstrap dependencies + software scripts) */
const IS_SETUP = getRuntimeOption("IS_SETUP", parseBoolean);
/** @type {boolean} When true, keeps temp scripts and shows retry commands in progress output */
const IS_DEBUG = getRuntimeOption("IS_DEBUG", parseBoolean);
/**
 * Checks whether ~/.bash_syle is missing or older than two weeks.
 * @returns {boolean} True when ~/.bash_syle is missing or older than two weeks
 */
function isBashSyleStale() {
  return isPathStale(BASH_SYLE_PATH);
}
/** @type {boolean} When true, shows what would change without writing any files or executing commands */
const IS_DRY_RUN = getRuntimeOption("IS_DRY_RUN", parseBoolean);
/** @type {boolean} When true, runs undoWork() to remove a script's config blocks instead of doWork() */
const IS_REMOVE_MODE = getRuntimeOption("IS_REMOVE_MODE", parseBoolean);
/** @type {Set<string>} Set of script basenames targeted for refresh (bypasses staleness checks) */
const REFRESH_FILES = new Set(
  getRuntimeOption("REFRESH_FILES")
    .split(/[,;\s]/)
    .map((s) => s.trim())
    .filter((s) => !!s),
);
/** @type {boolean} When true, bypasses staleness checks so isPathStale/isForceRefreshStale always return true. Set per-script by _runScripts via IS_REFRESH_MODE env var. */
const IS_REFRESH_MODE = getRuntimeOption("IS_REFRESH_MODE", parseBoolean);

/**
 * Checks whether a script file is targeted by --refresh=.
 * Matches against REFRESH_FILES by basename or full path.
 * @param {string} file - The script file path or basename to check
 * @returns {boolean} True if the file is in the refresh list
 */
function _isRefreshTarget(file) {
  if (REFRESH_FILES.has(file)) return true;
  const basename = path.basename(file);
  if (REFRESH_FILES.has(basename)) return true;
  for (const entry of REFRESH_FILES) {
    if (file.endsWith(entry) || basename === path.basename(entry)) return true;
  }
  return false;
}

/** @type {boolean} When true, indicates running in a CI environment (GitHub Actions sets CI=true automatically) */
const IS_CI = getRuntimeOption("CI", parseBoolean);
/** @type {boolean} When true, disables ANSI color codes in log output (follows no-color.org convention) */
const IS_NO_COLOR = getRuntimeOption("NO_COLOR", parseBoolean);
/** @type {string} Current system username (falls back to USER env var or "unknown") */
const CURRENT_USER = process.env.USER || process.env.USERNAME || "unknown";
/** @type {string} Hardcoded repo owner username, set in common-env.sh */
const REPO_USER_NAME = getRuntimeOption("REPO_USER_NAME") || "syle";
/** @type {string} Git global user email, resolved from git config at shell time via common-env.sh */
const REPO_USER_EMAIL = getRuntimeOption("REPO_USER_EMAIL");
/** @type {string} Full URL prefix for raw GitHub content (derived from BASH_PROFILE_CODE_REPO_RAW_URL) */
const REPO_PREFIX_URL = `${BASH_PROFILE_CODE_REPO_RAW_URL}/`;

/**
 * Constructs a GitHub raw content URL for a file in this repo.
 * Appends ?raw=1 to the blob URL so GitHub returns raw file content.
 * @param {string} filePath - Relative path within the repo (e.g. "software/bootstrap/setup.sh")
 * @returns {string} Full raw content URL
 */
function getGitHubRawUrl(filePath) {
  return `${REPO_PREFIX_URL}${filePath}?raw=1`;
}

/** @type {string} Temp directory for the current run (set by common-env.sh, e.g. /tmp/synle/bashrc/2026_03_24_14_00) */
const BASHRC_TEMP_DIR = getRuntimeOption("BASHRC_TEMP_DIR");
/** @type {string} Prefix for all temp script files written during execution (inside BASHRC_TEMP_DIR or /tmp fallback) */
const TEMP_SCRIPT_PREFIX = BASHRC_TEMP_DIR ? `${BASHRC_TEMP_DIR}/sw_` : "/tmp/bashrc_syle_sw_";
/** @type {string} Path to the download asset metadata log file for tracking download status */
const DOWNLOAD_ASSET_METADATA_PATH = `${TEMP_SCRIPT_PREFIX}download_asset_metadata.log`;
/** @type {number} Console line break width for separator lines (default 80) */
const LINE_BREAK_COUNT = getRuntimeOption("LINE_BREAK_COUNT", (v) => parseInteger(v, 80));
/** @type {number} Code print width for formatting (default 140) */
const PRINT_WIDTH_BREAK_COUNT = getRuntimeOption("PRINT_WIDTH_BREAK_COUNT", (v) => parseInteger(v, 140));

/**
 * Tracks the processing status of each script file during execution.
 * @type {Array<{file: string, path: string, script: string, tempFileCommand: string, status: 'success'|'error', fileMatchState: string|undefined, description: string, bundleLabel: string}>}
 */
const scriptProcessingResults = [];

/** @type {number} Auto-incrementing counter for bundle IDs (only used for multi-script bundles). */
let _bundleIdCounter = 0;

/** @type {{ file: string, isRefresh: boolean, pct: string, bundleLabel: string, fn: { doWork?: Function, undoWork?: Function } }[]} */
const _bundled_scripts = [];

/**
 * Registers a script into the bundle by executing its scope function and extracting doWork/undoWork.
 * @param {string} file - The script file path
 * @param {boolean} isRefresh - Whether this is a refresh target
 * @param {string} pct - Progress percentage string
 * @param {string} bundleLabel - Bundle label for logging
 * @param {() => { doWork?: Function, undoWork?: Function }} scopeFn - Callback that returns the script's exports
 */
function _registerBundledScript(file, isRefresh, pct, bundleLabel, scopeFn) {
  const fn = scopeFn() || {};
  _bundled_scripts.push({ file, isRefresh, pct, bundleLabel, fn });
}

/** @type {Record<string, Promise>} In-memory promise cache for cacheInMemory. */
const _inMemoryCache = {};

/**
 * Caches the result of an async callback in memory by key. Returns the cached value on subsequent calls with the same key.
 * On failure, clears the cache entry so the next call retries, and returns the fallback value.
 * @param {string} key - Cache key
 * @param {function(): Promise} fn - Async callback to execute on cache miss
 * @param {*} [fallback] - Value to return on error
 * @returns {Promise} Cached result or fallback on error
 */
async function cacheInMemory(key, fn, fallback) {
  if (!_inMemoryCache[key]) _inMemoryCache[key] = fn();
  try {
    const result = await _inMemoryCache[key];
    _resolvedCache[key] = result;
    return result;
  } catch (_) {
    delete _inMemoryCache[key];
    return fallback;
  }
}

/** @type {Record<string, *>} Resolved cache values for synchronous access via getCachedValue. */
const _resolvedCache = {};

/**
 * Synchronously retrieves a previously cached value from cacheInMemory. Returns undefined if not yet cached or resolved.
 * @param {string} key - Cache key to look up
 * @returns {*} The cached value, or undefined if not available
 */
function getCachedValue(key) {
  return _resolvedCache[key];
}

//////////////////////////////////////////////////////
// Editor Configuration
//////////////////////////////////////////////////////
/** @type {number} Default editor font size */
const DEFAULT_FONT_SIZE = 16;
/** @type {number} Editor font size (min 10, default 16). Override with FONT_SIZE env var */
const fontSize = getRuntimeOption("FONT_SIZE", (v) => parseInteger(v, DEFAULT_FONT_SIZE));
/** @type {number} Editor tab/indentation size (min 2, default 2). Override with TAB_SIZE env var */
const tabSize = getRuntimeOption("TAB_SIZE", (v) => parseInteger(v, 2));
/** @type {string} Editor font family (default 'Fira Code'). Override with FONT_FAMILY env var */
const fontFamily = getRuntimeOption("FONT_FAMILY") || "Fira Code";
/** @type {string} Editor font weight keyword (default 'bold'). Override with FONT_WEIGHT_KEYWORD env var */
const fontWeightKeyword = getRuntimeOption("FONT_WEIGHT_KEYWORD") || "bold";
/** @type {number} Editor font weight number (default 700). Override with FONT_WEIGHT_NUMBER env var */
const fontWeightNumber = getRuntimeOption("FONT_WEIGHT_NUMBER", (v) => parseInteger(v, 700));

/**
 * Editor configuration object containing font settings, tab size, max line length,
 * and ignore lists for files, folders, and binaries.
 * @type {Object}
 * @property {number} fontSize - Editor font size (min 10, default 16). Override with FONT_SIZE env var
 * @property {string} fontFamily - Editor font family (default 'Fira Code'). Override with FONT_FAMILY env var
 * @property {string} fontWeightKeyword - Editor font weight keyword (default 'bold'). Override with FONT_WEIGHT_KEYWORD env var
 * @property {number} fontWeightNumber - Editor font weight number (default 700). Override with FONT_WEIGHT_NUMBER env var
 * @property {number} tabSize - Editor tab/indentation size (min 2, default 2). Override with TAB_SIZE env var
 * @property {number} maxLineSize - Print/ruler column width in the editor (default 140)
 * @property {string[]} junkFiles - File patterns to delete during cleanup (macOS metadata, OS artifacts, patch rejects)
 * @property {string[]} junkDirs - Directory names to delete during cleanup (macOS/OS artifact directories)
 * @property {string[]} ignoredFiles - Glob patterns for files hidden from the editor (e.g. '*.exe', '.DS_Store')
 * @property {string[]} ignoredFolders - Directory names excluded from the editor file tree (e.g. 'node_modules', '.git')
 * @property {string[]} ignoredFoldersRegex - Regex patterns of folder paths to skip in shell file walking (used by bash-fzf)
 * @property {string[]} ignoredFilesRegex - Regex patterns ($-anchored) for files to exclude from the fuzzy picker
 * @property {string[]} textFilesRegex - Regex allowlist ($-anchored) for the fuzzy picker `text_files` mode
 */
const EDITOR_CONFIGS = {
  fontSize,
  fontFamily,
  fontWeightKeyword,
  fontWeightNumber,
  fontSizeDefaultFallback: DEFAULT_FONT_SIZE,
  fontFamilyDefaultFallback: "Courier New",
  tabSize,
  /** Print/ruler column width in the editor @type {number} */
  maxLineSize: PRINT_WIDTH_BREAK_COUNT,
  /** Terminal scrollback buffer size in lines @type {number} */
  terminalScrollback: 200000,
  /** Max depth for nested autocomplete tokens and cleanup searches @type {number} */
  maxNestedDepth: 3,
  /** Junk files to delete during cleanup (macOS metadata, OS artifacts, patch rejects) @type {string[]} */
  junkFiles: [
    "._*",
    ".AppleDouble",
    ".DS_Store",
    ".LSOverride",
    "*.Identifier",
    "*.orig",
    "*.rej",
    "Desktop.ini",
    "ehthumbs.db",
    "Icon?",
    "Thumbs.db",
  ],
  /** Junk directories to delete during cleanup @type {string[]} */
  junkDirs: [".Spotlight-V100", ".Trashes", ".fseventsd", "__MACOSX"],
  /**
   * File glob patterns hidden from the editor entirely (sidebar + search).
   * - Sublime Text: file_exclude_patterns (hidden from sidebar and Goto Anything)
   * - VS Code: files.exclude + search.exclude (hidden from sidebar and search)
   * - Zed: file_scan_exclusions (hidden from file scan)
   * - Shell: used by _fuzzy_list_all text_files mode (hardcoded fallback in bash-fzf.profile.bash)
   * @type {string[]}
   */
  ignoredFiles: [
    // OS junk
    "._*", // macOS resource fork files
    ".AppleDouble", // macOS AppleDouble files
    ".DS_Store", // macOS folder metadata
    ".LSOverride", // macOS Launch Services override
    ".Spotlight-*", // macOS Spotlight index
    ".Trashes", // macOS Trash metadata
    "Desktop.ini", // Windows folder config
    "ehthumbs.db", // Windows thumbnail cache
    "Thumbs.db", // Windows thumbnail cache

    // Editor/IDE artifacts
    "*.code-search", // VS Code search results
    "*.Identifier", // MSVC identifier file
    "*.sublime-workspace", // Sublime Text workspace state
    "*.suo", // Visual Studio user options
    "*.swp", // Vim swap file

    // Lint/build caches
    ".eslintcache", // ESLint cache
    "*.stylelintcache", // Stylelint cache
    "*.tsbuildinfo", // TypeScript incremental build cache

    // Source maps and minified
    "*.js.map", // JavaScript source map
    "*.map", // generic source map
    "*.min.js", // minified JavaScript

    // Lock files
    "bun.lockb", // Bun binary lock file
    "package-lock.json", // npm lock file
    "pnpm-lock.yaml", // pnpm lock file
    "yarn.lock", // Yarn lock file

    // VCS merge artifacts
    "*.orig", // merge original backup
    "*.rej", // patch reject file

    // Process files
    "*.pid", // process ID file
    "*.pid.lock", // process ID lock file

    // Python
    "*.egg", // Python egg package
    "*.egg-info", // Python egg metadata
    "*.py[cod]", // Python compiled/optimized/debug
    "*.pyc", // Python compiled bytecode
    "*.pyo", // Python optimized bytecode
    "*.seed", // Python seed file

    // Binary/compiled (hidden from sidebar and search)
    "*.7z", // 7-Zip archive
    "*.a", // static library (C/C++)
    "*.aac", // audio
    "*.apk", // Android package
    "*.avi", // video
    "*.bmp", // bitmap image
    "*.bz2", // bzip2 archive
    "*.class", // Java compiled class
    "*.db", // database file
    "*.dds", // DirectDraw Surface texture
    "*.deb", // Debian package
    "*.dll", // Windows dynamic library
    "*.dmg", // macOS disk image
    "*.doc", // Word document (legacy)
    "*.docx", // Word document
    "*.dylib", // macOS dynamic library
    "*.eot", // Embedded OpenType font
    "*.exe", // Windows executable
    "*.flac", // lossless audio
    "*.flv", // Flash video
    "*.gif", // animated/static image
    "*.gz", // gzip archive
    "*.heic", // Apple HEIF image
    "*.ico", // icon file
    "*.idb", // MSVC incremental linker database
    "*.jar", // Java archive
    "*.jpeg", // JPEG image
    "*.jpg", // JPEG image
    "*.lib", // Windows static library
    "*.mkv", // Matroska video
    "*.mov", // QuickTime video
    "*.mp3", // audio
    "*.mp4", // video
    "*.msi", // Windows installer
    "*.ncb", // MSVC IntelliSense database
    "*.o", // compiled object file (C/C++)
    "*.obj", // compiled object file (Windows)
    "*.ogg", // Ogg audio/video
    "*.pdb", // MSVC program database
    "*.pdf", // PDF document
    "*.png", // PNG image
    "*.ppt", // PowerPoint (legacy)
    "*.pptx", // PowerPoint
    "*.psd", // Photoshop document
    "*.rar", // RAR archive
    "*.rpm", // Red Hat package
    "*.sdf", // MSVC SQL Server Compact database
    "*.so", // Unix shared library
    "*.sqlite", // SQLite database
    "*.svg", // SVG image (often large/generated)
    "*.swf", // Shockwave Flash
    "*.tar", // tape archive
    "*.tga", // Targa image
    "*.tiff", // TIFF image
    "*.ttf", // TrueType font
    "*.wasm", // WebAssembly binary
    "*.wav", // uncompressed audio
    "*.webp", // WebP image
    "*.wmv", // Windows Media video
    "*.woff", // Web Open Font Format
    "*.woff2", // Web Open Font Format v2
    "*.xls", // Excel (legacy)
    "*.xlsx", // Excel
    "*.xz", // xz archive
    "*.zip", // ZIP archive
  ],
  /**
   * Folder names hidden from the editor entirely (sidebar + search).
   * - Sublime Text: folder_exclude_patterns (hidden from sidebar and Goto Anything)
   * - VS Code: files.exclude + search.exclude + files.watcherExclude (hidden from sidebar, search, and file watcher)
   * - Zed: file_scan_exclusions (hidden from file scan)
   * - Shell: used by _fuzzy_list_all folder filtering (hardcoded fallback in bash-fzf.profile.bash)
   * @type {string[]}
   */
  ignoredFolders: [
    ".angular", // Angular CLI cache
    ".astro", // Astro build cache
    ".bundle", // Ruby Bundler cache
    ".cache", // generic tool cache (eslint, prettier, etc.)
    ".docusaurus", // Docusaurus build cache
    ".ebextensions", // AWS Elastic Beanstalk config
    ".eggs", // Python setuptools eggs
    ".generated", // auto-generated code output
    ".git", // Git repository data
    ".gradle", // Gradle build cache (Java/Kotlin/Android)
    ".hg", // Mercurial repository data
    ".hypothesis", // Python Hypothesis test cache
    ".idea", // JetBrains IDE config (IntelliJ, WebStorm, PyCharm)
    ".mypy_cache", // Python mypy type checker cache
    ".next", // Next.js build output
    ".nox", // Python Nox test runner sessions
    ".nuxt", // Nuxt.js build output
    ".nx", // Nx monorepo cache
    ".parcel-cache", // Parcel bundler cache
    ".pnpm-store", // pnpm package store
    ".pytest_cache", // Python pytest cache
    ".ruff_*", // Python Ruff linter versioned caches
    ".ruff_cache", // Python Ruff linter cache
    ".sass-cache", // Sass/SCSS compiler cache
    ".serverless", // Serverless Framework build output
    ".svelte-kit", // SvelteKit build output
    ".svn", // Subversion repository data
    ".terraform", // Terraform providers and state
    ".tox", // Python Tox test runner environments
    ".turbo", // Turborepo build cache
    ".uv", // Python uv package manager cache
    ".venv", // Python virtual environment
    ".yarn", // Yarn Berry (v2+) cache and plugins
    "__pycache*", // Python bytecode cache (glob)
    "__pycache__", // Python bytecode cache
    "__pypackages__", // Python PDM local packages
    "bower_components", // Bower package dependencies (legacy)
    "build", // common build output directory
    "coverage", // test coverage reports
    "CVS", // CVS version control data
    "dist", // distribution/build output
    "htmlcov", // Python coverage.py HTML report
    "node_modules", // Node.js package dependencies
    "target", // Rust/Maven/Gradle build output
    "tmp", // temporary files
    "vendor", // Go/PHP vendored dependencies
    "venv", // Python virtual environment (alternate name)
    "webpack-dist", // Webpack build output
  ],
  /**
   * Regex patterns for folder paths to skip in shell file walking.
   * Curated subset of `ignoredFolders` — smaller, perf-tuned regex used by the
   * fuzzy file picker and the `filter_unwanted` pipe filter. Editor configs use
   * the broader `ignoredFolders` glob list above.
   * Used by:
   * - bash-fzf `filter_unwanted` (joined with `|` for `grep -v -E`)
   * - bash-fzf `_fuzzy_list_all` (passed as JSON to inline node BFS)
   * Emitted into the live profile by `software/scripts/advanced/fuzzy-patterns.js`.
   * @type {string[]}
   */
  ignoredFoldersRegex: [
    "\\.DS_Store",
    "\\.angular/", // Angular CLI cache
    "\\.cache/",
    "\\.git/",
    "\\.gradle/",
    "\\.hg/",
    "\\.idea/",
    "\\.ipynb_checkpoints/", // Jupyter auto-save
    "\\.mypy_cache/",
    "\\.next/",
    "\\.nuxt/",
    "\\.parcel-cache/",
    "\\.pyc",
    "\\.pytest_cache/",
    "\\.ruff_",
    "\\.sass-cache/",
    "\\.svelte-kit/", // SvelteKit build
    "\\.svn/",
    "\\.terraform/", // Terraform provider plugins / state
    "\\.tox/",
    "\\.turbo/",
    "\\.uv/",
    "\\.venv/",
    "\\.yarn/",
    "__pycache",
    "bower_components",
    "node_modules",
    "/build/",
    "/coverage/",
    "/cov/",
    "/DerivedData/", // Xcode build cache
    "/dist/",
    "/htmlcov/",
    "/out/",
    "/Pods/", // iOS CocoaPods
    "/target/",
    "/vendor/",
  ],
  /**
   * Regex patterns (anchored with `$` for filename suffixes) for files to exclude
   * from the fuzzy file picker.
   * Used by bash-fzf `_fuzzy_list_all` (paths/files modes).
   * Emitted into the live profile by `software/scripts/advanced/fuzzy-patterns.js`.
   * @type {string[]}
   */
  ignoredFilesRegex: [
    "\\.DS_Store$",
    "Thumbs\\.db$",
    "desktop\\.ini$",
    "\\.Spotlight-",
    "\\.Trashes$",
    "\\.fseventsd$",
    "\\.com\\.apple\\.",
    "\\.localized$",
    "\\.a$",
    "\\.class$",
    "\\.dll$",
    "\\.dylib$",
    "\\.exe$",
    "\\.lib$",
    "\\.o$",
    "\\.obj$",
    "\\.pyc$",
    "\\.pyo$",
    "\\.so$",
    "\\.swo$", // vim swap file (companion to .swp)
    "\\.swp$", // vim swap file
    "\\.wasm$",
  ],
  /**
   * Regex allowlist (anchored with `$`) for the `text_files` mode of the fuzzy
   * file picker. Files whose name does not match any of these patterns are
   * filtered out. Covers extensions and well-known config filenames.
   * Used by bash-fzf `_fuzzy_list_all` (text_files mode).
   * Emitted into the live profile by `software/scripts/advanced/fuzzy-patterns.js`.
   * @type {string[]}
   */
  textFilesRegex: [
    "\\.bash$",
    "\\.c$",
    "\\.cfg$",
    "\\.clj$",
    "\\.cmake$",
    "\\.coffee$",
    "\\.conf$",
    "\\.cpp$",
    "\\.cs$",
    "\\.css$",
    "\\.csv$",
    "\\.dart$",
    "\\.diff$",
    "\\.dockerfile$",
    "\\.el$",
    "\\.elm$",
    "\\.env$",
    "\\.erl$",
    "\\.ex$",
    "\\.fish$",
    "\\.go$",
    "\\.graphql$",
    "\\.groovy$",
    "\\.h$",
    "\\.hpp$",
    "\\.hs$",
    "\\.html$",
    "\\.ini$",
    "\\.java$",
    "\\.js$",
    "\\.json$",
    "\\.jsonc$",
    "\\.jsx$",
    "\\.kt$",
    "\\.less$",
    "\\.lisp$",
    "\\.log$",
    "\\.lua$",
    "\\.m$",
    "\\.md$",
    "\\.mk$",
    "\\.ml$",
    "\\.nim$",
    "\\.nix$",
    "\\.php$",
    "\\.pl$",
    "\\.proto$",
    "\\.ps1$",
    "\\.py$",
    "\\.r$",
    "\\.rb$",
    "\\.rs$",
    "\\.rst$",
    "\\.sass$",
    "\\.scala$",
    "\\.scss$",
    "\\.sh$",
    "\\.sql$",
    "\\.svelte$",
    "\\.swift$",
    "\\.tcl$",
    "\\.tex$",
    "\\.tf$",
    "\\.toml$",
    "\\.ts$",
    "\\.tsx$",
    "\\.txt$",
    "\\.v$",
    "\\.vim$",
    "\\.vue$",
    "\\.xml$",
    "\\.yaml$",
    "\\.yml$",
    "\\.zig$",
    "\\.zsh$",
    "Dockerfile$",
    "Makefile$",
    "Rakefile$",
    "Gemfile$",
    "Vagrantfile$",
    "\\.gitignore$",
    "\\.gitattributes$",
    "\\.editorconfig$",
    "\\.eslintrc$",
    "\\.prettierrc$",
    "\\.babelrc$",
  ],
};

//////////////////////////////////////////////////////
// Host Config
//////////////////////////////////////////////////////
/**
 * Flattened array of IP-to-hostname entries loaded from .build/ip-address.config.hostnamesFlattened.
 * Populated at bootstrap time; empty array on failure.
 * @type {Array<*>}
 */
let HOME_HOST_NAMES = [];

//////////////////////////////////////////////////////
// OS Flags
//////////////////////////////////////////////////////
/**
 * OS detection flags and script path mappings.
 *
 * Flags are set by software/bootstrap/common-env.sh based on platform detection and exported
 * as environment variables (e.g. `is_os_mac=1`). This section reads them into JS.
 *
 * Convention: each flag follows the pattern `is_os_<name>`, where `<name>` maps
 * directly to a folder under `software/scripts/<name>/` containing OS-specific scripts.
 *
 * Flag               | Env Variable          | Script Folder                     | Platforms
 * -------------------|-----------------------|-----------------------------------|------------------------------
 * is_os_mac          | is_os_mac=1           | software/scripts/mac/             | macOS (darwin)
 * is_os_ubuntu       | is_os_ubuntu=1        | software/scripts/ubuntu/          | Ubuntu, Debian, Mint
 * is_os_chromeos     | is_os_chromeos=1      | software/scripts/chromeos/        | ChromeOS
 * is_os_mingw64      | is_os_mingw64=1       | software/scripts/mingw64/         | MSYS2 / Cygwin / MinGW64
 * is_os_android_termux | is_os_android_termux=1 | software/scripts/android_termux/ | Android Termux
 * is_os_arch_linux   | is_os_arch_linux=1    | software/scripts/arch_linux/      | Arch Linux, SteamOS
 * is_os_steamos      | is_os_steamos=1       | software/scripts/steamos/         | SteamOS
 * is_os_redhat       | is_os_redhat=1        | software/scripts/redhat/          | Fedora, RHEL, CentOS, Rocky
 * is_os_windows       | is_os_windows=1        | software/scripts/windows/         | Windows (WSL /mnt/c detected)
 * is_os_wsl          | is_os_wsl=1           | software/scripts/wsl/             | Windows Subsystem for Linux
 *
 * Flags without a script folder are still used for conditional logic in individual scripts
 * (e.g. `exitIfUnsupportedOs()`, platform-specific file paths).
 *
 * OS_SCRIPT_PATHS is built dynamically: for each `is_os_*` env var, the corresponding
 * `software/scripts/<name>/` path is added as [flagValue, folderPath].
 * This is used by getSoftwareScriptFiles() to exclude non-matching OS folders.
 */

/** @type {Array<[boolean, string]>} OS flag values paired with their script folder paths */
const OS_SCRIPT_PATHS = [];
Object.keys(process.env)
  .filter((envKey) => envKey.indexOf("is_os_") === 0)
  .forEach((envKey) => {
    global[envKey] = getRuntimeOption(envKey, parseBoolean);
    const scriptPath = `software/scripts/${envKey.replace("is_os_", "")}`;
    OS_SCRIPT_PATHS.push([global[envKey], scriptPath]);
  });

// Explicit const declarations so tsc emits these in the .d.ts (see table above)
/** @type {boolean} macOS (darwin) */ const is_os_mac = !!global.is_os_mac;
/** @type {boolean} Ubuntu, Debian, Mint */ const is_os_ubuntu = !!global.is_os_ubuntu;
/** @type {boolean} ChromeOS */ const is_os_chromeos = !!global.is_os_chromeos;
/** @type {boolean} MSYS2 / Cygwin / MinGW64 */ const is_os_mingw64 = !!global.is_os_mingw64;
/** @type {boolean} Android Termux */ const is_os_android_termux = !!global.is_os_android_termux;
/** @type {boolean} Arch Linux, SteamOS */ const is_os_arch_linux = !!global.is_os_arch_linux;
/** @type {boolean} SteamOS */ const is_os_steamos = !!global.is_os_steamos;
/** @type {boolean} Fedora, RHEL, CentOS, Rocky */ const is_os_redhat = !!global.is_os_redhat;
/** @type {boolean} Windows (WSL /mnt/c detected) */ const is_os_windows = !!global.is_os_windows;
/** @type {boolean} Windows Subsystem for Linux */ const is_os_wsl = !!global.is_os_wsl;

/**
 * List of OS flags considered limited-support platforms. Scripts calling
 * `exitIfLimitedSupportOs()` will exit early when running on any of these.
 * @type {string[]}
 */
const LIMITED_SUPPORT_OSES = (process.env.LIMITED_SUPPORT_OSES || "").split(",").filter(Boolean);

/** @type {boolean} When true, the current OS supports advanced profile features (any is_os_* flag set and not in LIMITED_SUPPORT_OSES). */
const IS_ADVANCED_PROFILE_ENABLED =
  Object.keys(process.env).some((k) => k.indexOf("is_os_") === 0 && global[k]) && LIMITED_SUPPORT_OSES.every((k) => !global[k]);

/** @type {string} WSL path to Windows Program Files (64-bit) */
const BASE_PROGRAM_FILES_WINDOW = "/mnt/c/Program Files";

/**
 * Resolves OS_KEY based on current platform flags.
 * @param {object} keys - Object with { windows, mac, linux } key values
 * @returns {string} The resolved OS key
 */
function resolveOsKey(keys) {
  if (is_os_mac) return keys.mac;
  if (is_os_windows) return keys.windows;
  return keys.linux;
}

/** @type {boolean} True when a Chromium-based browser (Chrome, Brave, Edge, Chromium) is installed. */
const hasChromiumBrowser = resolveOsKey({
  mac: () =>
    pathExists("/Applications", /^Google Chrome\.app$/) ||
    pathExists("/Applications", /^Brave Browser\.app$/) ||
    pathExists("/Applications", /^Microsoft Edge\.app$/),
  windows: () =>
    pathExists(`${BASE_PROGRAM_FILES_WINDOW}/Google/Chrome`, /Application/) ||
    pathExists(`${BASE_PROGRAM_FILES_WINDOW}/BraveSoftware/Brave-Browser`, /Application/) ||
    pathExists(`${BASE_PROGRAM_FILES_WINDOW}/Microsoft/Edge`, /Application/),
  linux: () =>
    pathExists("/usr/bin", /^google-chrome$/) ||
    pathExists("/usr/bin", /^brave-browser$/) ||
    pathExists("/usr/bin", /^microsoft-edge$/) ||
    pathExists("/usr/bin", /^chromium$/) ||
    pathExists("/usr/bin", /^chromium-browser$/),
})();

//////////////////////////////////////////////////////
// Formatting Constants
//////////////////////////////////////////////////////
/** @type {string} Hash-character line break for section separators (e.g. "####...####") */
const LINE_BREAK_HASH = "".padStart(LINE_BREAK_COUNT, "#");
/** @type {string} Slash-character line break for section separators (e.g. "////...////") */
const LINE_BREAK_SLASH = "".padStart(LINE_BREAK_COUNT, "/");
/** @type {string} Equal-character line break for section separators (e.g. "====...====") */
const LINE_BREAK_EQUAL = "".padStart(LINE_BREAK_COUNT, "=");
/** @type {number} Max depth for __nested_*__ autocomplete tokens (fd --max-depth / find -maxdepth). */
const MAX_NESTED_DEPTH = EDITOR_CONFIGS.maxNestedDepth;

// BEGIN software/common.js
/** Core shared constants and block-manipulation utilities (replaceBlock, appendTextBlock, etc.). Inlined into index.js via BEGIN/END markers. */
/** @type {string} Opening delimiter for managed text blocks */
const TEXT_BLOCK_START_MARKER = "BEGIN";
/** @type {string} Closing delimiter for managed text blocks */
const TEXT_BLOCK_END_MARKER = "END";
/** @type {string} Short-form combined marker prefix (e.g. "# BEGIN/END key" or "# BEGIN/END - key") */
const TEXT_BLOCK_SHORT_MARKER = `${TEXT_BLOCK_START_MARKER}/${TEXT_BLOCK_END_MARKER}`;
/** @type {string} Alternate short-form marker keyword (e.g. "# BLOCK key" or "# BLOCK - key") */
const TEXT_BLOCK_ALIAS_MARKER = "BLOCK";
/** @type {string} Runtime source-include marker keyword (e.g. "# SOURCE path/to/file.bash" or "# SOURCE - path/to/file.bash"). Ignored by build-include, resolved at runtime by ~cleanup.js. */
const TEXT_BLOCK_SOURCE_MARKER = "SOURCE";
/** @type {string} Opening delimiter for source-include blocks (e.g. "# SOURCE_BEGIN path/to/file.bash"). Persists across runs so content is always re-fetched. */
const TEXT_BLOCK_SOURCE_START_MARKER = "SOURCE_BEGIN";
/** @type {string} Closing delimiter for source-include blocks (e.g. "# SOURCE_END path/to/file.bash"). */
const TEXT_BLOCK_SOURCE_END_MARKER = "SOURCE_END";

/**
 * Expand short-form markers into long-form BEGIN/END pairs.
 * Supported forms: "# BEGIN/END key", "# BEGIN/END - key", "# BLOCK key", "# BLOCK - key".
 * The dash separator is optional and surrounding whitespace around it is flexible.
 * @param {string} content - The text content to expand
 * @param {string} commentPrefix - Comment prefix (e.g. '#', '//')
 * @param {string} [commentSuffix=''] - Comment suffix
 * @returns {string} Content with short-form markers expanded to BEGIN/END pairs
 */
function _expandShortFormMarkers(content, commentPrefix, commentSuffix = "") {
  const escaped = commentPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedSuffix = commentSuffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const keywords = `${TEXT_BLOCK_SHORT_MARKER}|${TEXT_BLOCK_ALIAS_MARKER}`;
  const pattern = new RegExp(`${escaped} (?:${keywords})\\s+[^a-zA-Z0-9]*([^\\r\\n]+?)\\s*${escapedSuffix}$`, "gm");
  return content.replace(pattern, (_, key) => {
    const begin = `${commentPrefix} ${TEXT_BLOCK_START_MARKER} ${key}${commentSuffix}`;
    const end = `${commentPrefix} ${TEXT_BLOCK_END_MARKER} ${key}${commentSuffix}`;
    return `${begin}\n${end}`;
  });
}

/**
 * Expand SOURCE markers into SOURCE_BEGIN/SOURCE_END pairs and collect the referenced file paths.
 * Also collects file paths from existing SOURCE_BEGIN/SOURCE_END blocks so content is always re-fetched.
 * SOURCE markers are runtime-only includes (ignored by build-include, resolved at runtime).
 * @param {string} content - The text content to expand
 * @param {string} commentPrefix - Comment prefix (e.g. '#', '//')
 * @param {string} [commentSuffix=''] - Comment suffix
 * @returns {{ content: string, sourceFiles: string[] }} Expanded content and list of source file paths
 */
function _expandSourceMarkers(content, commentPrefix, commentSuffix = "") {
  const escaped = commentPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedSuffix = commentSuffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Step 1: Expand short-form "# SOURCE path" into "# SOURCE_BEGIN path\n# SOURCE_END path"
  const shortPattern = new RegExp(`${escaped} ${TEXT_BLOCK_SOURCE_MARKER}\\s+.*?(\\S+\\/\\S+?)\\s*${escapedSuffix}$`, "gm");
  content = content.replace(shortPattern, (_, key) => {
    const trimmedKey = key.trim();
    const begin = `${commentPrefix} ${TEXT_BLOCK_SOURCE_START_MARKER} ${trimmedKey}${commentSuffix}`;
    const end = `${commentPrefix} ${TEXT_BLOCK_SOURCE_END_MARKER} ${trimmedKey}${commentSuffix}`;
    return `${begin}\n${end}`;
  });

  // Step 2: Collect all file paths from SOURCE_BEGIN markers (including freshly expanded ones)
  /** @type {string[]} */
  const sourceFiles = [];
  const beginPattern = new RegExp(`${escaped} ${TEXT_BLOCK_SOURCE_START_MARKER}\\s+(\\S+)\\s*${escapedSuffix}$`, "gm");
  let match;
  while ((match = beginPattern.exec(content)) !== null) {
    sourceFiles.push(match[1].trim());
  }

  return { content, sourceFiles };
}

/**
 * Replace content between BEGIN/END markers for multiple key/content pairs in a single pass.
 * Short-form markers are expanded once upfront. Each entry in the blockMap is applied sequentially.
 * @param {string} content - The full text content
 * @param {Object<string, string>} blockMap - Map of marker keys to their new content
 * @param {string} commentPrefix - Comment prefix (e.g. '#', '//')
 * @param {string} [commentSuffix=''] - Comment suffix (e.g. ' -->', '')
 * @param {'append'|'prepend'|null} [insertMode] - Where to insert if block not found. null/undefined returns content as-is.
 * @returns {string} The modified content with all blocks replaced
 */
function replaceBlocks(content, blockMap, commentPrefix, commentSuffix = "", insertMode) {
  content = _expandShortFormMarkers(content, commentPrefix, commentSuffix);

  for (const [key, sourceContent] of Object.entries(blockMap)) {
    const trimmed = sourceContent.trim();
    const BEGIN = `${commentPrefix} ${TEXT_BLOCK_START_MARKER} ${key}${commentSuffix}`;
    const END = `${commentPrefix} ${TEXT_BLOCK_END_MARKER} ${key}${commentSuffix}`;
    const block = `${BEGIN}\n${trimmed}\n${END}`;

    const beginIdx = content.indexOf(BEGIN);
    const endIdx = content.indexOf(END);

    if (beginIdx !== -1 && endIdx !== -1) {
      content = content.slice(0, beginIdx) + block + content.slice(endIdx + END.length);
    } else if (insertMode === "append") {
      content = `${content}\n\n${block}\n`;
    } else if (insertMode === "prepend") {
      content = `\n${block}\n\n${content}\n`;
    }
  }

  return content;
}

/**
 * Replace content between BEGIN/END markers.
 * Short-form markers ("# BEGIN/END key" or "# BEGIN/END - key") are expanded first.
 * If markers are not found, behavior depends on insertMode:
 * 'append' adds to end, 'prepend' adds to beginning, null/undefined returns content as-is.
 * Delegates to replaceBlocks with a single-entry map.
 * @param {string} content - The full text content
 * @param {string} key - The marker key
 * @param {string} sourceContent - The new content for the block
 * @param {string} commentPrefix - Comment prefix (e.g. '#', '//')
 * @param {string} [commentSuffix=''] - Comment suffix (e.g. ' -->', '')
 * @param {'append'|'prepend'|null} [insertMode] - Where to insert if block not found. null/undefined returns content as-is.
 * @returns {string} The modified content, or original content if markers not found and no insertMode
 */
function replaceBlock(content, key, sourceContent, commentPrefix, commentSuffix = "", insertMode) {
  return replaceBlocks(content, { [key]: sourceContent }, commentPrefix, commentSuffix, insertMode);
}

// Only export when required as a module (e.g. by build-include.js).
// Skip when this file is inlined into index.js via BEGIN/END markers,
// where index.js runs as the main module (require.main === module).
if (typeof module !== "undefined" && require.main !== module) {
  module.exports = {
    TEXT_BLOCK_START_MARKER,
    TEXT_BLOCK_END_MARKER,
    TEXT_BLOCK_SHORT_MARKER,
    TEXT_BLOCK_ALIAS_MARKER,
    TEXT_BLOCK_SOURCE_MARKER,
    TEXT_BLOCK_SOURCE_START_MARKER,
    TEXT_BLOCK_SOURCE_END_MARKER,
    _expandSourceMarkers,
    replaceBlock,
    replaceBlocks,
  };
}
// END software/common.js

/**
 * Replace content between SOURCE_BEGIN/SOURCE_END markers for multiple key/content pairs.
 * Similar to replaceBlocks but uses SOURCE_BEGIN/SOURCE_END delimiters which persist across runs.
 * @param {string} content - The full text content
 * @param {Object<string, string>} blockMap - Map of marker keys to their new content
 * @param {string} commentPrefix - Comment prefix (e.g. '#', '//')
 * @param {string} [commentSuffix=''] - Comment suffix
 * @returns {string} The modified content with all source blocks replaced
 */
function _replaceSourceBlocks(content, blockMap, commentPrefix, commentSuffix = "") {
  for (const [key, sourceContent] of Object.entries(blockMap)) {
    const trimmed = sourceContent.trim();
    const BEGIN = `${commentPrefix} ${TEXT_BLOCK_SOURCE_START_MARKER} ${key}${commentSuffix}`;
    const END = `${commentPrefix} ${TEXT_BLOCK_SOURCE_END_MARKER} ${key}${commentSuffix}`;
    const block = `${BEGIN}\n${trimmed}\n${END}`;

    const beginIdx = content.indexOf(BEGIN);
    const endIdx = content.indexOf(END);

    if (beginIdx !== -1 && endIdx !== -1) {
      content = content.slice(0, beginIdx) + block + content.slice(endIdx + END.length);
    }
  }

  return content;
}

//////////////////////////////////////////////////////
// Path Search Utilities
//////////////////////////////////////////////////////

/**
 * Searches a directory for entries matching a regex pattern and returns all matches.
 * @param {string} srcDir - The directory to search in
 * @param {RegExp|string} targetMatch - Regex pattern or exact string to match entry names against
 * @param {object} [options] - Search options
 * @param {"file"|"folder"|"any"} [options.type="any"] - Filter by entry type
 * @param {boolean} [options.recursive=false] - Search subdirectories recursively
 * @returns {string[]} Array of matching paths, or empty array if none found
 */
function findPathList(srcDir, targetMatch, options = {}) {
  const { type = "any", recursive = false } = options;
  const matcher = typeof targetMatch === "string" ? (name) => name === targetMatch : (name) => name.match(targetMatch);
  try {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
      const fullPath = path.join(srcDir, entry.name);
      if (matcher(entry.name)) {
        if (type === "any" || (type === "file" && entry.isFile()) || (type === "folder" && entry.isDirectory())) {
          results.push(fullPath);
        }
      }
      if (recursive && entry.isDirectory()) {
        results.push(...findPathList(fullPath, targetMatch, options));
      }
    }
    return results;
  } catch (err) {
    return [];
  }
}

/**
 * Searches a directory for the first entry matching a regex pattern.
 * Delegates to findPathList and returns the first result.
 * @param {string} srcDir - The directory to search in
 * @param {RegExp|string} targetMatch - Regex pattern or exact string to match entry names against
 * @param {object} [options] - Search options
 * @param {"file"|"folder"|"any"} [options.type="any"] - Filter by entry type
 * @param {boolean} [options.recursive=false] - Search subdirectories recursively
 * @returns {string|null} The first matching path, or null if none found
 */
function findPath(srcDir, targetMatch, options = {}) {
  return findPathList(srcDir, targetMatch, options)[0] || null;
}

/**
 * Iterates a list of [directory, regex] pairs and returns the first matching path.
 * @param {Array<[string, RegExp|string]>} findProps - Array of [srcDir, targetMatch] tuples to search
 * @param {object} [options] - Search options passed to findPath
 * @returns {string|null} The first matching path, or null if none found
 */
function findPathFromList(findProps, options = {}) {
  for (const [src, match] of findProps) {
    const result = findPath(src, match, options);
    if (result) {
      return result;
    }
  }
  return null;
}

/**
 * Checks whether a path exists. Without targetMatch, checks if targetPath itself exists.
 * With targetMatch, checks if a matching child entry exists inside targetPath.
 * @param {string} targetPath - The path to check, or the directory to search in when targetMatch is provided
 * @param {RegExp|string} [targetMatch] - Regex pattern or exact string to match names against. If omitted, checks if targetPath itself exists.
 * @param {"file"|"folder"} [type] - Optional filter: "file" matches only files, "folder" matches only directories. Omit to match either.
 * @returns {boolean} True if a match is found
 */
function pathExists(targetPath, targetMatch, type) {
  try {
    if (targetMatch === undefined) {
      if (!type) return fs.existsSync(targetPath);
      const stat = fs.statSync(targetPath);
      if (type === "file") return stat.isFile();
      if (type === "folder") return stat.isDirectory();
      return true;
    }
    return findPath(targetPath, targetMatch, { type: type || "any" }) !== null;
  } catch (err) {
    return false;
  }
}

/**
 * @deprecated Use findPathList(srcDir, targetMatch, { type: "folder" }) instead.
 * @param {string} srcDir - The directory to search in
 * @param {RegExp} targetMatch - Regex pattern to match directory names against
 * @param {boolean} [returnFirstMatch=false] - If true, returns only the first matching path
 * @returns {string[]|string|null} Array of matching directory paths, or the first match if returnFirstMatch is true
 */
function findDirList(srcDir, targetMatch, returnFirstMatch) {
  if (returnFirstMatch) {
    return findPath(srcDir, targetMatch, { type: "folder" });
  }
  return findPathList(srcDir, targetMatch, { type: "folder" });
}

/**
 * @deprecated Use findPath(srcDir, targetMatch, { type: "folder" }) instead.
 * @param {string} srcDir - The directory to search in
 * @param {RegExp} targetMatch - Regex pattern to match directory names against
 * @returns {string|null} The first matching directory path, or null if none found
 */
function findDirSingle(srcDir, targetMatch) {
  return findPath(srcDir, targetMatch, { type: "folder" });
}

/**
 * @deprecated Use findPath(srcDir, targetMatch, { type: "file", recursive: true }) instead.
 * @param {string} srcDir - The directory to start searching from
 * @param {RegExp} targetMatch - Regex pattern to match file names against
 * @returns {string|null} The full path of the first matching file, or null if none found
 */
function findFileRecursive(srcDir, targetMatch) {
  return findPath(srcDir, targetMatch, { type: "file", recursive: true });
}

/**
 * @deprecated Use findPathFromList(findProps, { type: "folder" }) instead.
 * @param {Array<[string, RegExp|string]>} findProps - Array of [srcDir, targetMatch] tuples to search
 * @returns {string|null} The first matching directory path, or null if none found
 */
function findFirstDirFromList(findProps) {
  return findPathFromList(findProps, { type: "folder" });
}

//////////////////////////////////////////////////////
// File I/O Utilities
//////////////////////////////////////////////////////
/**
 * Writes text content to a file. Skips writing if the trimmed content hasn't changed or if override is false.
 * @param {string} filePath - The file path to write to
 * @param {string} text - The text content to write
 * @param {boolean} [override=true] - Whether to overwrite existing content. If false, skips writing when file exists
 * @param {boolean} [suppressError=false] - Whether to suppress the "skipped" log message
 * @returns {Promise<void>}
 */
async function writeText(filePath, text, override = true, suppressError = false) {
  const pathToUse = filePath;
  const newContent = (text || "").trim();
  const oldContent = (await readText`${pathToUse}`).trim();

  // strip everything before and including the LINE_BREAK_HASH line so timestamp-only changes don't trigger a write
  const oldContentStripped = oldContent.trim();
  const newContentStripped = newContent.trim();

  if (oldContentStripped === newContentStripped || override !== true) {
    // if content don't change, then don't save
    // if override is set to false, then don't override
    if (suppressError !== true) {
      log(`<<<< Skipped [NotModified] oldContent=${oldContent.length} newContent=${newContent.length}`, pathToUse);
    }
  } else if (IS_DRY_RUN) {
    log(`<<<< [DryRun] Would update newContent=${newContent.length}`, pathToUse);
  } else {
    log(`<<<< Updated [Modified] newContent=${newContent.length}`, pathToUse);
    await _atomicWrite(pathToUse, newContent);
  }
}

/**
 * Writes content to a file atomically via a tmp file + rename, falling back to direct write.
 * Adds a small random delay (50-300ms) after writing to avoid filesystem race conditions.
 * @param {string} filePath - The file path to write to
 * @param {string} content - The content to write
 */
async function _atomicWrite(filePath, content) {
  if (IS_DRY_RUN) {
    log(`<<<< [DryRun] Would update (atomicWrite)`, filePath);
    return;
  }
  const tmpPath = filePath + ".tmp." + Date.now();
  try {
    fs.writeFileSync(tmpPath, content);
    fs.renameSync(tmpPath, filePath);
  } catch (_e) {
    // fallback: direct write (e.g. mock filesystem in tests)
    fs.writeFileSync(filePath, content);
  }
  const delay = Math.floor(Math.random() * 251) + 50;
  await new Promise((r) => setTimeout(r, delay));
}

/**
 * Writes a JSON object to a file, optionally prepending comments.
 * @param {string} filePath - The file path to write to
 * @param {object} json - The JSON object to serialize and write
 * @param {string} [comments=''] - Optional comment text to prepend before the JSON content
 */
async function writeJson(filePath, json, comments = "") {
  let content = comments + "\n" + JSON.stringify(json, null, 2);
  await writeText(filePath, content.trim());
}

/**
 * Safely writes content to a file with backup validation.
 * Throws if new content is empty or less than 10% of the existing backup content size.
 * @param {string} targetPath - The file path to write to
 * @param {string} newContent - The new content to write
 * @param {string} [backupContent] - Optional existing content to validate against
 * @param {number} [minRatio=0.1] - Minimum ratio of new content size to backup size (0-1)
 */
async function safeWriteText(targetPath, newContent, backupContent, minRatio = 0.1) {
  if (!newContent || newContent.trim().length === 0) {
    throw new Error(`generated content is empty, keeping backup: ${targetPath}`);
  } else if (backupContent && newContent.length < backupContent.length * minRatio) {
    throw new Error(`generated content is <${Math.round(minRatio * 100)}% of backup size, keeping backup: ${targetPath}`);
  } else {
    await writeText(targetPath, newContent);
  }
}

/**
 * Writes text content to a file only if the content has changed by more than a given percentage threshold.
 * Useful for files with volatile content (e.g., fetched host lists) where minor fluctuations should not trigger a write.
 * @param {string} filePath - The file path to write to
 * @param {string} text - The text content to write
 * @param {number} [changeThreshold=0.1] - Minimum percentage of change (0 to 1) required to trigger a write. Defaults to 10%
 * @returns {void}
 */
async function writeTextIfSignificantChange(filePath, text, changeThreshold = 0.1) {
  const pathToUse = filePath;
  const newContent = (text || "").trim();
  const oldContent = (await readText`${pathToUse}`).trim();

  if (oldContent.length === 0) {
    if (IS_DRY_RUN) {
      log(`<<<< [DryRun] Would create newContent=${newContent.length}`, pathToUse);
    } else {
      log(`<<<< Updated [New] newContent=${newContent.length}`, pathToUse);
      await _atomicWrite(pathToUse, newContent);
    }
    return;
  }

  if (newContent === oldContent) {
    log(`<<<< Skipped [NotModified] oldContent=${oldContent.length} newContent=${newContent.length}`, pathToUse);
    return;
  }

  const changeRatio = Math.abs(newContent.length - oldContent.length) / oldContent.length;
  const changePercent = calculatePercentage(Math.abs(newContent.length - oldContent.length), oldContent.length);

  if (changeRatio >= changeThreshold) {
    if (IS_DRY_RUN) {
      log(`<<<< [DryRun] Would update [Modified ${changePercent}] newContent=${newContent.length}`, pathToUse);
    } else {
      log(`<<<< Updated [Modified ${changePercent}] newContent=${newContent.length}`, pathToUse);
      await _atomicWrite(pathToUse, newContent);
    }
  } else {
    log(`<<<< Skipped [BelowThreshold ${changePercent}] oldContent=${oldContent.length} newContent=${newContent.length}`, pathToUse);
  }
}

/**
 * Creates a file if it doesn't already exist. If the file exists, it is left unchanged.
 * @param {string} filePath - The file path to create
 * @param {string} [defaultContent=''] - The default content to write if the file is created
 * @returns {void}
 */
async function touchFile(filePath, defaultContent = "") {
  const pathToUse = path.resolve(filePath);
  if (pathExists(pathToUse)) {
    log("<<< Skipped [NotModified]", pathToUse);
  } else if (IS_DRY_RUN) {
    log(">>> [DryRun] Would create", pathToUse);
  } else {
    log(">>> File Created", pathToUse);
    await _atomicWrite(pathToUse, defaultContent);
  }
}

/**
 * Writes text to a file, creating a timestamped backup of the old content if it differs.
 * @param {string} filePath - The file path to write to and back up
 * @param {string} text - The new text content to write
 * @returns {void}
 */
async function backupText(filePath, text) {
  const pathToUse = filePath;
  const oldText = await readText`${pathToUse}`;
  if (oldText !== text) {
    // back up the old content before overwriting
    const backupPathToUse = pathToUse + "." + Date.now();
    await writeText(backupPathToUse, oldText);
    await writeText(pathToUse, text);
    log("<<< Backup Created", backupPathToUse);
  } else {
    log("<<< Backup Skipped [NotModified]", pathToUse);
  }
}

/**
 * Creates two inline backups before overwriting a config file:
 * - `<file>.bak_original` — first-ever snapshot (never overwritten once created).
 * - `<file>.bak_latest`   — previous content before each new write.
 * Call this before modifying a config file so the user can diff or restore.
 * @param {string} filePath - The config file to back up.
 * @returns {void}
 */
async function backupConfigFile(filePath) {
  if (!pathExists(filePath)) return;

  const originalPath = filePath + ".bak_original";
  if (!pathExists(originalPath)) {
    copyFile(filePath, originalPath);
    log("<<< Backup Created (original)", originalPath);
  }

  const currentHash = await md5Hash(filePath);
  const originalHash = await md5Hash(originalPath);
  const latestPath = filePath + ".bak_latest";
  if (currentHash === originalHash) {
    log("<<< Backup Skipped (latest same as original)", latestPath);
  } else {
    copyFile(filePath, latestPath);
    log("<<< Backup Created (latest)", latestPath);
  }
}

/**
 * Backs up key profile files (.bashrc, .bash_profile, .bash_syle) into BASHRC_TEMP_DIR.
 * Called early in bootstrap before any profile modifications begin.
 * @param {string} label - Subdirectory label for the backup (e.g. "before", "after")
 */
async function backupProfileFilesToTempDir(label) {
  if (!BASHRC_TEMP_DIR) {
    log(">>> Skipped profile backup: BASHRC_TEMP_DIR not set");
    return;
  }
  const backupDir = path.join(BASHRC_TEMP_DIR, label);
  fs.mkdirSync(backupDir, { recursive: true });
  const filesToBackup = [path.join(BASE_HOMEDIR_LINUX, ".bashrc"), path.join(BASE_HOMEDIR_LINUX, ".bash_profile"), BASH_SYLE_PATH];
  for (const filePath of filesToBackup) {
    const content = await readText`${filePath}`;
    if (content) {
      const destPath = path.join(backupDir, path.basename(filePath));
      await _atomicWrite(destPath, content);
      log(`>>> Backed up ${filePath} to ${destPath}`);
    }
  }
}

/**
 * Saves a snapshot of BASH_SYLE_PATH to BASHRC_TEMP_DIR with the given filename.
 * Used for CI debugging of profile syntax test failures.
 * @param {string} filename - The snapshot filename (e.g. "bash_syle.2-before-cleanup")
 */
async function backupProfileSnapshot(filename) {
  if (!BASHRC_TEMP_DIR) return;
  try {
    const content = await readText`${BASH_SYLE_PATH}`;
    if (content) {
      fs.mkdirSync(BASHRC_TEMP_DIR, { recursive: true });
      const destPath = path.join(BASHRC_TEMP_DIR, filename);
      await _atomicWrite(destPath, content);
    }
  } catch (_e) {
    // best-effort — don't break the pipeline if snapshot fails
  }
}

/**
 * Generates an auto-generated timestamp header string with time rounded down to the nearest 10 minutes.
 * Used to mark files as auto-generated with a date stamp.
 * @returns {string} A warning string indicating the file is auto-generated, with date
 */
function getAutoGeneratedText() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  return `NOTE: STOP - do not edit by hand - this file is auto-generated [${yyyy}-${MM}-${dd}]\n`;
}

/**
 * Writes one or more build output files, then exits the process. Callers must include BUILD_DIR in the file path.
 * Each task produces a file with an optional auto-generated comment header (prefixed per commentStyle)
 * terminated by a LINE_BREAK_HASH marker line. writeText uses this marker to strip the header
 * before diffing, so timestamp-only changes don't trigger unnecessary writes.
 * No-ops silently when IS_CI is false.
 * @param {Array<{file: string, data: any, isJson?: boolean, comments?: string, commentStyle?: 'json'|'gitconfig'|'bash'}>
 *   | {file: string, data: any, isJson?: boolean, comments?: string, commentStyle?: 'json'|'gitconfig'|'bash'}} tasks - A single task or array of tasks to write
 * @param {string} tasks[].file - The output file path (must include BUILD_DIR prefix, e.g. `${BUILD_DIR}/filename`)
 * @param {any} tasks[].data - The content to write (object for JSON, string for text)
 * @param {boolean} [tasks[].isJson=false] - If true, data is serialized as JSON
 * @param {string} [tasks[].comments=''] - Optional comment text prepended as a header block
 * @param {string} [tasks[].commentStyle] - Comment prefix style: 'json' (//), 'bash'/'gitconfig' (#). When set, an auto-generated timestamp and LINE_BREAK_HASH marker are included
 * @returns {void}
 */
async function writeBuildArtifact(tasks) {
  tasks = [].concat(tasks);

  if (IS_CI) {
    mkdir(BUILD_DIR);
    for (let { file, data, isJson, comments, commentStyle } of [].concat(tasks)) {
      isJson = !!isJson;
      comments = (comments || "").trim();

      let commentPrefix = "";
      switch (commentStyle) {
        case "json":
          commentPrefix = "//";
          break;
        case "gitconfig":
        case "bash":
          commentPrefix = "#";
          break;
      }

      if (commentPrefix) {
        commentPrefix = commentPrefix + " "; // add a space to make it easy to ready
        comments = `${getAutoGeneratedText()}\n${comments}`;
      }

      if (comments) {
        comments = comments
          .trim()
          .split("\n")
          .map((row) => `${commentPrefix}${row.trim()}`)
          .join("\n");

        if (commentPrefix) {
          comments += `\n${commentPrefix}${LINE_BREAK_HASH}`;
        }

        comments += "\n\n";
      }

      if (isJson) {
        log(">> DEBUG Mode: write JSON to file", file);
        await writeJson(file, data, comments);
      } else {
        log(">> DEBUG Mode: write TEXT to file", file);
        data = (data || "").trim();
        await writeText(file, (comments + data).trim());
      }
    }
    throw new ScriptSkipError("Build artifact written");
  }
}

/**
 * Writes config data to a destination file composed from a base path and a relative file name.
 * Logs the resolved path before writing. Supports JSON (default) or plain text output.
 * @param {string} basePath - The base directory path
 * @param {string} fileName - The relative file name to join with basePath (e.g. 'Packages/User/Preferences.sublime-settings')
 * @param {any} data - The data to write (object for JSON, string for text)
 * @param {boolean} [isJson=true] - If true, writes as formatted JSON via writeJson; otherwise writes as plain text via writeText
 * @returns {void}
 */
async function writeConfigToFile(basePath, fileName, data, isJson = true) {
  const fileDestPath = path.join(basePath, fileName);
  log(">>> File Path", fileDestPath);
  if (isJson) {
    await writeJson(fileDestPath, data);
  } else {
    await writeText(fileDestPath, data);
  }
}

/**
 * Appends text to the end of an existing file's content.
 * @param {string} filePath - The file path to append to
 * @param {string} text - The text to append
 * @returns {void}
 */
async function appendText(filePath, text) {
  const oldText = await readText`${filePath}`;
  await writeText(filePath, oldText + "\n" + text);
}

/**
 * Reads a file and applies regex replacements line by line. Creates a .bak backup of the original.
 * @param {string} filePath - The file path to read and modify
 * @param {Array<[RegExp, string]>} replacements - Array of [matchRegex, replaceWith] pairs to apply to each line
 * @param {boolean} [makeAdditionalBackup=false] - If true, also creates a timestamped backup
 * @returns {void}
 */
async function replaceTextLineByLine(filePath, replacements, makeAdditionalBackup = false) {
  const oldText = await readText`${filePath}`;

  const newText = oldText
    .split("\n")
    .map((line) => {
      let newLine = line;

      for (const [matchRegex, replaceWith] of replacements) {
        newLine = newLine.replace(matchRegex, replaceWith);
      }

      return newLine;
    })
    .join("\n");

  // make backups
  await writeText(`${filePath}.bak`, oldText, false);

  if (makeAdditionalBackup === true) {
    await writeText(`${filePath}.bak.${Date.now()}`, oldText);
  }

  // save with newText
  await writeText(filePath, newText);
}

/**
 * Reads an existing JSON file, shallow-merges new properties into it, and writes it back.
 * If the file doesn't exist or is invalid, starts with an empty object.
 * @param {string} filePath - The JSON file path to read and write
 * @param {object} json - The JSON object whose properties will be merged into the existing file
 * @returns {void}
 */
async function writeJsonWithMerge(filePath, json) {
  let oldJson = {};
  try {
    oldJson = await readJson`${filePath}`;
  } catch (e) {}
  await writeJson(filePath, Object.assign(oldJson, json));
}

/**
 * Returns the MD5 hex digest of the given string or Buffer.
 * @param {string|Buffer} data - The data to hash.
 * @returns {string} 32-character lowercase hex MD5 hash.
 */
function md5HashFromText(data) {
  return require("crypto").createHash("md5").update(data).digest("hex");
}

/**
 * Returns the MD5 hex digest of a file's contents using readText.
 * @param {string} filePath - The file to hash.
 * @returns {Promise<string>} 32-character lowercase hex MD5 hash.
 */
async function md5HashFromFile(filePath) {
  const content = await readText`${filePath}`;
  return md5HashFromText(content);
}

/**
 * Returns the MD5 hex digest. Auto-detects whether the input is a file path or raw data.
 * If the input is a string that points to an existing file, hashes the file contents.
 * Otherwise hashes the input directly as text/Buffer.
 * @param {string|Buffer} dataOrFilePath - A file path or raw data to hash.
 * @returns {Promise<string>} 32-character lowercase hex MD5 hash.
 */
async function md5Hash(dataOrFilePath) {
  if (typeof dataOrFilePath === "string" && pathExists(dataOrFilePath)) {
    return md5HashFromFile(dataOrFilePath);
  }
  return md5HashFromText(dataOrFilePath);
}

/**
 * Copies a file from source to destination. Skips in dry-run mode.
 * @param {string} srcPath - Source file path.
 * @param {string} destPath - Destination file path.
 */
function copyFile(srcPath, destPath) {
  if (IS_DRY_RUN) {
    log(`<<<< [DryRun] Would copy ${srcPath} -> ${destPath}`);
    return;
  }
  try {
    fs.copyFileSync(srcPath, destPath);
  } catch {
    fs.writeFileSync(destPath, fs.readFileSync(srcPath));
  }
}

/**
 * Parses a JSON string that may contain comments or non-standard syntax by using eval.
 * Exits the process if the input is empty.
 * @param {string} oldText - The raw JSON/JS text to parse
 * @returns {object} The parsed object
 */
function parseJsonWithComments(oldText) {
  oldText = (oldText || "").trim();
  if (!oldText) {
    throw new Error("parseJsonWithComments: empty input");
  }
  // Strip single-line comments (// ...) and block comments (/* ... */) before parsing.
  // Avoids using eval() for security. Handles most common JSON-with-comments patterns.
  const stripped = oldText
    .replace(/\/\/.*$/gm, "") // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/,\s*([}\]])/g, "$1") // trailing commas
    .trim();
  try {
    return JSON.parse(stripped);
  } catch (_) {
    // Fallback for edge cases (e.g. unquoted keys, JS expressions) — use Function instead of eval
    try {
      return new Function(`return (${oldText})`)();
    } catch (e) {
      throw new Error(`parseJsonWithComments: failed to parse input - ${e.message} - ${oldText.replace(/\s+/g, " ").substr(0, 200)}...`);
    }
  }
}

/**
 * Creates a deep clone of an object via JSON serialization/deserialization.
 * @param {object} obj - The object to clone
 * @returns {object} A deep copy of the input object
 */
function clone(obj) {
  return typeof structuredClone === "function" ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
}

/**
 * Checks whether a command is available. By default only checks for real binaries
 * in $PATH using `type -P`. When includeAliases is true, also checks for shell
 * functions, aliases, and builtins using `type`.
 * @param {string} name - The command name to look up
 * @param {boolean} [includeAliases=false] - When true, also match aliases/functions/builtins
 * @returns {Promise<boolean>} True if the command is found
 */
async function isBinaryFound(name, includeAliases = false) {
  const cmd = includeAliases ? `type ${name} 2>/dev/null` : `type -P ${name} 2>/dev/null`;
  const result = await execBash(cmd);
  return result.trim().length > 0;
}

/**
 * Creates a directory (and any necessary parent directories) at the given path.
 * @param {string} targetPath - The directory path to create
 * @returns {Promise<string>} Resolves with the stdout of the mkdir command
 */
function mkdir(targetPath) {
  return execBash(`mkdir -p "${targetPath}"`);
}

/** @type {string[]} Paths that must never be deleted */
const _DANGEROUS_PATHS = [
  "/",
  "/bin",
  "/boot",
  "/dev",
  "/etc",
  "/home",
  "/lib",
  "/mnt",
  "/opt",
  "/proc",
  "/root",
  "/run",
  "/sbin",
  "/srv",
  "/sys",
  "/tmp",
  "/usr",
  "/var",
];

/**
 * Returns true if the path is too dangerous to delete (system root, home dir, or too shallow).
 * @param {string} targetPath - The path to check
 * @returns {boolean} True if the path should be blocked from deletion
 */
function _isDangerousPath(targetPath) {
  if (!targetPath || typeof targetPath !== "string") return true;
  const cleaned = targetPath.replace(/\/+$/, "").trim();
  if (!cleaned || cleaned === "." || cleaned === "..") return true;
  if (_DANGEROUS_PATHS.includes(cleaned)) return true;
  // block home directory itself (e.g. /home/user, /Users/user) but allow subdirs
  const homedir = BASE_HOMEDIR_LINUX.replace(/\/+$/, "");
  if (cleaned === homedir) return true;
  // block paths with fewer than 3 segments (e.g. /mnt/c)
  if (cleaned.split("/").filter(Boolean).length < 3) return true;
  return false;
}

/**
 * Deletes a directory at the given path using rm -rf. Refuses to delete dangerous paths.
 * @param {string} targetPath - The directory path to delete
 * @returns {Promise<string>} Resolves when deletion is complete
 */
async function deleteFolder(targetPath) {
  if (_isDangerousPath(targetPath)) {
    log(`<< Refused to delete dangerous path: ${targetPath}`);
    return "";
  }
  if (IS_DRY_RUN) {
    log(`>> [DryRun] Would delete folder ${targetPath}`);
    return "";
  }
  log(`>> Deleting folder ${targetPath}`);
  await execBash(`rm -rf "${targetPath}"`);
  if (pathExists(targetPath)) {
    throw new Error(`Failed to delete ${targetPath} (permission denied — is it root-owned? try: sudo rm -rf "${targetPath}")`);
  }
  return "";
}

/**
 * Deletes a single file at the given path using rm -f. Refuses to delete dangerous paths.
 * @param {string} targetPath - The file path to delete
 * @returns {Promise<string>} Resolves when deletion is complete
 */
function deleteFile(targetPath) {
  if (_isDangerousPath(targetPath)) {
    log(`<< Refused to delete dangerous path: ${targetPath}`);
    return Promise.resolve("");
  }
  if (IS_DRY_RUN) {
    log(`>> [DryRun] Would delete file ${targetPath}`);
    return Promise.resolve("");
  }
  log(`>> Deleting file ${targetPath}`);
  return execBash(`rm -f "${targetPath}"`);
}

/**
 * Extracts a zip archive to a target directory.
 * @param {string} zipPath - Path to the zip file
 * @param {string} targetPath - Directory to extract into
 */
function unzip(zipPath, targetPath) {
  return execBash(`unzip -oq "${zipPath}" -d "${targetPath}"`);
}

/** @type {number} Two weeks in seconds — default threshold for staleness checks. */
const DEFAULT_STALE_SECONDS = 1209600;

/**
 * Checks whether a filesystem path is stale (older than maxAgeSeconds) or missing.
 * @param {string} targetPath - The path to check
 * @param {number} [maxAgeSeconds=1209600] - Max age in seconds before considered stale (default: 2 weeks)
 * @returns {boolean} True if the path does not exist or its mtime exceeds maxAgeSeconds
 */
function isPathStale(targetPath, maxAgeSeconds) {
  if (IS_REFRESH_MODE) return true;
  maxAgeSeconds = maxAgeSeconds || DEFAULT_STALE_SECONDS;
  try {
    const stats = fs.statSync(targetPath);
    return (Date.now() - stats.mtimeMs) / 1000 > maxAgeSeconds;
  } catch {}
  return true;
}

/**
 * Checks whether a force refresh should proceed for the given path.
 * Returns true only when IS_FORCE_REFRESH is enabled AND the path is stale (older than two weeks or missing).
 * Logs a skip message when force refresh is active but the path is still fresh.
 * @param {string} [targetPath] - The path to check staleness against (defaults to BASH_SYLE_PATH)
 * @returns {boolean} True if the force refresh should proceed
 */
function isForceRefreshStale(targetPath) {
  targetPath = targetPath || BASH_SYLE_PATH;
  if (!IS_FORCE_REFRESH) return false;
  if (IS_REFRESH_MODE) return true;
  if (isPathStale(targetPath)) return true;
  log(`>> Force refresh skipped (not stale): ${targetPath}`);
  return false;
}

//////////////////////////////////////////////////////
// Platform-Specific Path Utilities
//////////////////////////////////////////////////////
/**
 * Detects and returns the Windows user home directory under WSL.
 * @returns {string|undefined} The Windows user home directory path, or undefined if not found
 */
/** @type {string|undefined} Cached result for getWindowUserBaseDir */
let _windowUserBaseDir;
function getWindowUserBaseDir() {
  if (_windowUserBaseDir !== undefined) return _windowUserBaseDir;
  try {
    const userProfile = execBashSync(`cmd.exe /C "echo %USERPROFILE%" 2>/dev/null`).replace(/\r/g, "");
    if (userProfile && !userProfile.includes("%USERPROFILE%")) {
      const wslPath = userProfile.replace(/^([A-Za-z]):/, (_, d) => `/mnt/${d.toLowerCase()}`).replace(/\\/g, "/");
      if (pathExists(wslPath)) {
        _windowUserBaseDir = wslPath;
        return _windowUserBaseDir;
      }
    }
  } catch (e) {}
  const usersDir = "/mnt/c/Users";
  const regexUsername = /(leng)|(sy[ ]*le)/i;
  const regexSystemUsers = /^(Public|Default|Default User|All Users)$/i;
  const allUsers = findPathList(usersDir, /./, { type: "folder" });
  _windowUserBaseDir =
    findPath(usersDir, regexUsername, { type: "folder" }) || allUsers.find((d) => !path.basename(d).match(regexSystemUsers));
  return _windowUserBaseDir;
}

/**
 * Resolves the Windows application binary directory under WSL (prefers D: drive, falls back to C: or _extra/windows).
 * If applicationName is provided, creates a subdirectory for it.
 * @param {string} [applicationName] - Optional application name to create a subdirectory for
 * @returns {Promise<string>} The resolved directory path for storing application binaries
 */
async function getWindowsApplicationBinaryDir(applicationName) {
  const mntDrive = findPath("/mnt", /^d$/, { type: "folder" }) || findPath("/mnt", /^c$/, { type: "folder" });
  let targetPath = mntDrive ? path.join(mntDrive, "Applications") : await getCustomTweaksPath("windows");
  if (applicationName) targetPath = path.join(targetPath, applicationName);
  return targetPath;
}

/**
 * Returns a path under the user's custom tweaks directory (~/_extra or {WindowsHome}/_extra).
 * @param {string} [subPath] - Optional subdirectory to join after the base directory
 * @returns {string} The resolved path
 */
function getCustomTweaksPath(subPath) {
  const baseDir = is_os_windows ? path.join(getWindowUserBaseDir(), "_extra") : path.join(BASE_HOMEDIR_LINUX, "_extra");
  return subPath ? path.join(baseDir, subPath) : baseDir;
}

/**
 * Returns the Desktop directory path, preferring D: drive over C: drive on Windows, or ~/Desktop elsewhere.
 * @returns {string|undefined} The path to the Desktop directory, or undefined if not found
 */
function getDesktopPath() {
  if (is_os_windows)
    return findPath("/mnt/d", /^Desktop$/i, { type: "folder" }) || findPath(getWindowUserBaseDir(), /^Desktop$/i, { type: "folder" });
  return findPath(BASE_HOMEDIR_LINUX, /^Desktop$/i, { type: "folder" });
}

/**
 * Converts a WSL path to a Windows path (e.g. /mnt/c/Users/foo -> C:\Users\foo).
 * @param {string} wslPath - The WSL path to convert
 * @returns {string} The Windows-formatted path
 */
function toWindowsPath(wslPath) {
  return wslPath.replace(/\/mnt\/([a-z])/i, (_, d) => `${d.toUpperCase()}:`).replace(/\//g, "\\");
}

/**
 * Returns the Windows AppData\Roaming directory path under WSL for the current user.
 * @returns {string} The path to {WindowsUserHome}/AppData/Roaming
 */
function getWindowAppDataRoamingUserPath() {
  return path.join(getWindowUserBaseDir(), "AppData/Roaming");
}

/**
 * Returns the Windows AppData\Local directory path under WSL for the current user.
 * @returns {string} The path to {WindowsUserHome}/AppData/Local
 */
function getWindowAppDataLocalUserPath() {
  return path.join(getWindowUserBaseDir(), "AppData/Local");
}

/**
 * Returns the path to the system hosts file, checking Windows first then falling back to /etc/hosts.
 * @returns {string} Path to the hosts file
 */
function getEtcHostsPath() {
  const windowsEtcHostPath = "/mnt/c/Windows/System32/drivers/etc/hosts";
  if (pathExists(windowsEtcHostPath) || is_os_windows) return windowsEtcHostPath;
  return "/etc/hosts";
}

/**
 * Returns the Windows Documents directory path under WSL, preferring D: drive over the user's home.
 * @returns {Promise<string|undefined>} The WSL path to the Documents directory, or undefined if not found
 */
async function getWindowDocumentsPath() {
  return findPathFromList(
    [
      ["/mnt/d", "Documents"],
      [getWindowUserBaseDir(), "Documents"],
    ],
    { type: "folder" },
  );
}

/**
 * Returns the macOS Application Support directory path for the current user.
 * @returns {string} The path to ~/Library/Application Support
 */
function getOsxApplicationSupportCodeUserPath() {
  return path.join(BASE_HOMEDIR_LINUX, "Library/Application Support");
}

/**
 * Mounts a macOS DMG file, discovers .app bundles, copies them to /Applications, unmounts, and clears quarantine.
 * @param {string} dmgPath - The path to the .dmg file to install
 */
async function installMacDmg(dmgPath) {
  if (!is_os_mac) return;
  if (IS_DRY_RUN) {
    log(`>> [DryRun] Would install DMG ${dmgPath}`);
    return;
  }
  const mountPoint = `/tmp/dmg-${Date.now()}`;
  await execBash(`hdiutil attach "${dmgPath}" -mountpoint "${mountPoint}" -nobrowse -quiet`);
  const apps = fs.readdirSync(mountPoint).filter((f) => f.endsWith(".app"));
  for (const appName of apps) {
    await execBash(`rm -rf "/Applications/${appName}"`);
  }
  await execBash(`cp -Rf "${mountPoint}"/*.app /Applications/`);
  await execBash(`hdiutil detach "${mountPoint}" -quiet`);
  for (const appName of apps) {
    const appPath = `/Applications/${appName}`;
    if (fs.existsSync(appPath)) {
      log(">> Installed", appPath);
      const readmePath = path.join(path.dirname(dmgPath), "README.txt");
      await clearMacQuarantine(readmePath, appPath);
    } else {
      log(`>> Failed to install ${appPath} from DMG`);
    }
  }
}

/**
 * Clears macOS Gatekeeper quarantine on an app and writes a README explaining the fix.
 * @param {string} readmePath - The file path to write the README to
 * @param {string} appPath - The macOS .app path (e.g. "/Applications/MyApp.app")
 */
async function clearMacQuarantine(readmePath, appPath) {
  if (IS_DRY_RUN) {
    log(`>> [DryRun] Would clear quarantine on ${appPath}`);
    return;
  }
  if (!pathExists(appPath)) {
    log(`>> Skipping quarantine clear, app not found: ${appPath}`);
    return;
  }
  await execBash(`xattr -cr "${appPath}"`);
  await writeText(
    readmePath,
    trimLeftSpaces(`
      # Why do we need "xattr -cr ${appPath}"?
      #
      # macOS Gatekeeper quarantines apps downloaded outside the App Store by setting
      # an extended attribute (com.apple.quarantine) on the .app bundle. This causes
      # the "app is damaged and can't be opened" or "unidentified developer" error
      # when you try to launch the app.
      #
      # "xattr -cr" recursively clears all extended attributes from the app bundle,
      # removing the quarantine flag so macOS allows the app to run.
      #
      # To fix manually if needed:
      xattr -cr ${appPath}
    `).trim(),
  );
}

/**
 * Force-closes a running application before installing a new version.
 * On Mac: tries graceful AppleScript quit for matching /Applications/*.app, then pkill fallback.
 * On Windows (WSL): uses taskkill via cmd.exe.
 * On Linux: uses pkill.
 * @param {string} appLabel - The app label (e.g. "sqlui-native", "display-dj")
 */
async function _forceCloseApp(appLabel) {
  if (IS_DRY_RUN) {
    log(`>> [DryRun] Would force-close ${appLabel}`);
    return;
  }

  /** @type {string} Regex-friendly pattern: dashes become dots to match both dashes and spaces. */
  const pattern = appLabel.replace(/-/g, ".");

  if (is_os_mac) {
    try {
      /** @type {string[]} Matching .app bundles in /Applications/. */
      const apps = fs.readdirSync("/Applications/").filter((f) => f.endsWith(".app") && new RegExp(pattern, "i").test(f));
      for (const app of apps) {
        const name = app.replace(".app", "");
        log(`>> Force-closing ${name}`);
        await execBash(`osascript -e 'quit app "${name}"'`);
        await execBash(`pkill -fi "${pattern}"`);
      }
    } catch (e) {}
  } else if (is_os_windows) {
    await execBash(`cmd.exe /C "taskkill /F /IM ${appLabel}*" 2>/dev/null`);
  } else {
    await execBash(`pkill -fi "${pattern}"`);
  }
}

/**
 * Downloads and installs a binary from a GitHub release.
 * @param {string} repo - GitHub repo identifier (e.g. "synle/sqlui-native")
 * @param {function(string, boolean): string} getFileName - Callback that receives the release version and isArm64 flag, returns the platform-specific file name
 */
async function downloadAndInstallBinary(repo, getFileName) {
  const appLabel = repo.split("/")[1];
  const version = await fetchGitHubReleaseVersion(repo);
  const targetPath = await getCustomTweaksPath(appLabel);
  const isArm64 = os.arch() === "arm64";
  const ver = version.replace(/^v/, "");
  const fileName = getFileName(ver, isArm64);
  const url = `https://github.com/${repo}/releases/download/${version}/${fileName}`;

  log(`>> Installing ${appLabel} ${version} for ${is_os_mac ? "Mac" : "NonMac"} to:`, targetPath);

  await _forceCloseApp(appLabel);

  await deleteFolder(targetPath);
  await mkdir(targetPath);

  const destination = path.join(targetPath, fileName);
  const ok = await downloadAssetWithFallback(repo, url, destination);

  if (ok) {
    log(`>> ${appLabel} ${version} downloaded:`, destination);
    await installMacDmg(destination);
  }
}

//////////////////////////////////////////////////////
// Text Block Management
//////////////////////////////////////////////////////
/**
 * Appends a delimited text block to the end of a text body (or replaces it if it already exists).
 * @param {string} content - The full text content to modify
 * @param {string} key - The identifier for the text block
 * @param {string} sourceContent - The new content for the block
 * @param {string} [commentPrefix='#'] - The comment character/prefix
 * @returns {string} The modified text content
 */
function appendTextBlock(content, key, sourceContent, commentPrefix = "#") {
  return cleanupExtraWhitespaces(replaceBlock(content, key, sourceContent, commentPrefix, "", "append"));
}

/**
 * Prepends a delimited text block to the beginning of a text body (or replaces it if it already exists).
 * @param {string} content - The full text content to modify
 * @param {string} key - The identifier for the text block
 * @param {string} sourceContent - The new content for the block
 * @param {string} [commentPrefix='#'] - The comment character/prefix
 * @returns {string} The modified text content
 */
function prependTextBlock(content, key, sourceContent, commentPrefix = "#") {
  return cleanupExtraWhitespaces(replaceBlock(content, key, sourceContent, commentPrefix, "", "prepend"));
}

/**
 * Strips an existing block (if present), then appends it to the end of the content.
 * Guarantees the block is always at the bottom of the file regardless of prior position.
 * @param {string} content - The full text content to modify
 * @param {string} key - The identifier for the text block
 * @param {string} sourceContent - The new content for the block
 * @param {string} [commentPrefix='#'] - The comment character/prefix
 * @returns {string} The modified text content
 */
function moveTextBlockToEnd(content, key, sourceContent, commentPrefix = "#") {
  content = _stripTextBlock(content, key, commentPrefix);
  return appendTextBlock(content, key, sourceContent, commentPrefix);
}

/**
 * Strips an existing block (if present), then prepends it to the start of the content.
 * Guarantees the block is always at the top of the file regardless of prior position.
 * @param {string} content - The full text content to modify
 * @param {string} key - The identifier for the text block
 * @param {string} sourceContent - The new content for the block
 * @param {string} [commentPrefix='#'] - The comment character/prefix
 * @returns {string} The modified text content
 */
function moveTextBlockToStart(content, key, sourceContent, commentPrefix = "#") {
  content = _stripTextBlock(content, key, commentPrefix);
  return prependTextBlock(content, key, sourceContent, commentPrefix);
}

/**
 * Removes a BEGIN/END block from content, returning the content without the block.
 * @param {string} content - The full text content
 * @param {string} key - The identifier for the text block
 * @param {string} [commentPrefix='#'] - The comment character/prefix
 * @returns {string} The content with the block removed
 */
function _stripTextBlock(content, key, commentPrefix = "#") {
  const BEGIN = `${commentPrefix} ${TEXT_BLOCK_START_MARKER} ${key}`;
  const END = `${commentPrefix} ${TEXT_BLOCK_END_MARKER} ${key}`;
  const beginIdx = content.indexOf(BEGIN);
  const endIdx = content.indexOf(END);
  if (beginIdx !== -1 && endIdx !== -1) {
    content = content.slice(0, beginIdx) + content.slice(endIdx + END.length);
  }
  return content;
}

//////////////////////////////////////////////////////
// Profile Registration
//////////////////////////////////////////////////////

/**
 * Buffer for profile block registrations. Keyed by profilePath, each value is a Map of configKey → {content, isPrepend, isRemove}.
 * Flushed by flushProfileBlocks() after doWork()/undoWork() completes.
 * @type {Map<string, Map<string, {content: string, isPrepend: boolean, isRemove: boolean}>>}
 */
const _profileBlockBuffer = new Map();

/**
 * Validates bash syntax of a content block by running `bash -n` via stdin pipe.
 * Uses `require("child_process").execSync` with `input` instead of the project's
 * `execBash` helper or inline heredocs because:
 *   1. The old heredoc approach (`bash -n <<'EOF'\n...\nEOF`) broke when content
 *      contained nested heredocs (e.g. the spec autocomplete template's `__SPEC_EOF__`)
 *      or was too large for inline shell arguments — caused false syntax failures on
 *      RHEL/Fedora and mac CI builds.
 *   2. The stdin `input` option pipes content directly to bash without shell escaping
 *      or argument length limits, handling nested heredocs and large blocks cleanly.
 *   3. Direct `require("child_process")` avoids the mocked `execSync` in the test
 *      sandbox, where `fs.writeFileSync` and `process.pid` are also unavailable.
 * @param {string} content - The bash content to validate
 * @param {string} blockName - The block name for error context
 * @returns {string|null} Error message string if invalid, null if valid
 */
function _validateBashSyntax(content, blockName) {
  try {
    require("child_process").execSync("bash -n", {
      input: content,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return null;
  } catch (err) {
    const stderr = (err.stderr || "").trim();
    return stderr || `bash -n failed for block "${blockName}"`;
  }
}

/**
 * Buffers a config block for later batch writing by flushProfileBlocks().
 * Generic version that works with any profile file path.
 * Content is inserted directly without wrapping. Code folding via `{ }` braces is intentionally
 * not supported — it caused bugs with comment-only blocks (bash `{ }` requires at least one real
 * command), corrupted profiles on false-positive syntax validation, and added complexity for
 * minimal editor benefit.
 * Note: configKey must not contain `/` — slashes in BEGIN/END markers cause Prettier to insert stray blank lines. Use `-` instead.
 * @param {Object} options
 * @param {string} options.profilePath - The file path to read/write the config block
 * @param {string} options.configKey - The config key for the text block (avoid `/` in names)
 * @param {string} options.content - The content to register
 * @param {boolean} [options.isPrepend=false] - When true, prepends the block; when false, appends it
 */
function registerProfileBlock({ profilePath, configKey, content, isPrepend = false }) {
  log(`>> Register ProfileBlock`, colorRed(configKey), profilePath);

  let wrappedContent = content;
  const isBashProfile = !profilePath.includes("powershell");
  if (isBashProfile) {
    const syntaxError = _validateBashSyntax(wrappedContent, configKey);
    if (syntaxError) {
      log(colorBgRed(`>>>> INVALID BASH SYNTAX in block "${configKey}":`), syntaxError);
      wrappedContent = `echo '[bashrc] WARNING: invalid bash syntax detected in block "${configKey}" in "${profilePath}" — block skipped' >&2`;
    }
  }

  if (!_profileBlockBuffer.has(profilePath)) {
    _profileBlockBuffer.set(profilePath, new Map());
  }
  _profileBlockBuffer.get(profilePath).set(configKey, { content: wrappedContent, isPrepend, isRemove: false });
}

/**
 * Flush all buffered profile block registrations to disk.
 * For each profilePath, reads the file once (readText resolves SOURCE includes automatically),
 * applies all pending block updates via replaceBlocks, and writes once.
 * @param {boolean} [immediate=false] - When true, always processes BASH_SYLE_PATH even if no blocks are buffered (expands short-form markers)
 */
async function flushProfileBlocks(immediate = false) {
  if (immediate && !_profileBlockBuffer.has(BASH_SYLE_PATH)) {
    _profileBlockBuffer.set(BASH_SYLE_PATH, new Map());
  }

  if (_profileBlockBuffer.size > 0) {
    for (const [profilePath, blockEntries] of _profileBlockBuffer) {
      const fileSize = (await readText`${profilePath}`).length;
      let textContent = await readText`${profilePath}`;
      const blockKeys = [...blockEntries.keys()];

      log(`>> Flush start: ${profilePath} (${fileSize} chars, ${blockEntries.size} blocks: ${blockKeys.join(", ")})`);

      // Expand short-form markers before any block updates.
      textContent = _expandShortFormMarkers(textContent, "#");

      // Separate into three groups: removals (replace-only), prepends, appends
      const removeMap = {};
      const prependMap = {};
      const appendMap = {};
      for (const [configKey, { content, isPrepend, isRemove }] of blockEntries) {
        if (isRemove) {
          removeMap[configKey] = content;
        } else if (isPrepend) {
          prependMap[configKey] = content;
        } else {
          appendMap[configKey] = content;
        }
      }

      // Apply removals first (no insertMode — only replaces existing blocks)
      if (Object.keys(removeMap).length > 0) {
        log(`>>> Removing ${Object.keys(removeMap).length} block(s): ${Object.keys(removeMap).join(", ")}`);
        textContent = replaceBlocks(textContent, removeMap, "#", "");
      }
      // Apply prepends, then appends
      if (Object.keys(prependMap).length > 0) {
        log(`>>> Prepending ${Object.keys(prependMap).length} block(s): ${Object.keys(prependMap).join(", ")}`);
        textContent = cleanupExtraWhitespaces(replaceBlocks(textContent, prependMap, "#", "", "prepend"));
      }
      if (Object.keys(appendMap).length > 0) {
        log(`>>> Appending ${Object.keys(appendMap).length} block(s): ${Object.keys(appendMap).join(", ")}`);
        textContent = cleanupExtraWhitespaces(replaceBlocks(textContent, appendMap, "#", "", "append"));
      }

      // Check for duplicate BEGIN markers after flush
      const beginMatches = textContent.match(/^# BEGIN .+$/gm) || [];
      const beginCounts = {};
      for (const m of beginMatches) {
        beginCounts[m] = (beginCounts[m] || 0) + 1;
      }
      const duplicates = Object.entries(beginCounts).filter(([, count]) => count > 1);
      if (duplicates.length > 0) {
        log(colorRed(`>>> WARNING: Duplicate BEGIN blocks detected after flush in ${profilePath}:`));
        for (const [marker, count] of duplicates) {
          log(colorRed(`>>>   ${marker} (${count}x)`));
        }
      }

      await writeText(profilePath, textContent);
      log(`>> Flush done: ${profilePath} (${textContent.length} chars)`);
    }

    _profileBlockBuffer.clear();
  }
}

/**
 * Updates a config block in BASH_SYLE_PATH. Empty BEGIN/END markers are
 * pre-placed by bash-syle-content.js so blocks update in place at a fixed position.
 * @param {string} configKey - The config key for the text block
 * @param {string} content - The content to register
 */
function registerWithBashSyleProfile(configKey, content) {
  registerProfileBlock({ profilePath: BASH_SYLE_PATH, configKey, content });
}

/**
 * Appends a PowerShell config block to POWERSHELL_SYLE_PATH.
 * The profile template is written by windows/_init.js;
 * this function appends blocks to the end, matching how registerWithBashSyleProfile works.
 * @param {string} configKey - The config key for the text block
 * @param {string} content - The PowerShell content to register
 */
function registerWithPowershellProfile(configKey, content) {
  registerProfileBlock({ profilePath: POWERSHELL_SYLE_PATH, configKey, content });
}

/**
 * Registers an autocomplete config block in BASH_SYLE_PATH.
 * Used by bash-autocomplete-*.js scripts to register autocomplete blocks.
 * @param {string} configKey - The config key for the text block
 * @param {string} content - The content to register
 */
function registerWithBashSyleAutocompleteWithRawContent(configKey, content) {
  registerProfileBlock({ profilePath: BASH_SYLE_PATH, configKey, content });
}

/**
 * Registers a platform-specific tweaks file with BASH_SYLE_PATH and writes the tweaks content.
 * @param {string} platformName - Display name (e.g. "Only Mac")
 * @param {string} content - The tweaks content to append to the profile
 */
function registerPlatformTweaks(platformName, content) {
  registerProfileBlock({ profilePath: BASH_SYLE_PATH, configKey: `${platformName} OS-specific Tweaks`, content });
}

/**
 * Buffers a config block removal by registering empty content for the given key.
 * The actual write happens when flushProfileBlocks() is called.
 * @param {object} options - Configuration options.
 * @param {string} options.profilePath - The profile file path
 * @param {string} options.configKey - The config key identifying the block to remove
 * @param {string} [options.commentPrefix='#'] - The comment character/prefix
 */
function removeProfileBlock({ profilePath, configKey, commentPrefix = "#" }) {
  log(`>> Remove ProfileBlock`, colorRed(configKey), profilePath);
  if (!_profileBlockBuffer.has(profilePath)) {
    _profileBlockBuffer.set(profilePath, new Map());
  }
  _profileBlockBuffer.get(profilePath).set(configKey, { content: "", isPrepend: false, isRemove: true });
}

/**
 * Removes a config block from BASH_SYLE_PATH.
 * @param {string} configKey - The config key for the text block to remove
 */
function removeFromBashSyleProfile(configKey) {
  removeProfileBlock({ profilePath: BASH_SYLE_PATH, configKey });
}

/**
 * Removes a config block from POWERSHELL_SYLE_PATH.
 * @param {string} configKey - The config key for the text block to remove
 */
function removeFromPowershellProfile(configKey) {
  removeProfileBlock({ profilePath: POWERSHELL_SYLE_PATH, configKey });
}

//////////////////////////////////////////////////////
// Guard Clauses
//////////////////////////////////////////////////////
/**
 * Sentinel error thrown by guard functions to skip the current script without killing the process.
 * In bundled execution, the per-script try/catch catches this and silently moves to the next script.
 */
class ScriptSkipError extends Error {
  constructor(message) {
    super(message);
    this.name = "ScriptSkipError";
  }
}

/**
 * Guard clause: exits the process based on whether the given path exists or not.
 * @param {string} targetPath - The path to check
 * @param {boolean} [exitIfFound=false] - If true, exits when path exists. If false, exits when path does not exist.
 * @param {string} [message] - Optional message (defaults to "Skipped : Found Folder" or "Skipped : Not Found")
 */
function exitIfPathCheck(targetPath, exitIfFound = false, message) {
  const found = pathExists(targetPath);
  if (exitIfFound ? found : !found) {
    const defaultMessage = exitIfFound ? "Skipped : Found Folder" : "Skipped : Not Found";
    throw new ScriptSkipError(`${message || defaultMessage} ${targetPath}`);
  }
}

/**
 * Guard clause: exits the process if the given path does not exist.
 * @param {string} targetPath - The path to check
 * @param {string} [message] - Optional message (defaults to "Skipped : Not Found")
 */
function exitIfPathNotFound(targetPath, message) {
  return exitIfPathCheck(targetPath, false, message);
}

/**
 * Guard clause: exits the process if the given path already exists.
 * @param {string} targetPath - The path to check
 * @param {string} [message] - Optional message (defaults to "Skipped : Found Folder")
 */
function exitIfPathFound(targetPath, message) {
  return exitIfPathCheck(targetPath, true, message);
}

/**
 * Guard clause: exits the process if the current OS matches any of the given OS flags.
 * Used by individual scripts to self-guard against unsupported platforms.
 * @param {...string} osFlags - OS flag names to check (e.g. "is_os_android_termux", "is_os_arch_linux")
 */
function exitIfUnsupportedOs(...osFlags) {
  const flags = osFlags.flat();
  for (const flag of flags) {
    if (global[flag]) {
      throw new ScriptSkipError(`Not supported on ${flag}`);
    }
  }
}

/**
 * Guard clause: throws ScriptSkipError if the current OS is a limited-support platform (LIMITED_SUPPORT_OSES).
 * Throwing propagates up to the script runner, which catches ScriptSkipError and stops the current script.
 */
function exitIfLimitedSupportOs() {
  return exitIfUnsupportedOs(LIMITED_SUPPORT_OSES);
}

/**
 * Guard clause: exits the process if the current OS does NOT match any of the given OS flags.
 * Inverse of exitIfUnsupportedOs — use this to restrict a script to specific platforms only.
 * @param {...string} osFlags - OS flag names that are allowed (e.g. "is_os_mac", "is_os_windows")
 */
function exitIfNotTargetOs(...osFlags) {
  const flags = osFlags.flat();
  for (const flag of flags) {
    if (global[flag]) {
      return;
    }
  }
  throw new ScriptSkipError(`Only supported on ${flags.join(", ")}`);
}

/**
 * Guard clause: exits the process if not running as root/sudo.
 * Used by .su.js scripts to ensure they have the required privileges.
 */
function exitIfNotSudo() {
  if (IS_DRY_RUN) return;
  if (typeof process.getuid === "function" && process.getuid() !== 0) {
    throw new ScriptSkipError("Requires sudo/root privileges");
  }
}

/**
 * Guard clause: exits if no Chromium-based browser (Chrome, Brave, Edge, Chromium) is installed.
 */
function exitIfNoChromiumBrowser() {
  if (!hasChromiumBrowser) {
    throw new ScriptSkipError("No Chromium browser found (Chrome/Brave/Edge)");
  }
}

//////////////////////////////////////////////////////
// Text Processing Utilities
//////////////////////////////////////////////////////
/**
 * Collapses runs of 3+ consecutive newlines into double newlines and trims the result.
 * @param {string} text - The text to clean up
 * @returns {string} The cleaned text with excess whitespace removed
 */
function cleanupExtraWhitespaces(text) {
  return text.replace(/[\r\n][\r\n][\n]+/g, "\n\n").trim();
}

/**
 * Removes empty BEGIN/END marker pairs (where the content between markers is blank after trimming).
 * Also removes empty SOURCE_BEGIN/SOURCE_END pairs and unexpanded SOURCE markers.
 * Useful for cleaning up pre-placed dummy markers that were never filled.
 * @param {string} text - The text content to clean
 * @param {string} [commentPrefix='#'] - The comment character/prefix
 * @returns {string} The text with empty marker pairs removed
 */
function removeEmptyBlocks(text, commentPrefix = "#") {
  const longFormPattern = new RegExp(
    `${commentPrefix} ${TEXT_BLOCK_START_MARKER} [^\\r\\n]+\\r?\\n\\s*${commentPrefix} ${TEXT_BLOCK_END_MARKER} [^\\r\\n]*`,
    "g",
  );
  const sourceLongFormPattern = new RegExp(
    `${commentPrefix} ${TEXT_BLOCK_SOURCE_START_MARKER} [^\\r\\n]+\\r?\\n\\s*${commentPrefix} ${TEXT_BLOCK_SOURCE_END_MARKER} [^\\r\\n]*`,
    "g",
  );
  const shortKeywords = `${TEXT_BLOCK_SHORT_MARKER}|${TEXT_BLOCK_ALIAS_MARKER}`;
  const shortFormPattern = new RegExp(`${commentPrefix} (?:${shortKeywords})\\s+[^a-zA-Z0-9]*[^\\r\\n]+`, "g");
  const sourcePattern = new RegExp(`${commentPrefix} ${TEXT_BLOCK_SOURCE_MARKER}\\s+[^\\r\\n]+`, "g");
  return text
    .replace(longFormPattern, "")
    .replace(sourceLongFormPattern, "")
    .replace(shortFormPattern, "")
    .replace(sourcePattern, "")
    .trim();
}

/**
 * Splits text into unique, trimmed lines, filtering out empty lines and comment lines (// # *).
 * @param {...string} texts - One or more text strings to split
 * @returns {string[]} Array of unique, non-empty, non-comment lines
 */
function convertTextToList(...texts) {
  return convertRawTextToList(...texts).filter((s) => !!s && !s.match(/^\s*\/\/\/*/) && !s.match(/^\s*#+/) && !s.match(/^\s*[*]+/));
}

/**
 * Splits text into a deduplicated array of unique, non-empty, non-comment, trimmed lines.
 * Same filtering as `convertTextToList` but deduplicates the result.
 * @param {...string} texts - One or more text strings to split
 * @returns {string[]} Deduplicated array of non-empty, non-comment lines
 */
function convertTextToSet(...texts) {
  return [...new Set(convertTextToList(...texts))];
}

/**
 * Splits text into unique, trimmed lines (including empty and comment lines).
 * @param {...string} texts - One or more text strings to split
 * @returns {string[]} Array of unique, trimmed lines
 */
function convertRawTextToList(...texts) {
  const text = [...texts].join("\n");

  const items = text.split("\n").map((s) => s.trim());

  return items;
}

/**
 * Parses hosts-file formatted text into a deduplicated array of hostnames.
 * Strips leading IP addresses and filters to valid hostname patterns.
 * @param {...string} texts - One or more hosts-file formatted text strings
 * @returns {string[]} Unique hostnames extracted from the input
 */
function convertTextToHosts(...texts) {
  const hosts = convertRawTextToList(...texts)
    .map((s) => s.replace(/^[0-9]+.[0-9]+.[0-9]+.[0-9]+[ ]*/, "").trim())
    .filter((s) => s.length > 0 && s.match(/^[0-9a-zA-Z-.]+/) && s.match(/^[0-9a-zA-Z-.]+/)[0] === s);
  return [...new Set(hosts)];
}

/**
 * Deduplicates hosts, lowercases them, and adds www-prefixed variants.
 * @param {string[]} hosts - Array of hostnames to consolidate.
 * @returns {string[]} Deduplicated array with www variants included.
 */
function consolidateHosts(hosts) {
  const expanded = [...hosts];

  for (const host of hosts) {
    if (!host.includes("www.")) {
      expanded.push("www." + host);
    }
  }

  return [...new Set(expanded.map((s) => s.toLowerCase()))];
}

/**
 * Trims leading spaces from each line of a text block by a specified or auto-detected amount.
 * If spaceToTrim is not provided, it is inferred from the indentation of the first non-empty line.
 * @param {string} text - The multiline text to dedent
 * @param {number} [spaceToTrim] - Number of leading spaces to remove from each line. Auto-detected if omitted.
 * @returns {string} The dedented text
 */
function trimLeftSpaces(text, spaceToTrim) {
  const lines = text.split("\n");

  if (spaceToTrim === undefined) {
    const firstLine = lines.find((line) => line.trim());
    if (!firstLine) return text;
    const match = firstLine.match(/^[ ]+/);
    if (!match) return text;
    spaceToTrim = match[0].length;
  }

  return lines
    .map((line) => {
      const match = line.match(/^[ ]+/);
      const myLeftSpaces = match ? match[0].length : 0;
      return line.substring(Math.min(spaceToTrim, myLeftSpaces));
    })
    .join("\n");
}

/**
 * Base tagged template literal for all other template literals (`code`, `list`, `set`, `json`, `readText`, `readJson`).
 * Concatenates parts into a single string, treating `null` and `undefined` as empty strings.
 * Unescapes `\$`, `\``, and `\\` to their literal characters.
 * @param {TemplateStringsArray} strings - Template literal string segments
 * @param {...*} values - Interpolated values
 * @returns {string} The concatenated string
 */
function text(strings, ...values) {
  let raw = "";
  for (let i = 0; i < strings.raw.length; i++) {
    raw += strings.raw[i];
    if (i < values.length) raw += values[i] == null ? "" : String(values[i]);
  }
  return raw.replace(/\\([`$\\])/g, "$1");
}

/**
 * Tagged template literal for inline code blocks.
 * Dedents via `trimLeftSpaces`, trims trailing whitespace per line, and trims the final result.
 * Supports JS interpolation — `${expr}` values are spliced into the result.
 * @param {TemplateStringsArray} strings - Template literal string segments
 * @param {...*} values - Interpolated values
 * @returns {string} The dedented, trimmed raw text
 */
function code(strings, ...values) {
  return trimLeftSpaces(text(strings, ...values))
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

/**
 * Tagged template literal that returns a deduplicated list from raw text.
 * Combines `code` (dedent + trim) with `convertTextToList` (split, dedup, filter comments).
 * Supports JS interpolation — `${expr}` values are spliced into the result.
 * @param {TemplateStringsArray} strings - Template literal string segments
 * @param {...*} values - Interpolated values
 * @returns {string[]} Array of unique, non-empty, non-comment lines
 */
function list(strings, ...values) {
  return convertTextToList(code(strings, ...values));
}

/**
 * Tagged template literal that returns a deduplicated array from raw text.
 * Combines `code` (dedent + trim) with `convertTextToSet` (split, dedup, filter comments).
 * Supports JS interpolation — `${expr}` values are spliced into the result.
 * @param {TemplateStringsArray} strings - Template literal string segments
 * @param {...*} values - Interpolated values
 * @returns {string[]} Deduplicated array of non-empty, non-comment lines
 */
function set(strings, ...values) {
  return convertTextToSet(code(strings, ...values));
}

/**
 * Tagged template literal that parses JSONC (JSON with comments) from inline content.
 * Combines `code` (dedent + trim) with `parseJsonWithComments` (strip comments, parse JSON).
 * Supports JS interpolation — `${expr}` values are spliced into the result.
 * @param {TemplateStringsArray} strings - Template literal string segments
 * @param {...*} values - Interpolated values
 * @returns {*} The parsed JSON value (object, array, etc.)
 */
function json(strings, ...values) {
  try {
    return parseJsonWithComments(code(strings, ...values));
  } catch (e) {
    log("ERROR json tagged template:", e.message);
    return {};
  }
}

/** @type {Set<string>} Files currently being SOURCE-expanded (recursion guard) */
const _sourceExpansionStack = new Set();

/** @type {Map<string, string>} Cache of resolved SOURCE file content (keyed by srcFile path, value is final processed content with metadata) */
const _sourceContentCache = new Map();

/** @type {Object<string, string>} Extension-to-comment-prefix map for SOURCE marker expansion */
const _SOURCE_COMMENT_PREFIXES = {
  ".js": "//",
  ".jsx": "//",
  ".ts": "//",
  ".tsx": "//",
  ".mjs": "//",
  ".sh": "#",
  ".bash": "#",
  ".zsh": "#",
  ".ps1": "#",
};

/**
 * Resolves SOURCE markers in file content read by readText.
 * Expands short-form SOURCE markers into SOURCE_BEGIN/SOURCE_END pairs,
 * reads the referenced files, and inlines their content. All in-memory — never writes back.
 * Caches resolved source file content so repeated includes (e.g. editor.common.js in 3 scripts) only read once.
 * @param {string} filePath - The file path (for comment prefix detection and recursion guard)
 * @param {string} content - The file content
 * @returns {Promise<string>} Content with SOURCE markers resolved
 */
async function _resolveSourceIncludes(filePath, content) {
  if (!content || _sourceExpansionStack.has(filePath)) return content;

  const ext = path.extname(filePath).toLowerCase();
  const commentPrefix = _SOURCE_COMMENT_PREFIXES[ext];
  if (!commentPrefix) return content;

  const sourceResult = _expandSourceMarkers(content, commentPrefix);
  if (sourceResult.sourceFiles.length === 0) return sourceResult.content;

  content = sourceResult.content;
  _sourceExpansionStack.add(filePath);

  /** @type {Object<string, string>} */
  const sourceBlockMap = {};
  for (const srcFile of sourceResult.sourceFiles) {
    const cacheKey = `${commentPrefix}:${srcFile}`;
    if (_sourceContentCache.has(cacheKey)) {
      sourceBlockMap[srcFile] = _sourceContentCache.get(cacheKey);
      continue;
    }
    let fileContent = (await readText`${srcFile}`).trim();
    if (fileContent) {
      if (/\.(sh|bash|zsh)$/.test(srcFile)) {
        fileContent = fileContent.replace(/^#!.*\n/, "");
      }
      try {
        const stat = fs.statSync(srcFile);
        const md5 = await md5Hash(fileContent);
        const size = stat.size < 1024 ? `${stat.size} B` : `${(stat.size / 1024).toFixed(1)} KB`;
        const mtime = stat.mtime;
        const date = `${mtime.getFullYear()}-${String(mtime.getMonth() + 1).padStart(2, "0")}-${String(mtime.getDate()).padStart(2, "0")}`;
        fileContent = `${commentPrefix} ${srcFile} | ${md5} | ${size} | ${date}\n${fileContent.trim()}`;
      } catch (_) {
        // skip metadata if stat fails (e.g. remote mode)
      }
      _sourceContentCache.set(cacheKey, fileContent);
      sourceBlockMap[srcFile] = fileContent;
    } else {
      log(`>> SOURCE marker: file not found: ${srcFile}, will be stripped`);
    }
  }

  _sourceExpansionStack.delete(filePath);

  if (Object.keys(sourceBlockMap).length > 0) {
    content = _replaceSourceBlocks(content, sourceBlockMap, commentPrefix, "");
  }

  return content;
}

/**
 * Tagged template literal that reads text from a file path or URL.
 * 3-tier detection: URL (http) → fetch, absolute path (/ or ~) → fs read, repo-relative → cat/fetch.
 * After reading, automatically resolves any SOURCE markers in-memory (never writes back to source).
 * Returns a promise — use with `await`. Always use literal form: `await readText\`path\`` or `await readText\`$\{expr}\``.
 * @param {TemplateStringsArray} strings - Template literal string segments
 * @param {...*} values - Interpolated values
 * @returns {Promise<string>} The file/URL content as a string
 */
async function readText(strings, ...values) {
  const target = text(strings, ...values).trim();

  // tier 1: URL — fetch via curl / fetch
  if (target.startsWith("http")) {
    return _readTextFromURL(target);
  }

  /** @type {string} */
  let content;

  // tier 2: absolute / home path — read from local filesystem
  if (target.startsWith("/") || target.startsWith("~")) {
    content = await _readTextFromFile(target);
  }
  // tier 3: repo-relative path — file read if local repo, URL fetch otherwise
  else if (IS_LOCAL_REPO) {
    content = await _readTextFromFile(target);
  } else {
    content = await _readTextFromURL(getFullUrl(target));
  }

  // Expand SOURCE markers in-memory (never writes back to source files)
  return _resolveSourceIncludes(target, content);
}

/**
 * Reads text content from a local file, falling back to cat via execBash.
 * @param {string} filePath - The file path to read
 * @returns {Promise<string>} The trimmed file contents, or an empty string on error
 */
async function _readTextFromFile(filePath) {
  let result = "";
  if (pathExists(filePath)) {
    try {
      try {
        result = fs.readFileSync(filePath, { encoding: "utf8", flag: "r" });
      } catch (err) {
        result = await execBash(`cat ${filePath}`);
      }
    } catch (_) {}
  }
  return result.trim();
}

/**
 * Fetches text content from a URL, trying fetch first and falling back to curl.
 * @param {string} url - The URL to fetch
 * @returns {Promise<string>} The response body as text
 */
async function _readTextFromURL(url) {
  if (!url.startsWith("http")) throw new Error(`Invalid URL: ${url}`);
  let result = "";
  try {
    try {
      const res = await fetch(url);
      result = await res.text();
    } catch (err) {
      result = await execBash(`curl -fsSL ${url}`);
    }
  } catch (_) {}
  return result.trim();
}

/**
 * Downloads a JS module from a URL and requires it. Uses readText to fetch, writes to a temp file, then requires it.
 * @param {TemplateStringsArray} strings - Template literal string segments
 * @param {...*} values - Interpolated values
 * @returns {Promise<*>} The module's exports
 */
async function requireUrl(strings, ...values) {
  const url = text(strings, ...values).trim();
  const code = await _readTextFromURL(url);
  if (!code) throw new Error(`requireUrl: empty response from ${url}`);
  const tmpFile = path.join(os.tmpdir(), `requireUrl-${Date.now()}.js`);
  fs.writeFileSync(tmpFile, code);
  try {
    return require(tmpFile);
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

/**
 * Tagged template literal that reads a file path or URL and parses the content as JSONC.
 * Returns a promise — use with `await`. Always use literal form: `await readJson\`path\`` or `await readJson\`$\{expr}\``.
 * @param {TemplateStringsArray} strings - Template literal string segments
 * @param {...*} values - Interpolated values
 * @returns {Promise<object>} The parsed JSON object
 */
async function readJson(strings, ...values) {
  const content = await readText(strings, ...values);
  try {
    return parseJsonWithComments(content);
  } catch (e) {
    const level = e.message.includes("empty input") ? "WARN" : "ERROR";
    log(`${level} readJson:`, e.message);
    return {};
  }
}

/**
 * Tagged template literal that reads a file path or URL and returns a list of lines.
 * Combines `readText` with `convertTextToList` (split, trim, filter comments, no dedup).
 * Returns a promise — use with `await`. Always use literal form: `await readList\`path\``.
 * @param {TemplateStringsArray} strings - Template literal string segments
 * @param {...*} values - Interpolated values
 * @returns {Promise<string[]>} Array of non-empty, non-comment lines
 */
async function readList(strings, ...values) {
  const content = await readText(strings, ...values);
  return convertTextToList(content);
}

/**
 * Tagged template literal that reads a file path or URL and returns a deduplicated list of lines.
 * Combines `readText` with `convertTextToSet` (split, trim, filter comments, dedup).
 * Returns a promise — use with `await`. Always use literal form: `await readSet\`path\``.
 * @param {TemplateStringsArray} strings - Template literal string segments
 * @param {...*} values - Interpolated values
 * @returns {Promise<string[]>} Deduplicated array of non-empty, non-comment lines
 */
async function readSet(strings, ...values) {
  const content = await readText(strings, ...values);
  return convertTextToSet(content);
}

/**
 * Trims leading and trailing spaces from each line of a text block.
 * @param {string} text - The multiline text to trim
 * @returns {string} The text with each line trimmed
 */
function trimSpacesOnBothEnd(text) {
  return (text || "")
    .split("\n")
    .map((s) => s.trim())
    .join("\n");
}

/**
 * Calculates a percentage value to two decimal places.
 * @param {number} count - The part value
 * @param {number} total - The whole value
 * @returns {string} The percentage as a string with two decimal places (e.g. "75.00")
 */
function calculatePercentage(count, total) {
  return ((count * 100) / total).toFixed(2);
}

//////////////////////////////////////////////////////
// Network / API Utilities
//////////////////////////////////////////////////////
/**
 * Extracts the root domain (e.g. "example.com") from a URL or hostname string.
 * @param {string} url - The URL or hostname to extract the root domain from
 * @returns {string} The root domain portion of the URL
 */
function getRootDomainFrom(url) {
  const lastDotIndex = url.lastIndexOf(".");
  const partialUrl = url.substring(0, lastDotIndex);
  const secondLastDotIdx = partialUrl.lastIndexOf(".") || 0;

  return url.substring(secondLastDotIdx + 1);
}

/**
 * Converts a relative URL to an absolute URL by prepending REPO_PREFIX_URL with ?raw=1.
 * If the URL already starts with "http", it is returned as-is.
 * @param {string} url - The URL or relative path to resolve
 * @returns {string} The fully qualified URL
 */
function getFullUrl(url) {
  if (!url.startsWith("http")) {
    url = getGitHubRawUrl(url);
  }
  return url;
}

/**
 * Performs a shallow git clone of a repository into the specified directory.
 * @param {string} repo - The git repository URL to clone
 * @param {string} destinationDir - The local directory to clone into
 * @param {boolean} [cloneAll=false] - If true, clone all branches; otherwise clone only the default branch
 * @returns {Promise<string>} Resolves with the stdout of the git clone command
 */
function gitClone(repo, destinationDir, cloneAll = false) {
  if (IS_DRY_RUN) {
    log(`>> [DryRun] Would git clone ${repo} -> ${destinationDir}`);
    return Promise.resolve("");
  }
  const branchFlag = cloneAll ? "" : "--single-branch";
  return execBash(`git clone --depth 1 ${branchFlag} "${repo}" "${destinationDir}" &>/dev/null`);
}

/**
 * Downloads a single asset via downloadAssets. Resolves relative URLs via getFullUrl.
 * If destination is a directory, the filename is derived from the URL.
 * @param {string} url - The URL to download from (relative paths are resolved via REPO_PREFIX_URL)
 * @param {string} destination - The local file path or directory to save to
 * @returns {Promise<string>} Resolves to the destination file path
 */
function downloadAsset(url, destination) {
  url = getFullUrl(url);
  const dest =
    fs.existsSync(destination) && fs.statSync(destination).isDirectory() ? path.join(destination, path.basename(url)) : destination;
  return downloadAssets(url, dest).then((results) => results[0]);
}

/**
 * Downloads one or more assets in parallel using a single curl command.
 * Skips files that already exist, supports dry-run mode, and logs each download individually.
 * If destination is a directory, filenames are derived from URLs. If it's a file path, uses it directly.
 * @param {string|string[]} urls - URL or array of URLs to download
 * @param {string} destination - The local directory or file path to save to
 * @returns {Promise<string[]>} Resolves with an array of destination file paths for each URL
 */
function downloadAssets(urls, destination) {
  urls = [].concat(urls).map(getFullUrl);
  const isDir = fs.existsSync(destination) && fs.statSync(destination).isDirectory();

  const args = [];
  const results = [];
  const pending = [];
  const localCopied = [];
  for (const url of urls) {
    const dest = isDir ? path.join(destination, path.basename(url)) : destination;
    results.push(dest);
    log(`>> Downloading Asset ${path.basename(url)}:`, url);

    if (IS_DRY_RUN) {
      log(`>> [DryRun] Would download ${path.basename(url)} to ${dest}`);
      continue;
    }

    if (pathExists(dest)) {
      log("<<< Skipped [NotModified]", dest);
      continue;
    }

    // local repo optimization: copy from repo instead of downloading
    if (IS_LOCAL_REPO && REPO_PREFIX_URL && url.startsWith(REPO_PREFIX_URL)) {
      const localPath = url.slice(REPO_PREFIX_URL.length).replace(/\?raw=1$/, "");
      if (pathExists(localPath)) {
        copyFile(localPath, dest);
        log("<<< Copied from local repo", localPath);
        localCopied.push({ url, dest });
        continue;
      }
    }

    args.push(`-fsSL "${url}" -o "${dest}"`);
    pending.push({ url, dest });
  }

  /** @param {{ url: string, dest: string }[]} entries - Download entries to record in the metadata log */
  function _recordDownloadMetadata(entries) {
    const metadata = [];
    for (const { url, dest } of entries) {
      let status = "Success";
      let fileSize = 0;
      try {
        fileSize = fs.statSync(dest).size || 0;
      } catch (_) {}
      if (fileSize === 0) status = "Error";
      metadata.push(`${status} ${url} ${dest} ${fileSize}`);
    }
    if (metadata.length > 0) {
      try {
        fs.appendFileSync(DOWNLOAD_ASSET_METADATA_PATH, metadata.join("\n") + "\n");
      } catch (_) {}
    }
  }

  // record metadata for local copies
  _recordDownloadMetadata(localCopied);

  if (args.length === 0) return Promise.resolve(results);
  return execBash(`curl --parallel --parallel-max 10 ${args.join(" ")}`).then(() => {
    _recordDownloadMetadata(pending);
    return results;
  });
}

/**
 * Builds a GitHub Releases API URL from a repo identifier.
 * Accepts "owner/repo" (defaults to latest) or "owner/repo/version".
 * e.g. "synle/url-porter" → "https://api.github.com/repos/synle/url-porter/releases/latest"
 * e.g. "synle/url-porter/v1.2.0" → "https://api.github.com/repos/synle/url-porter/releases/tags/v1.2.0"
 * @param {string} repoId - Repository identifier ("owner/repo" or "owner/repo/version")
 * @returns {string} Full GitHub API releases URL
 */
function getGitHubReleaseApiUrl(repoId) {
  const parts = repoId.split("/");
  const owner = parts[0];
  const repo = parts[1];
  const version = parts[2] || "latest";
  if (version === "latest") {
    return `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
  }
  return `https://api.github.com/repos/${owner}/${repo}/releases/tags/${version}`;
}

/**
 * Extracts the repository name from a repo identifier.
 * e.g. "synle/url-porter" → "url-porter"
 * This must match the derivation in ci-download-release-binaries.sh.
 * @param {string} repoId - Repository identifier ("owner/repo" or "owner/repo/version")
 * @returns {string} The repository name
 */
function getRepoNameFromId(repoId) {
  return repoId.split("/")[1] || "";
}

/**
 * Fetches the latest release version tag from a GitHub repo.
 * @param {string} repoId - Repository identifier ("owner/repo" or "owner/repo/version")
 * @returns {Promise<string>} The tag_name from the release (e.g. "v1.2.0" or "1.2.0")
 */
async function fetchGitHubReleaseVersion(repoId) {
  const releaseData = await readJson`${getGitHubReleaseApiUrl(repoId)}`;
  const version = releaseData.tag_name || "";
  if (!version) throw new ScriptSkipError(`No official release found for ${repoId}`);
  return version;
}

/**
 * Downloads a release asset with fallback to the local assets/ backup.
 * The backup directory is derived from the repo identifier (repo name),
 * matching the same derivation used by ci-download-release-binaries.sh.
 *
 * Flow:
 * 1. Download the file from the upstream GitHub release URL.
 * 2. If the file exists and is non-empty → success, return true.
 * 3. If that failed, look for assets/<repo>/<same filename> as a local fallback.
 * 4. If the fallback file exists and is non-empty → copy it to destination, return true.
 * 5. If no fallback either → log and return false.
 *
 * @param {string} repoId - Repository identifier ("owner/repo" or "owner/repo/version")
 * @param {string} url - Upstream download URL
 * @param {string} destination - Local file path to save the asset to
 * @returns {Promise<boolean>} True if a valid asset is available at destination, false otherwise
 */
async function downloadAssetWithFallback(repoId, url, destination) {
  const appName = getRepoNameFromId(repoId);

  // Step 1: attempt upstream download
  await downloadAsset(url, destination);

  // Step 2: validate — if file exists and non-empty, success
  const isValid = fs.existsSync(destination) && (fs.statSync(destination).size || 0) > 0;
  if (isValid) return true;

  // Step 3-4: upstream failed — try local fallback from assets/binaries/<repo>/
  const fallbackFile = path.join(path.resolve("assets/binaries"), appName, path.basename(destination));
  if (fs.existsSync(fallbackFile) && (fs.statSync(fallbackFile).size || 0) > 0) {
    log(`>> Download of ${appName} failed, restoring from assets/binaries/ backup:`, fallbackFile);
    await mkdir(path.dirname(destination));
    copyFile(fallbackFile, destination);
    return true;
  }

  // Step 5: no fallback available
  log(`>> Download of ${appName} failed, no backup available in assets/binaries/${appName}/`);
  return false;
}

/**
 * Downloads application binaries from the main repo into the appropriate OS-specific applications directory.
 * On Windows, uses the WSL binary directory. On Linux/Mac, uses the custom tweaks directory (~/_extra).
 * Fetches the repo file list, filters to matching assets, and downloads them in parallel.
 * @param {string} applicationName - The application name
 * @param {string|function(string): boolean} findFilter - Substring to match or filter function to select which asset files to download
 * @returns {Promise<string>} The target directory path where the app was downloaded
 */
async function downloadApp(applicationName, findFilter) {
  const targetPath = is_os_windows ? await getWindowsApplicationBinaryDir(applicationName) : await getCustomTweaksPath(applicationName);
  log(`>> Downloading App:`, colorRed(applicationName), targetPath);
  await mkdir(targetPath);
  const files = await listRepoDir("remote_api", true);
  const filterFn = typeof findFilter === "string" ? (f) => f.includes(findFilter) : findFilter;
  const filesToDownload = files.filter((s) => s.includes("assets/") && !s.toLowerCase().includes(".md")).filter(filterFn);
  await downloadAssets(filesToDownload, targetPath);
  return targetPath;
}

/**
 * Downloads and installs a browser extension from a GitHub release zip.
 * Fetches the latest release version, deletes any previous install, downloads the zip, extracts, and cleans up.
 * @param {string} repo - GitHub repo identifier (e.g. "synle/url-porter")
 */
async function installBrowserExtension(repo) {
  const version = await fetchGitHubReleaseVersion(repo);
  const extensionName = repo.split("/").pop();
  const targetPath = await getCustomTweaksPath(extensionName);
  const zipUrl = `https://github.com/${repo}/releases/download/${version}/${extensionName}.zip`;
  const tmpZip = `${BASHRC_TEMP_DIR}/${extensionName}.zip`;
  log(`>> Installing ${extensionName} ${version} extension to:`, targetPath);
  await deleteFolder(targetPath);
  await mkdir(targetPath);
  const ok = await downloadAssetWithFallback(repo, zipUrl, tmpZip);
  if (ok) {
    await unzip(tmpZip, targetPath);
  }
  await deleteFile(tmpZip);
}

//////////////////////////////////////////////////////
// Script File Discovery & Platform Filtering
//////////////////////////////////////////////////////
/**
 * Deduplicates and filters raw file list to valid software script paths.
 * Normalizes prefixes, removes non-script files, and returns unique entries.
 * @param {string[]} files - Raw list of file paths to filter
 * @returns {string[]} Deduplicated, filtered, and normalized script file paths
 */
function filterRepoScripts(files) {
  const filtered = (files || [])
    .map((s) => s.trim().replace(/^\.\//, ""))
    .filter((f) => f && f.startsWith("software/"))
    .filter((f) => !f.endsWith(".json") && !f.endsWith(".test.js") && f !== "software/index.js")
    .filter((f) => [`.js`, `.sh`].some((allowedExt) => f.endsWith(allowedExt)));

  // this is a list of files to run last
  // NOTE: vs-code-ext.sh installs extensions in the background and is the slowest
  // step on a clean run, so it goes at the very end to keep earlier feedback fast.
  const lastFiles = convertTextToList(`
    software/scripts/advanced/vs-code-ext.sh
  `);

  // software/scripts/_init.js always runs first (assembles the profile template)
  const firstFiles = convertTextToList(`
    software/scripts/_init.js
  `);

  return [...new Set(filtered)].sort((a, b) => {
    const aIsFirst = firstFiles.includes(a);
    const bIsFirst = firstFiles.includes(b);

    // firstFiles come first
    if (aIsFirst !== bIsFirst) return aIsFirst ? -1 : 1;

    const aIsLast = lastFiles.includes(a);
    const bIsLast = lastFiles.includes(b);

    // lastFiles come last
    if (aIsLast !== bIsLast) return aIsLast ? 1 : -1;

    // OS _init files run early (OS-specific init before dependency install)
    const aIsOsInit = /_init\./.test(a) && !firstFiles.includes(a);
    const bIsOsInit = /_init\./.test(b) && !firstFiles.includes(b);
    if (aIsOsInit !== bIsOsInit) return aIsOsInit ? -1 : 1;

    // _full-setup files run after OS init but before regular tool scripts
    const aIsFullSetup = a.includes("_full-setup.");
    const bIsFullSetup = b.includes("_full-setup.");
    if (aIsFullSetup !== bIsFullSetup) return aIsFullSetup ? -1 : 1;

    // ~ prefixed scripts (cleanup/wrapup) run after everything else
    const aIsPost = /\/~/.test(a);
    const bIsPost = /\/~/.test(b);
    if (aIsPost !== bIsPost) return aIsPost ? 1 : -1;

    // TODO: re-enable bundle-type sort once bundling execution is fully debugged.
    // Group by bundle runner type so consecutive scripts can be bundled into a single
    // process invocation (one node heredoc for all .js, one bash heredoc for all .sh, etc.).
    // const bundleOrder = { js: 0, sh: 1 };
    // const aBundleRank = bundleOrder[_getBundleRunnerType(a)] ?? 2;
    // const bBundleRank = bundleOrder[_getBundleRunnerType(b)] ?? 2;
    // if (aBundleRank !== bBundleRank) return aBundleRank - bBundleRank;

    // then alphabetically (byte-order, not locale, for cross-platform consistency)
    // ASCII sort reference for filename prefixes/markers:
    //   !  (33)   +  (43)   -  (45)   .  (46)
    //   0-9 (48-57)   ^  (94)   _  (95)
    //   a-z (97-122)
    //   {  (123)  |  (124)  }  (125)  ~  (126)
    // Strip advanced/ folder prefix so advanced/fzf.js sorts alongside fzf.js
    const aSort = a.replace("/advanced/", "/");
    const bSort = b.replace("/advanced/", "/");
    return aSort < bSort ? -1 : aSort > bSort ? 1 : 0;
  });
}

/**
 * Lists all files in the repository from different sources.
 * @param {string} [source='remote_api'] - Source to fetch files from:
 *   'remote_api' - fetches from GitHub Git tree API
 *   'remote_cache' - fetches from pre-compiled script list config
 *   'local' - fetches from local filesystem using find
 * @param {boolean} [fallthrough=false] - If true, continues trying remaining sources in order
 *   (remote_api -> remote_cache -> local) when the selected source fails
 * @returns {Promise<string[]>} Array of file paths in the repository
 */
async function listRepoDir(source = "remote_api", fallthrough = false) {
  // Order: remote_api -> remote_cache -> local (matches the fallthrough chain)
  return (
    ((source === "remote_api" || fallthrough) &&
      (await cacheInMemory("listRepoDir.remote_api", async () => {
        const url = `https://api.github.com/repos/${REPO_PATH_IDENTIFIER}/git/trees/${REPO_BRANCH_NAME}?recursive=1&cacheBust=${Date.now()}`;
        const json = await readJson`${url}`;
        return json.tree.map((file) => file.path);
      }))) ||
    ((source === "remote_cache" || fallthrough) &&
      (await cacheInMemory("listRepoDir.remote_cache", async () =>
        convertTextToList(await readText`software/metadata/script-list.config`),
      ))) ||
    ((source === "local" || fallthrough) &&
      (await cacheInMemory("listRepoDir.local", async () => filterRepoScripts(convertRawTextToList(await execBash("find .")))))) ||
    []
  );
}

/**
 * Get all available scripts used for searching and matching against partially matched scripts.
 * Includes .js and .sh files under software/scripts/ and software/metadata/ (excludes tools, common, etc.).
 * @returns {Promise<string[]>} Array of all script file paths sorted by depth then alphabetically
 */
async function getAllRepoSoftwareFiles() {
  return filterRepoScripts(await listRepoDir("local", true)).filter(
    (f) => f.includes("software/scripts/") || f.includes("software/metadata/"),
  );
}

/**
 * Filters a list of file paths by OS-specific subfolders under a given base path.
 * Files in `<basePath>/<os_name>/` are excluded if the corresponding `is_os_<os_name>`
 * flag is not set. Files outside any OS subfolder (e.g. in a `common/` folder) pass through.
 * Reused by both software script and bootstrap dependency discovery.
 * @param {string[]} files - File paths to filter
 * @param {string} basePath - Base directory containing OS subfolders (e.g. "software/scripts")
 * @returns {string[]} Filtered file paths matching the current platform
 */
function _filterByOsFolders(files, basePath) {
  const pathsToIgnore = OS_SCRIPT_PATHS.map(([valid, osScriptPath]) => {
    if (valid) return "";
    const osName = osScriptPath.replace("software/scripts/", "");
    return `${basePath}/${osName}`;
  }).filter((s) => !!s);

  return files.filter((file) => {
    let error = "";
    for (const pathToIgnore of pathsToIgnore) {
      if (file.includes(pathToIgnore)) {
        error = `Ignored OS Specific`;
        break;
      }
    }

    if (IS_DEBUG) {
      if (error) {
        echo(`>>`, `Error`, error, file);
      } else {
        echo(`>>`, `Accepted`, file);
      }
    }
    return !error;
  });
}

/**
 * Gets list of scripts available for a system based on OS flags, used for checking and testing.
 * Filters scripts based on the current OS platform and applies ordering rules.
 * _init.js is pinned first, then `_init` → `_full-setup` → `_only` → `a-z` → `~` (last).
 * _full-setup.sh files are only included when IS_SETUP is set (--setup flag).
 * @returns {Promise<string[]>} Ordered array of script file paths to execute
 */
async function getSoftwareScriptFiles() {
  let files;

  if (IS_LOCAL_REPO) {
    files = await listRepoDir("local");
  } else {
    files = await listRepoDir("remote_api");
  }

  // clean up the files, only include software/scripts (used for run mode by the os)
  files = filterRepoScripts(files).filter((f) => f.includes("software/scripts/"));

  let softwareFiles = files.filter((f) => !f.includes(".common.js") && !f.includes(".standalone.js"));

  // _full-setup.sh files only run in setup mode (--setup flag)
  if (!IS_SETUP) {
    softwareFiles = softwareFiles.filter((f) => !f.includes("_full-setup."));
  }

  // advanced/ folder scripts are advanced-only: skip on limited-support OSes
  if (!IS_ADVANCED_PROFILE_ENABLED) {
    softwareFiles = softwareFiles.filter((f) => !f.includes("/advanced/"));
  }

  return _filterByOsFolders(softwareFiles, "software/scripts");
}

//////////////////////////////////////////////////////
// Bash Execution
//////////////////////////////////////////////////////
/**
 * Executes a bash command asynchronously and returns the trimmed output as a string. Default timeout is 30s, capped at 30s max.
 * @param {string} cmd - The shell command to execute
 * @param {object} [options] - Optional exec options (cwd, env, timeout, etc.)
 * @returns {Promise<string>} The command's trimmed stdout
 */
async function execBash(cmd, options) {
  const MAX_TIMEOUT = 30_000;
  const execOptions = {
    ...(options || {}),
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: Math.min(options?.timeout || MAX_TIMEOUT, MAX_TIMEOUT),
  };
  return new Promise((resolve) => {
    exec(cmd, execOptions, (error, stdout, stderr) => {
      resolve((stdout || "").trim());
    });
  });
}

/**
 * Executes a bash command synchronously and returns the trimmed output as a string. Default timeout is 30s, capped at 30s max.
 * @param {string} cmd - The shell command to execute
 * @param {object} [options] - Optional exec options (cwd, env, timeout, etc.)
 * @returns {string} The command's trimmed stdout
 */
function execBashSync(cmd, options) {
  const MAX_TIMEOUT = 30_000;
  return execSync(cmd, {
    ...(options || {}),
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: Math.min(options?.timeout || MAX_TIMEOUT, MAX_TIMEOUT),
  }).trim();
}

/**
 * Checks if a binary is available on the system. JS equivalent of bash `has_persistent_binary`.
 * @param {string} name - The binary name to check (e.g. "delta", "rg", "fzf")
 * @returns {boolean} True if the binary is found in PATH
 */
function hasBinary(name) {
  try {
    execBashSync(`type -P ${name}`);
    return true;
  } catch (err) {
    return false;
  }
}

//////////////////////////////////////////////////////
// Console Colors & Output
//////////////////////////////////////////////////////
/**
 * Emits a string to stdout for bash to execute in the `node | bash` pipeline.
 * Use this instead of console.log when outputting bash commands from the orchestration layer.
 * @param {...any} args - The bash command(s) to emit
 */
function emitBash(...args) {
  console.log(...args);
}

/**
 * Wraps a string with ANSI color escape codes.
 * @param {string} str - The text to colorize
 * @param {string} colorCode - The ANSI color code (e.g. '32m' for green)
 * @returns {string} The string wrapped in ANSI color escape sequences
 */
function color(str, colorCode) {
  if (IS_NO_COLOR) return str;
  return `\x1b[${colorCode}${str}\x1b[0m`;
}

/**
 * Checks if a string looks like a file path or URL.
 * @param {string} text - The text to check
 * @returns {boolean} True if the text matches a path or URL pattern
 */
function _looksLikePathOrUrl(text) {
  return /^(\/[\w./-]+|~\/[\w./-]+|https?:\/\/\S+|[a-zA-Z]:\\[\w.\\/-]+)$/.test(text);
}

/** @type {RegExp} Matches repeated marker chars (>, <, #) at start of string, followed by space or end */
const _MARKER_REGEX = /^(>{1,}|<{1,}|#{1,})(\s|$)/;

/**
 * Determines the appropriate color function for a log line based on marker keywords,
 * indentation level, and marker direction (>> or <<).
 *
 * Color priority:
 * 1. Repeated-char markers (highest) — level = marker length - 1
 *    `>` markers: yellow(0), green(1), cyan(2), blue(3), magenta(4+)
 *    `<` markers: orange(0), red(1), blue(2), magenta(3+)
 *    `#` markers: bgYellow(0-1), bgOrange(2), bgCyan(3), bgMagenta(4+)
 * 2. Error/fail keywords => colorBgRed
 * 3. Success/done keywords => colorGreen
 * 4. Path or URL-like text => colorDim
 * 5. Otherwise no auto-color (returns null)
 *
 * @param {string} text - The log text to analyze
 * @returns {((str: string) => string) | null} A color function or null if no auto-color applies
 */
function _getAutoColor(text) {
  // 1. Repeated-char markers — level = marker length - 1 (e.g. >>> = level 2)
  const markerMatch = text.match(_MARKER_REGEX);
  if (markerMatch) {
    const marker = markerMatch[1];
    const ch = marker[0];
    const level = marker.length - 1;

    if (ch === ">") {
      if (level === 0) return colorYellow;
      if (level === 1) return colorGreen;
      if (level === 2) return colorCyan;
      if (level === 3) return colorBlue;
      return colorMagenta;
    }

    if (ch === "<") {
      if (level === 0) return colorOrange;
      if (level === 1) return colorRed;
      if (level === 2) return colorBlue;
      return colorMagenta;
    }

    if (ch === "#") {
      if (level <= 1) return colorBoldYellow;
      if (level === 2) return colorBoldCyan;
      if (level === 3) return colorBoldMagenta;
      return colorOrange;
    }
  }

  // 2. Error/fail keywords => colorBgRed
  if (/(?<=^| )(err|error|errors|fail|failed|failing|failure|failures)(?=$| )/i.test(text)) {
    return colorBgRed;
  }

  // 3. Success/done/finished keywords => colorGreen
  // (?<!auto) prevents matching "autocomplete"
  if (
    /(?<=^| )(done|success|succeed|succeeded|succeeds|finished|accept|accepted|(?<!auto)complete|(?<!auto)completed)(?=$| )/i.test(text)
  ) {
    return colorGreen;
  }

  // 4. Path or URL-like text => colorDim
  if (_looksLikePathOrUrl(text.trim())) {
    return colorDim;
  }

  return null;
}

/**
 * Applies auto-color to each log element independently via _getAutoColor.
 * Elements with existing ANSI codes are preserved as-is.
 * Marker elements (e.g. `>>>`) are stripped to a single char with indentation
 * matching the marker count (e.g. `>>> hello` → `   > hello`).
 * @param {any[]} data - The log arguments
 * @returns {any[]} The potentially colorized log arguments
 */
function _applyAutoColor(data) {
  return data
    .map((elem) => {
      let str = String(elem);
      // Preserve elements that already have user-provided ANSI color codes
      if (str.includes("\x1b[")) return elem;
      const autoColor = _getAutoColor(str);
      // Strip repeated markers to single char, indent by marker count (skip pure line-break strings)
      if (str !== LINE_BREAK_HASH) str = str.replace(_MARKER_REGEX, (_, marker) => "".padStart(marker.length - 1, " ") + marker[0] + " ");
      return autoColor ? autoColor(str) : str;
    })
    .map((elem) => (IS_NO_COLOR ? String(elem).replace(/\x1b\[[0-9;]*m/g, "") : elem));
}

/**
 * Logs colored text to stderr via console.error. Safe in the `node | bash` pipeline
 * because stderr is never piped to bash. Auto-applies colors based on marker keywords
 * and indentation level. Use this for all diagnostic and user-facing output.
 * Never use raw console.log — it goes to stdout and gets executed as bash commands.
 * @param {...string} data - Strings to log (colors applied automatically)
 */
function log(...data) {
  const coloredData = _applyAutoColor(data);
  console.error(...coloredData);
}

/**
 * Logs colored text via the bash pipeline using a bash printf command.
 * Auto-applies colors based on marker keywords and indentation level.
 * Unlike log() which writes to stderr immediately during Node execution,
 * this emits a bash command so the message appears when bash actually
 * reaches that point in the pipeline.
 * @param {...string} data - Strings to log (colors applied automatically)
 */
function echo(...data) {
  const coloredData = _applyAutoColor(data);
  const joined = coloredData.map((s) => String(s)).join(" ");
  const escaped = joined.replace(/'/g, "'\\''");
  emitBash(`printf '%s\\n' '${escaped}' >&2`);
}

/**
 * Named color map for log. Each key is a descriptive color name
 * mapped to its ANSI escape code. Used to generate colorGreen, colorRed, etc.
 */
const LOG_COLORS = {
  green: "32m",
  yellow: "33m",
  cyan: "36m",
  dim: "2m",
  red: "1;31m",
  bgRed: "41;97;1m",
  bgYellow: "43;30m",
  bgCyan: "46;30m",
  bgMagenta: "45;97;1m",
  bgOrange: "48;5;208;30m",
  bgBlue: "44;97;1m",
  magenta: "35m",
  orange: "38;5;208m",
  blue: "34m",
  boldYellow: "1;33m",
  boldCyan: "1;36m",
  boldMagenta: "1;35m",
};

/** @type {(str: string) => string} */ const colorGreen = (str) => color(str, LOG_COLORS.green);
/** @type {(str: string) => string} */ const colorYellow = (str) => color(str, LOG_COLORS.yellow);
/** @type {(str: string) => string} */ const colorCyan = (str) => color(str, LOG_COLORS.cyan);
/** @type {(str: string) => string} */ const colorDim = (str) => color(str, LOG_COLORS.dim);
/** @type {(str: string) => string} */ const colorRed = (str) => color(str, LOG_COLORS.red);
/** @type {(str: string) => string} */ const colorBgRed = (str) => color(str, LOG_COLORS.bgRed);
/** @type {(str: string) => string} */ const colorBgYellow = (str) => color(str, LOG_COLORS.bgYellow);
/** @type {(str: string) => string} */ const colorBgCyan = (str) => color(str, LOG_COLORS.bgCyan);
/** @type {(str: string) => string} */ const colorBgMagenta = (str) => color(str, LOG_COLORS.bgMagenta);
/** @type {(str: string) => string} */ const colorBgOrange = (str) => color(str, LOG_COLORS.bgOrange);
/** @type {(str: string) => string} */ const colorBgBlue = (str) => color(str, LOG_COLORS.bgBlue);
/** @type {(str: string) => string} */ const colorMagenta = (str) => color(str, LOG_COLORS.magenta);
/** @type {(str: string) => string} */ const colorOrange = (str) => color(str, LOG_COLORS.orange);
/** @type {(str: string) => string} */ const colorBlue = (str) => color(str, LOG_COLORS.blue);
/** @type {(str: string) => string} */ const colorBoldYellow = (str) => color(str, LOG_COLORS.boldYellow);
/** @type {(str: string) => string} */ const colorBoldCyan = (str) => color(str, LOG_COLORS.boldCyan);
/** @type {(str: string) => string} */ const colorBoldMagenta = (str) => color(str, LOG_COLORS.boldMagenta);

//////////////////////////////////////////////////////
// Script Processing & Execution
//////////////////////////////////////////////////////
/** @type {Map<string, string>} Cache for script file contents read during inline mode */
const _scriptContentCache = new Map();

/**
 * Determines the bundle type for a script file. Scripts of the same bundle type are
 * collected into a single process invocation to avoid repeating index.js / process startup.
 * @param {string} file - The resolved script file path
 * @returns {"js"|"sh"|null} The bundle type, or null if the file cannot be bundled
 */
function _getBundleRunnerType(file) {
  if (file.includes(".su.sh.js")) return null;
  if (file.includes(".su.sh")) return null;
  if (file.includes(".sh.js")) return null; // TODO: bundle .sh.js files (IIFE-wrap, single node | bash) in a future pass
  if (file.includes(".su.js")) return "su.js";
  if (file.includes(".js")) return "js";
  if (file.includes(".sh")) return "sh";
  return null;
}

/**
 * Resolves a script file path against the repo file list, handling fuzzy matching and dedup.
 * Extracts the file-validation logic so both
 * single-file and bundled processing can reuse it.
 * @param {string} file - The script file path (after prefix expansion)
 * @param {string} originalFile - The original file name before prefix expansion
 * @param {string[]} allRepoFiles - List of all file paths in the repository (mutated: matched entries are removed)
 * @returns {{ resolvedFile: string, fileExists: boolean, description: string, fileMatchState: string|undefined }}
 */
function _resolveScriptFile(file, originalFile, allRepoFiles) {
  const inputBase = path.basename(file);
  const inputFolder = path.dirname(file);

  // Tier 1: exact path match (paths are unique, so .find is safe)
  let foundMatchedPath = allRepoFiles.find((f) => f === file);

  // Tier 2: exact basename match sans extension — e.g. "git" matches "git.js"
  if (!foundMatchedPath) {
    foundMatchedPath = allRepoFiles.find(
      (f) => path.basename(f, path.extname(f)).toLowerCase() === inputBase.toLowerCase() && f.startsWith(inputFolder),
    );
  }

  // Tier 3: partial regex match on basename — e.g. "vim" matches "vim-config.js".
  // Collect ALL matches: 1 → use it, 2+ → ambiguous (return a copy-pasteable suggestion list).
  if (!foundMatchedPath) {
    const partial = allRepoFiles.filter((f) => new RegExp(inputBase, "i").test(path.basename(f)) && f.startsWith(inputFolder));
    if (partial.length === 1) {
      foundMatchedPath = partial[0];
    } else if (partial.length > 1) {
      const suggestions = partial.map((p) => `  bash run.sh --files=${p.replace(/^software\/scripts\//, "")}`).join("\n");
      return {
        resolvedFile: file,
        fileExists: false,
        description: `Ambiguous "${originalFile}" — matched ${partial.length}: ${partial.join(", ")}. Pick one and re-run:\n${suggestions}`,
        fileMatchState: "ambiguous",
      };
    }
  }

  const fileExists = !!foundMatchedPath;
  let description = "";
  let fileMatchState;
  if (fileExists) {
    if (file !== foundMatchedPath) {
      description = `Expanded ${originalFile} to ${foundMatchedPath}`;
      fileMatchState = "expanded_match";
    }
    // purge matched file from the list to prevent duplicate matches
    const idx = allRepoFiles.indexOf(foundMatchedPath);
    if (idx !== -1) allRepoFiles.splice(idx, 1);
  } else {
    description = `File not found: ${file}`;
    fileMatchState = "not_found";
  }

  return { resolvedFile: fileExists ? foundMatchedPath : file, fileExists, description, fileMatchState };
}

/**
 * Reads a script file's content via readText with caching. Results are cached to avoid
 * re-fetching (e.g. index.js is read once and reused for every .js script).
 * @param {string} file - The repo-relative file path (e.g. "software/index.js")
 * @returns {Promise<string>} The file content
 */
async function _readScriptContent(file) {
  if (_scriptContentCache.has(file)) return _scriptContentCache.get(file);
  const content = await readText`${file}`;
  _scriptContentCache.set(file, content);
  return content;
}

/**
 * Logs a consistent per-script progress line for _runScripts.
 * @param {string} file - The script file path
 * @param {number} index - Zero-based index of the script
 * @param {number} total - Total number of script files
 * @param {string} [bundleLabel] - Optional bundle label to display after the percentage
 */
function _logRunScript(file, index, total, bundleLabel) {
  const label = bundleLabel ? ` [${bundleLabel}]` : "";
  echo(`# _runScripts | ${file} (${calculatePercentage(index + 1, total)}%)${label}`);
}

/**
 * Emits bundled JS script entries as _registerBundledScript() calls.
 * Includes index.js once, wraps each script in a scoped callback, and closes the heredoc.
 * Shared by _emitBundledJsScripts and _emitBundledSuJsScripts.
 * @param {{ resolvedFile: string, isRefreshTarget: boolean, index: number }[]} validEntries - Validated bundle entries
 * @param {number} totalFiles - Total number of script files (for percentage display)
 * @param {string} heredocDelimiter - The heredoc delimiter string
 * @param {string} [bundleLabel] - Optional bundle label for logging
 * @returns {Promise<void>}
 */
async function _emitBundledJsEntries(validEntries, totalFiles, heredocDelimiter, bundleLabel) {
  emitBash(await _readScriptContent("software/index.js"));

  for (let i = 0; i < validEntries.length; i++) {
    const e = validEntries[i];
    const scriptContent = await _readScriptContent(e.resolvedFile);
    const pct = calculatePercentage(e.index + 1, totalFiles);
    emitBash(
      `
      // --- ${e.resolvedFile} ---
      _registerBundledScript(${JSON.stringify(e.resolvedFile)}, ${e.isRefreshTarget}, ${JSON.stringify(pct)}, ${JSON.stringify(bundleLabel || "")}, () => {
        var doWork, undoWork;
        ${scriptContent}
        return { doWork, undoWork };
      });
    `.trim(),
    );
  }

  emitBash(heredocDelimiter);
}

/**
 * Emits a single `node` heredoc that bundles multiple consecutive `.js` scripts.
 * index.js is included once; each script is IIFE-wrapped to isolate scope. A master
 * `doWork`/`undoWork` runs them sequentially with per-script error handling and
 * IS_REFRESH_MODE management.
 * @param {{ file: string, originalFile: string, isRefreshTarget: boolean, index: number }[]} entries - Bundle entries
 * @param {string[]} allRepoFiles - List of all file paths in the repository (mutated)
 * @param {number} totalFiles - Total number of script files (for percentage display)
 * @returns {Promise<void>}
 */
async function _emitBundledJsScripts(entries, allRepoFiles, totalFiles) {
  const bundleLabel = entries.length > 1 ? `Bundle #${++_bundleIdCounter} JS Bundle (${entries.length} scripts)` : undefined;
  const validEntries = [];

  for (const entry of entries) {
    const resolved = entry.resolved;
    if (resolved.fileExists) {
      validEntries.push({ ...entry, file: resolved.resolvedFile, ...resolved });
    } else {
      echo(`>>`, colorOrange(entry.originalFile), colorRed(`does not exist`));
      scriptProcessingResults.push({
        file: entry.originalFile,
        path: resolved.resolvedFile,
        script: "",
        tempFileCommand: "",
        status: "error",
        fileMatchState: resolved.fileMatchState,
        description: resolved.description,
        bundleLabel,
      });
    }
  }

  if (validEntries.length === 0) return;

  // Use sudo runner when any entry in the bundle is a .su.js script (skip sudo in dry run)
  const hasSudo = !IS_DRY_RUN && validEntries.some((e) => e.file.includes(".su.js"));
  const heredocDelimiter = ["_BASHRC", "INLINE", "EOF_"].join("_");
  const nodeBin = process.execPath; // absolute path to the running node binary, works with sudo even when node isn't on root's PATH
  let runner = `${nodeBin}`;
  if (hasSudo) {
    runner = `sudo -E ${nodeBin}`;
    const suScripts = validEntries.filter((e) => e.file.includes(".su.js")).map((e) => e.file);
    log(`[sudo] _emitBundledJsScripts: sudo -E ${nodeBin} for ${suScripts.join(", ")}`);
  }
  const tempFileCommand = `${runner} <<'${heredocDelimiter}'`;
  emitBash(tempFileCommand);
  await _emitBundledJsEntries(validEntries, totalFiles, heredocDelimiter, bundleLabel);

  for (const e of validEntries) {
    scriptProcessingResults.push({
      file: e.originalFile,
      path: e.resolvedFile,
      script: `bundled (${validEntries.length} JS scripts)`,
      tempFileCommand,
      status: "success",
      fileMatchState: e.fileMatchState,
      description: e.description,
      bundleLabel,
    });
  }
}

/**
 * Emits per-script `bash` heredocs for consecutive `.sh` scripts.
 * Each script gets its own `bash <<'DELIM'` block so background tasks in one script
 * don't block the next — non-interactive bash exits immediately when foreground completes,
 * orphaning background jobs to PID 1 where they continue running.
 * Only called in inline mode; non-inline fallback is handled by _runScripts.
 * @param {{ file: string, originalFile: string, isRefreshTarget: boolean, index: number }[]} entries - Bundle entries
 * @param {string[]} allRepoFiles - List of all file paths in the repository (mutated)
 * @param {number} totalFiles - Total number of script files (for percentage display)
 * @returns {Promise<void>}
 */
async function _emitBundledShScripts(entries, allRepoFiles, totalFiles) {
  const bundleLabel = entries.length > 1 ? `Bundle #${++_bundleIdCounter} SH Bundle (${entries.length} scripts)` : undefined;

  // Dry run skips shell scripts entirely — only JS scripts run in dry-run mode
  if (IS_DRY_RUN) {
    for (const entry of entries) {
      _logRunScript(entry.file, entry.index, totalFiles, bundleLabel);
      echo(`>> [DryRun] Skipping shell script: ${entry.file}`);
      scriptProcessingResults.push({
        file: entry.originalFile,
        path: entry.file,
        script: "",
        tempFileCommand: "",
        status: "skipped",
        description: "[DryRun] Shell scripts are skipped in dry-run mode",
        bundleLabel,
      });
    }
    return;
  }

  const validEntries = [];

  for (const entry of entries) {
    const resolved = entry.resolved;
    if (resolved.fileExists) {
      validEntries.push({ ...entry, file: resolved.resolvedFile, ...resolved });
    } else {
      echo(`>>`, colorOrange(entry.originalFile), colorRed(`does not exist`));
      scriptProcessingResults.push({
        file: entry.originalFile,
        path: resolved.resolvedFile,
        script: "",
        tempFileCommand: "",
        status: "error",
        fileMatchState: resolved.fileMatchState,
        description: resolved.description,
        bundleLabel,
      });
    }
  }

  if (validEntries.length === 0) return;

  const heredocDelimiter = ["_BASHRC", "INLINE", "EOF_"].join("_");
  const tempFileCommand = `bash <<'${heredocDelimiter}'`;

  for (let i = 0; i < validEntries.length; i++) {
    const e = validEntries[i];
    const scriptContent = await _readScriptContent(e.resolvedFile);

    // each script gets its own bash process — background tasks are isolated per script
    emitBash(tempFileCommand);
    emitBash(`# --- ${e.resolvedFile} ---`);
    _logRunScript(e.resolvedFile, e.index, totalFiles, bundleLabel);
    emitBash(e.isRefreshTarget ? `export IS_REFRESH_MODE=1` : `unset IS_REFRESH_MODE`);
    emitBash(`_sh_bench_start=$(date +%s)`);
    emitBash(scriptContent);
    emitBash(`_sh_bench_dur_ms=$(( ($(date +%s) - _sh_bench_start) * 1000 ))`);
    emitBash(
      `_SH_BENCH_FILE=${JSON.stringify(e.resolvedFile)} _SH_BENCH_DUR="$_sh_bench_dur_ms" node -e "var f=require('fs'),p=process.env.BASHRC_TEMP_DIR+'/run_timing.json',d;try{d=JSON.parse(f.readFileSync(p,'utf8'))}catch(e){d={}}var s=d.scripts||{};s[process.env._SH_BENCH_FILE]={duration_ms:Number(process.env._SH_BENCH_DUR),status:'success'};d.scripts=s;f.writeFileSync(p,JSON.stringify(d))"`,
    );
    emitBash(heredocDelimiter);
  }

  for (const e of validEntries) {
    scriptProcessingResults.push({
      file: e.originalFile,
      path: e.resolvedFile,
      script: `bundled (${validEntries.length} SH scripts)`,
      tempFileCommand,
      status: "success",
      fileMatchState: e.fileMatchState,
      description: e.description,
      bundleLabel,
    });
  }
}

/**
 * Prints a formatted table of OS flags (is_os_*) to stdout via a generated node command.
 * Respects the SHOULD_PRINT_OS_FLAGS environment variable to suppress output.
 * @returns {void}
 */
function printOsFlags() {
  if (SHOULD_PRINT_OS_FLAGS) {
    printSectionBlock(`OS Flags`);
    Object.keys(process.env)
      .filter((envKey) => envKey.indexOf("is_os_") === 0)
      .forEach((envKey) => {
        const isEnabled = process.env[envKey] === "1";
        const label = envKey.padEnd(30, " ") + ":";
        echo(isEnabled ? `${label} Yes` : colorDim(`${label} No`));
      });
  }
}

/**
 * Prints a formatted list of script files that will be executed to stdout via a generated node command.
 * @param {string[]} scriptsToRun - Array of script file paths to display
 * @returns {void}
 */
function printScriptsToRun(scriptsToRun) {
  echo(`# Scripts to Run: ${scriptsToRun.length} files`);
  for (const script of scriptsToRun) {
    echo(`>>`, script);
  }
}

/**
 * Prints a formatted section block with a header and optional content lines to stdout via a generated node command.
 * @param {string} header - The section header text
 * @param {string[]} [lines=[]] - Optional array of content lines to display between the header and footer
 * @param {boolean} [addBlock=true] - Whether to wrap the section with equal-sign line breaks
 * @returns {void}
 */
function printSectionBlock(header, lines = [], addBlock = true) {
  if (addBlock) echo(colorYellow(LINE_BREAK_EQUAL));
  echo(`# ${header}`);
  for (const line of lines || []) {
    echo(`  ${line}`);
  }
  if (addBlock) echo(colorYellow(LINE_BREAK_EQUAL));
}

//////////////////////////////////////////////////////
// doWork: Unified script runner (test files or full run)
//////////////////////////////////////////////////////
/**
 * Shared runner for both test-specific and full-run modes.
 * Resolves script file paths, generates bash pipeline commands, and prints results.
 * @param {string[]} softwareFiles - Array of script file paths to execute
 * @param {string[]} allRepoFiles - Array of all repo file paths for matching
 * @param {string} label - Description label for logging
 * @returns {Promise<void>}
 */
async function _runScripts(softwareFiles, allRepoFiles, label) {
  printOsFlags();
  printScriptsToRun(softwareFiles);

  const total = softwareFiles.length;

  // Build entries with expanded paths, refresh targets, and bundle types.
  // filterRepoScripts() already groups scripts by bundle type (js → su.js → sh),
  // so consecutive grouping here naturally produces mega-bundles.
  // Scripts with ~ prefix (e.g. ~cleanup.js, ~wrapup.sh) are excluded from bundling —
  // they are slow or have special ordering requirements and must run individually.
  const entries = softwareFiles.map((originalFile, i) => {
    let file = originalFile;
    if (!file.startsWith("software/")) {
      file = `software/scripts/${file}`;
    }
    // Resolve partial matches early so bundle type detection works on the actual file path
    // (e.g. "git" → "software/scripts/git.js" before _getBundleRunnerType checks the extension)
    const resolved = _resolveScriptFile(file, originalFile, allRepoFiles);
    const resolvedFile = resolved.fileExists ? resolved.resolvedFile : file;
    const isRefreshTarget = REFRESH_FILES.size > 0 && _isRefreshTarget(originalFile);
    const isExcludedFromBundle = path.basename(resolvedFile).startsWith("~");
    const bundleType = isExcludedFromBundle ? null : _getBundleRunnerType(resolvedFile);
    return { file: resolvedFile, originalFile, isRefreshTarget, index: i, bundleType, resolved };
  });

  // Surface ambiguous matches up-front. Without this, an input like `--files=vim` would
  // route to the bundle dispatcher first, fail on missing extension, and the helpful
  // suggestion list buried in resolved.description would never reach the user.
  const ambiguous = entries.filter((e) => e.resolved.fileMatchState === "ambiguous");
  for (const entry of ambiguous) {
    echo(`>>`, colorOrange(entry.originalFile), colorRed(`is ambiguous`));
    log(entry.resolved.description);
    scriptProcessingResults.push({
      file: entry.originalFile,
      path: entry.file,
      script: "",
      tempFileCommand: "",
      status: "error",
      fileMatchState: entry.resolved.fileMatchState,
      description: entry.resolved.description,
      bundleLabel: undefined,
    });
  }

  // Group consecutive entries that share the same non-null bundleType.
  // Because filterRepoScripts() sorts by bundle type, this produces one group per type.
  // su.js entries are collected into a single group (not consecutive) to avoid multiple sudo prompts.
  const groups = [];
  let currentGroup = null;
  let suGroup = null;
  for (const entry of entries) {
    if (entry.bundleType === "su.js") {
      if (!suGroup) {
        suGroup = { type: "su.js", entries: [entry] };
        groups.push(suGroup);
      } else {
        suGroup.entries.push(entry);
      }
    } else if (entry.bundleType && currentGroup && currentGroup.type === entry.bundleType) {
      currentGroup.entries.push(entry);
    } else {
      currentGroup = { type: entry.bundleType, entries: [entry] };
      groups.push(currentGroup);
    }
  }

  /** @type {Record<string, (entries: typeof groups[0]["entries"], allRepoFiles: string[], total: number) => Promise<void>>} */
  const bundleEmitters = {
    js: _emitBundledJsScripts,
    "su.js": _emitBundledJsScripts,
    sh: _emitBundledShScripts,
  };

  for (const group of groups) {
    const emitter = bundleEmitters[group.type];
    if (emitter) {
      await emitter(group.entries, allRepoFiles, total);
    } else {
      // unbundleable (e.g. ~prefixed) — route through bundle emitters as bundles of 1
      for (const entry of group.entries) {
        const singleEmitter = bundleEmitters[_getBundleRunnerType(entry.file)];
        if (singleEmitter) {
          await singleEmitter([entry], allRepoFiles, total);
        } else {
          echo(`>> Skipping unsupported script type: ${entry.file}`);
        }
      }
    }
  }

  printScriptProcessingResults(scriptProcessingResults);
}

/**
 * Prints the script processing results with a section header.
 * Success entries are printed in green, error entries in red.
 * Cleans up temp scripts on success unless IS_DEBUG is on.
 * @param {typeof scriptProcessingResults} results - The scriptProcessingResults array
 * @returns {void}
 */
function printScriptProcessingResults(results) {
  // write results to timing file for post-run display and CI job summary
  if (BASHRC_TEMP_DIR) {
    try {
      const timingPath = path.join(BASHRC_TEMP_DIR, "run_timing.json");
      const existing = _readRunTiming();
      existing.results = results.map((r) => ({
        file: r.file,
        path: r.path,
        status: r.status,
        description: r.description || "",
        bundleLabel: r.bundleLabel || "",
        fileMatchState: r.fileMatchState || "",
        tempFileCommand: r.tempFileCommand || "",
      }));
      fs.writeFileSync(timingPath, JSON.stringify(existing));
    } catch (err) {
      log("> Warning: failed to write results to timing file: " + err);
    }
  }

  // emit a post-run bash command to print consolidated results with per-script timing
  if (BASHRC_TEMP_DIR) {
    const timingPath = path.join(BASHRC_TEMP_DIR, "run_timing.json").replace(/'/g, "'\\''");
    emitBash(`TIMING_FILE="${timingPath}" node <<'_BASHRC_PRINT_RESULTS_EOF'
const fs = require("fs");
const data = JSON.parse(fs.readFileSync(process.env.TIMING_FILE, "utf8"));
const results = data.results || [];
const scripts = data.scripts || {};
const start = data.start || "";
const merged = results.map(r => {
  const t = scripts[r.path] || {};
  return { ...r, status: t.status || r.status, duration_ms: t.duration_ms, error: t.error };
});
const successCount = merged.filter(r => r.status === "success").length;
const errorCount = merged.filter(r => r.status === "error").length;
const skippedCount = merged.filter(r => r.status === "skipped").length;
const log = (...a) => console.error(...a);
log("\\n\\n\\n");
log("#".repeat(80));
log("# Script Processing Results: " + merged.length + " files" + (start ? " (started " + start + ")" : ""));
log("## " + successCount + " Success / " + errorCount + " Failed" + (skippedCount > 0 ? " / " + skippedCount + " Skipped" : ""));
let curLabel = null;
for (const r of merged) {
  const label = r.bundleLabel || "";
  if (label !== curLabel) {
    curLabel = label;
    if (label) log("## " + label);
    else if (curLabel !== null) log("## Individual");
  }
  const dur = r.duration_ms != null ? " (" + r.duration_ms + "ms)" : "";
  if (r.status === "success") {
    log(!r.fileMatchState
      ? "  Success" + dur + " - " + r.file + "." + (r.description ? " " + r.description : "")
      : "  Success" + dur + " - " + r.file + " (" + r.path + ")." + (r.description ? " " + r.description : ""));
  } else if (r.status === "skipped") {
    log("  Skipped" + dur + " - " + r.file + "." + (r.error || r.description ? " " + (r.error || r.description) : ""));
  } else {
    log("  Error" + dur + " - " + r.file + " (" + r.path + "). " + (r.error || r.description || "") + "." + (r.tempFileCommand ? " " + r.tempFileCommand : ""));
  }
}
_BASHRC_PRINT_RESULTS_EOF`);
  } else {
    // fallback: print directly when BASHRC_TEMP_DIR is not available
    _printScriptProcessingResultsDirect(results);
  }
}

/**
 * Fallback printer for script processing results when BASHRC_TEMP_DIR is not available.
 * @param {typeof scriptProcessingResults} results - The scriptProcessingResults array
 */
function _printScriptProcessingResultsDirect(results) {
  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  echo(`\n\n\n`);
  echo(LINE_BREAK_HASH);
  echo(`# Script Processing Results: ${results.length} files`);
  echo(`## ${successCount} Success / ${errorCount} Failed`);

  let currentBundleLabel = null;
  for (const result of results) {
    const label = result.bundleLabel || "";
    if (label !== currentBundleLabel) {
      currentBundleLabel = label;
      if (label) {
        echo(`## ${label}`);
      } else if (currentBundleLabel !== null) {
        echo(`## Individual`);
      }
    }

    if (result.status === "success") {
      echo(
        !result.fileMatchState
          ? `  Success - ${result.file}.${result.description ? ` ${result.description}` : ""}`
          : `  Success - ${result.file} (${result.path}).${result.description ? ` ${result.description}` : ""}`,
      );
    } else {
      echo(`  Error - ${result.file} (${result.path}). ${result.description}.`, colorDim(`${result.tempFileCommand || ""}`));
    }
  }
}

/**
 * Reads the run timing JSON file from BASHRC_TEMP_DIR.
 * @returns {{ start?: string, end?: string, duration_seconds?: number, scripts?: Record<string, { duration_ms: number, status: string, error?: string }>, results?: { file: string, path: string, status: string, description: string, bundleLabel: string }[] }}
 */
function _readRunTiming() {
  if (!BASHRC_TEMP_DIR) return {};
  const timingPath = path.join(BASHRC_TEMP_DIR, "run_timing.json");
  try {
    return JSON.parse(fs.readFileSync(timingPath, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Merges per-script timing and status data into the run timing JSON file.
 * Reads existing content and adds a `scripts` object keyed by filename, preserving all other fields.
 * @param {{ file: string, duration_ms: number, status: string, error?: string }[]} timings - Per-script timing entries
 */
function _mergeScriptTimings(timings) {
  if (!BASHRC_TEMP_DIR || timings.length === 0) return;
  const timingPath = path.join(BASHRC_TEMP_DIR, "run_timing.json");
  try {
    const existing = _readRunTiming();
    const scripts = existing.scripts || {};
    for (const t of timings) {
      const entry = { duration_ms: t.duration_ms, status: t.status };
      if (t.error) entry.error = t.error;
      scripts[t.file] = entry;
    }
    existing.scripts = scripts;
    fs.writeFileSync(timingPath, JSON.stringify(existing));
  } catch (err) {
    log("> Warning: failed to write script timing: " + err);
  }
}

/**
 * Runs a subset of scripts specified by the TEST_SCRIPT_FILES environment variable.
 * @returns {Promise<void>}
 */
async function _doWorkTestFiles() {
  if (!TEST_SCRIPT_FILES) {
    echo(`>> Skipped`);
    return;
  }

  const allRepoFiles = await getAllRepoSoftwareFiles();
  const softwareFiles = TEST_SCRIPT_FILES.split(/[,;\s]/)
    .map((s) => s.trim())
    .filter((s) => !!s);

  // Auto-append ~refresh-source.standalone.js to refresh SOURCE blocks in the profile
  // (full runs handle this via ~cleanup.js, but --files runs need it explicitly)
  const refreshScript = "~refresh-source.standalone.js";
  if (!softwareFiles.some((f) => f.includes(refreshScript))) {
    softwareFiles.push(refreshScript);
  }

  echo(`> _doWorkTestFiles => ${softwareFiles.length} Files, and allRepoFiles=${allRepoFiles.length} `);
  await _runScripts(softwareFiles, allRepoFiles, "Test Files");
}

//////////////////////////////////////////////////////
// doWork: Full Run
//////////////////////////////////////////////////////
/**
 * Runs the full software setup: discovers platform-applicable script files and executes them.
 * _full-setup.sh files are included only when IS_SETUP is set (--setup flag).
 * @returns {Promise<void>}
 */
async function _doWorkFullRun() {
  const allRepoFiles = await getAllRepoSoftwareFiles();
  const softwareFiles = await getSoftwareScriptFiles();

  echo(`> _doWorkFullRun => software=${softwareFiles.length} allRepoFiles=${allRepoFiles.length} setup=${IS_SETUP} `);
  await _runScripts(softwareFiles, allRepoFiles, IS_SETUP ? "Full Setup" : "Full Run");
}

//////////////////////////////////////////////////////
// Bootstrap / Run Info
//////////////////////////////////////////////////////

/**
 * Prints the run configuration summary to stderr. Only prints when running as bootstrap (not in script mode).
 * @returns {void}
 */
function printRunInfo() {
  const activeOsFlags = Object.keys(process.env)
    .filter((k) => k.indexOf("is_os_") === 0 && process.env[k] === "1")
    .join(",");

  const lines = [
    `local_repo          = ${IS_LOCAL_REPO}`,
    `files               = ${_parsedArgs.files || "[full run]"}`,
    `force_refresh       = ${_parsedArgs.forceRefresh}`,
    `refresh_files       = ${_parsedArgs.refreshFiles || "[none]"}`,
    `debug               = ${_parsedArgs.debug}`,
    `dryrun              = ${_parsedArgs.dryrun}`,
    `remove              = ${_parsedArgs.remove}`,
    `presets             = ${_parsedArgs.presets.length ? _parsedArgs.presets.join(",") : "[none]"}`,
    `setup               = ${_parsedArgs.setup}`,
    `os_flags            = ${activeOsFlags || "[none]"}`,
  ];

  log(LINE_BREAK_HASH);
  log(
    `>> run.sh started at ${new Date()
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d+Z$/, "")}`,
  );
  for (const line of lines) {
    log(line);
  }

  // Detail each chosen preset (description + file list) so users see what's about to run.
  if (_parsedArgs.presets.length > 0) {
    const presetMap = loadPresets();
    log(LINE_BREAK_HASH);
    log(`>> Preset details (${_parsedArgs.presets.length}):`);
    for (const name of _parsedArgs.presets) {
      const preset = presetMap[name] || {};
      const description = preset.description || "[no description]";
      const presetFiles = Array.isArray(preset.files) ? preset.files : [];
      log(`  - ${name}`);
      log(`      description : ${description}`);
      log(`      files (${presetFiles.length}) : ${presetFiles.length ? presetFiles.join(", ") : "[none]"}`);
    }
  }

  log(LINE_BREAK_HASH);
}

//////////////////////////////////////////////////////
// Bootstrap / Main Entry Point
//////////////////////////////////////////////////////
/**
 * Main bootstrap entry point. Validates required environment variables,
 * fetches host configuration, creates necessary directories, sets up
 * global error handlers, and dispatches to the appropriate work mode
 * (test files or full run).
 */
(async function () {
  const missingEnvVars = [
    ["BASH_PROFILE_CODE_REPO_RAW_URL", BASH_PROFILE_CODE_REPO_RAW_URL],
    ["BASH_SYLE_COMMON_PATH", BASH_SYLE_COMMON_PATH],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missingEnvVars.length > 0) {
    echo(`Missing required environment variables error: ${missingEnvVars.join(", ")}`);
    process.exit(1);
  }

  // getting the ip address mapping
  try {
    const hostnamesData = await readJson`.build/ip-address.config.hostnamesFlattened`;
    HOME_HOST_NAMES = Array.isArray(hostnamesData) ? hostnamesData : [];
  } catch (err) {
    HOME_HOST_NAMES = [];
  }

  // print run configuration (only in bootstrap mode, not script mode)
  // Must be after first await so _registerBundledScript calls from bundled heredocs have executed
  if (typeof doWork !== "function" && _bundled_scripts.length === 0) {
    printRunInfo();
  }

  // create the sy tweak folder
  const pathsToCreateDir = [];
  if (is_os_mac) pathsToCreateDir.push(await getCustomTweaksPath("mac"));
  if (is_os_windows) pathsToCreateDir.push(await getCustomTweaksPath("windows"));
  for (const aPath of pathsToCreateDir) {
    try {
      await mkdir(aPath);
    } catch (err) {}
  }

  // for debugging
  process
    .on("unhandledRejection", (reason, p) => {
      echo(`[Error] unhandledRejection ${reason} Unhandled Rejection at Promise ${p}`);
      process.exit(1);
    })
    .on("uncaughtException", (err) => {
      echo(`[Error] uncaughtException ${err} Uncaught Exception thrown`);
      process.exit(1);
    })
    .on("exit", () => {
      // safety net — log if any unflushed blocks remain (should not happen, finally block handles it)
      if (_profileBlockBuffer.size > 0) {
        console.error(`[bashrc] WARNING: ${_profileBlockBuffer.size} unflushed profile block(s) at exit`);
      }
    });

  // start script
  try {
    if (_bundled_scripts.length > 0) {
      // bundle mode: multiple scripts bundled into one process via _bundled_scripts array
      /** @type {{ file: string, duration_ms: number, status: string, error?: string }[]} */
      const _bundledTimings = [];
      for (const s of _bundled_scripts) {
        const _scriptStartMs = Date.now();
        let _scriptStatus = "success";
        let _scriptError = "";
        try {
          if (s.isRefresh) process.env.IS_REFRESH_MODE = "1";
          else delete process.env.IS_REFRESH_MODE;
          if (IS_REMOVE_MODE) {
            if (s.fn.undoWork) await s.fn.undoWork();
            else log("> No undoWork() defined for " + s.file + " — nothing to remove");
          } else {
            log("# _runScripts | " + s.file + " (" + s.pct + "%)" + (s.bundleLabel ? " [" + s.bundleLabel + "]" : ""));
            if (s.fn.doWork) await s.fn.doWork();
          }
        } catch (err) {
          if (err instanceof ScriptSkipError) {
            _scriptStatus = "skipped";
            _scriptError = err.message;
            log(">>> " + err.message);
          } else {
            _scriptStatus = "error";
            _scriptError = String(err);
            log("> Error in " + s.file + ": " + err);
          }
        }
        _bundledTimings.push({
          file: s.file,
          duration_ms: Date.now() - _scriptStartMs,
          status: _scriptStatus,
          error: _scriptError || undefined,
        });
      }
      _mergeScriptTimings(_bundledTimings);
    } else if (typeof doWork === "function") {
      // script mode: doWork/undoWork defined by a concatenated script file
      if (IS_REMOVE_MODE) {
        if (typeof undoWork === "function") {
          await undoWork();
        } else {
          echo(`> No undoWork() defined — nothing to remove`);
        }
      } else {
        await doWork();
      }
    } else if (TEST_SCRIPT_FILES) {
      await _doWorkTestFiles();
    } else {
      await _doWorkFullRun();
    }
  } catch (err) {
    if (err instanceof ScriptSkipError) {
      log(`>>> ${err.message}`);
    } else {
      echo(`> Error ${err}`);
    }
  } finally {
    await flushProfileBlocks();
    await backupProfileSnapshot("bash_syle.4-after-flush");
  }
})();

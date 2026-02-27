const parseString = (v) => (v || "").trim();
const parseInteger = (v, defaultValue) => parseInt(parseString(v)) || defaultValue;
const parseBoolean = (v) => parseString(v).toLowerCase() === "true" || parseInteger(v, 0) === 1;

//////////////////////////////////////////////////////
// Global Imports & Path Constants
//////////////////////////////////////////////////////
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const BASE_HOMEDIR_LINUX = require("os").homedir();

const BASH_SYLE_PATH = parseString(process.env.BASH_SYLE_PATH);
const BASH_SYLE_AUTOCOMPLETE_PATH = parseString(process.env.BASH_SYLE_AUTOCOMPLETE_PATH);
const BASH_SYLE_COMMON_PATH = parseString(process.env.BASH_SYLE_COMMON_PATH);

// specific for windows and wsl only
const BASE_C_DIR_WINDOW = "/mnt/c";
const BASE_D_DIR_WINDOW = "/mnt/d";

// default node installation (fnm) - values exported from run.sh
const NODE_JS_VERSION = parseString(process.env.NODE_JS_VERSION);
const FNM_DIR = parseString(process.env.FNM_DIR);
const FNM_DEFAULT_NODE_PATH = parseString(process.env.FNM_DEFAULT_NODE_PATH);
const BASH_PROFILE_CODE_REPO_RAW_URL = parseString(process.env.BASH_PROFILE_CODE_REPO_RAW_URL);
const BASH_SYLE_COMMON = parseString(process.env.BASH_SYLE_COMMON);
const REPO_PATH_IDENTIFIER = parseString(process.env.REPO_PATH_IDENTIFIER);
const REPO_BRANCH_NAME = parseString(process.env.REPO_BRANCH_NAME);
const DEBUG_WRITE_TO_DIR = parseString(process.env.DEBUG_WRITE_TO_DIR).toLowerCase();
const HAS_SUDO_ACCESS = parseBoolean(process.env.HAS_SUDO_ACCESS);
const IS_FORCE_REFRESH = parseBoolean(process.env.IS_FORCE_REFRESH);
const IS_TEST_SCRIPT_MODE = parseBoolean(process.env.IS_TEST_SCRIPT_MODE);
const IS_LIGHT_WEIGHT_MODE = parseBoolean(process.env.IS_LIGHT_WEIGHT_MODE);
const REPO_PREFIX_URL = `https://raw.githubusercontent.com/${REPO_PATH_IDENTIFIER}/${REPO_BRANCH_NAME}/`;
const LINE_BREAK_COUNT = parseInt(process.env.LINE_BREAK_COUNT, 100); // console line break

/**
 * Tracks the processing status of each script file during execution.
 * Each entry records whether a script was found and processed successfully or encountered an error.
 * @type {Array<{file: string, path: string, script: string, status: 'success'|'error', description: string}>}
 * @property {string} file - The original file name before prefix expansion
 * @property {string} path - The resolved file path after prefix expansion
 * @property {string} script - The generated bash command used to fetch/execute the script
 * @property {string} status - 'success' if the script was found, 'error' if not found
 * @property {string} description - Error detail message, empty string on success
 */
const scriptProcessingResults = [];

//////////////////////////////////////////////////////
// Editor Configuration
//////////////////////////////////////////////////////
// fontSize, fontFamily, and tabSize can be overridden via environment variables:
// export FONT_SIZE=15;
// export FONT_FAMILY='Fira Code'
// export TAB_SIZE=2
let fontSize = parseInt(process.env.FONT_SIZE);
if (!fontSize || fontSize <= 10) {
  fontSize = 10;
}

const fontFamily = process.env.FONT_FAMILY || "Fira Code";

let tabSize = parseInt(process.env.TAB_SIZE);
if (!tabSize || tabSize <= 2) {
  tabSize = 2;
}

/**
 * Editor configuration object containing font settings, tab size, max line length,
 * and ignore lists for files, folders, and binaries.
 * @type {Object}
 * @property {number} fontSize - Editor font size (min 10, default 10). Override with FONT_SIZE env var
 * @property {string} fontFamily - Editor font family (default 'Fira Code'). Override with FONT_FAMILY env var
 * @property {number} tabSize - Editor tab/indentation size (min 2, default 2). Override with TAB_SIZE env var
 * @property {number} maxLineSize - Print/ruler column width in the editor (default 140)
 * @property {string[]} junkFiles - File patterns to delete during cleanup (macOS metadata, OS artifacts, patch rejects)
 * @property {string[]} junkDirs - Directory names to delete during cleanup (macOS/OS artifact directories)
 * @property {string[]} ignoredFiles - Glob patterns for files hidden from the editor (e.g. '*.exe', '.DS_Store')
 * @property {string[]} ignoredFolders - Directory names excluded from the editor file tree (e.g. 'node_modules', '.git')
 * @property {string[]} ignoredBinaries - Glob patterns for binary files visible in tree but excluded from search for performance
 */
const EDITOR_CONFIGS = {
  fontSize,
  fontFamily,
  fontSizeDefaultFallback: 14,
  fontFamilyDefaultFallback: "Courier New",
  tabSize,
  /** Print/ruler column width in the editor @type {number} */
  maxLineSize: 140,
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
  /** List of file glob patterns to be ignored by the editor @type {string[]} */
  ignoredFiles: [
    "._*",
    ".AppleDouble",
    ".DS_Store",
    ".eslintcache",
    ".LSOverride",
    ".Spotlight-*",
    ".Trashes",
    "*.class",
    "*.code-search",
    "*.db",
    "*.dll",
    "*.doc",
    "*.docx",
    "*.dylib",
    "*.egg-info",
    "*.egg",
    "*.exe",
    "*.idb",
    "*.Identifier",
    "*.ini",
    "*.jar",
    "*.js.map",
    "*.lib",
    "*.min.js",
    "*.mp3",
    "*.ncb",
    "*.o",
    "*.obj",
    "*.ogg",
    "*.orig",
    "*.pdb",
    "*.pid.lock",
    "*.pid",
    "*.psd",
    "*.py[cod]",
    "*.pyc",
    "*.pyo",
    "*.rej",
    "*.sdf",
    "*.seed",
    "*.sln",
    "*.so",
    "*.Spotlight-*",
    "*.sqlite",
    "*.sublime-workspace",
    "*.suo",
    "*.swf",
    "*.swp",
    "*.Trashes",
    "*.zip",
    "Desktop.ini",
    "ehthumbs.db",
    "package-lock.json",
    "Thumbs.db",
    "yarn.lock",
  ],
  /** List of folder names to be ignored by the editor @type {string[]} */
  ignoredFolders: [
    ".cache",
    ".ebextensions",
    ".generated",
    ".git",
    ".gradle",
    ".hg",
    ".idea",
    ".mypy_cache",
    ".pytest_cache",
    ".sass-cache",
    ".svn",
    ".venv",
    "__pycache*",
    "__pycache__",
    "bower_components",
    "build",
    "coverage",
    "CVS",
    "dist",
    "env",
    "node_modules",
    "tmp",
    "venv",
    "webpack-dist",
  ],
  /** List of binary file glob patterns visible in tree but excluded from search for performance @type {string[]} */
  ignoredBinaries: [
    ".git/*",
    ".venv/*",
    "*.dds",
    "*.eot",
    "*.exe",
    "*.gif",
    "*.ico",
    "*.jar",
    "*.jpeg",
    "*.jpg",
    "*.log",
    "*.pdf",
    "*.png",
    "*.pyc",
    "*.swf",
    "*.tga",
    "*.ttf",
    "*.woff",
    "*.woff2",
    "*.zip",
    "build/*",
    "dist/*",
    "node_modules/*",
  ],
};

//////////////////////////////////////////////////////
// Host Config & OS Flags
//////////////////////////////////////////////////////
/**
 * The host config is located here:
 * host name => host ip
 * @type {Array}
 */
let HOME_HOST_NAMES = [];

// os flags - read from environment and also set on global for script file access
Object.keys(process.env)
  .filter((envKey) => envKey.indexOf("is_os_") === 0)
  .forEach((envKey) => (global[envKey] = parseInt(process.env[envKey] || "0") > 0));
/** @type {boolean} */
const is_os_window = !!global.is_os_window;
/** @type {boolean} */
const is_os_darwin_mac = !!global.is_os_darwin_mac;
/** @type {boolean} */
const is_os_arch_linux = !!global.is_os_arch_linux;
/** @type {boolean} */
const is_os_android_termux = !!global.is_os_android_termux;
/** @type {boolean} */
const is_os_chromeos = !!global.is_os_chromeos;

// setting up the path for the extra tweaks
const BASE_SY_CUSTOM_TWEAKS_DIR = path.join(is_os_window ? getWindowUserBaseDir() : BASE_HOMEDIR_LINUX, "_extra");

// line break and comment break
const LINE_BREAK_HASH = "".padStart(LINE_BREAK_COUNT, "#");
const LINE_BREAK_SLASH = "".padStart(LINE_BREAK_COUNT, "/");
const LINE_BREAK_EQUAL = "".padStart(LINE_BREAK_COUNT, "=");
const COMMENT_BREAK = `### ${LINE_BREAK_EQUAL} ###`;

//////////////////////////////////////////////////////
// Directory Search Utilities
//////////////////////////////////////////////////////
/**
 * Resolves a file path, redirecting to DEBUG_WRITE_TO_DIR if set.
 * When DEBUG_WRITE_TO_DIR is configured, the path is flattened into a sanitized filename
 * placed inside that directory. Otherwise, returns the original path.
 * @param {string} filePath - The original file path
 * @returns {string} The resolved file path to use for I/O
 */
function _getFilePath(filePath) {
  let pathToUse = filePath;
  if (DEBUG_WRITE_TO_DIR.length > 0) {
    const fileName = filePath
      .replace(/[\/\\\(\)]/g, "_")
      .replace(/ /g, "_")
      .replace(/_\./g, ".")
      .replace(/__+/g, "_");

    pathToUse = path.join(DEBUG_WRITE_TO_DIR, fileName);
  }

  return pathToUse;
}

/**
 * Searches a directory for subdirectories matching a regex pattern.
 * @param {string} srcDir - The directory to search in
 * @param {RegExp} targetMatch - Regex pattern to match directory names against
 * @param {boolean} [returnFirstMatch=false] - If true, returns only the first matching path (or null)
 * @returns {string[]|string|null} Array of matching directory paths, or the first match (or null) if returnFirstMatch is true
 */
function findDirList(srcDir, targetMatch, returnFirstMatch) {
  try {
    const dirFiles = fs
      .readdirSync(srcDir, {
        withFileTypes: true,
      })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .filter((d) => d.match(targetMatch))
      .map((d) => path.join(srcDir, d));

    if (returnFirstMatch) {
      return dirFiles[0];
    }

    return dirFiles;
  } catch (err) {
    if (returnFirstMatch) {
      return null;
    }
    return [];
  }
}

/**
 * Searches a directory and returns the first subdirectory matching a regex pattern.
 * @param {string} srcDir - The directory to search in
 * @param {RegExp} targetMatch - Regex pattern to match directory names against
 * @returns {string|null} The first matching directory path, or null if none found
 */
function findDirSingle(srcDir, targetMatch) {
  return findDirList(srcDir, targetMatch, true);
}

/**
 * Recursively searches a directory for the first file matching a regex pattern.
 * Unlike findDirSingle which only matches directories at one level, this searches
 * all files and subdirectories recursively.
 * @param {string} srcDir - The directory to start searching from
 * @param {RegExp} targetMatch - Regex pattern to match file names against
 * @returns {string|null} The full path of the first matching file, or null if none found
 */
function findFileRecursive(srcDir, targetMatch) {
  try {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(srcDir, entry.name);
      if (entry.isFile() && entry.name.match(targetMatch)) {
        return fullPath;
      }
      if (entry.isDirectory()) {
        const found = findFileRecursive(fullPath, targetMatch);
        if (found) {
          return found;
        }
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Iterates a list of [directory, regex] pairs and returns the first matching subdirectory path.
 * @param {Array<[string, RegExp]>} findProps - Array of [srcDir, targetMatch] tuples to search
 * @returns {string|undefined} The first matching directory path, or undefined if none found
 */
function findFirstDirFromList(findProps) {
  for (const findProp of findProps) {
    const [src, match] = findProp;
    const matchedDir = findDirSingle(src, match);
    if (matchedDir) {
      return matchedDir;
    }
  }

  return undefined;
}

//////////////////////////////////////////////////////
// File I/O Utilities
//////////////////////////////////////////////////////
/**
 * Writes text content to a file. Skips writing if the content hasn't changed or if override is false.
 * Before comparing, strips everything up to and including the COMMENT_BREAK marker line from both
 * old and new content, so timestamp-only header changes don't trigger unnecessary writes.
 * @param {string} filePath - The file path to write to
 * @param {string} text - The text content to write
 * @param {boolean} [override=true] - Whether to overwrite existing content. If false, skips writing when file exists
 * @param {boolean} [suppressError=false] - Whether to suppress the "skipped" log message
 * @returns {void}
 */
function writeText(filePath, text, override = true, suppressError = false) {
  const pathToUse = _getFilePath(filePath);
  const newContent = (text || "").trim();
  const oldContent = readText(pathToUse).trim();

  // strip everything before and including the COMMENT_BREAK line so timestamp-only changes don't trigger a write
  const commentBreakIdx_old = oldContent.indexOf(COMMENT_BREAK);
  const commentBreakIdx_new = newContent.indexOf(COMMENT_BREAK);
  const oldContentStripped = (
    commentBreakIdx_old >= 0 ? oldContent.substring(oldContent.indexOf("\n", commentBreakIdx_old) + 1) : oldContent
  ).trim();
  const newContentStripped = (
    commentBreakIdx_new >= 0 ? newContent.substring(newContent.indexOf("\n", commentBreakIdx_new) + 1) : newContent
  ).trim();

  if (oldContentStripped === newContentStripped || override !== true) {
    // if content don't change, then don't save
    // if override is set to false, then don't override
    if (suppressError !== true) {
      console.log(
        consoleLogColor3(`      << Skipped [NotModified] oldContent=${oldContent.length} newContent=${newContent.length}`),
        consoleLogColor4(pathToUse),
      );
    }
  } else {
    console.log(consoleLogColor3(`      << Updated [Modified] newContent=${newContent.length}`), consoleLogColor4(pathToUse));
    fs.writeFileSync(pathToUse, newContent);
  }
}

/**
 * Creates a file if it doesn't already exist. If the file exists, it is left unchanged.
 * @param {string} filePath - The file path to create
 * @param {string} [defaultContent=''] - The default content to write if the file is created
 * @returns {void}
 */
function touchFile(filePath, defaultContent = "") {
  const pathToUse = path.resolve(filePath);
  if (filePathExist(pathToUse)) {
    console.log(consoleLogColor3("      << Skipped [NotModified]"), consoleLogColor4(pathToUse));
  } else {
    console.log(consoleLogColor3("      >> File Created"), consoleLogColor4(pathToUse));
    fs.writeFileSync(pathToUse, defaultContent);
  }
}

/**
 * Writes text to a file, creating a timestamped backup of the old content if it differs.
 * @param {string} filePath - The file path to write to and back up
 * @param {string} text - The new text content to write
 * @returns {void}
 */
function backupText(filePath, text) {
  const pathToUse = filePath;
  const oldText = readText(pathToUse);
  if (oldText !== text) {
    // back up the old content before overwriting
    const backupPathToUse = pathToUse + "." + Date.now();
    writeText(backupPathToUse, oldText);
    writeText(pathToUse, text);
    console.log(consoleLogColor3("      << Backup Created"), consoleLogColor4(backupPathToUse));
  } else {
    console.log(consoleLogColor3("      << Backup Skipped [NotModified]"), consoleLogColor4(pathToUse));
  }
}

/**
 * Writes a JSON object to a file, optionally prepending comments.
 * @param {string} filePath - The file path to write to
 * @param {object} json - The JSON object to serialize and write
 * @param {string} [comments=''] - Optional comment text to prepend before the JSON content
 * @returns {void}
 */
function writeJson(filePath, json, comments = "") {
  let content = comments + "\n" + JSON.stringify(json, null, 2);
  writeText(filePath, content.trim());
}

/**
 * Generates an auto-generated timestamp header string with time rounded down to the nearest 10 minutes.
 * Used to mark files as auto-generated with a human-readable timestamp.
 * @returns {string} A warning string indicating the file is auto-generated, with a rounded timestamp
 */
function getAutoGeneratedText() {
  const now = new Date();

  // Date formatting
  const yyyy = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  // 12-hour clock and AM/PM
  let hours = now.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12; // Converts 0 to 12
  const hh = String(hours).padStart(2, "0");

  const minutes = now.getMinutes();
  const roundedMinutes = Math.floor(minutes / 20) * 20;
  const mm = String(roundedMinutes).padStart(2, "0");

  // const timehere = `${yyyy}-${mm}-${dd} ${hh}:${roundedMinutes} ${ampm}`;
  const timehere = `${yyyy}-${MM}-${dd}-${hh}-${mm}${ampm}`;

  return `NOTE: STOP - do not edit by hand - this file is auto-generated [${timehere}]\n`;
}

/**
 * Writes one or more build output files to DEBUG_WRITE_TO_DIR, then exits the process.
 * Each task produces a file with an optional auto-generated comment header (prefixed per commentStyle)
 * terminated by a COMMENT_BREAK marker line. writeText uses this marker to strip the header
 * before diffing, so timestamp-only changes don't trigger unnecessary writes.
 * No-ops silently when DEBUG_WRITE_TO_DIR is not set.
 * @param {Array<{file: string, data: any, isJson?: boolean, comments?: string, commentStyle?: 'json'|'gitconfig'|'bash'}>
 *   | {file: string, data: any, isJson?: boolean, comments?: string, commentStyle?: 'json'|'gitconfig'|'bash'}} tasks - A single task or array of tasks to write
 * @param {string} tasks[].file - The output file path
 * @param {any} tasks[].data - The content to write (object for JSON, string for text)
 * @param {boolean} [tasks[].isJson=false] - If true, data is serialized as JSON
 * @param {string} [tasks[].comments=''] - Optional comment text prepended as a header block
 * @param {string} [tasks[].commentStyle] - Comment prefix style: 'json' (//), 'bash'/'gitconfig' (#). When set, an auto-generated timestamp and COMMENT_BREAK marker are included
 * @returns {void}
 */
function writeToBuildFile(tasks) {
  tasks = [].concat(tasks);

  if (DEBUG_WRITE_TO_DIR) {
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
          // added marker to help with trakcing and remove lalter

          comments += `\n${commentPrefix}${COMMENT_BREAK}`;
        }

        comments += "\n\n";
      }

      if (isJson) {
        console.log(consoleLogColor1("    >> DEBUG Mode: write JSON to file"), consoleLogColor4(file));
        writeJson(file, data, comments);
      } else {
        console.log(consoleLogColor1("    >> DEBUG Mode: write TEXT to file"), consoleLogColor4(file));
        data = (data || "").trim();
        writeText(file, (comments + data).trim());
      }
    }
    return process.exit();
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
function writeConfigToFile(basePath, fileName, data, isJson = true) {
  const fileDestPath = path.join(basePath, fileName);
  console.log("      >> File Path", fileDestPath);
  if (isJson) {
    writeJson(fileDestPath, data);
  } else {
    writeText(fileDestPath, data);
  }
}

/**
 * Appends text to the end of an existing file's content.
 * @param {string} filePath - The file path to append to
 * @param {string} text - The text to append
 * @returns {void}
 */
function appendText(filePath, text) {
  const oldText = readText(filePath);
  writeText(filePath, oldText + "\n" + text);
}

/**
 * Reads a file and applies regex replacements line by line. Creates a .bak backup of the original.
 * @param {string} filePath - The file path to read and modify
 * @param {Array<[RegExp, string]>} replacements - Array of [matchRegex, replaceWith] pairs to apply to each line
 * @param {boolean} [makeAdditionalBackup=false] - If true, also creates a timestamped backup
 * @returns {void}
 */
function replaceTextLineByLine(filePath, replacements, makeAdditionalBackup = false) {
  const oldText = readText(filePath);

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
  writeText(`${filePath}.bak`, oldText, false);

  if (makeAdditionalBackup === true) {
    writeText(`${filePath}.bak.${Date.now()}`, oldText);
  }

  // save with newText
  writeText(filePath, newText);
}

/**
 * Reads an existing JSON file, shallow-merges new properties into it, and writes it back.
 * If the file doesn't exist or is invalid, starts with an empty object.
 * @param {string} filePath - The JSON file path to read and write
 * @param {object} json - The JSON object whose properties will be merged into the existing file
 * @returns {void}
 */
function writeJsonWithMerge(filePath, json) {
  let oldJson = {};
  try {
    oldJson = readJson(filePath);
  } catch (e) {}
  writeJson(filePath, Object.assign(oldJson, json));
}

/**
 * Reads and parses a JSON file, supporting comments in the JSON content.
 * @param {string} filePath - The JSON file path to read
 * @returns {object} The parsed JSON object
 */
function readJson(filePath) {
  return parseJsonWithComments(fs.readFileSync(filePath, { encoding: "utf8", flag: "r" }));
}

/**
 * Reads the contents of a text file, returning an empty string if the file doesn't exist or can't be read.
 * @param {string} filePath - The file path to read
 * @returns {string} The trimmed file contents, or an empty string on error
 */
function readText(filePath) {
  try {
    return fs.readFileSync(filePath, { encoding: "utf8", flag: "r" }).trim();
  } catch (err) {
    return "";
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
    process.exit();
  }
  return eval(`var ___temp = ${oldText}; ___temp;`);
}

/**
 * Creates a deep clone of an object via JSON serialization/deserialization.
 * @param {object} obj - The object to clone
 * @returns {object} A deep copy of the input object
 */
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

//////////////////////////////////////////////////////
// Platform-Specific Path Utilities
//////////////////////////////////////////////////////
/**
 * Detects and returns the Windows user home directory under WSL.
 * @returns {string|undefined} The Windows user home directory path, or undefined if not found
 */
function getWindowUserBaseDir() {
  const regexUsername = /(leng)|(sy[ ]*le)/i;
  const basePaths = [[path.join(BASE_C_DIR_WINDOW, "Users"), regexUsername]];
  for (const [basePath, regex] of basePaths) {
    const res = findDirSingle(basePath, regex);
    if (res) return res;
  }
  return undefined;
}

/**
 * Checks whether a file or directory exists at the given path.
 * @param {string} targetPath - The path to check
 * @returns {boolean} True if the path exists, false otherwise
 */
function filePathExist(targetPath) {
  return fs.existsSync(targetPath);
}

/**
 * Resolves the Windows application binary directory under WSL (prefers D: drive, falls back to C: or _extra).
 * If applicationName is provided, creates a subdirectory for it.
 * @param {string} [applicationName] - Optional application name to create a subdirectory for
 * @returns {Promise<string>} The resolved directory path for storing application binaries
 */
async function getWindowsApplicationBinaryDir(applicationName) {
  let targetPath = findDirSingle("/mnt", /[d]/) || findDirSingle("/mnt", /[c]/);

  if (filePathExist(targetPath)) {
    // push this binary into d drive
    targetPath = path.join(targetPath, "Applications");
  } else {
    // else use the extra folder
    targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, "windows");
  }

  if (applicationName) {
    targetPath = path.join(targetPath, applicationName);
    await mkdir(targetPath);
  }

  return targetPath;
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
 * Returns the macOS Application Support directory path for the current user.
 * @returns {string} The path to ~/Library/Application Support
 */
function getOsxApplicationSupportCodeUserPath() {
  return path.join(process.env.HOME, "Library/Application Support");
}

//////////////////////////////////////////////////////
// Text Processing Utilities
//////////////////////////////////////////////////////
/**
 * Inserts or replaces a delimited text block within a larger text body.
 * The block is bounded by "{commentPrefix} {configKey}" and "{commentPrefix} END {configKey}" markers.
 * If the block already exists, it is replaced. Otherwise, it is appended or prepended.
 * @param {string} resultTextContent - The full text content to modify
 * @param {string} configKey - The identifier for the text block (used in delimiter comments)
 * @param {string} configValue - The new content for the block
 * @param {string} commentPrefix - The comment character/prefix (e.g. '#', '//')
 * @param {boolean} isPrepend - If true, prepend the block when inserting new; if false, append
 * @returns {string} The modified text content
 */
function updateTextBlock(resultTextContent, configKey, configValue, commentPrefix, isPrepend) {
  configValue = configValue.trim();

  const regex = new RegExp(`(\\n)*(${commentPrefix} ${configKey})(\\n)[\\S\\s]+(${commentPrefix} END ${configKey})(\\n)*`);

  if (resultTextContent.match(regex)) {
    resultTextContent = resultTextContent
      .replace(
        regex,
        `

${commentPrefix} ${configKey}
${configValue}
${commentPrefix} END ${configKey}

`,
      )
      .trim();
  } else if (isPrepend === false) {
    // append
    // this means it's not there, let's add it
    resultTextContent = `
${resultTextContent}

${commentPrefix} ${configKey}
${configValue}
${commentPrefix} END ${configKey}

`;
  } else {
    // prepend
    resultTextContent = `

${commentPrefix} ${configKey}
${configValue}
${commentPrefix} END ${configKey}

${resultTextContent}

`;
  }

  return cleanupExtraWhitespaces(resultTextContent);
}

/**
 * Appends a delimited text block to the end of a text body (or replaces it if it already exists).
 * @param {string} resultTextContent - The full text content to modify
 * @param {string} configKey - The identifier for the text block
 * @param {string} configValue - The new content for the block
 * @param {string} [commentPrefix='#'] - The comment character/prefix
 * @returns {string} The modified text content
 */
function appendTextBlock(resultTextContent, configKey, configValue, commentPrefix = "#") {
  return updateTextBlock(resultTextContent, configKey, configValue, commentPrefix, false);
}

/**
 * Prepends a delimited text block to the beginning of a text body (or replaces it if it already exists).
 * @param {string} resultTextContent - The full text content to modify
 * @param {string} configKey - The identifier for the text block
 * @param {string} configValue - The new content for the block
 * @param {string} [commentPrefix='#'] - The comment character/prefix
 * @returns {string} The modified text content
 */
function prependTextBlock(resultTextContent, configKey, configValue, commentPrefix = "#") {
  return updateTextBlock(resultTextContent, configKey, configValue, commentPrefix, true);
}

/**
 * Reads BASH_SYLE_PATH, prepends a config block, and writes it back.
 * Replaces the common 3-line read/prepend/write pattern.
 * @param {string} configKey - The config key for the text block
 * @param {string} content - The content to prepend
 */
function registerWithBashSyleProfile(configKey, content) {
  let textContent = readText(BASH_SYLE_PATH);
  textContent = prependTextBlock(textContent, configKey, content);
  writeText(BASH_SYLE_PATH, textContent);
}

/**
 * Reads BASH_SYLE_AUTOCOMPLETE_PATH, prepends a config block, and writes it back.
 * Used by bash-autocomplete-*.js scripts to register autocomplete blocks.
 * @param {string} configKey - The config key for the text block
 * @param {string} content - The content to prepend
 */
function registerWithBashSyleAutocompleteWithRawContent(configKey, content) {
  let textContent = readText(BASH_SYLE_AUTOCOMPLETE_PATH);
  textContent = appendTextBlock(textContent, configKey, content);
  writeText(BASH_SYLE_AUTOCOMPLETE_PATH, textContent);
}

/**
 * Downloads a complete-spec file and registers a generic spec-based bash autocomplete for a command.
 * Spec format: each line is "command subcommand|opt1,opt2,--flag1,--flag2"
 * The spec file is saved to ~/.bash_syle_complete-spec-<command> and read at completion time.
 * @param {string} command - The command name (e.g. "docker")
 * @param {string} specUrl - URL or local path to the complete-spec file
 */
async function registerWithBashSyleAutocompleteWithCompleteSpec(command, specUrl) {
  const specFileName = `.bash_syle_complete-spec-${command}`;
  const specPath = path.join(BASE_HOMEDIR_LINUX, specFileName);

  // download and save the spec file
  const specContent = await fetchUrlAsString(specUrl);
  console.log(`    >> Writing complete-spec for ${command}`, consoleLogColor4(specPath));
  writeText(specPath, specContent);

  // register a pure-bash completer that reads from the spec file
  registerWithBashSyleAutocompleteWithRawContent(
    `${command} Autocomplete`,
    trimLeftSpaces(
      `
      ##################################################
      # ${command} (spec-based autocomplete)
      ##################################################
      __spec_complete_${command}()
      {
        local cur="\${COMP_WORDS[COMP_CWORD]}"
        local spec_file="${specPath}"
        local opts=""

        if [ -f "\$spec_file" ]; then
          # build the command prefix from COMP_WORDS excluding the current word
          # try longest prefix first (e.g. "docker attach"), then shorter (e.g. "docker")
          local i
          for (( i=COMP_CWORD; i>=1; i-- )); do
            local prefix="\${COMP_WORDS[*]:0:i}"
            local line
            line=\$(grep -m1 "^\$prefix|" "\$spec_file")
            if [ -n "\$line" ]; then
              opts="\$(echo "\$line" | cut -d'|' -f2- | tr ',' ' ')"
              break
            fi
          done
        fi

        COMPREPLY=(\$(compgen -W "\$opts" -- "\$cur"))
      }
      complete -F __spec_complete_${command} ${command}
    ` + "\n\n\n",
    ),
  );
}

/**
 * Safely writes content to a file with backup validation.
 * Throws if new content is empty or less than 10% of the existing backup content size.
 * @param {string} targetPath - The file path to write to
 * @param {string} newContent - The new content to write
 * @param {string} [backupContent] - Optional existing content to validate against
 * @param {number} [minRatio=0.1] - Minimum ratio of new content size to backup size (0-1)
 */
function safeWriteText(targetPath, newContent, backupContent, minRatio = 0.1) {
  if (!newContent || newContent.trim().length === 0) {
    throw new Error(`generated content is empty, keeping backup: ${targetPath}`);
  } else if (backupContent && newContent.length < backupContent.length * minRatio) {
    throw new Error(`generated content is <${Math.round(minRatio * 100)}% of backup size, keeping backup: ${targetPath}`);
  } else {
    writeText(targetPath, newContent);
  }
}

/**
 * Registers a platform-specific tweaks file with BASH_SYLE_PATH and writes the tweaks content.
 * @param {string} platformName - Display name (e.g. "Only Mac")
 * @param {string} fileName - The dotfile name (e.g. ".bash_syle_only_mac")
 * @param {string} content - The tweaks content to write to the file
 * @param {string} [sourceOverride] - Optional override for the source line (e.g. ". ~/filename" for Android Termux)
 */
function registerPlatformTweaks(platformName, fileName, content, sourceOverride) {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, fileName);

  console.log(`  >> Register ${platformName} profile`, BASH_SYLE_PATH);
  const sourceLine = sourceOverride || `. ${targetPath}`;
  registerWithBashSyleProfile(`${platformName} - PLATFORM SPECIFIC TWEAKS`, sourceLine);

  console.log(`  >> Installing ${platformName} tweaks:`, consoleLogColor4(targetPath));
  writeText(targetPath, content);
}

/**
 * Guard clause: exits the process based on whether the given path exists or not.
 * @param {string} targetPath - The path to check
 * @param {boolean} [exitIfFound=false] - If true, exits when path exists. If false, exits when path does not exist.
 * @param {string} [message] - Optional message (defaults to "Skipped : Found Folder" or "Skipped : Not Found")
 */
function exitIfPathCheck(targetPath, exitIfFound = false, message) {
  const found = filePathExist(targetPath);
  if (exitIfFound ? found : !found) {
    const defaultMessage = exitIfFound ? "Skipped : Found Folder" : "Skipped : Not Found";
    console.log(consoleLogColor1(`    >> ${message || defaultMessage}`), targetPath);
    return process.exit();
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
  for (const flag of osFlags) {
    if (global[flag]) {
      console.log(consoleLogColor1(`    >> Skipped : Not supported on ${flag}`));
      return process.exit();
    }
  }
}

/**
 * Downloads application binaries from the main repo into the Windows applications directory.
 * @param {string} applicationName - The application name
 * @param {function} findFilter - Filter function for downloadFilesFromMainRepo
 */
async function downloadWindowsApp(applicationName, findFilter) {
  const targetPath = await getWindowsApplicationBinaryDir(applicationName);
  console.log(`  >> Download ${applicationName} for Windows:`, targetPath);
  try {
    await downloadFilesFromMainRepo(findFilter, targetPath);
  } catch (err) {
    console.error("error", err);
  }
}

/**
 * Resolves OS_KEY based on current platform flags.
 * @param {object} keys - Object with { windows, mac, linux } key values
 * @returns {string} The resolved OS key
 */
function resolveOsKey(keys) {
  if (is_os_darwin_mac) return keys.mac;
  if (is_os_window) return keys.windows;
  return keys.linux;
}

/**
 * Collapses runs of 3+ consecutive newlines into double newlines and trims the result.
 * @param {string} text - The text to clean up
 * @returns {string} The cleaned text with excess whitespace removed
 */
function cleanupExtraWhitespaces(text) {
  return text.replace(/[\r\n][\r\n][\n]+/g, "\n\n").trim();
}

/**
 * Splits text into unique, trimmed lines, filtering out empty lines and comment lines (// # *).
 * @param {...string} texts - One or more text strings to split
 * @returns {string[]} Array of unique, non-empty, non-comment lines
 */
function convertTextToList(...texts) {
  return convertRawTextToList(texts).filter((s) => !!s && !s.match(/^\s*\/\/\/*/) && !s.match(/^\s*#+/) && !s.match(/^\s*[*]+/));
}

/**
 * Splits text into unique, trimmed lines (including empty and comment lines).
 * @param {...string} texts - One or more text strings to split
 * @returns {string[]} Array of unique, trimmed lines
 */
function convertRawTextToList(...texts) {
  const text = [...texts].join("\n");

  const items = text.split("\n").map((s) => s.trim());

  return [...new Set(items)]; // only return unique items
}

/**
 * Parses hosts-file formatted text into a deduplicated array of hostnames.
 * Strips leading IP addresses and filters to valid hostname patterns.
 * @param {...string} texts - One or more hosts-file formatted text strings
 * @returns {string[]} Unique hostnames extracted from the input
 */
function convertTextToHosts(...texts) {
  return convertRawTextToList(...texts)
    .map((s) => s.replace(/^[0-9]+.[0-9]+.[0-9]+.[0-9]+[ ]*/, "").trim())
    .filter((s) => s.length > 0 && s.match(/^[0-9a-zA-Z-.]+/) && s.match(/^[0-9a-zA-Z-.]+/)[0] === s);
}

/**
 * Trims leading spaces from each line of a text block by a specified or auto-detected amount.
 * If spaceToTrim is not provided, it is inferred from the indentation of the first non-empty line.
 * @param {string} text - The multiline text to dedent
 * @param {number} [spaceToTrim] - Number of leading spaces to remove from each line. Auto-detected if omitted.
 * @returns {string} The dedented text
 */
function trimLeftSpaces(text, spaceToTrim) {
  try {
    const lines = text.split("\n");

    if (spaceToTrim === undefined) {
      // if not present, we will attempt to look at the space to trim automatically
      // look for the first non empty line
      const firstLine = lines.filter((line) => line.trim())[0];
      spaceToTrim = firstLine.match(/^[ ]+/g)[0].length;
    }

    return lines
      .map((line) => {
        let myLeftSpaces = 0;
        try {
          myLeftSpaces = line.match(/^[ ]+/g)[0].length;
        } catch (err) {}

        return line.substr(Math.min(spaceToTrim, myLeftSpaces));
      })
      .join("\n");
  } catch (err) {
    return text;
  }
}

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

/**
 * Extracts the root domain (e.g. "example.com") from a URL or hostname string.
 * @param {string} url - The URL or hostname to extract the root domain from
 * @returns {string} The root domain portion of the URL
 */
function getRootDomainFrom(url) {
  const lastDotIndex = url.lastIndexOf(".");
  const partialUrl = url.substr(0, lastDotIndex);
  const secondLastDotIdx = partialUrl.lastIndexOf(".") || 0;

  return url.substr(secondLastDotIdx + 1);
}

/**
 * Creates a directory (and any necessary parent directories) at the given path.
 * @param {string} targetPath - The directory path to create
 * @returns {Promise<string>} Resolves with the stdout of the mkdir command
 */
function mkdir(targetPath) {
  return execBash(`mkdir -p "${targetPath}"`);
}

//////////////////////////////////////////////////////
// Network / API Utilities
//////////////////////////////////////////////////////
/**
 * Downloads a file from a URL to a local destination. Skips download if the file already exists.
 * @param {string} url - The URL to download from (can be relative to REPO_PREFIX_URL)
 * @param {string} destination - The local file path to save to
 * @returns {Promise<boolean>} Resolves to true if downloaded, false if skipped (already exists)
 */
function downloadFile(url, destination) {
  url = getFullUrl(url);

  return new Promise((resolve, reject) => {
    if (filePathExist(destination)) {
      console.log(consoleLogColor3("      << Skipped [NotModified]"), consoleLogColor4(destination));
      return resolve(false);
    }

    var file = fs.createWriteStream(destination);
    https
      .get(url, function (response) {
        response.pipe(file);
        file.on("finish", () => resolve(true));
      })
      .on("error", reject);
  });
}

/**
 * Downloads an asset from an external URL to a local destination using curl.
 * Unlike downloadFile, this supports redirects and does not prepend the repo URL.
 * @param {string} url - The full URL to download from
 * @param {string} destination - The local file path to save to
 * @returns {Promise<string>} Resolves with the command's stdout
 */
function downloadAsset(url, destination) {
  return execBash(`curl -sL "${url}" -o "${destination}"`);
}

/**
 * Downloads binary files from the main GitHub repo that match a filter function.
 * Only considers files under the "binaries/" path, excluding markdown files.
 * @param {function(string): boolean} findHandler - Filter function to select which files to download
 * @param {string} destinationBaseDir - The local directory to save downloaded files to
 * @returns {Promise<string[]>} The full list of repo files (not just downloaded ones)
 */
async function downloadFilesFromMainRepo(findHandler, destinationBaseDir) {
  const files = await listRepoDir("remote_api");

  const filesToDownload = files.filter((s) => s.includes("binaries/") && !s.toLowerCase().includes(".md")).filter(findHandler);

  const promises = [];
  for (const file of filesToDownload) {
    promises.push(
      new Promise(async (resolve) => {
        const destinationFile = path.join(destinationBaseDir, path.basename(file));

        try {
          const url = file;
          const downloaded = await downloadFile(url, destinationFile);
          if (downloaded === true) {
            console.log(consoleLogColor3("      >> Downloaded"), consoleLogColor4(destinationFile));
          }
        } catch (err) {
          console.log(consoleLogColor3("      >> Error Downloading"), consoleLogColor4(file));
        }

        resolve();
      }),
    );
  }

  return files;
}

/**
 * Deduplicates and filters raw file list to valid software/bootstrap script paths.
 * Normalizes prefixes, removes non-script files, and returns unique entries.
 * @param {string[]} files - Raw list of file paths to filter
 * @returns {string[]} Deduplicated, filtered, and normalized script file paths
 */
function filterRepoScripts(files) {
  const filtered = (files || [])
    .map((s) => s.trim().replace(/^\.\//, ""))
    .filter((f) => f && (f.startsWith("software/") || f.startsWith("bootstrap/")))
    .filter((f) => !f.endsWith(".json") && f !== "software/index.js")
    .filter((f) => [`.js`, `.sh`].some((allowedExt) => f.endsWith(allowedExt)));

  // this is a list of files to run last
  // NOTE: update ssh causes the change in host file,
  // therefore it needs to be done last
  const lastFiles = convertTextToList(`
    software/scripts/bash-syle-content.js
    software/scripts/vs-code-ext.sh
  `);

  return [...new Set(filtered)].sort((a, b) => {
    const aIsLast = lastFiles.includes(a);
    const bIsLast = lastFiles.includes(b);

    // lastFiles come last
    if (aIsLast !== bIsLast) return aIsLast ? 1 : -1;

    // then by number of slashes (fewer slashes first)
    const slashDiff = a.split("/").length - b.split("/").length;
    if (slashDiff !== 0) return slashDiff;

    // then alphabetically
    return a.localeCompare(b);
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
  if (source === "local" || fallthrough) {
    try {
      return filterRepoScripts(convertRawTextToList(await execBash("find .", true)))
    } catch (_) {}
  }

  if (source === "remote_api" || fallthrough) {
    const url = `https://api.github.com/repos/${REPO_PATH_IDENTIFIER}/git/trees/${REPO_BRANCH_NAME}?recursive=1&cacheBust=${Date.now()}`;

    // doing a nested and recursive call to get the files
    try {
      const json = await fetchUrlAsJson(url);
      return json.tree.map((file) => file.path);
    } catch (_) {}
  }

  if (source === "remote_cache" || fallthrough) {
    try {
      const content = await fetchUrlAsString("software/metadata/script-list.config");
      return convertTextToList(content);
    } catch (_) {}
  }

  // if things fail, let's just return empty array here
  return [];
}

//////////////////////////////////////////////////////
// Script File Discovery & Platform Filtering
//////////////////////////////////////////////////////
/**
 * Get all available scripts used for searching and matching against partially matched scripts.
 * @returns {Promise<string[]>} Array of all script file paths sorted by depth then alphabetically
 */
async function getAllRepoSoftwareFiles() {
  return listRepoDir("local", true);
}

/**
 * Gets list of scripts available for a system based on OS flags, used for checking and testing.
 * Filters scripts based on the current OS platform and applies ordering rules
 * (certain scripts run first/last). Can fetch the file list from the GitHub API or local filesystem.
 * @returns {Promise<string[]>} Ordered array of script file paths to execute
 */
async function getSoftwareScriptFiles() {
  let files;

  if (IS_TEST_SCRIPT_MODE === true) {
    files = await listRepoDir("local");
  } else {
    files = await listRepoDir("remote_api");
  }

  // clean up the files, only include software/scripts (used for run mode by the os)
  files = filterRepoScripts(files).filter((f) => f.includes("software/scripts"));

  let softwareFiles = files
    .filter(
      (f) =>
        !!f.match("software/scripts/") &&
        (f.includes(".js") || f.includes(".sh")) &&
        !f.includes("config.js") &&
        !f.includes(".json") &&
        !f.includes(".common.js"),
    )
    .sort();

  // Exclude OS-specific script folders that don't belong to the current platform.
  // Each script self-guards against unsupported OSes via exitIfUnsupportedOs().
  const pathsToIgnore = [
    [is_os_window, "software/scripts/windows"],
    [is_os_darwin_mac, "software/scripts/mac"],
    [is_os_arch_linux, "software/scripts/arch_linux"],
    [is_os_android_termux, "software/scripts/android-termux"],
    [is_os_chromeos, "software/scripts/chromeos"],
  ]
    .map(([valid, pathToCheck]) => (!valid ? pathToCheck : ""))
    .filter((s) => !!s);

  return softwareFiles.filter((file) => {
    if (!HAS_SUDO_ACCESS && [".su.sh.js", ".su.js", ".su.sh"].some((ext) => file.endsWith(ext))) {
      console.log(echoColorError(`  >> [Ignored] - No sudo access: ${file}`));
      return false;
    }

    for (const pathToIgnore of pathsToIgnore) {
      if (file.includes(pathToIgnore)) {
        console.log(echoColorError(`  >> [Ignored] - OS Specific ${file}`));
        return false;
      }
    }

    console.log(echoColorSuccess(`  >> [Accepted]: ${file}`));
    return true;
  });
}

/**
 * Converts a relative URL to an absolute URL by prepending REPO_PREFIX_URL.
 * If the URL already starts with "http", it is returned as-is.
 * @param {string} url - The URL or relative path to resolve
 * @returns {string} The fully qualified URL
 */
function getFullUrl(url) {
  if (url.indexOf("http") !== 0) {
    url = `${REPO_PREFIX_URL}${url}`;
  }
  return url;
}

/**
 * Fetches a URL (or local file in test mode) and returns its content as a string.
 * Tries curl first, then falls back to Node's https module.
 * @param {string} url - The URL or relative path to fetch
 * @returns {Promise<string>} The fetched content as a string
 */
async function fetchUrlAsString(url) {
  if (IS_TEST_SCRIPT_MODE && !url.includes("http")) {
    const file = url;
    return execBash(`cat ${file}`);
  }

  // fetch as real url
  try {
    url = getFullUrl(url);
    return execBash(`curl -s ${url}`);
  } catch (err) {
    return new Promise((resolve) => {
      require("https").get(url, (res) => {
        let rawData = "";
        res.on("data", (chunk) => (rawData += chunk)).on("end", () => resolve(rawData));
      });
    });
  }
}

/**
 * Performs a shallow git clone of a repository's master branch into the specified directory.
 * @param {string} repo - The git repository URL to clone
 * @param {string} destinationDir - The local directory to clone into
 * @returns {Promise<string>} Resolves with the stdout of the git clone command
 */
function gitClone(repo, destinationDir) {
  return execBash(`git clone --depth 1 -b master "${repo}" "${destinationDir}" &>/dev/null`);
}

/**
 * Fetches a URL and parses the response as JSON (supports comments in the JSON).
 * @param {string} url - The URL or relative path to fetch
 * @returns {Promise<object>} The parsed JSON object
 */
async function fetchUrlAsJson(url) {
  const json = await fetchUrlAsString(url);
  return parseJsonWithComments(json);
}

//////////////////////////////////////////////////////
// Bash Execution
//////////////////////////////////////////////////////
/**
 * Executes a bash command and returns the output as a string.
 * @param {string} cmd - The shell command to execute
 * @param {boolean} [returnOutput=false] - If true, use execSync and return output. If false, use async exec and swallow errors.
 * @param {object} [options] - Optional exec options (cwd, env, etc.)
 * @returns {Promise<string>} Resolves with the command's stdout
 */
async function execBash(cmd, returnOutput = false, options) {
  if (!returnOutput) {
    return new Promise((resolve) => {
      const { exec } = require("child_process");
      exec(cmd, options || {}, (error, stdout, stderr) => {
        resolve(stdout);
      });
    });
  }
  return new Promise((resolve) => {
    const { execSync } = require("child_process");
    const stdout = execSync(cmd, {
      ...(options || {}),
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    }).toString();
    resolve(stdout);
  });
}

/**
 * Deletes a directory or file at the given path using rm -rf.
 * @param {string} targetPath - The path to delete
 * @param {boolean} [recursive=true] - Whether to delete recursively (adds -r flag)
 * @returns {Promise<string>} Resolves when deletion is complete
 */
function deleteFolder(targetPath, recursive = true) {
  console.log(`  >> Deleting ${targetPath}`);
  const flags = recursive ? "-rf" : "-f";
  return execBash(`rm ${flags} "${targetPath}"`);
}

//////////////////////////////////////////////////////
// Console Colors & Output
//////////////////////////////////////////////////////
/**
 * Generates a bash echo command string that outputs the given text.
 * @param {string} str - The text to echo
 * @returns {string} A bash echo command string
 */
function echo(str) {
  return `echo '''${str}'''`;
}

/**
 * Generates a bash echo command string that outputs colored text using ANSI escape codes.
 * @param {string} str - The text to echo
 * @param {string} color - The ANSI color code (e.g. '32m' for green)
 * @returns {string} A bash echo command string with color escape sequences
 */
function echoColor(str, color) {
  return `echo -e $'\\e[${color}${str}\\e[m'`;
}

/**
 * Wraps a string with ANSI color escape codes for use with console.log.
 * @param {string} str - The text to colorize
 * @param {string} color - The ANSI color code (e.g. '32m' for green)
 * @returns {string} The string wrapped in ANSI color escape sequences
 */
function consoleLogColor(str, color) {
  return `\x1b[${color}${str}\x1b[0m`;
}

/**
 * ANSI color codes used to dynamically generate global color helper functions.
 * The loop below creates echoColor{N} and consoleLogColor{N} for each non-null entry,
 * where N is the array index. Index 0 is intentionally null (unused).
 * Additionally, echoColorSuccess (green) and echoColorError (red) are defined as named aliases.
 */
const CONSOLE_COLORS = [
  null, // 0: Not used
  "32m", // 1: Green (Success)
  "33m", // 2: Yellow (Warning)
  "36m", // 3: Cyan (Info)
  "2m", // 4: Dim (Metadata)
  "1;31m", // 5: Bold Red (Standard Error)
  "41;97;1m", // 6: BG Red + White Text (CRITICAL ERROR)
  "43;30m", // 7: BG Yellow + Black Text (ATTENTION)
  "35m", // 8: Magenta (System)
  "38;5;208m", // 9: Orange (256-color mode - unique Warning)
];

for (let idx = 0; idx < CONSOLE_COLORS.length; idx++) {
  const color = CONSOLE_COLORS[idx];

  if (color) {
    globalThis["echoColor" + idx] = (str) => echoColor(str, color);
    globalThis["consoleLogColor" + idx] = (str) => consoleLogColor(str, color);
  }
}

/** @type {(str: string) => string} Generates a bash echo command with green (success) coloring */
const echoColorSuccess = (str) => echoColor(str, "32m");
/** @type {(str: string) => string} Generates a bash echo command with red (error) coloring */
const echoColorError = (str) => echoColor(str, "31m");
const echoColorWarning = (str) => echoColor(str, "33m");

//////////////////////////////////////////////////////
// Script Processing & Execution
//////////////////////////////////////////////////////
/**
 * Generates and prints a bash command pipeline for fetching and executing a script file.
 * Determines the appropriate runner (node, bash, sudo) based on the file's extension pattern
 * (e.g. .su.js for sudo node, .sh.js for node piped to bash).
 * @param {string} file - The script file path (relative to the repo), after prefix expansion
 * @param {string} originalFile - The original file name before prefix expansion (e.g. before adding 'software/scripts/')
 * @param {string[]} allRepoFiles - List of all file paths in the repository for regex matching
 * @returns {void}
 */
function processScriptFile(file, originalFile, allRepoFiles) {
  const url = getFullUrl(`${file}?${Date.now()}`);

  /**
   * Builds the full fetch script command, prepending the bootstrap start script for .js files.
   * @param {string} file - The script file path
   * @param {string} url - The full URL to fetch the script from
   * @returns {string} The composed fetch command string
   */
  function _generateScript(file, url) {
    if (file.includes(".js")) {
      return `${_generateStartScript()} && ${_generateRawScript(file, url)}`;
    }
    return `${_generateRawScript(file, url)}`;
  }

  /**
   * Generates a curl or cat command to fetch a script file's content.
   * Uses cat in test mode, curl otherwise.
   * @param {string} file - The script file path
   * @param {string} url - The full URL to fetch the script from
   * @returns {string} A curl or cat command string
   */
  function _generateRawScript(file, url) {
    if (IS_TEST_SCRIPT_MODE) {
      return `cat ${file}`;
    }

    return `curl -s ${url}`;
  }

  /**
   * Generates the fetch command for the bootstrap index.js file.
   * @returns {string} A fetch command string for the software/index.js bootstrap script
   */
  function _generateStartScript() {
    const startScriptFilePath = "software/index.js";
    const startScriptUrl = getFullUrl(`${startScriptFilePath}?${Date.now()}`);

    return _generateRawScript(startScriptFilePath, startScriptUrl);
  }

  /**
   * Determines the pipe target (node, bash, sudo) based on the file's extension pattern.
   * For example, .su.js pipes to sudo node, .sh.js pipes node output to bash.
   * @param {string} file - The script file path
   * @param {string} url - The full URL of the script
   * @returns {string} The pipe command (e.g., 'node', 'bash', 'sudo -E node', 'node | bash')
   */
  function _generatePipeOutput(file, url) {
    if (file.includes(".su.sh.js")) {
      if (DEBUG_WRITE_TO_DIR) {
        // for debug mode, we do not want to run bash
        return "node";
      }
      return `node | bash`;
    }
    if (file.includes(".su.js")) {
      return `sudo -E node`; // -E means preserve the env variable
    }
    if (file.includes(".sh.js")) {
      if (DEBUG_WRITE_TO_DIR) {
        // for debug mode, we do not want to run bash
        return "node";
      }
      return `node | bash`;
    }
    if (file.includes(".js")) {
      return `node`;
    }

    if (file.includes(".su.sh")) {
      return `sudo -E bash`; // -E means preserve the env variable
    }
    if (file.includes(".sh")) {
      return `bash`;
    }
  }

  const fileName = path.basename(file);
  const filePattern = new RegExp(fileName, "i");
  const foundMatchedPath = allRepoFiles.find((f) => filePattern.test(f) && f.startsWith(path.dirname(file)));
  const fileExists = !!foundMatchedPath;

  let description = "";
  if (fileExists) {
    if (file !== foundMatchedPath) {
      description = `Expanded ${originalFile} to ${foundMatchedPath}`;
    }
    file = foundMatchedPath;
  } else {
    description = `File not found: ${file}`;
  }

  if (fileExists) {
    console.log(`{ ${_generateScript(file, url)} ;} | ${_generatePipeOutput(file, url)}`);
  } else {
    console.log(echoColor3(`  >> ${originalFile} (${file}) - does not exist `));
  }

  scriptProcessingResults.push({
    file: originalFile,
    path: file,
    script: _generateScript(file, url),
    status: fileExists ? "success" : "error",
    description: description,
  });
}

/**
 * Fetches a remote script file and evaluates its content in the current context.
 * @param {string} file - The file path or URL to fetch and eval
 * @returns {Promise<void>}
 */
async function includeSource(file) {
  const fileContent = await fetchUrlAsString(file);
  eval(fileContent);
}

/**
 * Prints a formatted table of OS flags (is_os_*) to stdout via a generated node command.
 * Respects the SHOULD_PRINT_OS_FLAGS environment variable to suppress output.
 * @returns {void}
 */
function printOsFlags() {
  if (process.env.SHOULD_PRINT_OS_FLAGS === "true") {
    printSectionBlock(`OS Flags`);
    console.log(`
      node -e """
        Object.keys(process.env)
          .filter(envKey => envKey.indexOf('is_os_') === 0)
          .forEach(envKey => console.log(envKey.padEnd(30, ' ') + ':', process.env[envKey] === '1' ? 'Yes': 'No'))
      """
    `);
  }
}

/**
 * Prints a formatted list of script files that will be executed to stdout via a generated node command.
 * @param {string[]} scriptsToRun - Array of script file paths to display
 * @returns {void}
 */
function printScriptsToRun(scriptsToRun) {
  printSectionBlock(`Scripts to Run: ${scriptsToRun.length} files`, scriptsToRun);
}

/**
 * Prints a formatted section block with a header and optional content lines to stdout via a generated node command.
 * @param {string} header - The section header text
 * @param {string[]} [lines=[]] - Optional array of content lines to display between the header and footer
 * @returns {void}
 */
function printSectionBlock(header, lines = []) {
  console.log(echoColorError(LINE_BREAK_EQUAL));
  console.log(echoColorError(`>> ${header}`));
  console.log(echoColorError(LINE_BREAK_EQUAL));
}

/**
 * Prints the script processing results with a section header.
 * Success entries are printed in green, error entries in red.
 * @param {Array<{file: string, path: string, description: string, status: string}>} results - The scriptProcessingResults array
 * @returns {void}
 */
function printScriptProcessingResults(results) {
  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  printSectionBlock(`Script Processing Results: ${results.length} files (${successCount} success, ${errorCount} failed)`);

  for (const result of results) {
    if (result.status === "success") {
      console.log(echoColorSuccess(`[Success] ${result.file} (${result.path}). ${result.description}`));
    } else {
      console.log(echoColorError(`[Error] ${result.file} (${result.path}). ${result.description}`));
    }
  }
}

//////////////////////////////////////////////////////
// doWork: Test Specific Files (when TEST_SCRIPT_FILES is set)
//////////////////////////////////////////////////////
/**
 * Runs a subset of scripts specified by the TEST_SCRIPT_FILES environment variable.
 * Parses the comma/semicolon/whitespace-separated list, resolves each to a repo path,
 * and generates the bash pipeline commands to fetch and execute them.
 * @returns {Promise<void>}
 */
async function _doWorkTestFiles() {
  const filesToTest = process.env.TEST_SCRIPT_FILES || "";

  if (!filesToTest) {
    console.log(`echo '''    >> Skipped'''`);
    return;
  }

  const allRepoFiles = await getAllRepoSoftwareFiles();
  console.log(
    echoColor1(
      `>> _doWorkTestFiles => filesToTest (process.env.TEST_SCRIPT_FILES)=${filesToTest.length}, and allRepoFiles=${allRepoFiles.length}.`,
    ),
  );

  const softwareFiles = filesToTest
    .split(/[,;\s]/) // list can be separated by ; or , or \n or \r
    .map((s) => s.trim())
    .filter((s) => !!s);

  printOsFlags(); // Print OS Environments
  printScriptsToRun(softwareFiles);

  for (let i = 0; i < softwareFiles.length; i++) {
    const originalFile = softwareFiles[i];
    let file = originalFile;

    if (file.startsWith("software/")) {
      // does not includes the proper prefix
    } else {
      // add the prefix if needed
      file = `software/scripts/${file}`;
    }

    console.log(echoColor2(`>> ${file} (${calculatePercentage(i + 1, softwareFiles.length)}%)`));

    processScriptFile(file, originalFile, allRepoFiles);
  }

  printScriptProcessingResults(scriptProcessingResults);
}

//////////////////////////////////////////////////////
// doWork: Full Run (when TEST_SCRIPT_FILES is not set)
//////////////////////////////////////////////////////
/**
 * Runs the full software setup: discovers all platform-applicable script files,
 * orders them (bootstrap first, hosts/extensions last), and generates the bash
 * pipeline commands to fetch and execute each one sequentially.
 * @returns {Promise<void>}
 */
async function _doWorkFullRun() {
  const softwareFiles = await getSoftwareScriptFiles();

  console.log(
    echoColor1(
      `
>> Installing Configurations: ${softwareFiles.length} Files
`,
    ),
  );

  const allRepoFiles = await getAllRepoSoftwareFiles();

  printOsFlags(); // Print OS Environments
  printScriptsToRun(softwareFiles);

  for (let i = 0; i < softwareFiles.length; i++) {
    const originalFile = softwareFiles[i];
    let file = originalFile;

    // add the prefix if needed
    if (!file.startsWith("software/scripts/")) {
      file = `software/scripts/${file}`;
    }

    console.log(echoColor2(`>> ${file} (${calculatePercentage(i + 1, softwareFiles.length)}%)`));

    processScriptFile(file, originalFile, allRepoFiles);
  }

  printScriptProcessingResults(scriptProcessingResults);
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
    ["BASH_SYLE_COMMON", BASH_SYLE_COMMON],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missingEnvVars.length > 0) {
    console.error(`Missing required environment variables: ${missingEnvVars.join(", ")}`);
    process.exit(1);
  }

  // getting the ip address mapping
  try {
    HOME_HOST_NAMES = await fetchUrlAsJson(`software/metadata/ip-address.config.hostnamesFlattened`);
  } catch (err) {
    HOME_HOST_NAMES = [];
  }

  // create the sy tweak folder
  const pathsToCreateDir = [path.join(BASE_SY_CUSTOM_TWEAKS_DIR, "mac"), path.join(BASE_SY_CUSTOM_TWEAKS_DIR, "windows")];

  for (const aPath of pathsToCreateDir) {
    try {
      await mkdir(aPath);
    } catch (err) {}
  }

  // for debugging
  process
    .on("unhandledRejection", (reason, p) => {
      console.error("[Error] unhandledRejection", reason, "Unhandled Rejection at Promise", p);
      process.exit(1);
    })
    .on("uncaughtException", (err) => {
      console.error("[Error] uncaughtException", err, "Uncaught Exception thrown");
      process.exit(1);
    });

  // start script
  try {
    if (typeof doWork === "function") {
      // if doWork is defined externally (e.g. by a script concatenated after this file), use it
      await doWork();
    } else if (process.env.TEST_SCRIPT_FILES) {
      // test specific files
      await _doWorkTestFiles();
    } else {
      // full run
      await _doWorkFullRun();
    }
  } catch (err) {
    console.log("<< Error", err);
  }
})();

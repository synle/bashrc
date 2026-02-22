//////////////////////////////////////////////////////
// Global Imports & Path Constants
//////////////////////////////////////////////////////
/** @type {typeof import('fs')} */
var fs = (globalThis.fs = (0, require)('fs'));
/** @type {typeof import('path')} */
var path = (globalThis.path = (0, require)('path'));
/** @type {typeof import('https')} */
var https = (globalThis.https = (0, require)('https'));
/** @type {typeof import('http')} */
var http = (globalThis.http = (0, require)('http'));

// depends on system, it's either BASE_WINDOW_1 or BASE_WINDOW_2
// there's a script that will check and set the correct value used to BASE_WINDOW
/** @type {string} */
var BASE_HOMEDIR_LINUX = (globalThis.BASE_HOMEDIR_LINUX = (0, require)('os').homedir());
/** @type {string} */
globalThis.BASE_BASH_SYLE = path.join(BASE_HOMEDIR_LINUX, '.bash_syle');

// specific for windows and wsl only
/** @type {string} */
globalThis.BASE_MOUNT_DIR_WINDOW = '';
/** @type {string} */
globalThis.BASE_C_DIR_WINDOW = '';
/** @type {string} */
globalThis.BASE_D_DIR_WINDOW = '';
/** @type {string} */
globalThis.BASE_WINDOW = '';
/** @type {string} */
globalThis.BASE_WINDOW_1 = '/mnt/c/Users';
/** @type {string} */
globalThis.BASE_WINDOW_2 = '/c/Users';

// default node installation
/** @type {number} */
globalThis.DEFAULT_NVM_NODE_VERSION = 24;
/** @type {string} */
globalThis.nvmBasePath = path.join(BASE_HOMEDIR_LINUX, '.nvm');
/** @type {string | null} */
globalThis.nvmDefaultNodePath = findDirSingle(nvmBasePath + '/versions/node', new RegExp(`[v]*${DEFAULT_NVM_NODE_VERSION}[0-9.]+`));

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
var scriptProcessingResults = [];

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

const fontFamily = process.env.FONT_FAMILY || 'Fira Code';

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
 * @property {string[]} ignoredFiles - Glob patterns for files hidden from the editor (e.g. '*.exe', '.DS_Store')
 * @property {string[]} ignoredFolders - Directory names excluded from the editor file tree (e.g. 'node_modules', '.git')
 * @property {string[]} ignoredBinaries - Glob patterns for binary files visible in tree but excluded from search for performance
 */
globalThis.EDITOR_CONFIGS = {
  fontSize,
  fontFamily,
  tabSize,
  /** Print/ruler column width in the editor @type {number} */
  maxLineSize: 140,
  /** List of file glob patterns to be ignored by the editor @type {string[]} */
  ignoredFiles: [
    '._*',
    '.DS_Store',
    '.eslintcache',
    '.Spotlight-*',
    '.Trashes',
    '*.class',
    '*.code-search',
    '*.db',
    '*.dll',
    '*.doc',
    '*.docx',
    '*.dylib',
    '*.egg-info',
    '*.egg',
    '*.exe',
    '*.idb',
    '*.Identifier',
    '*.ini',
    '*.jar',
    '*.js.map',
    '*.lib',
    '*.min.js',
    '*.mp3',
    '*.ncb',
    '*.o',
    '*.obj',
    '*.ogg',
    '*.pdb',
    '*.pid.lock',
    '*.pid',
    '*.psd',
    '*.py[cod]',
    '*.pyc',
    '*.pyo',
    '*.rej',
    '*.sdf',
    '*.seed',
    '*.sln',
    '*.so',
    '*.Spotlight-*',
    '*.sqlite',
    '*.sublime-workspace',
    '*.suo',
    '*.swf',
    '*.swp',
    '*.Trashes',
    '*.zip',
    'package-lock.json',
    'yarn.lock',
  ],
  /** List of folder names to be ignored by the editor @type {string[]} */
  ignoredFolders: [
    '.cache',
    '.ebextensions',
    '.generated',
    '.git',
    '.gradle',
    '.hg',
    '.idea',
    '.mypy_cache',
    '.pytest_cache',
    '.sass-cache',
    '.svn',
    '.venv',
    '__pycache*',
    '__pycache__',
    'bower_components',
    'build',
    'coverage',
    'CVS',
    'dist',
    'env',
    'node_modules',
    'tmp',
    'venv',
    'webpack-dist',
  ],
  /** List of binary file glob patterns visible in tree but excluded from search for performance @type {string[]} */
  ignoredBinaries: [
    '.git/*',
    '.venv/*',
    '*.dds',
    '*.eot',
    '*.exe',
    '*.gif',
    '*.ico',
    '*.jar',
    '*.jpeg',
    '*.jpg',
    '*.log',
    '*.pdf',
    '*.png',
    '*.pyc',
    '*.swf',
    '*.tga',
    '*.ttf',
    '*.woff',
    '*.woff2',
    '*.zip',
    'build/*',
    'dist/*',
    'node_modules/*',
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
globalThis.HOME_HOST_NAMES = [];

// os flags
/** @type {boolean} */
globalThis.is_os_window = false;
/** @type {boolean} */
globalThis.is_os_darwin_mac = false;
/** @type {boolean} */
globalThis.is_os_arch_linux = false;
/** @type {boolean} */
globalThis.is_os_android_termux = false;
/** @type {boolean} */
globalThis.is_os_chromeos = false;
Object.keys(process.env)
  .filter((envKey) => envKey.indexOf('is_os_') === 0)
  .forEach((envKey) => (globalThis[envKey] = parseInt(process.env[envKey] || '0') > 0));

// setting up the path for the extra tweaks
/** @type {string} */
globalThis.BASE_SY_CUSTOM_TWEAKS_DIR =
  is_os_window === true ? path.join(getWindowUserBaseDir(), '...sy', '_extra') : path.join(globalThis.BASE_HOMEDIR_LINUX, '_extra');

/** @type {string} */
globalThis.DEBUG_WRITE_TO_DIR = (process.env.DEBUG_WRITE_TO_DIR || '').toLowerCase().trim();

const repoName = 'synle/bashrc';
const repoBranch = 'master';
/** @type {string} */
globalThis.REPO_PREFIX_URL = `https://raw.githubusercontent.com/${repoName}/${repoBranch}/`;

const isTestScriptMode = parseInt(process.env.TEST_SCRIPT_MODE) === 1;

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
  if (globalThis.DEBUG_WRITE_TO_DIR.length > 0) {
    const fileName = filePath
      .replace(/[\/\\\(\)]/g, '_')
      .replace(/ /g, '_')
      .replace(/_\./g, '.')
      .replace(/__+/g, '_');

    pathToUse = path.join(globalThis.DEBUG_WRITE_TO_DIR, fileName);
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
 * find and return the first dir that matches the prop
 * @param  {array} findProps must contains "src" and "match"
 * @return {string} the path of the first dir and undefined otherwise
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
 * @param {string} filePath - The file path to write to
 * @param {string} text - The text content to write
 * @param {boolean} [override=true] - Whether to overwrite existing content. If false, skips writing when file exists
 * @param {boolean} [suppressError=false] - Whether to suppress the "skipped" log message
 * @returns {void}
 */
function writeText(filePath, text, override = true, suppressError = false) {
  const pathToUse = _getFilePath(filePath);
  const newContent = (text || '').trim();
  const oldContent = readText(pathToUse).trim();

  if (oldContent === newContent || override !== true) {
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
function touchFile(filePath, defaultContent = '') {
  const pathToUse = path.resolve(filePath);
  if (filePathExist(pathToUse)) {
    console.log(consoleLogColor3('      << Skipped [NotModified]'), consoleLogColor4(pathToUse));
  } else {
    console.log(consoleLogColor3('      >> File Created'), consoleLogColor4(pathToUse));
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
    const backupPathToUse = pathToUse + '.' + Date.now();
    writeText(backupPathToUse, oldText);
    writeText(pathToUse, text);
    console.log(consoleLogColor3('      << Backup Created'), consoleLogColor4(backupPathToUse));
  } else {
    console.log(consoleLogColor3('      << Backup Skipped [NotModified]'), consoleLogColor4(pathToUse));
  }
}

/**
 * Writes a JSON object to a file, optionally prepending comments.
 * @param {string} filePath - The file path to write to
 * @param {object} json - The JSON object to serialize and write
 * @param {string} [comments=''] - Optional comment text to prepend before the JSON content
 * @returns {void}
 */
function writeJson(filePath, json, comments = '') {
  let content = comments + '\n' + JSON.stringify(json, null, 2);
  writeText(filePath, content.trim());
}

/**
 * Writes one or more build output files, routing to DEBUG_WRITE_TO_DIR when set.
 * @param {Array<{file: string, data: any, isJson?: boolean, comments?: string}> | {file: string, data: any, isJson?: boolean, comments?: string}} tasks - A single task or array of tasks to write
 * @returns {void}
 */
function writeToBuildFile(tasks) {
  tasks = [].concat(tasks);

  if (DEBUG_WRITE_TO_DIR) {
    for (let { file, data, isJson, comments } of [].concat(tasks)) {
      isJson = !!isJson;
      comments = comments || '';

      if (comments) {
        comments += '\n';
      }

      if (isJson) {
        console.log(consoleLogColor1('    >> DEBUG Mode: write JSON to file'), consoleLogColor4(file));
        writeJson(file, data, comments);
      } else {
        console.log(consoleLogColor1('    >> DEBUG Mode: write TEXT to file'), consoleLogColor4(file));
        writeText(file, (comments + data).trim());
      }
    }
    return process.exit();
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
  writeText(filePath, oldText + '\n' + text);
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
    .split('\n')
    .map((line) => {
      let newLine = line;

      for (const [matchRegex, replaceWith] of replacements) {
        newLine = newLine.replace(matchRegex, replaceWith);
      }

      return newLine;
    })
    .join('\n');

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
  return parseJsonWithComments(fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' }));
}

/**
 * Reads the contents of a text file, returning an empty string if the file doesn't exist or can't be read.
 * @param {string} filePath - The file path to read
 * @returns {string} The trimmed file contents, or an empty string on error
 */
function readText(filePath) {
  try {
    return fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' }).trim();
  } catch (err) {
    return '';
  }
}

/**
 * Parses a JSON string that may contain comments or non-standard syntax by using eval.
 * Exits the process if the input is empty.
 * @param {string} oldText - The raw JSON/JS text to parse
 * @returns {object} The parsed object
 */
function parseJsonWithComments(oldText) {
  oldText = (oldText || '').trim();
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
 * Tries two possible mount paths (/mnt/c/Users and /c/Users) and sets
 * global path variables (BASE_WINDOW, BASE_C_DIR_WINDOW, etc.) accordingly.
 * @returns {string|undefined} The Windows user home directory path, or undefined if not found
 */
function getWindowUserBaseDir() {
  const regexUsername = /(leng)|(sy[ ]*le)/i;
  let res = '';

  // try option 1
  res = findDirSingle(globalThis.BASE_WINDOW_1, regexUsername);
  if (res) {
    globalThis.BASE_WINDOW = globalThis.BASE_WINDOW_1;
    globalThis.BASE_C_DIR_WINDOW = '/mnt/c';
    globalThis.BASE_D_DIR_WINDOW = '/mnt/d';
    globalThis.BASE_MOUNT_DIR_WINDOW = '/mnt';
    return res;
  }

  // try option 2
  res = findDirSingle(globalThis.BASE_WINDOW_2, regexUsername);
  if (res) {
    globalThis.BASE_WINDOW = globalThis.BASE_WINDOW_2;
    globalThis.BASE_C_DIR_WINDOW = '/c';
    globalThis.BASE_D_DIR_WINDOW = '/d';
    globalThis.BASE_MOUNT_DIR_WINDOW = '/';
    return res;
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
 * @param  {String} applicationName Optional - the application name to be appended to the base path
 * if present, we will attempt to make a new directory there
 * @return {String} the full path to the application binary which can be used to install or download...
 */
async function getWindowsApplicationBinaryDir(applicationName) {
  let targetPath = findDirSingle('/mnt', /[d]/) || findDirSingle('/mnt', /[c]/);

  if (filePathExist(targetPath)) {
    // push this binary into d drive
    targetPath = path.join(targetPath, 'Applications');
  } else {
    // else use the extra folder
    targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, 'windows');
  }

  if (applicationName) {
    targetPath = path.join(targetPath, applicationName);
    await mkdir(targetPath);
  }

  return targetPath;
}

/**
 * @return {String} the path for app roaming dir for windows
 */
function getWindowAppDataRoamingUserPath() {
  return path.join(getWindowUserBaseDir(), 'AppData/Roaming');
}

/**
 * @return {String} the path for app data local dir in windows
 */
function getWindowAppDataLocalUserPath() {
  return path.join(getWindowUserBaseDir(), 'AppData/Local');
}

/**
 * Returns the macOS Application Support directory path for the current user.
 * @returns {string} The path to ~/Library/Application Support
 */
function getOsxApplicationSupportCodeUserPath() {
  return path.join(process.env.HOME, 'Library/Application Support');
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
function appendTextBlock(resultTextContent, configKey, configValue, commentPrefix = '#') {
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
function prependTextBlock(resultTextContent, configKey, configValue, commentPrefix = '#') {
  return updateTextBlock(resultTextContent, configKey, configValue, commentPrefix, true);
}

/**
 * Reads BASE_BASH_SYLE, prepends a config block, and writes it back.
 * Replaces the common 3-line read/prepend/write pattern.
 * @param {string} configKey - The config key for the text block
 * @param {string} content - The content to prepend
 */
function registerWithBashSyle(configKey, content) {
  let textContent = readText(BASE_BASH_SYLE);
  textContent = prependTextBlock(textContent, configKey, content);
  writeText(BASE_BASH_SYLE, textContent);
}

/**
 * Registers a platform-specific tweaks file with BASE_BASH_SYLE and writes the tweaks content.
 * @param {string} platformName - Display name (e.g. "Only Mac")
 * @param {string} fileName - The dotfile name (e.g. ".bash_syle_only_mac")
 * @param {string} content - The tweaks content to write to the file
 * @param {string} [sourceOverride] - Optional override for the source line (e.g. ". ~/filename" for Android Termux)
 */
function registerPlatformTweaks(platformName, fileName, content, sourceOverride) {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, fileName);

  console.log(`  >> Register ${platformName} profile`, BASE_BASH_SYLE);
  const sourceLine = sourceOverride || `. ${targetPath}`;
  registerWithBashSyle(`${platformName} - PLATFORM SPECIFIC TWEAKS`, sourceLine);

  console.log(`  >> Installing ${platformName} tweaks:`, consoleLogColor4(targetPath));
  writeText(targetPath, content);
}

/**
 * Guard clause: exits the process if the given path does not exist.
 * @param {string} targetPath - The path to check
 * @param {string} [message] - Optional message (defaults to "Skipped : Not Found")
 */
function exitIfPathNotFound(targetPath, message) {
  if (!filePathExist(targetPath)) {
    console.log(consoleLogColor1(`    >> ${message || 'Skipped : Not Found'}`));
    return process.exit();
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
    console.error('error', err);
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
  return text.replace(/[\r\n][\r\n][\n]+/g, '\n\n').trim();
}

/**
 * Converts one or more multiline text strings into a deduplicated array of non-empty, non-comment lines.
 * Filters out lines starting with //, #, or *.
 * @param {...string} texts - One or more text strings to process
 * @returns {string[]} Unique, trimmed, non-empty lines that are not comments
 */
function convertTextToList(...texts) {
  const text = [...texts].join('\n');

  const items = text
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => !!s && !s.match(/^\s*\/\/\/*/) && !s.match(/^\s*#+/) && !s.match(/^\s*[*]+/));

  return [...new Set(items)]; // only return unique items
}

/**
 * Parses hosts-file formatted text into a deduplicated array of hostnames.
 * Strips leading IP addresses and filters to valid hostname patterns.
 * @param {...string} texts - One or more hosts-file formatted text strings
 * @returns {string[]} Unique hostnames extracted from the input
 */
function convertTextToHosts(...texts) {
  const text = [...texts].join('\n');

  const items = text
    .split('\n')
    .map((s) => s.replace(/^[0-9]+.[0-9]+.[0-9]+.[0-9]+[ ]*/, '').trim())
    .filter((s) => s.length > 0 && s.match(/^[0-9a-zA-Z-.]+/) && s.match(/^[0-9a-zA-Z-.]+/)[0] === s);

  return [...new Set(items)]; // only return unique items
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
    const lines = text.split('\n');

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
      .join('\n');
  } catch (err) {
    return text;
  }
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
  const lastDotIndex = url.lastIndexOf('.');
  const partialUrl = url.substr(0, lastDotIndex);
  const secondLastDotIdx = partialUrl.lastIndexOf('.') || 0;

  return url.substr(secondLastDotIdx + 1);
}

/**
 * Creates a directory (and any necessary parent directories) at the given path.
 * @param {string} targetPath - The directory path to create
 * @returns {Promise<string>} Resolves with the stdout of the mkdir command
 */
function mkdir(targetPath) {
  return execBashSilent(`mkdir -p "${targetPath}"`);
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
      console.log(consoleLogColor3('      << Skipped [NotModified]'), consoleLogColor4(destination));
      return resolve(false);
    }

    var file = fs.createWriteStream(destination);
    https
      .get(url, function (response) {
        response.pipe(file);
        file.on('finish', () => resolve(true));
      })
      .on('error', reject);
  });
}

/**
 * Downloads binary files from the main GitHub repo that match a filter function.
 * Only considers files under the "binaries/" path, excluding markdown files.
 * @param {function(string): boolean} findHandler - Filter function to select which files to download
 * @param {string} destinationBaseDir - The local directory to save downloaded files to
 * @returns {Promise<string[]>} The full list of repo files (not just downloaded ones)
 */
async function downloadFilesFromMainRepo(findHandler, destinationBaseDir) {
  const files = await listRepoDir();

  const filesToDownload = files.filter((s) => s.includes('binaries/') && !s.toLowerCase().includes('.md')).filter(findHandler);

  const promises = [];
  for (const file of filesToDownload) {
    promises.push(
      new Promise(async (resolve) => {
        const destinationFile = path.join(destinationBaseDir, path.basename(file));

        try {
          const url = file;
          const downloaded = await downloadFile(url, destinationFile);
          if (downloaded === true) {
            console.log(consoleLogColor3('      >> Downloaded'), consoleLogColor4(destinationFile));
          }
        } catch (err) {
          console.log(consoleLogColor3('      >> Error Downloading'), consoleLogColor4(file));
        }

        resolve();
      }),
    );
  }

  return files;
}

/**
 * Lists all files in the GitHub repository.
 * When fetchFromRemote is true, queries the Git tree API. Otherwise, uses the pre-compiled
 * script list fallback directly.
 * @param {boolean} [fetchFromRemote=true] - If true, fetches the file list from the GitHub API
 * @returns {Promise<string[]>} Array of file paths in the repository
 */
async function listRepoDir(fetchFromRemote = true) {
  if (fetchFromRemote) {
    const url = `https://api.github.com/repos/${repoName}/git/trees/${repoBranch}?recursive=1&cacheBust=${Date.now()}`;

    // doing a nested and recursive call to get the files
    try {
      const json = await fetchUrlAsJson(url);
      return json.tree.map((file) => file.path);
    } catch (err) {}
  }

  // fall back to use the pre compiled set
  try {
    const content = await fetchUrlAsString('software/metadata/script-list.config');
    return convertTextToList(content);
  } catch (err) {}

  // if things fail, let's just return empty array here
  return [];
}

//////////////////////////////////////////////////////
// Script File Discovery & Platform Filtering
//////////////////////////////////////////////////////
/**
 * Returns all software script files in the repo without OS filtering, using fallback file listing.
 * @returns {Promise<string[]>} Array of all script file paths
 */
async function getAllRepoSoftwareFiles() {
  return getSoftwareScriptFiles({ skipOsFiltering: true, useFallback: true });
}

/**
 * Discovers and returns the ordered list of software setup script files to execute.
 * Filters scripts based on the current OS platform and applies ordering rules
 * (certain scripts run first/last). Can fetch the file list from the GitHub API or local filesystem.
 * @param {Object} [options={}] - Configuration options
 * @param {boolean} [options.skipOsFiltering=false] - If true, returns all matching scripts without OS filtering or ordering
 * @param {boolean} [options.useLocalFiles=false] - If true, uses local `find` instead of the GitHub API
 * @param {boolean} [options.useFallback=false] - If true, attempts both local `find` and GitHub API as fallbacks, using whichever succeeds last. Errors from either method are silently ignored.
 * @returns {Promise<string[]>} Ordered array of script file paths to execute
 */
async function getSoftwareScriptFiles({ skipOsFiltering = false, useLocalFiles = false, useFallback = false } = {}) {
  let files;

  // fallback mode: try local find first, fall back to API if files is empty
  if (useFallback === true) {
    try {
      files = (await execBash('find .')).split('\n').map((s) => s.replace('./software/scripts/', 'software/scripts/'));
    } catch (_) {}

    if (!files || files.length === 0) {
      try {
        files = await listRepoDir();
      } catch (_) {}
    }
  }
  if (useLocalFiles === true || isTestScriptMode === true) {
    // fetch from exec bash
    files = (await execBash('find .')).split('\n').map((s) => s.replace('./software/scripts/', 'software/scripts/'));
  } else {
    // fetch from APIS
    files = await listRepoDir();
  }

  // clean up the files
  files = files
    .filter((f) => !!f.match('software/scripts/') && !f.endsWith('.config.js'))
    .filter((f) => {
      const EXTENSIONS_TO_USE = [`.js`, `.sh`];

      for (const extension of EXTENSIONS_TO_USE) {
        if (f.endsWith(extension)) {
          return true;
        }
      }

      return false;
    });

  //this is a special flags used to return all the script for index building
  if (skipOsFiltering) {
    return files;
  }

  const firstFiles = convertTextToList(`
    software/scripts/_bash-rc-bootstrap.js
    software/scripts/_nvm-binary.js
    software/scripts/_nvm-symlink.sh.js
  `);

  // this is a list of file to do last
  // NOTE because the update ssh causes the change in host file
  // therefore it needs to be done last
  const lastFiles = convertTextToList(`
    software/scripts/bash-syle-content.js
    software/scripts/etc-hosts.su.js
    software/scripts/vs-code-extensions.sh
  `);

  if (is_os_window) {
    firstFiles.push('software/scripts/windows/mkdir.js');
  }

  let softwareFiles = files
    .filter(
      (f) =>
        !!f.match('software/scripts/') &&
        (f.includes('.js') || f.includes('.sh')) &&
        !f.includes('config.js') &&
        !f.includes('.json') &&
        !f.includes('.common.js'),
    )
    .filter((f) => firstFiles.indexOf(f) === -1 && lastFiles.indexOf(f) === -1)
    .sort();

  softwareFiles = [...new Set([...firstFiles, ...softwareFiles, ...lastFiles])];

  return softwareFiles.filter((file) => {
    const bareboneScriptsCommon = `
      // common
      software/scripts/fzf.js
      software/scripts/synle-make-component.js
      software/scripts/diff-so-fancy.sh
      software/scripts/sublime-text-configurations.js
      software/scripts/sublime-text-keybindings.js
      software/scripts/vs-code-configurations.js
      software/scripts/vs-code-keybindings.js
      software/scripts/jq.js
      software/scripts/jq.sh
      software/scripts/terminator.js
      software/scripts/vim-configurations.js
      software/scripts/vim-vundle.sh
      software/scripts/git.js
      software/scripts/tmux.js
    `;

    const scriptFinderConfigs = [
      {
        key: 'is_os_arch_linux',
        allowed_path: 'software/scripts/arch-linux',
        whitelist: `
          ${bareboneScriptsCommon}
          software/scripts/git.js
          // only
          software/scripts/fonts.js
          software/scripts/kde-konsole-profile.js
          software/scripts/libreoffice.js
        `,
      },
      {
        key: 'is_os_android_termux',
        allowed_path: 'software/scripts/android-termux',
        whitelist: `
          software/scripts/vim-configurations.js
          software/scripts/vim-vundle.sh
        `,
      },
      {
        key: 'is_os_chromeos',
        allowed_path: 'software/scripts/chrome-os',
        whitelist: `
          ${bareboneScriptsCommon}
          software/scripts/fonts.js
          software/scripts/libreoffice.js
        `,
      },
    ].map((scriptFinderConfig) => {
      // here we make sure it's including the first files along wth the last file.
      // these files are required to properly bootstrap the shell profile
      scriptFinderConfig.whitelist = [
        ...firstFiles,
        ...convertTextToList(scriptFinderConfig.whitelist),
        'software/scripts/bash-syle-content.js', // the last file
      ];
      return scriptFinderConfig;
    });

    const pathsToIgnore = [
      [is_os_arch_linux, 'software/scripts/arch-linux'],
      [is_os_android_termux, 'software/scripts/android-termux'],
      [is_os_window, 'software/scripts/windows'],
      [is_os_darwin_mac, 'software/scripts/mac'],
      [is_os_chromeos, 'software/scripts/chrome-os'],
    ]
      .map(([valid, pathToCheck]) => (!valid ? pathToCheck : ''))
      .filter((s) => !!s);

    for (const scriptFinderConfig of scriptFinderConfigs) {
      const isScriptFinderConfigApplicable = global[scriptFinderConfig.key];

      if (isScriptFinderConfigApplicable) {
        // it's some of the configs, we should use it
        if (file.includes(scriptFinderConfig.allowed_path)) {
          return true;
        }

        // when run in an android termux env, only run script in that folder
        if (scriptFinderConfig.whitelist.indexOf(file) >= 0) {
          return true;
        }

        return false;
      }
    }

    // handle it differently
    for (const pathToIgnore of pathsToIgnore) {
      if (file.includes(pathToIgnore)) {
        return false;
      }
    }

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
  if (url.indexOf('http') !== 0) {
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
  if (isTestScriptMode && !url.includes('http')) {
    const file = url;
    return execBash(`cat ${file}`);
  }

  // fetch as real url
  try {
    url = getFullUrl(url);
    return execBash(`curl -s ${url}`);
  } catch (err) {
    return new Promise((resolve) => {
      require('https').get(url, (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk)).on('end', () => resolve(rawData));
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
  return execBashSilent(`git clone --depth 1 -b master "${repo}" "${destinationDir}" &>/dev/null`);
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
 * Executes a bash command synchronously and returns the output as a string.
 * Uses a 50MB max buffer for large outputs.
 * @param {string} cmd - The shell command to execute
 * @param {object} [options] - Optional execSync options (cwd, env, etc.)
 * @returns {Promise<string>} Resolves with the command's stdout
 */
function execBash(cmd, options) {
  return new Promise((resolve) => {
    const { execSync } = require('child_process');
    const stdout = execSync(cmd, {
      ...(options || {}),
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    }).toString();
    resolve(stdout);
  });
}

/**
 * Executes a bash command asynchronously, silently swallowing errors.
 * @param {string} cmd - The shell command to execute
 * @param {object} [options] - Optional exec options (cwd, env, etc.)
 * @returns {Promise<string>} Resolves with the command's stdout (empty string on error)
 */
function execBashSilent(cmd, options) {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    options = options || {};
    exec(cmd, options || {}, (error, stdout, stderr) => {
      resolve(stdout);
    });
  });
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
  null, // 0 index is not used
  '32m', // green
  '33m', // yellow
  '36m', // cyan
  '2m', // dim silver
  '31m', // red
  '35m', // magenta
  '34m', // blue
  '37m', // white
];

for (let idx = 0; idx < CONSOLE_COLORS.length; idx++) {
  const color = CONSOLE_COLORS[idx];

  if (color) {
    global['echoColor' + idx] = (str) => echoColor(str, color);
    global['consoleLogColor' + idx] = (str) => consoleLogColor(str, color);
  }
}

global.echoColorSuccess = (str) => echoColor(str, '32m');
global.echoColorError = (str) => echoColor(str, '31m');

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

  function _generateScript(file, url) {
    if (file.includes('.js')) {
      return `${_generateStartScript()} && ${_generateRawScript(file, url)}`;
    }
    return `${_generateRawScript(file, url)}`;
  }

  function _generateRawScript(file, url) {
    if (isTestScriptMode) {
      return `cat ${file}`;
    }

    return `curl -s ${url}`;
  }

  function _generateStartScript() {
    const startScriptFilePath = 'software/base-node-script.js';
    const startScriptUrl = getFullUrl(`${startScriptFilePath}?${Date.now()}`);

    return _generateRawScript(startScriptFilePath, startScriptUrl);
  }

  function _generatePipeOutput(file, url) {
    if (file.includes('.su.sh.js')) {
      if (DEBUG_WRITE_TO_DIR) {
        // for debug mode, we do not want to run bash
        return 'node';
      }
      return `node | bash`;
    }
    if (file.includes('.su.js')) {
      return `sudo -E node`; // -E means preserve the env variable
    }
    if (file.includes('.sh.js')) {
      if (DEBUG_WRITE_TO_DIR) {
        // for debug mode, we do not want to run bash
        return 'node';
      }
      return `node | bash`;
    }
    if (file.includes('.js')) {
      return `node`;
    }

    if (file.includes('.su.sh')) {
      return `sudo -E bash`; // -E means preserve the env variable
    }
    if (file.includes('.sh')) {
      return `bash`;
    }
  }

  const fileName = path.basename(file);
  const filePattern = new RegExp(fileName, 'i');
  const foundMatchedPath = allRepoFiles.find((f) => filePattern.test(f) && f.startsWith(path.dirname(file)));
  const fileExists = !!foundMatchedPath;

  let description = '';
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
    status: fileExists ? 'success' : 'error',
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
  if (process.env.SHOULD_PRINT_OS_FLAGS !== 'false') {
    console.log(`
      node -e """
        console.log(''.padStart(90, '='));
        console.log('>> OS Flags'.padEnd(88, ' '));
        console.log(''.padStart(90, '='));
        Object.keys(process.env)
          .filter(envKey => envKey.indexOf('is_os_') === 0)
          .forEach(envKey => console.log(envKey.padEnd(20, ' ') + ':', process.env[envKey] === '1' ? 'Yes': 'No'))
        console.log(''.padStart(90, '='));
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
  const linesOutput = lines.map((line) => `console.log('${line}')`).join('\n      ');
  console.log(`
    node -e """
      console.log(''.padStart(90, '='));
      console.log('>> ${header}'.padEnd(88, ' '));
      console.log(''.padStart(90, '='));
      ${linesOutput}
      ${lines.length > 0 ? `console.log(''.padStart(90, '='));` : ''}
    """
  `);
}

/**
 * Prints the script processing results with a section header.
 * Success entries are printed in green, error entries in red.
 * @param {Array<{file: string, path: string, description: string, status: string}>} results - The scriptProcessingResults array
 * @returns {void}
 */
function printScriptProcessingResults(results) {
  const successCount = results.filter((r) => r.status === 'success').length;
  const errorCount = results.filter((r) => r.status === 'error').length;

  console.log(echo(''.padStart(90, '=')));
  console.log(
    echo(`>> Script Processing Results: ${results.length} files (${successCount} success, ${errorCount} failed)`.padEnd(88, ' ')),
  );
  console.log(echo(''.padStart(90, '=')));

  for (const result of results) {
    if (result.status === 'success') {
      console.log(echoColorSuccess(`[Success] ${result.file} (${result.path}). ${result.description}`));
    } else {
      console.log(echoColorError(`[Error] ${result.file} (${result.path}). ${result.description}`));
    }
  }

  console.log(echo(''.padStart(90, '=')));
}

//////////////////////////////////////////////////////
// doWork: Test Specific Files (when TEST_SCRIPT_FILES is set)
//////////////////////////////////////////////////////
async function _doWorkTestFiles() {
  const filesToTest = process.env.TEST_SCRIPT_FILES || '';

  if (!filesToTest) {
    console.log(`echo '''    >> Skipped'''`);
    return;
  }

  console.log(`echo '''    >> filesToTest = ${filesToTest.length}'''`);

  const softwareFiles = filesToTest
    .split(/[,;\s]/) // list can be separated by ; or , or \n or \r
    .map((s) => s.trim())
    .filter((s) => !!s);

  if (softwareFiles.length > 1) {
    console.log(
      echoColor1(
        `
${''.padStart(90, '=')}
>> Testing Configurations: ${softwareFiles.length} Files
${''.padStart(90, '=')}
${softwareFiles.join('\n')}
${''.padStart(90, '=')}
`,
      ),
    );
  }

  const allRepoFiles = await getAllRepoSoftwareFiles();

  printOsFlags(); // Print OS Environments
  printScriptsToRun(softwareFiles);

  for (let i = 0; i < softwareFiles.length; i++) {
    const originalFile = softwareFiles[i];
    let file = originalFile;

    if (file.startsWith('software/')) {
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
    if (!file.startsWith('software/scripts/')) {
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
(async function () {
  // getting the ip address mapping
  try {
    globalThis.HOME_HOST_NAMES = await fetchUrlAsJson(`software/metadata/ip-address.config.hostnamesFlattened`);
  } catch (err) {
    globalThis.HOME_HOST_NAMES = [];
  }

  // create the sy tweak folder
  const pathsToCreateDir = [
    path.join(globalThis.BASE_SY_CUSTOM_TWEAKS_DIR, 'mac'),
    path.join(globalThis.BASE_SY_CUSTOM_TWEAKS_DIR, 'windows'),
  ];

  for (const aPath of pathsToCreateDir) {
    try {
      await mkdir(aPath);
    } catch (err) {}
  }

  // for debugging
  process
    .on('unhandledRejection', (reason, p) => {
      console.error('[Error] unhandledRejection', reason, 'Unhandled Rejection at Promise', p);
    })
    .on('uncaughtException', (err) => {
      console.error('[Error] uncaughtException', err, 'Uncaught Exception thrown');
      process.exit(1);
    });

  // start script
  try {
    doInit && (await doInit());
  } catch (err) {}
  try {
    if (typeof doWork === 'function') {
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
    console.log('<< Error', err);
  }
})();

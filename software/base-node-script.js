//////////////////////////////////////////////////////
// Global Imports & Path Constants
//////////////////////////////////////////////////////
globalThis.fs = require('fs');
globalThis.path = require('path');
globalThis.https = require('https');
globalThis.http = require('http');

// depends on system, it's either BASE_WINDOW_1 or BASE_WINDOW_2
// there's a script that will check and set the correct value used to BASE_WINDOW
globalThis.BASE_HOMEDIR_LINUX = require('os').homedir();
globalThis.BASE_BASH_SYLE = path.join(BASE_HOMEDIR_LINUX, '.bash_syle');

// specific for windows and wsl only
globalThis.BASE_MOUNT_DIR_WINDOW = '';
globalThis.BASE_C_DIR_WINDOW = '';
globalThis.BASE_D_DIR_WINDOW = '';
globalThis.BASE_WINDOW = '';
globalThis.BASE_WINDOW_1 = '/mnt/c/Users';
globalThis.BASE_WINDOW_2 = '/c/Users';

//////////////////////////////////////////////////////
// Editor Configuration
//////////////////////////////////////////////////////
/**
 * config used for the editors
 * @type {Object}
 *
 * if you need to override these with your local settings, use the following
 * export FONT_SIZE=15;
 * export FONT_FAMILY='Fira Code'
 * export TAB_SIZE=2
 */
let fontSize = parseInt(process.env.FONT_SIZE);
if (!fontSize || fontSize <= 10) {
  fontSize = 10;
}

const fontFamily = process.env.FONT_FAMILY || 'Fira Code';

let tabSize = parseInt(process.env.TAB_SIZE);
if (!tabSize || tabSize <= 2) {
  tabSize = 2;
}

globalThis.EDITOR_CONFIGS = {
  fontSize,
  fontFamily,
  tabSize,
  maxLineSize: 140,
  ignoredFiles: [
    '._*',
    '.DS_Store',
    '.eslintcache',
    '*.class',
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
    '*.Spotlight-V100',
    '*.sqlite',
    '*.suo',
    '*.swf',
    '*.swp',
    '*.Trashes',
    '*.woff',
    '*.woff2',
    '*.zip',
    'package-lock.json',
    'yarn.lock',
  ],
  ignoredFolders: [
    '__pycache__',
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
    'bower_components',
    'build',
    'coverage',
    'CVS',
    'dist',
    'node_modules',
    'tmp',
    'venv',
    'webpack-dist',
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
Object.keys(process.env)
  .filter((envKey) => envKey.indexOf('is_os_') === 0)
  .forEach((envKey) => (globalThis[envKey] = parseInt(process.env[envKey] || '0') > 0));

// setting up the path for the extra tweaks
globalThis.BASE_SY_CUSTOM_TWEAKS_DIR =
  is_os_window === true ? path.join(getWindowUserBaseDir(), '...sy', '_extra') : path.join(globalThis.BASE_HOMEDIR_LINUX, '_extra');

globalThis.DEBUG_WRITE_TO_DIR = (process.env.DEBUG_WRITE_TO_DIR || '').toLowerCase().trim();

const repoName = 'synle/bashrc';
const repoBranch = 'master';
globalThis.REPO_PREFIX_URL = `https://raw.githubusercontent.com/${repoName}/${repoBranch}/`;

const isTestScriptMode = parseInt(process.env.TEST_SCRIPT_MODE) === 1;

//////////////////////////////////////////////////////
// Directory Search Utilities
//////////////////////////////////////////////////////
function _getFilePath(aDir) {
  let pathToUse = aDir;
  if (globalThis.DEBUG_WRITE_TO_DIR.length > 0) {
    const fileName = aDir
      .replace(/[\/\\\(\)]/g, '_')
      .replace(/ /g, '_')
      .replace(/_\./g, '.')
      .replace(/__+/g, '_');

    pathToUse = path.join(globalThis.DEBUG_WRITE_TO_DIR, fileName);
  }

  return pathToUse;
}

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

function findDirSingle(srcDir, targetMatch) {
  return findDirList(srcDir, targetMatch, true);
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
function writeText(aDir, text, override = true, suppressError = false) {
  const pathToUse = _getFilePath(aDir);
  const newContent = (text || '').trimEnd();
  const oldContent = readText(pathToUse);
  if (oldContent.trim() === newContent.trim() || override !== true) {
    // if content don't change, then don't save
    // if override is set to false, then don't override
    if (suppressError !== true) {
      console.log(consoleLogColor3('      << Skipped [NotModified]'), consoleLogColor4(pathToUse));
    }
  } else {
    fs.writeFileSync(pathToUse, newContent);
  }
}

function touchFile(aDir, defaultContent = '') {
  const pathToUse = path.resolve(aDir);
  if (filePathExist(pathToUse)) {
    console.log(consoleLogColor3('      << Skipped [NotModified]'), consoleLogColor4(pathToUse));
  } else {
    console.log(consoleLogColor3('      >> File Created'), consoleLogColor4(pathToUse));
    fs.writeFileSync(pathToUse, defaultContent);
  }
}

function backupText(aDir, text) {
  const pathToUse = aDir;
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

function writeJson(aDir, json, comments = '') {
  let content = comments + '\n' + JSON.stringify(json, null, 2);
  writeText(aDir, content.trim());
}

/**
 *
 * @param {*} tasks is an array of
 [
  file,     // string — absolute or relative file path
  data,     // object or string — content to write
  isJson,   // boolean — true if file should be written as JSON
  comments  // string — optional text prepended as comments
]
 * @returns
 */
function writeToBuildFile(tasks) {
  tasks = [].concat(tasks);

  if (DEBUG_WRITE_TO_DIR) {
    for (let [file, data, isJson, comments] of [].concat(tasks)) {
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

function appendText(aDir, text) {
  const oldText = readText(aDir);
  writeText(aDir, oldText + '\n' + text);
}

function replaceTextLineByLine(aDir, replacements, makeAdditionalBackup = false) {
  const oldText = readText(aDir);

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
  writeText(`${aDir}.bak`, oldText, false);

  if (makeAdditionalBackup === true) {
    writeText(`${aDir}.bak.${Date.now()}`, oldText);
  }

  // save with newText
  writeText(aDir, newText);
}

function writeJsonWithMerge(aDir, json) {
  let oldJson = {};
  try {
    oldJson = readJson(aDir);
  } catch (e) {}
  writeJson(aDir, Object.assign(oldJson, json));
}

function readJson(aDir) {
  return parseJsonWithComments(fs.readFileSync(aDir, { encoding: 'utf8', flag: 'r' }));
}

function readText(aDir) {
  try {
    return fs.readFileSync(aDir, { encoding: 'utf8', flag: 'r' }).trim();
  } catch (err) {
    return '';
  }
}

function parseJsonWithComments(oldText) {
  oldText = (oldText || '').trim();
  if (!oldText) {
    process.exit();
  }
  return eval(`var ___temp = ${oldText}; ___temp;`);
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

//////////////////////////////////////////////////////
// Platform-Specific Path Utilities
//////////////////////////////////////////////////////
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

function getOsxApplicationSupportCodeUserPath() {
  return path.join(process.env.HOME, 'Library/Application Support');
}

//////////////////////////////////////////////////////
// Text Processing Utilities
//////////////////////////////////////////////////////
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

function appendTextBlock(resultTextContent, configKey, configValue, commentPrefix = '#') {
  return updateTextBlock(resultTextContent, configKey, configValue, commentPrefix, false);
}

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

function cleanupExtraWhitespaces(s) {
  return s.replace(/[\r\n][\r\n][\n]+/g, '\n\n').trim();
}

function convertTextToList(...texts) {
  const text = [...texts].join('\n');

  const items = text
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => !!s && !s.match(/^\s*\/\/\/*/) && !s.match(/^\s*#+/) && !s.match(/^\s*[*]+/));

  return [...new Set(items)]; // only return unique items
}

function convertTextToHosts(...texts) {
  const text = [...texts].join('\n');

  const items = text
    .split('\n')
    .map((s) => s.replace(/^[0-9]+.[0-9]+.[0-9]+.[0-9]+[ ]*/, '').trim())
    .filter((s) => s.length > 0 && s.match(/^[0-9a-zA-Z-.]+/) && s.match(/^[0-9a-zA-Z-.]+/)[0] === s);

  return [...new Set(items)]; // only return unique items
}

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

function calculatePercentage(count, total) {
  return ((count * 100) / total).toFixed(2);
}

function getRootDomainFrom(url) {
  const lastDotIndex = url.lastIndexOf('.');
  const partialUrl = url.substr(0, lastDotIndex);
  const secondLastDotIdx = partialUrl.lastIndexOf('.') || 0;

  return url.substr(secondLastDotIdx + 1);
}

function mkdir(targetPath) {
  return execBashSilent(`mkdir -p "${targetPath}"`);
}

//////////////////////////////////////////////////////
// Network / API Utilities
//////////////////////////////////////////////////////
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

async function listRepoDir() {
  const url = `https://api.github.com/repos/${repoName}/git/trees/${repoBranch}?recursive=1&cacheBust=${Date.now()}`;

  // doing a nested and recursive call to get the files
  try {
    const json = await fetchUrlAsJson(url);
    return json.tree.map((file) => file.path);
  } catch (err) {}

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
async function getSoftwareScriptFiles(returnAllScripts = false, useLocalFileListInstead = false) {
  let files;

  if (useLocalFileListInstead === true || isTestScriptMode === true) {
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
  if (returnAllScripts) {
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

function getFullUrl(url) {
  if (url.indexOf('http') !== 0) {
    url = `${REPO_PREFIX_URL}${url}`;
  }
  return url;
}

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

function gitClone(repo, pwd) {
  return execBashSilent(`git clone --depth 1 -b master "${repo}" "${pwd}" &>/dev/null`);
}

async function fetchUrlAsJson(url) {
  const json = await fetchUrlAsString(url);
  return parseJsonWithComments(json);
}

//////////////////////////////////////////////////////
// Bash Execution
//////////////////////////////////////////////////////
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
const CONSOLE_COLORS = [
  null, // 0 index is not used
  '32m', // green
  '33m', // yellow
  '36m', // cyan
  '2m', // dim silver
];

function echo(str) {
  return `echo '''${str}'''`;
}

function echoColor(str, color) {
  return `echo -e $'\\e[${color}${str}\\e[m'`;
}

function consoleLogColor(str, color) {
  return `\x1b[${color}${str}\x1b[0m`;
}

for (let idx = 0; idx < CONSOLE_COLORS.length; idx++) {
  const color = CONSOLE_COLORS[idx];

  if (color) {
    global['echoColor' + idx] = (str) => echoColor(str, color);
    global['consoleLogColor' + idx] = (str) => consoleLogColor(str, color);
  }
}

//////////////////////////////////////////////////////
// Script Processing & Execution
//////////////////////////////////////////////////////
function processScriptFile(file) {
  let scriptToUse;

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

  scriptToUse = _generateScript(file, url);

  const pipeOutput = _generatePipeOutput(file, url);

  console.log(`{ ${scriptToUse} ;} | ${pipeOutput}`);
}

async function includeSource(file) {
  const fileContent = await fetchUrlAsString(file);
  eval(fileContent);
}

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

function printScriptsToRun(scriptsToRun) {
  console.log(`
    node -e """
      console.log(''.padStart(90, '='));
      console.log('>> Scripts to Run'.padEnd(88, ' '));
      console.log(''.padStart(90, '='));
      ${scriptsToRun.map((file) => `console.log('${file}')`).join('\n      ')}
      console.log(''.padStart(90, '='));
    """
  `);
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
  if (process.env.DEBUG) {
    process
      .on('unhandledRejection', (reason, p) => {
        console.error(reason, 'Unhandled Rejection at Promise', p);
      })
      .on('uncaughtException', (err) => {
        console.error(err, 'Uncaught Exception thrown');
        process.exit(1);
      });
  }

  // start script
  try {
    doInit && (await doInit());
  } catch (err) {}
  try {
    doWork && (await doWork());
  } catch (err) {
    console.log('<< Error', err);
  }
})();

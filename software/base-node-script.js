globalThis.fs = require("fs");
globalThis.path = require("path");
globalThis.https = require("https");
globalThis.http = require("http");

globalThis.BASE_WINDOW = "/mnt/c/Users";
globalThis.BASE_HOMEDIR_LINUX = require("os").homedir();
globalThis.BASE_BASH_SYLE = path.join(BASE_HOMEDIR_LINUX, ".bash_syle");

globalThis.CONFIGS = {
  fontFamily: "Fira Code Retina",
};

/**
 * The host config is located here:
 *
 * https://raw.githubusercontent.com/synle/bashrc/master/software/metadata/ip-address.json
 *
 * host name => host ip
 * @type {Array}
 */
globalThis.HOME_HOST_NAMES = [];

// flags
try {
  globalThis.is_os_ubuntu = false || parseInt(process.env.is_os_ubuntu) > 0;
} catch (err) {}

try {
  globalThis.is_os_darwin_mac =
    false ||
    parseInt(process.env.is_os_darwin_mac) > 0 ||
    fs.existsSync("/Applications");
} catch (err) {}

try {
  globalThis.is_os_android_termux =
    false ||
    parseInt(process.env.is_os_android_termux) > 0 ||
    fs.existsSync("/data/data/com.termux");
} catch (err) {}

try {
  globalThis.is_os_window =
    false ||
    parseInt(process.env.is_os_window) > 0 ||
    fs.existsSync(BASE_WINDOW);
} catch (err) {}

try {
  globalThis.is_os_mingw64 =
    false ||
    parseInt(process.env.is_os_mingw64) > 0 ||
    fs.existsSync("/mingw64");
} catch (err) {}

try {
  globalThis.is_os_wsl =
    false ||
    parseInt(process.env.is_os_wsl) > 0 ||
    (fs.existsSync("/mnt/c/Users") && fs.existsSync("/usr/local/bin"));
} catch (err) {}

// setting up the path for the extra tweaks
globalThis.BASE_SY_CUSTOM_TWEAKS_DIR = is_os_window
  ? path.join(getWindowUserBaseDir(), "...sy", "_extra")
  : path.join(globalThis.BASE_HOMEDIR_LINUX, "_extra");

const isTestScriptMode = parseInt(process.env.TEST_SCRIPT_MODE) === 1;

//////////////////////////////////////////////////////
// begin common
function writeText(aDir, text) {
  fs.writeFileSync(aDir, text);
}

function writeJson(aDir, json) {
  fs.writeFileSync(aDir, JSON.stringify(json, null, 2));
}

function appendText(aDir, text) {
  const oldText = readText(aDir);
  fs.writeFileSync(aDir, oldText + "\n" + text);
}

function writeJsonWithMerge(aDir, json) {
  let oldJson = {};
  try {
    oldJson = readJson(aDir);
  } catch (e) {}
  writeJson(aDir, Object.assign(oldJson, json));
}

function readJson(aDir) {
  return parseJsonWithComments(
    fs.readFileSync(aDir, { encoding: "utf8", flag: "r" })
  );
}

function readText(aDir) {
  try {
    return fs.readFileSync(aDir, { encoding: "utf8", flag: "r" }).trim();
  } catch (err) {
    return "";
  }
}

function parseJsonWithComments(oldText) {
  oldText = (oldText || "").trim();
  if (!oldText) {
    process.exit();
  }
  return eval(`var ___temp = ${oldText}; ___temp;`);
}

function getWindowUserBaseDir() {
  return path.join(
    BASE_WINDOW,
    fs
      .readdirSync(BASE_WINDOW)
      .filter(
        (dir) =>
          dir.toLowerCase().indexOf("leng") >= 0 ||
          dir.toLowerCase().indexOf("syle") >= 0 ||
          dir.toLowerCase().indexOf("sy le") >= 0
      )[0]
  );
}

function getWindowAppDataRoamingUserPath() {
  return path.join(getWindowUserBaseDir(), "AppData/Roaming");
}

function getWindowAppDataLocalUserPath() {
  return path.join(getWindowUserBaseDir(), "AppData/Local");
}

function getOsxApplicationSupportCodeUserPath() {
  return path.join(process.env.HOME, "Library/Application Support");
}

function updateTextBlock(
  resultTextContent,
  configKey,
  configValue,
  commentPrefix,
  isPrepend
) {
  commentPrefix = commentPrefix || "#";
  configValue = configValue.trim();

  const regex = new RegExp(
    `(\\n)*(${commentPrefix} ${configKey})(\\n)[\\S\\s]+(${commentPrefix} END ${configKey})(\\n)*`
  );

  if (resultTextContent.match(regex)) {
    resultTextContent = resultTextContent
      .replace(
        regex,
        `

${commentPrefix} ${configKey}
${configValue}
${commentPrefix} END ${configKey}

`
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

function appendTextBlock(
  resultTextContent,
  configKey,
  configValue,
  commentPrefix
) {
  return updateTextBlock(
    resultTextContent,
    configKey,
    configValue,
    commentPrefix,
    false
  );
}

function prependTextBlock(
  resultTextContent,
  configKey,
  configValue,
  commentPrefix
) {
  return updateTextBlock(
    resultTextContent,
    configKey,
    configValue,
    commentPrefix,
    true
  );
}

function cleanupExtraWhitespaces(s) {
  return s.replace(/[\r\n][\r\n][\n]+/g, "\n\n").trim();
}

function convertTextToList(text) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(
      (s) =>
        !!s &&
        !s.match(/^\s*\/\/\/*/) &&
        !s.match(/^\s*#+/) &&
        !s.match(/^\s*[*]+/)
    );
}

function convertTextToHosts(text) {
  return text
    .split("\n")
    .map((s) => s.replace(/^[0-9]+.[0-9]+.[0-9]+.[0-9]+[ ]*/, "").trim())
    .filter(
      (s) =>
        s.length > 0 &&
        s.match(/^[0-9a-zA-Z-.]+/) &&
        s.match(/^[0-9a-zA-Z-.]+/)[0] === s
    );
}

function calculatePercentage(count, total) {
  return ((count * 100) / total).toFixed(2);
}

function getRootDomainFrom(url) {
  const lastDotIndex = url.lastIndexOf(".");
  const partialUrl = url.substr(0, lastDotIndex);
  const secondLastDotIdx = partialUrl.lastIndexOf(".") || 0;

  return url.substr(secondLastDotIdx + 1);
}

function mkdir(targetPath) {
  return execBashSilent(`mkdir -p ${targetPath}`);
}

// api utils
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    var file = fs.createWriteStream(dest);
    https
      .get(url, function (response) {
        response.pipe(file);
        file.on("finish", resolve);
      })
      .on("error", reject);
  });
}

async function listRepoDir() {
  const url =
    "https://api.github.com/repos/synle/bashrc/git/trees/master?recursive=1&cacheBust=$(date +%s)";

  try {
    const json = await fetchUrlAsJson(url);
    return json.tree.map((file) => file.path);
  } catch (err) {
    console.log("      >> Error getting the file list");
    return [];
  }
}

async function getSoftwareScriptFiles() {
  const files = await listRepoDir();

  const firstFiles = convertTextToList(`
    software/scripts/_bash-rc-bootstrap.js
    software/scripts/_nvm-symlink.sh.js
  `);

  // this is a list of file to do last
  // NOTE because the update ssh causes the change in host file
  // therefore it needs to be done last
  const lastFiles = convertTextToList(`
    software/scripts/bash-syle-content.js
    software/scripts/etc-hosts.su.js
    software/scripts/vs-code-extensions.sh.js
  `);

  let softwareFiles = files.filter(
    (f) =>
      !!f.match("software/scripts/") &&
      (f.includes(".js") || f.includes(".sh")) &&
      !f.includes("config.js") &&
      firstFiles.indexOf(f) === -1 &&
      lastFiles.indexOf(f) === -1
  );
  softwareFiles = [...firstFiles, ...[...softwareFiles].sort(), ...lastFiles];

  return [...new Set(softwareFiles)].filter((file) => {
    if (is_os_android_termux) {
      if (!file.includes("software/scripts/android-termux")) {
        // when run in an android termux env, only run script in that folder
        const whitelistAndroidTermuxScripts = convertTextToList(`
            software/scripts/vim-configurations.js
            software/scripts/vim-vundle.sh
            software/scripts/tmux.js
          `);

        if (whitelistAndroidTermuxScripts.indexOf(file) === -1) {
          return false;
        }
      }
    }

    // check against only android termux
    if (
      file.includes("software/scripts/android-termux") &&
      !is_os_android_termux
    ) {
      return false;
    }

    // check against only mac or only window
    if (file.includes("software/scripts/windows") && !is_os_window) {
      return false;
    }

    // check against only mac or only window
    if (file.includes("software/scripts/mac") && !is_os_darwin_mac) {
      return false;
    }

    return true;
  });
}

async function fetchUrlAsString(url) {
  try {
    return execBash(`curl -s ${url}`);
  } catch (err) {
    return new Promise((resolve) => {
      require("https").get(url, (res) => {
        let rawData = "";
        res
          .on("data", (chunk) => (rawData += chunk))
          .on("end", () => resolve(rawData));
      });
    });
  }
}

function gitClone(repo, pwd) {
  return execBashSilent(
    `git clone --depth 1 -b master ${repo} ${pwd} &>/dev/null`
  );
}

async function fetchUrlAsJson(url) {
  const json = await fetchUrlAsString(url);
  return JSON.parse(json);
}

function execBash(cmd, options) {
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

function execBashSilent(cmd, options) {
  return new Promise((resolve) => {
    const { exec } = require("child_process");
    options = options || {};
    exec(cmd, options || {}, (error, stdout, stderr) => {
      resolve(stdout);
    });
  });
}

// console print
function echo(str) {
  return `echo '''${str}'''`;
}

function echoColor1(str) {
  return `echo -e $'\\e[31m${str}\\e[m'`;
}

function echoColor2(str) {
  return `echo -e $'\\e[32m${str}\\e[m'`;
}

function echoColor3(str) {
  return `echo -e $'\\e[33m${str}\\e[m'`;
}

function consoleLogColor1(str) {
  return str;
}

function consoleLogColor2(str) {
  return str;
}

function consoleLogColor3(str) {
  return str;
}

// script utils
function processScriptFile(file) {
  let scriptToUse;

  const url = `https://raw.githubusercontent.com/synle/bashrc/master/${file}?cacheBust=${Date.now()}`;

  function _generateScript(file, url) {
    if (file.includes(".js")) {
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
    const startScriptFilePath = "software/base-node-script.js";
    const startScriptUrl = `https://raw.githubusercontent.com/synle/bashrc/master/${startScriptFilePath}?${Date.now()}`;

    return _generateRawScript(startScriptFilePath, startScriptUrl);
  }

  function _generatePipeOutput(file, url) {
    if (file.includes(".su.sh.js")) {
      return `node | bash`;
    }
    if (file.includes(".su.js")) {
      return `sudo node`;
    }
    if (file.includes(".sh.js")) {
      return `node | bash`;
    }
    if (file.includes(".js")) {
      return `node`;
    }
    if (file.includes(".su.sh")) {
      return `sudo bash`;
    }
    if (file.includes(".sh")) {
      return `bash`;
    }
  }

  scriptToUse = _generateScript(file, url);
  const pipeOutput = _generatePipeOutput(file, url);

  console.log(`{ ${scriptToUse} ;} | ${pipeOutput}`);
}

//////////////////////////////////////////////////////
(async function () {
  // set up the flags
  // get whether or not this is ubuntu
  try {
    globalThis.is_os_ubuntu = (
      await execBash(
        `python -c """
import platform;
try:
  print(platform.linux_distribution())
except:
  print('N/A')
        """`
      )
    )
      .toLowerCase()
      .includes("ubuntu");
  } catch (err) {}

  // getting the ip address mapping
  try {
    globalThis.HOME_HOST_NAMES = JSON.parse(
      await fetchUrlAsString(
        "https://raw.githubusercontent.com/synle/bashrc/master/software/metadata/ip-address.json"
      )
    );
  } catch (err) {
    globalThis.HOME_HOST_NAMES = [];
  } finally {
    globalThis.HOME_HOST_NAMES = globalThis.HOME_HOST_NAMES.filter(
      (hostSplits) =>
        hostSplits.length === 2 &&
        hostSplits[0].length > 0 &&
        hostSplits[1].length > 0
    );
  }

  // create the sy tweak folder
  const pathsToCreateDir = [
    path.join(globalThis.BASE_SY_CUSTOM_TWEAKS_DIR, "mac"),
    path.join(globalThis.BASE_SY_CUSTOM_TWEAKS_DIR, "windows"),
  ];

  for (const aPath of pathsToCreateDir) {
    try {
      await mkdir(aPath);
    } catch (err) {}
  }

  // for debugging
  if (process.env.DEBUG) {
    process
      .on("unhandledRejection", (reason, p) => {
        console.error(reason, "Unhandled Rejection at Promise", p);
      })
      .on("uncaughtException", (err) => {
        console.error(err, "Uncaught Exception thrown");
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
    console.log("<< Error", err);
  }
})();

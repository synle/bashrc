import { beforeEach } from "vitest";
import { execSync as realExecSync } from "child_process";
import fs from "fs";
import path from "path";
import vm from "vm";

// ---- mock file system ----
export const fileSystem = {};

// ---- mock fs.existsSync tracking ----
export const mockFsExistence = {};

// ---- mock fs.readdirSync tracking ----
export const mockFsDirEntries = {};

// ---- mock child_process tracking ----
export const mockExecCommands = [];
export let mockExecSyncReturn = "";

// ---- mock process.exit tracking ----
export let processExitCalled = false;

// ---- mock network ----
export let fetchResponses = {};

// ---- load index.js functions into a sandboxed context ----
const indexSource = fs.readFileSync(path.resolve("software/index.js"), "utf-8");

// strip the IIFE entry point at the bottom so it doesn't execute
const iifeStart = indexSource.indexOf("\n(async function () {");
const librarySource = iifeStart > 0 ? indexSource.substring(0, iifeStart) : indexSource;

// replace const/let with var so declarations become sandbox properties
const varSource = librarySource.replace(/^(const|let) /gm, "var ");

// mock fs module with trackable existsSync and readdirSync
const mockFs = {
  ...fs,
  writeFileSync: (filePath, content) => {
    fileSystem[filePath] = (content || "").toString();
  },
  readFileSync: (filePath, opts) => {
    if (filePath in fileSystem) return fileSystem[filePath];
    return "";
  },
  existsSync: (targetPath) => {
    if (targetPath in mockFsExistence) return mockFsExistence[targetPath];
    return false;
  },
  readdirSync: (dirPath, opts) => {
    if (dirPath in mockFsDirEntries) return mockFsDirEntries[dirPath];
    throw new Error(`ENOENT: no such directory '${dirPath}'`);
  },
  statSync: (targetPath) => {
    if (!(targetPath in mockFsExistence)) throw new Error(`ENOENT: no such file or directory '${targetPath}'`);
    const entry = mockFsExistence[targetPath];
    const mtimeMs = typeof entry === "object" && entry.mtimeMs != null ? entry.mtimeMs : Date.now();
    const type = typeof entry === "object" ? entry.type : entry;
    return {
      isDirectory: () => type === "dir",
      isFile: () => type === "file" || type === true,
      mtimeMs,
    };
  },
  createWriteStream: () => ({ on: () => {} }),
};

// mock child_process
const mockChildProcess = {
  exec: (cmd, opts, cb) => {
    mockExecCommands.push(cmd);
    if (typeof opts === "function") {
      opts(null, mockExecSyncReturn, "");
    } else if (cb) {
      cb(null, mockExecSyncReturn, "");
    }
  },
  execSync: (cmd, opts) => {
    mockExecCommands.push(cmd);
    // Pass bash -n syntax checks through to real execSync so validation works in tests
    if (cmd.startsWith("bash -n")) {
      return realExecSync(cmd, opts);
    }
    return mockExecSyncReturn;
  },
};

// sandbox context with mocked globals
const sandbox = {
  require: (mod) => {
    const name = mod.replace(/^node:/, "");
    if (name === "fs") return mockFs;
    if (name === "path") return path;
    if (name === "os") return { homedir: () => "/mock/home" };
    if (name === "vm") return vm;
    if (name === "child_process") return mockChildProcess;
    return require(mod);
  },
  process: {
    argv: [],
    env: {
      BASH_SYLE_PATH: "/mock/home/.bash_syle",
      BASH_SYLE_COMMON_PATH: "/mock/home/.bash_syle_common",
      BASH_PROFILE_CODE_REPO_RAW_URL: "https://api.github.com/repos/test/bashrc/contents/",
      REPO_PATH_IDENTIFIER: "test/bashrc",
      REPO_BRANCH_NAME: "master",
      NODE_JS_VERSION: "20",
      FNM_DIR: "/mock/home/.fnm",
      FNM_DEFAULT_NODE_PATH: "/mock/home/.fnm/node",
      LINE_BREAK_COUNT: "80",
      LIMITED_SUPPORT_OSES: "is_os_android_termux,is_os_mingw64",
    },
    exit: () => {
      processExitCalled = true;
    },
    on: () => {},
  },
  console,
  setTimeout,
  setInterval,
  clearTimeout,
  clearInterval,
  Buffer,
  global: {},
  globalThis: {},
};

// pre-seed so IS_LOCAL_REPO detects a local repo during sandbox init
mockFsExistence["software/index.js"] = true;

vm.runInNewContext(varSource, sandbox, { filename: "software/index.js" });

// override I/O and network functions with our mocks
sandbox.readText = async (strings, ...values) => {
  const target = sandbox.text(strings, ...values).trim();
  // check fileSystem first (absolute paths), then fetchResponses (repo-relative/URLs)
  if (target in fileSystem) return fileSystem[target] || "";
  return fetchResponses[target] || "";
};
sandbox._readTextFromFile = async (filePath) => (fileSystem[filePath] || "").trim();
sandbox.writeText = (filePath, text) => {
  fileSystem[filePath] = (text || "").trim();
};
sandbox.readJson = async (strings, ...values) => {
  const target = sandbox.text(strings, ...values).trim();
  if (target in fileSystem) return sandbox.parseJsonWithComments(fileSystem[target] || "{}");
  return JSON.parse(fetchResponses[target] || "{}");
};
sandbox.log = () => {};
sandbox.echo = () => {};

/** Access any function or constant defined in index.js by name */
export function getIndexFunction(name) {
  return sandbox[name];
}

/** Access any constant defined in index.js by name */
export function getIndexConstant(name) {
  return sandbox[name];
}

/** Set a global flag on the sandbox (e.g. OS flags) */
export function setSandboxGlobal(name, value) {
  sandbox.global[name] = value;
  sandbox[name] = value;
}

/** Set the mock return value for execSync calls */
export function setMockExecSyncReturn(value) {
  mockExecSyncReturn = value;
}

/** Get the sandbox's process object for direct manipulation */
export function getSandboxProcess() {
  return sandbox.process;
}

/**
 * Run a script file's doWork() in the sandbox context.
 * Loads the script source, expands SOURCE markers, executes it to define doWork(), then calls it.
 * @param {string} scriptPath - Relative path from repo root (e.g. "software/scripts/fzf.js")
 * @returns {Promise<void>}
 */
export async function runScript(scriptPath) {
  let scriptSource = fs.readFileSync(path.resolve(scriptPath), "utf-8");
  // Expand SOURCE markers by inlining the referenced file content
  scriptSource = scriptSource.replace(/^\/\/ SOURCE\s+(\S+\/\S+)\s*$/gm, (_, srcFile) => {
    return fs.readFileSync(path.resolve(srcFile), "utf-8");
  });
  const varScript = scriptSource.replace(/^(const|let) /gm, "var ");
  vm.runInNewContext(varScript, sandbox, { filename: scriptPath });
  await sandbox.doWork();
  await sandbox.flushProfileBlocks();
}

// ---- auto-reset between tests ----
beforeEach(() => {
  for (const key of Object.keys(fileSystem)) {
    delete fileSystem[key];
  }
  for (const key of Object.keys(mockFsExistence)) {
    delete mockFsExistence[key];
  }
  for (const key of Object.keys(mockFsDirEntries)) {
    delete mockFsDirEntries[key];
  }
  mockExecCommands.length = 0;
  mockExecSyncReturn = "";
  processExitCalled = false;
  sandbox._profileBlockBuffer.clear();
  fetchResponses = {};
  fetchResponses["software/scripts/advanced/bash-autocomplete-complete-spec-skeleton.bash"] = fs.readFileSync(
    path.resolve("software/scripts/advanced/bash-autocomplete-complete-spec-skeleton.bash"),
    "utf-8",
  );
});

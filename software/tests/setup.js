import { beforeEach } from "vitest";
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
  statSync: (targetPath) => ({
    isDirectory: () => mockFsExistence[targetPath] === "dir",
    isFile: () => mockFsExistence[targetPath] === "file" || mockFsExistence[targetPath] === true,
  }),
  createWriteStream: () => ({ on: () => {} }),
};

// mock child_process
const mockChildProcess = {
  exec: (cmd, opts, cb) => {
    mockExecCommands.push(cmd);
    if (typeof opts === "function") {
      opts(null, "", "");
    } else if (cb) {
      cb(null, "", "");
    }
  },
  execSync: (cmd) => {
    mockExecCommands.push(cmd);
    return mockExecSyncReturn;
  },
};

// sandbox context with mocked globals
const sandbox = {
  require: (mod) => {
    if (mod === "fs") return mockFs;
    if (mod === "path") return path;
    if (mod === "os") return { homedir: () => "/mock/home" };
    if (mod === "https") return { get: () => ({ on: () => {} }) };
    if (mod === "http") return {};
    if (mod === "child_process") return mockChildProcess;
    return require(mod);
  },
  process: {
    argv: [],
    env: {
      BASH_SYLE_PATH: "/mock/home/.bash_syle",
      BASH_SYLE_AUTOCOMPLETE_PATH: "/mock/home/.bash_syle_autocomplete",
      BASH_SYLE_COMMON_PATH: "/mock/home/.bash_syle_common",
      BASH_PROFILE_CODE_REPO_RAW_URL: "https://raw.githubusercontent.com/test/bashrc/master/",
      BASH_SYLE_COMMON: "/mock/home/.bash_syle_common",
      REPO_PATH_IDENTIFIER: "test/bashrc",
      REPO_BRANCH_NAME: "master",
      NODE_JS_VERSION: "20",
      FNM_DIR: "/mock/home/.fnm",
      FNM_DEFAULT_NODE_PATH: "/mock/home/.fnm/node",
      LINE_BREAK_COUNT: "80",
      IS_TEST_SCRIPT_MODE: "true",
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

vm.runInNewContext(varSource, sandbox, { filename: "software/index.js" });

// override I/O and network functions with our mocks
sandbox.readText = (filePath) => fileSystem[filePath] || "";
sandbox.writeText = (filePath, text) => {
  fileSystem[filePath] = (text || "").trim();
};
sandbox.fetchUrlAsString = async (url) => fetchResponses[url] || "";
sandbox.fetchUrlAsJson = async (url) => JSON.parse(fetchResponses[url] || "{}");
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

/** Get the sandbox's process object for direct manipulation */
export function getSandboxProcess() {
  return sandbox.process;
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
  fetchResponses = {};
});

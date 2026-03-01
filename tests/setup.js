import { beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";

// ---- mock file system ----
export const fileSystem = {};

// ---- mock network ----
export let fetchResponses = {};

// ---- load index.js functions into a sandboxed context ----
const indexSource = fs.readFileSync(path.resolve("software/index.js"), "utf-8");

// strip the IIFE bootstrap at the bottom so it doesn't execute
const iifeStart = indexSource.indexOf("\n(async function () {");
const librarySource = iifeStart > 0 ? indexSource.substring(0, iifeStart) : indexSource;

// replace const/let with var so declarations become sandbox properties
const varSource = librarySource.replace(/^(const|let) /gm, "var ");

// sandbox context with mocked globals
const sandbox = {
  require: (mod) => {
    if (mod === "fs") return { ...fs, writeFileSync: () => {}, readFileSync: () => "" };
    if (mod === "path") return path;
    if (mod === "os") return { homedir: () => "/mock/home" };
    if (mod === "https") return {};
    if (mod === "http") return {};
    if (mod === "child_process") return { exec: () => {}, execSync: () => "" };
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
    exit: () => {},
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

// ---- auto-reset between tests ----
beforeEach(() => {
  for (const key of Object.keys(fileSystem)) {
    delete fileSystem[key];
  }
  fetchResponses = {};
});

import { beforeEach } from "vitest";
import { execSync as realExecSync } from "child_process";
import fs from "fs";
import path from "path";
import vm from "vm";
import { createInstrumenter } from "istanbul-lib-instrument";

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
/**
 * Absolute path of the index.js library being loaded into the sandbox.
 * Used both for the istanbul instrumentation path key and (later) to mark this file
 * as already-covered so vitest's istanbul provider does not double-count it as untested.
 */
const INDEX_JS_PATH = path.resolve("software/index.js");
const indexSource = fs.readFileSync(INDEX_JS_PATH, "utf-8");

// strip the IIFE entry point at the bottom so it doesn't execute
const iifeStart = indexSource.indexOf("\n(async function () {");
const librarySource = iifeStart > 0 ? indexSource.substring(0, iifeStart) : indexSource;

// replace const/let with var so declarations become sandbox properties
const varSource = librarySource.replace(/^(const|let) /gm, "var ");

/**
 * Instrument the library source with istanbul whenever we're running under vitest.
 *
 * Vitest's v8/istanbul providers cannot reach code that runs inside `vm.runInNewContext`
 * because their instrumentation hooks attach to Vite's transform pipeline, not to bytes
 * fed straight to `vm`. We manually instrument the source string with the same coverage
 * variable that vitest's istanbul provider reads (`globalThis.__VITEST_COVERAGE__`) and
 * pre-seed that object on the sandbox so the instrumented code writes into the SAME
 * reference the test process exposes. Both sandbox and host then share one counter map.
 *
 * We always instrument under vitest (rather than gating on `--coverage`) because vitest
 * exposes no public worker-side signal for "coverage is enabled". The cost is a single
 * parse + transform of `software/index.js` per worker (~50-100ms), which is negligible
 * compared to the 1400+ tests this setup file runs. Counters are simply discarded when
 * `--coverage` is off (the provider never reads them).
 *
 * @returns {string} The (instrumented) library source to feed into the vm.
 */
function instrumentSource() {
  if (process.env.VITEST !== "true" && typeof globalThis.__VITEST_COVERAGE__ === "undefined") {
    // Defensive escape hatch for any non-vitest direct execution of setup.js.
    return varSource;
  }
  const instrumenter = createInstrumenter({
    coverageVariable: "__VITEST_COVERAGE__",
    coverageGlobalScope: "globalThis",
    esModules: false,
    produceSourceMap: false,
  });
  return instrumenter.instrumentSync(varSource, INDEX_JS_PATH);
}
const sandboxSource = instrumentSource();

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
      BASH_PROFILE_CODE_REPO_RAW_URL: "https://github.com/test/bashrc/blob/HEAD/",
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
  // Intentionally NOT shadowing `globalThis` — istanbul's instrumented preludes write
  // counters to `globalThis[__VITEST_COVERAGE__]`, which (in a vm context) resolves to
  // the contextified sandbox. Shadowing `globalThis` here with `{}` would break that
  // path: instrumented code would read/write a property on the shadow object instead
  // of the real sandbox, and the host process's coverage map would stay empty.
};

// pre-seed so IS_LOCAL_REPO detects a local repo during sandbox init
mockFsExistence["software/index.js"] = true;

// Share the host's __VITEST_COVERAGE__ object with the sandbox so istanbul counters
// written by the instrumented index.js land in the same map vitest's istanbul provider
// reads via `takeCoverage()`. The instrumented code emits
// `var coverage = globalThis.__VITEST_COVERAGE__ || (globalThis.__VITEST_COVERAGE__ = {})`;
// because `globalThis` inside a vm context IS the sandbox, pre-seeding the same object
// reference on both sides keeps counter writes in one map. When `--coverage` is off,
// vitest never reads the global, so the seeded object is just garbage-collected.
globalThis.__VITEST_COVERAGE__ = globalThis.__VITEST_COVERAGE__ || {};
sandbox.__VITEST_COVERAGE__ = globalThis.__VITEST_COVERAGE__;

vm.runInNewContext(sandboxSource, sandbox, { filename: INDEX_JS_PATH });

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
  try {
    if (target in fileSystem) return sandbox.parseJsonWithComments(fileSystem[target] || "{}");
    return JSON.parse(fetchResponses[target] || "{}");
  } catch (e) {
    return {};
  }
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

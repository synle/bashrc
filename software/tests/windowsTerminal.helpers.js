/** Isolated Windows installer consumers shared by snapshot-focused integration specs. */
import fs from "fs";
import path from "path";
import vm from "vm";
import { createRequire } from "module";
import { vi } from "vitest";
import { getIndexFunction, readSyThemeFixture } from "./setup.js";

/**
 * Execute the installer with owned IO boundaries and return serialized settings output.
 * @param {object} oldSettings Existing user settings.
 * @param {string[]} binaries Available executable names.
 * @param {string|null} executable Discovered Windows PowerShell executable path.
 * @param {boolean} windows Whether to exercise Windows deployment rather than portable CI output.
 * @returns {Promise<object>} Settings serialized by the real installer; no disk writes occur.
 */
export async function generateSettings(oldSettings = {}, binaries = [], executable = null, windows = true) {
  let written;
  let artifact;
  const sandbox = {
    IS_CI: true,
    IS_DRY_RUN: false,
    fs: { statSync: () => ({ size: 1024 }) },
    pathExists: () => true,
    is_os_windows: windows,
    BUILD_DIR: ".build",
    EDITOR_CONFIGS: {},
    path,
    log: () => {},
    getTheme: () => ({ dark: "Campbell", light: "Campbell" }),
    json: getIndexFunction("json"),
    readSyTheme: readSyThemeFixture,
    readJson: async (strings) => (strings[0].includes("windows-terminal-keys") ? [] : structuredClone(oldSettings)),
    getWindowUserBaseDir: () => "/mnt/c/Users/test",
    findPathFromList: () => executable,
    findPath: () => "/mnt/c/Users/test/AppData/Local/Packages/Terminal",
    toWindowsPath: getIndexFunction("toWindowsPath"),
    downloadAsset: async () => {},
    hasBinary: (name) => binaries.includes(name),
    exitIfPathNotFound: () => {},
    backupConfigFile: async () => {},
    writeBuildArtifact: async ([entry]) => {
      artifact = JSON.parse(JSON.stringify(entry.data));
    },
    writeJson: async (_target, settings) => {
      written = JSON.parse(JSON.stringify(settings));
    },
  };
  let source = fs.readFileSync("software/scripts/windows-terminal.js", "utf8");
  if (process.env.BASHRC_TEST_COVERAGE === "1") {
    const { createInstrumenter } = createRequire(import.meta.url)("istanbul-lib-instrument");
    source = createInstrumenter({ coverageVariable: "__VITEST_COVERAGE__", coverageGlobalScope: "globalThis" }).instrumentSync(
      source,
      path.resolve("software/scripts/windows-terminal.js"),
    );
    sandbox.__VITEST_COVERAGE__ = globalThis.__VITEST_COVERAGE__;
  }
  vm.runInNewContext(source, sandbox);
  await sandbox.doWork();
  return windows ? written : artifact;
}

/**
 * Generate serialized Terminal settings through the real installer with isolated IO.
 * @param {object} oldSettings Existing user settings; left unchanged.
 * @param {boolean} windows Whether to return Windows deployment instead of portable CI output.
 * @param {object} overrides Owned IO boundaries to replace for download and failure scenarios.
 * @returns {Promise<object>} Serialized installer output without filesystem writes.
 */
export async function generateAppearance(oldSettings = {}, windows = true, overrides = {}) {
  let written;
  let artifact;
  const sandbox = {
    IS_CI: true,
    IS_DRY_RUN: false,
    fs: { statSync: () => ({ size: 1024 }) },
    pathExists: () => true,
    is_os_windows: windows,
    BUILD_DIR: ".build",
    EDITOR_CONFIGS: { fontFamily: "Fixture Mono", fontSize: 16, fontWeightKeyword: "normal", terminalScrollback: 5000 },
    path,
    log: () => {},
    getTheme: () => ({ dark: "Campbell", light: "Campbell" }),
    json: getIndexFunction("json"),
    readSyTheme: readSyThemeFixture,
    readJson: async (strings) => (strings[0].includes("windows-terminal-keys") ? [] : structuredClone(oldSettings)),
    getWindowUserBaseDir: () => "/mnt/c/Users/Test User",
    findPathFromList: () => null,
    findPath: () => "/mnt/c/Users/Test User/AppData/Local/Packages/Terminal",
    hasBinary: (name) => name === "pwsh.exe",
    toWindowsPath: getIndexFunction("toWindowsPath"),
    downloadAsset: async () => {},
    exitIfPathNotFound: () => {},
    backupConfigFile: async () => {},
    writeBuildArtifact: async ([entry]) => {
      artifact = JSON.parse(JSON.stringify(entry.data));
    },
    writeJson: async (_target, settings) => {
      written = JSON.parse(JSON.stringify(settings));
    },
    ...overrides,
  };
  let source = fs.readFileSync("software/scripts/windows-terminal.js", "utf8");
  if (process.env.BASHRC_TEST_COVERAGE === "1") {
    const { createInstrumenter } = createRequire(import.meta.url)("istanbul-lib-instrument");
    source = createInstrumenter({ coverageVariable: "__VITEST_COVERAGE__", coverageGlobalScope: "globalThis" }).instrumentSync(
      source,
      path.resolve("software/scripts/windows-terminal.js"),
    );
    sandbox.__VITEST_COVERAGE__ = globalThis.__VITEST_COVERAGE__;
  }
  vm.runInNewContext(source, sandbox);
  await sandbox.doWork();
  return windows ? written : artifact;
}

/** Windows home fixture deliberately includes a space. @type {string} */
export const WINDOWS_HOME = "/mnt/c/Users/Test User";

/**
 * Load a real installer with isolated side effects and optional Istanbul instrumentation.
 * @param {string} file Repository-relative installer path.
 * @param {object} overrides Boundary replacements for this scenario.
 * @returns {object} VM context exposing the real doWork and recorded effects.
 */
export function loadInstaller(file, overrides = {}) {
  const context = {
    path,
    fs: { statSync: () => ({ size: 1024 }) },
    Buffer,
    IS_CI: false,
    IS_DRY_RUN: false,
    is_os_windows: true,
    BASE_HOMEDIR_LINUX: "/home/test",
    BUILD_DIR: "/build",
    POWERSHELL_SYLE_PATH: "/working/profile.ps1",
    EDITOR_CONFIGS: { fontSize: 12 },
    log: vi.fn(),
    shouldInstallCustomTheme: () => false,
    getTheme: () => ({ dark: "Campbell", light: "One Half Light" }),
    json: getIndexFunction("json"),
    readSyTheme: readSyThemeFixture,
    code: getIndexFunction("code"),
    getWindowUserBaseDir: () => WINDOWS_HOME,
    getWindowAppDataLocalUserPath: () => `${WINDOWS_HOME}/AppData/Local`,
    toWindowsPath: getIndexFunction("toWindowsPath"),
    findPath: () => `${WINDOWS_HOME}/AppData/Local/Packages/Microsoft.WindowsTerminal_test`,
    findPathFromList: () => null,
    hasBinary: () => false,
    pathExists: () => true,
    exitIfPathNotFound: vi.fn(),
    readJson: async () => [],
    readText: async (strings) =>
      strings[0].includes("starship-config.toml")
        ? fs.readFileSync("software/scripts/advanced/starship-config.toml", "utf8")
        : "# profile fixture\nWrite-Output 'ready'\n",
    execBash: vi.fn(async () => "E:\\Documents\r\n"),
    execBashSync: vi.fn(() => ""),
    removeEmptyBlocks: (value) => value,
    cleanupExtraWhitespaces: (value) => value,
    mkdir: vi.fn(),
    backupConfigFile: vi.fn(),
    downloadAsset: vi.fn(),
    writeText: vi.fn(),
    writeJson: vi.fn(),
    writeBuildArtifact: vi.fn(),
    registerWithBashSyleProfile: vi.fn(),
    deleteFile: vi.fn(),
    ...overrides,
  };
  let source = fs.readFileSync(file, "utf8");
  if (process.env.BASHRC_TEST_COVERAGE === "1") {
    const { createInstrumenter } = createRequire(import.meta.url)("istanbul-lib-instrument");
    source = createInstrumenter({ coverageVariable: "__VITEST_COVERAGE__", coverageGlobalScope: "globalThis" }).instrumentSync(
      source,
      path.resolve(file),
    );
    context.__VITEST_COVERAGE__ = globalThis.__VITEST_COVERAGE__;
  }
  vm.createContext(context);
  vm.runInContext(source, context, { filename: file });
  return context;
}

/**
 * Run the Terminal installer against realistic existing settings.
 * @param {object[]} profiles Existing Terminal profiles.
 * @param {object} overrides Installer boundary replacements.
 * @returns {Promise<object>} Context and generated settings.
 */
export async function configureTerminal(profiles, overrides = {}) {
  const context = loadInstaller("software/scripts/windows-terminal.js", {
    readJson: async (strings) => (strings[0].includes("keys.jsonc") ? [] : { profiles: { list: profiles } }),
    ...overrides,
  });
  await context.doWork();
  return { context, settings: context.writeJson.mock.calls[0]?.[1] };
}

/**
 * Type declarations for globals injected by software/base-node-script.js
 *
 * base-node-script.js is prepended to all scripts in software/scripts/ at runtime
 * via pipe concatenation. These declarations provide IDE intellisense without
 * changing the execution model.
 */

// Node built-in modules assigned to globalThis
declare var fs: typeof import('fs');
declare var path: typeof import('path');
declare var https: typeof import('https');
declare var http: typeof import('http');

// Path constants
declare var BASE_HOMEDIR_LINUX: string;
declare var BASE_BASH_SYLE: string;
declare var BASE_MOUNT_DIR_WINDOW: string;
declare var BASE_C_DIR_WINDOW: string;
declare var BASE_D_DIR_WINDOW: string;
declare var BASE_WINDOW: string;
declare var BASE_WINDOW_1: string;
declare var BASE_WINDOW_2: string;

// NVM / Node version
declare var DEFAULT_NVM_NODE_VERSION: number;
declare var nvmBasePath: string;
declare var nvmDefaultNodePath: string | null;

// Editor config
declare var EDITOR_CONFIGS: {
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  maxLineSize: number;
  ignoredFiles: string[];
  ignoredFolders: string[];
};

// Host config
declare var HOME_HOST_NAMES: any[];

// OS flags (set from environment variables)
declare var is_os_window: boolean;
declare var is_os_darwin_mac: boolean;
declare var is_os_arch_linux: boolean;
declare var is_os_android_termux: boolean;
declare var is_os_chromeos: boolean;

// Misc globals
declare var BASE_SY_CUSTOM_TWEAKS_DIR: string;
declare var DEBUG_WRITE_TO_DIR: string;
declare var REPO_PREFIX_URL: string;

// Directory search utilities
declare function findDirList(srcDir: string, targetMatch: RegExp, returnFirstMatch?: boolean): string[] | string | null;
declare function findDirSingle(srcDir: string, targetMatch: RegExp): string | null;
declare function findFirstDirFromList(findProps: [string, RegExp][]): string | undefined;
declare function findFileRecursive(srcDir: string, targetMatch: RegExp): string | null;

// File I/O utilities
declare function writeText(aDir: string, text: string, override?: boolean, suppressError?: boolean): void;
declare function touchFile(aDir: string, defaultContent?: string): void;
declare function backupText(aDir: string, text: string): void;
declare function writeJson(aDir: string, json: any, comments?: string): void;
declare function writeToBuildFile(
  tasks:
    | { file: string; data?: any; isJson?: boolean; comments?: string }[]
    | { file: string; data?: any; isJson?: boolean; comments?: string },
): void;
declare function appendText(aDir: string, text: string): void;
declare function replaceTextLineByLine(aDir: string, replacements: [RegExp, string][], makeAdditionalBackup?: boolean): void;
declare function writeJsonWithMerge(aDir: string, json: object): void;
declare function readJson(aDir: string): any;
declare function readText(aDir: string): string;
declare function parseJsonWithComments(oldText: string): any;
declare function clone(obj: any): any;

// Platform-specific path utilities
declare function getWindowUserBaseDir(): string | undefined;
declare function filePathExist(targetPath: string): boolean;
declare function getWindowsApplicationBinaryDir(applicationName?: string): Promise<string>;
declare function getWindowAppDataRoamingUserPath(): string;
declare function getWindowAppDataLocalUserPath(): string;
declare function getOsxApplicationSupportCodeUserPath(): string;

// Text processing utilities
declare function updateTextBlock(
  resultTextContent: string,
  configKey: string,
  configValue: string,
  commentPrefix: string,
  isPrepend: boolean,
): string;
declare function appendTextBlock(resultTextContent: string, configKey: string, configValue: string, commentPrefix?: string): string;
declare function prependTextBlock(resultTextContent: string, configKey: string, configValue: string, commentPrefix?: string): string;
declare function registerWithBashSyle(configKey: string, content: string): void;
declare function registerPlatformTweaks(platformName: string, fileName: string, content: string, sourceOverride?: string): void;
declare function exitIfPathNotFound(targetPath: string, message?: string): void;
declare function downloadWindowsApp(applicationName: string, findFilter: (s: string) => boolean): Promise<void>;
declare function resolveOsKey(keys: { windows: string; mac: string; linux: string }): string;
declare function cleanupExtraWhitespaces(s: string): string;
declare function convertTextToList(...texts: string[]): string[];
declare function convertTextToHosts(...texts: string[]): string[];
declare function trimLeftSpaces(text: string, spaceToTrim?: number): string;
declare function calculatePercentage(count: number, total: number): string;
declare function getRootDomainFrom(url: string): string;
declare function mkdir(targetPath: string): Promise<string>;

// Network / API utilities
declare function downloadFile(url: string, destination: string): Promise<boolean>;
declare function downloadFilesFromMainRepo(findHandler: (s: string) => boolean, destinationBaseDir: string): Promise<string[]>;
declare function listRepoDir(): Promise<string[]>;
declare function getAllRepoSoftwareFiles(): Promise<string[]>;
declare function getSoftwareScriptFiles(options?: {
  skipOsFiltering?: boolean;
  useLocalFiles?: boolean;
  useFallback?: boolean;
}): Promise<string[]>;
declare function getFullUrl(url: string): string;
declare function fetchUrlAsString(url: string): Promise<string>;
declare function gitClone(repo: string, pwd: string): Promise<string>;
declare function fetchUrlAsJson(url: string): Promise<any>;

// Bash execution
declare function execBash(cmd: string, options?: object): Promise<string>;
declare function execBashSilent(cmd: string, options?: object): Promise<string>;

// Console colors & output
declare function echo(str: string): string;
declare function echoColor(str: string, color: string): string;
declare function consoleLogColor(str: string, color: string): string;

// Generated color helpers (1-4)
declare function echoColor1(str: string): string;
declare function echoColor2(str: string): string;
declare function echoColor3(str: string): string;
declare function echoColor4(str: string): string;
declare function consoleLogColor1(str: string): string;
declare function consoleLogColor2(str: string): string;
declare function consoleLogColor3(str: string): string;
declare function consoleLogColor4(str: string): string;

// Script processing
declare function processScriptFile(file: string, originalFile: string, allRepoFiles: string[]): void;
declare function includeSource(file: string): Promise<void>;
declare function printOsFlags(): void;
declare function printScriptsToRun(scriptsToRun: string[]): void;
declare function printSectionBlock(header: string, lines?: string[]): void;
declare function printScriptProcessingResults(
  results: Array<{ file: string; path: string; script: string; status: string; description: string }>,
): void;

// Entry point hooks — scripts define these and base-node-script.js calls them
declare function doInit(): Promise<void>;
declare function doWork(): Promise<void>;

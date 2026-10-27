/** Isolated filesystem and VM fixtures for shared work-instruction deployment. */
import fs from "fs";
import path from "path";
import vm from "vm";
import { expandSourceMarkers, getIndexFunction } from "./setup.js";

/** Repository-owned shared deployment source. */
export const COMMON_PATH = "software/scripts/advanced/llm/llm-common.js";

/**
 * Loads real deployment helpers against a private home without running installers.
 * @param {string} home - Existing isolated home folder.
 * @param {object} [filesystem=fs] - Filesystem boundary used by the deployment code.
 * @returns {object} VM context exposing shared and optional client functions.
 */
export function loadWorkInstructions(home, filesystem = fs) {
  /** Globals required by shared source; client writes stay inside the fixture home. */
  const sandbox = {
    fs: filesystem,
    path,
    BASE_HOMEDIR_LINUX: home,
    SY_ROOT_FOLDER: path.join(home, "_extra"),
    process: { env: { LLM_ROOT_FOLDER: path.join(home, "_extra/ai_llm") } },
    log: () => {},
    is_os_mac: 0,
    readJson: () => ({}),
    readText: async () => "",
    resolvePlaceholders: getIndexFunction("resolvePlaceholders"),
    replaceBlock: getIndexFunction("replaceBlock"),
    removeBlock: getIndexFunction("removeBlock"),
    getOllamaHosts: async () => [],
    backupConfigFile: async () => {},
    mkdir: async (folder) => fs.mkdirSync(folder, { recursive: true }),
    writeText: async (file, content) => fs.writeFileSync(file, content),
    safeSymlink: (target, link) => fs.symlinkSync(target, link),
  };
  vm.createContext(sandbox);
  vm.runInContext(expandSourceMarkers(fs.readFileSync(COMMON_PATH, "utf8")), sandbox, { filename: COMMON_PATH });
  return sandbox;
}

/**
 * Loads one client's real instruction writer without executing its setup entry point.
 * @param {object} sandbox - Shared deployment context.
 * @param {string} client - Client setup folder name.
 * @returns {void} Defines client functions in the existing context.
 */
export function loadInstructionClient(sandbox, client) {
  /** SOURCE comments remain inert because shared helpers already exist in this VM. */
  const sourcePath = `software/scripts/advanced/llm/${client}/setup.js`;
  vm.runInContext(fs.readFileSync(sourcePath, "utf8"), sandbox, { filename: sourcePath });
}

/** Tests for zed.js helpers (keymap resolution, terminal-context mirroring). */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";
import { getIndexFunction, expandSourceMarkers } from "./setup.js";

const clone = getIndexFunction("clone");

// ---- Load zed.js (with every SOURCE marker — editor.common.js + llm-common.js — inlined) ----
const zedRaw = fs.readFileSync("software/scripts/advanced/zed.js", "utf-8");
const zedSource = expandSourceMarkers(zedRaw);

/**
 * Evaluates zed.js with mocked globals so its internal helpers are reachable.
 * @param {object} [overrides] - Sandbox overrides (e.g. is_os_mac).
 * @returns {object} Sandbox containing the loaded module's top-level declarations.
 */
function loadZed(overrides = {}) {
  const sandbox = {
    is_os_mac: false,
    is_os_windows: false,
    is_os_ubuntu: false,
    is_os_arch_linux: false,
    is_os_redhat: false,
    is_os_steamos: false,
    is_os_chromeos: false,
    // Defaults to the custom-theme path (GUI present, no opt-out) so settings assertions
    // below see `Sy Dark` / `Sy Light`. Override is_gui to exercise the fallback.
    is_gui: 1,
    parseBoolean: (v) => String(v ?? "").toLowerCase() === "true" || Number.parseInt(v, 10) === 1,
    getRuntimeOption: (_key, parser) => (parser ? parser("") : ""),
    clone,
    // llm-common.js (SOURCEd in) derives the LLM home from LLM_ROOT_FOLDER.
    process: { env: { HOME: "/mock/home", LLM_ROOT_FOLDER: "/mock/home/sy/ai_llm" } },
    fs: { existsSync: () => false },
    path: { join: (...args) => args.join("/"), resolve: (p) => p },
    findPath: () => null,
    log: () => {},
    pathExists: () => false,
    getWindowAppDataRoamingUserPath: () => null,
    getOsxApplicationSupportCodeUserPath: () => "/mock/home/Library/Application Support",
    BASE_HOMEDIR_LINUX: "/mock/home",
    SY_ROOT_FOLDER: "/mock/home/sy",
    EDITOR_CONFIGS: {
      fontFamily: "FiraCode",
      fontFamilyDefaultFallback: "monospace",
      fontSize: 14,
      fontSizeDefaultFallback: 13,
      fontWeightNumber: 400,
      tabSize: 2,
      maxLineSize: 120,
      terminalScrollback: 200000,
      ignoredFiles: [],
      ignoredFolders: [],
    },
    BUILD_DIR: ".build",
    backupConfigFile: async () => {},
    writeJson: async () => {},
    readJson: async () => ({}),
    writeBuildArtifact: async () => {},
    // llm-common.js helpers — inlined via SOURCE; mock the ip-address.config lookup so the
    // sourced module's top-level evaluation doesn't try to hit the real filesystem.
    // 192.0.2.45 is RFC 5737 TEST-NET-1 (documentation range) — the real address is declared
    // only in software/metadata/ip-address.config, never in code or tests.
    getOllamaHosts: async () => [
      { ip: "192.0.2.45", hostname: "my-desktop", tags: ["OLLAMA_REMOTE"], isDefault: true, isLocal: false },
      { ip: "127.0.0.1", hostname: "local", tags: [], isDefault: false, isLocal: true },
    ],
    getHomeIpAddress: async () => null,
    ...overrides,
  };
  vm.runInNewContext(zedSource.replace(/^(const|let) /gm, "var "), sandbox);
  return sandbox;
}

// ---- _getZedKeymap: OS_KEY substitution ----

describe("getAcpAgentInputs > binary resolution", () => {
  /**
   * Loads zed.js with a `type -P` stub so ACP discovery is deterministic.
   * @param {Record<string, string>} resolved - Map of binary name -> path `type -P` should report. Missing keys resolve to "".
   * @returns {object} The loaded sandbox.
   */
  function loadZedWithBinaries(resolved) {
    return loadZed({
      execBash: async (cmd) => {
        const match = cmd.match(/type -P (\S+)/);
        return (match && resolved[match[1]]) || "";
      },
    });
  }

  it("returns every installed agent with its absolute path attached", async () => {
    const zed = loadZedWithBinaries({
      claude: "/mock/home/.local/bin/claude",
      opencode: "/mock/home/.local/bin/opencode",
      copilot: "/mock/home/.local/bin/copilot",
    });
    const agents = await zed.getAcpAgentInputs();
    expect(agents.map((a) => a.id)).toEqual(["claude", "opencode", "copilot"]);
    expect(agents.find((a) => a.id === "opencode").binaryPath).toBe("/mock/home/.local/bin/opencode");
  });

  it("drops agents whose CLI is not installed", async () => {
    const zed = loadZedWithBinaries({ opencode: "/mock/home/.local/bin/opencode" });
    const agents = await zed.getAcpAgentInputs();
    expect(agents.map((a) => a.id)).toEqual(["opencode"]);
  });

  it("rejects a /tmp/ hit so a bootstrap copy never gets baked into settings.json", async () => {
    const zed = loadZedWithBinaries({ claude: "/tmp/bootstrap/bin/claude" });
    const agents = await zed.getAcpAgentInputs();
    expect(agents).toEqual([]);
  });

  it("returns an empty array when nothing is installed", async () => {
    const zed = loadZedWithBinaries({});
    expect(await zed.getAcpAgentInputs()).toEqual([]);
  });
});

// ---- Theme contrast: zed-color-{dark,light}.jsonc ----
//
// Zed paints text ON every `*.background` / fill key, so a fill that matches its own foreground
// (or a border color reused as a fill) renders invisible text. These checks flatten each fill
// against the editor background and assert the text drawn on it stays legible.


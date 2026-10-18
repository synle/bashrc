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

describe("_getZedSettings > agent merge", () => {
  it("should preserve baseConfig.agent.* keys when merging in default_model", () => {
    const zed = loadZed();
    const baseConfig = {
      agent: {
        dock: "right",
        tool_permissions: { default: "allow" },
        always_allow_tool_actions: true,
      },
    };
    const result = zed._getZedSettings(baseConfig, {
      is_prebuilt_config: false,
      defaultModel: { provider: "ollama", model: "qwen3.6:latest" },
    });
    expect(result.agent).toEqual({
      dock: "right",
      tool_permissions: { default: "allow" },
      always_allow_tool_actions: true,
      default_model: { provider: "ollama", model: "qwen3.6:latest" },
    });
  });

  it("should not include language_models when languageModels option is omitted (CI prebuilt artifacts)", () => {
    const zed = loadZed();
    const result = zed._getZedSettings({}, { is_prebuilt_config: true });
    expect(result.language_models).toBeUndefined();
  });

  it("should include language_models when languageModels option is provided (local install)", () => {
    const zed = loadZed();
    const result = zed._getZedSettings(
      {},
      {
        is_prebuilt_config: false,
        languageModels: { ollama: { api_url: "http://127.0.0.1:11434", auto_discover: true } },
      },
    );
    expect(result.language_models).toEqual({ ollama: { api_url: "http://127.0.0.1:11434", auto_discover: true } });
  });

  it("should leave agent untouched when defaultModel is null", () => {
    const zed = loadZed();
    const baseConfig = { agent: { dock: "right" } };
    const result = zed._getZedSettings(baseConfig, { is_prebuilt_config: false, defaultModel: null });
    expect(result.agent).toEqual({ dock: "right" });
    expect(result.agent.default_model).toBeUndefined();
  });

  // Symmetric pair: edit_predictions mirrors the language_models behavior above —
  // omitted when discovery returns null, present verbatim when getAutocompleteProvider()
  // resolved a host+model. Note the null path does NOT hand Zed back to its cloud Zeta
  // default: zed-config.jsonc's `disabled_globs: ["**/*"]` survives from baseConfig
  // (asserted by the third case below).
  it("should not include edit_predictions when editPredictions option is omitted", () => {
    const zed = loadZed();
    const result = zed._getZedSettings({}, { is_prebuilt_config: false });
    expect(result.edit_predictions).toBeUndefined();
  });

  it("should preserve the baseConfig disabled_globs fallback when editPredictions is null", () => {
    const zed = loadZed();
    const baseConfig = { edit_predictions: { disabled_globs: ["**/*"] } };
    const result = zed._getZedSettings(baseConfig, { is_prebuilt_config: false, editPredictions: null });
    expect(result.edit_predictions).toEqual({ disabled_globs: ["**/*"] });
  });

  it("should replace the baseConfig disabled_globs fallback when editPredictions is provided", () => {
    const zed = loadZed();
    const baseConfig = { edit_predictions: { disabled_globs: ["**/*"] } };
    const editPredictions = {
      provider: "ollama",
      ollama: { api_url: "http://127.0.0.1:11434", model: "qwen2.5-coder:1.5b-base" },
    };
    const result = zed._getZedSettings(baseConfig, { is_prebuilt_config: false, editPredictions });
    expect(result.edit_predictions).toEqual(editPredictions);
    expect(result.edit_predictions.disabled_globs).toBeUndefined();
  });

  it("should include edit_predictions when editPredictions option is provided", () => {
    const zed = loadZed();
    const editPredictions = {
      provider: "ollama",
      ollama: { api_url: "http://127.0.0.1:11434", model: "qwen2.5-coder:1.5b-base" },
    };
    const result = zed._getZedSettings({}, { is_prebuilt_config: false, editPredictions });
    expect(result.edit_predictions).toEqual(editPredictions);
  });
});

// ---- _buildZedAgentServersBlock: external ACP agents ----
//
// Zed's `CustomAgentServerSettings` is an internally-tagged enum (`#[serde(tag = "type")]`),
// so every entry MUST carry an explicit snake_case `type`. Agents that speak ACP natively
// (`opencode acp`, `copilot --acp`) map to `custom`; Claude Code has no ACP mode of its own,
// so it maps to Zed's built-in `claude-acp` registry id with a `CLAUDE_CODE_EXECUTABLE`
// override pointing at our install instead of the copy Zed vendors.


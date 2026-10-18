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

function makeProvider(host, modelNames) {
  const isLocal = host === "127.0.0.1";
  return {
    id: isLocal ? "ollama-local" : "ollama-my-desktop",
    name: isLocal ? `Local - ${host}:11434` : `My-desktop - ${host}:11434`,
    baseURL: `http://${host}:11434/v1`,
    models: modelNames.map((name) => ({ name })),
  };
}

describe("_buildZedLanguageModelsBlock > local provider", () => {
  it("registers `language_models.ollama` with auto_discover when local 127.0.0.1 is among providers", () => {
    const zed = loadZed();
    const result = zed._buildZedLanguageModelsBlock([makeProvider("127.0.0.1", ["qwen2.5-coder:3b"])]);
    expect(result.languageModels.ollama).toEqual({ api_url: "http://127.0.0.1:11434", auto_discover: true });
  });

  it("does NOT register `language_models.ollama` when no local provider is in the array", () => {
    const zed = loadZed();
    const result = zed._buildZedLanguageModelsBlock([makeProvider("192.0.2.45", ["qwen3-coder:30b"])]);
    expect(result.languageModels.ollama).toBeUndefined();
  });

  it("does NOT register openai_compatible when only the local provider is reachable", () => {
    const zed = loadZed();
    const result = zed._buildZedLanguageModelsBlock([makeProvider("127.0.0.1", ["qwen2.5-coder:3b"])]);
    expect(result.languageModels.openai_compatible).toBeUndefined();
  });
});

describe("_buildZedLanguageModelsBlock > remote provider", () => {
  it("registers openai_compatible keyed by `Ollama (my-desktop)` when a remote provider is present", () => {
    const zed = loadZed();
    const result = zed._buildZedLanguageModelsBlock([makeProvider("192.0.2.45", ["qwen3.6:latest", "qwen2.5-coder:14b"])]);
    expect(result.languageModels.openai_compatible).toBeDefined();
    expect(Object.keys(result.languageModels.openai_compatible)).toEqual(["Ollama (my-desktop)"]);
    const remote = result.languageModels.openai_compatible["Ollama (my-desktop)"];
    expect(remote.api_url).toBe("http://192.0.2.45:11434/v1");
    expect(remote.available_models).toHaveLength(2);
    expect(remote.available_models[0]).toEqual({
      name: "qwen3.6:latest",
      display_name: "qwen3.6:latest",
      max_tokens: 32768,
      capabilities: { tools: true, images: false, parallel_tool_calls: false, prompt_cache_key: false },
    });
  });
});

describe("_buildZedLanguageModelsBlock > default_model selection", () => {
  it("prefers the local ollama provider for default_model when both local and remote are reachable", () => {
    const zed = loadZed();
    const result = zed._buildZedLanguageModelsBlock([
      makeProvider("127.0.0.1", ["qwen2.5-coder:3b"]),
      makeProvider("192.0.2.45", ["qwen3.6:latest"]),
    ]);
    expect(result.defaultModel).toEqual({ provider: "ollama", model: "qwen2.5-coder:3b" });
  });

  it("falls back to the remote `Ollama (my-desktop)` provider for default_model when only remote is reachable", () => {
    // Upstream Zed crate (language_models/src/language_models.rs L193-L220) registers
    // openai_compatible providers under provider_id = JSON key, so the key is stable.
    const zed = loadZed();
    const result = zed._buildZedLanguageModelsBlock([makeProvider("192.0.2.45", ["qwen3.6:latest"])]);
    expect(result.defaultModel).toEqual({ provider: "Ollama (my-desktop)", model: "qwen3.6:latest" });
  });

  it("returns null defaultModel + empty languageModels when no providers reachable", () => {
    const zed = loadZed();
    const result = zed._buildZedLanguageModelsBlock([]);
    expect(result.defaultModel).toBeNull();
    expect(result.languageModels).toEqual({});
  });
});

// ---- _getZedSettings: agent.default_model merge preserves baseConfig.agent.* ----


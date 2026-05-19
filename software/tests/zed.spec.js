/** Tests for zed.js helpers (keymap resolution, terminal-context mirroring). */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";
import { getIndexFunction } from "./setup.js";

const clone = getIndexFunction("clone");

// ---- Load zed.js (with every SOURCE marker — editor.common.js + llm-common.js — inlined) ----
const zedRaw = fs.readFileSync("software/scripts/zed.js", "utf-8");
const zedSource = zedRaw.replace(/^\/\/ SOURCE\s+(\S+\/\S+)\s*$/gm, (_, srcFile) => {
  return fs.readFileSync(path.resolve(srcFile), "utf-8");
});

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
    clone,
    process: { env: { HOME: "/mock/home" } },
    fs: { existsSync: () => false },
    path: { join: (...args) => args.join("/"), resolve: (p) => p },
    findPath: () => null,
    log: () => {},
    pathExists: () => false,
    getWindowAppDataRoamingUserPath: () => null,
    getOsxApplicationSupportCodeUserPath: () => "/mock/home/Library/Application Support",
    BASE_HOMEDIR_LINUX: "/mock/home",
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
    getSyHPOmenHomeIpAddress: async () => "192.168.1.45",
    getHomeIpAddress: async () => null,
    ...overrides,
  };
  vm.runInNewContext(zedSource.replace(/^(const|let) /gm, "var "), sandbox);
  return sandbox;
}

// ---- _getZedKeymap: OS_KEY substitution ----

describe("_getZedKeymap > OS_KEY substitution", () => {
  it("should substitute OS_KEY -> alt on Windows/Linux", () => {
    const zed = loadZed();
    const result = zed._getZedKeymap([{ bindings: { "OS_KEY-\\": "workspace::ToggleLeftDock" } }], false);
    expect(result[0].bindings).toEqual({ "alt-\\": "workspace::ToggleLeftDock" });
  });

  it("should substitute OS_KEY -> cmd on macOS", () => {
    const zed = loadZed();
    const result = zed._getZedKeymap([{ bindings: { "OS_KEY-\\": "workspace::ToggleLeftDock" } }], true);
    expect(result[0].bindings).toEqual({ "cmd-\\": "workspace::ToggleLeftDock" });
  });
});

// ---- _getZedKeymap: terminal-context mirroring ----

describe("_getZedKeymap > terminal-context mirroring", () => {
  it("should mirror alt- bindings into a Terminal-context entry on Linux/Windows", () => {
    const zed = loadZed();
    const result = zed._getZedKeymap(
      [
        {
          bindings: {
            "OS_KEY-\\": "workspace::ToggleLeftDock",
            "OS_KEY-|": "workspace::ToggleRightDock",
            "ctrl-`": "terminal_panel::Toggle",
            f5: "workspace::ReloadActiveItem",
          },
        },
      ],
      false,
    );
    // Original entry resolved.
    expect(result[0].context).toBeUndefined();
    // Mirror entry appended.
    const mirror = result.find((e) => e.context === "Terminal");
    expect(mirror).toBeDefined();
    // Only OS-modifier bindings are in the mirror — ctrl-` and f5 are NOT.
    expect(mirror.bindings).toEqual({
      "alt-\\": "workspace::ToggleLeftDock",
      "alt-|": "workspace::ToggleRightDock",
    });
  });

  it("should mirror cmd- bindings into a Terminal-context entry on macOS", () => {
    const zed = loadZed();
    const result = zed._getZedKeymap(
      [{ bindings: { "OS_KEY-\\": "workspace::ToggleLeftDock", "ctrl-`": "terminal_panel::Toggle" } }],
      true,
    );
    const mirror = result.find((e) => e.context === "Terminal");
    expect(mirror.bindings).toEqual({ "cmd-\\": "workspace::ToggleLeftDock" });
  });

  it("should mirror compound chords containing the OS modifier (ctrl-alt-X)", () => {
    const zed = loadZed();
    const result = zed._getZedKeymap([{ bindings: { "ctrl-OS_KEY-|": "editor::ToggleSoftWrap" } }], false);
    const mirror = result.find((e) => e.context === "Terminal");
    // ctrl-alt-| has alt as a token in the chord — should be mirrored.
    expect(mirror.bindings).toEqual({ "ctrl-alt-|": "editor::ToggleSoftWrap" });
  });

  it("should NOT mirror bindings without the OS modifier", () => {
    const zed = loadZed();
    const result = zed._getZedKeymap(
      [{ bindings: { "ctrl-`": "terminal_panel::Toggle", f5: "workspace::ReloadActiveItem", "ctrl-shift-p": "command_palette::Toggle" } }],
      false,
    );
    // No OS-modifier bindings — no Terminal entry should be appended.
    const mirror = result.find((e) => e.context === "Terminal");
    expect(mirror).toBeUndefined();
  });

  it("should NOT match prefixes that share letters (e.g. `command-x` is not `cmd-x`)", () => {
    const zed = loadZed();
    const result = zed._getZedKeymap([{ bindings: { "command-x": "fake::Action" } }], true);
    const mirror = result.find((e) => e.context === "Terminal");
    expect(mirror).toBeUndefined();
  });

  it("should leave entries with an existing context untouched (do not duplicate)", () => {
    const zed = loadZed();
    const result = zed._getZedKeymap(
      [
        { context: "Editor", bindings: { "OS_KEY-d": "editor::DuplicateLine" } },
        { bindings: { "OS_KEY-\\": "workspace::ToggleLeftDock" } },
      ],
      false,
    );
    // The Editor-context entry stays untouched.
    expect(result[0]).toEqual({ context: "Editor", bindings: { "alt-d": "editor::DuplicateLine" } });
    // Only the no-context binding is mirrored — the Editor one is not.
    const mirror = result.find((e) => e.context === "Terminal");
    expect(mirror.bindings).toEqual({ "alt-\\": "workspace::ToggleLeftDock" });
    expect(mirror.bindings).not.toHaveProperty("alt-d");
  });

  it("should not append a Terminal entry when the input has no OS-modifier bindings", () => {
    const zed = loadZed();
    const result = zed._getZedKeymap([{ bindings: { f5: "workspace::ReloadActiveItem" } }], false);
    expect(result).toHaveLength(1);
    expect(result[0].context).toBeUndefined();
  });
});

// ---- _buildZedLanguageModelsBlock: Ollama provider pre-registration ----
//
// New signature (post-DRY refactor against llm-common.js's getOllamaProviderInputs):
//   _buildZedLanguageModelsBlock(providers) where each provider is
//   { id, name, baseURL, models: [{name}] }. Local provider is identified by
//   baseURL containing "127.0.0.1"; everything else is treated as remote.

/**
 * Helper: builds a getOllamaProviderInputs-shaped provider entry for tests.
 * @param {string} host - The host portion (e.g. "127.0.0.1" or "192.168.1.45").
 * @param {string[]} modelNames - Model names to embed.
 * @returns {{id: string, name: string, baseURL: string, models: Array<{name: string}>}}
 */
function makeProvider(host, modelNames) {
  const isLocal = host === "127.0.0.1";
  return {
    id: isLocal ? "ollama-local" : "ollama-sy-omen45l",
    name: isLocal ? `Local - ${host}:11434` : `Sy-omen45l - ${host}:11434`,
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
    const result = zed._buildZedLanguageModelsBlock([makeProvider("192.168.1.45", ["qwen3-coder:30b"])]);
    expect(result.languageModels.ollama).toBeUndefined();
  });

  it("does NOT register openai_compatible when only the local provider is reachable", () => {
    const zed = loadZed();
    const result = zed._buildZedLanguageModelsBlock([makeProvider("127.0.0.1", ["qwen2.5-coder:3b"])]);
    expect(result.languageModels.openai_compatible).toBeUndefined();
  });
});

describe("_buildZedLanguageModelsBlock > remote provider", () => {
  it("registers openai_compatible keyed by `Ollama (sy-omen45l)` when a remote provider is present", () => {
    const zed = loadZed();
    const result = zed._buildZedLanguageModelsBlock([makeProvider("192.168.1.45", ["qwen3.6:latest", "qwen2.5-coder:14b"])]);
    expect(result.languageModels.openai_compatible).toBeDefined();
    expect(Object.keys(result.languageModels.openai_compatible)).toEqual(["Ollama (sy-omen45l)"]);
    const remote = result.languageModels.openai_compatible["Ollama (sy-omen45l)"];
    expect(remote.api_url).toBe("http://192.168.1.45:11434/v1");
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
      makeProvider("192.168.1.45", ["qwen3.6:latest"]),
    ]);
    expect(result.defaultModel).toEqual({ provider: "ollama", model: "qwen2.5-coder:3b" });
  });

  it("falls back to the remote `Ollama (sy-omen45l)` provider for default_model when only remote is reachable", () => {
    // Upstream Zed crate (language_models/src/language_models.rs L193-L220) registers
    // openai_compatible providers under provider_id = JSON key, so the key is stable.
    const zed = loadZed();
    const result = zed._buildZedLanguageModelsBlock([makeProvider("192.168.1.45", ["qwen3.6:latest"])]);
    expect(result.defaultModel).toEqual({ provider: "Ollama (sy-omen45l)", model: "qwen3.6:latest" });
  });

  it("returns null defaultModel + empty languageModels when no providers reachable", () => {
    const zed = loadZed();
    const result = zed._buildZedLanguageModelsBlock([]);
    expect(result.defaultModel).toBeNull();
    expect(result.languageModels).toEqual({});
  });
});

// ---- _getZedSettings: agent.default_model merge preserves baseConfig.agent.* ----

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
});

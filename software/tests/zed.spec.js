/** Tests for zed.js helpers (keymap resolution, terminal-context mirroring). */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";
import { getIndexFunction } from "./setup.js";

const clone = getIndexFunction("clone");

// ---- Load zed.js (with every SOURCE marker — editor.common.js + llm-common.js — inlined) ----
const zedRaw = fs.readFileSync("software/scripts/advanced/zed.js", "utf-8");
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
    getSyHPOmenHomeIpAddress: async () => "192.0.2.45",
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
 * @param {string} host - The host portion (e.g. "127.0.0.1", or "192.0.2.45" standing in
 *   for the sy-omen45l workstation whose real address lives in
 *   `software/metadata/ip-address.config`).
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
  it("registers openai_compatible keyed by `Ollama (sy-omen45l)` when a remote provider is present", () => {
    const zed = loadZed();
    const result = zed._buildZedLanguageModelsBlock([makeProvider("192.0.2.45", ["qwen3.6:latest", "qwen2.5-coder:14b"])]);
    expect(result.languageModels.openai_compatible).toBeDefined();
    expect(Object.keys(result.languageModels.openai_compatible)).toEqual(["Ollama (sy-omen45l)"]);
    const remote = result.languageModels.openai_compatible["Ollama (sy-omen45l)"];
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

  it("falls back to the remote `Ollama (sy-omen45l)` provider for default_model when only remote is reachable", () => {
    // Upstream Zed crate (language_models/src/language_models.rs L193-L220) registers
    // openai_compatible providers under provider_id = JSON key, so the key is stable.
    const zed = loadZed();
    const result = zed._buildZedLanguageModelsBlock([makeProvider("192.0.2.45", ["qwen3.6:latest"])]);
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

describe("_buildZedAgentServersBlock > custom agents", () => {
  it("maps an agent with launch args to a `custom` entry keyed by its display name", () => {
    const zed = loadZed();
    const result = zed._buildZedAgentServersBlock([
      { id: "opencode", displayName: "OpenCode", binaryPath: "/mock/home/.local/bin/opencode", args: ["acp"] },
    ]);
    expect(result).toEqual({
      OpenCode: { type: "custom", command: "/mock/home/.local/bin/opencode", args: ["acp"] },
    });
  });

  it("uses the absolute binary path, never the bare binary name", () => {
    const zed = loadZed();
    const result = zed._buildZedAgentServersBlock([
      { id: "copilot", displayName: "Copilot CLI", binaryPath: "/mock/home/.local/bin/copilot", args: ["--acp"] },
    ]);
    expect(result["Copilot CLI"].command).toBe("/mock/home/.local/bin/copilot");
  });

  it("omits `env` for custom entries rather than writing an empty object", () => {
    const zed = loadZed();
    const result = zed._buildZedAgentServersBlock([
      { id: "opencode", displayName: "OpenCode", binaryPath: "/mock/bin/opencode", args: ["acp"] },
    ]);
    expect(result.OpenCode.env).toBeUndefined();
  });
});

describe("_buildZedAgentServersBlock > claude registry override", () => {
  it("maps Claude Code to the built-in `claude-acp` registry id with the executable env override", () => {
    const zed = loadZed();
    const result = zed._buildZedAgentServersBlock([
      {
        id: "claude",
        displayName: "Claude Code",
        binaryPath: "/mock/home/.local/bin/claude",
        executableEnvKey: "CLAUDE_CODE_EXECUTABLE",
      },
    ]);
    expect(result).toEqual({
      "claude-acp": { type: "registry", env: { CLAUDE_CODE_EXECUTABLE: "/mock/home/.local/bin/claude" } },
    });
    // Claude has no ACP mode of its own — a `command` here would spawn a TUI, not an agent.
    expect(result["claude-acp"].command).toBeUndefined();
  });

  it("drops an agent that has neither launch args nor a registry mapping", () => {
    const zed = loadZed();
    const result = zed._buildZedAgentServersBlock([{ id: "mystery-cli", displayName: "Mystery", binaryPath: "/mock/bin/mystery" }]);
    expect(result).toEqual({});
  });

  it("returns an empty block when no ACP-capable CLI was discovered", () => {
    const zed = loadZed();
    expect(zed._buildZedAgentServersBlock([])).toEqual({});
  });
});

describe("_getZedSettings > agent_servers merge", () => {
  it("should not include agent_servers when the option is omitted (CI prebuilt artifacts)", () => {
    const zed = loadZed();
    const result = zed._getZedSettings({}, { is_prebuilt_config: true });
    expect(result.agent_servers).toBeUndefined();
  });

  it("should include agent_servers when the option is provided (local install)", () => {
    const zed = loadZed();
    const agentServers = { OpenCode: { type: "custom", command: "/mock/bin/opencode", args: ["acp"] } };
    const result = zed._getZedSettings({}, { is_prebuilt_config: false, agentServers });
    expect(result.agent_servers).toEqual(agentServers);
  });
});

// ---- lsp block carry-through ----
// Regression guard for a real data-loss bug: settings.json is rebuilt from
// zed-config.jsonc, which carries no `lsp` key, while the `lsp` block itself is written by
// software/scripts/advanced/lsp/zed.js. Discovery order runs lsp/zed.js first (the
// `/advanced/` segment is stripped from the sort key, so `lsp/zed.js` < `zed.js`), so every
// full run used to end with zed.js erasing the LSP binary overrides entirely.

describe("_getZedSettings > theme gate", () => {
  it("should name the custom themes when custom theming is on", () => {
    const zed = loadZed({ is_gui: 1 });
    const { theme } = zed._getZedSettings({}, { is_prebuilt_config: false });
    expect(theme).toEqual({ mode: "system", light: "Sy Light", dark: "Sy Dark" });
  });

  // Without a GUI nothing writes themes/, so settings.json must not point at a file that
  // does not exist — it names a Zed built-in instead.
  it("should fall back to Zed built-ins when custom theming is off", () => {
    const zed = loadZed({ is_gui: 0 });
    const { theme } = zed._getZedSettings({}, { is_prebuilt_config: false });
    expect(theme).toEqual({ mode: "system", light: "Ayu Light", dark: "Ayu Dark" });
  });

  // The prebuilt artifact ships next to zed-color-{dark,light}, so it always names them
  // regardless of whether the machine generating it has a display.
  it("should keep the custom themes in the prebuilt artifact even with no GUI", () => {
    const zed = loadZed({ is_gui: 0 });
    const { theme } = zed._getZedSettings({}, { is_prebuilt_config: true });
    expect(theme).toEqual({ mode: "system", light: "Sy Light", dark: "Sy Dark" });
  });
});

describe("_getZedSettings > lsp carry-through", () => {
  const lspBlock = {
    "rust-analyzer": { binary: { path: "rust-analyzer", arguments: [] } },
    pyright: { binary: { path: "pyright-langserver", arguments: ["--stdio"] } },
  };

  it("should carry an existing lsp block through the rebuild", () => {
    const zed = loadZed();
    const result = zed._getZedSettings({}, { is_prebuilt_config: false, lsp: lspBlock });
    expect(result.lsp).toEqual(lspBlock);
  });

  it("should not invent an lsp key when there is nothing to preserve", () => {
    const zed = loadZed();
    expect(zed._getZedSettings({}, { is_prebuilt_config: false }).lsp).toBeUndefined();
    expect(zed._getZedSettings({}, { is_prebuilt_config: false, lsp: {} }).lsp).toBeUndefined();
  });

  it("should keep the lsp block alongside the keys zed-config.jsonc owns", () => {
    const zed = loadZed();
    const baseConfig = { vim_mode: false, languages: { Rust: { formatter: "language_server" } } };
    const result = zed._getZedSettings(baseConfig, { is_prebuilt_config: false, lsp: lspBlock });
    expect(result.lsp).toEqual(lspBlock);
    expect(result.languages).toEqual({ Rust: { formatter: "language_server" } });
    expect(result.vim_mode).toBe(false);
  });
});

// ---- getAcpAgentInputs: binary discovery (llm-common.js, inlined via SOURCE) ----

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

const stripJsoncComments = getIndexFunction("stripJsoncComments");

/** Relative luminance per WCAG 2.x, for a `#rrggbb` string. */
function themeLuminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two `#rrggbb` strings (1..21). */
function themeContrast(a, b) {
  const [l1, l2] = [themeLuminance(a), themeLuminance(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Composite a `#rrggbbaa` color over an opaque `#rrggbb` backdrop. Passes `#rrggbb` through unchanged. */
function flattenOverBackdrop(color, backdrop) {
  if (color.length === 7) return color;
  const alpha = parseInt(color.slice(7, 9), 16) / 255;
  const channels = [1, 3, 5].map((i) =>
    Math.round(parseInt(color.slice(i, i + 2), 16) * alpha + parseInt(backdrop.slice(i, i + 2), 16) * (1 - alpha)),
  );
  return `#${channels.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Editor-level fills that the plain editor foreground gets painted on. */
const EDITOR_FILL_KEYS = [
  "editor.active_line.background",
  "editor.highlighted_line.background",
  "search.match_background",
  "search.active_match_background",
  "editor.document_highlight.read_background",
  "editor.document_highlight.write_background",
];

/** Status keys whose `<key>.background` is the fill behind `<key>`-colored text. */
const STATUS_KEYS = [
  "conflict",
  "created",
  "deleted",
  "modified",
  "renamed",
  "error",
  "warning",
  "info",
  "hint",
  "success",
  "predictive",
  "unreachable",
  "hidden",
  "ignored",
];

/** ANSI base color names; each has a matching `bright_` variant in the terminal ramp. */
const ANSI_COLOR_NAMES = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];

for (const [themeFile, appearance] of [
  ["software/scripts/advanced/zed-color-dark.jsonc", "dark"],
  ["software/scripts/advanced/zed-color-light.jsonc", "light"],
]) {
  describe(`zed theme contrast > ${appearance}`, () => {
    const theme = JSON.parse(stripJsoncComments(fs.readFileSync(themeFile, "utf-8")));
    const style = theme.themes[0].style;
    const editorBackground = style["editor.background"];
    const editorForeground = style["editor.foreground"];

    it("should declare a single theme matching the requested appearance", () => {
      expect(theme.themes).toHaveLength(1);
      expect(theme.themes[0].appearance).toBe(appearance);
    });

    it("should keep the editor foreground legible on every editor-level fill", () => {
      for (const key of EDITOR_FILL_KEYS) {
        expect(style, `${key} is missing`).toHaveProperty(key);
        const flattened = flattenOverBackdrop(style[key], editorBackground);
        const ratio = themeContrast(editorForeground, flattened);
        expect(ratio, `editor.foreground on ${key} (${style[key]} -> ${flattened}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(7);
      }
    });

    it("should keep each status color legible on its own background fill", () => {
      for (const key of STATUS_KEYS) {
        const fillKey = `${key}.background`;
        expect(style, `${fillKey} is missing`).toHaveProperty(fillKey);
        const flattened = flattenOverBackdrop(style[fillKey], editorBackground);
        const ratio = themeContrast(style[key], flattened);
        expect(
          ratio,
          `${key} (${style[key]}) on ${fillKey} (${style[fillKey]} -> ${flattened}) is ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });

    // `predictive` is inline-completion ghost text: it must stay readable but deliberately
    // dimmer than real code, otherwise a suggestion is indistinguishable from committed source.
    const DIM_BY_DESIGN_SCOPES = new Set(["predictive", "unreachable", "comment", "comment.doc"]);

    it("should keep every syntax color legible on the editor background", () => {
      for (const [scope, entry] of Object.entries(style.syntax)) {
        if (DIM_BY_DESIGN_SCOPES.has(scope)) continue;
        const ratio = themeContrast(entry.color, editorBackground);
        expect(ratio, `syntax.${scope} (${entry.color}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(7);
      }
    });

    it("should keep dim-by-design syntax scopes readable but below regular code", () => {
      const floor = themeContrast(style.syntax.variable.color, editorBackground);
      for (const scope of DIM_BY_DESIGN_SCOPES) {
        if (!style.syntax[scope]) continue;
        const ratio = themeContrast(style.syntax[scope].color, editorBackground);
        expect(ratio, `syntax.${scope} (${style.syntax[scope].color}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
        expect(ratio, `syntax.${scope} must read dimmer than syntax.variable`).toBeLessThan(floor);
      }
    });

    // Zed reads the local selection from players[0]; `selection.background` is not a real
    // theme key, so relying on it silently left the selection unstyled.
    it("should define players[0] so the cursor and selection are themed", () => {
      expect(style.players).toBeInstanceOf(Array);
      expect(style.players.length).toBeGreaterThan(0);
      const [player] = style.players;
      expect(player.cursor).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/);
      const flattened = flattenOverBackdrop(player.selection, editorBackground);
      const ratio = themeContrast(editorForeground, flattened);
      expect(ratio, `editor.foreground on players[0].selection (${player.selection}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(7);
      expect(style["selection.background"], "selection.background is not a Zed theme key — use players[0].selection").toBeUndefined();
    });

    it("should lift the chrome off the editor background and keep borders visible", () => {
      // Chrome (tab bar, panels, status bar) uses `surface` so the editor pane reads as a distinct layer.
      expect(style["tab_bar.background"]).not.toBe(editorBackground);
      expect(style["panel.background"]).toBe(style["tab_bar.background"]);
      expect(style["tab.active_background"]).toBe(editorBackground);
      // WCAG non-text contrast floor for 1px UI strokes.
      expect(themeContrast(style.border, editorBackground)).toBeGreaterThanOrEqual(3);
    });

    // The ANSI ramp is the one place where a "correct" color (pure black / pure white) can be
    // invisible: the terminal background sits at either end of the lightness range. Both halves of
    // the ramp must stay readable, and each bright variant must stay lighter than its base so tools
    // that dim with the base color still render dimmer rather than brighter.
    it("should keep every terminal ANSI color visible on the terminal background", () => {
      const terminalBackground = style["terminal.background"];
      for (const name of ANSI_COLOR_NAMES) {
        for (const prefix of ["terminal.ansi.", "terminal.ansi.bright_"]) {
          const key = `${prefix}${name}`;
          const ratio = themeContrast(style[key], terminalBackground);
          expect(ratio, `${key} (${style[key]}) on ${terminalBackground} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
        }
      }
    });

    it("should keep each bright ANSI color lighter than its base counterpart", () => {
      for (const name of ANSI_COLOR_NAMES) {
        const base = themeLuminance(style[`terminal.ansi.${name}`]);
        const bright = themeLuminance(style[`terminal.ansi.bright_${name}`]);
        expect(bright, `terminal.ansi.bright_${name} is not lighter than terminal.ansi.${name}`).toBeGreaterThan(base);
      }
    });

    // SGR 2 (dim) must read as a faded version of its base, never as a second bright variant.
    it("should keep each dim ANSI color fainter than its base but still visible", () => {
      const terminalBackground = style["terminal.background"];
      for (const name of ANSI_COLOR_NAMES) {
        const dim = flattenOverBackdrop(style[`terminal.ansi.dim_${name}`], terminalBackground);
        const dimRatio = themeContrast(dim, terminalBackground);
        const baseRatio = themeContrast(style[`terminal.ansi.${name}`], terminalBackground);
        expect(dimRatio, `terminal.ansi.dim_${name} renders at ${dimRatio.toFixed(2)}:1`).toBeGreaterThanOrEqual(2);
        expect(dimRatio, `terminal.ansi.dim_${name} is not fainter than terminal.ansi.${name}`).toBeLessThan(baseRatio);
      }
    });

    // Hover and active are the two states a user gets constant feedback from; when they collapse
    // into the base fill the UI feels dead. `element.hover` previously sat at 1.09:1 on `surface`.
    it("should separate every interactive element state from the base fill", () => {
      const base = style["element.background"];
      for (const prefix of ["element", "ghost_element"]) {
        for (const state of ["hover", "active"]) {
          const key = `${prefix}.${state}`;
          const ratio = themeContrast(flattenOverBackdrop(style[key], base), base);
          expect(ratio, `${key} (${style[key]}) vs element.background (${base}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(1.25);
        }
        // Disabled deliberately matches the base fill so it can never be mistaken for hover.
        expect(style[`${prefix}.disabled`], `${prefix}.disabled must not reuse a state fill`).toBe(base);
      }
      const hover = themeContrast(flattenOverBackdrop(style["element.hover"], base), base);
      const active = themeContrast(flattenOverBackdrop(style["element.active"], base), base);
      expect(active, "element.active must read stronger than element.hover").toBeGreaterThan(hover);
    });

    // Guides and invisibles are structural hints: readable at a glance, never loud enough to be
    // mistaken for text. `editor.wrap_guide` was previously a 20% tint at 1.19:1 — effectively gone.
    it("should keep guides and invisibles inside the faint-stroke band", () => {
      for (const key of ["editor.invisible", "editor.wrap_guide", "editor.indent_guide", "panel.indent_guide", "border.disabled"]) {
        const ratio = themeContrast(flattenOverBackdrop(style[key], editorBackground), editorBackground);
        expect(ratio, `${key} (${style[key]}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(1.7);
        expect(ratio, `${key} (${style[key]}) is ${ratio.toFixed(2)}:1 — too loud for a guide`).toBeLessThan(3);
      }
      // The active counterparts step up to the full border stroke.
      for (const [faint, active] of [
        ["editor.indent_guide", "editor.indent_guide_active"],
        ["editor.wrap_guide", "editor.active_wrap_guide"],
        ["panel.indent_guide", "panel.indent_guide_active"],
      ]) {
        const faintRatio = themeContrast(flattenOverBackdrop(style[faint], editorBackground), editorBackground);
        const activeRatio = themeContrast(flattenOverBackdrop(style[active], editorBackground), editorBackground);
        expect(activeRatio, `${active} must read stronger than ${faint}`).toBeGreaterThan(faintRatio);
      }
    });

    it("should define distinguishable accent colors", () => {
      expect(style.accents).toBeInstanceOf(Array);
      expect(style.accents.length).toBeGreaterThanOrEqual(5);
      expect(new Set(style.accents).size, "accents must not repeat").toBe(style.accents.length);
      for (const accent of style.accents) {
        const ratio = themeContrast(accent, editorBackground);
        expect(ratio, `accent ${accent} is ${ratio.toFixed(2)}:1 on the editor background`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("should use lowercase hex for every color value", () => {
      const uppercase = JSON.stringify(style).match(/#[0-9a-fA-F]{6,8}\b/g) || [];
      expect(uppercase.filter((c) => c !== c.toLowerCase())).toEqual([]);
    });
  });
}

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

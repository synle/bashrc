/** Zed editor setup: settings + custom dark/light themes. Reads zed-config.jsonc and zed-color-{dark,light}.jsonc, augments with shared EDITOR_CONFIGS, and writes to the local Zed config dir + build artifacts for prebuilt configs. */
// SOURCE software/scripts/advanced/editor.common.js
// SOURCE software/scripts/advanced/llm/llm-common.js

/** @type {string} Filename for the dark theme written into Zed's themes/ folder. Must match `dark_color_scheme` in the merged settings (currently `Sy Dark`). */
const ZED_DARK_THEME_FILE = "Sy Dark.json";
/** @type {string} Filename for the light theme written into Zed's themes/ folder. */
const ZED_LIGHT_THEME_FILE = "Sy Light.json";

// --- Agent / LLM auto-config (shared discovery with software/scripts/advanced/llm/opencode/setup.js) ---
//
// Pre-registers Ollama LLM providers for Zed's Agent Panel so the dropdown is populated
// the first time the user opens the panel — no manual provider setup required. Discovery
// is delegated to `getOllamaProviderInputs()` in llm-common.js (single source of truth for
// reachable hosts + models). We then translate the generic provider inputs into Zed's
// settings shape: `language_models.ollama` (local, auto_discover) and
// `language_models.openai_compatible["Ollama (<hostname>)"]` (remote, explicit available_models).
//
// Network discovery only runs on the local-deploy code path (never for CI prebuilt artifacts),
// so the build artifacts uploaded to binary-cache stay generic across machines.

/**
 * Friendly hostname used as the key under `language_models.openai_compatible` for the
 * remote Ollama provider. Per the Zed crate `language_models/src/language_models.rs`
 * (register_openai_compatible_providers L193-L220), the provider_id used by
 * `agent.default_model.provider` is literally this JSON key — so it's stable as long as
 * the key isn't renamed.
 * @type {string}
 */
const ZED_OLLAMA_REMOTE_KEY = "Ollama (sy-omen45l)";

/**
 * Zed's built-in ACP registry id for Claude Agent. Zed bundles its own
 * `@zed-industries/claude-agent-acp` adapter (which vendors a copy of Claude Code) and
 * always prefers it over a globally-installed CLI — the documented way to redirect it at
 * our install is a `"type": "registry"` entry under this id carrying
 * `CLAUDE_CODE_EXECUTABLE`. Verified against the docs shipped with the installed Zed
 * (`docs/src/ai/external-agents.md` at tag v0.231.2) and the `claude-acp` id embedded in
 * the Zed binary itself.
 * @type {string}
 */
const ZED_CLAUDE_REGISTRY_KEY = "claude-acp";

/**
 * Builds Zed's `agent_servers` block from the generic ACP agent inputs produced by
 * `getAcpAgentInputs()` in llm-common.js, so the Agent Panel's `+` menu lists our locally
 * installed LLM CLIs instead of only Zed's built-ins.
 *
 * Zed's `CustomAgentServerSettings` is an internally-tagged enum (`#[serde(tag = "type",
 * rename_all = "snake_case")]` in `crates/settings_content/src/agent.rs`), so every entry
 * carries an explicit `type`. Two translations:
 *
 *   - Agents that speak ACP natively become `{ type: "custom", command, args }`. The map
 *     key is the label shown in the agent picker.
 *   - Claude Code (no `--acp` flag of its own) becomes
 *     `{ type: "registry", env: { CLAUDE_CODE_EXECUTABLE } }` under Zed's built-in
 *     `claude-acp` id — Zed keeps managing the adapter, the adapter drives our binary.
 *
 * `env` is omitted for custom agents rather than written as `{}`: it is `#[serde(default)]`
 * upstream, and an empty map is noise in a hand-readable settings file.
 *
 * @param {Array<{id: string, displayName: string, binaryPath: string, args?: string[], executableEnvKey?: string}>} agents - From getAcpAgentInputs().
 * @returns {object} `agent_servers` map, empty when no ACP-capable CLI is installed.
 */
function _buildZedAgentServersBlock(agents) {
  /** @type {Record<string, object>} */
  const agentServers = {};

  for (const { id, displayName, binaryPath, args, executableEnvKey } of agents) {
    if (Array.isArray(args) && args.length > 0) {
      agentServers[displayName] = { type: "custom", command: binaryPath, args };
      continue;
    }
    if (executableEnvKey && id === "claude") {
      agentServers[ZED_CLAUDE_REGISTRY_KEY] = { type: "registry", env: { [executableEnvKey]: binaryPath } };
      continue;
    }
    log(`>>> zed: skipping ACP agent ${id} — no launch args and no Zed registry mapping`);
  }

  return agentServers;
}

/**
 * Builds the `language_models` block + `agent.default_model` entry for Zed's settings.json
 * from the generic provider-input array produced by `getOllamaProviderInputs()` in
 * llm-common.js. Translation rules:
 *
 *   - Loopback provider (baseURL containing 127.0.0.1) becomes `language_models.ollama`
 *     with `auto_discover: true` — Zed's native Ollama provider enumerates models itself,
 *     so we don't pass `available_models` for the local host (saves a re-enumeration).
 *   - Remote providers become a `language_models.openai_compatible[ZED_OLLAMA_REMOTE_KEY]`
 *     entry; `openai_compatible` does NOT auto-discover, so we list `available_models`
 *     explicitly from the discovered model names. The remote URL needs the `/v1` suffix
 *     (Ollama exposes both `/api/*` native and `/v1/*` OpenAI-compatible — the
 *     openai_compatible provider needs the latter).
 *
 * `default_model` picks the first reachable provider in priority order: local Ollama (if
 * any models found) wins because `provider: "ollama"` is the documented enum value; the
 * remote openai_compatible key is the documented-stable fallback when no local provider
 * responded (per the upstream crate referenced above).
 *
 * @param {Array<{id: string, name: string, baseURL: string, models: Array<{name: string}>}>} providers - From getOllamaProviderInputs().
 * @returns {{ languageModels: object, defaultModel: ({provider: string, model: string})|null }}
 */
function _buildZedLanguageModelsBlock(providers) {
  /** @type {Record<string, object>} */
  const languageModels = {};
  /** @type {({provider: string, model: string})|null} */
  let defaultModel = null;

  const localProvider = providers.find((p) => p.baseURL.includes("127.0.0.1"));
  const remoteProvider = providers.find((p) => !p.baseURL.includes("127.0.0.1"));

  if (localProvider) {
    // baseURL from llm-common.js includes the `/v1` OpenAI-compat suffix; Zed's native
    // `ollama` provider talks to the root URL (it calls `/api/tags` etc. itself), so
    // strip the suffix before writing it.
    const rootUrl = localProvider.baseURL.replace(/\/v1$/, "");
    languageModels.ollama = { api_url: rootUrl, auto_discover: true };
    if (localProvider.models.length > 0) {
      defaultModel = { provider: "ollama", model: localProvider.models[0].name };
    }
  }

  if (remoteProvider && remoteProvider.models.length > 0) {
    languageModels.openai_compatible = {
      [ZED_OLLAMA_REMOTE_KEY]: {
        api_url: remoteProvider.baseURL, // baseURL already ends in /v1 — exactly what openai_compatible wants.
        available_models: remoteProvider.models.map(({ name }) => ({
          name,
          display_name: name,
          max_tokens: 32768,
          capabilities: { tools: true, images: false, parallel_tool_calls: false, prompt_cache_key: false },
        })),
      },
    };
    // Fall back to the remote provider for default_model when no local provider responded.
    // The provider id used by `agent.default_model.provider` is the literal JSON key
    // (per upstream crate registration) — stable across Zed versions.
    if (!defaultModel) {
      defaultModel = { provider: ZED_OLLAMA_REMOTE_KEY, model: remoteProvider.models[0].name };
    }
  }

  return { languageModels, defaultModel };
}

/**
 * Locates the Zed config directory across platforms.
 * Returns the path containing settings.json + themes/ subfolder, or null if not found.
 * macOS / Linux: ~/.config/zed
 * Windows native: %APPDATA%/Zed
 * WSL → Windows host: /mnt/c/Users/<user>/AppData/Roaming/Zed
 * @returns {Promise<string|null>} Absolute path to the Zed config dir, or null.
 */
async function _getPathZed() {
  /** @type {string[]} Candidate config-dir locations to probe in order. First existing folder wins. */
  const candidates = [];
  if (is_os_windows) {
    candidates.push(path.join(getWindowAppDataRoamingUserPath(), "Zed"));
  }
  if (is_os_mac || is_os_ubuntu || is_os_arch_linux || is_os_redhat || is_os_steamos || is_os_chromeos) {
    candidates.push(path.join(BASE_HOMEDIR_LINUX, ".config/zed"));
  }
  for (const candidate of candidates) {
    if (pathExists(candidate)) return candidate;
  }
  return null;
}

/**
 * Builds the merged Zed settings object: starts from zed-config.jsonc and overlays
 * shared EDITOR_CONFIGS values (fonts, tab size, ruler, terminal scrollback, ignored files).
 * Optionally merges in an Ollama `language_models` block + `agent.default_model` produced
 * by `_buildZedLanguageModelsBlock` — only the local-deploy branch in `doWork` passes
 * these (CI prebuilt artifacts skip discovery and never set them).
 * @param {object} baseConfig - Parsed zed-config.jsonc.
 * @param {object} options - Build options.
 * @param {boolean} [options.is_prebuilt_config] - When true, use safe fallback fonts/sizes for shipped artifacts.
 * @param {object|null} [options.languageModels] - `language_models` block from `_buildZedLanguageModelsBlock` to merge in.
 * @param {({provider:string, model:string})|null} [options.defaultModel] - `agent.default_model` entry to merge in.
 * @param {object|null} [options.editPredictions] - `edit_predictions` block (Ollama inline autocomplete) to merge in. Omit / null to keep whatever `baseConfig.edit_predictions` holds — in practice zed-config.jsonc's catch-all `disabled_globs` entry, i.e. inline AI stays fully off rather than falling through to Zed's cloud Zeta.
 * @param {object|null} [options.agentServers] - `agent_servers` block from `_buildZedAgentServersBlock` to merge in. Omit / null to leave the key unset (prebuilt artifacts, which must stay machine-generic).
 * @param {object|null} [options.lsp] - Existing `lsp` block read back off disk, carried through untouched. Owned by `software/scripts/advanced/lsp/zed.js`, not by zed-config.jsonc — see `_readExistingZedLspBlock` for why it has to survive this write.
 * @returns {object} The fully resolved settings.json content.
 */
function _getZedSettings(
  baseConfig,
  { is_prebuilt_config = false, languageModels = null, defaultModel = null, editPredictions = null, agentServers = null, lsp = null } = {},
) {
  const fontFamily = is_prebuilt_config ? EDITOR_CONFIGS.fontFamilyDefaultFallback : EDITOR_CONFIGS.fontFamily;
  const fontSize = is_prebuilt_config ? EDITOR_CONFIGS.fontSizeDefaultFallback : EDITOR_CONFIGS.fontSize;

  const settings = {
    ...baseConfig,

    // --- Typography ---
    buffer_font_family: fontFamily,
    buffer_font_size: fontSize,
    buffer_font_weight: EDITOR_CONFIGS.fontWeightNumber,
    ui_font_size: fontSize,

    // --- Editing ---
    tab_size: EDITOR_CONFIGS.tabSize,
    preferred_line_length: EDITOR_CONFIGS.maxLineSize,

    // --- Terminal ---
    terminal: {
      ...(baseConfig.terminal || {}),
      max_scroll_history_lines: EDITOR_CONFIGS.terminalScrollback,
    },

    // --- Theme: light/dark variants point to our custom themes, or to Zed built-ins
    // when custom theming is off. Prebuilt artifacts always name the custom pair, since
    // they ship next to the zed-color-{dark,light} artifacts that define them.
    theme:
      is_prebuilt_config || shouldInstallCustomTheme()
        ? { mode: "system", light: ZED_LIGHT_HIGH_CONTRAST_COLOR_SCHEME, dark: ZED_DARK_HIGH_CONTRAST_COLOR_SCHEME }
        : { mode: "system", light: ZED_LIGHT_COLOR_SCHEME, dark: ZED_DARK_COLOR_SCHEME },

    // --- File hiding ---
    file_scan_exclusions: EDITOR_CONFIGS.ignoredFolders.concat(EDITOR_CONFIGS.ignoredFiles),

    // --- Agent: preserve dock / tool_permissions from baseConfig and optionally add the
    // discovered default_model (only set when local Ollama responded).
    agent: {
      ...(baseConfig.agent || {}),
      ...(defaultModel ? { default_model: defaultModel } : {}),
    },
  };

  // Pre-registered Ollama providers (local auto_discover + remote openai_compatible).
  // Only present in local-deploy writes — CI prebuilt artifacts stay generic.
  if (languageModels) {
    settings.language_models = languageModels;
  }

  // Inline edit prediction (per-keystroke ghost text) wired to an Ollama host. Only present
  // when `getAutocompleteProvider()` actually found a reachable host with a FIM-capable model.
  // This REPLACES baseConfig's `edit_predictions` wholesale (zed-config.jsonc ships a
  // catch-all `disabled_globs` entry), which is why inline AI is on exactly when an Ollama
  // FIM host answered. When omitted, that fallback survives and inline predictions stay
  // fully off — deliberately NOT Zed's cloud Zeta, and never a stale endpoint the editor
  // would hammer on every keystroke.
  if (editPredictions) {
    settings.edit_predictions = editPredictions;
  }

  // External ACP agents (Claude Code / OpenCode / Copilot CLI) for the Agent Panel's `+`
  // menu. Local-deploy only: the entries carry absolute binary paths resolved on THIS
  // machine, so writing them into a prebuilt artifact would ship a dead path to everyone
  // else. Left unset when no ACP-capable CLI is installed, which keeps Zed on its
  // built-in agents rather than listing an agent that can't launch.
  if (agentServers) {
    settings.agent_servers = agentServers;
  }

  // LSP binary overrides. This key is written by software/scripts/advanced/lsp/zed.js, which
  // merges it into whatever settings.json already holds. zed.js rebuilds settings.json from
  // zed-config.jsonc — a file that deliberately carries no `lsp` key — so without carrying
  // the block across, every run of this script silently deletes it. Discovery order sorts
  // `lsp/zed.js` before `zed.js` (the `/advanced/` segment is stripped, leaving `lsp/…` < `zed…`),
  // so lsp/zed.js always wrote first and zed.js always erased it: on a full run the LSP
  // overrides never survived to disk at all.
  if (lsp && Object.keys(lsp).length > 0) {
    settings.lsp = lsp;
  }

  return settings;
}

/**
 * Reads the three Zed JSONC source files. Falls back to empty objects if a file is missing
 * so a partially-populated repo (e.g. mid-rebase) doesn't crash the run.
 * @returns {Promise<{baseConfig: object, darkTheme: object, lightTheme: object}>}
 */
async function _readZedSources() {
  const baseConfig = (await readJson`software/scripts/advanced/zed-config.jsonc`) || {};
  const darkTheme = (await readJson`software/scripts/advanced/zed-color-dark.jsonc`) || {};
  const lightTheme = (await readJson`software/scripts/advanced/zed-color-light.jsonc`) || {};
  const keymap = (await readJson`software/scripts/advanced/zed-keys.common.jsonc`) || [];
  return { baseConfig, darkTheme, lightTheme, keymap };
}

/**
 * Substitutes the `OS_KEY` placeholder in every binding key string and auto-appends a
 * `context: "Terminal"` entry mirroring every OS-modifier binding so those chords fire
 * from terminal focus too. Zed's terminal pane consumes `alt-` / `cmd-` chords as Meta
 * and forwards them to the shell — analogous to VS Code's commandsToSkipShell behavior.
 * Only bindings from no-context entries are mirrored (those are the workspace-global
 * bindings the user expects everywhere); entries already scoped to a context are left
 * alone. Generic so new OS_KEY+X bindings work in terminal focus by default.
 * @param {object[]} keymap - Parsed `zed-keys.common.jsonc`.
 * @param {boolean} [isOsMac] - Override for macOS detection. When omitted, uses the global is_os_mac flag.
 * @returns {object[]} Resolved keymap ready to write to `keymap.json`.
 */
function _getZedKeymap(keymap, isOsMac) {
  const isMac = isOsMac !== undefined ? isOsMac : is_os_mac;
  const osKey = isMac ? "cmd" : "alt";

  // Step 1: substitute OS_KEY in every binding chord.
  const resolved = keymap.map((entry) => {
    const out = { ...entry };
    if (entry.bindings && typeof entry.bindings === "object") {
      out.bindings = Object.fromEntries(Object.entries(entry.bindings).map(([k, v]) => [k.replace(/OS_KEY/g, osKey), v]));
    }
    return out;
  });

  // Step 2: collect every OS-modifier binding from no-context entries and mirror them
  // into a Terminal-context entry. Match the modifier as a whole token (start of chord
  // or after a `-`) so `cmd-x` and `ctrl-alt-x` match but `command-x` doesn't. Skip any
  // chord already explicitly bound in a user-defined Terminal-context entry — the user's
  // binding takes precedence (e.g., `cmd-c` -> `terminal::Copy` in Terminal vs the
  // `editor::Copy` workspace default).
  const osModifierRegex = new RegExp(`(?:^|-)${osKey}-`);
  const explicitTerminalChords = new Set();
  for (const entry of resolved) {
    if (entry.context === "Terminal") {
      Object.keys(entry.bindings || {}).forEach((c) => explicitTerminalChords.add(c));
    }
  }
  const terminalBindings = {};
  for (const entry of resolved) {
    if (entry.context) continue;
    for (const [chord, action] of Object.entries(entry.bindings || {})) {
      if (osModifierRegex.test(chord) && !explicitTerminalChords.has(chord)) {
        terminalBindings[chord] = action;
      }
    }
  }
  if (Object.keys(terminalBindings).length > 0) {
    resolved.push({ context: "Terminal", bindings: terminalBindings });
  }

  return resolved;
}

/**
 * Reads the `lsp` block back off an existing settings.json so `_getZedSettings` can carry it
 * across the rewrite. That block is owned by `software/scripts/advanced/lsp/zed.js` (built from
 * `LSP_SERVERS` in lsp/lsp-common.js) and has no representation in zed-config.jsonc, so a
 * rebuild-from-source write drops it unless it is read back first.
 *
 * Returns `null` when the file is missing or unparseable — a fresh machine simply has no block
 * to preserve, and a corrupt file should not abort the deploy (this script is what repairs it).
 *
 * @param {string} settingsPath - Absolute path to Zed's settings.json.
 * @returns {Promise<object|null>} The existing `lsp` block, or null when there isn't a usable one.
 */
async function _readExistingZedLspBlock(settingsPath) {
  if (!pathExists(settingsPath)) return null;
  try {
    const existing = (await readJson`${settingsPath}`) || {};
    return existing.lsp && Object.keys(existing.lsp).length > 0 ? existing.lsp : null;
  } catch (e) {
    log(">>> zed: existing settings.json unreadable — cannot preserve the lsp block:", e.message);
    return null;
  }
}

/**
 * Main entry: writes Zed settings + themes to the local install (if found) and queues
 * prebuilt build artifacts. Build artifacts are batched into one writeBuildArtifact call
 * because in CI it throws ScriptSkipError after the first invocation.
 */
async function doWork() {
  const targetPath = await _getPathZed();
  log(">>> Zed config path:", targetPath || "[not found]");

  const { baseConfig, darkTheme, lightTheme, keymap } = await _readZedSources();

  // --- Local system: write directly to the Zed config dir if Zed is installed ---
  if (targetPath) {
    log(">>> Deploying to local Zed install:", targetPath);

    // Pre-register Ollama LLM providers for Zed's Agent Panel. Network discovery only
    // runs here (never for CI prebuilt artifacts) so the build artifacts stay generic.
    // Delegated to llm-common.js's `getOllamaProviderInputs()` so opencode + zed share
    // one source of truth for which hosts are reachable + what models they advertise.
    const providers = await getOllamaProviderInputs();
    if (providers.length === 0) {
      log(">>> zed: no reachable Ollama hosts — leaving language_models / agent.default_model unset");
    }
    const { languageModels, defaultModel } = _buildZedLanguageModelsBlock(providers);

    // Only pass through `language_models` when discovery actually populated it — empty
    // object would clobber any pre-existing user-managed providers under that key.
    const lmToWrite = Object.keys(languageModels).length > 0 ? languageModels : null;

    // Pick host+model for Zed's inline edit prediction (autocomplete ghost text). Reuses the
    // shared discovery in llm-common.js but with INVERSE host priority vs the agent panel:
    // 127.0.0.1 is preferred over sy-omen45l because inline completion fires per keystroke
    // and localhost latency beats LAN. See `getAutocompleteProvider` JSDoc for the full rationale.
    // When no host+model match (null return), we leave `edit_predictions` unset so the
    // catch-all `disabled_globs` fallback from zed-config.jsonc survives — inline AI stays
    // fully off (never Zed's cloud Zeta) instead of hammering a dead endpoint per keystroke.
    const autocomplete = await getAutocompleteProvider();
    const editPredictions = autocomplete
      ? {
          provider: "ollama",
          ollama: {
            api_url: `http://${autocomplete.host}:${autocomplete.port}`,
            model: autocomplete.model,
          },
        }
      : null;
    if (!editPredictions) {
      log(
        ">>> zed: no Ollama autocomplete model reachable — leaving edit_predictions unset (zed-config.jsonc's disabled_globs fallback keeps inline AI off)",
      );
    }

    // Register the locally-installed ACP CLIs as external agents so they show up in the
    // Agent Panel's `+` menu. Discovery lives in llm-common.js (`getAcpAgentInputs`) so
    // "how does each CLI enter ACP mode" is stated once; this file only translates the
    // result into Zed's `agent_servers` shape. Local-deploy only, same as language_models.
    const acpAgents = await getAcpAgentInputs();
    const agentServersBlock = _buildZedAgentServersBlock(acpAgents);
    // Only write the key when discovery found something — an empty object would clobber
    // any agent the user added by hand or installed from Zed's ACP registry.
    const agentServers = Object.keys(agentServersBlock).length > 0 ? agentServersBlock : null;
    if (!agentServers) {
      log(">>> zed: no ACP-capable LLM CLI installed — leaving agent_servers unset");
    } else {
      log(`>>> zed: registering external agents: ${Object.keys(agentServersBlock).join(", ")}`);
    }

    const settingsPath = path.join(targetPath, "settings.json");

    // Carry the LSP binary overrides across the rewrite — see _readExistingZedLspBlock.
    const existingLsp = await _readExistingZedLspBlock(settingsPath);
    if (!existingLsp) {
      log(">>> zed: no existing lsp block to preserve — run advanced/lsp/zed.js to write one");
    }

    await backupConfigFile(settingsPath);
    await writeJson(
      settingsPath,
      _getZedSettings(baseConfig, {
        is_prebuilt_config: false,
        languageModels: lmToWrite,
        defaultModel,
        editPredictions,
        agentServers,
        lsp: existingLsp,
      }),
    );

    // Theme files are only written when custom theming is on; otherwise settings.json
    // names a Zed built-in and there is nothing to drop into themes/.
    if (shouldInstallCustomTheme()) {
      const darkThemePath = path.join(targetPath, "themes", ZED_DARK_THEME_FILE);
      await backupConfigFile(darkThemePath);
      await writeJson(darkThemePath, darkTheme);

      const lightThemePath = path.join(targetPath, "themes", ZED_LIGHT_THEME_FILE);
      await backupConfigFile(lightThemePath);
      await writeJson(lightThemePath, lightTheme);
    }

    const keymapPath = path.join(targetPath, "keymap.json");
    await backupConfigFile(keymapPath);
    await writeJson(keymapPath, _getZedKeymap(keymap));
  }

  // --- Prebuilt artifacts (used by setup scripts and the webapp) ---
  log(">>> Writing prebuilt Zed build artifacts");
  await writeBuildArtifact([
    {
      file: `${BUILD_DIR}/zed-config`,
      data: _getZedSettings(baseConfig, { is_prebuilt_config: true }),
      isJson: true,
      comments: "Zed settings.json",
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/zed-color-dark`,
      data: darkTheme,
      isJson: true,
      comments: "Zed dark theme (drop into ~/.config/zed/themes/)",
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/zed-color-light`,
      data: lightTheme,
      isJson: true,
      comments: "Zed light theme (drop into ~/.config/zed/themes/)",
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/zed-keys-mac`,
      data: _getZedKeymap(keymap, true),
      isJson: true,
      comments: "Zed keymap.json (macOS)",
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/zed-keys-linux`,
      data: _getZedKeymap(keymap, false),
      isJson: true,
      comments: "Zed keymap.json (Linux/Windows)",
      commentStyle: "json",
    },
  ]);
}

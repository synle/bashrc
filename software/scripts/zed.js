/** Zed editor setup: settings + custom dark/light themes. Reads zed-config.jsonc and zed-color-{dark,light}.jsonc, augments with shared EDITOR_CONFIGS, and writes to the local Zed config dir + build artifacts for prebuilt configs. */
// SOURCE software/scripts/advanced/editor.common.js

/** @type {string} Filename for the dark theme written into Zed's themes/ folder. Must match `dark_color_scheme` in the merged settings (currently `Sy Dark`). */
const ZED_DARK_THEME_FILE = "Sy Dark.json";
/** @type {string} Filename for the light theme written into Zed's themes/ folder. */
const ZED_LIGHT_THEME_FILE = "Sy Light.json";

// ---- Agent / LLM auto-config (mirrors software/scripts/advanced/llm/opencode/setup.js) ----
//
// Pre-registers Ollama LLM providers for Zed's Agent Panel so the dropdown is populated
// the first time the user opens the panel — no manual provider setup required. We discover
// model names from a remote Ollama host (lookup via ip-address.config) and a local 127.0.0.1
// fallback, then write `language_models.ollama` (local, auto_discover) and
// `language_models.openai_compatible["Ollama (<hostname>)"]` (remote, explicit available_models).
//
// Network discovery only runs on the local-deploy code path (never for CI prebuilt artifacts),
// so the build artifacts uploaded to binary-cache stay generic across machines.

/** @type {string} Hostname to look up in software/metadata/ip-address.config for resolving remote Ollama. */
const ZED_OLLAMA_HOSTNAME = "sy-omen45l";
/** @type {string} Loopback host used as the local-Ollama fallback when the remote host isn't reachable. */
const ZED_OLLAMA_DEFAULT_HOST = "127.0.0.1";
/** @type {number} Default Ollama HTTP port (upstream default). */
const ZED_OLLAMA_PORT = 11434;
/** @type {string[]} Models always included in the remote provider's `available_models`, merged with any auto-discovered models. */
const ZED_OLLAMA_FALLBACK_MODELS = ["qwen3.6:latest", "qwen2.5-coder:32b"];

/**
 * Fetches the installed model names from an Ollama host's `/api/tags`.
 * Returns an empty array on fetch failure, JSON parse error, or empty list — never throws.
 * @param {string} host - The Ollama host to query (IP or hostname, no scheme).
 * @returns {Promise<string[]>} Model names (e.g. ["qwen3.6:latest"]).
 */
async function _fetchZedOllamaModels(host) {
  const url = `http://${host}:${ZED_OLLAMA_PORT}/api/tags`;
  log(`>> zed: getting models from ${url} (curl ${url})`);
  try {
    const json = await readJson`${url}`;
    const tags = Array.isArray(json && json.models) ? json.models : [];
    return tags.map((m) => m && m.name).filter((n) => typeof n === "string" && n);
  } catch {
    return [];
  }
}

/**
 * Tries hosts in order, returns models from the first that responds non-empty.
 * Also reports which host produced the result so the caller can pick the right
 * provider key for `agent.default_model`.
 * @param {string[]} hosts - Hosts to try in priority order.
 * @returns {Promise<{ host: string|null, models: string[] }>} First non-empty result, or `{host:null, models:[]}`.
 */
async function _discoverZedOllamaModels(hosts) {
  for (const host of hosts) {
    const models = await _fetchZedOllamaModels(host);
    if (models.length > 0) return { host, models };
  }
  return { host: null, models: [] };
}

/**
 * Builds the `language_models` block + `agent.default_model` entry for Zed's settings.json.
 *
 * Always registers the local `ollama` provider (Zed auto-discovers models there).
 * When `remoteHost` is non-null, additionally registers an `openai_compatible` provider
 * keyed by `Ollama (<hostname>)` with explicit `available_models` — openai_compatible
 * doesn't auto-discover, so we list them.
 *
 * `default_model` is only set when discovery succeeded against the local Ollama host
 * (provider="ollama" is unambiguous). For remote hits we leave default_model unset and
 * let the user pick from the dropdown — openai_compatible provider key disambiguation
 * for default_model is not stable across Zed versions.
 *
 * @param {object} opts
 * @param {string[]} opts.modelNames - Model names to expose on the remote provider (discovered + fallback, deduped/sorted).
 * @param {string|null} opts.remoteHost - Resolved remote IP, or null to skip the openai_compatible entry.
 * @param {string} opts.localHost - Loopback host for the local provider.
 * @param {string} opts.hostname - Friendly hostname used in the openai_compatible provider key.
 * @param {string|null} opts.discoveredHost - Host that responded with models (null if none did).
 * @param {string|null} opts.firstDiscoveredModel - First discovered model name, used to pick the default model.
 * @returns {{ languageModels: object, defaultModel: ({provider:string, model:string})|null }}
 */
function _buildZedLanguageModelsBlock({ modelNames, remoteHost, localHost, hostname, discoveredHost, firstDiscoveredModel }) {
  /** @type {Record<string, object>} */
  const languageModels = {
    ollama: { api_url: `http://${localHost}:${ZED_OLLAMA_PORT}`, auto_discover: true },
  };
  if (remoteHost && modelNames.length > 0) {
    languageModels.openai_compatible = {
      [`Ollama (${hostname})`]: {
        api_url: `http://${remoteHost}:${ZED_OLLAMA_PORT}/v1`,
        available_models: modelNames.map((name) => ({
          name,
          display_name: name,
          max_tokens: 32768,
          capabilities: { tools: true, images: false, parallel_tool_calls: false, prompt_cache_key: false },
        })),
      },
    };
  }
  // Only set default_model when discovery hit the LOCAL Ollama — provider="ollama" is unambiguous.
  // For remote hits the openai_compatible provider key disambiguation isn't stable across Zed versions,
  // so leave default_model unset and let the user pick from the agent panel dropdown.
  const defaultModel = discoveredHost === localHost && firstDiscoveredModel ? { provider: "ollama", model: firstDiscoveredModel } : null;
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
 * @returns {object} The fully resolved settings.json content.
 */
function _getZedSettings(baseConfig, { is_prebuilt_config = false, languageModels = null, defaultModel = null } = {}) {
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

    // --- Theme: light/dark variants point to our custom themes ---
    theme: { mode: "system", light: "Sy Light", dark: "Sy Dark" },

    // --- File hiding ---
    file_scan_exclusions: EDITOR_CONFIGS.ignoredFolders.concat(EDITOR_CONFIGS.ignoredFiles),

    // --- Agent: preserve dock / tool_permissions / always_allow_tool_actions from baseConfig
    // and optionally add the discovered default_model (only set when local Ollama responded).
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

  return settings;
}

/**
 * Reads the three Zed JSONC source files. Falls back to empty objects if a file is missing
 * so a partially-populated repo (e.g. mid-rebase) doesn't crash the run.
 * @returns {Promise<{baseConfig: object, darkTheme: object, lightTheme: object}>}
 */
async function _readZedSources() {
  const baseConfig = (await readJson`software/scripts/zed-config.jsonc`) || {};
  const darkTheme = (await readJson`software/scripts/zed-color-dark.jsonc`) || {};
  const lightTheme = (await readJson`software/scripts/zed-color-light.jsonc`) || {};
  const keymap = (await readJson`software/scripts/zed-keys.common.jsonc`) || [];
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
    const remoteHost = await getHomeIpAddress(ZED_OLLAMA_HOSTNAME);
    const hostsToTry = [remoteHost, ZED_OLLAMA_DEFAULT_HOST].filter(Boolean);
    const { host: discoveredHost, models: discovered } = await _discoverZedOllamaModels(hostsToTry);
    /** @type {Set<string>} Merged model set — discovered + always-include fallbacks. */
    const modelSet = new Set(discovered);
    for (const m of ZED_OLLAMA_FALLBACK_MODELS) modelSet.add(m);
    const modelNames = [...modelSet].sort();
    if (discovered.length === 0) {
      log(
        `WARN zed: no Ollama models reachable at ${hostsToTry.map((h) => `http://${h}:${ZED_OLLAMA_PORT}/api/tags`).join(" or ")} — using fallback ${ZED_OLLAMA_FALLBACK_MODELS.join(", ")}`,
      );
    } else {
      log(`>> zed: discovered ${discovered.length} Ollama model(s) on ${discoveredHost}: ${discovered.join(", ")}`);
    }
    const { languageModels, defaultModel } = _buildZedLanguageModelsBlock({
      modelNames,
      remoteHost,
      localHost: ZED_OLLAMA_DEFAULT_HOST,
      hostname: ZED_OLLAMA_HOSTNAME,
      discoveredHost,
      firstDiscoveredModel: discovered[0] || null,
    });

    const settingsPath = path.join(targetPath, "settings.json");
    await backupConfigFile(settingsPath);
    await writeJson(settingsPath, _getZedSettings(baseConfig, { is_prebuilt_config: false, languageModels, defaultModel }));

    const darkThemePath = path.join(targetPath, "themes", ZED_DARK_THEME_FILE);
    await backupConfigFile(darkThemePath);
    await writeJson(darkThemePath, darkTheme);

    const lightThemePath = path.join(targetPath, "themes", ZED_LIGHT_THEME_FILE);
    await backupConfigFile(lightThemePath);
    await writeJson(lightThemePath, lightTheme);

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

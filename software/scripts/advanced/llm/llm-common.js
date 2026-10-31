/**
 * Shared constants and helpers for LLM CLI setup scripts (claude, copilot, gemini, opencode, pi).
 *
 * Shared keybinding helpers remain independent of editor setup. Claude additionally
 * imports editor.common.js for the shared custom-theme gate and built-in fallback registry.
 *
 * Run: `./run --files="opencode/setup.js"` (or any other llm/<name>/setup.js).
 */

// --- Shared Guidance Configuration ---

/**
 * Shared prose and PR workflow tuning, resolved into deployed guidance by resolveLLMDocPlaceholders.
 * Change values here and redeploy; callers never maintain separate defaults.
 * Token names and comments state the units; values use words, seconds, minutes, rounds, and counts.
 * Numeric tokens stay separate from LLM_DOC_PATH_PLACEHOLDERS, which holds absolute folders.
 * @type {Record<string, string>}
 */
const LLM_DOC_TUNING_PLACEHOLDERS = {
  /** Maximum words per prose sentence when writing or revising guidance and replies. */
  "<<SY_PROSE_SENTENCE_MAX_WORDS>>": "30",
  /** Run duration in keepalive rounds, unless the invocation overrides it. */
  "<<SY_PR_RUN_BUDGET_ROUNDS>>": "12", // 4 hours at the default keepalive
  /** How often a quiet PR is re-probed read-only for a state change. */
  "<<SY_PR_POLL_INTERVAL_SECONDS>>": "60", // 1 minute
  /** Maximum interval between full passes, even when no state changed. */
  "<<SY_PR_KEEPALIVE_INTERVAL_SECONDS>>": "1200", // 20 minutes
  /** How long to wait between retries of an unreachable GitHub / model call. */
  "<<SY_PR_RETRY_INTERVAL_SECONDS>>": "15",
  /** How many consecutive unreachable retries end the run. */
  "<<SY_PR_RETRY_MAX_FAILURES>>": "5",
  /** How many actionable review comments activate babysit remediation. */
  "<<SY_PR_REVIEW_CHANGE_THRESHOLD>>": "5",
  /** Maximum wait for one CI cycle during PR reconciliation. */
  "<<SY_CI_WAIT_MINUTES>>": "20",
  /** Maximum total runtime for PR feedback and CI reconciliation. */
  "<<SY_CI_RECONCILIATION_BUDGET_MINUTES>>": "120",
};

// --- OS Modifier Keys (local mirror of editor.common.js bits the LLM scripts need) ---

/**
 * OS modifier key used on Windows/Linux for LLM CLI keybindings.
 * Mirrors `EDITOR_WINDOWS_OS_KEY` from editor.common.js so llm/(name)/setup.js scripts can
 * drop the `// SOURCE editor.common.js` line and stay self-contained.
 * @type {string}
 */
const LLM_WINDOWS_OS_KEY = "alt";

/**
 * Mac-side OS modifier key map keyed by LLM source. Mirrors the `opencode` entry that
 * `EDITOR_MAC_OS_KEYS` would have served via `getEditorOsKey("opencode", isMac)`.
 * Default fallback is `"super"` so any unknown source still resolves to a sensible mac key.
 * @type {Record<string, string>}
 */
const LLM_MAC_OS_KEYS = { opencode: "super" };

/**
 * Resolves the OS-specific modifier key for an LLM CLI's keybindings. Direct local mirror
 * of editor.common.js's `getEditorOsKey` so the llm/* scripts no longer SOURCE that file.
 *
 * @param {string} source - The LLM source name (e.g. `"opencode"`).
 * @param {boolean} [isOsMac] - Override for macOS detection. When omitted, uses the global `is_os_mac` flag.
 * @returns {string} The resolved modifier key (`"alt"` on Windows/Linux, mac-specific otherwise).
 */
function getLLMOsKey(source, isOsMac) {
  const isMac = isOsMac !== undefined ? isOsMac : is_os_mac;
  return isMac ? LLM_MAC_OS_KEYS[source] || "super" : LLM_WINDOWS_OS_KEY;
}

// --- Managed Instructions Block Markers ---

/**
 * Marker key used by every LLM CLI's instructions deploy (CLAUDE.md, AGENTS.md, GEMINI.md,
 * opencode's AGENTS.md) to wrap the managed engineering principles block. The key embeds
 * the source-of-truth path so anyone opening a generated rules file immediately sees where
 * the managed content originates and where to edit it.
 *
 * Shape on disk: `<!-- BEGIN synle/bashrc | software/scripts/advanced/llm/_common/v_current/instructions.md -->`
 *                ... managed content ...
 *                `<!-- END synle/bashrc | software/scripts/advanced/llm/_common/v_current/instructions.md -->`
 *
 * Shared so all four CLI setups stay in lockstep — changing this here updates claude,
 * copilot, gemini, and opencode in one edit.
 * @type {string}
 */
const LLM_INSTRUCTIONS_MARKER = "synle/bashrc | software/scripts/advanced/llm/_common/v_current/instructions.md";

/**
 * Previous source-path marker retained only to migrate deployed blocks without duplication.
 * @type {string}
 */
const LLM_INSTRUCTIONS_PREVIOUS_MARKER = "synle/bashrc | software/scripts/advanced/llm/_common/instructions.md";

/**
 * Legacy marker key used by every LLM CLI's instructions deploy before the descriptive-key
 * migration. Each `setup.js` calls `removeBlock(existing, LLM_INSTRUCTIONS_LEGACY_MARKER, ...)`
 * before upserting under `LLM_INSTRUCTIONS_MARKER` so the rename doesn't append a duplicate
 * block alongside the old one. Idempotent — once the legacy block is gone, the call is a no-op.
 * Safe to keep around indefinitely.
 * @type {string}
 */
const LLM_INSTRUCTIONS_LEGACY_MARKER = "managed-rules";

// --- Shared MCP Server Registry ---

/**
 * Repo-relative path to the cross-CLI MCP server registry. Each per-CLI
 * `setup.js` reads this file via `loadSharedMcpServers()` and merges the
 * entries into the CLI's native MCP config location. Authored in the
 * standard `mcpServers` shape (Claude / Copilot / Gemini / Pi consume verbatim;
 * OpenCode translates via `_translateToOpencodeMcp()`).
 * @type {string}
 */
const SHARED_MCP_REGISTRY_PATH = "software/scripts/advanced/llm/_common/mcp-servers.jsonc";

/** @type {string[]} Supported deployment identities for registry-only client exclusions. */
const SHARED_MCP_CLIENTS = ["claude", "copilot", "gemini", "opencode", "pi"];

/** @type {string} Reserved native server-name prefix identifying bootstrap-owned MCP entries. */
const SHARED_MCP_NAME_PREFIX = "sy-";

/**
 * Loads the shared MCP server registry from `_common/mcp-servers.jsonc` and
 * returns the inner `mcpServers` map (an object of `name → server-config`).
 * Returns an empty object when the file is missing, unreadable, or the
 * `mcpServers` key is absent — callers can iterate the result without
 * additional guards.
 *
 * Resolves the registry-only `argsOnMac` key: on macOS it replaces `args`,
 * elsewhere it is ignored. Registry-only excludeClients filters named clients.
 * Both metadata keys are stripped before native configuration is returned.
 *
 * @param {boolean} [isOsMac] - Override for macOS detection. When omitted, uses the global `is_os_mac` flag.
 * @param {string} [client="all"] - Deployment identity; all returns the unfiltered inventory.
 * @returns {Promise<Record<string, any>>} Eligible server configs in standard shape.
 * @throws {TypeError} On an unknown client or malformed excludeClients metadata; no configuration is written.
 */
async function loadSharedMcpServers(isOsMac, client = "all") {
  if (client !== "all" && !SHARED_MCP_CLIENTS.includes(client)) throw new TypeError("Unknown MCP deployment client");
  const isMac = isOsMac !== undefined ? isOsMac : is_os_mac;
  /** @type {{ mcpServers?: Record<string, any> } | null} */
  const json = await readJson`${SHARED_MCP_REGISTRY_PATH}`;
  if (!json || typeof json !== "object") return {};
  /** @type {Record<string, any>} */
  const servers = json.mcpServers && typeof json.mcpServers === "object" ? json.mcpServers : {};
  /** @type {Record<string, any>} */
  const resolved = {};
  for (const [name, entry] of Object.entries(servers)) {
    if (!entry || typeof entry !== "object") {
      resolved[name] = entry;
      continue;
    }
    const { argsOnMac, excludeClients, ...rest } = entry;
    if (
      excludeClients !== undefined &&
      (!Array.isArray(excludeClients) || excludeClients.some((item) => !SHARED_MCP_CLIENTS.includes(item)))
    ) {
      throw new TypeError("MCP excludeClients must be an array of supported client names");
    }
    if (excludeClients?.includes(client)) continue;
    resolved[name] = isMac && Array.isArray(argsOnMac) ? { ...rest, args: argsOnMac } : rest;
  }
  return resolved;
}

/**
 * Translates ONE server entry from the standard `mcpServers` shape (used by
 * Claude / Copilot / Gemini) into the opencode-native `mcp` shape. Handles:
 *
 *   Local stdio (standard `{ command, args, env }`) →
 *     `{ type: "local", command: [command, ...args], environment: env, enabled: true }`
 *
 *   Remote URL  (standard `{ url, headers }`) →
 *     `{ type: "remote", url, headers, enabled: true }`
 *
 * Entries that don't look like either shape are returned with `type` left
 * undefined so opencode surfaces the schema error at load time instead of
 * silently dropping the server.
 *
 * @param {any} entry - Server config in the standard `mcpServers` shape.
 * @returns {Record<string, any>} Opencode-shaped server config.
 */
function _translateToOpencodeMcp(entry) {
  if (entry && typeof entry === "object") {
    if (typeof entry.command === "string") {
      /** @type {string[]} CLI tokens — opencode expects a single array, not [command, args]. */
      const command = [entry.command, ...(Array.isArray(entry.args) ? entry.args : [])];
      /** @type {Record<string, any>} */
      const out = { type: "local", command, enabled: true };
      if (entry.env && typeof entry.env === "object") out.environment = entry.env;
      return out;
    }
    if (typeof entry.url === "string") {
      /** @type {Record<string, any>} */
      const out = { type: "remote", url: entry.url, enabled: true };
      if (entry.headers && typeof entry.headers === "object") out.headers = entry.headers;
      return out;
    }
  }
  // Unknown shape — pass through so opencode reports the schema error.
  return entry;
}

/**
 * Translates a whole `name → standard-config` map into a `name → opencode-config`
 * map suitable for writing under `opencode.json::mcp`. Thin loop on top of
 * `_translateToOpencodeMcp` so the per-CLI deploy stays one line.
 *
 * @param {Record<string, any>} servers - Standard-shape map (e.g. result of `loadSharedMcpServers`).
 * @returns {Record<string, any>} Opencode-shape map keyed by the same names.
 */
function translateMcpServersForOpencode(servers) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const [name, entry] of Object.entries(servers || {})) {
    out[name] = _translateToOpencodeMcp(entry);
  }
  return out;
}

/**
 * Reconciles bootstrap-owned MCP servers in a native client config file.
 * Removes every reserved-prefix name and exact bare registry name, including excluded entries.
 * Adds eligible servers with the reserved prefix; preserves unrelated servers and top-level keys.
 * OpenCode overlays generated settings in the same backed-up write. No work means no write.
 * @param {string} targetPath - Native user config file to read, back up, and write.
 * @param {Record<string, any>} [managedConfig={}] - Other managed top-level settings.
 * @param {"standard" | "opencode"} [format="standard"] - Native MCP schema.
 * @param {string} [client="all"] - Deployment identity used to select servers after cleanup.
 * @returns {Promise<void>} Resolves after reconciliation or a no-change skip.
 * @throws {Error} On unreadable or malformed existing config, unsupported format,
 * backup failure, or write failure. Invalid existing files are never overwritten.
 */
async function deploySharedMcpServers(targetPath, managedConfig = {}, format = "standard", client = "all") {
  if (format !== "standard" && format !== "opencode") {
    throw new TypeError("Unsupported MCP config format");
  }
  /** @type {string} Native server-map key. */
  const key = format === "opencode" ? "mcp" : "mcpServers";
  /** @type {Record<string, any>} Resolved standard-shape registry entries. */
  const servers = await loadSharedMcpServers(undefined, client);
  /** @type {Set<string>} Complete bare inventory, including servers excluded for this client. */
  const bareNames = new Set(Object.keys(await loadSharedMcpServers()));

  /** @type {string} Raw local bytes; readJson's parse-error fallback would lose user data. */
  let content = "";
  try {
    content = fs.readFileSync(targetPath, "utf-8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  /** @type {Record<string, any>} Existing config, empty only for missing or empty files. */
  let existing = {};
  try {
    // The older parseJsonWithComments helper evaluates JavaScript on parse errors.
    existing = content.trim() ? JSON.parse(stripJsoncComments(content)) : {};
  } catch {
    // Do not include raw parser errors: they can contain credentials from the file.
    throw new TypeError("MCP configuration must contain valid JSON or JSONC");
  }
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
    throw new TypeError("MCP configuration must be an object");
  }
  if (key in existing && (!existing[key] || typeof existing[key] !== "object" || Array.isArray(existing[key]))) {
    throw new TypeError(`MCP configuration ${key} must be an object`);
  }
  /** @type {Record<string, any>} User-owned servers surviving exact-name and reserved-prefix cleanup. */
  const preserved = Object.fromEntries(
    Object.entries(existing[key] || {}).filter(([name]) => !name.startsWith(SHARED_MCP_NAME_PREFIX) && !bareNames.has(name)),
  );
  /** @type {Record<string, any>} Eligible registry entries keyed by their native owned names. */
  const namedServers = Object.fromEntries(Object.entries(servers).map(([name, entry]) => [`${SHARED_MCP_NAME_PREFIX}${name}`, entry]));
  if (
    Object.keys(servers).length === 0 &&
    Object.keys(managedConfig).length === 0 &&
    Object.keys(preserved).length === Object.keys(existing[key] || {}).length
  )
    return;
  /** @type {Record<string, any>} Existing top-level settings with managed settings overlaid. */
  const merged = { ...existing, ...managedConfig };
  if (key in existing || Object.keys(servers).length > 0) {
    merged[key] = {
      ...preserved,
      ...(format === "opencode" ? translateMcpServersForOpencode(namedServers) : namedServers),
    };
  }
  log(`>> MCP: deploying ${Object.keys(servers).length} shared server(s):`, targetPath);
  await backupConfigFile(targetPath);
  await writeJson(targetPath, merged);
}

// --- Ollama Provider Discovery ---

/**
 * Default Ollama HTTP port (upstream default).
 * @type {number}
 */
const OLLAMA_PORT = 11434;

/** Per-run file shared by LLM setup scripts for Ollama discovery results. */
const OLLAMA_DISCOVERY_CACHE_PATH =
  typeof BASHRC_TEMP_DIR === "string" && BASHRC_TEMP_DIR ? path.join(BASHRC_TEMP_DIR, "llm_ollama_models.json") : "";

// --- Ollama Model Inventory (single source of truth) ---
//
// EVERY Ollama model tag this repo knows about is named once, in OLLAMA_MODELS_BY_VRAM
// below: each tier picks one model per role. The per-consumer lists are DERIVED —
// never hand-maintain a second list:
//   AUTOCOMPLETE_MODELS      Zed edit_predictions (tiers smallest → largest)
//   LLM_LOCAL_AGENT_MODELS   opencode `local` agent (tiers largest → smallest)
//   getOllamaModelsForVram   what ollama-models.personal.js pulls for a given VRAM size
// A model pulled by hand that is not in a tier still works: opencode and Zed discover
// it from /api/tags, it just gets no `local` agent slot.
//
// Roles:
//   agent        instruct checkpoints (no `-base`): chat templates + tool calls for
//                opencode, the Zed agent panel, and VS Code Copilot Chat (BYOK).
//   vision       multimodal (OCR, document reading, image tagging).
//   autocomplete `-base` only: the FIM tokens (<|fim_prefix|> / <|fim_suffix|> /
//                <|fim_middle|>) exist only in base checkpoints; `-instruct` replies
//                chat-style and drifts past the cursor. Zed only — VS Code has no
//                inline-completion API for custom endpoints.
//
// Upstream tags only — every row must exist on the public registry. Verify with
// (200 = exists, 404 = not upstream):
//   curl -s -o /dev/null -w '%{http_code}' \
//     -H 'Accept: application/vnd.docker.distribution.manifest.v2+json' \
//     https://registry.ollama.ai/v2/library/<name>/manifests/<tag>
// A listing is not proof of pullability: the registry refuses `-nvfp4` tags off macOS
// with `412: this model requires macOS`.
//
// Wipe every pulled model by hand (frees the multi-GB blobs):
//   ollama list | awk 'NR > 1 { print $1 }' | xargs -n 1 ollama rm
//   ollama rm qwen2.5-coder:3b                       # one model
// WSL (`ollama` is aliased to the Windows host ollama.exe by ollama.profile.bash):
//   ollama.exe list | tr -d '\r' | awk 'NR > 1 { print $1 }' | xargs -n 1 ollama.exe rm

/**
 * VRAM tiers, largest first — the Ollama model inventory, loaded from
 * `llm-models.jsonc` (see that file for tier and size notes). The SOURCE marker
 * inlines the array; `.flat()` unwraps it, and yields `[]` if the marker is left
 * unexpanded, which the guard below turns into a loud failure.
 * @type {Array<{ id: string, minVramMib: number, description: string, models: Array<{ tag: string, role: "agent"|"vision"|"autocomplete" }> }>}
 */
const OLLAMA_MODELS_BY_VRAM = [
  // SOURCE software/scripts/advanced/llm/llm-models.jsonc
].flat();
if (OLLAMA_MODELS_BY_VRAM.length === 0) {
  throw new Error("OLLAMA_MODELS_BY_VRAM is empty: llm-models.jsonc was not inlined by its SOURCE marker");
}

/**
 * Lists one role's tags across the tiers, de-duplicated, in the given tier order.
 * @param {"agent"|"vision"|"autocomplete"} role - Which role to collect.
 * @param {"largestFirst"|"smallestFirst"} order - Tier walk direction.
 * @returns {string[]} Unique tags.
 */
function _getOllamaTierModels(role, order) {
  const tiers = order === "smallestFirst" ? [...OLLAMA_MODELS_BY_VRAM].reverse() : OLLAMA_MODELS_BY_VRAM;
  const tags = tiers.flatMap((t) => t.models.filter((m) => m.role === role).map((m) => m.tag));
  return [...new Set(tags)];
}

/**
 * Resolves the VRAM tier for a host.
 * @param {number} vramMib - Largest GPU's VRAM in MiB (0 = unknown).
 * @returns {{ id: string, minVramMib: number, description: string }} The first tier the host meets; `tiny` when none.
 */
function getOllamaVramTier(vramMib) {
  const safeVram = Number.isFinite(vramMib) && vramMib > 0 ? vramMib : 0;
  return OLLAMA_MODELS_BY_VRAM.find((t) => safeVram >= t.minVramMib) || OLLAMA_MODELS_BY_VRAM.at(-1);
}

/**
 * Lists the model tags to auto-pull for a host's VRAM.
 * @param {number} vramMib - Largest GPU's VRAM in MiB (0 = unknown → tiny tier).
 * @returns {string[]} The resolved tier's model tags, in `models` order.
 */
function getOllamaModelsForVram(vramMib) {
  return getOllamaVramTier(vramMib).models.map((m) => m.tag);
}

/**
 * Fetches the installed model names from an Ollama host's `/api/tags` endpoint.
 * Mirrors zed.js's `_fetchZedOllamaModels`. Returns an empty array on fetch failure,
 * JSON parse error, or empty list — never throws.
 *
 * @param {string} host - The Ollama host to query (IP or hostname, no scheme).
 * @returns {Promise<string[]>} Model names (e.g. `["qwen2.5-coder:14b"]`).
 */
async function _fetchOllamaModelNames(host) {
  const url = `http://${host}:${OLLAMA_PORT}/api/tags`;
  log(`>> ollama: getting models from ${url} (curl ${url})`);
  try {
    const json = await readJson`${url}`;
    const tags = Array.isArray(json && json.models) ? json.models : [];
    return tags.map((m) => m && m.name).filter((n) => typeof n === "string" && n);
  } catch {
    return [];
  }
}

/**
 * The one reachability rule for Ollama hosts: probes `/api/tags` on every host from
 * `getOllamaHosts()` (index.js — tagged `OLLAMA_REMOTE` servers, default first, then
 * `127.0.0.1`) and keeps only hosts that answer with at least one model. A host that is
 * unreachable, or reachable with no models, is skipped and never registered anywhere.
 * Probes are bounded by the `readJson` fetch timeout, so a dead host cannot stall setup.
 * Work profiles return immediately without probing local or personal-network endpoints.
 * @returns {Promise<Array<{ip: string, hostname: string, isDefault: boolean, isLocal: boolean, models: string[]}>>}
 *   Reachable hosts in `getOllamaHosts()` order; `[]` when none serve a model.
 */
async function getReachableOllamaHosts() {
  if (is_work_profile) return [];

  const reachable = [];
  for (const host of await getOllamaHosts()) {
    const models = await _fetchOllamaModelNames(host.ip);
    if (models.length === 0) {
      log(`>> ollama: skipping ${host.hostname} (${host.ip}) — unreachable or no models`);
      continue;
    }
    reachable.push({ ...host, models });
  }
  return reachable;
}

/**
 * Discovers reachable Ollama providers and the models they expose, returning input objects
 * shaped for downstream config builders (e.g. opencode's `_buildOpencodeConfig`).
 *
 * One provider entry per host from `getReachableOllamaHosts()`: the remote servers
 * tagged `OLLAMA_REMOTE` in `software/metadata/ip-address.config` (default server
 * first), then `127.0.0.1` — each only when it answers `/api/tags` with at least one
 * model. Unreachable or empty hosts never become a provider.
 *
 * No hostname or address is hardcoded: hosts are selected by tag, and a config with no
 * `OLLAMA_REMOTE` host means only localhost is probed. Provider ids and labels come
 * from the hostname written in the config (`ollama-local` for the loopback host).
 *
 * Models are NOT hardcoded either: every reachable host contributes whatever `/api/tags` reports.
 *
 * @returns {Promise<Array<{id: string, name: string, baseURL: string, models: Array<{name: string}>}>>}
 *   Empty array if no host is reachable.
 */
async function getOllamaProviderInputs() {
  if (OLLAMA_DISCOVERY_CACHE_PATH && fs.existsSync(OLLAMA_DISCOVERY_CACHE_PATH)) {
    try {
      const cached = JSON.parse(fs.readFileSync(OLLAMA_DISCOVERY_CACHE_PATH, "utf-8"));
      if (cached?.version === 1 && Array.isArray(cached.providers)) {
        log(`>> ollama: using cached discovery (${OLLAMA_DISCOVERY_CACHE_PATH})`);
        return cached.providers;
      }
    } catch (err) {
      log(">> ollama: ignoring invalid discovery cache", err);
    }
  }

  const providers = (await getReachableOllamaHosts()).map(({ ip, hostname, models }) => ({
    id: `ollama-${hostname}`,
    name: `${hostname.charAt(0).toUpperCase()}${hostname.slice(1)}·${ip}:${OLLAMA_PORT}`,
    baseURL: `http://${ip}:${OLLAMA_PORT}/v1`,
    models: models.map((name) => ({ name })),
  }));
  for (const p of providers) {
    log(`>> ollama: discovered ${p.models.length} model(s) on ${p.id}: ${p.models.map((m) => m.name).join(", ")}`);
  }
  if (OLLAMA_DISCOVERY_CACHE_PATH) {
    fs.mkdirSync(path.dirname(OLLAMA_DISCOVERY_CACHE_PATH), { recursive: true });
    fs.writeFileSync(OLLAMA_DISCOVERY_CACHE_PATH, JSON.stringify({ version: 1, providers }, null, 2) + "\n");
  }
  return providers;
}

/** Returns the Windows user home for WSL setup, or the current home elsewhere. */
function getLLMConfigHome() {
  return is_os_windows ? getWindowUserBaseDir() : BASE_HOMEDIR_LINUX;
}

/**
 * Returns every LLM config home that setup must refresh for the current host.
 * WSL is both a Linux runtime and a Windows host, so it receives independent
 * config files in both homes. Auth stores are not included and remain owned by
 * their existing CLI-specific setup.
 * @returns {string[]} Config homes to refresh, without duplicates.
 */
function getLLMConfigHomes() {
  if (!is_os_wsl) return [getLLMConfigHome()];
  return [...new Set([BASE_HOMEDIR_LINUX, getWindowUserBaseDir()])].filter(Boolean);
}

/**
 * Chooses a model actually exposed by the default reachable Ollama provider.
 * Preferred agent models win when installed; otherwise the host's first model is
 * used, so a newly-installed or custom Ollama model remains usable by shell tools.
 * @param {Array<{id: string, models: Array<{name: string}>}>} providers - Discovered Ollama providers, default host first.
 * @returns {string|null} A model tag served by the default provider, or null when none are available.
 */
function getOllamaDefaultModel(providers) {
  const defaultProvider = providers[0];
  const modelNames = (defaultProvider?.models || []).map((model) => model && model.name).filter((name) => typeof name === "string" && name);
  if (modelNames.length === 0) return null;

  const preferred = _getOllamaTierModels("agent", "largestFirst");
  return preferred.find((tag) => modelNames.includes(tag)) || modelNames[0];
}

// --- Editor Autocomplete Provider Discovery ---

/**
 * FIM-capable autocomplete models in priority order — smallest/fastest first.
 *
 * Why `-base` variants only: only the base checkpoints of qwen2.5-coder carry the
 * `<|fim_prefix|>` / `<|fim_suffix|>` / `<|fim_middle|>` tokens that Zed's edit-prediction
 * (and other FIM clients) inject for inline completion. The `-instruct` variants strip
 * those tokens and produce chatty, suggestion-style replies that drift past the cursor.
 *
 * Order rationale: inline autocomplete fires on EVERY keystroke, so latency and parallel
 * throughput dominate quality wins from larger models. A laptop with only the 1.5B variant
 * still gets useful completions; a desktop with the 7B variant only reaches it after the
 * 1.5B and 3B aren't present (intentional — keeps the lighter model on the hot path).
 *
 * Derived from the tiers' `autocomplete` models, smallest tier first.
 *
 * @type {string[]}
 */
const AUTOCOMPLETE_MODELS = _getOllamaTierModels("autocomplete", "smallestFirst");

/**
 * Picks the best Ollama host + model for editor inline autocomplete (Zed's
 * `edit_predictions`). Currently Zed-only — VS Code has no native inline-completion API
 * for custom endpoints (Copilot Chat handles only chat-side BYOK via chatLanguageModels.json).
 *
 * Priority is the INVERSE of `getOllamaProviderInputs`: `127.0.0.1` is probed FIRST and
 * the `OLLAMA_REMOTE` servers (default first) only as LAN fallbacks. Reason: autocomplete fires per keystroke; localhost
 * round-trip (~sub-ms) beats LAN (~5-20ms+ on residential WiFi), and a dead remote host
 * shouldn't add network round-trips to every typing event. Agent/chat traffic (the
 * `getOllamaProviderInputs` use case) is happy to prefer the beefier remote box because
 * its requests are user-initiated and few — different tradeoff, different priority.
 *
 * Within each reachable host, the first model in `preferred` that appears in `/api/tags`
 * wins. So a laptop with only `qwen2.5-coder:1.5b-base` uses that; a desktop with all three
 * still picks the smallest (see AUTOCOMPLETE_MODELS rationale above).
 *
 * Returns `null` when no host has any preferred model. Callers MUST then omit the
 * autocomplete config block entirely — leaving a stale endpoint configured would make the
 * editor hammer a dead host on every keystroke. With the block absent, each editor keeps
 * whatever its own base config declares: Zed keeps zed-config.jsonc's catch-all
 * `edit_predictions.disabled_globs` entry, so inline AI stays fully off rather than
 * falling through to Zed's cloud Zeta; vanilla VSCode has no inline completion at all.
 *
 * Network reachability is bounded by `_URL_FETCH_TIMEOUT_MS` (3s) in `_readTextFromURL`
 * via the existing `AbortSignal.timeout` in `readJson`, so an offline remote server
 * can't stall setup.
 *
 * Same reachable-host list as `getOllamaProviderInputs` (`getReachableOllamaHosts()`),
 * with the loopback entry moved to the front.
 *
 * @param {string[]} [preferred=AUTOCOMPLETE_MODELS] - Acceptable model tags in priority order.
 * @returns {Promise<{host: string, port: number, model: string}|null>} Picked host+model or null.
 */
async function getAutocompleteProvider(preferred = AUTOCOMPLETE_MODELS) {
  // Localhost FIRST, remote servers after. Reverse of getOllamaProviderInputs (see JSDoc).
  const reachable = await getReachableOllamaHosts();
  for (const { ip, models } of [...reachable.filter((h) => h.isLocal), ...reachable.filter((h) => !h.isLocal)]) {
    const match = preferred.find((m) => models.includes(m));
    if (match) {
      log(`>> autocomplete: picked ${match} on ${ip}`);
      return { host: ip, port: OLLAMA_PORT, model: match };
    }
    log(`>> autocomplete: ${ip} reachable but no preferred model present (saw: ${models.join(", ")})`);
  }
  return null;
}

// --- ACP (Agent Client Protocol) Agent Discovery ---

/**
 * How each LLM CLI this repo installs enters ACP server mode — the single registry of
 * that knowledge, consumed by editor integrations (currently `zed.js`, which translates
 * these generic entries into Zed's `agent_servers` settings shape). Adding a new
 * ACP-capable CLI means one row here, never a per-editor list.
 *
 * Two shapes, distinguished by which key is set:
 *
 *   - `args` — the CLI speaks ACP itself. The editor spawns `<binary> <args...>` and
 *     talks the protocol over the child's stdio. Verified against the installed CLIs:
 *     `opencode acp` (subcommand, `opencode --help`) and `copilot --acp` (flag,
 *     `copilot --help`).
 *   - `executableEnvKey` — the CLI does NOT speak ACP (Claude Code has no `--acp` flag).
 *     The editor supplies its own vendored ACP adapter, and this env var points that
 *     adapter at our locally-installed CLI instead of the copy it bundles, so the agent
 *     inherits this repo's config, skills, and auth.
 *
 * Gemini CLI is deliberately absent: it does support ACP (`gemini --acp`), but Zed ships
 * `gemini` as a built-in registry agent that manages its own install, and a same-named
 * custom entry would shadow it for no gain.
 *
 * @type {Array<{id: string, displayName: string, binary: string, args?: string[], executableEnvKey?: string}>}
 */
const LLM_ACP_AGENTS = [
  { id: "claude", displayName: "Claude Code", binary: "claude", executableEnvKey: "CLAUDE_CODE_EXECUTABLE" },
  { id: "opencode", displayName: "OpenCode", binary: "opencode", args: ["acp"] },
  { id: "copilot", displayName: "Copilot CLI", binary: "copilot", args: ["--acp"] },
];

/**
 * Resolves a binary name to its absolute path. JS analog of the bash
 * `has_persistent_binary` helper: `/tmp/` hits are rejected so a throwaway bootstrap copy
 * can never get baked into a config file that outlives the run.
 *
 * @param {string} binary - Binary name to resolve (e.g. "opencode").
 * @returns {Promise<string|null>} Absolute path, or null when not installed persistently.
 */
async function _resolveAcpBinaryPath(binary) {
  // `|| true` keeps a missing binary from throwing — `type -P` exits 1 when nothing matches.
  const resolved = (await execBash(`type -P ${binary} 2>/dev/null || true`)).trim();
  if (!resolved || resolved.startsWith("/tmp/")) return null;
  return resolved;
}

/**
 * Discovers which ACP-capable LLM CLIs are actually installed on this machine and returns
 * them with absolute paths resolved, shaped for downstream editor config builders.
 *
 * Absolute paths (not bare names) on purpose: editors spawn agents from a GUI process
 * whose PATH may not include `$HOME/.local/bin`, where `npm_install_global` puts these
 * CLIs. Missing CLIs are dropped entirely so the caller never writes a dead entry that
 * fails only when the user clicks it.
 *
 * @returns {Promise<Array<{id: string, displayName: string, binaryPath: string, args?: string[], executableEnvKey?: string}>>}
 *   Empty array when none of the CLIs are installed.
 */
async function getAcpAgentInputs() {
  /** @type {Array<{id: string, displayName: string, binaryPath: string, args?: string[], executableEnvKey?: string}>} */
  const agents = [];
  for (const agent of LLM_ACP_AGENTS) {
    const binaryPath = await _resolveAcpBinaryPath(agent.binary);
    if (!binaryPath) {
      log(`>> acp: dropping ${agent.id} — \`${agent.binary}\` not installed`);
      continue;
    }
    log(`>> acp: discovered ${agent.id} at ${binaryPath}`);
    agents.push({ ...agent, binaryPath });
  }
  return agents;
}

// --- Agent → Model Registry (which model drives which task, per CLI) ---

/**
 * Provider key for GitHub Copilot models, as opencode names it. Model IDs are
 * qualified `<provider>/<model>` everywhere, so this is the one place the prefix
 * is spelled out.
 * @type {string}
 */
const LLM_COPILOT_PROVIDER_ID = "github-copilot";

/**
 * GitHub Copilot discovery hides some account-available models from client catalogs.
 * This shared list is intentionally consumed only by the Pi and OpenCode setup
 * adapters today. Those adapters extend, rather than replace, each native catalog;
 * add another consumer only when its provider config preserves native metadata.
 * @type {Record<string, {fast?: {options: {speed: string}, headers: Record<string, string>}}>}
 */
const LLM_COPILOT_MODEL_EXTENSIONS = {
  // Add only models verified available through the GitHub Copilot provider.
};

/**
 * Whether opencode's DEFAULT agent (`build`) gets a PINNED GitHub Copilot model.
 *
 * OFF on purpose. `build` is the agent opencode starts every session on, so a `model`
 * there does not act as a default — it acts as an override the model picker cannot beat:
 * the agent's own model wins on every turn, so a model chosen in the TUI is discarded the
 * moment `build` runs. With the pin off, the `build` row resolves to `null` and no
 * `agent.build` key is written at all, leaving opencode on whatever the user selected.
 *
 * Flip to `true` to hand opencode a fixed default again — `build` then pins
 * `OPENCODE_PINNED_DEFAULT_MODEL`. Roles a user invokes deliberately (`plan`, `review`,
 * `local`) keep their pins either way; only the always-on default is gated here.
 * @type {boolean}
 */
const IS_OPENCODE_DEFAULT_MODEL_PINNED = false;

/**
 * The model `build` pins when `IS_OPENCODE_DEFAULT_MODEL_PINNED` is on — the GitHub
 * Copilot default. Declared even while the pin is off so flipping the flag is a one-word
 * edit and the intended model stays documented rather than deleted.
 * @type {string}
 */
const OPENCODE_PINNED_DEFAULT_MODEL = `${LLM_COPILOT_PROVIDER_ID}/claude-opus-5`;

/**
 * Local (Ollama) agent model tags in priority order — first tag that a reachable
 * Ollama host actually serves wins. Derived from the tiers' `agent` models, largest
 * tier first (best model wins); the `-base` FIM tags are deliberately
 * absent (they are completion checkpoints, not chat agents).
 *
 * Never hardcode one tag: a laptop with no local daemon and a workstation with a
 * 35B MoE must both resolve without an edit here, and an unresolvable list means
 * the `local` agent is simply omitted rather than pointed at a dead model.
 * @type {string[]}
 */
const LLM_LOCAL_AGENT_MODELS = _getOllamaTierModels("agent", "largestFirst");

/**
 * The single registry mapping a TASK ROLE to the model each LLM CLI should run it on.
 *
 * Outer keys are roles (`build`, `plan`, `review`, `local`). Inner keys are the CLI
 * FOLDER NAMES under `software/scripts/advanced/llm/` (`claude`, `copilot`, `gemini`,
 * `opencode`) so a consumer looks itself up by the folder it lives in and never needs a
 * name-translation table — that is the whole point of this map existing here rather than
 * inside one CLI's setup.js.
 *
 * A value is **the object that CLI needs, verbatim**, or `null` when that CLI has no
 * per-agent model surface. Only opencode has one today (`agent` in `opencode.json`,
 * https://opencode.ai/docs/agents/). Claude Code, Copilot CLI, and Gemini CLI pick their
 * model globally or interactively, so their entries are `null` — an explicit "known to be
 * unsupported", not a gap. A consumer MUST treat `null`/missing as "write nothing":
 * inventing a shape for a CLI that has no such key is how a config file becomes invalid.
 *
 * Permissions normally inherit the top-level `permission: "allow"`. The `general`
 * dispatcher explicitly permits `task` so OpenCode does not inject a child-session
 * deny; it leaves the model inherited. The `review` role retains its edit deny.
 *
 * The `local` opencode entry carries `models` (a preference list) instead of `model`,
 * because the winning tag depends on which Ollama host is reachable at setup time.
 * `resolveOpencodeAgentConfig()` turns it into a concrete `model` and drops the agent
 * entirely when nothing local is reachable.
 *
 * `build`'s opencode entry is additionally gated on `IS_OPENCODE_DEFAULT_MODEL_PINNED`,
 * which is OFF: pinning a model on the agent opencode starts every session on overrides
 * the TUI picker rather than seeding it. `null` there means "no pin", not "unsupported".
 *
 * @type {Record<string, Record<string, object|null>>}
 */
const AGENT_TO_MODEL_MAP = {
  build: {
    claude: null,
    copilot: null,
    gemini: null,
    // Gated on IS_OPENCODE_DEFAULT_MODEL_PINNED — `null` (the documented "write nothing"
    // value) when the pin is off, so opencode.json carries no `agent.build` and the model
    // picked in the TUI stands instead of being overridden on every turn.
    opencode: IS_OPENCODE_DEFAULT_MODEL_PINNED ? { mode: "primary", model: OPENCODE_PINNED_DEFAULT_MODEL } : null,
  },
  general: {
    claude: null,
    copilot: null,
    gemini: null,
    opencode: { permission: { task: "allow" } },
  },
  plan: {
    claude: null,
    copilot: null,
    gemini: null,
    opencode: { mode: "primary", model: `${LLM_COPILOT_PROVIDER_ID}/gpt-5.5` },
  },
  review: {
    claude: null,
    copilot: null,
    gemini: null,
    opencode: {
      description: "Review code for correctness, regressions, security issues, and missing tests.",
      mode: "subagent",
      model: `${LLM_COPILOT_PROVIDER_ID}/claude-opus-4.8`,
      permission: { edit: "deny", bash: "allow" },
    },
  },
  local: {
    claude: null,
    copilot: null,
    gemini: null,
    opencode: {
      description: "Use the local Ollama models for fast, private, low-cost work.",
      mode: "subagent",
      models: LLM_LOCAL_AGENT_MODELS,
    },
  },
};

/**
 * Resolves `AGENT_TO_MODEL_MAP` into opencode's `agent` config object.
 *
 * Two things happen here that a raw map read cannot do:
 *   1. A `models` preference list (the `local` agent) collapses to the first
 *      `<providerId>/<tag>` actually served by a discovered provider. No match →
 *      the agent is dropped, so opencode never offers an agent whose model 404s.
 *   2. Roles whose opencode value is `null` are skipped.
 * Model-less entries pass through so built-in agents retain model inheritance.
 *
 * Returns `{}` when nothing resolves, letting the caller omit the `agent` key entirely.
 *
 * @param {Array<{id: string, models: Array<{name: string}>}>} [providersArray=[]] - Discovered Ollama providers, as returned by `getOllamaProviderInputs()`.
 * @returns {Record<string, object>} opencode-shaped `agent` map; may be empty.
 */
function resolveOpencodeAgentConfig(providersArray = []) {
  /** @type {Record<string, object>} */
  const agents = {};

  for (const [role, perCli] of Object.entries(AGENT_TO_MODEL_MAP)) {
    const entry = perCli && perCli.opencode;
    if (!entry) continue;

    // Concrete or inherited model — only preference lists need host resolution.
    if (entry.model || !Array.isArray(entry.models)) {
      agents[role] = { ...entry };
      continue;
    }

    // Preference list — resolve against what the discovered hosts actually serve.
    const preferred = Array.isArray(entry.models) ? entry.models : [];
    let resolved = null;
    for (const tag of preferred) {
      const provider = providersArray.find((p) => (p.models || []).some((m) => m && m.name === tag));
      if (provider) {
        resolved = `${provider.id}/${tag}`;
        break;
      }
    }
    if (!resolved) {
      log(`>> opencode agent: dropping "${role}" — none of its models are reachable`);
      continue;
    }
    log(`>> opencode agent: "${role}" resolved to ${resolved}`);
    const { models, ...rest } = entry;
    agents[role] = { ...rest, model: resolved };
  }

  return agents;
}

// --- Shared LLM Home Folder (one copy of the on-demand instructions, all CLIs) ---

/**
 * Root for every Sy-managed LLM artifact that lives outside a repo checkout.
 *
 * One root with subfolders (instead of a sibling folder per concern) so a single
 * `ls` shows everything the LLM tooling owns, and so a new artifact class is a new
 * subfolder rather than a new top-level name to remember.
 *
 * Sits under SY_ROOT_FOLDER — the personal root declared once in
 * `software/bootstrap/common-env.sh` — so this setup owns exactly one visible
 * folder in the home directory instead of scattering `sy*` siblings across it.
 *
 * THE LOCATION IS DECIDED IN ONE PLACE — `LLM_ROOT_FOLDER` in
 * `software/bootstrap/common-env.sh`. It is declared there rather than here because
 * the shell dispatcher partial needs the same folder and cannot read a JS constant:
 * common-env.sh is the only file that reaches both surfaces (inlined into run.sh for
 * node, re-exported into ~/.bash_syle_common for interactive shells). Everything
 * below is derived from this, and every piece of migration LOGIC lives in this file.
 *
 * Read DIRECTLY with no `||` default. A fallback here would re-spell `ai_llm` a
 * second time, and the copy would go on resolving happily the day the real
 * declaration moves — the two surfaces silently disagreeing is the exact failure
 * this single-declaration rule exists to prevent.
 * @type {string}
 */
const LLM_SHARED_ROOT_FOLDER = process.env.LLM_ROOT_FOLDER;

// SOURCE software/scripts/advanced/llm/llm-upstream.common.js

// --- Deployed-doc path placeholders ---

/**
 * The LLM-only token a deployed doc writes instead of a machine-specific folder.
 *
 * `<<SY_ROOT_FOLDER>>` and `<<HOME>>` are NOT here — they are shared tokens declared
 * once in `COMMON_PLACEHOLDERS` in `software/index.js` and merged in by
 * `resolvePlaceholders`, because tmux configs and shell templates need the same
 * answer. `<<LLM_ROOT_FOLDER>>` stays local: nothing outside this folder writes
 * into the LLM home, so hoisting it would put a token in the shared registry
 * that only one consumer can ever use.
 *
 * Repo sources cannot hardcode `~/_extra/ai_llm/...`: that is a second spelling of
 * a folder already declared in `software/bootstrap/common-env.sh`, so it goes stale
 * the day the root moves and — worse — it is wrong on any machine whose home layout
 * differs. But the deployed file cannot carry `$LLM_ROOT_FOLDER` either: an agent
 * reading `~/.claude/CLAUDE.md` has no shell expanding anything, and an unexpanded
 * `$LLM_ROOT_FOLDER/plans` in a `mkdir -p` is a write at the filesystem root.
 *
 * The placeholder resolves that: sources stay symbolic and reviewable, and
 * {@link resolveLLMDocPlaceholders} bakes the absolute path in at deploy time, so
 * what lands on disk is a path the reader can use verbatim.
 *
 * Token name matches the env var name exactly, so `<<LLM_ROOT_FOLDER>>` in a doc and
 * `$LLM_ROOT_FOLDER` in a script are visibly the same thing.
 * @type {Record<string, string>}
 */
const LLM_DOC_PATH_PLACEHOLDERS = {
  "<<LLM_ROOT_FOLDER>>": LLM_SHARED_ROOT_FOLDER,
  ...getLLMUpstreamSkillPlaceholders(),
};

/**
 * Replaces every {@link LLM_DOC_PATH_PLACEHOLDERS} and
 * {@link LLM_DOC_TUNING_PLACEHOLDERS} token with its resolved value.
 *
 * Delegates to `resolvePlaceholders` in `software/index.js` — the one
 * substitution engine for the whole repo — which also merges in the shared
 * `<<SY_ROOT_FOLDER>>` / `<<HOME>>` tokens, so a doc gets those for free without
 * this file re-declaring them. Only the LLM-specific tokens are passed here.
 * @param {string} text Raw doc content read from a repo source.
 * @returns {string} The same content with every placeholder resolved.
 */
function resolveLLMDocPlaceholders(text) {
  return resolvePlaceholders(text, { ...LLM_DOC_PATH_PLACEHOLDERS, ...LLM_DOC_TUNING_PLACEHOLDERS });
}

/**
 * The ONE reader for any repo doc destined for a deployed LLM surface — the
 * always-loaded instructions, every split instruction file, every `/sy-*` skill
 * body, and each CLI's own tweaks file.
 *
 * Every one of them goes through here rather than calling `readText` directly, so
 * placeholder resolution can never be forgotten on a new deploy path. A doc that
 * skipped it would ship `<<LLM_ROOT_FOLDER>>` verbatim to an agent, which reads as a
 * literal folder name and fails silently.
 * @param {string} sourcePath Repo-relative path to the markdown source.
 * @returns {Promise<string>} Deploy-ready content with paths resolved.
 */
async function readLLMDocSource(sourcePath) {
  return resolveLLMDocPlaceholders(await readText`${sourcePath}`);
}

/**
 * On-demand instruction files, referenced by plain (backticked) path from the
 * always-loaded block rather than imported into it.
 *
 * Deliberately NOT a Claude `@path` import: per Claude Code's memory docs,
 * "imported files are expanded and loaded into context at launch", so an import
 * would re-inflate the very context budget this split exists to protect. A
 * backticked path stays literal and is read only when the agent needs it.
 * @type {string}
 */
const LLM_SHARED_INSTRUCTIONS_FOLDER = path.join(LLM_SHARED_ROOT_FOLDER, "instructions");
/** @type {string} Shared hook helper folder for CLI-specific injected context. */
const LLM_SHARED_HOOKS_FOLDER = path.join(LLM_SHARED_ROOT_FOLDER, "hooks");
/** @type {string} Reminder appended before user-facing replies in supported CLIs. */
const LLM_PERSONA_REMINDER =
  "Before sending, rewrite every non-exempt user-facing sentence in Caveman Speak, starting with the first sentence. Commentary, status reports, summaries, and task_complete replies count. Resume after tools, compaction, and exempt passages. Keep instructions and skills, code, payloads, and external deliverables in precise standard prose; preserve facts, uncertainty, safety, and exact values.";
/** @type {string} Source for the shared hook output helper. */
const LLM_PERSONA_HOOK_HELPER_SOURCE = "software/scripts/advanced/llm/_common/persona-reminder-hook.common.js";
/** @type {string} Deployed hook output helper path. */
const LLM_PERSONA_HOOK_HELPER_PATH = path.join(LLM_SHARED_HOOKS_FOLDER, "persona-reminder-hook.js");

/**
 * Adds one hook entry to a settings object's event array without replacing user hooks.
 * Replaces older managed persona hooks, preserves grouped user hooks, and ignores exact duplicates.
 * Mutates only the selected settings hook array; logs and returns false for malformed containers.
 * @param {Record<string, any>} settings - Parsed CLI settings object to update.
 * @param {string} eventName - Hook event key supported by the target CLI.
 * @param {Record<string, any>} entry - Hook entry to upsert.
 * @returns {boolean} True when hook event array was valid and updated or already contained entry.
 */
function mergeLLMHookEntry(settings, eventName, entry) {
  if (!settings.hooks) settings.hooks = {};
  if (typeof settings.hooks !== "object" || Array.isArray(settings.hooks)) {
    log(`>> LLM hook merge skipped — settings.hooks is not an object (${eventName})`);
    return false;
  }

  const entries = settings.hooks[eventName] === undefined ? [] : settings.hooks[eventName];
  if (!Array.isArray(entries)) {
    log(`>> LLM hook merge skipped — hooks.${eventName} is not an array`);
    return false;
  }

  // Managed persona hooks retain their identity when reminder wording changes.
  // Replace that entry rather than accumulating one hook per deployed revision.
  const isPersonaEntry = JSON.stringify(entry).includes(LLM_PERSONA_HOOK_HELPER_PATH);
  const retainedEntries = [];
  for (const candidate of entries) {
    if (!isPersonaEntry || !JSON.stringify(candidate).includes(LLM_PERSONA_HOOK_HELPER_PATH)) {
      retainedEntries.push(candidate);
      continue;
    }
    if (Array.isArray(candidate?.hooks)) {
      const hooks = candidate.hooks.filter((hook) => !JSON.stringify(hook).includes(LLM_PERSONA_HOOK_HELPER_PATH));
      if (hooks.length > 0) retainedEntries.push({ ...candidate, hooks });
    }
  }
  const serializedEntry = JSON.stringify(entry);
  if (!retainedEntries.some((candidate) => JSON.stringify(candidate) === serializedEntry)) retainedEntries.push(entry);
  settings.hooks[eventName] = retainedEntries;
  return true;
}

/**
 * Plan artifacts and their sidecars (`<repo>-<feature>.md`, `.diff`, `.rfc.md`),
 * kept flat in one folder and out of repo working trees so they need no
 * `.gitignore` entry and can't be committed by accident.
 * @type {string}
 */
const LLM_SHARED_PLANS_FOLDER = path.join(LLM_SHARED_ROOT_FOLDER, "plans");

/**
 * Durable context for reviews of pull requests authored by other people.
 * @type {string}
 */
const LLM_SHARED_PR_REVIEWS_FOLDER = path.join(LLM_SHARED_ROOT_FOLDER, "pr_reviews");

/**
 * Durable context for maintaining pull requests owned by the current user.
 * @type {string}
 */
const LLM_SHARED_PR_BABYSITS_FOLDER = path.join(LLM_SHARED_ROOT_FOLDER, "pr_babysits");

/**
 * Pre-move LLM home, when the whole tree sat directly in the home directory rather
 * than under the personal root. Named because it is not only a migration source:
 * the link-ownership check consults it so a link written before the move is still
 * recognized as ours and can be repaired or swept.
 *
 * Uses BASE_HOMEDIR_LINUX rather than `os.homedir()` because the latter reads
 * /etc/passwd and returns `/root` under `sudo -E` on RHEL/Fedora.
 * @type {string}
 */
const LLM_LEGACY_ROOT_FOLDER = path.join(BASE_HOMEDIR_LINUX, "sy_llm_ai");

/**
 * Pre-consolidation plans folder, from before plans moved under the LLM home.
 * @type {string}
 */
const LLM_LEGACY_PLANS_FOLDER = path.join(BASE_HOMEDIR_LINUX, "sy_llm_ai_plans");

/**
 * Every folder the LLM home has ever lived in, before it consolidated under the
 * personal root. Nothing here is migrated automatically any more — the moves ran
 * once and were removed. Two passes still read this list:
 *
 *   - {@link warnAboutLegacyLLMFolders} reports one that is still populated, so a
 *     machine that never ran the migration says so instead of silently building an
 *     empty new home beside the real one.
 *   - the link-ownership checks consult it so a symlink written before the move is
 *     still recognized as ours and gets swept or repaired rather than dangling.
 *
 * Order is presentational only. Retiring an entry is safe once no machine can still
 * be holding that folder; the cost of leaving one is a single `existsSync` per run.
 * @type {Array<{folder: string, destination: string}>}
 */
const LLM_LEGACY_FOLDERS = [
  { folder: LLM_LEGACY_ROOT_FOLDER, destination: LLM_SHARED_ROOT_FOLDER },
  { folder: LLM_LEGACY_PLANS_FOLDER, destination: LLM_SHARED_PLANS_FOLDER },
];

/**
 * Deployed basename of the persona document. MUST load LAST.
 *
 * Why last: a style directive decays with distance — every token of dense, formal rule
 * prose read after it pulls the reply back toward normal technical English. CLIs that
 * take an ordered instruction list (opencode `instructions: [...]`) load in array
 * order, so whatever sits last is the freshest thing in context. Sorted alphabetically
 * as plain `persona.md` it landed 2nd of 6 with ~40k chars of rules behind it, and the
 * persona stopped sticking.
 *
 * Two guards keep it last, on purpose:
 *   1. The `~` prefix — `~` (0x7e) sorts after every letter, so even a plain `.sort()`
 *      puts it at the end (same `~name` = "runs last" convention as `~cleanup.js`).
 *   2. {@link getSharedLLMInstructionFilePaths} moves it to the end explicitly, so a
 *      future file whose name also sorts late cannot overtake it.
 * @type {string}
 */
const LLM_PERSONA_INSTRUCTION_FILE = "~persona.md";

/**
 * The single registry of instruction files split out of the always-loaded block.
 *
 * Same "one registry, never a per-CLI list" rule as LLM_COMMAND_DEPLOY_MAP: every
 * CLI's setup.js calls deploySharedLLMInstructions(), which iterates this. Adding
 * a split file is one entry here plus a pointer in instructions.md — never a
 * per-CLI edit.
 *
 * Key   = target basename under LLM_SHARED_INSTRUCTIONS_FOLDER.
 * Value = repo-relative source path.
 * @type {Record<string, string>}
 */
const LLM_SHARED_INSTRUCTION_FILES = {
  "pr-workflow.md": "software/scripts/advanced/llm/_common/v_current/instructions-pr-workflow.md",
  "progress-updates.md": "software/scripts/advanced/llm/_common/v_current/instructions-progress-updates.md",
  "debugging.md": "software/scripts/advanced/llm/_common/v_current/instructions-debugging.md",
  "testing.md": "software/scripts/advanced/llm/_common/v_current/instructions-testing.md",
  "readability.md": "software/scripts/advanced/llm/_common/v_current/instructions-readability.md",
  "review-guardrails.md": "software/scripts/advanced/llm/_common/v_current/instructions-review-guardrails.md",
  "performance.md": "software/scripts/advanced/llm/_common/v_current/instructions-performance.md",
  // Unlike its siblings, this one is ALSO inlined back into the top of
  // instructions.md through a BEGIN/END path block, so the always-loaded copy and
  // the standalone document can never drift. It is here so opencode loads it as a
  // separate rules document (instructions[]) rather than as ~1% of one 36k blob —
  // persona is the oldest, smallest thing in context and the first to decay.
  [LLM_PERSONA_INSTRUCTION_FILE]: "software/scripts/advanced/llm/_common/v_current/instructions-persona.md",
};

/**
 * Proof-of-authorship marker for files this module generated.
 *
 * `getAutoGeneratedText()` (index.js) opens every deployed shared instruction file with
 * `AUTO-GENERATED - DO NOT EDIT [date] [chars]`. The prune pass matches on this substring
 * to tell OUR retired files from a user's own notes in the same folder — a user file has
 * no reason to carry it. Kept as a constant so the prune and the writer cannot drift.
 * @type {string}
 */
const LLM_GENERATED_MARKER = "AUTO-GENERATED - DO NOT EDIT";

/**
 * Per-CLI folders that get a symlink to EVERY file in LLM_SHARED_INSTRUCTION_FILES.
 *
 * Same "one registry, never a per-CLI list" rule as the command map: this is the only
 * place that names a CLI's instruction folder, `deploySharedLLMInstructions()` is the
 * only thing that reads it, and no CLI's setup.js knows the shared folder exists.
 * Adding a CLI is one entry here; adding a shared instruction file is one entry in
 * LLM_SHARED_INSTRUCTION_FILES and it lands in every folder listed here automatically.
 *
 * `suffix` is the per-CLI SHAPE difference — the only thing a per-CLI entry may encode.
 * Copilot's loader globs `$HOME/.copilot/instructions/**\/*.instructions.md` (verbatim
 * from its own `/help` customInstructions list), so a plain `pr-workflow.md` sitting in
 * that folder is silently ignored. The link is therefore named `<base>.instructions.md`
 * while the link TARGET keeps the clean shared name — one file, two names, zero copies.
 *
 * Symlinks, never copies: a copy is a second source of truth that goes stale the first
 * time `instructions-pr-workflow.md` changes and nobody re-runs that CLI's setup.
 *
 * Deliberately NOT here:
 * - claude — its only user-level mechanism is an `@path` import in CLAUDE.md, which
 *   loads at launch and re-inflates the 40k always-loaded budget this split exists to
 *   protect. `.claude/rules/*.md` is documented as PROJECT scope only; whether the
 *   global `~/.claude/rules/` is read is unverified, so it is not wired up on a guess.
 * - gemini — `contextFileName` takes filenames discovered hierarchically, not paths,
 *   so every session would always-load the file. Same budget problem.
 * - opencode — already loads the shared file by absolute path via `instructions: [...]`
 *   in opencode/setup.js, which needs no link.
 *
 * Key   = absolute destination folder (created when missing).
 * Value = `{ suffix }` — extension the destination link must carry.
 * @type {Record<string, { suffix: string }>}
 */
const LLM_SHARED_INSTRUCTION_LINK_FOLDERS = {
  [path.join(BASE_HOMEDIR_LINUX, ".copilot", "instructions")]: { suffix: ".instructions.md" },
};

/**
 * Names any pre-consolidation folder that is still sitting on disk with content in it.
 *
 * The one-time moves that used to relocate these have run everywhere and were removed —
 * carrying a folder-moving engine forever to service folders that no longer exist is
 * the speculative weight the YAGNI rule cuts. What is NOT safe to drop is the signal:
 * without it, a machine that somehow never migrated would quietly build an empty new
 * home beside its real one, and every plan, skill, and instruction file would read as
 * missing with nothing anywhere saying why.
 *
 * An empty leftover folder is not reported — it holds nothing to rescue, so naming it
 * would be a false alarm the reader cannot act on.
 *
 * @param {Array<{folder: string, destination: string}>} [folders] - Rows to probe; defaults to the registry.
 * @returns {Array<{folder: string, destination: string}>} Rows whose folder still holds files.
 */
function findLegacyLLMFolders(folders = LLM_LEGACY_FOLDERS) {
  return folders.filter(({ folder }) => {
    try {
      return fs.existsSync(folder) && fs.readdirSync(folder).length > 0;
    } catch {
      // Unreadable is not the same as absent — say so rather than silently clearing it.
      return true;
    }
  });
}

/**
 * True once the legacy-folder warning has been emitted, so several setup scripts sharing
 * one process print it once rather than once each.
 * @type {boolean}
 */
let _legacyLLMFolderWarningShown = false;

/**
 * Logs a one-time, actionable warning naming every populated legacy folder still on disk.
 *
 * Called by each deploy entry point before it writes into the shared home. Prints the
 * exact recovery command rather than describing it, because the person reading this is
 * being told their files are somewhere they no longer expect.
 *
 * Reports only — it never moves, copies, or deletes anything, so the worst case is a log
 * line. Deliberately not a thrown error either: a stale folder must not fail a deploy
 * that is otherwise fine.
 *
 * @param {Array<{folder: string, destination: string}>} [folders] - Rows to probe; defaults to the registry.
 * @returns {Array<{folder: string, destination: string}>} The populated legacy folders found.
 */
function warnAboutLegacyLLMFolders(folders = LLM_LEGACY_FOLDERS) {
  /** @type {Array<{folder: string, destination: string}>} Pre-consolidation folders still holding files. */
  const stale = findLegacyLLMFolders(folders);
  if (stale.length === 0 || _legacyLLMFolderWarningShown) return stale;

  _legacyLLMFolderWarningShown = true;

  log(LINE_BREAK_HASH);
  log(">> WARNING: a pre-consolidation LLM folder is still on disk and still holds files.");
  log(`>> The shared LLM home is now ${LLM_SHARED_ROOT_FOLDER}, and nothing is moved automatically.`);
  log(">> Everything below is NOT being read. Move it across by hand, then re-run this script:");
  for (const { folder, destination } of stale) {
    log(`>>   rsync -a '${folder}/' '${destination}/' && rm -rf '${folder}'`);
  }
  log(LINE_BREAK_HASH);

  return stale;
}

/**
 * True when `target` sits directly inside `<root>/<subfolder>` for the current shared
 * root or any pre-move one.
 *
 * Both prune passes use it to answer the same question — "is this link ours to
 * remove?" — and both would otherwise answer it against the *current* root only. That
 * is the exact hole a root move opens: a link written before the move points at the
 * old root, so a retired skill or instruction file leaves a dangling link that neither
 * pass will touch because it no longer looks like ours.
 *
 * Deliberately `dirname` rather than a prefix test: a link two levels deep belongs to
 * something else, and a plugin's or the user's own link must always survive.
 *
 * @param {string} target - Resolved absolute symlink target.
 * @param {string} subfolder - Shared subfolder name, e.g. "skills" or "instructions".
 * @returns {boolean} True when this deploy owns the link.
 */
function isSharedLLMArtifactTarget(target, subfolder) {
  return [LLM_SHARED_ROOT_FOLDER, LLM_LEGACY_ROOT_FOLDER].map((root) => path.join(root, subfolder)).includes(path.dirname(target));
}

/**
 * True when `target` sits anywhere inside the shared LLM home — the current one or any
 * root a migration row moved away from.
 *
 * The depth-insensitive companion to {@link isSharedLLMArtifactTarget}, for links that
 * point deeper than one subfolder (the opencode command mirror targets
 * `<root>/skills/<name>/SKILL.md`, three levels down). Both exist so that "is this link
 * ours?" is answered against every root we have ever used, not just the current one:
 * a cleanup pass that only knows the current root leaves a link written before a move
 * dangling forever, and the deploy pass that follows then misreads that dangling link
 * as a user-authored file and refuses to replace it.
 *
 * @param {string} target - Resolved absolute symlink target.
 * @returns {boolean} True when the target lives under a current or former shared home.
 */
function isUnderSharedLLMHome(target) {
  return [LLM_SHARED_ROOT_FOLDER, ...LLM_LEGACY_FOLDERS.map((row) => row.folder)].some(
    (root) => target === root || target.startsWith(root + path.sep),
  );
}

/**
 * Creates the shared LLM home folders, runs any pending legacy folder migration, and
 * writes every file in LLM_SHARED_INSTRUCTION_FILES into the shared instructions
 * folder.
 *
 * Called by all four setup scripts. Writing the same bytes from each is intentional
 * and safe — writeText skips when content is unchanged, so whichever CLI runs first
 * does the work and the rest are no-ops. That keeps every CLI independently able to
 * repair the shared folder without one of them being a required prerequisite.
 *
 * @returns {Promise<void>}
 */
async function deploySharedLLMInstructions() {
  warnAboutLegacyLLMFolders();

  fs.mkdirSync(LLM_SHARED_INSTRUCTIONS_FOLDER, { recursive: true });
  fs.mkdirSync(LLM_SHARED_HOOKS_FOLDER, { recursive: true });
  fs.mkdirSync(LLM_SHARED_PLANS_FOLDER, { recursive: true });
  fs.mkdirSync(LLM_SHARED_PR_REVIEWS_FOLDER, { recursive: true });
  fs.mkdirSync(LLM_SHARED_PR_BABYSITS_FOLDER, { recursive: true });

  pruneStaleSharedLLMInstructions();

  for (const [targetName, sourcePath] of Object.entries(LLM_SHARED_INSTRUCTION_FILES)) {
    /** @type {string} Raw split-instruction content from the repo source of truth. */
    const content = (await readLLMDocSource(sourcePath)).trim();

    if (!content) {
      log(`>> shared instructions: SKIPPED ${targetName} — empty source ${sourcePath}`);
      continue;
    }

    /** @type {string} Same begin/end auto-generated wrapper the in-profile block uses. */
    const wrapped = [
      `<!-- ${getAutoGeneratedText(content.length).trim()} -->`,
      content,
      `<!-- ${getAutoGeneratedEndText(content.length).trim()} -->`,
    ].join("\n");

    await writeText(path.join(LLM_SHARED_INSTRUCTIONS_FOLDER, targetName), wrapped);
  }

  await writeText(LLM_PERSONA_HOOK_HELPER_PATH, await readText`${LLM_PERSONA_HOOK_HELPER_SOURCE}`);

  linkSharedLLMInstructions();

  log(`>> shared instructions: ${LLM_SHARED_INSTRUCTIONS_FOLDER}`);
}

/**
 * Removes previously-deployed instruction artifacts that the registry no longer
 * declares, so a renamed or retired split file cannot linger and keep being loaded by
 * every CLI forever. Runs BEFORE the deploy pass in `deploySharedLLMInstructions()`.
 *
 * Deliberately a targeted prune, not a `rm -rf` of the folders. Two things live
 * alongside ours and must survive: user-authored notes dropped into
 * the shared instructions folder, and plugin-owned files in a CLI's instruction folder
 * (`captain.instructions.md`). So deletion is limited to things provably ours:
 *
 * - In the shared folder: a `.md` file NOT in LLM_SHARED_INSTRUCTION_FILES whose first
 *   line carries the AUTO-GENERATED marker. That marker is written only by the deploy
 *   pass below, so its presence is proof of authorship. A file without it is a user's.
 * - In each link folder: a SYMLINK whose target resolves inside the shared folder but
 *   no longer corresponds to a registry entry. Real files are never touched, and a
 *   symlink pointing anywhere else belongs to someone else.
 *
 * @returns {number} Count of artifacts removed (0 in the steady state).
 */
function pruneStaleSharedLLMInstructions() {
  /** @type {Set<string>} Basenames the registry still declares. */
  const declared = new Set(Object.keys(LLM_SHARED_INSTRUCTION_FILES));
  /** @type {number} Total removed across the shared folder and every link folder. */
  let removed = 0;

  // --- Shared folder: our own auto-generated files that fell out of the registry ---
  if (fs.existsSync(LLM_SHARED_INSTRUCTIONS_FOLDER)) {
    for (const entry of fs.readdirSync(LLM_SHARED_INSTRUCTIONS_FOLDER)) {
      if (!entry.endsWith(".md") || declared.has(entry)) continue;

      /** @type {string} Absolute path of the candidate. */
      const entryPath = path.join(LLM_SHARED_INSTRUCTIONS_FOLDER, entry);
      /** @type {string} First line only — enough to spot the generated header. */
      let head = "";
      try {
        if (!fs.lstatSync(entryPath).isFile()) continue;
        head = fs.readFileSync(entryPath, "utf-8").split("\n", 1)[0] || "";
      } catch (e) {
        log(`>> shared instructions: could not read ${entryPath} while pruning — ${e.message}`);
        continue;
      }

      if (!head.includes(LLM_GENERATED_MARKER)) continue;

      try {
        fs.unlinkSync(entryPath);
        removed++;
        log(`>> shared instructions: removed retired ${entry}`);
      } catch (e) {
        log(`>> shared instructions: could not remove ${entryPath} — ${e.message}`);
      }
    }
  }

  // --- Link folders: our symlinks into the shared folder that no longer map to a file ---
  for (const [destFolder, { suffix }] of Object.entries(LLM_SHARED_INSTRUCTION_LINK_FOLDERS)) {
    if (!fs.existsSync(destFolder)) continue;

    /** @type {Set<string>} Link basenames the registry still justifies in this folder. */
    const expected = new Set(
      Object.keys(LLM_SHARED_INSTRUCTION_FILES).map((name) => `${path.basename(name, path.extname(name))}${suffix}`),
    );

    for (const entry of fs.readdirSync(destFolder)) {
      if (expected.has(entry)) continue;

      /** @type {string} Absolute path of the candidate link. */
      const entryPath = path.join(destFolder, entry);
      /** @type {string} Resolved link target, or "" when this is not a symlink at all. */
      let target = "";
      try {
        if (!fs.lstatSync(entryPath).isSymbolicLink()) continue;
        /** @type {string} Raw target as stored on disk (may be relative). */
        const raw = fs.readlinkSync(entryPath);
        target = path.isAbsolute(raw) ? raw : path.resolve(destFolder, raw);
      } catch (e) {
        log(`>> shared instructions: could not inspect ${entryPath} while pruning — ${e.message}`);
        continue;
      }

      // Only ours: a link into the shared instructions folder, under the current root
      // or one we moved away from. Anything else is a plugin's or the user's.
      if (!isSharedLLMArtifactTarget(target, "instructions")) continue;

      try {
        fs.unlinkSync(entryPath);
        removed++;
        log(`>> shared instructions: removed stale link ${entryPath}`);
      } catch (e) {
        log(`>> shared instructions: could not remove ${entryPath} — ${e.message}`);
      }
    }
  }

  return removed;
}

/**
 * Returns every deployed shared instruction file as an array of absolute paths.
 *
 * For CLIs that take an explicit list of instruction files rather than scanning a
 * folder — opencode's `instructions: [...]` is the only one today. Reading the folder
 * instead of the registry means a file added to LLM_SHARED_INSTRUCTION_FILES is picked
 * up with no second edit, and it also carries anything a user drops in by hand.
 *
 * Must be called AFTER `deploySharedLLMInstructions()` — it reports what is on disk,
 * not what is declared. Returns `[]` when the folder is missing, which is the correct
 * value for a config key (an empty list loads nothing rather than erroring).
 *
 * Sorted for stable output: an unsorted readdir would reorder the generated config
 * between machines and show up as spurious diffs.
 *
 * The persona file ({@link LLM_PERSONA_INSTRUCTION_FILE}) is then forced to the END.
 * opencode loads `instructions` in array order and the last document read is the one
 * that sticks; the persona placed mid-list decays under the rule prose after it.
 *
 * @returns {string[]} Absolute paths to every `.md` in LLM_SHARED_INSTRUCTIONS_FOLDER,
 *   alphabetical, with the persona file last.
 */
function getSharedLLMInstructionFilePaths() {
  if (!fs.existsSync(LLM_SHARED_INSTRUCTIONS_FOLDER)) return [];

  try {
    const isPersona = (entry) => entry === LLM_PERSONA_INSTRUCTION_FILE;
    const entries = fs
      .readdirSync(LLM_SHARED_INSTRUCTIONS_FOLDER)
      .filter((entry) => entry.endsWith(".md"))
      .sort();
    return [...entries.filter((entry) => !isPersona(entry)), ...entries.filter(isPersona)].map((entry) =>
      path.join(LLM_SHARED_INSTRUCTIONS_FOLDER, entry),
    );
  } catch (e) {
    log(`>> shared instructions: could not list ${LLM_SHARED_INSTRUCTIONS_FOLDER} — ${e.message}`);
    return [];
  }
}

/**
 * Symlinks every file in LLM_SHARED_INSTRUCTION_FILES into every folder in
 * LLM_SHARED_INSTRUCTION_LINK_FOLDERS, renaming each link to carry that folder's
 * required suffix (`pr-workflow.md` -> `pr-workflow.instructions.md`).
 *
 * Idempotent in both directions: a link already pointing at the right target is left
 * alone, and a link pointing at a STALE target (folder moved, file renamed) is replaced.
 * Anything that is not a symlink — a real file the user or a CLI plugin wrote — is never
 * touched, which is what keeps `~/.copilot/instructions/captain.instructions.md` (owned
 * by the context-repo plugin) alive across runs.
 *
 * Not a no-op wrapper around safeSymlink: the rename, the stale-target repair, and the
 * foreign-file guard are the work. Called only from `deploySharedLLMInstructions()`.
 *
 * @returns {void}
 */
function linkSharedLLMInstructions() {
  for (const [destFolder, { suffix }] of Object.entries(LLM_SHARED_INSTRUCTION_LINK_FOLDERS)) {
    /** @type {number} Links created or repaired this run. */
    let linked = 0;
    /** @type {number} Destinations skipped because a non-symlink already occupies them. */
    let skippedForeign = 0;

    for (const targetName of Object.keys(LLM_SHARED_INSTRUCTION_FILES)) {
      /** @type {string} The shared file this link points at — the single source of truth. */
      const sourcePath = path.join(LLM_SHARED_INSTRUCTIONS_FOLDER, targetName);
      if (!fs.existsSync(sourcePath)) continue;

      /** @type {string} Destination basename with the shared extension swapped for the CLI's. */
      const destName = `${path.basename(targetName, path.extname(targetName))}${suffix}`;
      /** @type {string} Absolute destination path inside this CLI's instruction folder. */
      const destPath = path.join(destFolder, destName);

      /** @type {fs.Stats|undefined} Lstat of whatever occupies the destination, if anything. */
      let stat;
      try {
        stat = fs.lstatSync(destPath);
      } catch {}

      if (stat && !stat.isSymbolicLink()) {
        skippedForeign++;
        continue;
      }

      if (stat) {
        /** @type {string} Existing link target, resolved to absolute. */
        let existing = "";
        try {
          /** @type {string} Raw link target as stored on disk (may be relative). */
          const raw = fs.readlinkSync(destPath);
          existing = path.isAbsolute(raw) ? raw : path.resolve(destFolder, raw);
        } catch {}
        if (existing === sourcePath) continue;
        try {
          fs.unlinkSync(destPath);
        } catch {}
      }

      fs.mkdirSync(destFolder, { recursive: true });
      safeSymlink(sourcePath, destPath);
      linked++;
    }

    log(
      `>> shared instructions: linked ${linked} file(s) into ${destFolder}` +
        (skippedForeign ? ` (skipped ${skippedForeign} foreign / user-authored entries)` : ""),
    );
  }
}

/**
 * Returns the shared LLM custom instructions content with an auto-generated
 * warning prepended. Uses the existing `getAutoGeneratedText()` from index.js
 * so the date format stays consistent with every other auto-generated file
 * in the repo.
 *
 * The warning carries the instructions' character count because this block is
 * effectively all of the deployed `CLAUDE.md` / `copilot-instructions.md` /
 * `GEMINI.md` / `AGENTS.md`, and Claude Code refuses to load a `CLAUDE.md`
 * over 40k chars. Stamping the size makes a budget overrun visible in the file
 * itself rather than only in the host's error message. A matching closing
 * marker goes at the bottom so the managed region is bounded at both ends for
 * a human reader, not just by the machine-facing BEGIN/END pair.
 *
 * @returns {Promise<string>} Trimmed instructions content, wrapped in opening and closing auto-generated comments.
 */
async function getLLMCustomInstructions() {
  /** @type {string} Raw instructions from the single source of truth. */
  const content = (await readLLMDocSource("software/scripts/advanced/llm/_common/v_current/instructions.md")).trim();
  return [
    `<!-- ${getAutoGeneratedText(content.length).trim()} -->`,
    content,
    `<!-- ${getAutoGeneratedEndText(content.length).trim()} -->`,
  ].join("\n");
}

// --- Path-Keyed Block Refresh ---

/**
 * Regex for one path-keyed marker line: `<!-- BEGIN <label> | <path> -->`. Group 1 is
 * the whole key (`<label> | <path>`), group 2 the path.
 * @type {RegExp}
 */
const LLM_PATH_KEYED_BEGIN_REGEX = /^<!-- BEGIN ((?:[^|\n]+?) \| ([^\n]+?)) -->$/gm;

/**
 * Path fragments never inlined into an instructions file, even when a marker names them.
 * Matching blocks keep their old content and log an error (Secret Handling).
 * @type {RegExp}
 */
const LLM_PATH_KEYED_SECRET_REGEX =
  /\.secret\.|(^|\/)(\.env[^/]*|\.ssh|\.aws|\.gnupg|kubeconfig|id_[^/]*|[^/]*credential[^/]*|[^/]*\.pem|[^/]*\.key)(\/|$)/i;

/** @type {RegExp} Discoverable home documents whose names can safely appear in HTML markers. */
const LLM_WORK_INSTRUCTION_FILENAME_REGEX = /^\.work_[^\r\n|<>]*_instructions\.md$/;

/**
 * Refreshes existing user path-keyed blocks and appends discovered work instruction documents.
 * Home files matching `.work_*_instructions.md` receive `Custom Work Prompt | ~/filename`
 * blocks in lexical discovery order. Existing blocks retain their labels and positions.
 * Repository-owned keys remain the responsibility of each client's managed-block writer.
 * Invalid markers, unreadable/empty sources, unsafe paths, and self-delimiting bodies
 * leave existing content unchanged and emit diagnostics. No source files are modified.
 *
 * @param {string} text - Full instructions file content, including the managed common block.
 * @param {string} [homeFolder=BASE_HOMEDIR_LINUX] - Home for discovery and expansion of `~/` and `$HOME/`.
 * @returns {string} Instructions with safe custom sources refreshed or appended without duplicates.
 */
function refreshPathKeyedBlocks(text, homeFolder = BASE_HOMEDIR_LINUX) {
  /** @type {string} Lexical home root; real targets receive a separate containment check. */
  const homeRoot = path.resolve(homeFolder);
  /** @type {{ key: string, rawPath: string, sourcePath: string, existing: boolean }[]} Existing and discovered sources. */
  const blocks = [...text.matchAll(LLM_PATH_KEYED_BEGIN_REGEX)].map(([, key, rawPath]) => ({
    key,
    rawPath,
    sourcePath: path.resolve(rawPath.trim().replace(/^(~|\$HOME)(?=\/)/, homeRoot)),
    existing: true,
  }));
  /** @type {Set<string>} Paths already included under any user-authored label. */
  const knownPaths = new Set(blocks.map(({ sourcePath }) => sourcePath));
  try {
    for (const name of fs.readdirSync(homeRoot).sort()) {
      if (!LLM_WORK_INSTRUCTION_FILENAME_REGEX.test(name) || LLM_PATH_KEYED_SECRET_REGEX.test(name)) continue;
      /** @type {string} Discovered source identity for deduplication against existing blocks. */
      const sourcePath = path.join(homeRoot, name);
      if (knownPaths.has(sourcePath)) continue;
      blocks.push({ key: `Custom Work Prompt | ~/${name}`, rawPath: `~/${name}`, sourcePath, existing: false });
    }
  } catch (error) {
    if (error.code !== "ENOENT") log("ERROR: work instruction discovery failed:", error.code || error.message);
  }

  let result = text;
  for (const { key, rawPath, sourcePath, existing } of blocks) {
    if (key.startsWith("synle/bashrc |")) continue;
    /** @type {string} Stable opening delimiter for this source. */
    const begin = `<!-- BEGIN ${key} -->`;
    /** @type {string} Stable closing delimiter for this source. */
    const end = `<!-- END ${key} -->`;
    /** @type {number} Existing blocks require one pair; newly discovered blocks require none. */
    const expectedCount = existing ? 1 : 0;
    if (result.split(begin).length - 1 !== expectedCount || result.split(end).length - 1 !== expectedCount) {
      log("ERROR: path-keyed block has invalid or duplicate markers; left unchanged:", key);
      continue;
    }
    /** @type {number} Existing opening delimiter position, or -1 for a new block. */
    const beginIdx = result.indexOf(begin);
    /** @type {number} Existing closing delimiter position, or -1 for a new block. */
    const endIdx = result.indexOf(end);
    if (existing && endIdx < beginIdx) {
      log("ERROR: path-keyed block END precedes BEGIN; left unchanged:", key);
      continue;
    }
    if (
      !sourcePath.startsWith(homeRoot + path.sep) ||
      LLM_PATH_KEYED_SECRET_REGEX.test(rawPath) ||
      LLM_PATH_KEYED_SECRET_REGEX.test(sourcePath)
    ) {
      log("ERROR: path-keyed block source is outside home or credential-shaped; left unchanged:", key);
      continue;
    }

    let body = "";
    try {
      /** @type {string} Canonical source; symlinks cannot hide outside-home or secret targets. */
      const realSource = fs.realpathSync(sourcePath);
      /** @type {string} Canonical home supports symlinked homes and platform temporary roots. */
      const realHomePrefix = fs.realpathSync(homeRoot) + path.sep;
      if (!realSource.startsWith(realHomePrefix) || LLM_PATH_KEYED_SECRET_REGEX.test(realSource)) {
        log("ERROR: path-keyed block target is outside home or credential-shaped; left unchanged:", key);
        continue;
      }
      if (!fs.statSync(realSource).isFile()) {
        log("ERROR: path-keyed block source is not a regular file; left unchanged:", key);
        continue;
      }
      body = fs.readFileSync(realSource, "utf-8").trim();
    } catch (error) {
      log("ERROR: path-keyed block source unreadable; left unchanged:", key, error.code || error.message);
      continue;
    }
    if (!body || body.includes(begin) || body.includes(end)) {
      log("ERROR: path-keyed block source is empty or contains its own markers; left unchanged:", key);
      continue;
    }

    if (existing) {
      result = `${result.slice(0, beginIdx)}${begin}\n${body}\n${result.slice(endIdx)}`;
    } else {
      result = `${result.trimEnd()}${result.trim() ? "\n\n" : ""}${begin}\n${body}\n${end}\n`;
    }
  }
  return result;
}

// --- Shared Command Registry (deployed as slash commands / skills per CLI) ---

/**
 * Repo-relative folder holding shared skill bodies, one `.md` per registry source.
 * Keep this registry identifier stable while the source layout uses skills;
 * deploySharedLLMSkills() writes the bodies once and links them into every CLI.
 * @type {string}
 */
const LLM_COMMAND_SOURCE_FOLDER = "software/scripts/advanced/llm/_common/v_current/skills";

/**
 * The one registry of Sy-managed commands, shared by every LLM CLI setup.
 *
 * Key   = deployed command name, **without** any extension (e.g. `sy-list-prs`).
 *         Claude writes `<key>.md` into `~/.claude/commands/`; Copilot creates
 *         `~/.copilot/skills/<key>/SKILL.md`. Keeping the key extension-less is
 *         what lets one map serve a file-based CLI and a folder-based one.
 * Value = source basename (no `.md`) under LLM_COMMAND_SOURCE_FOLDER.
 *
 * Naming convention: every key is `sy-` prefixed so Sy-managed commands cluster
 * under `/sy-*` and never collide with user-authored or plugin-shipped ones.
 * Source filenames stay bare (`babysit-pr`, `release`) — the prefix is purely a
 * deploy-time decoration, so editing a command body never means typing it.
 *
 * Per-CLI reality (see llm.md for the full matrix):
 *   - claude   — writes `~/.claude/commands/<key>.md`.
 *   - copilot  — writes `~/.copilot/skills/<key>/SKILL.md` (no `commands/` slot exists).
 *   - opencode — symlinks whatever Claude deployed; consumes this map indirectly.
 *   - gemini   — no command slot; sources this file but has nothing to deploy.
 *
 * Editing a command: edit `<LLM_COMMAND_SOURCE_FOLDER>/<value>.md`.
 * Adding a command: drop the new `.md` there + add ONE entry here — every CLI
 *   picks it up on its next setup run. Aliasing: add a second key pointing at
 *   the same value; aliased sources are read once and stay byte-exact.
 * Renaming / removing: move the OLD key into LLM_COMMAND_RETIRED_NAMES below.
 *
 * @type {Record<string, string>}
 */
const LLM_COMMAND_DEPLOY_MAP = {
  "sy-babysit-pr": "babysit-pr",
  "sy-babysit-prs": "babysit-prs",
  "sy-clean-instructions": "clean-instructions",
  "sy-debug": "debug",
  "sy-dep-bump": "dep-bump",
  "sy-execute-plan": "execute-plan",
  "sy-list-prs": "list-prs",
  "sy-list-prs-pending": "list-prs-pending",
  "sy-loop": "loop",
  "sy-migrate-cross-agent-skills-and-context": "migrate-cross-agent-skills-and-context",
  "sy-onboard-repo": "onboard-repo",
  "sy-plan-grill-me": "plan-grill-me",
  "sy-pr-reconciliation-pass": "pr-reconciliation-pass",
  "sy-review-pr": "review-pr",
  "sy-review-prs": "review-prs",
  "sy-rfc": "rfc",
  "sy-slack-prs": "slack-prs",
  "sy-standup": "standup",
  "sy-sync-pr-branch": "sync-pr-branch",
  "sy-test-gap": "test-gap",
  "sy-triage-ci": "triage-ci",
};

/**
 * First-line prefix every command source carries (`[Sy] <what this does>`).
 * Doubles as the marker each CLI uses to recognize its own previously-deployed
 * artifacts on disk, and as the text stripped when deriving a skill description.
 * @type {string}
 */
const LLM_SKILL_MARKER = "[Sy] ";

/**
 * Every marker a Sy-managed command body may start with, newest first. Used to
 * identify our own orphans on disk so a rename cleans up automatically without
 * anyone maintaining a list. `Sy Skill - ` is the legacy prefix, kept so a dev
 * machine still holding pre-rename files gets them swept on the next deploy.
 *
 * Add a marker here when the prefix convention changes; drop an old one only
 * after every dev machine has re-run at least once past the prior convention.
 * @type {string[]}
 */
const LLM_SKILL_MARKERS = [LLM_SKILL_MARKER, "Sy Skill - "];

/**
 * Command names we used to deploy but no longer do, and which may not carry any
 * LLM_SKILL_MARKERS prefix on disk (they predate every marker convention, or the
 * marker was edited away by hand). Extension-less, exactly like the keys of
 * LLM_COMMAND_DEPLOY_MAP — Claude matches `<name>.md` in `~/.claude/commands/`,
 * Copilot matches the `<name>` skill folder, so one list sweeps both surfaces.
 *
 * Cleanup of *current* deploy targets needs nothing: the deploy loop overwrites
 * them. Cleanup of *future* renames is handled by the LLM_SKILL_MARKERS content
 * scan. This list exists only for the gap between those two.
 *
 * MAINTENANCE RULE: **whenever a command is renamed or deleted, its old name
 * MUST be added here.** Forgetting leaves an orphan that still shows up in the
 * slash-command picker (or `copilot skill list`) with stale content.
 *
 * Entries stay long enough for every dev machine to have re-run at least once
 * after the rename, and each records WHEN it was retired so a future maintainer
 * can prune safely (rule of thumb: ~3+ months after the retirement commit, AND
 * all known dev machines have re-run). Removing an entry too early orphans
 * files; leaving it too long is harmless but noisy — prune periodically.
 *
 * @type {string[]} deployed command names, no extension
 */
const LLM_COMMAND_RETIRED_NAMES = [
  // 2026-10-29: PR creation now belongs to shared publication milestones.
  "sy-create-pr",
  "sy-draft-pr",
  // 2026-10-29: unused merge, release, and stale-PR utility skills retired.
  "sy-close-stale-prs",
  "sy-merge",
  "sy-release",
  // 2026-10-29: unused maintenance, local squash, and repository-cleanup skills retired.
  "sy-maintenance-day",
  "sy-squash-unpushed",
  "sy-sync-and-clean-repo",
  "sy-sync-and-clean-repos",
  // 2026-10-25: scheduler removed when restoring the pre-scheduler guidance.
  "sy-pr-loop",
  // Keep until the 2026-08-26 rename has cleared the three-month and rollout window.
  "sy-sync-and-groom-repo", // renamed to sy-sync-and-clean-repo (2026-08-26)
  "sy-sync-and-groom-repos", // renamed to sy-sync-and-clean-repos (2026-08-26)
];

/**
 * Reads a command body from LLM_COMMAND_SOURCE_FOLDER, trailing whitespace
 * trimmed. Shared so every CLI setup reads the identical bytes from the
 * identical path instead of each hardcoding the folder in its own readText.
 *
 * @param {string} sourceName - Source basename without `.md` (a LLM_COMMAND_DEPLOY_MAP value).
 * @returns {Promise<string>} The command markdown, right-trimmed.
 */
async function readLLMCommandSource(sourceName) {
  return (await readLLMDocSource(`${LLM_COMMAND_SOURCE_FOLDER}/${sourceName}.md`)).trimEnd();
}

// --- Shared Skills Folder (one physical skill, symlinked into every CLI) ---

/**
 * The ONE physical location of every Sy-managed agent skill:
 * `<shared-skills-folder>/<name>/SKILL.md`.
 *
 * Before this existed, the same command body was written three times — a real
 * file in `~/.claude/commands/<name>.md`, a generated copy in
 * `~/.copilot/skills/<name>/SKILL.md`, and an opencode symlink to Claude's copy —
 * so "which CLI has the current body" depended on which setup.js ran last.
 * Now the body is written once here and every CLI gets a symlink, which makes a
 * stale copy structurally impossible.
 *
 * Sits beside `instructions/` and `plans/` under {@link LLM_SHARED_ROOT_FOLDER}
 * for the same reason they do: one `ls` of the LLM home shows everything the LLM
 * tooling owns outside a repo checkout.
 * @type {string}
 */
const LLM_SHARED_SKILLS_FOLDER = path.join(LLM_SHARED_ROOT_FOLDER, "skills");

/**
 * Every CLI skills folder that receives a symlink to each shared skill.
 *
 * PER-SKILL links (`~/.copilot/skills/sy-debug -> <shared-skills-folder>/sy-debug`),
 * deliberately NOT a whole-folder symlink (`~/.copilot/skills -> …`). A folder
 * symlink hijacks the destination: `copilot plugin install`, `gemini skills
 * install`, and any hand-authored skill would then land inside the shared folder
 * (or be destroyed the first time this deploy ran). Per-skill links leave every
 * foreign entry in place — same tradeoff already made by
 * {@link LLM_SHARED_INSTRUCTION_LINK_FOLDERS}.
 *
 * Same "one registry, never a per-CLI list" rule as the command map: this is the
 * only place a CLI's skills folder is named, and adding a CLI is one entry here
 * rather than an edit to its setup.js.
 *
 * Verified destinations:
 *   - `~/.claude/skills`         — Claude Code personal skills.
 *   - `~/.copilot/skills`        — Copilot CLI personal skills (its only slot; it
 *                                  does not read `~/.claude/*`).
 *   - `~/.config/opencode/skills`— OpenCode global skills.
 * Gemini discovers `~/.agents/skills` directly; a second Gemini link duplicates discovery.
 *   - `~/.agents/skills`         — the cross-vendor interoperable path several
 *                                  CLIs also scan.
 * @type {string[]}
 */
const LLM_SKILL_LINK_FOLDERS = [
  path.join(BASE_HOMEDIR_LINUX, ".claude", "skills"),
  path.join(BASE_HOMEDIR_LINUX, ".copilot", "skills"),
  path.join(BASE_HOMEDIR_LINUX, ".config", "opencode", "skills"),
  path.join(BASE_HOMEDIR_LINUX, ".agents", "skills"),
];

/**
 * Max length of the `description` written into skill frontmatter. Copilot and
 * OpenCode both match the model's trigger decision on this string, so it stays a
 * summary rather than the body.
 * @type {number}
 */
const LLM_SKILL_DESCRIPTION_MAX = 400;

/**
 * Derives a skill `description` from a command source's first line.
 *
 * Every command source opens with a one-line `[Sy] <what this does>` summary,
 * which is exactly the shape a skill loader wants. Deriving it instead of
 * maintaining a parallel description map means the trigger text can never rot
 * away from the body it describes.
 *
 * @param {string} content - Full markdown source of the command file.
 * @returns {string} Single-line, YAML-safe description (double-quote escaped, length-capped).
 */
function buildLLMSkillDescription(content) {
  /** @type {string} First line with the `[Sy] ` marker stripped and whitespace collapsed. */
  let description = (content.split("\n", 1)[0] || "").replace(LLM_SKILL_MARKER, "").replace(/\s+/g, " ").trim();
  if (description.length > LLM_SKILL_DESCRIPTION_MAX) {
    description = `${description.slice(0, LLM_SKILL_DESCRIPTION_MAX - 1).trimEnd()}…`;
  }
  // YAML double-quoted scalar: only backslash and double quote need escaping.
  return description.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Extracts the first body line of a deployed SKILL.md, skipping the generated
 * YAML frontmatter block. Used for orphan detection: matching the `[Sy] ` marker
 * against this one line (rather than the whole file) means a user- or
 * plugin-authored skill that merely *mentions* the marker is never mistaken for
 * one of ours and deleted.
 *
 * @param {string} content - Full SKILL.md contents.
 * @returns {string} First non-empty line after the frontmatter, or "" when there is none.
 */
function _readSkillBodyFirstLine(content) {
  /** @type {string[]} All lines; frontmatter is fenced by a leading `---` pair. */
  const lines = content.split("\n");
  /** @type {number} Index to start scanning from — past the closing `---` when frontmatter exists. */
  let start = 0;
  if (lines[0] && lines[0].trim() === "---") {
    // No closing fence (corrupt or hand-edited file) leaves start at 0, so the
    // opening `---` itself becomes the "first line" and matches no marker — the
    // skill is left on disk. Deliberate: this feeds a destructive rmSync, so an
    // unparseable file must fail closed. Our own writer always emits both fences.
    const close = lines.indexOf("---", 1);
    if (close !== -1) start = close + 1;
  }
  for (let i = start; i < lines.length; i++) {
    if (lines[i].trim()) return lines[i];
  }
  return "";
}

/**
 * Removes shared skills that fell out of {@link LLM_COMMAND_DEPLOY_MAP}.
 *
 * A folder is ours to delete when its name is in
 * {@link LLM_COMMAND_RETIRED_NAMES} (an explicit retirement) or when its
 * SKILL.md body still carries a {@link LLM_SKILL_MARKERS} prefix (any future
 * rename, with no list to maintain). A user-authored skill dropped into the
 * shared folder matches neither and survives.
 *
 * @returns {number} Count of skill folders removed.
 */
function _pruneStaleSharedSkills() {
  if (!fs.existsSync(LLM_SHARED_SKILLS_FOLDER)) return 0;

  /** @type {Set<string>} Skill names the registry still declares. */
  const declared = new Set(Object.keys(LLM_COMMAND_DEPLOY_MAP));
  /** @type {number} Folders removed this run. */
  let removed = 0;

  for (const entry of fs.readdirSync(LLM_SHARED_SKILLS_FOLDER)) {
    if (declared.has(entry)) continue;

    /** @type {string} The candidate orphan's body file — absent means it is not a skill folder. */
    const skillFile = path.join(LLM_SHARED_SKILLS_FOLDER, entry, "SKILL.md");
    if (!fs.existsSync(skillFile)) continue;

    /** @type {string} Reason label printed in the log line — only set when we decide to remove. */
    let reason = "";
    if (LLM_COMMAND_RETIRED_NAMES.includes(entry)) {
      reason = "retired";
    } else {
      /** @type {string} First body line, checked against every LLM_SKILL_MARKERS entry. */
      const firstLine = _readSkillBodyFirstLine(fs.readFileSync(skillFile, "utf-8"));
      if (LLM_SKILL_MARKERS.some((m) => firstLine.startsWith(m))) reason = "marker";
    }
    if (!reason) continue;

    fs.rmSync(path.join(LLM_SHARED_SKILLS_FOLDER, entry), { recursive: true, force: true });
    removed++;
    log(`>> shared skills: removed prior Sy skill (${reason}): ${entry}`);
  }

  return removed;
}

/**
 * Symlinks every skill folder currently in {@link LLM_SHARED_SKILLS_FOLDER} into
 * every folder in {@link LLM_SKILL_LINK_FOLDERS}.
 *
 * Reads the shared folder rather than the registry on purpose — the link pass is
 * then dynamic, picking up a hand-authored skill dropped into the shared folder
 * with no code change, and it links what actually exists rather than what was
 * declared.
 *
 * Idempotent in both directions: a link already pointing at the right target is
 * left alone, and a link pointing at a stale target is replaced. Anything that is
 * not a symlink — a real folder a plugin installed — is never touched, and our
 * own links whose shared source has disappeared are unlinked.
 *
 * @returns {void}
 */
function linkSharedLLMSkills() {
  if (!fs.existsSync(LLM_SHARED_SKILLS_FOLDER)) return;

  /** @type {string[]} Skill folder names that actually exist in the shared folder. */
  const skillNames = fs
    .readdirSync(LLM_SHARED_SKILLS_FOLDER)
    .filter((entry) => fs.existsSync(path.join(LLM_SHARED_SKILLS_FOLDER, entry, "SKILL.md")))
    .sort();

  for (const destFolder of LLM_SKILL_LINK_FOLDERS) {
    fs.mkdirSync(destFolder, { recursive: true });

    /** @type {number} Links created or repaired this run. */
    let linked = 0;
    /** @type {number} Destinations skipped because a real folder/file already occupies them. */
    let skippedForeign = 0;

    for (const skillName of skillNames) {
      /** @type {string} The shared skill folder this link points at — the single source of truth. */
      const sourcePath = path.join(LLM_SHARED_SKILLS_FOLDER, skillName);
      /** @type {string} Absolute destination path inside this CLI's skills folder. */
      const destPath = path.join(destFolder, skillName);

      /** @type {fs.Stats|undefined} Lstat of whatever occupies the destination, if anything. */
      let stat;
      try {
        stat = fs.lstatSync(destPath);
      } catch {}

      if (stat && !stat.isSymbolicLink()) {
        skippedForeign++;
        continue;
      }

      if (stat) {
        /** @type {string} Existing link target, resolved to absolute. */
        let existing = "";
        try {
          /** @type {string} Raw link target as stored on disk (may be relative). */
          const raw = fs.readlinkSync(destPath);
          existing = path.isAbsolute(raw) ? raw : path.resolve(destFolder, raw);
        } catch {}
        if (existing === sourcePath) continue;
        try {
          fs.unlinkSync(destPath);
        } catch {}
      }

      safeSymlink(sourcePath, destPath);
      linked++;
    }

    // Sweep our own links whose shared source is gone (a retired or renamed skill).
    /** @type {Set<string>} Names the shared folder still justifies here. */
    const expected = new Set(skillNames);
    for (const entry of fs.readdirSync(destFolder)) {
      if (expected.has(entry)) continue;

      /** @type {string} Absolute path of the candidate stale link. */
      const entryPath = path.join(destFolder, entry);
      try {
        if (!fs.lstatSync(entryPath).isSymbolicLink()) continue;
        /** @type {string} Raw target as stored on disk (may be relative). */
        const raw = fs.readlinkSync(entryPath);
        /** @type {string} Resolved absolute target. */
        const target = path.isAbsolute(raw) ? raw : path.resolve(destFolder, raw);
        // Only ours: a link into the shared skills folder, under the current root or
        // one we moved away from. Anything else belongs to the user or a plugin,
        // including a link to an unrelated location.
        if (!isSharedLLMArtifactTarget(target, "skills")) continue;
        fs.unlinkSync(entryPath);
        log(`>> shared skills: removed stale link ${entryPath}`);
      } catch (e) {
        log(`>> shared skills: could not inspect ${entryPath} — ${e.message}`);
      }
    }

    log(
      `>> shared skills: linked ${linked} skill(s) into ${destFolder}` +
        (skippedForeign ? ` (skipped ${skippedForeign} foreign / user-authored entries)` : ""),
    );
  }
}

/**
 * Writes every {@link LLM_COMMAND_DEPLOY_MAP} entry into
 * `<shared-skills-folder>/<name>/SKILL.md`, prunes retired ones, then symlinks the
 * result into every CLI skills folder.
 *
 * Configured client setup scripts share this entry point. Before publishing
 * adapters, it installs or verifies immutable upstream resources and the shared
 * adapter contract. Initial installation downloads public pinned files; later
 * runs verify existing bytes and reuse them without network access.
 *
 * Frontmatter (`name` + `description`) is generated here rather than stored in
 * the repo source so the first-line `[Sy] ` ownership marker remains intact.
 * No upstream script executes during deployment. Private client artifacts stay
 * protected by the existing link and retirement ownership checks.
 *
 * @returns {Promise<void>} Resolves after dependency checks, body writes, and linking.
 * @throws {Error} On invalid dependency metadata, unsafe/corrupt resource state,
 * download failure, or required filesystem operations; adapters are not published
 * when dependency verification fails.
 */
async function deploySharedLLMSkills() {
  warnAboutLegacyLLMFolders();
  await deploySharedLLMUpstreamSkills();

  fs.mkdirSync(LLM_SHARED_SKILLS_FOLDER, { recursive: true });

  log(">> Shared LLM Skills:", LLM_SHARED_SKILLS_FOLDER);

  /** @type {Record<string, string>} Source-name → file content. Caches re-reads for aliased entries. */
  const sourceCache = {};

  for (const [skillName, sourceName] of Object.entries(LLM_COMMAND_DEPLOY_MAP)) {
    if (!(sourceName in sourceCache)) {
      sourceCache[sourceName] = await readLLMCommandSource(sourceName);
    }
    /** @type {string} Verbatim markdown body of the shared command source. */
    const body = sourceCache[sourceName];
    /** @type {string} Destination folder — every loader requires the folder form. */
    const skillFolder = path.join(LLM_SHARED_SKILLS_FOLDER, skillName);

    fs.mkdirSync(skillFolder, { recursive: true });
    await writeText(
      path.join(skillFolder, "SKILL.md"),
      `---\nname: ${skillName}\ndescription: "${buildLLMSkillDescription(body)}"\n---\n\n${body}\n`,
    );
  }

  _pruneStaleSharedSkills();
  linkSharedLLMSkills();
}

// --- Shared Agents (one registry, native delivery metadata) ---

/**
 * Repo-relative folder holding the canonical source of every Sy-managed agent.
 *
 * One `.md` per agent, describing a **worker persona** — who the agent is, what
 * it owns, what it must never touch — and deliberately NOT the workflow it runs.
 * The workflow lives in the matching skill; an agent that also carried the steps
 * would be a second copy of them, drifting the moment either side is edited.
 *
 * Sources are vendor-neutral prose with no frontmatter: they name no CLI, no tool
 * (`Task`, `Agent`, `@name`), and no model. Each opens with the same first-line
 * `[Sy] <what this is>` marker the command sources use, so one description
 * derivation and one orphan-detection rule serve both corpora.
 * @type {string}
 */
const LLM_AGENT_SOURCE_FOLDER = "software/scripts/advanced/llm/_common/v_current/agents";

/**
 * The one registry of Sy-managed agents, shared by every LLM CLI setup.
 *
 * The registry is empty after retiring the PR workers; deployment remains active for cleanup.
 * Key   = deployed agent name, **without** any extension (e.g. `sy-agent-example`).
 *         Every CLI derives its own filename from this key via the per-CLI
 *         `suffix` in {@link LLM_AGENT_LINK_FOLDERS}, which is what lets one
 *         map serve `~/.config/opencode/agent/<key>.md` and
 *         `~/.copilot/agents/<key>.agent.md` at once.
 * Value = source basename (no `.md`) under {@link LLM_AGENT_SOURCE_FOLDER}.
 *
 * `sy-agent-` distinguishes worker names from `sy-` workflow names in pickers
 * and dispatch labels. The source remains vendor-neutral; each client supplies
 * its own invocation syntax.
 *
 * Source filenames stay BARE (`pr-babysitter.md`), exactly like the command
 * sources: the prefix is purely a deploy-time decoration, so editing an agent
 * never means typing it, and a future prefix change is one edit to this map
 * rather than a rename of every file in the corpus.
 *
 * Editing an agent: edit `<LLM_AGENT_SOURCE_FOLDER>/<value>.md`.
 * Adding an agent: drop the new `.md` there + add ONE entry here — every CLI in
 *   {@link LLM_AGENT_LINK_FOLDERS} picks it up on its next setup run.
 * Renaming / removing: move the OLD key into {@link LLM_AGENT_RETIRED_NAMES}.
 *
 * @type {Record<string, string>}
 */
const LLM_AGENT_DEPLOY_MAP = {};

/**
 * Agent names we used to deploy but no longer do. Same contract and same
 * maintenance rule as {@link LLM_COMMAND_RETIRED_NAMES}: whenever an agent is
 * renamed or deleted, its OLD name goes here in the same commit, or every dev
 * machine keeps an orphan the harness still offers.
 *
 * Entries record WHEN they were retired so a future maintainer can prune safely
 * (rule of thumb: ~3+ months after the retirement commit, AND every dev machine
 * has re-run at least once).
 * @type {string[]} deployed agent names, no extension
 */
const LLM_AGENT_RETIRED_NAMES = [
  // 2026-08-20: every Sy-managed agent gained the `sy-` prefix its command
  // counterparts already carry, so ownership is legible in the harness label
  // that renders it. The OLD unprefixed names below are retired — re-running any
  // setup.js on a machine still holding them will delete them.
  "pr-babysitter", // renamed to sy-pr-babysitter (2026-08-20)
  "pr-reviewer", // renamed to sy-pr-reviewer (2026-08-20)
  // 2026-10-23: distinguish worker names from workflow names at deployment.
  "sy-pr-babysitter", // renamed to sy-agent-pr-babysitter
  "sy-pr-reviewer", // renamed to sy-agent-pr-reviewer
  // 2026-10-25: removed with the PR worker persona sources.
  "sy-agent-pr-babysitter",
  "sy-agent-pr-reviewer",
];

/**
 * Shared union-format files for every Sy-managed agent: `<shared-agents-folder>/<name>.md`.
 *
 * Sits beside `skills/`, `instructions/`, and `plans/` under
 * {@link LLM_SHARED_ROOT_FOLDER} for the same reason they do: one `ls` of the
 * LLM home shows everything the LLM tooling owns outside a repo checkout.
 * @type {string}
 */
const LLM_SHARED_AGENTS_FOLDER = path.join(LLM_SHARED_ROOT_FOLDER, "agents");

/**
 * Native frontmatter additions, separate from destination and content registries.
 *
 * Compatible tools share OpenCode's required `mode` key. Strict consumers use
 * only `name` and `description`; adding a tool with either shape needs no renderer.
 * @type {Record<string, string>}
 */
const LLM_AGENT_FORMATS = { shared: "\nmode: subagent", portable: "" };

/**
 * Native destinations for every shared agent, matching the shared skill helpers.
 *
 * Defaults are per-agent symlinks and shared union frontmatter. A destination
 * declares only shape and delivery differences, never agent names or sources.
 * Never link an entire folder: user- and plugin-authored entries must survive.
 *
 * Claude, Copilot, OpenCode, and Pi accept the shared file. Gemini 0.64.0 uses
 * a strict schema and its directory loader accepts only regular files, ignoring
 * symlinks. Its generated portable adapter is the deliberate exception to linking.
 *
 * Probe destinations through native discovery before adding them. Existing probes:
 * `claude --agent zz-nope -p x`, `copilot --agent zz-nope -p x`,
 * `opencode agent list`, Gemini's `loadAgentsFromDirectory`, and Pi's agent list.
 * OpenCode discovery may lag a write; recheck before diagnosing a missing entry.
 * @type {Array<{folder: string, suffix: string, delivery?: "file", format?: string}>}
 */
const LLM_AGENT_LINK_FOLDERS = [
  { folder: path.join(BASE_HOMEDIR_LINUX, ".claude", "agents"), suffix: ".md" },
  { folder: path.join(BASE_HOMEDIR_LINUX, ".copilot", "agents"), suffix: ".agent.md" },
  { folder: path.join(BASE_HOMEDIR_LINUX, ".config", "opencode", "agent"), suffix: ".md" },
  { folder: path.join(BASE_HOMEDIR_LINUX, ".gemini", "agents"), suffix: ".md", delivery: "file", format: "portable" },
  { folder: path.join(BASE_HOMEDIR_LINUX, ".pi", "agent", "agents"), suffix: ".md" },
];

/**
 * Builds native frontmatter without changing the vendor-neutral agent body.
 *
 * `name` is REQUIRED by Claude Code (a file carrying only `description` is
 * silently skipped) and used by Copilot; OpenCode ignores it and takes the name
 * from the filename. `mode: subagent` is required by OpenCode to classify the
 * agent as dispatchable rather than primary; Claude and Copilot ignore it.
 * Dropping either key breaks one CLI without any visible error.
 *
 * @param {string} name - Deployed agent name (a {@link LLM_AGENT_DEPLOY_MAP} key).
 * @param {string} description - Derived, YAML-safe trigger description.
 * @param {string} [format="shared"] - Registered frontmatter shape.
 * @returns {string} The YAML block, without its enclosing `---` fences.
 * @throws {Error} If the format is not registered; no files are written.
 */
function buildLLMAgentFrontmatter(name, description, format = "shared") {
  if (!Object.prototype.hasOwnProperty.call(LLM_AGENT_FORMATS, format)) {
    throw new Error(`Unknown agent format: ${format}`);
  }
  return `name: ${name}\ndescription: "${description}"${LLM_AGENT_FORMATS[format]}`;
}

/**
 * Reads an agent body from {@link LLM_AGENT_SOURCE_FOLDER}, trailing whitespace
 * trimmed. Shared so every CLI setup reads the identical bytes from the identical
 * path instead of each hardcoding the folder in its own readText.
 *
 * @param {string} sourceName - Source basename without `.md` (a {@link LLM_AGENT_DEPLOY_MAP} value).
 * @returns {Promise<string>} The agent markdown, right-trimmed.
 */
async function readLLMAgentSource(sourceName) {
  return (await readLLMDocSource(`${LLM_AGENT_SOURCE_FOLDER}/${sourceName}.md`)).trimEnd();
}

/**
 * Removes shared agents that fell out of {@link LLM_AGENT_DEPLOY_MAP}.
 *
 * A file is ours to delete when its name is in {@link LLM_AGENT_RETIRED_NAMES}
 * (an explicit retirement) or when its body still carries a
 * {@link LLM_SKILL_MARKERS} prefix (any future rename, with no list to maintain).
 * A user-authored agent dropped into the shared folder matches neither and
 * survives — this feeds a destructive `rmSync`, so anything unrecognized fails
 * closed and is left on disk.
 *
 * @returns {number} Count of shared agent files removed.
 */
function _pruneStaleSharedAgents() {
  if (!fs.existsSync(LLM_SHARED_AGENTS_FOLDER)) return 0;

  /** @type {Set<string>} Filenames the registry still declares. */
  const declared = new Set(Object.keys(LLM_AGENT_DEPLOY_MAP).map((name) => `${name}.md`));
  /** @type {Set<string>} Filenames explicitly retired, so they go even without a marker. */
  const retired = new Set(LLM_AGENT_RETIRED_NAMES.map((name) => `${name}.md`));
  /** @type {number} Files removed this run. */
  let removed = 0;

  for (const entry of fs.readdirSync(LLM_SHARED_AGENTS_FOLDER)) {
    if (declared.has(entry) || !entry.endsWith(".md")) continue;

    /** @type {string} Absolute path of the candidate orphan. */
    const entryPath = path.join(LLM_SHARED_AGENTS_FOLDER, entry);
    /** @type {string} Reason label printed in the log line — only set when we decide to remove. */
    let reason = "";
    if (retired.has(entry)) {
      reason = "retired";
    } else {
      try {
        /** @type {string} First body line, past the generated frontmatter fence. */
        const firstLine = _readSkillBodyFirstLine(fs.readFileSync(entryPath, "utf-8"));
        if (LLM_SKILL_MARKERS.some((m) => firstLine.startsWith(m))) reason = "marker";
      } catch {}
    }
    if (!reason) continue;

    try {
      fs.rmSync(entryPath, { force: true });
      removed++;
      log(`>> shared agents: removed prior Sy agent (${reason}): ${entry}`);
    } catch (e) {
      log(`>> shared agents: could not remove ${entryPath} — ${e.message}`);
    }
  }

  return removed;
}

/**
 * Removes every Sy-owned agent artifact in the CLI link folders that the registry
 * no longer justifies.
 *
 * Runs BEFORE the write/link pass, mirroring the instructions corpus. Remove
 * obsolete owned artifacts while retaining expected native files for idempotent
 * updates. The delivery pass preserves all surviving foreign artifacts.
 *
 * Three classes of leftover are swept, each ours by evidence rather than by path,
 * so a user- or plugin-authored entry matches none and survives:
 *   1. Dangling links (target gone) that pointed into a shared agents folder.
 *   2. Stale links, including ones under a root we have since moved away from.
 *   3. Marked real files left by the old renderer, except expected native files.
 *      Expected owned symlinks also go when the destination now requires a file.
 *
 * `lstat` / `readlink` are used throughout rather than `existsSync`, so a dangling
 * link is inspected rather than skipped as absent.
 *
 * @returns {number} Count of artifacts removed.
 */
function pruneOrphanedSharedLLMAgents() {
  /** @type {number} Artifacts removed this run, across every folder. */
  let removed = 0;

  for (const { folder: destFolder, suffix, delivery } of LLM_AGENT_LINK_FOLDERS) {
    if (!fs.existsSync(destFolder)) continue;

    /** @type {Set<string>} Link basenames the registry still justifies in this folder. */
    const expected = new Set(Object.keys(LLM_AGENT_DEPLOY_MAP).map((name) => `${name}${suffix}`));

    for (const entry of fs.readdirSync(destFolder)) {
      /** @type {string} Absolute path of the candidate leftover. */
      const entryPath = path.join(destFolder, entry);

      /** @type {fs.Stats|undefined} Lstat of the entry itself — never followed, so danglers show up. */
      let stat;
      try {
        stat = fs.lstatSync(entryPath);
      } catch (e) {
        log(`>> shared agents: could not inspect ${entryPath} while pruning — ${e.message}`);
        continue;
      }

      /** @type {string} Why this entry is ours to delete — empty means leave it alone. */
      let reason = "";

      if (stat.isSymbolicLink()) {
        /** @type {string} Resolved link target, whether or not it still exists. */
        let target = "";
        try {
          /** @type {string} Raw target as stored on disk (may be relative). */
          const raw = fs.readlinkSync(entryPath);
          target = path.isAbsolute(raw) ? raw : path.resolve(destFolder, raw);
        } catch (e) {
          log(`>> shared agents: could not read link ${entryPath} while pruning — ${e.message}`);
          continue;
        }
        // Only ours: a link into a shared agents folder, under the current root or
        // one we moved away from. Anything else is a plugin's or the user's.
        if (!isSharedLLMArtifactTarget(target, "agents")) continue;
        if (!fs.existsSync(target)) reason = "dangling link";
        else if (!expected.has(entry)) reason = "stale link";
        else if (delivery === "file") reason = "native file required";
      } else if (stat.isFile()) {
        // A real file is ours only when it still carries our own marker — the
        // render-per-CLI leftover case. Unreadable or unmarked fails closed.
        try {
          /** @type {string} First body line, past any generated frontmatter fence. */
          const firstLine = _readSkillBodyFirstLine(fs.readFileSync(entryPath, "utf-8"));
          if (LLM_SKILL_MARKERS.some((m) => firstLine.startsWith(m)) && !(delivery === "file" && expected.has(entry))) {
            reason = "prior rendered copy";
          }
        } catch {}
      }

      if (!reason) continue;

      try {
        fs.rmSync(entryPath, { force: true });
        removed++;
        log(`>> shared agents: removed ${reason} ${entryPath}`);
      } catch (e) {
        log(`>> shared agents: could not remove ${entryPath} — ${e.message}`);
      }
    }
  }

  return removed;
}

/**
 * Delivers shared agents using each destination's suffix, format, and delivery mode.
 * Symlinks are the default; strict regular-file consumers receive generated adapters.
 *
 * Reads the shared folder rather than the registry on purpose — the link pass is
 * then dynamic, picking up a hand-authored agent dropped into the shared folder
 * with no code change, and it links what actually exists rather than what was
 * declared.
 *
 * Idempotent: correct links and unchanged native files stay untouched.
 * Preserve foreign symlinks; replace native files only when marked as ours.
 * {@link pruneOrphanedSharedLLMAgents} clears owned obsolete artifacts first.
 *
 * @returns {Promise<void>} Resolves after links and native files are reconciled.
 * @throws {Error} If native file reading, rendering, or writing fails.
 */
async function linkSharedLLMAgents() {
  if (!fs.existsSync(LLM_SHARED_AGENTS_FOLDER)) return;

  /** @type {string[]} Agent basenames (no extension) that actually exist in the shared folder. */
  const agentNames = fs
    .readdirSync(LLM_SHARED_AGENTS_FOLDER)
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => path.basename(entry, ".md"))
    .sort();

  for (const { folder: destFolder, suffix, delivery, format } of LLM_AGENT_LINK_FOLDERS) {
    fs.mkdirSync(destFolder, { recursive: true });

    /** @type {number} Links or native files created or repaired this run. */
    let linked = 0;
    /** @type {number} Destinations skipped because a real file already occupies them. */
    let skippedForeign = 0;

    for (const agentName of agentNames) {
      /** @type {string} The shared agent file this link points at — the single source of truth. */
      const sourcePath = path.join(LLM_SHARED_AGENTS_FOLDER, `${agentName}.md`);
      /** @type {string} Absolute destination path, carrying this CLI's own suffix. */
      const destPath = path.join(destFolder, `${agentName}${suffix}`);

      /** @type {fs.Stats|undefined} Lstat of whatever occupies the destination, if anything. */
      let stat;
      try {
        stat = fs.lstatSync(destPath);
      } catch {}

      if (delivery === "file") {
        if (
          stat &&
          (!stat.isFile() ||
            !LLM_SKILL_MARKERS.some((marker) => _readSkillBodyFirstLine(fs.readFileSync(destPath, "utf-8")).startsWith(marker)))
        ) {
          skippedForeign++;
          continue;
        }
        /** @type {string} Expanded body from the shared artifact; never a second authored source. */
        const body = fs
          .readFileSync(sourcePath, "utf-8")
          .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n\r?\n?/, "")
          .trimEnd();
        /** @type {string} Native artifact rebuilt through the shared frontmatter renderer. */
        const content = `---\n${buildLLMAgentFrontmatter(agentName, buildLLMSkillDescription(body), format)}\n---\n\n${body}\n`;
        if (stat && fs.readFileSync(destPath, "utf-8") === content) continue;
        await writeText(destPath, content);
        linked++;
        continue;
      }

      if (stat && !stat.isSymbolicLink()) {
        // Anything still a real file here belongs to a plugin or the user.
        skippedForeign++;
        continue;
      }

      if (stat) {
        /** @type {string} Existing link target, resolved to absolute. */
        let existing = "";
        try {
          /** @type {string} Raw link target as stored on disk (may be relative). */
          const raw = fs.readlinkSync(destPath);
          existing = path.isAbsolute(raw) ? raw : path.resolve(destFolder, raw);
        } catch {}
        if (existing === sourcePath) continue;
        if (!isSharedLLMArtifactTarget(existing, "agents")) {
          skippedForeign++;
          continue;
        }
        try {
          fs.unlinkSync(destPath);
        } catch {}
      }

      safeSymlink(sourcePath, destPath);
      linked++;
    }

    log(
      `>> shared agents: deployed ${linked} agent(s) into ${destFolder}` +
        (skippedForeign ? ` (skipped ${skippedForeign} foreign / user-authored entries)` : ""),
    );
  }
}

/**
 * Writes every {@link LLM_AGENT_DEPLOY_MAP} entry into
 * `<shared-agents-folder>/<name>.md`, prunes orphans, then delivers native artifacts
 * into every CLI agents folder according to the destination metadata.
 *
 * Called by all five setup scripts. Writing the same bytes from each is
 * intentional and safe — the content is byte-identical, so whichever CLI runs
 * first does the work and the rest are no-ops. That keeps every CLI
 * independently able to repair the shared corpus without one being a prerequisite.
 *
 * Frontmatter is generated here rather than stored in the repo source: adding it
 * upstream would break the first-line `[Sy] ` marker that orphan detection relies
 * on, and the source has to stay vendor-neutral prose.
 *
 * @returns {Promise<void>}
 */
async function deploySharedLLMAgents() {
  fs.mkdirSync(LLM_SHARED_AGENTS_FOLDER, { recursive: true });

  log(">> Shared LLM Agents:", LLM_SHARED_AGENTS_FOLDER);

  // Clear our own leftovers first — dangling links, links under a retired name,
  // and obsolete marked files. Expected native adapters remain for no-op writes.
  pruneOrphanedSharedLLMAgents();

  /** @type {Record<string, string>} Source-name → file content. Caches re-reads for aliased entries. */
  const sourceCache = {};

  for (const [agentName, sourceName] of Object.entries(LLM_AGENT_DEPLOY_MAP)) {
    if (!(sourceName in sourceCache)) {
      sourceCache[sourceName] = await readLLMAgentSource(sourceName);
    }
    /** @type {string} Verbatim markdown body of the shared agent source. */
    const body = sourceCache[sourceName];

    await writeText(
      path.join(LLM_SHARED_AGENTS_FOLDER, `${agentName}.md`),
      `---\n${buildLLMAgentFrontmatter(agentName, buildLLMSkillDescription(body))}\n---\n\n${body}\n`,
    );
  }

  _pruneStaleSharedAgents();
  await linkSharedLLMAgents();
}

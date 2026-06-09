/**
 * Shared constants and helpers for LLM CLI setup scripts (claude, copilot, gemini, opencode).
 *
 * Lives here (instead of pulling from software/scripts/advanced/editor.common.js) so the
 * llm/* setup scripts are self-contained — none of them SOURCE editor.common.js anymore.
 * Anything that the editor.common.js helpers used to expose AND that an llm/* script still
 * needs lives below as a local copy.
 *
 * Run: `bash run.sh --files="opencode/setup.js"` (or any other llm/<name>/setup.js).
 */

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
 * Shape on disk: `<!-- BEGIN synle/bashrc | software/scripts/advanced/llm/_common/instructions.md -->`
 *                ... managed content ...
 *                `<!-- END synle/bashrc | software/scripts/advanced/llm/_common/instructions.md -->`
 *
 * Shared so all four CLI setups stay in lockstep — changing this here updates claude,
 * copilot, gemini, and opencode in one edit.
 * @type {string}
 */
const LLM_INSTRUCTIONS_MARKER = "synle/bashrc | software/scripts/advanced/llm/_common/instructions.md";

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
 * standard `mcpServers` shape (Claude / Copilot / Gemini consume verbatim;
 * OpenCode translates via `_translateToOpencodeMcp()`).
 * @type {string}
 */
const SHARED_MCP_REGISTRY_PATH = "software/scripts/advanced/llm/_common/mcp-servers.jsonc";

/**
 * Loads the shared MCP server registry from `_common/mcp-servers.jsonc` and
 * returns the inner `mcpServers` map (an object of `name → server-config`).
 * Returns an empty object when the file is missing, unreadable, or the
 * `mcpServers` key is absent — callers can iterate the result without
 * additional guards.
 *
 * @returns {Promise<Record<string, any>>} Map of server name to server config (standard shape).
 */
async function loadSharedMcpServers() {
  /** @type {{ mcpServers?: Record<string, any> } | null} */
  const json = await readJson`${SHARED_MCP_REGISTRY_PATH}`;
  if (!json || typeof json !== "object") return {};
  /** @type {Record<string, any>} */
  const servers = json.mcpServers && typeof json.mcpServers === "object" ? json.mcpServers : {};
  return servers;
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

// --- Ollama Provider Discovery ---

/**
 * Default Ollama HTTP port (upstream default).
 * @type {number}
 */
const OLLAMA_PORT = 11434;

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
 * Discovers reachable Ollama providers and the models they expose, returning input objects
 * shaped for downstream config builders (e.g. opencode's `_buildOpencodeConfig`).
 *
 * Probes the two known hosts in priority order: the sy-omen45l workstation (IP resolved via
 * `getSyHPOmenHomeIpAddress` from `software/metadata/ip-address.config`, with `192.168.1.45`
 * as the documented fallback if the config lookup returns null) and the local loopback
 * `127.0.0.1`. Each host that responds with at least one model becomes one provider entry.
 * Hosts that fail to respond (offline, unreachable, no models) are dropped entirely — the
 * caller never has to worry about pruning an empty `ollama-local` from its provider map.
 *
 * Models are NOT hardcoded: every reachable host contributes whatever `/api/tags` reports.
 *
 * @returns {Promise<Array<{id: string, name: string, baseURL: string, models: Array<{name: string}>}>>}
 *   Empty array if no host is reachable.
 */
async function getOllamaProviderInputs() {
  // Resolve sy-omen45l via the shared ip-address.config lookup (in index.js so any script
  // can use it). Fall back to the documented LAN IP only when the config is missing or
  // hasn't been built yet — keeps behavior consistent on a fresh dev machine.
  const omenIpFromConfig = await getSyHPOmenHomeIpAddress();
  const omenIp = omenIpFromConfig || "192.168.1.45";
  const localIp = "127.0.0.1";

  /** @type {Array<{id: string, host: string, displayName: string}>} */
  const candidates = [
    { id: "ollama-sy-omen45l", host: omenIp, displayName: `Sy-omen45l - ${omenIp}:${OLLAMA_PORT}` },
    { id: "ollama-local", host: localIp, displayName: `Local - ${localIp}:${OLLAMA_PORT}` },
  ];

  /** @type {Array<{id: string, name: string, baseURL: string, models: Array<{name: string}>}>} */
  const providers = [];
  for (const { id, host, displayName } of candidates) {
    const modelNames = await _fetchOllamaModelNames(host);
    if (modelNames.length === 0) {
      log(`>> ollama: dropping provider ${id} (${host}) — no reachable models`);
      continue;
    }
    log(`>> ollama: discovered ${modelNames.length} model(s) on ${id} (${host}): ${modelNames.join(", ")}`);
    providers.push({
      id,
      name: displayName,
      baseURL: `http://${host}:${OLLAMA_PORT}/v1`,
      models: modelNames.map((name) => ({ name })),
    });
  }

  return providers;
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
 * @type {string[]}
 */
const AUTOCOMPLETE_MODELS = ["qwen2.5-coder:1.5b-base", "qwen2.5-coder:3b-base", "qwen2.5-coder:7b-base"];

/**
 * Picks the best Ollama host + model for editor inline autocomplete (Zed's
 * `edit_predictions`). Currently Zed-only — VS Code has no native inline-completion API
 * for custom endpoints (Copilot Chat handles only chat-side BYOK via chatLanguageModels.json).
 *
 * Priority is the INVERSE of `getOllamaProviderInputs`: `127.0.0.1` is probed FIRST and
 * `sy-omen45l` only as a LAN fallback. Reason: autocomplete fires per keystroke; localhost
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
 * editor hammer a dead host on every keystroke. With the block absent, editors fall back
 * to their own defaults (Zeta in Zed, no inline completion in vanilla VSCode).
 *
 * Network reachability is bounded by `_URL_FETCH_TIMEOUT_MS` (3s) in `_readTextFromURL`
 * via the existing `AbortSignal.timeout` in `readJson`, so a totally-offline omen45l can't
 * stall setup.
 *
 * @param {string[]} [preferred=AUTOCOMPLETE_MODELS] - Acceptable model tags in priority order.
 * @returns {Promise<{host: string, port: number, model: string}|null>} Picked host+model or null.
 */
async function getAutocompleteProvider(preferred = AUTOCOMPLETE_MODELS) {
  const omenIp = (await getSyHPOmenHomeIpAddress()) || "192.168.1.45";
  // Localhost FIRST, sy-omen45l SECOND. Reverse of getOllamaProviderInputs (see JSDoc).
  /** @type {string[]} */
  const hosts = ["127.0.0.1", omenIp];

  for (const host of hosts) {
    const tags = await _fetchOllamaModelNames(host);
    if (tags.length === 0) continue; // Host unreachable OR has no models — try the next one.
    const match = preferred.find((m) => tags.includes(m));
    if (match) {
      log(`>> autocomplete: picked ${match} on ${host}`);
      return { host, port: OLLAMA_PORT, model: match };
    }
    log(`>> autocomplete: ${host} reachable but no preferred model present (saw: ${tags.join(", ")})`);
  }
  return null;
}

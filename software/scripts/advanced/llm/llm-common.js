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

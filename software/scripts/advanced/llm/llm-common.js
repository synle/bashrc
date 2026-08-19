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
 * Probes the known hosts in priority order: the sy-omen45l workstation first, then the
 * local loopback `127.0.0.1`. Each host that responds with at least one model becomes one
 * provider entry. Hosts that fail to respond (offline, unreachable, no models) are dropped
 * entirely — the caller never has to worry about pruning an empty `ollama-local` from its
 * provider map.
 *
 * The sy-omen45l address is NOT hardcoded here: it is resolved at runtime by
 * `getSyHPOmenHomeIpAddress()` (index.js), which reads
 * `software/metadata/ip-address.config` — the single source of truth for every
 * home-network address. When that lookup yields nothing (config unreadable or the
 * hostname was removed), the remote candidate is skipped and only localhost is probed;
 * an unresolvable hostname is treated exactly like an unreachable one.
 *
 * Models are NOT hardcoded either: every reachable host contributes whatever `/api/tags` reports.
 *
 * @returns {Promise<Array<{id: string, name: string, baseURL: string, models: Array<{name: string}>}>>}
 *   Empty array if no host is reachable.
 */
async function getOllamaProviderInputs() {
  // sy-omen45l's address lives in software/metadata/ip-address.config and is resolved
  // through index.js so every script shares one lookup. No literal IP belongs in this file.
  const omenIp = await getSyHPOmenHomeIpAddress();
  const localIp = "127.0.0.1";

  /** @type {Array<{id: string, host: string, displayName: string}>} */
  const candidates = [];

  // Remote first (see JSDoc for why), and only when the config actually resolved it.
  if (omenIp) {
    candidates.push({
      id: "ollama-sy-omen45l",
      host: omenIp,
      displayName: `Sy-omen45l - ${omenIp}:${OLLAMA_PORT}`,
    });
  } else {
    log(">> ollama: skipping sy-omen45l — no address in software/metadata/ip-address.config");
  }

  candidates.push({
    id: "ollama-local",
    host: localIp,
    displayName: `Local - ${localIp}:${OLLAMA_PORT}`,
  });

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
 * editor hammer a dead host on every keystroke. With the block absent, each editor keeps
 * whatever its own base config declares: Zed keeps zed-config.jsonc's catch-all
 * `edit_predictions.disabled_globs` entry, so inline AI stays fully off rather than
 * falling through to Zed's cloud Zeta; vanilla VSCode has no inline completion at all.
 *
 * Network reachability is bounded by `_URL_FETCH_TIMEOUT_MS` (3s) in `_readTextFromURL`
 * via the existing `AbortSignal.timeout` in `readJson`, so a totally-offline omen45l can't
 * stall setup.
 *
 * As in `getOllamaProviderInputs`, sy-omen45l's address comes from
 * `software/metadata/ip-address.config` via `getSyHPOmenHomeIpAddress()` and is simply
 * omitted from the probe list when that lookup yields nothing.
 *
 * @param {string[]} [preferred=AUTOCOMPLETE_MODELS] - Acceptable model tags in priority order.
 * @returns {Promise<{host: string, port: number, model: string}|null>} Picked host+model or null.
 */
async function getAutocompleteProvider(preferred = AUTOCOMPLETE_MODELS) {
  const omenIp = await getSyHPOmenHomeIpAddress();
  // Localhost FIRST, sy-omen45l SECOND. Reverse of getOllamaProviderInputs (see JSDoc).
  // The remote entry is appended only when ip-address.config resolved an address.
  /** @type {string[]} */
  const hosts = ["127.0.0.1"];
  if (omenIp) hosts.push(omenIp);

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
 * Local (Ollama) agent model tags in priority order — first tag that a reachable
 * Ollama host actually serves wins. Mirrors the agent-side coding tags in
 * opencode's `OLLAMA_MODEL_CONFIGS`; the `-base` FIM tags in `AUTOCOMPLETE_MODELS`
 * are deliberately absent (they are completion checkpoints, not chat agents).
 *
 * Never hardcode one tag: a laptop with no local daemon and a workstation with a
 * 35B MoE must both resolve without an edit here, and an unresolvable list means
 * the `local` agent is simply omitted rather than pointed at a dead model.
 * @type {string[]}
 */
const LLM_LOCAL_AGENT_MODELS = [
  "qwen3.6:35b-a3b-mtp-q4_K_M",
  "qwen3.6:35b-a3b-q4_K_M",
  "qwen3.6:27b-q4_K_M",
  "qwen3-coder:30b-a3b-q4_K_M",
  "qwen3.6:latest",
  "qwen3-coder:30b",
  "qwen2.5-coder:14b",
];

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
 * Permissions are deliberately omitted so every agent inherits the top-level
 * `permission: "allow"`. The one exception is `review`, which is read-only by
 * construction — a reviewer that can edit turns a review into a rewrite.
 *
 * The `local` opencode entry carries `models` (a preference list) instead of `model`,
 * because the winning tag depends on which Ollama host is reachable at setup time.
 * `resolveOpencodeAgentConfig()` turns it into a concrete `model` and drops the agent
 * entirely when nothing local is reachable.
 *
 * @type {Record<string, Record<string, object|null>>}
 */
const AGENT_TO_MODEL_MAP = {
  build: {
    claude: null,
    copilot: null,
    gemini: null,
    opencode: { mode: "primary", model: `${LLM_COPILOT_PROVIDER_ID}/claude-opus-5` },
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

    // Concrete model — copy through untouched.
    if (entry.model) {
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

// --- Deployed-doc path placeholders ---

/**
 * The tokens a deployed LLM doc writes instead of a machine-specific folder, and
 * the real path each resolves to on THIS machine.
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
 * Token name matches the env var name exactly, so `<LLM_ROOT_FOLDER>` in a doc and
 * `$LLM_ROOT_FOLDER` in a script are visibly the same thing.
 * @type {Record<string, string>}
 */
const LLM_DOC_PATH_PLACEHOLDERS = {
  "<LLM_ROOT_FOLDER>": LLM_SHARED_ROOT_FOLDER,
  "<SY_ROOT_FOLDER>": SY_ROOT_FOLDER,
};

/**
 * Replaces every {@link LLM_DOC_PATH_PLACEHOLDERS} token with its resolved path.
 *
 * Plain split/join rather than a regex so a token never has to be escaped and a
 * stray `<` elsewhere in the prose can never be captured.
 * @param {string} text Raw doc content read from a repo source.
 * @returns {string} The same content with every placeholder resolved.
 */
function resolveLLMDocPlaceholders(text) {
  let resolved = text;
  for (const [token, value] of Object.entries(LLM_DOC_PATH_PLACEHOLDERS)) {
    resolved = resolved.split(token).join(value);
  }
  return resolved;
}

/**
 * The ONE reader for any repo doc destined for a deployed LLM surface — the
 * always-loaded instructions, every split instruction file, every `/sy-*` skill
 * body, and each CLI's own tweaks file.
 *
 * Every one of them goes through here rather than calling `readText` directly, so
 * placeholder resolution can never be forgotten on a new deploy path. A doc that
 * skipped it would ship `<LLM_ROOT_FOLDER>` verbatim to an agent, which reads as a
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

/**
 * Plan and RFC artifacts (`plan-YYYY-MM-DD-<slug>.md`, `.diff`, `rfc-*.md`), kept
 * out of repo working trees so they need no `.gitignore` entry and can't be
 * committed by accident.
 * @type {string}
 */
const LLM_SHARED_PLANS_FOLDER = path.join(LLM_SHARED_ROOT_FOLDER, "plans");

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
  "pr-workflow.md": "software/scripts/advanced/llm/_common/instructions-pr-workflow.md",
  "debugging.md": "software/scripts/advanced/llm/_common/instructions-debugging.md",
  "testing.md": "software/scripts/advanced/llm/_common/instructions-testing.md",
  // Unlike its siblings, this one is ALSO inlined back into the top of
  // instructions.md through a BEGIN/END path block, so the always-loaded copy and
  // the standalone document can never drift. It is here so opencode loads it as a
  // separate rules document (instructions[]) rather than as ~1% of one 36k blob —
  // persona is the oldest, smallest thing in context and the first to decay.
  "persona.md": "software/scripts/advanced/llm/_common/instructions-persona.md",
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
  fs.mkdirSync(LLM_SHARED_PLANS_FOLDER, { recursive: true });

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
 * @returns {string[]} Absolute paths to every `.md` in LLM_SHARED_INSTRUCTIONS_FOLDER.
 */
function getSharedLLMInstructionFilePaths() {
  if (!fs.existsSync(LLM_SHARED_INSTRUCTIONS_FOLDER)) return [];

  try {
    return fs
      .readdirSync(LLM_SHARED_INSTRUCTIONS_FOLDER)
      .filter((entry) => entry.endsWith(".md"))
      .sort()
      .map((entry) => path.join(LLM_SHARED_INSTRUCTIONS_FOLDER, entry));
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
  const content = (await readLLMDocSource("software/scripts/advanced/llm/_common/instructions.md")).trim();
  return [
    `<!-- ${getAutoGeneratedText(content.length).trim()} -->`,
    content,
    `<!-- ${getAutoGeneratedEndText(content.length).trim()} -->`,
  ].join("\n");
}

// --- Shared Command Registry (deployed as slash commands / skills per CLI) ---

/**
 * Repo-relative folder holding the single source of truth for every Sy-managed
 * command body. One `.md` per command, shared verbatim by every CLI — Claude
 * Code deploys them as slash commands, Copilot as personal skills, OpenCode
 * symlinks Claude's copies, and Gemini has no command surface at all.
 * @type {string}
 */
const LLM_COMMAND_SOURCE_FOLDER = "software/scripts/advanced/llm/_common/commands";

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
  "sy-close-stale-prs": "close-stale-prs",
  "sy-create-pr": "create-pr",
  "sy-debug": "debug",
  "sy-dep-bump": "dep-bump",
  "sy-draft-pr": "draft-pr",
  "sy-list-prs": "list-prs",
  "sy-list-prs-pending": "list-prs-pending",
  "sy-maintenance-day": "maintenance-day",
  "sy-onboard-repo": "onboard-repo",
  "sy-plan-grill-me": "plan-grill-me",
  // Single release entry-point. The command body checks $ARGUMENTS to decide
  // official vs beta — no per-channel alias files anymore (the old
  // /sy-release-{main,master,stable,official,beta} aliases were retired
  // 2026-05-13; see LLM_COMMAND_RETIRED_NAMES below).
  "sy-release": "release",
  "sy-review-pr": "review-pr",
  "sy-review-prs": "review-prs",
  "sy-slack-prs": "slack-prs",
  "sy-squash-unpushed": "squash-unpushed",
  "sy-standup": "standup",
  "sy-sync-and-groom-repo": "sync-and-groom-repo",
  "sy-sync-and-groom-repos": "sync-and-groom-repos",
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
  // TODO(retired-cleanup): drop these once we're confident every dev machine
  // has re-run `bash run.sh --files=setup.js` at least once after the merge
  // commit (rule of thumb: 3+ months after the date below). Removing too
  // early orphans files; periodically prune so this list stays signal-only.
  "sync-babysit-pr", // merged into /sy-babysit-pr in 119cc9d (2026-04-24)
  "sync-babysit-prs", // merged into /sy-babysit-prs in 119cc9d (2026-04-24)
  // 2026-05-11: every Sy-managed command was renamed to a `sy-` prefix
  // (e.g. /babysit-pr -> /sy-babysit-pr) so they cluster in the `/` menu and
  // never collide with user-authored or plugin-shipped commands. The OLD
  // non-prefixed names below are retired — re-running setup.js on any dev
  // machine that still has these on disk will unlink them.
  "babysit-pr", // renamed to sy-babysit-pr (2026-05-11)
  "babysit-prs", // renamed to sy-babysit-prs (2026-05-11)
  "create-pr", // renamed to sy-create-pr (2026-05-11)
  "draft-pr", // renamed to sy-draft-pr (2026-05-11)
  "list-prs", // renamed to sy-list-prs (2026-05-11)
  "slack-prs", // renamed to sy-slack-prs (2026-05-11)
  "sync-and-groom-repo", // renamed to sy-sync-and-groom-repo (2026-05-11)
  "sync-and-groom-repos", // renamed to sy-sync-and-groom-repos (2026-05-11)
  "release", // renamed to sy-release (2026-05-11)
  "release-stable", // renamed to sy-release-stable (2026-05-11)
  "release-official", // renamed to sy-release-official (2026-05-11)
  "release-main", // renamed to sy-release-main (2026-05-11)
  "release-master", // renamed to sy-release-master (2026-05-11)
  "release-beta", // renamed to sy-release-beta (2026-05-11)
  // 2026-05-13: collapsed every release variant down to a single /sy-release
  // entry-point. The command body still chooses official vs beta from
  // $ARGUMENTS — the per-channel aliases were just noise in the picker.
  // Retire the old names so dev machines holding them clean up on next deploy.
  "sy-release-stable", // collapsed into sy-release (2026-05-13)
  "sy-release-official", // collapsed into sy-release (2026-05-13)
  "sy-release-main", // collapsed into sy-release (2026-05-13)
  "sy-release-master", // collapsed into sy-release (2026-05-13)
  "sy-release-beta", // collapsed into sy-release (2026-05-13)
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
 *   - `~/.gemini/skills`         — Gemini CLI user skills.
 *   - `~/.agents/skills`         — the cross-vendor interoperable path several
 *                                  CLIs also scan.
 * @type {string[]}
 */
const LLM_SKILL_LINK_FOLDERS = [
  path.join(BASE_HOMEDIR_LINUX, ".claude", "skills"),
  path.join(BASE_HOMEDIR_LINUX, ".copilot", "skills"),
  path.join(BASE_HOMEDIR_LINUX, ".config", "opencode", "skills"),
  path.join(BASE_HOMEDIR_LINUX, ".gemini", "skills"),
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
 * Called by all four setup scripts. Writing the same bytes from each is
 * intentional and safe — the content is byte-identical, so whichever CLI runs
 * first does the work and the rest are no-ops. That keeps every CLI independently
 * able to repair the shared folder without one of them being a prerequisite.
 *
 * Frontmatter (`name` + `description`) is generated here rather than stored in
 * the repo source: adding it upstream would break the first-line `[Sy] ` marker
 * that orphan detection relies on.
 *
 * @returns {Promise<void>}
 */
async function deploySharedLLMSkills() {
  warnAboutLegacyLLMFolders();

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

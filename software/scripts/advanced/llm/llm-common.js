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
 * itself rather than only in the host's error message.
 *
 * @returns {Promise<string>} Trimmed instructions content with the warning comment at the top.
 */
async function getLLMCustomInstructions() {
  /** @type {string} Raw instructions from the single source of truth. */
  const content = (await readText`software/scripts/advanced/llm/_common/instructions.md`).trim();
  return `<!-- ${getAutoGeneratedText(content.length).trim()} -->\n${content}`;
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
  return (await readText`${LLM_COMMAND_SOURCE_FOLDER}/${sourceName}.md`).trimEnd();
}

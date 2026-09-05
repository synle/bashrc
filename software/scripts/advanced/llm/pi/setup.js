/**
 * Configures the pi coding agent (https://pi.dev): user-level engineering
 * instructions, a github-copilot default provider, and any reachable local
 * Ollama providers.
 *
 * Pi is a minimal harness — no MCP, no sub-agents — so this setup is
 * deliberately smaller than opencode's. What it wires:
 *
 *   ~/.pi/agent/AGENTS.md   — the shared engineering-principles block. Pi
 *                             discovers `AGENTS.md` natively from `~/.pi/agent/`,
 *                             parent dirs, and cwd (https://pi.dev/docs), so the
 *                             same instructions Claude/Copilot/Gemini/OpenCode
 *                             load are loaded here too. Managed block is upserted
 *                             between BEGIN/END markers; user content outside is
 *                             preserved.
 *   ~/.pi/agent/settings.json — merge of managed defaults (github-copilot
 *                             default provider) into the user's settings; only
 *                             managed keys are touched.
 *   ~/.pi/agent/models.json — discovered Ollama providers merged under
 *                             `providers`. GitHub Copilot is a built-in
 *                             subscription provider reached via `/login`, NOT a
 *                             models.json entry, so nothing copilot-shaped is
 *                             written here.
 *
 * Shared `/sy-*` skills need NO wiring here: `deploySharedLLMSkills()` symlinks
 * every skill into `~/.agents/skills/` (a member of LLM_SKILL_LINK_FOLDERS), and
 * Pi scans `~/.agents/skills/` as a global skill location by default
 * (https://pi.dev/docs, skills.md), registering each as a `/skill:<name>`
 * command. Adding a second pi-local skills slot would only make Pi warn about
 * duplicate skill names, so it is intentionally omitted.
 */

// SOURCE software/scripts/advanced/llm/llm-common.js

/**
 * Pi provider id for the built-in GitHub Copilot subscription. Verified against
 * `pi auth check --provider github-copilot --json`, which echoes the normalized
 * provider id back. Reached via `/login` → GitHub Copilot; no models.json entry.
 * @type {string}
 */
const PI_COPILOT_PROVIDER_ID = LLM_COPILOT_PROVIDER_ID;

/**
 * Managed keys merged into ~/.pi/agent/settings.json. Only these keys are
 * written; every other user setting is preserved.
 *
 * `defaultProvider` starts pi on github-copilot to match the copilot-first
 * posture of the other AI CLIs in this repo. No `defaultModel` is pinned: the
 * exact copilot model catalog depends on what the account has enabled, so pi
 * shows the `/model` picker instead of failing on an unavailable id.
 *
 * When adding a managed setting, also update the settings-intent table in
 * `software/scripts/advanced/llm/llm.md` so cross-CLI parity stays visible.
 * @type {Record<string, any>}
 */
const PI_MANAGED_SETTINGS = {
  defaultProvider: PI_COPILOT_PROVIDER_ID,
};

/**
 * OpenAI-compatibility flags applied to every discovered Ollama provider. Ollama's
 * OpenAI-compatible endpoint does not understand the `developer` role or
 * `reasoning_effort`, so pi is told to send a plain `system` message instead —
 * mirrors the guidance in pi's own models.md for Ollama/vLLM/SGLang.
 * @type {{ supportsDeveloperRole: boolean, supportsReasoningEffort: boolean }}
 */
const PI_OLLAMA_COMPAT = {
  supportsDeveloperRole: false,
  supportsReasoningEffort: false,
};

/**
 * Absolute path to pi's global config folder.
 * @type {string} `~/.pi/agent`
 */
const PI_AGENT_DIR = path.join(BASE_HOMEDIR_LINUX, ".pi", "agent");

/**
 * Builds the pi models.json `providers` map from the shared Ollama discovery
 * inputs. Each provider speaks the OpenAI Completions API; only `id` is required
 * per model for a local server, so the entries stay minimal and pi fills the
 * rest from its own defaults.
 * @param {Array<{id: string, name: string, baseURL: string, models: Array<{name: string}>}>} providerInputs - Discovered reachable Ollama hosts.
 * @returns {Record<string, any>} Map of provider id → pi provider config.
 */
function _buildPiOllamaProviders(providerInputs) {
  /** @type {Record<string, any>} */
  const providers = {};
  for (const item of providerInputs) {
    providers[item.id] = {
      baseUrl: item.baseURL,
      api: "openai-completions",
      // Placeholder — Ollama ignores it, but pi still requires an auth marker
      // before a model appears in `/model` (documented in models.md).
      apiKey: "ollama",
      compat: { ...PI_OLLAMA_COMPAT },
      models: item.models.map((m) => ({ id: m.name, name: `${item.name} / ${m.name}` })),
    };
  }
  return providers;
}

/**
 * Merges managed defaults into ~/.pi/agent/settings.json, preserving existing
 * user settings. Only keys in PI_MANAGED_SETTINGS are treated as defaults; a
 * user override already on disk wins.
 * @returns {Promise<void>}
 */
async function _doPiSettingsWork() {
  const targetPath = path.join(PI_AGENT_DIR, "settings.json");

  log(">> pi Settings:", targetPath);

  /** @type {Record<string, any>} Existing user settings (empty object on missing / invalid file). */
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(targetPath, "utf-8")) || {};
  } catch (e) {}

  // Managed keys are defaults: a user value already on disk wins.
  const merged = { ...PI_MANAGED_SETTINGS, ...existing };

  await backupConfigFile(targetPath);
  await writeJson(targetPath, merged);
}

/**
 * Additively merges discovered Ollama providers into ~/.pi/agent/models.json
 * under `providers`, preserving any provider the user hand-added. Skips entirely
 * when no Ollama host is reachable and no models.json exists yet, so a headless /
 * copilot-only box gets no empty file.
 * @param {Array<{id: string, name: string, baseURL: string, models: Array<{name: string}>}>} providerInputs - Discovered reachable Ollama hosts.
 * @returns {Promise<void>}
 */
async function _doPiModelsWork(providerInputs) {
  const targetPath = path.join(PI_AGENT_DIR, "models.json");

  /** @type {Record<string, any>} Providers discovered this run. */
  const discovered = _buildPiOllamaProviders(providerInputs);

  /** @type {boolean} Whether models.json already exists on disk. */
  const fileExists = fs.existsSync(targetPath);

  if (Object.keys(discovered).length === 0 && !fileExists) {
    log(">> pi: no reachable Ollama hosts and no existing models.json — skipping");
    return;
  }

  log(">> pi Models:", targetPath);

  /** @type {Record<string, any>} Existing models.json (empty object on missing / invalid file). */
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(targetPath, "utf-8")) || {};
  } catch (e) {}

  /** @type {Record<string, any>} Existing providers block, defaulted to empty. */
  const existingProviders = existing.providers && typeof existing.providers === "object" ? existing.providers : {};

  // Existing first so discovered providers override by id on collision; a
  // user-added provider under a different id is preserved untouched.
  existing.providers = { ...existingProviders, ...discovered };

  await backupConfigFile(targetPath);
  await writeJson(targetPath, existing);
}

/**
 * Deploys the shared engineering principles into ~/.pi/agent/AGENTS.md between
 * BEGIN/END markers. Mirrors the copilot/gemini/opencode pattern: the managed
 * block is upserted and any user content outside the markers survives re-runs.
 * @returns {Promise<void>}
 */
async function _doPiInstructionsWork() {
  const targetPath = path.join(PI_AGENT_DIR, "AGENTS.md");

  log(">> pi Instructions:", targetPath);

  /** @type {string} The markdown source for the managed engineering-principles block. */
  const sourceContent = await getLLMCustomInstructions();

  /** @type {string} Existing AGENTS.md content (empty if the file is missing). */
  let existing = "";
  try {
    existing = fs.readFileSync(targetPath, "utf-8");
  } catch (e) {}

  // One-time migration: strip the legacy `managed-rules` block so the
  // descriptive-key upsert below never appends a duplicate. Idempotent once gone.
  existing = removeBlock(existing, LLM_INSTRUCTIONS_LEGACY_MARKER, "<!--", " -->");

  // Upsert the managed block. insertMode "append" creates it when AGENTS.md is
  // brand new or the markers are missing.
  const merged = replaceBlock(existing, LLM_INSTRUCTIONS_MARKER, sourceContent, "<!--", " -->", "append").trim() + "\n";

  await backupConfigFile(targetPath);
  await writeText(targetPath, merged);
}

/**
 * Orchestrates pi setup: settings, Ollama providers, shared instructions, and
 * shared skills. Skips entirely when pi is not installed.
 * @returns {Promise<void>}
 */
async function doWork() {
  if (!(await isBinaryFound("pi"))) {
    log(">> Skipped pi: not installed");
    return;
  }

  log(">> Configuring pi:", PI_AGENT_DIR);

  await mkdir(PI_AGENT_DIR);

  await _doPiSettingsWork();

  /** @type {Array<{id: string, name: string, baseURL: string, models: Array<{name: string}>}>} */
  const providerInputs = await getOllamaProviderInputs();
  await _doPiModelsWork(providerInputs);

  // Shared on-demand instruction files must exist before the always-loaded
  // AGENTS.md block that points at them. Safe from every CLI — writeText no-ops
  // when unchanged.
  await deploySharedLLMInstructions();
  await _doPiInstructionsWork();

  // Skills are written once to $LLM_ROOT_FOLDER/skills and symlinked into
  // ~/.agents/skills, which pi scans by default — no pi-local copy or slot.
  await deploySharedLLMSkills();
}

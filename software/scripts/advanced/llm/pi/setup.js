/**
 * Configures the pi coding agent (https://pi.dev): user-level engineering
 * instructions, managed display/privacy defaults, shared native MCP servers,
 * and any reachable local Ollama providers. Existing packages such as piweb
 * remain unchanged. What it wires:
 *
 *   ~/.pi/agent/AGENTS.md   — the shared engineering-principles block. Pi
 *                             discovers `AGENTS.md` natively from `~/.pi/agent/`,
 *                             parent dirs, and cwd (https://pi.dev/docs), so the
 *                             same instructions Claude/Copilot/Gemini/OpenCode
 *                             load are loaded here too. Managed block is upserted
 *                             between BEGIN/END markers; user content outside is
 *                             preserved.
 *   ~/.pi/agent/APPEND_SYSTEM.md — short tail-position persona reminder added
 *                             directly to Pi's system prompt on every run,
 *                             reinforcing the caveman response style separately
 *                             from the long AGENTS.md corpus.
 *   ~/.pi/agent/extensions/sy-persona-reminder.js — structured run guideline
 *                             and one owned persona section refreshed before
 *                             each model request, including tool follow-ups.
 *   ~/.pi/agent/settings.json — merge of managed defaults (`defaultTools`,
 *                             `quietStartup`, `terminal.imageWidthCells`,
 *                             `terminal.showTerminalProgress`, `terminal.hyperlinks`,
 *                             `autocompleteMaxVisible`, `images.blockImages`,
 *                             `collapseChangelog`, `enableInstallTelemetry`,
 *                             `hideThinkingBlock`, `showHardwareCursor`) into the user's
 *                             settings; the redundant system-theme pair is normalized.
 *   ~/.pi/agent/keybindings.json — managed word-deletion chords merged while
 *                             preserving unrelated user bindings.
 *   ~/.pi/agent/mcp.json — shared MCP servers reconciled by deploySharedMcpServers;
 *                             unrelated servers and other keys are preserved.
 *   ~/.pi/agent/agents/ — prior managed PR workers are retired by the common
 *                             cleanup pass; private workers remain unchanged.
 *   ~/.pi/agent/models.json — discovered Ollama providers, selected GitHub
 *                             Copilot model overrides, and Copilot IDE-auth headers
 *                             merged under `providers`.
 *
 * Shared `/sy-*` skills need NO wiring here: `deploySharedLLMSkills()` symlinks
 * every skill into `~/.agents/skills/` (a member of LLM_SKILL_LINK_FOLDERS), and
 * Pi scans `~/.agents/skills/` as a global skill location by default
 * (https://pi.dev/docs, skills.md), registering each as a `/skill:<name>`
 * command. Adding a second pi-local skills slot would only make Pi warn about
 * duplicate skill names, so it is intentionally omitted.
 */

// SOURCE software/scripts/advanced/llm/llm-common.js
// SOURCE software/scripts/advanced/editor.common.js

/**
 * Short persona reminder appended through ~/.pi/agent/APPEND_SYSTEM.md.
 * Tail placement matters: Pi appends this directly to the system prompt after
 * its larger instruction corpus, which keeps the response style more salient.
 * @type {string}
 */
const PI_APPEND_SYSTEM_CONTENT = `${LLM_PERSONA_REMINDER}\n`;

/**
 * Self-delimiting request-level reminder with a concrete chat example. The shared
 * reminder owns policy and exemptions; the example illustrates ordinary status prose.
 * @type {string}
 */
const PI_PERSONA_REQUEST_REMINDER = `<sy_persona_reminder>
${LLM_PERSONA_REMINDER}

Chat-status example: "Backup complete. Eight files verified. Active rules unchanged."
</sy_persona_reminder>`;

/**
 * Headers required by the GitHub Copilot IDE-authenticated API.
 * @type {Record<string, string>}
 */
const PI_COPILOT_HEADERS = {
  "Editor-Version": "vscode/1.107.0",
};

/**
 * Managed keys merged into ~/.pi/agent/settings.json. Only these keys are
 * written; every other user setting is preserved.
 *
 * These defaults match current local preferences: grep/find/ls available at
 * startup, quiet startup, wider inline images, terminal progress shown,
 * forced terminal hyperlinks, more visible autocomplete rows, outbound image
 * sending left enabled, condensed changelogs, install telemetry disabled,
 * hardware cursor enabled, and thinking blocks hidden. No provider or model is pinned here — Pi keeps
 * its own automatic startup selection unless the user already chose something
 * on disk.
 *
 * @type {Record<string, any>}
 */
const PI_MANAGED_SETTINGS = {
  defaultTools: ["+grep", "+find", "+ls"],
  quietStartup: true,
  terminal: {
    imageWidthCells: 120,
    showTerminalProgress: true,
    hyperlinks: true,
  },
  autocompleteMaxVisible: 10,
  images: {
    blockImages: false,
  },
  collapseChangelog: true,
  enableInstallTelemetry: false,
  hideThinkingBlock: true,
  showHardwareCursor: true,
  doubleEscapeAction: "none",
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
 * Builds display-name and header overrides without replacing Pi's native model capabilities.
 * Use modelOverrides, not full models entries: renaming through models replaces native metadata
 * and resets omitted context windows to defaults (reported regression: 100k instead of 1.1 million tokens).
 * Override only names and required headers; let Pi retain its catalog's context and output limits.
 * @returns {Record<string, {name: string, headers?: Record<string, string>}>} Overrides keyed by model ID; no IO.
 */
function _getPiCopilotModelOverrides() {
  return Object.fromEntries(
    Object.entries(LLM_COPILOT_MODEL_EXTENSIONS).map(([id, config]) => [
      id,
      {
        name: `GitHub Copilot / ${id}`,
        ...(config.fast ? { headers: config.fast.headers } : {}),
      },
    ]),
  );
}

/**
 * Returns pi's global config folder for one LLM config home.
 * @param {string} configHome - Linux or Windows config home.
 * @returns {string} Absolute path to the pi agent folder.
 */
function getPiAgentDir(configHome) {
  return path.join(configHome, ".pi", "agent");
}

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
 * Deploys both native Pi themes before returning a managed default selection.
 * @param {string} agentDir - Pi configuration home.
 * @param {string|undefined} selected - Existing explicit theme selection.
 * @returns {Promise<string>} Existing user selection or the managed light/dark pair.
 * @throws {Error} For invalid templates/selections or backup/write failures; settings are not written here.
 */
async function _doPiThemeWork(agentDir, selected) {
  if (selected !== undefined && typeof selected !== "string") throw new Error("Invalid Pi theme selection: expected a string");
  const owned = ["Sy Dark", "Sy Light", "Sy Light/Sy Dark"];
  if (!shouldInstallCustomTheme("terminal")) {
    if (selected === undefined || owned.includes(selected)) return getTheme("pi").dark;
    return selected;
  }
  const [dark, light] = await Promise.all([readSyTheme("pi", "dark"), readSyTheme("pi", "light")]);
  for (const [mode, theme] of Object.entries({ dark, light })) {
    if (
      typeof theme.name !== "string" ||
      !theme.name ||
      theme.name.startsWith(".") ||
      /[/\\\\\x00-\x1f]/.test(theme.name) ||
      theme.name === "system" ||
      theme.appearance !== mode ||
      !theme.colors ||
      typeof theme.colors !== "object" ||
      Array.isArray(theme.colors) ||
      !Object.keys(theme.colors).length ||
      !Object.values(theme.colors).every((value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value))
    ) {
      throw new Error(`Invalid Pi ${mode} theme: expected a safe name, matching appearance, and generated native color roles`);
    }
  }
  if (dark.name === light.name) throw new Error("Invalid Pi themes: appearance names must be distinct");
  const folder = path.join(agentDir, "themes");
  await mkdir(folder);
  for (const theme of [dark, light]) {
    const file = path.join(folder, `${theme.name}.json`);
    await backupConfigFile(file);
    await writeJson(file, theme);
  }
  const automatic = `${light.name}/${dark.name}`;
  if (selected === undefined || selected === "Sy Light/Sy Dark") return automatic;
  if (selected === "Sy Dark") return dark.name;
  if (selected === "Sy Light") return light.name;
  return selected;
}

/**
 * Merges managed defaults and normalizes only the redundant system-theme pair, preserving other user settings.
 * @param {string} agentDir - Target Pi agent folder.
 * @returns {Promise<void>} Resolves after backing up and writing settings; IO errors propagate.
 */
async function _doPiSettingsWork(agentDir) {
  const targetPath = path.join(agentDir, "settings.json");

  log(">> pi Settings:", targetPath);

  /** @type {Record<string, any>} Existing user settings (empty object on missing / invalid file). */
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(targetPath, "utf-8")) || {};
  } catch (e) {}

  // Collapse the redundant automatic pair without replacing a custom theme.
  if (existing.theme === "system/system") existing.theme = "system";

  const theme = await _doPiThemeWork(agentDir, existing.theme);
  // Managed keys are defaults: a user value already on disk wins.
  const merged = {
    ...PI_MANAGED_SETTINGS,
    ...existing,
    theme,
    terminal: {
      ...PI_MANAGED_SETTINGS.terminal,
      ...(existing.terminal && typeof existing.terminal === "object" ? existing.terminal : {}),
    },
    images: {
      ...PI_MANAGED_SETTINGS.images,
      ...(existing.images && typeof existing.images === "object" ? existing.images : {}),
    },
  };

  await backupConfigFile(targetPath);
  await writeJson(targetPath, merged);
}

/**
 * Merges managed Pi keybindings into one keybindings.json, preserving unrelated user bindings.
 * @param {string} agentDir - Target pi agent folder.
 * @returns {Promise<void>}
 */
async function _doPiKeybindingsWork(agentDir) {
  const targetPath = path.join(agentDir, "keybindings.json");
  const managed = (await readJson`software/scripts/advanced/llm/pi/pi-keys.common.jsonc`) || {};

  if (!managed || typeof managed !== "object" || Array.isArray(managed)) return;

  /** @type {Record<string, any>} Existing user keybindings. */
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(targetPath, "utf-8")) || {};
  } catch {}

  const merged = { ...existing, ...managed };
  await backupConfigFile(targetPath);
  await writeJson(targetPath, merged);
}

/**
 * Replaces discovered Ollama providers and migrates managed Copilot names and headers to modelOverrides.
 * Preserves custom definitions, explicit overrides, and provider headers without replacing native model capabilities.
 * Always writes the Copilot header configuration, even when no Ollama host is reachable.
 * @param {string} agentDir - Target pi agent folder.
 * @param {Array<{id: string, name: string, baseURL: string, models: Array<{name: string}>}>} providerInputs - Discovered reachable Ollama hosts.
 * @returns {Promise<void>} Resolves after backing up and writing models.json; write errors propagate.
 */
async function _doPiModelsWork(agentDir, providerInputs) {
  // Keep the historical one-argument helper shape for existing callers and tests.
  if (Array.isArray(agentDir) && providerInputs === undefined) {
    providerInputs = agentDir;
    agentDir = getPiAgentDir(BASE_HOMEDIR_LINUX);
  }
  const targetPath = path.join(agentDir, "models.json");

  /** @type {Record<string, any>} Providers discovered this run. */
  const discovered = _buildPiOllamaProviders(providerInputs);
  /** @type {Record<string, any>} Managed display names and model headers. */
  const copilotOverrides = _getPiCopilotModelOverrides();

  log(">> pi Models:", targetPath);

  /** @type {Record<string, any>} Existing models.json (empty object on missing / invalid file). */
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(targetPath, "utf-8")) || {};
  } catch (e) {}

  /** @type {Record<string, any>} Existing providers block, defaulted to empty. */
  const existingProviders = existing.providers && typeof existing.providers === "object" ? existing.providers : {};
  const existingCopilot = existingProviders[LLM_COPILOT_PROVIDER_ID];
  const existingCopilotHeaders = existingCopilot?.headers && typeof existingCopilot.headers === "object" ? existingCopilot.headers : {};
  discovered[LLM_COPILOT_PROVIDER_ID] = {
    ...(existingCopilot && typeof existingCopilot === "object" ? existingCopilot : {}),
    headers: { ...existingCopilotHeaders, ...PI_COPILOT_HEADERS },
  };
  /** @type {Record<string, any>} Copilot configuration retaining unrelated user settings. */
  const copilot = discovered[LLM_COPILOT_PROVIDER_ID];
  /** @type {Record<string, any>} Existing explicit overrides take precedence over legacy entries. */
  const modelOverrides = { ...copilot.modelOverrides };

  // Only migrate our former name/header-only entries; explicit custom model capabilities remain untouched.
  if (Array.isArray(copilot.models)) {
    copilot.models = copilot.models.filter((model) => {
      if (model.name !== `GitHub Copilot / ${model.id}` || !Object.keys(model).every((key) => ["id", "name", "headers"].includes(key)))
        return true;
      const previous = modelOverrides[model.id];
      modelOverrides[model.id] = {
        name: model.name,
        ...previous,
        ...(model.headers || previous?.headers ? { headers: { ...model.headers, ...previous?.headers } } : {}),
      };
      return false;
    });
    if (copilot.models.length === 0) delete copilot.models;
  }
  for (const [id, override] of Object.entries(copilotOverrides)) {
    const previous = modelOverrides[id];
    modelOverrides[id] = {
      ...previous,
      ...override,
      ...(previous?.headers || override.headers ? { headers: { ...previous?.headers, ...override.headers } } : {}),
    };
  }
  if (Object.keys(modelOverrides).length > 0) copilot.modelOverrides = modelOverrides;

  // `ollama-*` is reserved for providers generated from ip-address.config. Rebuild
  // that namespace from current discovery so removed models and unavailable hosts
  // do not remain selectable; keep unrelated user providers intact.
  const userProviders = Object.fromEntries(Object.entries(existingProviders).filter(([id]) => !id.startsWith("ollama-")));
  existing.providers = { ...userProviders, ...discovered };

  await backupConfigFile(targetPath);
  await writeJson(targetPath, existing);
}

/**
 * Deploys the shared engineering principles into one pi AGENTS.md between
 * BEGIN/END markers. Mirrors the copilot/gemini/opencode pattern: the managed
 * block is upserted and any user content outside the markers survives re-runs.
 * @param {string} agentDir - Target pi agent folder.
 * @returns {Promise<void>}
 */
async function _doPiInstructionsWork(agentDir) {
  const targetPath = path.join(agentDir, "AGENTS.md");

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
  // Migrate the previous source-path key after moving the active corpus into v_current.
  existing = removeBlock(existing, LLM_INSTRUCTIONS_PREVIOUS_MARKER, "<!--", " -->");

  // Upsert the managed block. insertMode "append" creates it when AGENTS.md is
  // brand new or the markers are missing.
  // Refresh existing path-keyed blocks and append newly discovered ~/.work_*_instructions.md sources.
  const merged =
    refreshPathKeyedBlocks(replaceBlock(existing, LLM_INSTRUCTIONS_MARKER, sourceContent, "<!--", " -->", "append")).trim() + "\n";

  await backupConfigFile(targetPath);
  await writeText(targetPath, merged);
}

/**
 * Deploys one pi APPEND_SYSTEM.md, a short tail-position persona reminder
 * added directly to Pi's system prompt on every run.
 * @param {string} agentDir - Target pi agent folder.
 * @returns {Promise<void>}
 */
async function _doPiAppendSystemWork(agentDir) {
  const targetPath = path.join(agentDir, "APPEND_SYSTEM.md");

  log(">> pi Append System:", targetPath);

  await backupConfigFile(targetPath);
  await writeText(targetPath, PI_APPEND_SYSTEM_CONTENT);
}

/**
 * Writes a Pi extension with a run guideline and one owned system section before
 * every model request. Existing prompt content, tools, and transcript order survive;
 * no replies are rewritten and no additional model calls are requested.
 * @param {string} agentDir - Target pi agent folder.
 * @returns {Promise<void>} Resolves after writing the generated extension; IO errors propagate.
 */
async function _doPiPersonaExtensionWork(agentDir) {
  const targetPath = path.join(agentDir, "extensions", "sy-persona-reminder.js");
  const content = `/** Registers request-level persona reinforcement without rewriting replies or replacing the prompt.
 * @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi - Pi extension API.
 * @returns {void} Registers lifecycle handlers; performs no startup IO.
 */
export default function (pi) {
  /** @type {string} Shared chat-style policy, including prose exemptions. */
  const PERSONA_REMINDER = ${JSON.stringify(LLM_PERSONA_REMINDER)};
  /** @type {string} Self-delimiting reminder rendered after other leading system sections. */
  const REQUEST_REMINDER = ${JSON.stringify(PI_PERSONA_REQUEST_REMINDER)};

  pi.on("before_agent_start", (event) => {
    const guidelines = event.systemPromptOptions.promptGuidelines;
    if (!guidelines.includes(PERSONA_REMINDER)) guidelines.push(PERSONA_REMINDER);
  });

  pi.on("context_with_system", (event) => {
    const system = event.messages[0];
    // Do not manufacture or reorder system/tool state in a nonstandard transcript.
    if (system?.role !== "system") return;

    // Replace only our section, moving it last without mutating reusable context.
    const { sy_persona_reminder: previousReminder, ...sections } = system.sections ?? {};
    return {
      messages: [
        { ...system, sections: { ...sections, sy_persona_reminder: REQUEST_REMINDER } },
        ...event.messages.slice(1),
      ],
    };
  });
}
`;

  await mkdir(path.dirname(targetPath));
  await writeText(targetPath, content);
}

/**
 * Deploys collapsed tool output through Pi's UI API; no persisted setting exists.
 * Session startup and tool boundaries restore the preference after manual expansion.
 * @param {string} agentDir - Target Pi agent folder.
 * @returns {Promise<void>} Resolves after writing the extension; IO errors propagate.
 */
async function _doPiToolOutputExtensionWork(agentDir) {
  /** @type {string} Personal extension path discovered automatically by Pi. */
  const targetPath = path.join(agentDir, "extensions", "sy-collapsed-tools.js");
  /** @type {string} Generated extension source; no model or settings changes. */
  const content = `/** Keeps tool output collapsed at session startup and tool execution boundaries.
 * @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi - Pi extension API.
 * @returns {void} Registers TUI-only lifecycle handlers; tool data is unchanged.
 */
export default function (pi) {
  for (const event of ["session_start", "tool_execution_start", "tool_execution_end"]) {
    pi.on(event, (_event, ctx) => {
      if (ctx.mode === "tui") ctx.ui.setToolsExpanded(false);
    });
  }
}
`;

  await mkdir(path.dirname(targetPath));
  await writeText(targetPath, content);
}

/**
 * Orchestrates Pi setup: settings, keybindings, native MCP, Ollama providers, shared instructions,
 * APPEND_SYSTEM persona reinforcement, collapsed tool output, shared skills, and retired-agent cleanup.
 * Skips entirely when pi is not installed.
 * @returns {Promise<void>} Resolves after deployment; MCP validation and IO errors propagate.
 */
async function doWork() {
  if (!(await isBinaryFound("pi"))) {
    log(">> Skipped pi: not installed");
    return;
  }
  const piAgentDir = getPiAgentDir(getLLMConfigHome());

  log(">> Configuring pi:", piAgentDir);

  await mkdir(piAgentDir);

  await _doPiSettingsWork(piAgentDir);
  await _doPiKeybindingsWork(piAgentDir);
  await deploySharedMcpServers(path.join(piAgentDir, "mcp.json"), {}, "standard", "pi");

  /** @type {Array<{id: string, name: string, baseURL: string, models: Array<{name: string}>}>} */
  const providerInputs = await getOllamaProviderInputs();
  await _doPiModelsWork(piAgentDir, providerInputs);

  // Shared on-demand instruction files must exist before the always-loaded
  // AGENTS.md block that points at them. Safe from every CLI — writeText no-ops
  // when unchanged.
  await deploySharedLLMInstructions();
  await _doPiInstructionsWork(piAgentDir);
  await _doPiAppendSystemWork(piAgentDir);
  await _doPiPersonaExtensionWork(piAgentDir);
  await _doPiToolOutputExtensionWork(piAgentDir);

  // Skills are written once to $LLM_ROOT_FOLDER/skills and symlinked into
  // ~/.agents/skills, which pi scans by default — no pi-local copy or slot.
  await deploySharedLLMSkills();
  await deploySharedLLMAgents();
}

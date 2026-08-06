/** Claude Code setup: settings, keybindings, and telemetry opt-out. Run: `bash run.sh --files="setup.js"` */
// SOURCE software/scripts/advanced/llm/llm-common.js

/** @type {string} Claude Code OS modifier key on macOS (meta = cmd in terminals). */
const CLAUDE_MAC_OS_KEY = "meta";

/** @type {object[]} Common keybindings loaded from JSONC. */
let CLAUDE_COMMON_KEY_BINDINGS;
/** @type {object[]} Windows/Linux-only keybindings loaded from JSONC. */
let CLAUDE_WINDOWS_ONLY_KEY_BINDINGS;

/**
 * Replaces OS_KEY placeholders in Claude Code keybinding context groups with the actual OS-specific modifier key.
 * Claude Code bindings use { context, bindings: { key: action } } format where OS_KEY appears in object keys.
 * @param {object[]} contextGroups - Array of { context, bindings } objects.
 * @param {string} osKeyToUse - The OS-specific modifier key to substitute (e.g. "alt", "meta").
 * @returns {object[]} Context groups with resolved binding keys.
 */
function _formatClaudeKeybindings(contextGroups, osKeyToUse) {
  contextGroups = clone(contextGroups);

  for (const group of contextGroups) {
    /** @type {Record<string, string>} Resolved bindings with OS_KEY replaced in keys. */
    const resolved = {};
    for (const [key, action] of Object.entries(group.bindings)) {
      resolved[key.replace(/OS_KEY/g, osKeyToUse)] = action;
    }
    group.bindings = resolved;
  }

  return contextGroups;
}

/**
 * Merges multiple arrays of Claude Code keybinding context groups, combining bindings for the same context.
 * @param  {...object[]} arrays - Arrays of { context, bindings } objects to merge.
 * @returns {object[]} Merged context groups with combined bindings.
 */
function _mergeContextGroups(...arrays) {
  /** @type {Map<string, object>} Map of context name to merged bindings. */
  const map = new Map();

  for (const arr of arrays) {
    for (const group of arr) {
      if (map.has(group.context)) {
        Object.assign(map.get(group.context).bindings, group.bindings);
      } else {
        map.set(group.context, clone(group));
      }
    }
  }

  return [...map.values()];
}

/**
 * Returns the merged and resolved keybinding config for the given OS.
 * @param {boolean} [isOsMac] - Override for macOS detection. When omitted, uses the global is_os_mac flag.
 * @returns {object} Full Claude Code keybindings config with schema metadata.
 */
function _getKeyConfig(isOsMac) {
  const isMac = isOsMac !== undefined ? isOsMac : is_os_mac;
  const osKey = isMac ? CLAUDE_MAC_OS_KEY : LLM_WINDOWS_OS_KEY;

  /** @type {object[]} Platform-specific bindings merged with common. */
  const merged = isMac
    ? _mergeContextGroups(CLAUDE_COMMON_KEY_BINDINGS)
    : _mergeContextGroups(CLAUDE_COMMON_KEY_BINDINGS, CLAUDE_WINDOWS_ONLY_KEY_BINDINGS);

  return {
    $schema: "https://www.schemastore.org/claude-code-keybindings.json",
    $docs: "https://code.claude.com/docs/en/keybindings",
    bindings: _formatClaudeKeybindings(merged, osKey),
  };
}

/**
 * Loads keybinding configs, writes prebuilt configs per platform, and deploys to ~/.claude/keybindings.json.
 * @param {string} targetDir - Path to the ~/.claude directory.
 */
async function _doKeysWork(targetDir) {
  const targetPath = path.join(targetDir, "keybindings.json");

  log(">> Claude Code Keybindings:", targetPath);

  CLAUDE_COMMON_KEY_BINDINGS = (await readJson`software/scripts/advanced/llm/claude/claude-keys.common.jsonc`) || [];
  CLAUDE_WINDOWS_ONLY_KEY_BINDINGS = (await readJson`software/scripts/advanced/llm/claude/claude-keys.windows.jsonc`) || [];

  // write to build file (one per platform)
  const comments = "Claude Code Keybindings";
  await writeBuildArtifact([
    {
      file: `${BUILD_DIR}/claude-keys`,
      data: _getKeyConfig(false),
      isJson: true,
      comments,
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/claude-keys-mac`,
      data: _getKeyConfig(true),
      isJson: true,
      comments,
      commentStyle: "json",
    },
  ]);

  // deploy to local system — merge with existing, our managed bindings always override
  /** @type {object[]} Existing user keybinding context groups (empty if file missing or invalid). */
  let existingBindings = [];
  try {
    const data = JSON.parse(fs.readFileSync(targetPath, "utf-8"));
    if (data && Array.isArray(data.bindings)) existingBindings = data.bindings;
  } catch (e) {}

  const ourConfig = _getKeyConfig();
  // existing first, then ours on top — Object.assign in _mergeContextGroups means later wins
  ourConfig.bindings = _mergeContextGroups(existingBindings, ourConfig.bindings);

  await backupConfigFile(targetPath);
  await writeJson(targetPath, ourConfig);
}

// --- Settings ---

/**
 * Managed settings to merge into ~/.claude/settings.json.
 * Only these keys are touched — all other user settings are preserved.
 *
 * When adding a new managed setting, also update the settings-intent table in
 * `software/scripts/advanced/llm/llm.md` so cross-CLI parity stays
 * visible at review time (intent must be implemented in copilot/gemini/opencode
 * too, or explicitly marked n/a there).
 *
 * @type {Record<string, any>}
 */
const CLAUDE_MANAGED_SETTINGS = {
  // default model for all claude code sessions. tradeoff: higher cost. risk: none
  model: "claude-opus-4-7[1m]",
  // skip confirmation prompt before entering bypass permissions mode. tradeoff: no safety prompt. risk: medium
  skipDangerousModePermissionPrompt: true,
  // auto-delete session files older than 30 days. tradeoff: lose old history. risk: low
  cleanupPeriodDays: 30,
  // hide tips in the loading spinner. tradeoff: miss occasional tips. risk: none
  spinnerTipsEnabled: false,
  // reduce UI animations for cleaner output. tradeoff: less visual feedback. risk: none
  prefersReducedMotion: true,
  // show more detail in transcript by default. tradeoff: noisier output. risk: none
  viewMode: "verbose",
  // enable extended thinking by default for better quality. tradeoff: more tokens, slightly slower. risk: low
  alwaysThinkingEnabled: true,
};

/**
 * Merges managed settings into ~/.claude/settings.json, preserving existing user settings.
 * Only keys in CLAUDE_MANAGED_SETTINGS are written — other keys are left untouched.
 * @param {string} targetDir - Path to the ~/.claude directory.
 */
async function _doSettingsWork(targetDir) {
  const targetPath = path.join(targetDir, "settings.json");

  log(">> Claude Code Settings:", targetPath);

  /** @type {object} Existing user settings (empty object if file missing or invalid). */
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(targetPath, "utf-8")) || {};
  } catch (e) {}

  // merge: managed settings are applied as defaults, existing user overrides are preserved
  const merged = { ...CLAUDE_MANAGED_SETTINGS, ...existing };

  await backupConfigFile(targetPath);
  await writeJson(targetPath, merged);
}

// --- MCP Servers ---

/**
 * Additively merges every entry from the shared MCP registry into
 * `~/.claude/settings.json::mcpServers`. Semantics:
 *
 *   - Names listed in `_common/mcp-servers.jsonc` get our value (file wins).
 *   - Names ONLY in the on-disk settings.json — added by hand or via
 *     `claude mcp add` — are preserved untouched.
 *   - Removing a name from the registry does NOT remove it from settings.json
 *     (additive overlay only; documented in the registry header).
 *
 * Runs AFTER `_doSettingsWork` so the read-modify-write here sees the managed
 * settings already on disk and only touches the `mcpServers` key.
 *
 * @param {string} targetDir - Path to the `~/.claude` directory.
 */
async function _doMcpWork(targetDir) {
  const targetPath = path.join(targetDir, "settings.json");

  log(">> Claude Code MCP Servers:", targetPath);

  /** @type {Record<string, any>} */
  const sharedServers = await loadSharedMcpServers();
  if (Object.keys(sharedServers).length === 0) {
    log("   No managed MCP entries — skipping");
    return;
  }

  /** @type {object} Existing settings — empty object on missing / invalid file. */
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(targetPath, "utf-8")) || {};
  } catch (e) {}

  /** @type {Record<string, any>} */
  const existingServers = existing.mcpServers && typeof existing.mcpServers === "object" ? existing.mcpServers : {};
  /** @type {Record<string, any>} Existing names first so shared entries override on collision. */
  const merged = { ...existingServers, ...sharedServers };

  existing.mcpServers = merged;
  await backupConfigFile(targetPath);
  await writeJson(targetPath, existing);
}

// --- Instructions (User-Level CLAUDE.md) ---

/**
 * Deploys stack-agnostic engineering principles into ~/.claude/CLAUDE.md between BEGIN/END markers.
 * The markdown source uses backticks for inline code; readText returns the file content verbatim
 * (only the path argument is a template literal), and the content flows into replaceBlock as a
 * plain string — no re-templating, so backticks are safe here.
 * Existing user content outside the marker block is preserved.
 * @param {string} targetDir - Path to the ~/.claude directory.
 */
async function _doInstructionsWork(targetDir) {
  const targetPath = path.join(targetDir, "CLAUDE.md");

  log(">> Claude Code Instructions:", targetPath);

  /** @type {string} The markdown source for the managed engineering principles block. */
  const sourceContent = await getLLMCustomInstructions();

  /** @type {string} Existing CLAUDE.md content (empty if file is missing). */
  let existing = "";
  try {
    existing = fs.readFileSync(targetPath, "utf-8");
  } catch (e) {}

  // One-time migration: strip the legacy `managed-rules` block so the new descriptive-key
  // upsert below doesn't append a duplicate alongside it. Idempotent — no-op once gone.
  existing = removeBlock(existing, LLM_INSTRUCTIONS_LEGACY_MARKER, "<!--", " -->");

  // Upsert the managed block between BEGIN/END markers keyed by the source-of-truth path.
  // insertMode: "append" creates the block when CLAUDE.md is brand new or the markers are missing.
  const merged = replaceBlock(existing, LLM_INSTRUCTIONS_MARKER, sourceContent, "<!--", " -->", "append").trim() + "\n";

  await backupConfigFile(targetPath);
  await writeText(targetPath, merged);
}

// --- Commands (Custom Slash Commands) ---

/**
 * Claude Code has no registry of its own — the command set, the `[Sy] ` markers,
 * and the retired-name list all live in `llm-common.js` as
 * `LLM_COMMAND_DEPLOY_MAP`, `LLM_SKILL_MARKERS`, and `LLM_COMMAND_RETIRED_NAMES`
 * so claude, copilot, gemini, and opencode share exactly one source of truth.
 *
 * Map keys are extension-less command names; this CLI is file-based, so it
 * appends `.md` to reach `~/.claude/commands/<name>.md`.
 *
 * @param {string} name - Deployed command name from LLM_COMMAND_DEPLOY_MAP.
 * @returns {string} Destination filename inside ~/.claude/commands/.
 */
function _toClaudeCommandFile(name) {
  return `${name}.md`;
}

/**
 * Deploys slash command definitions to ~/.claude/commands/. Each entry in the
 * shared LLM_COMMAND_DEPLOY_MAP (llm-common.js) becomes a /<name> user-level
 * command available across all projects. Source files live under
 * LLM_COMMAND_SOURCE_FOLDER and are read verbatim via readLLMCommandSource
 * (same pattern as claude-instructions.md). Aliased sources are read once and
 * cached so identical destinations stay byte-exact.
 * @param {string} targetDir - Path to the ~/.claude directory.
 */
async function _doCommandsWork(targetDir) {
  const commandsDir = path.join(targetDir, "commands");

  log(">> Claude Code Commands:", commandsDir);
  // Hint for users who want to start from a clean slate (e.g. after
  // renaming or retiring a batch of commands). We never run this
  // ourselves — selective unlinking happens further down via the
  // LLM_COMMAND_RETIRED_NAMES + LLM_SKILL_MARKERS cleanup pass.
  log("   To wipe all deployed commands, run: rm -f ~/.claude/commands/*");

  fs.mkdirSync(commandsDir, { recursive: true });

  // Diff the on-disk commands directory against the current deploy map and
  // drop any Sy-managed orphans. Files that are currently in
  // LLM_COMMAND_DEPLOY_MAP are skipped — the deploy loop below will
  // overwrite them, so deleting + rewriting would be wasted IO.
  //
  // An on-disk file is treated as a Sy orphan (and unlinked) when:
  //   (a) its name is in LLM_COMMAND_RETIRED_NAMES — explicit retirements
  //       we know about, including legacy files that predate every marker, OR
  //   (b) its first line starts with any LLM_SKILL_MARKERS entry — covers any
  //       rename we perform in the future without anyone needing to update a
  //       list, AND catches legacy `Sy Skill - ` prefixed files left over
  //       from before the `[Sy] ` rename.
  //
  // User-authored slash commands that match neither path are left untouched.
  /** @type {Set<string>} Filenames the deploy loop will (re)write — skip cleanup for these. */
  const deployTargets = new Set(Object.keys(LLM_COMMAND_DEPLOY_MAP).map(_toClaudeCommandFile));
  for (const filePath of findPathList(commandsDir, /\.md$/, { type: "file" })) {
    /** @type {string} Just the basename (e.g. "create-pr.md") of the on-disk file. */
    const fileName = path.basename(filePath);
    if (deployTargets.has(fileName)) continue;
    /** @type {string} Reason label printed in the log line — only set when we decide to unlink. */
    let reason = "";
    if (LLM_COMMAND_RETIRED_NAMES.includes(path.basename(fileName, ".md"))) {
      reason = "retired";
    } else {
      /** @type {string} First line of the file, checked against every LLM_SKILL_MARKERS entry. */
      const firstLine = fs.readFileSync(filePath, "utf-8").split("\n", 1)[0] || "";
      if (LLM_SKILL_MARKERS.some((m) => firstLine.startsWith(m))) reason = "marker";
    }
    if (reason) {
      fs.unlinkSync(filePath);
      log(`   Removed prior Sy skill (${reason}):`, fileName);
    }
  }

  /** @type {Record<string, string>} Source-name → file content. Caches re-reads for aliased entries. */
  const sourceCache = {};

  for (const [commandName, sourceName] of Object.entries(LLM_COMMAND_DEPLOY_MAP)) {
    if (!(sourceName in sourceCache)) {
      sourceCache[sourceName] = await readLLMCommandSource(sourceName);
    }
    /** @type {string} Destination filename — this CLI is file-based, so the name gains `.md`. */
    const destFile = _toClaudeCommandFile(commandName);
    const dest = path.join(commandsDir, destFile);
    await backupConfigFile(dest);
    fs.writeFileSync(dest, sourceCache[sourceName] + "\n");
    log("   Deployed:", destFile);
  }
}

/**
 * Orchestrates all Claude Code setup: settings, keybindings, and commands.
 */
async function doWork() {
  const targetDir = path.join(BASE_HOMEDIR_LINUX, ".claude");

  if (!fs.existsSync(targetDir)) {
    log(">> Skipping Claude Code setup — ~/.claude not found");
    return;
  }

  log(">> Configuring Claude Code:", targetDir);

  await _doSettingsWork(targetDir);
  await _doMcpWork(targetDir);
  await _doKeysWork(targetDir);
  await _doCommandsWork(targetDir);
  await _doInstructionsWork(targetDir);
}

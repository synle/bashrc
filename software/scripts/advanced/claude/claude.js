/** Claude Code setup: settings, keybindings, and telemetry opt-out. Run: `bash run.sh --files="claude.js"` */
// SOURCE software/scripts/advanced/editor.common.js

////// Keybindings //////

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
  const osKey = isMac ? CLAUDE_MAC_OS_KEY : EDITOR_WINDOWS_OS_KEY;

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

  CLAUDE_COMMON_KEY_BINDINGS = (await readJson`software/scripts/advanced/claude/claude-keys.common.jsonc`) || [];
  CLAUDE_WINDOWS_ONLY_KEY_BINDINGS = (await readJson`software/scripts/advanced/claude/claude-keys.windows.jsonc`) || [];

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

////// Settings //////

/**
 * Managed settings to merge into ~/.claude/settings.json.
 * Only these keys are touched — all other user settings are preserved.
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

////// Instructions (User-Level CLAUDE.md) //////

/**
 * Marker key used to wrap the managed engineering principles block inside ~/.claude/CLAUDE.md.
 * Anything outside the BEGIN/END markers is preserved as user-owned content.
 * @type {string}
 */
const CLAUDE_INSTRUCTIONS_MARKER = "managed-rules";

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
  const sourceContent = (await readText`software/scripts/advanced/claude/claude-instructions.md`).trim();

  /** @type {string} Existing CLAUDE.md content (empty if file is missing). */
  let existing = "";
  try {
    existing = fs.readFileSync(targetPath, "utf-8");
  } catch (e) {}

  // Upsert the managed block between <!-- BEGIN managed-rules --> / <!-- END managed-rules -->.
  // insertMode: "append" creates the block when CLAUDE.md is brand new or the markers are missing.
  const merged = replaceBlock(existing, CLAUDE_INSTRUCTIONS_MARKER, sourceContent, "<!--", " -->", "append").trim() + "\n";

  await backupConfigFile(targetPath);
  await writeText(targetPath, merged);
}

////// Commands (Custom Slash Commands) //////

/**
 * Deploy map for user-level Claude Code slash commands.
 *
 * Each key is the destination filename in ~/.claude/commands/ (becomes a
 * /<name> command). Each value is the source filename (without .md) under
 * software/scripts/advanced/claude/skills/. Multiple keys may point at the
 * same source — that's how /release-main, /release-master, /release-stable,
 * /release-official, /release-beta, and bare /release are all aliased to the
 * single unified `release` source. The skill body itself does the routing
 * (official vs beta) based on invocation name + arguments.
 *
 * Editing a command: edit the .md file under
 *   software/scripts/advanced/claude/skills/<name>.md
 * Adding a command: drop a new .md file there + add a deploy-map entry.
 * Aliasing: add a deploy-map entry whose value points at an existing source.
 *
 * @type {Record<string, string>}
 */
const CLAUDE_COMMAND_DEPLOY_MAP = {
  "babysit-pr.md": "babysit-pr",
  "babysit-prs.md": "babysit-prs",
  "sync-and-groom-repo.md": "sync-and-groom-repo",
  "sync-and-groom-repos.md": "sync-and-groom-repos",
  "create-pr.md": "create-pr",
  "draft-pr.md": "draft-pr",
  "list-prs.md": "list-prs",
  "slack-prs.md": "slack-prs",
  // All release aliases route to the single unified `release` skill — the
  // body checks invocation name + $ARGUMENTS to decide official vs beta.
  "release.md": "release",
  "release-stable.md": "release", // alias of release (official intent)
  "release-official.md": "release", // alias of release (official intent)
  "release-main.md": "release", // alias of release (official intent)
  "release-master.md": "release", // alias of release (official intent)
  "release-beta.md": "release", // alias of release (beta intent — invocation name forces beta)
};

/**
 * Marker that every Sy-managed slash command body starts with. Used by
 * _doCommandsWork() to identify our own previously-deployed commands in
 * ~/.claude/commands/ and wipe them before redeploying the current set.
 *
 * Anchored to the start of the file so unrelated commands (or markdown
 * that merely mentions "Sy Skill -" inside a code block) cannot trip
 * the cleanup pass.
 *
 * @type {string}
 */
const SY_SKILL_MARKER = "Sy Skill -";

/**
 * Every destination filename we have ever deployed under ~/.claude/commands/.
 * _doCommandsWork() unconditionally unlinks each of these before writing the
 * current set, so renames and removals are automatic — no orphan files linger
 * across deploys.
 *
 * Combined with the SY_SKILL_MARKER content scan, this gives belt-and-suspenders
 * cleanup: the marker scan catches anything we deploy in the future without
 * needing the list to be updated, and this explicit list catches files that
 * predate the marker (e.g. pre-`Sy Skill -` prefix deployments) or any name
 * that has since been retired.
 *
 * When adding a new slash command to CLAUDE_COMMAND_DEPLOY_MAP, also add its
 * destination filename here. When renaming or removing one, leave its old
 * destination filename here permanently so dev machines still pick up the
 * cleanup on the next run.
 *
 * @type {string[]} destination filenames including the `.md` suffix
 */
const CLAUDE_COMMAND_KNOWN_NAMES = [
  // Currently deployed (must match the keys of CLAUDE_COMMAND_DEPLOY_MAP):
  "babysit-pr.md",
  "babysit-prs.md",
  "create-pr.md",
  "draft-pr.md",
  "list-prs.md",
  "slack-prs.md",
  "sync-and-groom-repo.md",
  "sync-and-groom-repos.md",
  "release.md",
  "release-stable.md",
  "release-official.md",
  "release-main.md",
  "release-master.md",
  "release-beta.md",
  // Historically retired (left in place permanently so legacy files get cleaned up):
  "sync-babysit-pr.md", // merged into /babysit-pr in 119cc9d (Apr 2026)
  "sync-babysit-prs.md", // merged into /babysit-prs in 119cc9d (Apr 2026)
];

/**
 * Deploys slash command definitions to ~/.claude/commands/. Each entry in
 * CLAUDE_COMMAND_DEPLOY_MAP becomes a /<name> user-level command available
 * across all projects. Source files live under
 * software/scripts/advanced/claude/skills/ and are read verbatim via
 * readText (same pattern as claude-instructions.md). Aliased sources are read
 * once and cached so identical destinations stay byte-exact.
 * @param {string} targetDir - Path to the ~/.claude directory.
 */
async function _doCommandsWork(targetDir) {
  const commandsDir = path.join(targetDir, "commands");

  log(">> Claude Code Commands:", commandsDir);

  fs.mkdirSync(commandsDir, { recursive: true });

  // Wipe every previously-deployed Sy skill before redeploying the current
  // set, so renames are automatic and no orphan lingers when a command is
  // dropped from CLAUDE_COMMAND_DEPLOY_MAP. Two passes, both safe to run
  // unconditionally on every deploy:
  //
  //   1. Known-name pass: unlink each filename in CLAUDE_COMMAND_KNOWN_NAMES.
  //      Catches files that predate the SY_SKILL_MARKER content prefix
  //      (e.g. older deployments) and serves as an auditable, explicit
  //      record of every name we've ever deployed.
  //
  //   2. Marker pass: scan the directory for any remaining .md whose first
  //      line begins with SY_SKILL_MARKER. Catches future commands a dev
  //      machine may have deployed under a name we have since dropped from
  //      CLAUDE_COMMAND_KNOWN_NAMES, without anyone having to remember to
  //      add it to the list.
  //
  // User-authored slash commands without the marker AND not in the known
  // list are left untouched.
  for (const knownFile of CLAUDE_COMMAND_KNOWN_NAMES) {
    const stalePath = path.join(commandsDir, knownFile);
    if (fs.existsSync(stalePath)) {
      fs.unlinkSync(stalePath);
      log("   Removed prior Sy skill (known-name):", knownFile);
    }
  }
  for (const entry of fs.readdirSync(commandsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const filePath = path.join(commandsDir, entry.name);
    /** @type {string} First line of the file, used only to check for SY_SKILL_MARKER. */
    const firstLine = fs.readFileSync(filePath, "utf-8").split("\n", 1)[0] || "";
    if (firstLine.startsWith(SY_SKILL_MARKER)) {
      fs.unlinkSync(filePath);
      log("   Removed prior Sy skill (marker):", entry.name);
    }
  }

  /** @type {Record<string, string>} Source-name → file content. Caches re-reads for aliased entries. */
  const sourceCache = {};

  for (const [destFile, sourceName] of Object.entries(CLAUDE_COMMAND_DEPLOY_MAP)) {
    if (!(sourceName in sourceCache)) {
      sourceCache[sourceName] = (await readText`software/scripts/advanced/claude/skills/${sourceName}.md`).trimEnd();
    }
    const dest = path.join(commandsDir, destFile);
    await backupConfigFile(dest);
    fs.writeFileSync(dest, sourceCache[sourceName] + "\n");
    log("   Deployed:", destFile);
  }
}

////// Main Entry Point //////

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
  await _doKeysWork(targetDir);
  await _doCommandsWork(targetDir);
  await _doInstructionsWork(targetDir);
}

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
  const sourceContent = (await readText`software/scripts/advanced/llm/_common/instructions.md`).trim();

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
 * software/scripts/advanced/llm/_common/commands/. Multiple keys may point at the
 * same source so aliases stay byte-exact across destinations.
 *
 * Naming convention: every destination filename is prefixed with `sy-` so all
 * Sy-managed slash commands cluster under `/sy-*` and never collide with
 * user-authored or plugin-shipped commands. Source filenames stay bare
 * (`babysit-pr.md`, `release.md`, etc.) — the `sy-` prefix is purely a
 * deploy-time decoration so editing skill content doesn't require typing the
 * prefix every time.
 *
 * Editing a command: edit the .md file under
 *   software/scripts/advanced/llm/_common/commands/<name>.md
 * Adding a command: drop a new .md file there + add a `sy-<name>.md` deploy
 *   entry whose value is the bare source name.
 * Aliasing: add a deploy-map entry whose value points at an existing source.
 *
 * @type {Record<string, string>}
 */
const CLAUDE_COMMAND_DEPLOY_MAP = {
  "sy-babysit-pr.md": "babysit-pr",
  "sy-babysit-prs.md": "babysit-prs",
  "sy-sync-and-groom-repo.md": "sync-and-groom-repo",
  "sy-sync-and-groom-repos.md": "sync-and-groom-repos",
  "sy-create-pr.md": "create-pr",
  "sy-draft-pr.md": "draft-pr",
  "sy-list-prs.md": "list-prs",
  "sy-review-pr.md": "review-pr",
  "sy-review-prs.md": "review-prs",
  "sy-slack-prs.md": "slack-prs",
  // Single release entry-point. The skill body checks $ARGUMENTS to decide
  // official vs beta — no per-channel alias files anymore (the old
  // /sy-release-{main,master,stable,official,beta} aliases were retired
  // 2026-05-13; see CLAUDE_COMMAND_RETIRED_NAMES below).
  "sy-release.md": "release",
};

/**
 * Markers that a Sy-managed slash command body may start with. Used by
 * _doCommandsWork() to identify our own previously-deployed commands in
 * ~/.claude/commands/ and wipe them before redeploying the current set.
 *
 * Each marker is anchored to the start of the file so unrelated commands
 * (or markdown that merely mentions `[Sy]` inside a code block) cannot
 * trip the cleanup pass. Trailing spaces are deliberate — `[Sy]` alone
 * would risk matching user-authored files that happen to start with a
 * bracketed tag, and `Sy Skill -` is the legacy prefix kept here so any
 * dev machine that still has pre-`[Sy] `-rename files on disk gets them
 * cleaned up automatically on the next deploy. Add new markers here when
 * the prefix convention changes; remove old ones only after every dev
 * machine has re-run at least once past the prior convention.
 *
 * @type {string[]}
 */
const SY_SKILL_MARKERS = ["[Sy] ", "Sy Skill - "];

/**
 * Slash-command filenames that we used to deploy but no longer do, and which
 * may not carry any SY_SKILL_MARKERS prefix on disk (e.g. they predate every
 * marker convention, or the marker was edited away by hand).
 *
 * Cleanup of *current* deploy targets is handled implicitly: the deploy loop
 * overwrites them, so nothing extra is needed. Cleanup of *future* renames is
 * handled by the SY_SKILL_MARKERS content scan in _doCommandsWork().
 *
 * MAINTENANCE RULE: **Whenever a slash command is renamed or deleted, its old
 * destination filename MUST be added here.** That's how dev machines that
 * still have the old file on disk get it cleaned up on their next deploy.
 * Forgetting to add it leaves an orphan command in `~/.claude/commands/` that
 * shows up in the slash-command picker with stale content.
 *
 * Entries stay here long enough for every dev machine to have re-run at
 * least once after the rename. Each entry tracks WHEN it was retired so a
 * future maintainer can prune entries that are now safe to drop (rule of
 * thumb: ~3+ months after the retirement commit, AND all known dev machines
 * have re-run). Removing an entry too early orphans files; leaving it too
 * long is harmless but clutters this list — so periodically clean it up.
 *
 * @type {string[]} destination filenames including the `.md` suffix
 */
const CLAUDE_COMMAND_RETIRED_NAMES = [
  // TODO(retired-cleanup): drop these once we're confident every dev machine
  // has re-run `bash run.sh --files=claude.js` at least once after the merge
  // commit (rule of thumb: 3+ months after the date below). Removing too
  // early orphans files; periodically prune so this list stays signal-only.
  "sync-babysit-pr.md", // merged into /sy-babysit-pr in 119cc9d (2026-04-24)
  "sync-babysit-prs.md", // merged into /sy-babysit-prs in 119cc9d (2026-04-24)
  // 2026-05-11: every Sy-managed command was renamed to a `sy-` prefix
  // (e.g. /babysit-pr -> /sy-babysit-pr) so they cluster in the `/` menu and
  // never collide with user-authored or plugin-shipped commands. The OLD
  // non-prefixed filenames below are retired — re-running claude.js on any
  // dev machine that still has these on disk will unlink them.
  "babysit-pr.md", // renamed to sy-babysit-pr.md (2026-05-11)
  "babysit-prs.md", // renamed to sy-babysit-prs.md (2026-05-11)
  "create-pr.md", // renamed to sy-create-pr.md (2026-05-11)
  "draft-pr.md", // renamed to sy-draft-pr.md (2026-05-11)
  "list-prs.md", // renamed to sy-list-prs.md (2026-05-11)
  "slack-prs.md", // renamed to sy-slack-prs.md (2026-05-11)
  "sync-and-groom-repo.md", // renamed to sy-sync-and-groom-repo.md (2026-05-11)
  "sync-and-groom-repos.md", // renamed to sy-sync-and-groom-repos.md (2026-05-11)
  "release.md", // renamed to sy-release.md (2026-05-11)
  "release-stable.md", // renamed to sy-release-stable.md (2026-05-11)
  "release-official.md", // renamed to sy-release-official.md (2026-05-11)
  "release-main.md", // renamed to sy-release-main.md (2026-05-11)
  "release-master.md", // renamed to sy-release-master.md (2026-05-11)
  "release-beta.md", // renamed to sy-release-beta.md (2026-05-11)
  // 2026-05-13: collapsed every release variant down to a single
  // /sy-release entry-point. The skill body still chooses official vs
  // beta from $ARGUMENTS — the per-channel aliases were just noise in
  // the slash-command picker. Retire the old destination filenames so
  // dev machines that still have them on disk clean up on next deploy.
  "sy-release-stable.md", // collapsed into sy-release.md (2026-05-13)
  "sy-release-official.md", // collapsed into sy-release.md (2026-05-13)
  "sy-release-main.md", // collapsed into sy-release.md (2026-05-13)
  "sy-release-master.md", // collapsed into sy-release.md (2026-05-13)
  "sy-release-beta.md", // collapsed into sy-release.md (2026-05-13)
];

/**
 * Deploys slash command definitions to ~/.claude/commands/. Each entry in
 * CLAUDE_COMMAND_DEPLOY_MAP becomes a /<name> user-level command available
 * across all projects. Source files live under
 * software/scripts/advanced/llm/_common/commands/ and are read verbatim via
 * readText (same pattern as claude-instructions.md). Aliased sources are read
 * once and cached so identical destinations stay byte-exact.
 * @param {string} targetDir - Path to the ~/.claude directory.
 */
async function _doCommandsWork(targetDir) {
  const commandsDir = path.join(targetDir, "commands");

  log(">> Claude Code Commands:", commandsDir);
  // Hint for users who want to start from a clean slate (e.g. after
  // renaming or retiring a batch of commands). We never run this
  // ourselves — selective unlinking happens further down via the
  // CLAUDE_COMMAND_RETIRED_NAMES + SY_SKILL_MARKERS cleanup pass.
  log("   To wipe all deployed commands, run: rm -f ~/.claude/commands/*");

  fs.mkdirSync(commandsDir, { recursive: true });

  // Diff the on-disk commands directory against the current deploy map and
  // drop any Sy-managed orphans. Files that are currently in
  // CLAUDE_COMMAND_DEPLOY_MAP are skipped — the deploy loop below will
  // overwrite them, so deleting + rewriting would be wasted IO.
  //
  // An on-disk file is treated as a Sy orphan (and unlinked) when:
  //   (a) its name is in CLAUDE_COMMAND_RETIRED_NAMES — explicit retirements
  //       we know about, including legacy files that predate every marker, OR
  //   (b) its first line starts with any SY_SKILL_MARKERS entry — covers any
  //       rename we perform in the future without anyone needing to update a
  //       list, AND catches legacy `Sy Skill - ` prefixed files left over
  //       from before the `[Sy] ` rename.
  //
  // User-authored slash commands that match neither path are left untouched.
  /** @type {Set<string>} Filenames the deploy loop will (re)write — skip cleanup for these. */
  const deployTargets = new Set(Object.keys(CLAUDE_COMMAND_DEPLOY_MAP));
  for (const filePath of findPathList(commandsDir, /\.md$/, { type: "file" })) {
    /** @type {string} Just the basename (e.g. "create-pr.md") of the on-disk file. */
    const fileName = path.basename(filePath);
    if (deployTargets.has(fileName)) continue;
    /** @type {string} Reason label printed in the log line — only set when we decide to unlink. */
    let reason = "";
    if (CLAUDE_COMMAND_RETIRED_NAMES.includes(fileName)) {
      reason = "retired";
    } else {
      /** @type {string} First line of the file, checked against every SY_SKILL_MARKERS entry. */
      const firstLine = fs.readFileSync(filePath, "utf-8").split("\n", 1)[0] || "";
      if (SY_SKILL_MARKERS.some((m) => firstLine.startsWith(m))) reason = "marker";
    }
    if (reason) {
      fs.unlinkSync(filePath);
      log(`   Removed prior Sy skill (${reason}):`, fileName);
    }
  }

  /** @type {Record<string, string>} Source-name → file content. Caches re-reads for aliased entries. */
  const sourceCache = {};

  for (const [destFile, sourceName] of Object.entries(CLAUDE_COMMAND_DEPLOY_MAP)) {
    if (!(sourceName in sourceCache)) {
      sourceCache[sourceName] = (await readText`software/scripts/advanced/llm/_common/commands/${sourceName}.md`).trimEnd();
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

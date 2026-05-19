/** GitHub Copilot CLI setup: settings + user-level AGENTS.md instructions. Run: `bash run.sh --files="copilot/setup.js"` */
// SOURCE software/scripts/advanced/llm/llm-common.js

// ----------------------------------------------------------------------------
// What this file does and does NOT do
// ----------------------------------------------------------------------------
// Mirrors the structure of software/scripts/advanced/llm/claude/setup.js but
// only for the subset of Copilot CLI's config surface that's actually
// reachable from disk:
//
//   ✅ Settings  — ~/.copilot/settings.json (defaults-merge, never clobbers
//                   enabledPlugins / extraKnownMarketplaces / model / etc.)
//   ✅ Instructions — ~/.copilot/AGENTS.md (managed-rules block, mirrors
//                   ~/.claude/CLAUDE.md's pattern; Copilot CLI loads AGENTS.md
//                   user-level — verified by running `copilot -p ... AGENTS
//                   marker` and asking it to list its custom instruction file
//                   paths; it confirmed `~/.copilot/AGENTS.md` as the
//                   user-level fallback alongside cwd `./AGENTS.md` and
//                   `.github/copilot-instructions.md`)
//   ⚠️ Keybindings — Mirror-shaped only. copilot-keys.common.jsonc and
//                    copilot-keys.windows.jsonc exist in the same format as
//                    Claude's pair, and _doCopilotKeysWork() below merges
//                    them into .build/copilot-keys{,-mac} every CI run so
//                    the merge stays exercised. The LIVE deploy to a real
//                    config path is no-op'd because Copilot v1.0.48 has NO
//                    keymap config (every input chord is hardcoded in the
//                    Mach-O binary; see docs/editor-keybindings.md →
//                    "Copilot CLI configurability gap"). When upstream ships
//                    a config knob, the only edit needed is to uncomment the
//                    writeJson() block at the bottom of _doCopilotKeysWork().
//
//   ❌ User-level slash commands — Copilot has no `~/.copilot/commands/*.md`
//                    fallthrough the way Claude does. Its equivalent is
//                    plugins/skills installed via `copilot plugin install`,
//                    which require a manifest (plugin.json + skills/<name>/
//                    SKILL.md). Mirroring Claude's `~/.claude/commands/sy-*.md`
//                    files as a Copilot plugin would mean generating that
//                    manifest scaffolding — out of scope for this script.
//                    Per-repo `.github/copilot-instructions.md` is already
//                    handled at the wrapper layer in copilot.profile.bash.
//
//   ⚠️ Plugins / MCP — `~/.copilot/settings.json` → `enabledPlugins` and
//                    `extraKnownMarketplaces`, plus `~/.copilot/mcp-config.json`,
//                    are owned by the user (or by the Captain
//                    `install-plugin-to-copilot` skill if the user opts in).
//                    This script intentionally leaves them untouched.

////// Keybindings //////

/** @type {string} Copilot CLI OS modifier key on macOS (meta = cmd in terminals). Mirrors CLAUDE_MAC_OS_KEY. */
const COPILOT_MAC_OS_KEY = "meta";

/** @type {object[]} Common keybindings loaded from JSONC. */
let COPILOT_COMMON_KEY_BINDINGS;
/** @type {object[]} Windows/Linux-only keybindings loaded from JSONC. */
let COPILOT_WINDOWS_ONLY_KEY_BINDINGS;

/**
 * Replaces OS_KEY placeholders in Copilot CLI keybinding context groups with the actual OS-specific modifier key.
 * Copilot bindings reuse Claude's { context, bindings: { key: action } } shape where OS_KEY appears in object keys.
 * @param {object[]} contextGroups - Array of { context, bindings } objects.
 * @param {string} osKeyToUse - The OS-specific modifier key to substitute (e.g. "alt", "meta").
 * @returns {object[]} Context groups with resolved binding keys.
 */
function _formatCopilotKeybindings(contextGroups, osKeyToUse) {
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
 * Merges multiple arrays of Copilot CLI keybinding context groups, combining bindings for the same context.
 * Direct mirror of claude/setup.js's _mergeContextGroups — kept local to avoid cross-file coupling between
 * the two setup.js scripts (matches the opencode/setup.js precedent of duplicating helpers locally).
 * @param  {...object[]} arrays - Arrays of { context, bindings } objects to merge.
 * @returns {object[]} Merged context groups with combined bindings.
 */
function _mergeCopilotContextGroups(...arrays) {
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
 * Schema metadata fields ($schema / $docs) are placeholders — Copilot has no published keybindings schema yet.
 * @param {boolean} [isOsMac] - Override for macOS detection. When omitted, uses the global is_os_mac flag.
 * @returns {object} Full Copilot CLI keybindings config with schema metadata.
 */
function _getCopilotKeyConfig(isOsMac) {
  const isMac = isOsMac !== undefined ? isOsMac : is_os_mac;
  const osKey = isMac ? COPILOT_MAC_OS_KEY : LLM_WINDOWS_OS_KEY;

  /** @type {object[]} Platform-specific bindings merged with common. */
  const merged = isMac
    ? _mergeCopilotContextGroups(COPILOT_COMMON_KEY_BINDINGS)
    : _mergeCopilotContextGroups(COPILOT_COMMON_KEY_BINDINGS, COPILOT_WINDOWS_ONLY_KEY_BINDINGS);

  return {
    // Pre-staged schema URL — github/copilot-cli has not published a
    // keybindings schema yet (no equivalent of schemastore's
    // claude-code-keybindings.json). Update when upstream publishes one.
    $schema: "https://example.invalid/copilot-cli-keybindings.json",
    $docs: "https://docs.github.com/copilot/concepts/agents/about-copilot-cli",
    bindings: _formatCopilotKeybindings(merged, osKey),
  };
}

/**
 * Loads common + windows JSONC files, merges them, and writes per-platform build artifacts.
 * The LIVE deploy to ~/.copilot/keybindings.json is intentionally NOT performed: Copilot
 * v1.0.48 does not read any keybindings file from disk (chords are hardcoded in the binary).
 * The merge runs every CI run so the schema is exercised and stays parseable; when upstream
 * ships a keymap config surface, uncomment the writeJson() block at the bottom of this
 * function and add a backupConfigFile() call mirroring claude/setup.js exactly.
 * @param {string} targetDir - Path to the ~/.copilot directory (used only by the deferred live deploy).
 */
async function _doCopilotKeysWork(targetDir) {
  log(">> GitHub Copilot CLI Keybindings (preview only — Copilot has no on-disk keymap surface yet):");
  log("   Build artifacts:", `${BUILD_DIR}/copilot-keys`, "+", `${BUILD_DIR}/copilot-keys-mac`);

  COPILOT_COMMON_KEY_BINDINGS = (await readJson`software/scripts/advanced/llm/copilot/copilot-keys.common.jsonc`) || [];
  COPILOT_WINDOWS_ONLY_KEY_BINDINGS = (await readJson`software/scripts/advanced/llm/copilot/copilot-keys.windows.jsonc`) || [];

  // write to build file (one per platform) — mirrors claude/setup.js exactly
  const comments = "GitHub Copilot CLI Keybindings (pre-staged; not yet read by Copilot)";
  await writeBuildArtifact([
    {
      file: `${BUILD_DIR}/copilot-keys`,
      data: _getCopilotKeyConfig(false),
      isJson: true,
      comments,
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/copilot-keys-mac`,
      data: _getCopilotKeyConfig(true),
      isJson: true,
      comments,
      commentStyle: "json",
    },
  ]);

  // ----------------------------------------------------------------------
  // DEFERRED LIVE DEPLOY — uncomment when github/copilot-cli ships a keymap
  // config surface. Mirror the bottom half of claude/setup.js's _doKeysWork()
  // exactly: read existing user bindings, merge ours on top, backupConfigFile,
  // writeJson. The target path below is a guess; replace with whatever
  // upstream documents (likely ~/.copilot/keybindings.json by convention).
  // ----------------------------------------------------------------------
  // const targetPath = path.join(targetDir, "keybindings.json");
  // log(">> GitHub Copilot CLI Keybindings (live deploy):", targetPath);
  // let existingBindings = [];
  // try {
  //   const data = JSON.parse(fs.readFileSync(targetPath, "utf-8"));
  //   if (data && Array.isArray(data.bindings)) existingBindings = data.bindings;
  // } catch (e) {}
  // const ourConfig = _getCopilotKeyConfig();
  // ourConfig.bindings = _mergeCopilotContextGroups(existingBindings, ourConfig.bindings);
  // await backupConfigFile(targetPath);
  // await writeJson(targetPath, ourConfig);
}

////// Settings //////

/**
 * Managed default settings to seed into ~/.copilot/settings.json. The merge
 * order is `{ ...COPILOT_MANAGED_SETTINGS, ...existing }` so any key the user
 * has already set in settings.json wins — these only fill in MISSING keys.
 * Anything plugin-shaped (enabledPlugins, extraKnownMarketplaces) or
 * auth-shaped (allowedUrls, firstLaunchAt) is deliberately omitted so it
 * survives untouched across re-runs.
 *
 * Sourced from `copilot help config` (v1.0.48) — only safe-to-default keys
 * land here.
 *
 * @type {Record<string, any>}
 */
const COPILOT_MANAGED_SETTINGS = {
  // skip the splash animation on every launch — defaults to "once" upstream,
  // but on a fresh machine "once" still means one extra screen per install
  // and copilot launches multiple times during setup. tradeoff: never see
  // the splash. risk: none
  banner: "never",
  // disable terminal bell when user attention is required — agents that fully
  // own the terminal session don't benefit from audio cues, and CI / tmux
  // users get a stray BEL otherwise. tradeoff: no audio nudge. risk: low
  beep: false,
  // collapse pasted content over 10 lines into a compact [Paste #N - X lines]
  // token so the input field stays readable when pasting log dumps / large
  // diffs. matches upstream default; pinned here so a future flip upstream
  // doesn't change behavior silently. tradeoff: none. risk: none
  compactPaste: true,
  // render markdown in the terminal — matches upstream default; pinned for
  // the same reason as compactPaste. tradeoff: none. risk: none
  renderMarkdown: true,
};

/**
 * Merges managed defaults into ~/.copilot/settings.json, preserving every
 * existing user-set key. Only keys in COPILOT_MANAGED_SETTINGS that are
 * missing from the user's settings.json are filled in — anything already
 * present (model, enabledPlugins, extraKnownMarketplaces, allowedUrls, etc.)
 * is left exactly as the user / `copilot plugin install` left it.
 *
 * @param {string} targetDir - Path to the ~/.copilot directory.
 */
async function _doCopilotSettingsWork(targetDir) {
  const targetPath = path.join(targetDir, "settings.json");

  log(">> GitHub Copilot CLI Settings:", targetPath);

  /** @type {object} Existing user settings (empty object if file missing or invalid). */
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(targetPath, "utf-8")) || {};
  } catch (e) {}

  // merge: managed settings are applied as defaults, existing user overrides are preserved
  const merged = { ...COPILOT_MANAGED_SETTINGS, ...existing };

  await backupConfigFile(targetPath);
  await writeJson(targetPath, merged);
}

////// Instructions (User-Level AGENTS.md) //////

/**
 * Marker key used to wrap the managed engineering principles block inside
 * ~/.copilot/AGENTS.md. Anything outside the BEGIN/END markers is preserved
 * as user-owned content (matches the claude/setup.js convention).
 * @type {string}
 */
const COPILOT_INSTRUCTIONS_MARKER = "managed-rules";

/**
 * Deploys the shared engineering principles into ~/.copilot/AGENTS.md between
 * BEGIN/END markers. The markdown source uses backticks for inline code;
 * readText returns file content verbatim (only the path argument is a
 * template literal), and the content flows into replaceBlock as a plain
 * string — no re-templating, so backticks are safe here.
 *
 * Why AGENTS.md (not COPILOT.md or copilot-instructions.md): copilot v1.0.48
 * advertises "Disable loading of custom instructions from AGENTS.md and
 * related files" in `copilot --help`. A live probe with a per-cwd AGENTS.md
 * marker confirmed copilot loads `~/.copilot/AGENTS.md` as the user-level
 * fallback (alongside cwd `./AGENTS.md` and `.github/copilot-instructions.md`,
 * the per-repo path handled by copilot.profile.bash).
 *
 * Existing user content outside the marker block is preserved on re-runs.
 *
 * @param {string} targetDir - Path to the ~/.copilot directory.
 */
async function _doCopilotInstructionsWork(targetDir) {
  const targetPath = path.join(targetDir, "AGENTS.md");

  log(">> GitHub Copilot CLI Instructions:", targetPath);

  /** @type {string} The markdown source for the managed engineering principles block. */
  const sourceContent = (await readText`software/scripts/advanced/llm/_common/instructions.md`).trim();

  /** @type {string} Existing AGENTS.md content (empty if file is missing). */
  let existing = "";
  try {
    existing = fs.readFileSync(targetPath, "utf-8");
  } catch (e) {}

  // Upsert the managed block between <!-- BEGIN managed-rules --> / <!-- END managed-rules -->.
  // insertMode: "append" creates the block when AGENTS.md is brand new or the markers are missing.
  const merged = replaceBlock(existing, COPILOT_INSTRUCTIONS_MARKER, sourceContent, "<!--", " -->", "append").trim() + "\n";

  await backupConfigFile(targetPath);
  await writeText(targetPath, merged);
}

////// Main Entry Point //////

/**
 * Orchestrates GitHub Copilot CLI user-level setup: settings defaults +
 * shared engineering-principles instructions block. Skips entirely when the
 * `copilot` binary is not installed (treat as a no-op rather than an error
 * so partial setups don't fail this script).
 */
async function doWork() {
  if (!(await isBinaryFound("copilot"))) {
    log(">> Skipped GitHub Copilot CLI setup: not installed");
    return;
  }

  const targetDir = path.join(BASE_HOMEDIR_LINUX, ".copilot");

  // ensure ~/.copilot exists — copilot's install.sh does not create it on its
  // own (the dir only appears after the first interactive launch), so when
  // someone runs `bash run.sh --files="copilot/setup.js"` on a freshly-
  // installed-but-never-launched copilot we still want to land both files.
  await mkdir(targetDir);

  log(">> Configuring GitHub Copilot CLI:", targetDir);

  await _doCopilotSettingsWork(targetDir);
  await _doCopilotKeysWork(targetDir);
  await _doCopilotInstructionsWork(targetDir);
}

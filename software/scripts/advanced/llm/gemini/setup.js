/** Google Gemini CLI setup: settings + user-level GEMINI.md instructions. Run: `bash run.sh --files="gemini/setup.js"` */
// SOURCE software/scripts/advanced/llm/llm-common.js
// SOURCE software/scripts/advanced/editor.common.js

// ----------------------------------------------------------------------------
// What this file does and does NOT do
// ----------------------------------------------------------------------------
// Mirrors the structure of software/scripts/advanced/llm/claude/setup.js but
// only for the subset of Gemini CLI's config surface that's actually
// reachable from disk:
//
//   ✅ Settings  — ~/.gemini/settings.json (defaults-merge; never clobbers
//                   auth keys like selectedAuthType, gcpProjectId. The
//                   `mcpServers` key is now additively managed by
//                   `deploySharedMcpServers` from the shared MCP registry — user-added
//                   server entries with names NOT in the registry are still
//                   preserved untouched.)
//   ✅ Instructions — ~/.gemini/GEMINI.md (managed block keyed by source path, mirrors
//                   ~/.claude/CLAUDE.md's pattern; Gemini loads this as the
//                   global context file — see docs/gemini_cli_readme.md)
//
//   ✅ Keybindings — ~/.gemini/keybindings.json (additive merge: managed
//                   bindings always apply; user's other entries pass through
//                   unchanged). Schema is a flat JSON array of
//                   `{ command, key }` objects; prefixing `command` with `-`
//                   removes a default binding. Discovered in Gemini bundle
//                   chunk-MODIYMRW.js (function `loadCustomKeybindings`, ~ line
//                   64732). Mirrors Claude's common+windows split:
//                   gemini-keys.common.jsonc carries every Claude chord
//                   explicitly (no reliance on Gemini upstream defaults),
//                   gemini-keys.windows.jsonc removes the default alt+v
//                   paste so OS_KEY=alt on Windows/Linux doesn't collide.
//
//   ❌ User-level slash commands — Gemini has no `~/.gemini/commands/*.md`
//                    fallthrough. Its equivalent is the extension system
//                    (`gemini extensions install <source>` /
//                    `gemini extensions link <local-path>`) which requires a
//                    full extension manifest. Mirroring Claude's
//                    `~/.claude/commands/sy-*.md` as a Gemini extension would
//                    mean generating that scaffolding — out of scope.
//
//   ✅ Skills — Gemini discovers ~/.agents/skills directly. Shared deployment
//                    links each skill there once; no ~/.gemini/skills bootstrap.
//                    Same-name Gemini entries are removed from discovery after
//                    canonical deployment. Real entries are backed up first;
//                    Gemini-only skills remain untouched.

// --- Keybindings ---

/**
 * OS-specific modifier substituted into the `OS_KEY` placeholder used in
 * `gemini-keys.common.jsonc`. Matches the modifier strings Gemini's own
 * `defaultKeyBindingConfig` uses: `cmd` on macOS (cmd+z, cmd+enter, cmd+v)
 * and `alt` on Windows/Linux (alt+z, alt+enter, alt+v).
 *
 * @param {boolean} [isOsMac] - Override for macOS detection. Defaults to the global `is_os_mac` flag.
 * @returns {string} The modifier string to substitute (`"cmd"` or `"alt"`).
 */
function _geminiOsKey(isOsMac) {
  const isMac = isOsMac !== undefined ? isOsMac : is_os_mac;
  return isMac ? "cmd" : "alt";
}

/**
 * Loads `gemini-keys.common.jsonc` (and `gemini-keys.windows.jsonc` on
 * non-mac platforms) and substitutes `OS_KEY` in every chord for the
 * current platform. Returns a flat array of `{ command, key }` objects
 * ready to write to `~/.gemini/keybindings.json`.
 *
 * Mirrors the common+windows split used by claude/setup.js. The windows
 * file currently only nulls `alt+v` paste (`{ command: "-input.paste",
 * key: "alt+v" }`) so OS_KEY=alt on Windows/Linux doesn't double-bind
 * paste; expand as needed if more OS_KEY=alt collisions surface.
 *
 * @param {boolean} [isOsMac] - Override for macOS detection. Defaults to the global `is_os_mac` flag.
 * @returns {Promise<Array<{ command: string, key: string }>>} Resolved managed bindings.
 */
async function _loadGeminiManagedKeybindings(isOsMac) {
  const isMac = isOsMac !== undefined ? isOsMac : is_os_mac;

  /** @type {Array<{ command: string, key: string }> | null} */
  const common = await readJson`software/scripts/advanced/llm/gemini/gemini-keys.common.jsonc`;
  /** @type {Array<{ command: string, key: string }> | null} */
  const windows = isMac ? null : await readJson`software/scripts/advanced/llm/gemini/gemini-keys.windows.jsonc`;

  /** @type {Array<{ command: string, key: string }>} */
  const raw = [...(Array.isArray(common) ? common : []), ...(Array.isArray(windows) ? windows : [])];

  if (raw.length === 0) return [];

  const osKey = _geminiOsKey(isMac);

  return raw.map((entry) => ({
    command: entry.command,
    key: typeof entry.key === "string" ? entry.key.replace(/OS_KEY/g, osKey) : entry.key,
  }));
}

/**
 * Deploys the managed bindings to `~/.gemini/keybindings.json`. Additive merge:
 *   1. Managed bindings (from `gemini-keys.common.jsonc`, OS_KEY substituted)
 *      always apply.
 *   2. Any existing user bindings whose `(command, key)` pair does NOT collide
 *      with a managed entry are preserved untouched.
 *   3. Existing user bindings that collide with a managed entry are replaced
 *      by the managed one (so a re-run of this script always converges to the
 *      managed state for the chords we own).
 *
 * @param {string} targetDir - Path to the `~/.gemini` directory.
 */
async function _doGeminiKeysWork(targetDir) {
  const targetPath = path.join(targetDir, "keybindings.json");

  log(">> Gemini CLI Keybindings:", targetPath);

  const managed = await _loadGeminiManagedKeybindings();
  if (managed.length === 0) {
    log("   No managed bindings — skipping");
    return;
  }

  /** @type {Array<{ command: string, key: string }>} Existing user bindings (empty if file missing or invalid). */
  let existing = [];
  try {
    const data = JSON.parse(fs.readFileSync(targetPath, "utf-8"));
    if (Array.isArray(data)) existing = data;
  } catch (e) {}

  // build collision set keyed by (command, key) so user entries that target
  // the same chord-command pair as a managed entry get dropped in favor of
  // the managed version
  const managedKeys = new Set(managed.map((b) => `${b.command}\u0000${b.key}`));
  const preserved = existing.filter((b) => {
    if (!b || typeof b.command !== "string" || typeof b.key !== "string") return false;
    return !managedKeys.has(`${b.command}\u0000${b.key}`);
  });

  // managed first so they take precedence when loaded by Gemini (its loader
  // prepends each new binding to the per-command list, but the on-disk order
  // is also what's read back on the next run)
  const merged = [...managed, ...preserved];

  await backupConfigFile(targetPath);
  await writeJson(targetPath, merged);
}

// --- Settings ---

/**
 * Managed default settings to seed into ~/.gemini/settings.json. The merge
 * order is `{ ...GEMINI_MANAGED_SETTINGS, ...existing }` so any key the user
 * has already set in settings.json wins — these only fill in MISSING keys.
 *
 * Auth-shaped keys (`selectedAuthType`, `gcpProjectId`, etc.) and
 * user-managed shape (`theme`, `model.*` overrides) are deliberately omitted
 * so they survive untouched across re-runs. `mcpServers` is handled
 * separately by `deploySharedMcpServers` (additive merge from the shared registry,
 * preserves user-added server names).
 *
 * When adding a new managed setting, also update the settings-intent table in
 * `software/scripts/advanced/llm/llm.md` so cross-CLI parity stays
 * visible at review time (intent must be implemented in claude/copilot/opencode
 * too, or explicitly marked n/a there).
 *
 * @type {Record<string, any>}
 */
const GEMINI_MANAGED_SETTINGS = {
  // skip the splash screen / animations on every launch — same reasoning as
  // copilot's banner=never. tradeoff: never see the splash. risk: none
  hideBanner: true,
  // hide rotating tips in the loading spinner. tradeoff: miss occasional
  // tips. risk: none (matches claude's spinnerTipsEnabled:false convention)
  hideTips: true,
  // --- general.* — top-level UX / lifecycle defaults ---
  // Nested under `general` per gemini's schema (verified in bundle
  // chunk-7I6BZ5I5.js: `settings.general.enableAutoUpdate`,
  // `settings.general.sessionRetention.enabled/maxAge`). _doGeminiSettingsWork
  // below uses _deepMerge so adding nested defaults here doesn't clobber any
  // sibling user-set keys under `general` (e.g. `general.preferredEditor`).
  general: {
    // Disable in-session auto-update. We refresh gemini out-of-band via
    // `bash run.sh --files=gemini/install.sh` (npm_install_global). Matches
    // opencode's autoupdate:false (opencode/setup.js:119) so all four LLM
    // CLIs update on the same cadence — when the dotfiles bootstrap runs,
    // not mid-session. tradeoff: must re-run installer to pick up new
    // versions. risk: low.
    enableAutoUpdate: false,
    // Auto-delete session files older than 30 days. Direct analog of
    // claude's cleanupPeriodDays:30 — keeps the session dir from
    // accumulating stale transcripts. tradeoff: lose old session history
    // (resume past 30 days won't work). risk: low.
    sessionRetention: {
      enabled: true,
      maxAge: "30d",
    },
  },
  // --- privacy.* — telemetry opt-out ---
  // Opt out of usage statistics. Default is true (ships anonymized stats to
  // Google). Matches the privacy intent driving opencode's share:"disabled"
  // and CLAUDE.md §42 ("No secret values, ever, anywhere") — even anonymized
  // tool input is a leak surface for conversation content. tradeoff: lose
  // anonymous-stats contribution. risk: none.
  privacy: {
    usageStatisticsEnabled: false,
  },
  // --- context.* — file-discovery filtering ---
  // Exclude gitignored files from the @ file mention picker. Default is
  // already true in gemini, but pinning makes the intent visible in the
  // managed map and protects against an upstream default flip. Direct
  // mirror of copilot's respectGitignore:true (copilot/setup.js:239).
  // tradeoff: none. risk: none.
  context: {
    fileFiltering: {
      respectGitIgnore: true,
    },
  },
};

/**
 * Recursively merges `source` into `target`, mutating and returning `target`.
 * Plain-object values are merged deeply; arrays and primitives in `source`
 * overwrite anything in `target`. Mirrors the helper used by browser-config.js,
 * handbrake-config.js, and docker-config.js — duplicated here to keep
 * llm/gemini/ self-contained (matches the local-helper precedent in
 * opencode/setup.js).
 * @param {Record<string, any>} target - Object to merge into.
 * @param {Record<string, any>} source - Object whose values overwrite target.
 * @returns {Record<string, any>} The mutated target.
 */
function _deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      _deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

/**
 * Adds managed custom themes without replacing explicit foreign selections or theme entries.
 * @param {object} settings - In-memory merged settings, modified before the caller's backup/write.
 * @returns {Promise<void>} Resolves after both source themes have been validated.
 * @throws {Error} For invalid settings/source shapes; no configuration file is written here.
 */
async function _doGeminiThemeWork(settings) {
  if (settings.ui === undefined) settings.ui = {};
  if (!settings.ui || typeof settings.ui !== "object" || Array.isArray(settings.ui))
    throw new Error("Invalid Gemini ui settings: expected an object");
  const selected = settings.ui.theme;
  if (selected !== undefined && typeof selected !== "string") throw new Error("Invalid Gemini theme selection: expected a string");
  if (!shouldInstallCustomTheme("terminal")) {
    if (selected === "Sy Dark") settings.ui.theme = getTheme("gemini").dark;
    if (selected === "Sy Light") settings.ui.theme = getTheme("gemini").light;
    return;
  }
  const [dark, light] = await Promise.all([readSyTheme("gemini", "dark"), readSyTheme("gemini", "light")]);
  for (const theme of [dark, light]) {
    if (
      typeof theme.name !== "string" ||
      !theme.name ||
      ["__proto__", "constructor", "prototype"].includes(theme.name) ||
      theme.type !== "custom" ||
      !theme.text ||
      typeof theme.text !== "object" ||
      !theme.background ||
      typeof theme.background !== "object"
    ) {
      throw new Error("Invalid Gemini Sy source: expected a safe name, custom type, and native text/background groups");
    }
  }
  if (dark.name === light.name) throw new Error("Invalid Gemini themes: appearance names must be distinct");
  const custom = settings.ui.customThemes;
  if (custom !== undefined && (!custom || typeof custom !== "object" || Array.isArray(custom)))
    throw new Error("Invalid Gemini customThemes: expected an object");
  settings.ui.customThemes = { ...custom, [dark.name]: dark, [light.name]: light };
  if (selected === undefined || selected === "Sy Dark") settings.ui.theme = dark.name;
  if (selected === "Sy Light") settings.ui.theme = light.name;
}

/**
 * Merges managed defaults into ~/.gemini/settings.json, preserving every
 * existing user-set key. Only keys in GEMINI_MANAGED_SETTINGS that are
 * missing from the user's settings.json are filled in — anything already
 * present (selectedAuthType, theme, model.*, etc.) is left exactly as the
 * user left it. `mcpServers` is handled separately by `deploySharedMcpServers` — an
 * additive merge from the shared registry; user-added server names that
 * aren't in the registry survive untouched.
 *
 * @param {string} targetDir - Path to the ~/.gemini directory.
 */
async function _doGeminiSettingsWork(targetDir) {
  const targetPath = path.join(targetDir, "settings.json");

  log(">> Gemini CLI Settings:", targetPath);

  /** @type {object} Existing user settings (empty object if file missing or invalid). */
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(targetPath, "utf-8")) || {};
  } catch (e) {}

  // Merge: managed settings are applied as defaults; existing user values win
  // at every depth. Uses _deepMerge (target=cloned managed, source=existing)
  // because some managed keys are nested (general.*, privacy.*,
  // context.fileFiltering.*) — a shallow spread would let the user's top-level
  // `general` block clobber our default `general.enableAutoUpdate` /
  // `general.sessionRetention`. Deep merge fills in missing leaves at every
  // nesting level while preserving every existing user-set leaf.
  const merged = _deepMerge(clone(GEMINI_MANAGED_SETTINGS), existing);
  await _doGeminiThemeWork(merged);

  mergeLLMHookEntry(merged, "BeforeAgent", {
    matcher: "*",
    hooks: [
      {
        name: "sy-persona-reminder",
        type: "command",
        command: `"${process.execPath}" "${LLM_PERSONA_HOOK_HELPER_PATH}" gemini "${LLM_PERSONA_REMINDER}"`,
        timeout: 1000,
      },
    ],
  });

  await backupConfigFile(targetPath);
  await writeJson(targetPath, merged);
}

/**
 * Deploys the shared engineering principles into ~/.gemini/GEMINI.md between
 * BEGIN/END markers. The markdown source uses backticks for inline code;
 * readText returns file content verbatim (only the path argument is a
 * template literal), and the content flows into replaceBlock as a plain
 * string — no re-templating, so backticks are safe here.
 *
 * Why GEMINI.md (not AGENTS.md): per docs/gemini_cli_readme.md and the
 * upstream Gemini CLI docs, `~/.gemini/GEMINI.md` is the documented global
 * context file (their equivalent of `~/.claude/CLAUDE.md`). The `/memory`
 * slash command and `save_memory` tool both target it. Gemini also reads
 * AGENTS.md at the per-repo level (per GitHub's agents.md spec), but the
 * user-level convention is GEMINI.md.
 *
 * Existing user content outside the marker block is preserved on re-runs.
 *
 * @param {string} targetDir - Path to the ~/.gemini directory.
 */
async function _doGeminiInstructionsWork(targetDir) {
  const targetPath = path.join(targetDir, "GEMINI.md");

  log(">> Gemini CLI Instructions:", targetPath);

  /** @type {string} The markdown source for the managed engineering principles block. */
  const sourceContent = await getLLMCustomInstructions();

  /** @type {string} Existing GEMINI.md content (empty if file is missing). */
  let existing = "";
  try {
    existing = fs.readFileSync(targetPath, "utf-8");
  } catch (e) {}

  // One-time migration: strip the legacy `managed-rules` block so the new descriptive-key
  // upsert below doesn't append a duplicate alongside it. Idempotent — no-op once gone.
  existing = removeBlock(existing, LLM_INSTRUCTIONS_LEGACY_MARKER, "<!--", " -->");
  // Migrate the previous source-path key after moving the active corpus into v_current.
  existing = removeBlock(existing, LLM_INSTRUCTIONS_PREVIOUS_MARKER, "<!--", " -->");

  // Upsert the managed block between BEGIN/END markers keyed by the source-of-truth path.
  // insertMode: "append" creates the block when GEMINI.md is brand new or the markers are missing.
  // Then refresh any user-authored `<!-- BEGIN <label> | <path> -->` block already in the file.
  const merged =
    refreshPathKeyedBlocks(replaceBlock(existing, LLM_INSTRUCTIONS_MARKER, sourceContent, "<!--", " -->", "append")).trim() + "\n";

  await backupConfigFile(targetPath);
  await writeText(targetPath, merged);
}

/**
 * Removes same-name Gemini skills already available through the canonical .agents discovery root.
 * Unlinks duplicate symlinks without following them; backs up real entries outside the scan root.
 * @param {string} targetFolder - Gemini user configuration folder.
 * @returns {number} Count removed from Gemini discovery; canonical and Gemini-only skills remain unchanged.
 * @throws {Error} If discovery roots alias, the Gemini root is a symlink, or filesystem inspection/backup fails.
 */
function _pruneDuplicateGeminiSkills(targetFolder) {
  /** Gemini-specific discovery root; this migration never follows a root symlink. */
  const geminiSkills = path.join(targetFolder, "skills");
  /** Canonical discovery root that must retain every surviving skill. */
  const agentSkills = path.join(path.dirname(targetFolder), ".agents", "skills");
  if (!fs.existsSync(geminiSkills) || !fs.existsSync(agentSkills)) return 0;
  if (fs.lstatSync(geminiSkills).isSymbolicLink()) throw new Error("Gemini skills root must not be a symlink");
  /** Resolved root used to reject canonical references into the folder being cleaned. */
  const realGeminiSkills = fs.realpathSync(geminiSkills);

  /** Lazily created backup keeps real user content outside Gemini discovery. */
  let backupFolder;
  /** Number of duplicates safely removed from Gemini discovery. */
  let removed = 0;
  for (const name of fs.readdirSync(geminiSkills)) {
    /** A same-name canonical file proves the skill remains discoverable. */
    const canonical = path.join(agentSkills, name, "SKILL.md");
    if (!fs.existsSync(canonical) || !fs.statSync(canonical).isFile()) continue;
    // The surviving canonical skill must not depend on a folder this migration removes.
    if (fs.realpathSync(canonical).startsWith(realGeminiSkills + path.sep))
      throw new Error("Canonical skill must not live inside Gemini skills root");
    /** Exact Gemini entry to unlink or move; no recursive deletion is used. */
    const duplicate = path.join(geminiSkills, name);
    if (fs.lstatSync(duplicate).isSymbolicLink()) {
      fs.unlinkSync(duplicate);
    } else {
      if (backupFolder === undefined) backupFolder = fs.mkdtempSync(path.join(targetFolder, "skills-backup-"));
      fs.renameSync(duplicate, path.join(backupFolder, name));
    }
    removed++;
    log(">> Gemini skill duplicate removed from discovery:", name);
  }
  if (backupFolder !== undefined) log(">> Gemini duplicate skill backup:", backupFolder);
  return removed;
}

/**
 * Orchestrates Google Gemini CLI user-level setup: settings, canonical skill migration,
 * native MCP and shared engineering-principles instructions. Skips entirely when the
 * `gemini` binary is not installed.
 * @returns {Promise<void>} Resolves after deployment; MCP validation and IO errors propagate.
 */
async function doWork() {
  if (!(await isBinaryFound("gemini"))) {
    log(">> Skipped Gemini CLI setup: not installed");
    return;
  }

  const targetDir = path.join(BASE_HOMEDIR_LINUX, ".gemini");

  // ensure ~/.gemini exists — gemini/install.sh already creates it, but
  // running setup.js without re-running install.sh shouldn't blow up either.
  await mkdir(targetDir);

  log(">> Configuring Gemini CLI:", targetDir);

  // Validate and preserve MCP before the settings writer reads the same file.
  await deploySharedMcpServers(path.join(targetDir, "settings.json"), {}, "standard", "gemini");
  await _doGeminiSettingsWork(targetDir);
  await _doGeminiKeysWork(targetDir);
  // Shared on-demand instruction files must exist before the always-loaded block
  // that points at them. Safe to run from every CLI — writeText no-ops when unchanged.
  await deploySharedLLMInstructions();
  await _doGeminiInstructionsWork(targetDir);
  // Gemini reads the canonical ~/.agents/skills links directly.
  await deploySharedLLMSkills();
  _pruneDuplicateGeminiSkills(targetDir);

  // Named worker agents. Rendered per CLI from one shared source — see
  // LLM_AGENT_DEPLOY_FOLDERS. Safe to call from every setup script: the bytes are
  // deterministic, so whichever CLI runs first does the work and the rest no-op,
  // and each CLI stays able to repair the shared corpus on its own.
  await deploySharedLLMAgents();
}

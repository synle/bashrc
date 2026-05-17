/** GitHub Copilot CLI setup: settings + user-level AGENTS.md instructions. Run: `bash run.sh --files="copilot/setup.js"` */
// SOURCE software/scripts/advanced/editor.common.js

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
//
//   ❌ Keybindings — Copilot v1.0.48 has NO keymap config (every input chord
//                    is hardcoded in the Mach-O binary; see
//                    docs/editor-keybindings.md → "Copilot CLI configurability
//                    gap"). If GitHub ever ships a config knob, drop a
//                    `copilot-keys.common.jsonc` next to this file and wire a
//                    _doKeysWork() in here mirroring opencode/setup.js.
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
  await _doCopilotInstructionsWork(targetDir);
}

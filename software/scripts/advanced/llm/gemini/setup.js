/** Google Gemini CLI setup: settings + user-level GEMINI.md instructions. Run: `bash run.sh --files="gemini/setup.js"` */
// SOURCE software/scripts/advanced/editor.common.js

// ----------------------------------------------------------------------------
// What this file does and does NOT do
// ----------------------------------------------------------------------------
// Mirrors the structure of software/scripts/advanced/llm/claude/setup.js but
// only for the subset of Gemini CLI's config surface that's actually
// reachable from disk:
//
//   ✅ Settings  — ~/.gemini/settings.json (defaults-merge; never clobbers
//                   auth keys like selectedAuthType, gcpProjectId, or any
//                   mcpServers entries the user has set up)
//   ✅ Instructions — ~/.gemini/GEMINI.md (managed-rules block, mirrors
//                   ~/.claude/CLAUDE.md's pattern; Gemini loads this as the
//                   global context file — see docs/gemini_cli_readme.md)
//
//   ⚠️ Keybindings — Gemini docs reference `~/.gemini/keybindings.json` (see
//                    docs/gemini_cli_readme.md table) but the binary ships
//                    no schema reference, the file doesn't exist by default
//                    after install, and there's no `gemini keybindings ...`
//                    subcommand to introspect the format. Deferred: when
//                    upstream documents the schema (or a `/keybindings` slash
//                    command snapshots a real file we can copy), add a
//                    `gemini-keys.common.jsonc` next to this file and wire a
//                    _doKeysWork() mirroring opencode/setup.js.
//
//   ❌ User-level slash commands — Gemini has no `~/.gemini/commands/*.md`
//                    fallthrough. Its equivalent is the extension system
//                    (`gemini extensions install <source>` /
//                    `gemini extensions link <local-path>`) which requires a
//                    full extension manifest. Mirroring Claude's
//                    `~/.claude/commands/sy-*.md` as a Gemini extension would
//                    mean generating that scaffolding — out of scope.
//
//   ❌ Skills — Gemini exposes `gemini skills install/link` for agent skills.
//                    Same reasoning as commands: out of scope (user-owned).

////// Settings //////

/**
 * Managed default settings to seed into ~/.gemini/settings.json. The merge
 * order is `{ ...GEMINI_MANAGED_SETTINGS, ...existing }` so any key the user
 * has already set in settings.json wins — these only fill in MISSING keys.
 *
 * Auth-shaped keys (`selectedAuthType`, `gcpProjectId`, etc.) and
 * user-managed shape (`mcpServers`, `theme`, `model.*` overrides) are
 * deliberately omitted so they survive untouched across re-runs.
 *
 * @type {Record<string, any>}
 */
const GEMINI_MANAGED_SETTINGS = {
  // skip the splash screen / animations on every launch — same reasoning as
  // copilot's banner=never. tradeoff: never see the splash. risk: none
  hideBanner: true,
  // disable terminal-bell when user attention is required. tradeoff: no
  // audio nudge. risk: low (matches our copilot+claude convention)
  hideTips: true,
};

/**
 * Merges managed defaults into ~/.gemini/settings.json, preserving every
 * existing user-set key. Only keys in GEMINI_MANAGED_SETTINGS that are
 * missing from the user's settings.json are filled in — anything already
 * present (selectedAuthType, mcpServers, theme, model.*, etc.) is left
 * exactly as the user / `gemini mcp add` / etc. left it.
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

  // merge: managed settings are applied as defaults, existing user overrides are preserved
  const merged = { ...GEMINI_MANAGED_SETTINGS, ...existing };

  await backupConfigFile(targetPath);
  await writeJson(targetPath, merged);
}

////// Instructions (User-Level GEMINI.md) //////

/**
 * Marker key used to wrap the managed engineering principles block inside
 * ~/.gemini/GEMINI.md. Anything outside the BEGIN/END markers is preserved
 * as user-owned content (matches the claude/setup.js + copilot/setup.js
 * convention).
 * @type {string}
 */
const GEMINI_INSTRUCTIONS_MARKER = "managed-rules";

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
  const sourceContent = (await readText`software/scripts/advanced/llm/_common/instructions.md`).trim();

  /** @type {string} Existing GEMINI.md content (empty if file is missing). */
  let existing = "";
  try {
    existing = fs.readFileSync(targetPath, "utf-8");
  } catch (e) {}

  // Upsert the managed block between <!-- BEGIN managed-rules --> / <!-- END managed-rules -->.
  // insertMode: "append" creates the block when GEMINI.md is brand new or the markers are missing.
  const merged = replaceBlock(existing, GEMINI_INSTRUCTIONS_MARKER, sourceContent, "<!--", " -->", "append").trim() + "\n";

  await backupConfigFile(targetPath);
  await writeText(targetPath, merged);
}

////// Main Entry Point //////

/**
 * Orchestrates Google Gemini CLI user-level setup: settings defaults +
 * shared engineering-principles instructions block. Skips entirely when the
 * `gemini` binary is not installed.
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

  await _doGeminiSettingsWork(targetDir);
  await _doGeminiInstructionsWork(targetDir);
}

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
//   ❌ Skills — Gemini exposes `gemini skills install/link` for agent skills.
//                    Same reasoning as commands: out of scope (user-owned).

////// Keybindings //////

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
  await _doGeminiKeysWork(targetDir);
  await _doGeminiInstructionsWork(targetDir);
}

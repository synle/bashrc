/** GitHub Copilot CLI setup: settings + user-level copilot-instructions.md instructions. Run: `bash run.sh --files="copilot/setup.js"` */
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
//   ✅ Instructions — ~/.copilot/copilot-instructions.md (managed block keyed by
//                   source path, mirrors ~/.claude/CLAUDE.md's pattern; Copilot
//                   CLI loads copilot-instructions.md user-level — verified by
//                   running `copilot -p ... AGENTS marker` and asking it to list
//                   its custom instruction file paths; it confirmed
//                   `~/.copilot/copilot-instructions.md` as the user-level
//                   fallback alongside cwd `./AGENTS.md` and
//                   `.github/copilot-instructions.md`). A symlink
//                   `~/.copilot/AGENTS.md` -> `copilot-instructions.md` is
//                   created so copilot also finds the file via the AGENTS.md
//                   path. The managed block is **prepended** (not appended)
//                   so the persona directive is the first thing the model
//                   reads — matching Claude and opencode. LinkedIn's Captain
//                   corporate tooling may re-prepend its own block above ours
//                   on its next run (out of our control).
//   ✅ Harness tweaks — ~/.copilot/instructions/copilot-tweaks.instructions.md,
//                   the ONE home for rules true of Copilot CLI and no other
//                   harness (the background-job concurrency cap lives there —
//                   the number itself is deliberately not repeated here).
//                   Deliberately NOT routed through
//                   LLM_SHARED_INSTRUCTION_FILES: that registry deploys to
//                   ~/sy_llm_ai/instructions/ and is read by opencode and
//                   linked into other CLIs, so a Copilot-only limit put there
//                   would leak onto harnesses that do not have it. Written as
//                   a REAL file (not a symlink) into the same folder the
//                   shared links land in — the shared prune only removes
//                   symlinks resolving into the shared folder, so this file is
//                   untouched by it. Copilot globs
//                   `~/.copilot/instructions/**\/*.instructions.md`, hence the
//                   suffix. See _doCopilotTweaksWork() below.
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
//   ✅ Skills — ~/.copilot/skills/sy-<name> is a SYMLINK to the one physical
//                    skill at ~/sy_llm_ai/skills/sy-<name>/SKILL.md, created by
//                    the shared deploySharedLLMSkills() in llm-common.js.
//                    Copilot has no `~/.copilot/commands/*.md` fallthrough the
//                    way Claude does, and it does NOT read `~/.claude/commands/`
//                    or `~/.claude/skills/` (verified v1.0.78 — a probe in
//                    either never appears in `copilot skill list`). Its
//                    personal-skill path IS read, so the link lands there and
//                    every CLI runs the identical body — one file, no copies.
//                    Per-repo `.github/copilot-instructions.md` is already
//                    handled at the wrapper layer in copilot.profile.bash.
//
//   ⚠️ Plugins — `~/.copilot/settings.json` → `enabledPlugins` and
//                    `extraKnownMarketplaces` are owned by the user (or by the
//                    Captain `install-plugin-to-copilot` skill if the user
//                    opts in). This script intentionally leaves them untouched.
//
//   ✅ MCP servers — `~/.copilot/mcp-config.json` → `mcpServers` is additively
//                    merged from the shared `_common/mcp-servers.jsonc` registry
//                    so the same MCP server list lands in every CLI. User-added
//                    entries (names not in the registry) are preserved untouched.

// --- Keybindings ---

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

// --- Settings ---

/**
 * Managed default settings to seed into ~/.copilot/settings.json. The merge
 * order is `{ ...COPILOT_MANAGED_SETTINGS, ...existing }` so any key the user
 * has already set in settings.json wins — these only fill in MISSING keys.
 * Anything plugin-shaped (enabledPlugins, extraKnownMarketplaces) or
 * auth-shaped (firstLaunchAt) is deliberately omitted so it
 * survives untouched across re-runs. `allowedUrls` is the exception to the
 * whole-key merge — see COPILOT_MANAGED_ALLOWED_URLS, which is unioned in.
 *
 * Sourced from `copilot help config` (v1.0.48) — only safe-to-default keys
 * land here.
 *
 * When adding a new managed setting, also update the settings-intent table in
 * `software/scripts/advanced/llm/llm.md` so cross-CLI parity stays
 * visible at review time (intent must be implemented in claude/gemini/opencode
 * too, or explicitly marked n/a there).
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
  // show pasted content inline instead of collapsing into a compact token —
  // intentional deviation from upstream default (true). full pastes are easier
  // to review when the agent is reading multi-line context. tradeoff: input
  // field wraps on very large pastes. risk: low
  compactPaste: false,
  // render markdown in the terminal — matches upstream default; pinned for
  // the same reason as compactPaste. tradeoff: none. risk: none
  renderMarkdown: true,
  // show intent in terminal tab title — disabled because tmux/screen users
  // get flicker from rapid title updates during agent loops. tradeoff: lose
  // context peek in tab bar. risk: low
  updateTerminalTitle: false,
  // do NOT auto-copy selected text to the system clipboard — user handles
  // copy/paste explicitly (Ctrl+C / right-click) and doesn't want selections
  // made for visual reference to silently overwrite the clipboard. Overrides
  // upstream's mac default (true). Linux X11 primary selection is updated on
  // selection regardless of this setting, so middle-click paste still works.
  // tradeoff: must press Ctrl+C / right-click to copy. risk: none.
  copyOnSelect: false,
  // auto-switch to auto mode when rate-limited — keeps long-running agent
  // tasks going without manual intervention. tradeoff: agent may proceed
  // autonomously after a rate-limit blip. risk: low
  continueOnAutoMode: true,
  // max reasoning effort — uses more compute for harder tasks. tradeoff:
  // slower responses, higher token usage. risk: low
  effortLevel: "xhigh",
  // exclude gitignored files from the @ file mention picker — matches
  // upstream default; pinned for the same reason as compactPaste.
  // tradeoff: none. risk: none
  respectGitignore: true,
  // emit terminal progress indicators while agent is working — matches
  // upstream default; pinned for parity. tradeoff: none. risk: none
  terminalProgress: true,
  // default conflict resolution strategy for `/pr fix conflicts` — merge
  // instead of rebase to preserve explicit merge commits and avoid
  // rewriting history. tradeoff: merge commits in log. risk: low
  mergeStrategy: "merge",
  // Disable in-session auto-update prompt. We refresh copilot out-of-band via
  // gh.io/copilot-install (copilot/install.sh) on the next dotfiles bootstrap.
  // Matches opencode's autoupdate:false (opencode/setup.js:119) and the
  // gemini general.enableAutoUpdate:false so all four LLM CLIs update on the
  // same cadence — when `bash run.sh` runs, not mid-session. tradeoff: must
  // re-run installer to pick up new copilot versions. risk: low.
  autoUpdate: false,
  // Keep the `Co-authored-by: Copilot <copilot@github.com>` trailer on git
  // commits copilot makes on the user's behalf. Matches upstream default
  // (true) but pinned for explicit intent. Per the engineering-principles
  // gotcha in software/scripts/advanced/llm/_common/instructions.md (and
  // the deployed ~/.claude/CLAUDE.md / ~/.copilot/copilot-instructions.md /
  // ~/.gemini/GEMINI.md / ~/.config/opencode/AGENTS.md), Co-Authored-By
  // trailers for supported LLM CLIs are INTENTIONAL provenance and must
  // survive author-identity fixups. The global commit-author check
  // (`--reset-author`) targets only the author header, not the trailer.
  // tradeoff: none — exception explicitly carved out in rule §2. risk: none.
  includeCoAuthoredBy: true,
  // Desktop notification when the agent needs attention or finishes a long run.
  // Upstream default is OFF (the bundled app.js gates it on `notifications === true`),
  // and `beep: false` above kills the only other cue — so without this a long
  // `effortLevel: "xhigh"` run finishes silently in a background tab. Restores
  // parity with opencode's `attention.notifications: true` (opencode/setup.js).
  // tradeoff: an OS notification per attention event. risk: none.
  notifications: true,
  // Print per-tool wall-clock durations in the transcript. Real key (read as
  // `showToolDurations !== false` in the bundle, so upstream default is already
  // on) — pinned for explicit intent, and it is what makes a slow shell command
  // distinguishable from a stalled model at `xhigh` effort. tradeoff: slightly
  // busier transcript. risk: none.
  showToolDurations: true,
  // Log warnings and errors only. `"all"` is a debugging level: it grows
  // ~/.copilot/logs/ and the session store without bound (observed 51 MB
  // session-store.db + 55 log folders on a normal dev machine) for output
  // nobody reads outside an active bug hunt. Raise it back to "all" by hand
  // for a debugging session. tradeoff: less post-hoc detail. risk: low.
  logLevel: "warning",
  // Adversarial planning agent. `rubberDuck` makes `/rubber-duck` available to
  // argue against a plan before it is executed — worth having for architecture,
  // workflow, and migration design, where the expensive mistake is committed
  // before any code runs. `rubberDuckAutoInvoke` stays OFF deliberately: firing
  // a critique pass on every plan taxes the trivial ones and trains you to skip
  // reading it, which costs exactly the attention the agent exists to buy.
  // Invoke it on purpose instead. tradeoff: must remember to call it. risk: none.
  builtInAgents: {
    rubberDuck: true,
    rubberDuckAutoInvoke: false,
  },
};

/**
 * Hosts pre-approved for fetching without a per-URL prompt, merged INTO whatever
 * `allowedUrls` the user already has rather than replacing it.
 *
 * `allowedUrls` is an allow list, not a restriction: an entry means "fetch this
 * without asking", and everything absent still prompts. So the cost of a wrong
 * entry is a silent fetch, and the cost of a missing one is a single prompt —
 * which is why this list stays SHORT and generic. Only hosts an agent hits
 * constantly while reading public documentation belong here; anything
 * org-internal, auth-bearing, or occasional is left to the prompt on purpose.
 * @type {string[]}
 */
const COPILOT_MANAGED_ALLOWED_URLS = [
  "https://github.com",
  "https://raw.githubusercontent.com",
  "https://registry.npmjs.org",
  "https://www.npmjs.com",
  "https://stackoverflow.com",
];

/**
 * Merges managed defaults into ~/.copilot/settings.json, preserving every
 * existing user-set key. Only keys in COPILOT_MANAGED_SETTINGS that are
 * missing from the user's settings.json are filled in — anything already
 * present (model, enabledPlugins, extraKnownMarketplaces, etc.)
 * is left exactly as the user / `copilot plugin install` left it.
 *
 * Two keys get richer treatment than the spread: `builtInAgents` merges per
 * subkey, and `allowedUrls` is unioned with COPILOT_MANAGED_ALLOWED_URLS so a
 * user-approved host never displaces the managed ones (or vice versa).
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

  // `builtInAgents` is the one nested managed key, and a plain spread would let a
  // user object holding ONE subkey drop the other. Fill in per subkey instead, so
  // enabling `rubberDuck` by hand can't silently un-manage `rubberDuckAutoInvoke`.
  merged.builtInAgents = { ...COPILOT_MANAGED_SETTINGS.builtInAgents, ...(existing.builtInAgents || {}) };

  // `allowedUrls` is additive, not defaulted: the spread above would drop every
  // managed host the moment the user approves a single URL of their own. Union
  // instead, existing entries first so the user's order is preserved, de-duped.
  merged.allowedUrls = [...new Set([...(existing.allowedUrls || []), ...COPILOT_MANAGED_ALLOWED_URLS])];

  await backupConfigFile(targetPath);
  await writeJson(targetPath, merged);
}

// --- MCP Servers ---

/**
 * Additively merges every entry from the shared MCP registry into
 * `~/.copilot/mcp-config.json::mcpServers`. Copilot CLI reads MCP config from
 * `~/.copilot/mcp-config.json` (separate file from `settings.json`, per the
 * `mcp-config.json` reference in the existing "Plugins / MCP" comment above).
 * Semantics:
 *
 *   - Names listed in `_common/mcp-servers.jsonc` get our value (file wins).
 *   - Names ONLY in the on-disk mcp-config.json — added by hand or via
 *     `copilot mcp add` — are preserved untouched.
 *   - Removing a name from the registry does NOT remove it from mcp-config.json
 *     (additive overlay only; documented in the registry header).
 *
 * @param {string} targetDir - Path to the `~/.copilot` directory.
 */
async function _doMcpWork(targetDir) {
  const targetPath = path.join(targetDir, "mcp-config.json");

  log(">> GitHub Copilot CLI MCP Servers:", targetPath);

  /** @type {Record<string, any>} */
  const sharedServers = await loadSharedMcpServers();
  if (Object.keys(sharedServers).length === 0) {
    log("   No managed MCP entries — skipping");
    return;
  }

  /** @type {object} Existing config — empty object on missing / invalid file. */
  let existing = {};
  if (fs.existsSync(targetPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(targetPath, "utf-8")) || {};
    } catch (e) {
      // Never silent: an unparseable file here means every hand-added server in it is
      // about to be dropped from the merge and overwritten. A trailing comma is the
      // common cause (JSON has none) and it also means copilot itself has been failing
      // to load those servers. Say so loudly; backupConfigFile below keeps .bak_latest
      // so the original is recoverable.
      log(`>> copilot: mcp-config.json is not valid JSON (${e.message})`);
      log(`>> copilot: any hand-added servers in it are NOT loading — repair ${targetPath}`);
    }
  }

  /** @type {Record<string, any>} */
  const existingServers = existing.mcpServers && typeof existing.mcpServers === "object" ? existing.mcpServers : {};
  /** @type {Record<string, any>} Existing names first so shared entries override on collision. */
  const merged = { ...existingServers, ...sharedServers };

  existing.mcpServers = merged;
  await backupConfigFile(targetPath);
  await writeJson(targetPath, existing);
}

// --- Instructions (User-Level copilot-instructions.md) ---

/**
 * Deploys the shared engineering principles into ~/.copilot/copilot-instructions.md
 * between BEGIN/END markers, then symlinks ~/.copilot/AGENTS.md -> copilot-instructions.md
 * so copilot also finds the file via the AGENTS.md path.
 *
 * The markdown source uses backticks for inline code; readText returns file
 * content verbatim (only the path argument is a template literal), and the
 * content flows into replaceBlock as a plain string — no re-templating, so
 * backticks are safe here.
 *
 * Existing user content outside the marker block is preserved on re-runs.
 *
 * @param {string} targetDir - Path to the ~/.copilot directory.
 */
async function _doCopilotInstructionsWork(targetDir) {
  /** @type {string} Primary target — the managed instructions file. */
  const targetPath = path.join(targetDir, "copilot-instructions.md");
  /** @type {string} Symlink so copilot also discovers the file via the AGENTS.md path. */
  const agentsLink = path.join(targetDir, "AGENTS.md");

  log(">> GitHub Copilot CLI Instructions:", targetPath);

  /** @type {string} The markdown source for the managed engineering principles block. */
  const sourceContent = await getLLMCustomInstructions();

  /** @type {string} Existing copilot-instructions.md content (empty if file is missing). */
  let existing = "";
  try {
    existing = fs.readFileSync(targetPath, "utf-8");
  } catch (e) {}

  // One-time migration: strip the legacy `managed-rules` block so the new descriptive-key
  // upsert below doesn't append a duplicate alongside it. Idempotent — no-op once gone.
  existing = removeBlock(existing, LLM_INSTRUCTIONS_LEGACY_MARKER, "<!--", " -->");

  // One-time reposition: if the managed block exists but isn't at the very top,
  // remove it so the prepend below re-lands it first — above the LinkedIn Captain
  // corporate preamble. No-op once the block is already leading the file.
  const beginMarker = `<!-- BEGIN ${LLM_INSTRUCTIONS_MARKER} -->`;
  if (existing.includes(beginMarker) && !existing.trimStart().startsWith(beginMarker)) {
    existing = removeBlock(existing, LLM_INSTRUCTIONS_MARKER, "<!--", " -->");
  }

  // Upsert the managed block between BEGIN/END markers keyed by the source-of-truth path.
  // insertMode: "prepend" creates the block at the top when copilot-instructions.md is
  // brand new or the markers are missing — so the persona directive is the first thing
  // the model reads, matching Claude and opencode.
  const merged = replaceBlock(existing, LLM_INSTRUCTIONS_MARKER, sourceContent, "<!--", " -->", "prepend").trim() + "\n";

  await backupConfigFile(targetPath);
  await writeText(targetPath, merged);

  // Ensure ~/.copilot/AGENTS.md symlinks to copilot-instructions.md.
  // If AGENTS.md is a regular file (leftover from the old setup), remove it first.
  // If it's already the correct symlink, this is a no-op.
  try {
    /** @type {fs.Stats} Lstat to check if AGENTS.md exists and what kind. */
    const agentsStat = fs.lstatSync(agentsLink);
    if (agentsStat.isSymbolicLink()) {
      /** @type {string} Current symlink target. */
      const currentTarget = fs.readlinkSync(agentsLink);
      if (currentTarget === "copilot-instructions.md") return; // already correct
      // Wrong symlink target — remove and re-create.
      fs.unlinkSync(agentsLink);
    } else {
      // Regular file — remove so we can replace with symlink.
      fs.unlinkSync(agentsLink);
    }
  } catch {
    // AGENTS.md doesn't exist — fine, we'll create the symlink below.
  }
  safeSymlink("copilot-instructions.md", agentsLink);
}

// --- Harness tweaks (Copilot-only instruction file) ---

/**
 * Repo source for the Copilot-only harness tweaks, and the basename it lands under.
 *
 * Kept as constants beside each other so the source and its deployed name cannot drift.
 * The `.instructions.md` suffix is load-bearing: Copilot discovers user instructions by
 * globbing `$HOME/.copilot/instructions/ **\/*.instructions.md`, so a plain
 * `copilot-tweaks.md` in that folder is silently ignored.
 * @type {string}
 */
const COPILOT_TWEAKS_SOURCE = "software/scripts/advanced/llm/copilot/instructions-copilot-tweaks.md";

/** @type {string} Deployed basename inside `~/.copilot/instructions/`. */
const COPILOT_TWEAKS_TARGET_NAME = "copilot-tweaks.instructions.md";

/**
 * Deploys the Copilot-only harness tweaks into `~/.copilot/instructions/`.
 *
 * This is the single home for rules true of Copilot CLI and no other harness — today
 * just the background-job concurrency cap, which is why the shared `/sy-*` commands can
 * stay harness-agnostic and name no number.
 *
 * Deliberately NOT an entry in `LLM_SHARED_INSTRUCTION_FILES`: that registry writes to
 * `~/sy_llm_ai/instructions/`, which opencode loads by absolute path and other CLIs link
 * into, so a Copilot-only limit placed there would leak onto harnesses that do not have
 * it — the exact bug this file exists to prevent.
 *
 * Written as a real file into the same folder the shared symlinks land in. That is safe
 * because `pruneStaleSharedLLMInstructions()` only unlinks SYMLINKS whose target resolves
 * inside the shared folder, and never touches regular files.
 *
 * Frontmatter is prepended here rather than stored in the source so the repo file stays
 * readable as plain markdown, matching how skill frontmatter is generated.
 *
 * @param {string} targetDir - Path to the `~/.copilot` directory.
 * @returns {Promise<void>}
 */
async function _doCopilotTweaksWork(targetDir) {
  /** @type {string} Folder Copilot globs for user instruction files. */
  const instructionsDir = path.join(targetDir, "instructions");
  /** @type {string} Absolute path of the deployed tweaks file. */
  const targetPath = path.join(instructionsDir, COPILOT_TWEAKS_TARGET_NAME);

  await mkdir(instructionsDir);

  /** @type {string} Raw markdown body from the repo source of truth. */
  const body = (await readText`${COPILOT_TWEAKS_SOURCE}`).trim();

  if (!body) {
    log(">> Copilot harness tweaks: SKIPPED — empty source", COPILOT_TWEAKS_SOURCE);
    return;
  }

  /** @type {string} Frontmatter + generated marker + body, matching the shared wrapper. */
  const content = [
    "---",
    'applyTo: "**"',
    "---",
    "",
    `<!-- ${getAutoGeneratedText(body.length).trim()} -->`,
    body,
    `<!-- ${getAutoGeneratedEndText(body.length).trim()} -->`,
  ].join("\n");

  await writeText(targetPath, content);

  log(">> Copilot harness tweaks:", targetPath);
}

/**
 * Orchestrates GitHub Copilot CLI user-level setup: settings defaults +
 * shared engineering-principles instructions block + `/sy-*` skills. Skips
 * entirely when the `copilot` binary is not installed (treat as a no-op rather
 * than an error so partial setups don't fail this script).
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
  await _doMcpWork(targetDir);
  await _doCopilotKeysWork(targetDir);
  // Shared on-demand instruction files must exist before the always-loaded block
  // that points at them. Safe to run from every CLI — writeText no-ops when unchanged.
  await deploySharedLLMInstructions();
  await _doCopilotInstructionsWork(targetDir);
  await _doCopilotTweaksWork(targetDir);
  // Skills live once in ~/sy_llm_ai/skills and are symlinked into ~/.copilot/skills
  // by the shared deploy — Copilot reads no other skill path.
  await deploySharedLLMSkills();
}

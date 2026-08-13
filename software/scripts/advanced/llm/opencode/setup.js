/**
 * Configures opencode with both remote and local Ollama providers.
 *
 * NOTE: OpenCode WOULD fall through to `~/.claude/CLAUDE.md` automatically when
 * `~/.config/opencode/AGENTS.md` is absent (per https://opencode.ai/docs/rules/),
 * but we deploy our OWN copy of `_common/instructions.md` to
 * `~/.config/opencode/AGENTS.md` anyway — see `_doOpencodeInstructionsWork`
 * below. Reason: redundancy. If the user later disables claude-code fallback
 * (`OPENCODE_DISABLE_CLAUDE_CODE=1`) or relocates `~/.claude/`, OpenCode still
 * has the engineering-principles block locally. Precedence per OpenCode docs:
 * `~/.config/opencode/AGENTS.md` wins over `~/.claude/CLAUDE.md` if both exist.
 *
 * Slash commands are symlinked from `~/.claude/commands/` in `_syncOpencodeCommandSymlinks`
 * below — single source of truth in `~/.claude/commands/`, no separate copy.
 *
 * Agent skills need NO deploy step for discovery: OpenCode reads
 * `~/.claude/skills/<name>/SKILL.md` and `<repo>/.claude/skills/<name>/SKILL.md`
 * natively (https://opencode.ai/docs/skills/) and exposes them to the model
 * through the built-in `skill` tool. What it does NOT give you is a user-facing
 * `/skill-name` slash command — there is no `/skill` picker in the TUI at all.
 * `_syncOpencodeSkillCommandSymlinks` below closes that gap by symlinking each
 * global SKILL.md into the opencode commands slot, so one file serves both
 * surfaces: model-invoked via `skill({name})` AND user-invoked via `/name`.
 */

// SOURCE software/scripts/advanced/llm/llm-common.js

// --- Limit buckets ---

/**
 * Large context/output limit.
 * @type {{ context: number, output: number }}
 */
const LIMIT_LARGE = { context: 65536, output: 8192 };

/**
 * Medium context/output limit — default for most local code models.
 * @type {{ context: number, output: number }}
 */
const LIMIT_MEDIUM = { context: 32768, output: 4096 };

/**
 * Small context/output limit for small local models.
 * @type {{ context: number, output: number }}
 */
const LIMIT_SMALL = { context: 16384, output: 4096 };

// --- Known Ollama model configs ---
/**
 * Per-model configs for known Ollama models. Keyed by full model tag exactly as returned
 * by `/api/tags`. A tag not listed here falls through to `OLLAMA_DEFAULT_CONFIG`, so this
 * map only needs entries whose limits differ from that default.
 *
 * Keys MUST be tags the daemon can actually pull — verify against the DAEMON, not the
 * website. `ollama.com/library` lists `-nvfp4` tags that the registry then refuses with
 * `412: this model requires macOS`, so a website listing is not proof:
 *   curl -fsS "http://<host>:11434/api/pull" -d '{"model":"<tag>"}'
 * A typo'd or unpullable key is silently inert (it just never matches), which is why a
 * bogus entry can sit here indefinitely looking like configuration.
 *
 * The `-base` autocomplete tags mirror `AUTOCOMPLETE_MODELS` in `llm-common.js`; the
 * chat/instruct tags are the agent-side models. See docs/local-llm-runtimes.md for which
 * of these are the current sy-omen45l picks.
 * @type {Record<string, { limit: { context: number, output: number } }>}
 */
const OLLAMA_MODEL_CONFIGS = {
  // Editor autocomplete (FIM `-base` checkpoints — keep in sync with AUTOCOMPLETE_MODELS).
  "qwen2.5-coder:1.5b-base": { limit: LIMIT_SMALL },
  "qwen2.5-coder:3b-base": { limit: LIMIT_SMALL },
  "qwen2.5-coder:7b-base": { limit: LIMIT_SMALL },

  // Coding / agent models.
  "qwen2.5-coder:14b": { limit: LIMIT_MEDIUM },
  "qwen3-coder:30b": { limit: LIMIT_MEDIUM },
  "qwen3-coder:30b-a3b-q4_K_M": { limit: LIMIT_LARGE },
  "qwen3.6:latest": { limit: LIMIT_LARGE },
  "qwen3.6:27b-q4_K_M": { limit: LIMIT_LARGE },
  "qwen3.6:35b-a3b-q4_K_M": { limit: LIMIT_LARGE },
  "qwen3.6:35b-a3b-mtp-q4_K_M": { limit: LIMIT_LARGE },

  // General / vision.
  "gemma4:12b-it-q4_K_M": { limit: LIMIT_LARGE },
  "gemma4:26b": { limit: LIMIT_LARGE },
};

/**
 * Per-model configs for known GitHub Copilot models. Keyed by model ID.
 *
 * NO `limit` overrides here, deliberately. `limit.context` is not a token budget —
 * opencode uses it to decide when to compact, so capping a 1M-window model at 64k
 * fires compaction ~16x more often than needed, and each compaction is a silent LLM
 * call that reads as a hang. opencode already knows the real windows from its own
 * model registry (`~/.cache/opencode/models.json`), so these entries carry only the
 * friendly TUI label (filled in by the auto-name loop below).
 * @type {Record<string, object>}
 */
const COPILOT_MODEL_CONFIGS = {
  "claude-opus-4.7": {},
  "claude-opus-4.8": {},
  "gpt-5.5": {},
  "gpt-5.6-sol": {},
  "gpt-5.6-terra": {},
};

/**
 * Stream timeouts, in milliseconds, applied to every provider's `options`. Without
 * these a dead SSE stream waits forever, which is indistinguishable from a hang;
 * with them the request aborts and `opencode-auto-continue` can retry. 3 minutes is
 * loose enough for a cold Ollama model load over LAN.
 * @type {{ chunkTimeout: number, headerTimeout: number }}
 */
const PROVIDER_STREAM_TIMEOUTS = { chunkTimeout: 180000, headerTimeout: 60000 };

/**
 * Model used for cheap side tasks (session titles, summaries, compaction). Keeping
 * these off the primary model avoids paying Opus latency for bookkeeping calls.
 * @type {string}
 */
const OPENCODE_SMALL_MODEL = "github-copilot/gpt-5.5";

/**
 * Default config for any Ollama model not listed in `OLLAMA_MODEL_CONFIGS`.
 * @type {{ limit: { context: number, output: number } }}
 */
const OLLAMA_DEFAULT_CONFIG = { limit: LIMIT_MEDIUM };

/**
 * Builds the opencode config object dynamically from an array of providers.
 * @param {Array<{id: string, name: string, baseURL: string, models: Array<{name: string}>}>} providersArray - Simplified input schemas.
 * @param {Record<string, any>} [mcpServersOpencodeShape={}] - Map of MCP server name → opencode-native config (already translated from the standard shape via `translateMcpServersForOpencode`). Pass `{}` (or omit) when the shared registry is empty so opencode falls back to whatever the user has under `mcp` in `opencode.json`.
 * @returns {object} The full opencode.json content.
 */
function _buildOpencodeConfig(providersArray, mcpServersOpencodeShape = {}) {
  const providers = {};

  for (const item of providersArray) {
    // Enrich each model with limit from the known config map.
    const modelsObject = Object.fromEntries(
      item.models.map((m) => {
        let cfg = OLLAMA_MODEL_CONFIGS[m.name] || OLLAMA_DEFAULT_CONFIG;
        return [m.name, { limit: cfg.limit }];
      }),
    );

    providers[item.id] = {
      npm: "@ai-sdk/openai-compatible",
      name: item.name,
      options: {
        baseURL: item.baseURL,
        ...PROVIDER_STREAM_TIMEOUTS,
      },
      models: modelsObject,
    };
  }

  // GitHub Copilot provider: friendly TUI labels only ("github-copilot / <model>"),
  // filled in by the auto-name loop below. Context/output limits are deliberately
  // left to opencode's own model registry — see COPILOT_MODEL_CONFIGS.
  providers["github-copilot"] = {
    options: { ...PROVIDER_STREAM_TIMEOUTS },
    models: COPILOT_MODEL_CONFIGS,
  };

  // Auto-name every model: "<provider_key> / <model_key>" so the model picker in TUI
  // shows a human-readable label instead of bare IDs.
  for (const [providerId, providerCfg] of Object.entries(providers)) {
    if (!providerCfg.models) continue;
    for (const modelKey of Object.keys(providerCfg.models)) {
      if (!providerCfg.models[modelKey].name) {
        providerCfg.models[modelKey].name = `${providerId} / ${modelKey}`;
      }
    }
  }

  /** @type {Record<string, any>} */
  const out = {
    $schema: "https://opencode.ai/config.json",
    // Disable opencode's startup auto-update prompt. The "Update Available …
    // Skip / Confirm" modal is a distraction; we update opencode out-of-band
    // (homebrew / installer). Documented at https://opencode.ai/docs/config/.
    autoupdate: false,
    // Allow all tools, paths, and URLs without prompting — matches the
    // `--allow-dangerously-skip-permissions` (Claude) / `--allow-all` (Copilot)
    // convention used across the other AI CLI configs in this repo. The bare
    // string is the documented "allow everything" form; the object shape keys on
    // real tool names (read, edit, bash, …), so `{"*": "allow"}` was a no-op that
    // silently left the defaults in place.
    permission: "allow",
    // Compaction stays on with opencode's default tail_turns. An explicit low
    // value (we used to pin 4) throws away almost everything on each compaction,
    // so the model re-reads the same files, refills the window, and compacts
    // again — a death spiral that reads as a mid-task freeze.
    compaction: {
      auto: true,
    },
    // Allow more tool output lines before truncation (default: 2000) so the
    // agent sees fuller command output before falling back to the saved-to-disk
    // preview. `max_bytes` is the real guard: 3000 lines of minified JS is
    // multi-MB of context. tradeoff: more tokens consumed by verbose tools.
    tool_output: {
      max_lines: 3000,
      max_bytes: 262144,
    },
    // Cheap side tasks (titles, summaries, compaction) run here instead of on the
    // primary model, where compaction latency shows up as an unexplained pause.
    small_model: OPENCODE_SMALL_MODEL,
    // Enable opencode's experimental batch tool so the agent can fan out
    // parallel tool calls within a single turn (read three files at once,
    // run two greps concurrently, etc.) instead of serializing them. Matches
    // the parallelization rule in CLAUDE.md §37 ("independent changes → one
    // message, multiple sub-agent calls") that's already native in Claude
    // Code. Gated behind `experimental` because upstream may rename / restage
    // the flag — re-check `https://opencode.ai/config.json` if a future run
    // logs an unknown-key warning. tradeoff: experimental schema, may move.
    // risk: low — opencode ignores unknown experimental keys silently.
    experimental: {
      batch_tool: true,
    },
    plugin: ["opencode-auto-continue"],
    provider: providers,
  };

  // Only write the `mcp` key when we actually have managed entries — leaving
  // the key absent lets opencode keep whatever the user maintains under `mcp`
  // in their own opencode.json. Once a registry entry is added, opencode.json
  // gets the translated shape written verbatim on each setup run.
  if (mcpServersOpencodeShape && Object.keys(mcpServersOpencodeShape).length > 0) {
    out.mcp = mcpServersOpencodeShape;
  }

  return out;
}

/**
 * Writes ~/.config/opencode/tui.json with managed TUI defaults + keybinds.
 * Keybinds belong in tui.json (the TUI config), not in opencode.json (the
 * provider/config schema at https://opencode.ai/config.json which has no
 * keybinds field). Schema: https://opencode.ai/tui.json.
 *
 * Managed fields written here (overwrite on every run):
 *   mouse, scroll_speed, scroll_acceleration, attention, keybinds.
 *
 * Strips invalid legacy top-level fields (`title`, `animations`) that crept
 * into earlier versions but are not valid in the tui.json schema. All other
 * existing keys are preserved.
 */
async function _writeOpencodeTuiConfig() {
  const tuiPath = path.join(BASE_HOMEDIR_LINUX, ".config/opencode/tui.json");
  /** @type {Record<string, any>} */
  const existing = (await readJson`${tuiPath}`) || {};
  // Strip invalid legacy top-level fields not in the tui.json schema
  delete existing.title;
  delete existing.animations;
  /** @type {Record<string, any>} */
  const keybinds = await _loadOpencodeKeybinds();
  /** @type {Record<string, any>} */
  const out = {
    $schema: "https://opencode.ai/tui.json",
    ...existing,
    mouse: true,
    // Force single-column stacked diff rendering instead of the default "auto"
    // (which flips to side-by-side on wide terminals). Stacked diffs read
    // cleanly in tmux splits, VS Code's integrated terminal pane, and any
    // half-width terminal where side-by-side cramming truncates both columns.
    // Trade for full-width terminals: lose the simultaneous before/after view.
    // tradeoff: less info density on wide screens. risk: none.
    diff_style: "stacked",
    scroll_speed: 3,
    scroll_acceleration: {
      enabled: true,
    },
    // Attention block: visual + OS-notification still on; audio chime OFF
    // because parallel-session workflows (e.g. running claude / copilot /
    // gemini / opencode side-by-side via `bash run.sh --preset=llm`) make
    // overlapping audio cues unhelpful. enabled:true keeps the visual flash;
    // notifications:true keeps OS desktop notifications (silent unless the
    // OS notification center adds its own sound). sound:false suppresses
    // opencode's in-app chime. volume is moot when sound is off but kept at
    // 0.4 so flipping sound:true later doesn't blast at 100%.
    attention: {
      enabled: true,
      notifications: true,
      sound: false,
      volume: 0.4,
    },
  };
  if (keybinds && Object.keys(keybinds).length > 0) {
    out.keybinds = keybinds;
  }
  await writeJson(tuiPath, out);
  log(">> opencode tui.json written:", tuiPath);
}

/**
 * Loads opencode-keys.common.jsonc and returns the keybinds map as-is.
 * All chords use "super" directly (opencode's cross-platform term for the
 * primary OS modifier — Cmd on macOS, Super/Windows key on Linux), so no
 * OS-specific substitution is needed.
 *
 * @param {boolean} [_isOsMac] - Ignored; kept for backward compat with tests.
 * @returns {Promise<Record<string, any>>} Resolved keybinds map (empty object if file missing).
 */
async function _loadOpencodeKeybinds(_isOsMac) {
  /** @type {{ keybinds?: Record<string, any> } | null} */
  const raw = await readJson`software/scripts/advanced/llm/opencode/opencode-keys.common.jsonc`;
  if (!raw || !raw.keybinds) return {};
  return { ...raw.keybinds };
}

/**
 * Absolute path to the opencode global slash-command folder. Every `<name>.md`
 * in here becomes a `/<name>` command in the TUI.
 * @returns {string} `~/.config/opencode/commands`
 */
function _getOpencodeCommandsDir() {
  return path.join(BASE_HOMEDIR_LINUX, ".config", "opencode", "commands");
}

/**
 * Shared cleanup+deploy engine behind both `_syncOpencodeCommandSymlinks` and
 * `_syncOpencodeSkillCommandSymlinks`.
 *
 * Cleanup pass unlinks only symlinks whose resolved target lives under `ownedRoot`,
 * so the two callers never stomp each other's links and user-authored entries are
 * always left alone. Deploy pass then creates one symlink per requested pair,
 * skipping any destination that already exists (foreign file, user-authored
 * command, or a name collision with an earlier caller — first writer wins).
 *
 * @param {string} ownedRoot - Absolute path whose descendants this call is allowed to unlink (e.g. `~/.claude/commands`).
 * @param {Array<{ sourcePath: string, destName: string }>} pairs - Link sources plus their `<name>.md` destination filenames.
 * @param {string} label - Human-readable source label used in the summary log line.
 * @returns {Promise<void>}
 */
async function _syncOpencodeSymlinkedCommands(ownedRoot, pairs, label) {
  /** @type {string} Destination folder for every generated `/name` command. */
  const opencodeCommandsDir = _getOpencodeCommandsDir();
  await mkdir(opencodeCommandsDir);

  // Cleanup pass — unlink owned symlinks resolving under `ownedRoot`.
  for (const entry of fs.readdirSync(opencodeCommandsDir)) {
    /** @type {string} Absolute path to the existing entry under inspection. */
    const fullPath = path.join(opencodeCommandsDir, entry);
    /** @type {fs.Stats|undefined} Lstat of the entry; undefined when it vanished mid-scan. */
    let stat;
    try {
      stat = fs.lstatSync(fullPath);
    } catch {
      continue;
    }
    if (!stat.isSymbolicLink()) continue;
    /** @type {string|undefined} Raw link target as stored on disk. */
    let target;
    try {
      target = fs.readlinkSync(fullPath);
    } catch {
      continue;
    }
    /** @type {string} Target resolved to absolute (handles relative + absolute symlinks). */
    const resolved = path.isAbsolute(target) ? target : path.resolve(path.dirname(fullPath), target);
    if (resolved === ownedRoot || resolved.startsWith(ownedRoot + path.sep)) {
      fs.unlinkSync(fullPath);
    }
  }

  // Deploy pass — one symlink per requested pair.
  /** @type {number} Count of symlinks actually created this run. */
  let linkedCount = 0;
  /** @type {number} Count of destinations left untouched because something already occupies them. */
  let skippedForeign = 0;
  for (const { sourcePath, destName } of pairs) {
    /** @type {string} Absolute destination path inside the opencode commands folder. */
    const destPath = path.join(opencodeCommandsDir, destName);
    /** @type {boolean} Whether anything already occupies the destination path. */
    let destExists = true;
    try {
      fs.lstatSync(destPath);
    } catch {
      destExists = false;
    }
    if (destExists) {
      skippedForeign++;
      continue;
    }
    safeSymlink(sourcePath, destPath);
    linkedCount++;
  }
  log(
    `>> opencode: symlinked ${linkedCount} command(s) from ${label}` +
      (skippedForeign ? ` (skipped ${skippedForeign} foreign / user-authored entries)` : ""),
  );
}

/**
 * Mirrors every file under ~/.claude/commands/ into ~/.config/opencode/commands/ as
 * symlinks so OpenCode (which does NOT fall through to ~/.claude/commands/ the way it
 * falls through to ~/.claude/CLAUDE.md for rules) picks up the same `/sy-*` slash
 * commands Claude Code uses.
 */
async function _syncOpencodeCommandSymlinks() {
  /** @type {string} Source of truth for every `/sy-*` slash command. */
  const claudeCommandsDir = path.join(BASE_HOMEDIR_LINUX, ".claude", "commands");

  if (!fs.existsSync(claudeCommandsDir)) {
    log(">> Skipped opencode commands: ~/.claude/commands not found (run claude.js first)");
    return;
  }

  log(">> Opencode Commands (symlinking from Claude):", _getOpencodeCommandsDir());

  /** @type {Array<{ sourcePath: string, destName: string }>} One entry per `*.md` under ~/.claude/commands/. */
  const pairs = fs
    .readdirSync(claudeCommandsDir)
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => ({
      sourcePath: path.join(claudeCommandsDir, entry),
      destName: entry,
    }));

  await _syncOpencodeSymlinkedCommands(claudeCommandsDir, pairs, "~/.claude/commands/");
}

/**
 * Exposes every GLOBAL Claude agent skill as a directly-invocable `/skill-name`
 * slash command by symlinking `~/.claude/skills/<name>/SKILL.md` into
 * `~/.config/opencode/commands/<name>.md`.
 *
 * This is purely an ergonomics layer, NOT a discovery fix. OpenCode already reads
 * `~/.claude/skills/<name>/SKILL.md` and `<repo>/.claude/skills/<name>/SKILL.md`
 * natively (https://opencode.ai/docs/skills/) and hands them to the model through
 * the built-in `skill` tool. But that path is model-invoked only — OpenCode ships
 * no `/skill` picker and no `/skill-name` binding, so a skill can only fire when
 * the model decides its description matches. Symlinking the same SKILL.md into the
 * commands slot gives one file two surfaces: `skill({ name })` for the model and
 * `/name` for the user. Frontmatter is compatible in both directions — OpenCode
 * reads `description` from either surface and ignores skill-only keys such as
 * `name` and `argument-hint`.
 *
 * Runs AFTER `_syncOpencodeCommandSymlinks` so a real `~/.claude/commands/<x>.md`
 * always wins a name collision against a same-named skill.
 *
 * Per-repo skills (`<repo>/.claude/skills/`) are out of scope here — mirror them
 * with a repo-local `<repo>/.opencode/commands/<name>.md -> ../../.claude/skills/<name>/SKILL.md`
 * symlink, which is what this repo checks in for its own skills.
 */
async function _syncOpencodeSkillCommandSymlinks() {
  /** @type {string} Source of truth for global agent skills. */
  const claudeSkillsDir = path.join(BASE_HOMEDIR_LINUX, ".claude", "skills");

  if (!fs.existsSync(claudeSkillsDir)) {
    log(">> Skipped opencode skill commands: ~/.claude/skills not found");
    return;
  }

  log(">> Opencode Skill Commands (symlinking from Claude skills):", _getOpencodeCommandsDir());

  /** @type {Array<{ sourcePath: string, destName: string }>} One entry per `<name>/SKILL.md` under ~/.claude/skills/. */
  const pairs = [];
  for (const entry of fs.readdirSync(claudeSkillsDir)) {
    /** @type {string} Absolute path to the candidate `<name>/SKILL.md`. */
    const skillFile = path.join(claudeSkillsDir, entry, "SKILL.md");
    if (!fs.existsSync(skillFile)) continue;
    pairs.push({ sourcePath: skillFile, destName: `${entry}.md` });
  }

  await _syncOpencodeSymlinkedCommands(claudeSkillsDir, pairs, "~/.claude/skills/");
}

// --- Auth persistence ---

/**
 * Persistent, refresh-proof home for the opencode credential blob. Deliberately
 * OUTSIDE `~/.local/share/opencode/` — see `_ensureOpencodeAuthSymlink`.
 * @type {string} `~/.auth-opencode.json`
 */
const OPENCODE_AUTH_STORE_PATH = path.join(BASE_HOMEDIR_LINUX, ".auth-opencode.json");

/**
 * The path opencode itself reads and writes. Kept as a symlink onto `OPENCODE_AUTH_STORE_PATH`.
 * @type {string} `~/.local/share/opencode/auth.json`
 */
const OPENCODE_AUTH_LIVE_PATH = path.join(BASE_HOMEDIR_LINUX, ".local/share/opencode/auth.json");

/**
 * Resolves a path's symlink target to an absolute path, or returns undefined when
 * the path is missing or is not a symlink.
 * @param {string} linkPath - Absolute path to inspect.
 * @returns {string|undefined} Absolute target of the symlink, else undefined.
 */
function _readSymlinkTarget(linkPath) {
  /** @type {fs.Stats|undefined} Lstat of the candidate link (undefined when absent). */
  let stat;
  try {
    stat = fs.lstatSync(linkPath);
  } catch {
    return undefined;
  }
  if (!stat.isSymbolicLink()) return undefined;

  /** @type {string} Raw link target as stored on disk (may be relative). */
  let target;
  try {
    target = fs.readlinkSync(linkPath);
  } catch {
    return undefined;
  }
  return path.isAbsolute(target) ? target : path.resolve(path.dirname(linkPath), target);
}

/**
 * Makes the opencode credential store survive a refresh.
 *
 * `opencode/install.sh` does `npm uninstall -g` + reinstall on every run, and the
 * opencode data folder (`~/.local/share/opencode/`) gets rebuilt along with it —
 * taking `auth.json` (every provider login: github-copilot, anthropic, openai...)
 * with it. Result: a re-login after every `bash run.sh --preset=llm`.
 *
 * Fix: the real credential file lives at `~/.auth-opencode.json`, which nothing in
 * the install path touches, and `~/.local/share/opencode/auth.json` is a symlink
 * onto it. If the data folder is wiped again the symlink dies but the credentials
 * do not, and this function relinks on the next run.
 *
 * Steps, all idempotent:
 * 1. Ensure the store exists (seeded with `{}` — opencode treats that as "no logins yet").
 * 2. Migrate a pre-existing REAL `auth.json` into the store before replacing it, so
 *    the first run after this change never costs the user their logins.
 * 3. Replace the live path with a symlink onto the store.
 *
 * @returns {Promise<void>}
 */
async function _ensureOpencodeAuthSymlink() {
  log(">> opencode auth:", `${OPENCODE_AUTH_LIVE_PATH} -> ${OPENCODE_AUTH_STORE_PATH}`);

  if (IS_DRY_RUN) {
    log(`<<<< [DryRun] Would link opencode auth.json onto ${OPENCODE_AUTH_STORE_PATH}`);
    return;
  }

  await mkdir(path.dirname(OPENCODE_AUTH_LIVE_PATH));

  /** @type {string} Contents of the persistent store; empty string when it does not exist yet. */
  let storeContent = "";
  try {
    storeContent = fs.readFileSync(OPENCODE_AUTH_STORE_PATH, "utf-8").trim();
  } catch {}

  /** @type {string|undefined} Absolute target when the live path is already a symlink. */
  const liveTarget = _readSymlinkTarget(OPENCODE_AUTH_LIVE_PATH);

  // A real (non-symlink) auth.json means either a fresh opencode login or the
  // pre-migration state — fold it into the store before it gets replaced. Only
  // adopt it when the store has nothing meaningful, so a live file that opencode
  // just truncated can never clobber good saved credentials.
  if (!liveTarget) {
    /** @type {string} Contents of the existing real auth.json; empty when absent. */
    let liveContent = "";
    try {
      liveContent = fs.readFileSync(OPENCODE_AUTH_LIVE_PATH, "utf-8").trim();
    } catch {}

    /** @type {boolean} Whether the store holds nothing beyond the `{}` seed. */
    const storeIsEmpty = storeContent === "" || storeContent === "{}";
    if (liveContent && liveContent !== "{}" && storeIsEmpty) {
      log(">> opencode auth: migrating existing auth.json into the persistent store");
      storeContent = liveContent;
    }
  }

  if (storeContent === "") {
    storeContent = "{}";
  }
  fs.writeFileSync(OPENCODE_AUTH_STORE_PATH, storeContent);
  // Credential file — owner-only, same posture opencode uses for its own auth.json.
  fs.chmodSync(OPENCODE_AUTH_STORE_PATH, 0o600);

  if (liveTarget === OPENCODE_AUTH_STORE_PATH) {
    log(">> opencode auth: symlink already in place");
    return;
  }

  try {
    fs.unlinkSync(OPENCODE_AUTH_LIVE_PATH);
  } catch {}
  safeSymlink(OPENCODE_AUTH_STORE_PATH, OPENCODE_AUTH_LIVE_PATH);
  log(">> opencode auth: symlink created");
}

/**
 * Deploys the shared engineering principles into ~/.config/opencode/AGENTS.md
 * between BEGIN/END markers. Mirrors the copilot/gemini pattern: managed
 * block is upserted; any user content outside the markers is preserved on
 * re-runs.
 *
 * Why this exists even though OpenCode falls through to ~/.claude/CLAUDE.md:
 * redundancy / defense-in-depth. If the user sets OPENCODE_DISABLE_CLAUDE_CODE=1
 * or ~/.claude/ goes missing, OpenCode still has the principles locally. Per
 * https://opencode.ai/docs/rules/, ~/.config/opencode/AGENTS.md takes
 * precedence over ~/.claude/CLAUDE.md when both exist — so this deploy is
 * authoritative, not just a fallback.
 */
async function _doOpencodeInstructionsWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".config/opencode/AGENTS.md");

  log(">> OpenCode Instructions:", targetPath);

  await mkdir(path.dirname(targetPath));

  /** @type {string} The markdown source for the managed engineering principles block. */
  const sourceContent = await getLLMCustomInstructions();

  /** @type {string} Existing AGENTS.md content (empty if file is missing). */
  let existing = "";
  try {
    existing = fs.readFileSync(targetPath, "utf-8");
  } catch (e) {}

  // One-time migration: strip the legacy `managed-rules` block so the new descriptive-key
  // upsert below doesn't append a duplicate alongside it. Idempotent — no-op once gone.
  existing = removeBlock(existing, LLM_INSTRUCTIONS_LEGACY_MARKER, "<!--", " -->");

  // Upsert the managed block between BEGIN/END markers keyed by the source-of-truth path.
  // insertMode: "append" creates the block when AGENTS.md is brand new or the markers are missing.
  const merged = replaceBlock(existing, LLM_INSTRUCTIONS_MARKER, sourceContent, "<!--", " -->", "append").trim() + "\n";

  await backupConfigFile(targetPath);
  await writeText(targetPath, merged);
}

/**
 * Writes ~/.config/opencode/opencode.json with dynamically-discovered Ollama providers
 * plus a static github-copilot provider entry, then writes the TUI config + AGENTS.md,
 * then mirrors all Claude Code slash commands AND global Claude agent skills into the
 * opencode commands dir as symlinks. Also relinks the credential store
 * (`~/.local/share/opencode/auth.json` -> `~/.auth-opencode.json`) so provider logins
 * survive the uninstall/reinstall in `install.sh`.
 *
 * Provider discovery: `getOllamaProviderInputs()` (in llm-common.js) probes the sy-omen45l
 * workstation and `127.0.0.1` on port `OLLAMA_PORT` (`/api/tags`) and returns ONLY hosts
 * that responded with at least one model. No hardcoded model list — every reachable host
 * contributes whatever it advertises. When zero hosts respond, the Ollama provider entries
 * are omitted (github-copilot is still written either way).
 *
 * Skips entirely when opencode is not installed.
 */
async function doWork() {
  if (!(await isBinaryFound("opencode"))) {
    log(">> Skipped opencode: not installed");
    return;
  }

  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".config/opencode/opencode.json");
  await mkdir(path.dirname(targetPath));
  await backupConfigFile(targetPath);

  // First thing after the install step so a data-folder wipe from install.sh is
  // repaired before anything else touches opencode.
  await _ensureOpencodeAuthSymlink();

  /** @type {Array<{id: string, name: string, baseURL: string, models: Array<{name: string}>}>} */
  const providerInputs = await getOllamaProviderInputs();
  if (providerInputs.length === 0) {
    log(">> opencode: no reachable Ollama hosts — writing config without provider entries");
  }

  /** @type {Record<string, any>} Shared MCP entries in opencode's native `{ type, command|url, ... }` shape. */
  const mcpServersOpencodeShape = translateMcpServersForOpencode(await loadSharedMcpServers());
  if (Object.keys(mcpServersOpencodeShape).length > 0) {
    log(`>> opencode: deploying ${Object.keys(mcpServersOpencodeShape).length} MCP server(s) from shared registry`);
  }

  await writeJson(targetPath, _buildOpencodeConfig(providerInputs, mcpServersOpencodeShape));
  log(">> opencode config written:", targetPath);

  await _writeOpencodeTuiConfig();

  // Shared on-demand instruction files must exist before the always-loaded block
  // that points at them. Safe to run from every CLI — writeText no-ops when unchanged.
  await deploySharedLLMInstructions();
  await _doOpencodeInstructionsWork();

  await _syncOpencodeCommandSymlinks();

  await _syncOpencodeSkillCommandSymlinks();
}

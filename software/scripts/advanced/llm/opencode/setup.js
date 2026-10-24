/**
 * Configures opencode with both remote and local Ollama providers.
 *
 * NOTE: OpenCode WOULD fall through to `~/.claude/CLAUDE.md` automatically when
 * `~/.config/opencode/AGENTS.md` is absent (per https://opencode.ai/docs/rules/),
 * but we deploy our OWN copy of `_common/v_current/instructions.md` to
 * `~/.config/opencode/AGENTS.md` anyway — see `_doOpencodeInstructionsWork`
 * below. Reason: redundancy. If the user later disables claude-code fallback
 * (`OPENCODE_DISABLE_CLAUDE_CODE=1`) or relocates `~/.claude/`, OpenCode still
 * has the engineering-principles block locally. Precedence per OpenCode docs:
 * `~/.config/opencode/AGENTS.md` wins over `~/.claude/CLAUDE.md` if both exist.
 *
 * User-authored slash commands are symlinked from `~/.claude/commands/` in
 * `_syncOpencodeCommandSymlinks` below — no separate copy.
 *
 * Sy-managed skills live once at `$LLM_ROOT_FOLDER/skills/<name>/SKILL.md` and are
 * symlinked into `~/.config/opencode/skills/` by the shared
 * `deploySharedLLMSkills()` (llm-common.js), which is what makes them
 * discoverable (https://opencode.ai/docs/skills/) and model-invocable through the
 * built-in `skill` tool. What that does NOT give you is a user-facing
 * `/skill-name` slash command — there is no `/skill` picker in the TUI at all.
 * `_syncOpencodeSkillCommandSymlinks` below closes that gap by symlinking each
 * shared SKILL.md into the opencode commands slot, so one file serves both
 * surfaces: model-invoked via `skill({name})` AND user-invoked via `/name`.
 */

// SOURCE software/scripts/advanced/llm/llm-common.js
// SOURCE software/scripts/advanced/editor.common.js

/**
 * Stream timeouts, in milliseconds, applied to every provider's `options`. Without
 * these a dead SSE stream waits forever, which is indistinguishable from a hang;
 * with them the request aborts and `opencode-auto-continue` can retry. Pinned to
 * 5 minutes for both, matching the current upstream default:
 * long enough for slow reasoning models and a cold Ollama load over LAN, and pinned
 * explicitly so older opencode builds (no default) still get a finite timeout.
 * @type {{ chunkTimeout: number, headerTimeout: number }}
 */
const PROVIDER_STREAM_TIMEOUTS = { chunkTimeout: 300000, headerTimeout: 300000 };

/**
 * Model used for cheap side tasks (session titles, summaries, compaction). Keeping
 * these off the primary model avoids paying Opus latency for bookkeeping calls.
 * @type {string}
 */
const OPENCODE_SMALL_MODEL = "github-copilot/gpt-5.5";

/**
 * Tokens held back from the context window so compaction has room to run.
 *
 * Compaction is itself an LLM call: it must fit the summarization prompt plus its
 * output inside whatever is left. With nothing reserved, opencode compacts at the
 * moment the window is already full, so the summarization request is the thing that
 * overflows — surfacing as a mid-task failure or a silent truncation right when the
 * session is most expensive to lose. 12k is sized for the summary of a long agent
 * session, not a chat turn.
 * @type {number}
 */
const COMPACTION_RESERVED_TOKENS = 12000;

/**
 * Folder names to keep the opencode file watcher out of, on top of
 * `EDITOR_CONFIGS.ignoredFolders` (the repo-wide canonical list, which already
 * covers node_modules, dist, build, coverage, .git, and every language cache).
 * Only names that list deliberately omits belong here.
 * @type {string[]}
 */
const OPENCODE_EXTRA_IGNORED_FOLDERS = [
  ".build", // this repo's generated artifacts — rewritten on every run
  ".pnp", // Yarn Plug'n'Play runtime
  "log", // Rails-style log folder
  "logs", // generic log folder
  "out", // common alternate build output (tsc, Next.js export)
  "Pods", // CocoaPods vendored iOS dependencies
];

/**
 * Builds the `watcher.ignore` glob list from the repo's canonical ignored-folder
 * list plus the extras above. Each name becomes a nested-safe glob so it matches
 * at any depth, not just the project root.
 * @returns {string[]} Sorted, de-duplicated glob patterns.
 */
function _buildOpencodeWatcherIgnore() {
  const folders = [...EDITOR_CONFIGS.ignoredFolders, ...OPENCODE_EXTRA_IGNORED_FOLDERS];
  return [...new Set(folders)].sort().map((folder) => `**/${folder}/**`);
}

/**
 * Builds the opencode config object dynamically from an array of providers.
 * @param {Array<{id: string, name: string, baseURL: string, models: Array<{name: string}>}>} providersArray - Simplified input schemas.
 * MCP entries are merged separately by deploySharedMcpServers at write time.
 * @returns {object} Managed opencode.json settings, excluding MCP entries.
 */
function _buildOpencodeConfig(providersArray) {
  const providers = {};
  const opencodeProviders = providersArray.map((item) => ({
    ...item,
    id: item.id.replace(/^ollama-/, "ol-"),
  }));

  for (const item of opencodeProviders) {
    // No per-model `limit`: opencode falls back to its own defaults, and Ollama serves
    // each model at its trained context. `capabilities.tools` is asserted for EVERY
    // Ollama model:
    // the OpenAI-compatible endpoint advertises no capability metadata, so opencode
    // assumes no tool support and offers the model as chat-only — an agent that can
    // read nothing and run nothing. Ollama itself rejects a tool call a model cannot
    // make, so over-claiming fails loudly at call time instead of silently at pick time.
    const providerAddress = item.baseURL.replace(/^https?:\/\//, "").replace(/\/v1\/?$/, "");
    const modelsObject = Object.fromEntries(
      item.models.map((m) => {
        return [
          m.name,
          {
            name: `${m.name} / ${providerAddress}`,
            capabilities: { tools: true },
          },
        ];
      }),
    );

    providers[item.id] = {
      npm: "@ai-sdk/openai-compatible",
      name: item.id,
      options: {
        baseURL: item.baseURL,
        ...PROVIDER_STREAM_TIMEOUTS,
      },
      models: modelsObject,
    };
  }

  // Keep verified Copilot models visible when account discovery omits a rollout.
  if (Object.keys(LLM_COPILOT_MODEL_EXTENSIONS).length > 0) {
    providers["github-copilot"] = {
      options: { ...PROVIDER_STREAM_TIMEOUTS },
      models: Object.fromEntries(
        Object.entries(LLM_COPILOT_MODEL_EXTENSIONS).map(([modelId, config]) => [
          modelId,
          config.fast ? { variants: { fast: config.fast } } : {},
        ]),
      ),
    };
  }

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
    // Primary → general dispatcher → worker; depth 2 still blocks further nesting.
    // The dispatcher also needs an explicit task permission in AGENT_TO_MODEL_MAP.
    subagent_depth: 2,
    // Compaction stays on with opencode's default tail_turns. An explicit low
    // value (we used to pin 4) throws away almost everything on each compaction,
    // so the model re-reads the same files, refills the window, and compacts
    // again — a death spiral that reads as a mid-task freeze. `prune` is the
    // surgical version of that: drop stale tool output, keep the conversation,
    // which matters given the raised `tool_output.max_lines` below.
    compaction: {
      auto: true,
      prune: true,
      reserved: COMPACTION_RESERVED_TOKENS,
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
    // Enable opencode's built-in LSP servers. NOT a no-op default: per
    // https://opencode.ai/docs/config/#lsp-servers, omitting the key leaves LSP
    // DISABLED, so the agent gets zero diagnostics, hovers, or go-to-definition
    // and has to infer type errors from a build run. `true` keeps every built-in
    // and adds none of our own overrides. tradeoff: language servers spawn per
    // project and cost RAM. risk: low.
    lsp: true,
    // Disable opencode's built-in formatters. They can pick a tool the repo does
    // not use (e.g. prettier in an oxfmt repo) and reformat mid-edit, breaking the
    // agent's next exact-match edit. Instead, the shared instructions require the
    // agent to run the repo's OWN formatter once before committing.
    // tradeoff: edits stay unformatted until that pre-commit format pass.
    formatter: false,
    // Explicitly load every shared instruction file. The always-loaded AGENTS.md
    // block only POINTS at these (they live outside the 40k always-loaded budget —
    // see llm-common.js LLM_SHARED_INSTRUCTION_FILES), and a pointer is only
    // followed if the model chooses to. Listing them here makes opencode load them
    // as rules files every session instead.
    //
    // Read from disk rather than hardcoded: getSharedLLMInstructionFilePaths() lists
    // whatever deploySharedLLMInstructions() just wrote, so a file added to the
    // registry later needs no edit here, and a hand-authored note dropped into
    // $LLM_ROOT_FOLDER/instructions/ is picked up too.
    instructions: getSharedLLMInstructionFilePaths(),
    // Never expose a session URL. Work happens in private repos; the default
    // ("manual") leaves a one-keystroke publish path we have no use for.
    share: "disabled",
    // Keep the file watcher out of dependency trees, build output, and tool
    // caches. Glob syntax per https://opencode.ai/docs/config/#watcher.
    watcher: {
      ignore: _buildOpencodeWatcherIgnore(),
    },
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
      // Keep this disable flag false: long pastes should collapse into a compact
      // placeholder instead of flooding the input box; the full text is still sent.
      // A saved TUI override wins: select "Enable paste summary" in the command palette.
      disable_paste_summary: false,
    },
    // Others tried and dropped as buggy or silent no-ops: supermemory,
    // subagent-statusline, notify, worktree, snip. snip (VincentHardouin/opencode-snip)
    // was added twice and reverted twice — its tool.execute.before hook prepends `snip`
    // to the agent's command, which mangles compound commands (for/do/done → invalid
    // bash) and corrupts machine-readable output (a `--json` result the agent parses is
    // filtered). Do not re-add; snip's interactive shell wrappers cover the human path.
    plugin: [
      // Re-prompts a session that went idle mid-task instead of leaving it parked.
      "opencode-auto-continue",
    ],
    provider: providers,
  };

  // Per-role agents (build / general / plan / review / local) come from AGENT_TO_MODEL_MAP in
  // llm-common.js — the single registry shared with every other LLM CLI, keyed by CLI
  // folder name so opencode reads its own row and nothing else. The `local` agent
  // resolves against the Ollama providers discovered above and is dropped when no host
  // serves any of its models, so the key is only written when something resolved.
  const agents = resolveOpencodeAgentConfig(opencodeProviders);
  if (Object.keys(agents).length > 0) {
    out.agent = agents;
  }

  return out;
}

/**
 * Writes one paired native OpenCode theme without overriding an explicit foreign selection.
 * @param {string} configHome - Base configuration home.
 * @param {string|undefined} selected - Existing TUI theme ID.
 * @returns {Promise<string>} Preserved selection, managed sy ID, or native fallback.
 * @throws {Error} For invalid paired roles or IO failures; TUI settings are not written here.
 */
async function _doOpencodeThemeWork(configHome, selected) {
  if (selected !== undefined && typeof selected !== "string") throw new Error("Invalid OpenCode theme selection: expected a string");
  const owned = ["sy", "sy-dark", "sy-light"];
  if (!shouldInstallCustomTheme("terminal"))
    return selected === undefined || owned.includes(selected) ? getTheme("opencode").dark : selected;
  const [dark, light] = await Promise.all([readSyTheme("opencode", "dark"), readSyTheme("opencode", "light")]);
  if (
    !dark.theme ||
    !light.theme ||
    typeof dark.theme !== "object" ||
    typeof light.theme !== "object" ||
    Array.isArray(dark.theme) ||
    Array.isArray(light.theme) ||
    !Object.keys(dark.theme).length ||
    Object.keys(dark.theme).sort().join(",") !== Object.keys(light.theme).sort().join(",")
  ) {
    throw new Error("Invalid OpenCode themes: expected matching non-empty native role objects");
  }
  const theme = {};
  for (const key of Object.keys(dark.theme)) {
    if (![dark.theme[key], light.theme[key]].every((value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)))
      throw new Error("Invalid OpenCode theme role: expected generated hex colors");
    theme[key] = { dark: dark.theme[key], light: light.theme[key] };
  }
  const folder = path.join(configHome, ".config/opencode/themes");
  const target = path.join(folder, "sy.json");
  await mkdir(folder);
  await backupConfigFile(target);
  await writeJson(target, { $schema: dark.$schema, theme });
  return selected === undefined || owned.includes(selected) ? "sy" : selected;
}

/**
 * Writes managed TUI defaults, keybinds, and a native startup-preference plugin.
 * Keybinds belong in tui.json (the TUI config), not in opencode.json (the
 * provider/config schema at https://opencode.ai/config.json which has no
 * keybinds field). Schema: https://opencode.ai/tui.json.
 *
 * Preserves unrelated plugins, keybindings, and settings, strips invalid legacy title/animations,
 * and applies seven managed KV preferences through OpenCode's own startup API.
 * Never writes kv.json while another session may own it.
 * @param {string} [configHome=getLLMConfigHome()] - Base configuration home.
 * @param {boolean} [isWindowsConfig=is_os_windows] - Whether to use Windows keybindings.
 * @returns {Promise<void>} Resolves after backing up and writing TUI configuration and its plugin.
 * @throws {TypeError} If an existing plugin list is malformed; no files are written.
 * @throws {Error} If theme validation or configuration IO fails.
 */
async function _writeOpencodeTuiConfig(configHome = getLLMConfigHome(), isWindowsConfig = is_os_windows) {
  const tuiPath = path.join(configHome, ".config/opencode/tui.json");
  /** @type {Record<string, any>} */
  const existing = (await readJson`${tuiPath}`) || {};
  if (existing.plugin !== undefined && !Array.isArray(existing.plugin)) {
    throw new TypeError("OpenCode TUI plugin must be an array");
  }
  /** Stable native plugin identity, also used for its deployed filename. */
  const pluginId = "sy-ui-preferences";
  /** Absolute plugin path; native configuration resolves and URL-encodes file entries. */
  const pluginPath = path.join(configHome, ".config/opencode", `${pluginId}.mjs`);
  // Strip invalid legacy top-level fields not in the tui.json schema
  delete existing.title;
  delete existing.animations;
  const theme = await _doOpencodeThemeWork(configHome, existing.theme);
  /** @type {Record<string, any>} */
  const keybinds = await _loadOpencodeKeybinds(isWindowsConfig);
  /** @type {Record<string, any>} */
  const out = {
    $schema: "https://opencode.ai/tui.json",
    ...existing,
    theme,
    plugin: [...(existing.plugin ?? []).filter((entry) => entry !== pluginPath), pluginPath],
    mouse: true,
    // Force single-column stacked diff rendering instead of the default "auto"
    // (which flips to side-by-side on wide terminals). Stacked diffs read
    // cleanly in tmux splits, VS Code's integrated terminal pane, and any
    // half-width terminal where side-by-side cramming truncates both columns.
    // Trade for full-width terminals: lose the simultaneous before/after view.
    // tradeoff: less info density on wide screens. risk: none.
    diff_style: "stacked",
    scroll_speed: 3,
    // Solid, non-blinking block cursor. Default is `"default"` (whatever the
    // terminal is set to), which across iTerm2 / Ghostty / VS Code's integrated
    // terminal means the prompt cursor looks different in every one of them.
    // Blinking off because a blinking cursor next to a streaming response reads
    // as activity that isn't there. tradeoff: overrides terminal preference.
    // risk: none.
    cursor: {
      style: "block",
      blinking: false,
    },
    // Leader-chord window, in ms. Our keybinds use a `ctrl+o` leader plus
    // multi-key chords (`ctrl+g,ctrl+x` and friends, see
    // opencode-keys.common.jsonc), and the stock timeout drops the second key
    // often enough to feel like a missed keypress. tradeoff: a stray leader
    // press swallows the next 1.5s of typing. risk: low.
    leader_timeout: 1500,
    // Cap the prompt textarea height. Pasting a stack trace or a diff otherwise
    // grows the input box until it owns the screen and the transcript scrolls
    // out of view; past 20 lines it scrolls inside the box instead.
    // tradeoff: long pastes are not visible in full while composing. risk: none.
    prompt: {
      max_height: 20,
    },
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
    out.keybinds = { ...existing.keybinds, ...keybinds };
  }
  // OpenCode 1.19.3 exposes these command-palette preferences only through KV.
  // A TUI plugin uses the application's own locking and preserves other choices.
  /** Native startup module; no dependencies, network access, or direct state-file writes. */
  const pluginSource = `/** Applies managed command-palette preferences at TUI startup. */
export default {
  id: ${JSON.stringify(pluginId)},
  /**
   * Applies managed values while preserving unrelated saved preferences.
   * @param {import("@opencode-ai/plugin/tui").TuiPluginApi} api - Native TUI state and command API.
   * @returns {Promise<void>} Resolves after native commands and KV updates.
   */
  async tui(api) {
    /** Explicit bootstrap-owned preferences; Ctrl+P changes last until the next startup. */
    const preferences = {
      diff_wrap_mode: "word",
      scrollbar_visible: true,
      paste_summary_enabled: true,
      timestamps: "show",
      terminal_title_enabled: true,
      sidebar: "hide",
      tool_details_visibility: true,
    };
    // These two controls capture startup values in local signals rather than reacting to KV.
    if (!api.kv.get("paste_summary_enabled", true)) api.keymap.dispatchCommand("app.toggle.paste_summary");
    if (!api.kv.get("terminal_title_enabled", true)) api.keymap.dispatchCommand("terminal.title.toggle");
    for (const [key, value] of Object.entries(preferences)) {
      if (api.kv.get(key) !== value) api.kv.set(key, value);
    }
  },
};
`;
  await backupConfigFile(pluginPath);
  await writeText(pluginPath, pluginSource);
  await backupConfigFile(tuiPath);
  await writeJson(tuiPath, out);
  log(">> opencode tui.json written:", tuiPath);
}

/**
 * Loads common OpenCode keybindings and applies Windows-only overrides when
 * needed. Windows uses `alt` instead of the common `super` primary modifier.
 *
 * @param {boolean} [isOsWindows=is_os_windows] - Whether to use Windows keybindings.
 * @returns {Promise<Record<string, any>>} Resolved keybinds map (empty object if file missing).
 */
async function _loadOpencodeKeybinds(isOsWindows = is_os_windows) {
  /** @type {{ keybinds?: Record<string, any> } | null} */
  const raw = await readJson`software/scripts/advanced/llm/opencode/opencode-keys.common.jsonc`;
  if (!raw || !raw.keybinds) return {};
  if (!isOsWindows) return { ...raw.keybinds };

  /** @type {{ keybinds?: Record<string, any> } | null} */
  const windows = await readJson`software/scripts/advanced/llm/opencode/opencode-keys.windows.jsonc`;
  return { ...raw.keybinds, ...windows?.keybinds };
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

  // Cleanup pass — unlink owned symlinks resolving under `ownedRoot`, plus any left
  // pointing at a former shared LLM home. Without the second test a link written
  // before the home moved is never recognized as ours: it dangles, and the deploy
  // pass below then counts it as a foreign entry and refuses to replace it.
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
    if (resolved === ownedRoot || resolved.startsWith(ownedRoot + path.sep) || isUnderSharedLLMHome(resolved)) {
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
 * Exposes every GLOBAL agent skill as a directly-invocable `/skill-name` slash
 * command by symlinking `$LLM_ROOT_FOLDER/skills/<name>/SKILL.md` into
 * `~/.config/opencode/commands/<name>.md`.
 *
 * Sources the SHARED folder (LLM_SHARED_SKILLS_FOLDER), not `~/.claude/skills/` —
 * that folder now holds symlinks into the shared one, so linking from it would
 * mean two hops to the same bytes and a broken command the moment Claude's link
 * is pruned.
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
 * Per-repo skills (`<repo>/.claude/skills/`) are out of scope here because OpenCode
 * reads that native project path directly.
 */
async function _syncOpencodeSkillCommandSymlinks() {
  /** @type {string} The one physical home of every Sy-managed skill. */
  const sharedSkillsDir = LLM_SHARED_SKILLS_FOLDER;

  if (!fs.existsSync(sharedSkillsDir)) {
    log(`>> Skipped opencode skill commands: ${sharedSkillsDir} not found`);
    return;
  }

  log(">> Opencode Skill Commands (symlinking from shared skills):", _getOpencodeCommandsDir());

  /** @type {Array<{ sourcePath: string, destName: string }>} One entry per `<name>/SKILL.md` in the shared folder. */
  const pairs = [];
  for (const entry of fs.readdirSync(sharedSkillsDir)) {
    /** @type {string} Absolute path to the candidate `<name>/SKILL.md`. */
    const skillFile = path.join(sharedSkillsDir, entry, "SKILL.md");
    if (!fs.existsSync(skillFile)) continue;
    pairs.push({ sourcePath: skillFile, destName: `${entry}.md` });
  }

  await _syncOpencodeSymlinkedCommands(sharedSkillsDir, pairs, `${sharedSkillsDir}/`);
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
  // Migrate the previous source-path key after moving the active corpus into v_current.
  existing = removeBlock(existing, LLM_INSTRUCTIONS_PREVIOUS_MARKER, "<!--", " -->");

  // Upsert the managed block between BEGIN/END markers keyed by the source-of-truth path.
  // insertMode: "append" creates the block when AGENTS.md is brand new or the markers are missing.
  // Then refresh any user-authored `<!-- BEGIN <label> | <path> -->` block already in the file.
  const merged =
    refreshPathKeyedBlocks(replaceBlock(existing, LLM_INSTRUCTIONS_MARKER, sourceContent, "<!--", " -->", "append")).trim() + "\n";

  await backupConfigFile(targetPath);
  await writeText(targetPath, merged);
}

/**
 * Deploys a local plugin that refreshes chat-style context before model calls and compaction.
 * Uses only documented context arrays; performs no network or permission changes.
 * @returns {Promise<void>} Resolves after writing the managed plugin.
 */
async function _doOpencodePersonaPluginWork() {
  const targetPath = path.join(getLLMConfigHome(), ".config/opencode/plugins/sy-persona-reminder.js");
  const content = `/** Reinforces chat style while preserving policy and artifact prose. */
export default async function () {
  const reminder = ${JSON.stringify(LLM_PERSONA_REMINDER)};
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      output.system = output.system.filter((entry) => entry !== reminder);
      output.system.push(reminder);
    },
    "experimental.session.compacting": async (_input, output) => {
      if (!output.context.includes(reminder)) output.context.push(reminder);
    },
  };
}
`;
  await mkdir(path.dirname(targetPath));
  await writeText(targetPath, content);
}

/**
 * Configures installed OpenCode: discovered providers, MCP, TUI, instructions,
 * persona plugin, command/skill links, agents, and the existing auth-store link.
 * Omits Ollama providers when discovery returns none; skips if OpenCode is absent.
 * @returns {Promise<void>} Resolves after deployment; MCP validation and IO errors propagate.
 */
async function doWork() {
  if (!(await isBinaryFound("opencode"))) {
    log(">> Skipped opencode: not installed");
    return;
  }

  const targetPath = path.join(getLLMConfigHome(), ".config/opencode/opencode.json");
  await mkdir(path.dirname(targetPath));

  // First thing after the install step so a data-folder wipe from install.sh is
  // repaired before anything else touches opencode. Auth stays in its existing
  // Linux-side store and is deliberately not cloned to the second config home.
  await _ensureOpencodeAuthSymlink();

  /** @type {Array<{id: string, name: string, baseURL: string, models: Array<{name: string}>}>} */
  const providerInputs = await getOllamaProviderInputs();
  if (providerInputs.length === 0) {
    log(">> opencode: no reachable Ollama hosts — writing config without provider entries");
  }

  // Shared on-demand instruction files must exist before the always-loaded block
  // that points at them. Safe to run from every CLI — writeText no-ops when unchanged.
  //
  // Must also run BEFORE the config write below: _buildOpencodeConfig() fills
  // `instructions` from getSharedLLMInstructionFilePaths(), which reports what is on
  // disk. Deploy after the write and a fresh machine gets `instructions: []` and only
  // self-corrects on the second run.
  await deploySharedLLMInstructions();

  await deploySharedMcpServers(targetPath, _buildOpencodeConfig(providerInputs), "opencode", "opencode");
  log(">> opencode config written:", targetPath);

  await _writeOpencodeTuiConfig();

  await _doOpencodeInstructionsWork();
  await _doOpencodePersonaPluginWork();

  await _syncOpencodeCommandSymlinks();

  // Shared skills must exist (and be linked into ~/.config/opencode/skills) before
  // the /name command mirror below points at them.
  await deploySharedLLMSkills();
  await _syncOpencodeSkillCommandSymlinks();

  // Named worker agents for the PR fan-outs. Independent of the skills above —
  // a skill supplies the workflow, an agent supplies the worker persona and, on
  // opencode specifically, the label its subagent tab strip renders.
  await deploySharedLLMAgents();
}

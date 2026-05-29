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
 */

// SOURCE software/scripts/advanced/llm/llm-common.js

// --- Limit buckets ---

/**
 * Small context/output limit for small local models.
 * @type {{ context: number, output: number }}
 */
const LIMIT_SMALL = { context: 16384, output: 4096 };

/**
 * Medium context/output limit — default for most local code models.
 * @type {{ context: number, output: number }}
 */
const LIMIT_MEDIUM = { context: 32768, output: 4096 };

/**
 * Large context/output limit for hosted models (GitHub Copilot, large local models like 70B+).
 * @type {{ context: number, output: number }}
 */
const LIMIT_LARGE = { context: 1000000, output: 64000 };

// --- Known Ollama model configs ---
//
// Models discovered dynamically from `/api/tags` that are NOT in this map
// get `OLLAMA_DEFAULT_CONFIG` (medium limit).

/**
 * Per-model configs for known Ollama models. Keyed by full model tag as returned by `/api/tags`.
 * @type {Record<string, { limit: { context: number, output: number } }>}
 */
const OLLAMA_MODEL_CONFIGS = {
  "qwen2.5-coder:3b": { limit: LIMIT_MEDIUM },
  "qwen2.5-coder:14b": { limit: LIMIT_MEDIUM },
  "qwen3-coder:30b": { limit: LIMIT_MEDIUM },
  "qwen3.6:latest": { limit: LIMIT_SMALL },
};

/**
 * Default config for any Ollama model not listed in `OLLAMA_MODEL_CONFIGS`.
 * @type {{ limit: { context: number, output: number } }}
 */
const OLLAMA_DEFAULT_CONFIG = { limit: LIMIT_MEDIUM };

/**
 * Builds the opencode config object dynamically from an array of providers.
 * @param {Array<{id: string, name: string, baseURL: string, models: Array<{name: string}>}>} providersArray - Simplified input schemas.
 * @returns {object} The full opencode.json content.
 */
function _buildOpencodeConfig(providersArray) {
  const providers = {};

  for (const item of providersArray) {
    // Enrich each model with limit from the known config map.
    const modelsObject = Object.fromEntries(
      item.models.map((m) => {
        const cfg = OLLAMA_MODEL_CONFIGS[m.name] || OLLAMA_DEFAULT_CONFIG;
        return [m.name, { limit: cfg.limit }];
      }),
    );

    providers[item.id] = {
      npm: "@ai-sdk/openai-compatible",
      name: item.name,
      options: {
        baseURL: item.baseURL,
      },
      models: modelsObject,
    };
  }

  // GitHub Copilot provider: large context/output limits for models like claude-opus-4.6/4.7.
  // Without explicit limits, opencode's GitHub Copilot adapter caps at its defaults
  // (~128k context / 8k output), which wastes the model's full capacity.
  providers["github-copilot"] = {
    models: {
      "claude-opus-4.6": { limit: LIMIT_LARGE },
      "claude-opus-4.7": { limit: LIMIT_LARGE },
    },
  };

  // Auto-name every model: "<provider_key> / <model_key>" so the model picker in TUI
  // shows a human-readable label instead of bare IDs.
  for (const [providerId, providerCfg] of Object.entries(providers)) {
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
    // `--allow-dangerously-skip-permissions` / `GITHUB_COPILOT_ALLOW_ALL_TOOLS=true`
    // convention used across the other AI CLI configs in this repo.
    permission: {
      "*": "allow",
    },
    // Keep more recent conversation turns verbatim during compaction (default: 2)
    // so the agent has more context about what was just discussed before it gets
    // summarized. tradeoff: higher token usage per compaction cycle. risk: low
    compaction: {
      auto: true,
      tail_turns: 4,
    },
    // Allow more tool output lines before truncation (default: 2000) so the
    // agent sees fuller command output before falling back to the saved-to-disk
    // preview. tradeoff: more tokens consumed by verbose tools. risk: low
    tool_output: {
      max_lines: 3000,
    },
    provider: providers,
  };

  return out;
}

/**
 * Writes ~/.config/opencode/tui.json with keybinds.
 * Keybinds belong in tui.json (the TUI config), not in opencode.json (the
 * provider/config schema at https://opencode.ai/config.json which has no
 * keybinds field). Schema: https://opencode.ai/tui.json.
 *
 * Strips invalid legacy fields (`title.enabled`, `animations.enabled`)
 * that crept into earlier versions but are not valid in the tui.json schema.
 * All other existing keys are preserved.
 */
async function _writeOpencodeTuiConfig() {
  const tuiPath = path.join(BASE_HOMEDIR_LINUX, ".config/opencode/tui.json");
  /** @type {Record<string, any>} */
  const existing = (await readJson`${tuiPath}`) || {};
  // Strip invalid legacy fields not in the tui.json schema
  delete existing.title;
  delete existing.animations;
  /** @type {Record<string, any>} */
  const keybinds = await _loadOpencodeKeybinds();
  /** @type {Record<string, any>} */
  const out = {
    $schema: "https://opencode.ai/tui.json",
    ...existing,
    mouse: true,
    scroll_speed: 3,
    scroll_acceleration: {
      enabled: true,
    },
    attention: {
      enabled: true,
      notifications: true,
      sound: true,
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
 * Mirrors every file under ~/.claude/commands/ into ~/.config/opencode/commands/ as
 * symlinks so OpenCode (which does NOT fall through to ~/.claude/commands/ the way it
 * falls through to ~/.claude/CLAUDE.md for rules) picks up the same `/sy-*` slash
 * commands Claude Code uses.
 */
async function _syncOpencodeCommandSymlinks() {
  const claudeCommandsDir = path.join(BASE_HOMEDIR_LINUX, ".claude", "commands");
  const opencodeCommandsDir = path.join(BASE_HOMEDIR_LINUX, ".config", "opencode", "commands");

  if (!fs.existsSync(claudeCommandsDir)) {
    log(">> Skipped opencode commands: ~/.claude/commands not found (run claude.js first)");
    return;
  }

  log(">> Opencode Commands (symlinking from Claude):", opencodeCommandsDir);
  await mkdir(opencodeCommandsDir);

  // Cleanup pass — unlink owned symlinks targeting ~/.claude/commands/
  for (const entry of fs.readdirSync(opencodeCommandsDir)) {
    const fullPath = path.join(opencodeCommandsDir, entry);
    let stat;
    try {
      stat = fs.lstatSync(fullPath);
    } catch {
      continue;
    }
    if (!stat.isSymbolicLink()) continue;
    let target;
    try {
      target = fs.readlinkSync(fullPath);
    } catch {
      continue;
    }
    const resolved = path.isAbsolute(target) ? target : path.resolve(path.dirname(fullPath), target);
    if (resolved === claudeCommandsDir || resolved.startsWith(claudeCommandsDir + path.sep)) {
      fs.unlinkSync(fullPath);
    }
  }

  // Deploy pass — one symlink per *.md file under ~/.claude/commands/.
  let linkedCount = 0;
  let skippedForeign = 0;
  for (const entry of fs.readdirSync(claudeCommandsDir)) {
    if (!entry.endsWith(".md")) continue;
    const sourcePath = path.join(claudeCommandsDir, entry);
    const destPath = path.join(opencodeCommandsDir, entry);
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
    fs.symlinkSync(sourcePath, destPath);
    linkedCount++;
  }
  log(
    `>> opencode: symlinked ${linkedCount} command(s) from ~/.claude/commands/` +
      (skippedForeign ? ` (skipped ${skippedForeign} foreign / user-authored entries)` : ""),
  );
}

/**
 * Marker key used to wrap the managed engineering principles block inside
 * ~/.config/opencode/AGENTS.md. Anything outside the BEGIN/END markers is
 * preserved as user-owned content (matches claude/copilot/gemini setup.js).
 * @type {string}
 */
const OPENCODE_INSTRUCTIONS_MARKER = "managed-rules";

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
  const sourceContent = (await readText`software/scripts/advanced/llm/_common/instructions.md`).trim();

  /** @type {string} Existing AGENTS.md content (empty if file is missing). */
  let existing = "";
  try {
    existing = fs.readFileSync(targetPath, "utf-8");
  } catch (e) {}

  // Upsert the managed block between <!-- BEGIN managed-rules --> / <!-- END managed-rules -->.
  // insertMode: "append" creates the block when AGENTS.md is brand new or the markers are missing.
  const merged = replaceBlock(existing, OPENCODE_INSTRUCTIONS_MARKER, sourceContent, "<!--", " -->", "append").trim() + "\n";

  await backupConfigFile(targetPath);
  await writeText(targetPath, merged);
}

/**
 * Writes ~/.config/opencode/opencode.json with dynamically-discovered Ollama providers,
 * then mirrors all Claude Code slash commands into the opencode commands dir as symlinks.
 *
 * Provider discovery: `getOllamaProviderInputs()` (in llm-common.js) probes the sy-omen45l
 * workstation and `127.0.0.1` on port `OLLAMA_PORT` (`/api/tags`) and returns ONLY hosts
 * that responded with at least one model. No hardcoded model list — every reachable host
 * contributes whatever it advertises. When zero hosts respond, the `provider` block is
 * omitted entirely so opencode falls back to its built-in defaults.
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

  /** @type {Array<{id: string, name: string, baseURL: string, models: Array<{name: string}>}>} */
  const providerInputs = await getOllamaProviderInputs();
  if (providerInputs.length === 0) {
    log(">> opencode: no reachable Ollama hosts — writing config without provider entries");
  }

  await writeJson(targetPath, _buildOpencodeConfig(providerInputs));
  log(">> opencode config written:", targetPath);

  await _writeOpencodeTuiConfig();

  await _doOpencodeInstructionsWork();

  await _syncOpencodeCommandSymlinks();
}

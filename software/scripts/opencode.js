/** Configures opencode to use a local Ollama provider, with models discovered from /api/tags. */

/** @type {string} The hostname to look up in the home IP address config for resolving Ollama's network IP address. */
const OPENCODE_OLLAMA_HOSTNAME = "sy-omen45l";

/** @type {string} Host running Ollama. Always localhost — works on native Linux/Mac, WSL2 mirrored networking, and Ollama-in-WSL. */
const OPENCODE_OLLAMA_HOST = "localhost";

/** @type {number} Default Ollama HTTP port (upstream default). */
const OPENCODE_OLLAMA_PORT = 11434;
/** @type {string[]} Fallback model names used when `/api/tags` returns no models (Ollama unreachable, empty install, etc.). */
const OPENCODE_OLLAMA_FALLBACK_MODELS = ["qwen3.6:latest"];

/**
 * Fetches the installed model names from Ollama's `/api/tags`.
 * Returns an empty array on fetch failure or empty list.
 * @returns {Promise<string[]>} Model names (e.g. ["qwen3.6:latest"]).
 */
async function _fetchOpencodeOllamaModels() {
  const host = getHomeIPAddressForHostname(OPENCODE_OLLAMA_HOSTNAME) || OPENCODE_OLLAMA_HOST;
  const url = `http://${host}:${OPENCODE_OLLAMA_PORT}/api/tags`;
  log(`>> opencode: getting models from ${url} (curl ${url})`);
  try {
    const json = await readJson`${url}`;
    const tags = Array.isArray(json && json.models) ? json.models : [];
    return tags.map((m) => m && m.name).filter((n) => typeof n === "string" && n);
  } catch {
    return [];
  }
}

/**
 * Builds the opencode config object pointing at a local Ollama instance via the
 * `@ai-sdk/openai-compatible` provider.
 * @param {string[]} modelNames - Model names; converted to the `{ [name]: {} }` shape opencode expects.
 * @returns {object} The full opencode.json content.
 */
function _buildOpencodeConfig(modelNames) {
  const host = getHomeIPAddressForHostname(OPENCODE_OLLAMA_HOSTNAME) || OPENCODE_OLLAMA_HOST;
  const baseURL = `http://${host}:${OPENCODE_OLLAMA_PORT}/v1`;
  return {
    $schema: "https://opencode.ai/config.json",
    provider: {
      ollama: {
        npm: "@ai-sdk/openai-compatible",
        name: `Ollama (local - ${baseURL})`,
        options: {
          baseURL,
        },
        models: Object.fromEntries(modelNames.map((n) => [n, {}])),
      },
    },
  };
}

/**
 * Mirrors every file under ~/.claude/commands/ into ~/.config/opencode/commands/ as
 * symlinks so OpenCode (which does NOT fall through to ~/.claude/commands/ the way it
 * falls through to ~/.claude/CLAUDE.md for rules) picks up the same `/sy-*` slash
 * commands Claude Code uses. The cleanup pattern mirrors claude.js — wipe previously-
 * deployed entries before re-deploying — but since every entry we deploy here is a
 * symlink, "unlink the previous symlink-into-~/.claude/commands" replaces "delete the
 * file contents". No backup is made: the source of truth lives in ~/.claude/commands/
 * (itself rebuilt from software/scripts/advanced/claude/commands/ by claude.js), and
 * symlinks are trivially reproducible. Non-symlink entries already in the opencode
 * commands dir (user-authored, foreign) are left alone — we only touch links we own.
 *
 * No-op when ~/.claude/commands/ does not exist (e.g. claude.js hasn't run yet on
 * this machine).
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

  // Cleanup pass — unlink every symlink in the opencode commands dir whose target
  // points into ~/.claude/commands/. These are previously-deployed entries of ours;
  // wiping them before re-deploying matches claude.js's behavior and ensures renames
  // / retirements on the Claude side propagate cleanly. Anything that's NOT one of
  // our symlinks (regular files, symlinks to other locations) is left alone.
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
  // Skip names that already exist after the cleanup pass: those are foreign (user-
  // authored or symlinked to something we don't manage), and clobbering them would
  // be surprising.
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
 * Writes ~/.config/opencode/opencode.json wired to a local Ollama instance, then
 * mirrors all Claude Code slash commands into the opencode commands dir as symlinks.
 * Skips entirely when opencode is not installed.
 */
async function doWork() {
  if (!(await isBinaryFound("opencode"))) {
    log(">> Skipped opencode: not installed");
    return;
  }

  let modelNames = await _fetchOpencodeOllamaModels();
  const resolvedHost = getHomeIPAddressForHostname(OPENCODE_OLLAMA_HOSTNAME) || OPENCODE_OLLAMA_HOST;
  if (modelNames.length === 0) {
    log(
      `WARN opencode: no models reachable at http://${resolvedHost}:${OPENCODE_OLLAMA_PORT}/api/tags — falling back to ${OPENCODE_OLLAMA_FALLBACK_MODELS.join(", ")}`,
    );
    modelNames = OPENCODE_OLLAMA_FALLBACK_MODELS;
  } else {
    log(`>> opencode: discovered ${modelNames.length} model(s): ${modelNames.join(", ")}`);
  }

  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".config/opencode/opencode.json");
  await mkdir(path.dirname(targetPath));
  await backupConfigFile(targetPath);
  await writeJson(targetPath, _buildOpencodeConfig(modelNames));
  log(">> opencode config written:", targetPath);

  await _syncOpencodeCommandSymlinks();
}

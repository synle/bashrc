/** Configures opencode with both remote and local Ollama providers. */

/** @type {string} The hostname to look up in the home IP address config for resolving Ollama's network IP address. */
const OPENCODE_OLLAMA_HOSTNAME = "sy-omen45l";

/** @type {string} Fallback Ollama host when hostname lookup fails. */
const OPENCODE_OLLAMA_DEFAULT_HOST = "127.0.0.1";

/** @type {number} Default Ollama HTTP port (upstream default). */
const OPENCODE_OLLAMA_PORT = 11434;
/** @type {string[]} Models always included in every provider's model list, merged with any auto-discovered models. */
const OPENCODE_OLLAMA_FALLBACK_MODELS = ["qwen3.6:latest", "qwen2.5-coder:32b"];

/**
 * Fetches the installed model names from an Ollama host's `/api/tags`.
 * Returns an empty array on fetch failure or empty list.
 * @param {string} host - The Ollama host to query.
 * @returns {Promise<string[]>} Model names (e.g. ["qwen3.6:latest"]).
 */
async function _fetchOpencodeOllamaModels(host) {
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
 * Tries hosts in order, returns models from the first that responds.
 * @param {string[]} hosts - Hosts to try in priority order.
 * @returns {Promise<string[]>} Model names (e.g. ["qwen3.6:latest"]).
 */
async function _discoverModels(hosts) {
  for (const host of hosts) {
    const models = await _fetchOpencodeOllamaModels(host);
    if (models.length > 0) return models;
  }
  return [];
}

/**
 * Builds the opencode config object with both remote and local provider entries.
 * @param {string[]} modelNames - Model names shared across all providers.
 * @param {string|null} remoteHost - Resolved remote IP, or null if not found.
 * @param {string} localHost - Local fallback host.
 * @returns {object} The full opencode.json content.
 */
function _buildOpencodeConfig(modelNames, remoteHost, localHost) {
  const modelEntries = Object.fromEntries(modelNames.map((n) => [n, {}]));
  /** @type {Record<string, object>} */
  const providers = {};
  if (remoteHost) {
    providers["ollama-remote"] = {
      npm: "@ai-sdk/openai-compatible",
      name: `Ollama (${OPENCODE_OLLAMA_HOSTNAME} - http://${remoteHost}:${OPENCODE_OLLAMA_PORT}/v1)`,
      options: { baseURL: `http://${remoteHost}:${OPENCODE_OLLAMA_PORT}/v1` },
      models: modelEntries,
    };
  }
  providers["ollama-local"] = {
    npm: "@ai-sdk/openai-compatible",
    name: `Ollama (local - http://${localHost}:${OPENCODE_OLLAMA_PORT}/v1)`,
    options: { baseURL: `http://${localHost}:${OPENCODE_OLLAMA_PORT}/v1` },
    models: modelEntries,
  };
  return { $schema: "https://opencode.ai/config.json", provider: providers };
}

/**
 * Mirrors every file under ~/.claude/commands/ into ~/.config/opencode/commands/ as
 * symlinks so OpenCode (which does NOT fall through to ~/.claude/commands/ the way it
 * falls through to ~/.claude/CLAUDE.md for rules) picks up the same `/sy-*` slash
 * commands Claude Code uses. The cleanup pattern mirrors claude.js — wipe previously-
 * deployed entries before re-deploying — but since every entry we deploy here is a
 * symlink, "unlink the previous symlink-into-~/.claude/commands" replaces "delete the
 * file contents". No backup is made: the source of truth lives in ~/.claude/commands/
 * (itself rebuilt from software/scripts/advanced/llm/claude/commands/ by claude.js), and
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
 * Writes ~/.config/opencode/opencode.json with remote and local Ollama providers,
 * then mirrors all Claude Code slash commands into the opencode commands dir as symlinks.
 * Skips entirely when opencode is not installed.
 */
async function doWork() {
  if (!(await isBinaryFound("opencode"))) {
    log(">> Skipped opencode: not installed");
    return;
  }

  const remoteHost = await getHomeIPAddressForHostname(OPENCODE_OLLAMA_HOSTNAME);
  const hostsToTry = [remoteHost, OPENCODE_OLLAMA_DEFAULT_HOST].filter(Boolean);
  const discovered = await _discoverModels(hostsToTry);
  /** @type {Set<string>} Merged model set — discovered + always-include fallbacks. */
  const modelSet = new Set(discovered);
  for (const m of OPENCODE_OLLAMA_FALLBACK_MODELS) modelSet.add(m);
  const modelNames = [...modelSet].sort();
  if (discovered.length === 0) {
    log(
      `WARN opencode: no models reachable at ${hostsToTry.map((h) => `http://${h}:${OPENCODE_OLLAMA_PORT}/api/tags`).join(" or ")} — using fallback ${OPENCODE_OLLAMA_FALLBACK_MODELS.join(", ")}`,
    );
  } else {
    log(`>> opencode: discovered ${discovered.length} model(s): ${discovered.join(", ")}`);
  }

  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".config/opencode/opencode.json");
  await mkdir(path.dirname(targetPath));
  await backupConfigFile(targetPath);
  await writeJson(targetPath, _buildOpencodeConfig(modelNames, remoteHost, OPENCODE_OLLAMA_DEFAULT_HOST));
  log(">> opencode config written:", targetPath);

  await _syncOpencodeCommandSymlinks();
}

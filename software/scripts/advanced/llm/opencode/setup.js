/** Configures opencode with both remote and local Ollama providers. */

// SOURCE software/scripts/advanced/editor.common.js
// SOURCE software/scripts/advanced/llm/llm-common.js

/**
 * Builds the opencode config object dynamically from an array of providers.
 * @param {Array<{id: string, name: string, baseURL: string, models: Array<{name: string}>}>} providersArray - Simplified input schemas.
 * @param {Record<string, any>} [keybinds] - Optional keybind overrides to merge into config.
 * @returns {object} The full opencode.json content.
 */
function _buildOpencodeConfig(providersArray, keybinds) {
  const providers = {};

  for (const item of providersArray) {
    // Dynamically transform your simple array format: [{name: "x"}] -> {"x": {}}
    const modelsObject = Object.fromEntries(item.models.map((m) => [m.name, {}]));

    providers[item.id] = {
      npm: "@ai-sdk/openai-compatible",
      name: item.name,
      options: {
        baseURL: item.baseURL,
      },
      models: modelsObject,
    };
  }

  /** @type {Record<string, any>} */
  const out = {
    $schema: "https://opencode.ai/config.json",
    provider: providers,
  };

  if (keybinds && Object.keys(keybinds).length > 0) {
    out.keybinds = keybinds;
  }

  return out;
}

/**
 * Loads opencode-keys.common.jsonc and substitutes OS_KEY for the current platform.
 * Opencode uses "super" (= cmd) on macOS and "alt" on Windows/Linux — matching the
 * EDITOR_WINDOWS_OS_KEY / EDITOR_MAC_OS_KEYS fallback used by Sublime/Zed editor scripts.
 *
 * @param {boolean} [isOsMac] - Override for macOS detection. When omitted, uses the global is_os_mac flag.
 * @returns {Promise<Record<string, any>>} Resolved keybinds map (empty object if file missing).
 */
async function _loadOpencodeKeybinds(isOsMac) {
  /** @type {{ keybinds?: Record<string, any> } | null} */
  const raw = await readJson`software/scripts/advanced/llm/opencode/opencode-keys.common.jsonc`;
  if (!raw || !raw.keybinds) return {};

  const osKey = getEditorOsKey("opencode", isOsMac);
  /** @type {Record<string, any>} */
  const resolved = {};
  for (const [action, binding] of Object.entries(raw.keybinds)) {
    resolved[action] = typeof binding === "string" ? binding.replace(/OS_KEY/g, osKey) : binding;
  }
  return resolved;
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
 * Writes ~/.config/opencode/opencode.json with remote and local Ollama providers,
 * then mirrors all Claude Code slash commands into the opencode commands dir as symlinks.
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

  /** @type {Record<string, any>} Keybind overrides mirroring claude where they fit */
  const keybinds = await _loadOpencodeKeybinds();

  // Pass the unified provider schemas down cleanly here
  await writeJson(targetPath, _buildOpencodeConfig(OPENCODE_OLLAMA_PROVIDERS_INPUT, keybinds));
  log(">> opencode config written:", targetPath);

  await _syncOpencodeCommandSymlinks();
}

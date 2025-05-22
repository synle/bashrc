/** Deploys Claude Code keybindings to ~/.claude/keybindings.json with platform-specific OS_KEY resolution. Run: `bash run.sh --files="claude-code-keybindings.js"` */
// SOURCE software/scripts/advanced/editor.common.js

/** @type {string} Claude Code OS modifier key on macOS (meta = cmd in terminals). */
const CLAUDE_CODE_MAC_OS_KEY = "meta";

/** @type {object[]} Common keybindings loaded from JSONC. */
let CLAUDE_CODE_COMMON_KEY_BINDINGS;
/** @type {object[]} Windows/Linux-only keybindings loaded from JSONC. */
let CLAUDE_CODE_WINDOWS_ONLY_KEY_BINDINGS;

/**
 * Replaces OS_KEY placeholders in Claude Code keybinding context groups with the actual OS-specific modifier key.
 * Claude Code bindings use { context, bindings: { key: action } } format where OS_KEY appears in object keys.
 * @param {object[]} contextGroups - Array of { context, bindings } objects.
 * @param {string} osKeyToUse - The OS-specific modifier key to substitute (e.g. "alt", "meta").
 * @returns {object[]} Context groups with resolved binding keys.
 */
function _formatClaudeCodeKeybindings(contextGroups, osKeyToUse) {
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
 * Merges multiple arrays of Claude Code keybinding context groups, combining bindings for the same context.
 * @param  {...object[]} arrays - Arrays of { context, bindings } objects to merge.
 * @returns {object[]} Merged context groups with combined bindings.
 */
function _mergeContextGroups(...arrays) {
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
 * @param {boolean} [isOsMac] - Override for macOS detection. When omitted, uses the global is_os_mac flag.
 * @returns {object} Full Claude Code keybindings config with schema metadata.
 */
function _getClaudeCodeKeyConfig(isOsMac) {
  const isMac = isOsMac !== undefined ? isOsMac : is_os_mac;
  const osKey = isMac ? CLAUDE_CODE_MAC_OS_KEY : EDITOR_WINDOWS_OS_KEY;

  /** @type {object[]} Platform-specific bindings merged with common. */
  const merged = isMac
    ? _mergeContextGroups(CLAUDE_CODE_COMMON_KEY_BINDINGS)
    : _mergeContextGroups(CLAUDE_CODE_COMMON_KEY_BINDINGS, CLAUDE_CODE_WINDOWS_ONLY_KEY_BINDINGS);

  return {
    $schema: "https://www.schemastore.org/claude-code-keybindings.json",
    $docs: "https://code.claude.com/docs/en/keybindings",
    bindings: _formatClaudeCodeKeybindings(merged, osKey),
  };
}

/** Deploys Claude Code keybindings to ~/.claude/keybindings.json. */
async function doWork() {
  const targetDir = path.join(BASE_HOMEDIR_LINUX, ".claude");
  const targetPath = path.join(targetDir, "keybindings.json");

  if (!fs.existsSync(targetDir)) {
    log(">> Skipping Claude Code keybindings — ~/.claude not found");
    return;
  }

  log(">> Configuring Claude Code keybindings:", targetPath);

  CLAUDE_CODE_COMMON_KEY_BINDINGS = (await readJson`software/scripts/advanced/claude-code-keys.common.jsonc`) || [];
  CLAUDE_CODE_WINDOWS_ONLY_KEY_BINDINGS = (await readJson`software/scripts/advanced/claude-code-keys.windows.jsonc`) || [];

  // write to build file (one per platform)
  const comments = "Claude Code Keybindings";
  await writeBuildArtifact([
    {
      file: `${BUILD_DIR}/claude-code-keys`,
      data: _getClaudeCodeKeyConfig(false),
      isJson: true,
      comments,
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/claude-code-keys-mac`,
      data: _getClaudeCodeKeyConfig(true),
      isJson: true,
      comments,
      commentStyle: "json",
    },
  ]);

  // deploy to local system
  await backupConfigFile(targetPath);
  await writeJson(targetPath, _getClaudeCodeKeyConfig());
}

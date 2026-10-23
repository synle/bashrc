/** Claude Code setup: settings, JSONC-backed Sy or inline Ayu themes, keybindings, and shared guidance. */
// SOURCE software/scripts/advanced/llm/llm-common.js
// SOURCE software/scripts/advanced/editor.common.js

/** @type {string} Claude Code OS modifier key on macOS (meta = cmd in terminals). */
const CLAUDE_MAC_OS_KEY = "meta";

/** @type {object[]} Common keybindings loaded from JSONC. */
let CLAUDE_COMMON_KEY_BINDINGS;
/** @type {object[]} Windows/Linux-only keybindings loaded from JSONC. */
let CLAUDE_WINDOWS_ONLY_KEY_BINDINGS;

/**
 * Replaces OS_KEY placeholders in Claude Code keybinding context groups with the actual OS-specific modifier key.
 * Claude Code bindings use { context, bindings: { key: action } } format where OS_KEY appears in object keys.
 * @param {object[]} contextGroups - Array of { context, bindings } objects.
 * @param {string} osKeyToUse - The OS-specific modifier key to substitute (e.g. "alt", "meta").
 * @returns {object[]} Context groups with resolved binding keys.
 */
function _formatClaudeKeybindings(contextGroups, osKeyToUse) {
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
function _getKeyConfig(isOsMac) {
  const isMac = isOsMac !== undefined ? isOsMac : is_os_mac;
  const osKey = isMac ? CLAUDE_MAC_OS_KEY : LLM_WINDOWS_OS_KEY;

  /** @type {object[]} Platform-specific bindings merged with common. */
  const merged = isMac
    ? _mergeContextGroups(CLAUDE_COMMON_KEY_BINDINGS)
    : _mergeContextGroups(CLAUDE_COMMON_KEY_BINDINGS, CLAUDE_WINDOWS_ONLY_KEY_BINDINGS);

  return {
    $schema: "https://www.schemastore.org/claude-code-keybindings.json",
    $docs: "https://code.claude.com/docs/en/keybindings",
    bindings: _formatClaudeKeybindings(merged, osKey),
  };
}

/**
 * Loads keybinding configs, writes prebuilt configs per platform, and deploys to ~/.claude/keybindings.json.
 * @param {string} targetDir - Path to the ~/.claude directory.
 */
async function _doKeysWork(targetDir) {
  const targetPath = path.join(targetDir, "keybindings.json");

  log(">> Claude Code Keybindings:", targetPath);

  CLAUDE_COMMON_KEY_BINDINGS = (await readJson`software/scripts/advanced/llm/claude/claude-keys.common.jsonc`) || [];
  CLAUDE_WINDOWS_ONLY_KEY_BINDINGS = (await readJson`software/scripts/advanced/llm/claude/claude-keys.windows.jsonc`) || [];

  // write to build file (one per platform)
  const comments = "Claude Code Keybindings";
  await writeBuildArtifact([
    {
      file: `${BUILD_DIR}/claude-keys`,
      data: _getKeyConfig(false),
      isJson: true,
      comments,
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/claude-keys-mac`,
      data: _getKeyConfig(true),
      isJson: true,
      comments,
      commentStyle: "json",
    },
  ]);

  // deploy to local system — merge with existing, our managed bindings always override
  /** @type {object[]} Existing user keybinding context groups (empty if file missing or invalid). */
  let existingBindings = [];
  try {
    const data = JSON.parse(fs.readFileSync(targetPath, "utf-8"));
    if (data && Array.isArray(data.bindings)) existingBindings = data.bindings;
  } catch (e) {}

  const ourConfig = _getKeyConfig();
  // existing first, then ours on top — Object.assign in _mergeContextGroups means later wins
  ourConfig.bindings = _mergeContextGroups(existingBindings, ourConfig.bindings);

  await backupConfigFile(targetPath);
  await writeJson(targetPath, ourConfig);
}

// --- Themes ---

/**
 * Creates the theme folder, deploys the selected Sy or Ayu adapters, and resolves the native selection ID.
 * Uses the shared custom-theme routine for Sy/Ayu selection; headless hosts retain native themes.
 * Preserves light appearance across family changes.
 * @param {string} targetFolder - Claude user configuration folder.
 * @param {string|undefined} selectedTheme - Existing settings.json theme selection.
 * @returns {Promise<string>} Adapter ID or built-in fallback; source/backup/write errors propagate.
 */
async function _doClaudeTheme(targetFolder, selectedTheme) {
  const fallbackThemes = getTheme("claude");
  // Preserve light appearance when migrating the former Catppuccin fallback.
  const appearance = [
    "light",
    "light-ansi",
    "light-daltonized",
    "custom:sy-light",
    "custom:catppuccin-latte",
    fallbackThemes.light,
  ].includes(selectedTheme)
    ? "light"
    : "dark";
  if (!is_gui) return appearance;
  const useCustomTheme = shouldInstallCustomTheme();

  /**
   * Ayu Dark and Light palette defaults, separate from placeholder-generated Sy JSONC.
   * Source: https://github.com/ayu-theme/ayu-colors/tree/master/themes.
   * Selection alpha is flattened against editor.bg; light hover is flattened against ui.bg.
   * @type {Record<string, object>}
   */
  const CLAUDE_THEME_PALETTES_AYU_THEMES = {
    dark: {
      name: "Ayu Dark",
      foreground: "#bfbdb6",
      muted: "#5a6378",
      border: "#5a6378",
      accent: "#e6b450",
      shimmer: "#ffb454",
      info: "#73b8ff",
      success: "#70bf56",
      error: "#d95757",
      warning: "#ffb454",
      background: "#10141c",
      surface: "#141821",
      hover: "#1b1f29",
      selection: "#193155",
    },
    light: {
      name: "Ayu Light",
      foreground: "#5c6166",
      muted: "#828e9f",
      border: "#828e9f",
      accent: "#f29718",
      shimmer: "#eba400",
      info: "#478acc",
      success: "#6cbf43",
      error: "#e65050",
      warning: "#eba400",
      background: "#fcfcfc",
      surface: "#f8f9fa",
      hover: "#e7eaed",
      selection: "#d7e4f6",
    },
  };

  /** @type {Record<string, object>|undefined} Sy colors loaded only when selected; Ayu never depends on generated JSONC. */
  const CLAUDE_THEME_PALETTES_SY_THEMES = useCustomTheme
    ? {
        dark: await readJson`software/scripts/advanced/llm/claude/claude-color-dark.jsonc`,
        light: await readJson`software/scripts/advanced/llm/claude/claude-color-light.jsonc`,
      }
    : undefined;
  const palettes = useCustomTheme ? CLAUDE_THEME_PALETTES_SY_THEMES : CLAUDE_THEME_PALETTES_AYU_THEMES;
  const themeIds = Object.fromEntries(
    Object.keys(palettes).map((mode) => [mode, useCustomTheme ? `custom:sy-${mode}` : fallbackThemes[mode]]),
  );

  /** @type {string[]} Required semantic palette roles; validate both appearances before any write. */
  const requiredColorRoles = [
    "foreground",
    "muted",
    "border",
    "accent",
    "shimmer",
    "info",
    "success",
    "error",
    "warning",
    "background",
    "surface",
    "hover",
    "selection",
  ];
  // readJson returns an empty object on malformed JSONC; never deploy incomplete adapters.
  for (const [mode, palette] of Object.entries(palettes)) {
    if (!palette || typeof palette !== "object" || Array.isArray(palette)) {
      throw new Error(`Invalid Claude ${mode} palette: expected a JSONC palette object; retry after repairing the source`);
    }
    const { name, ...colors } = palette;
    if (
      typeof name !== "string" ||
      name.length === 0 ||
      Object.keys(colors).length !== requiredColorRoles.length ||
      !requiredColorRoles.every((role) => typeof colors[role] === "string" && /^#[0-9a-f]{6}$/.test(colors[role]))
    ) {
      throw new Error(
        `Invalid Claude ${mode} palette: expected a name and required six-digit hex color roles; retry after repairing the source`,
      );
    }
  }

  const themesFolder = path.join(targetFolder, "themes");
  await mkdir(themesFolder);
  for (const [mode, palette] of Object.entries(palettes)) {
    const targetPath = path.join(themesFolder, `${themeIds[mode].slice("custom:".length)}.json`);
    /** @type {object} Native Claude theme; unmapped syntax and diff tokens inherit the built-in base. */
    const theme = {
      name: palette.name,
      base: mode,
      overrides: {
        claude: palette.accent,
        claudeShimmer: palette.shimmer,
        text: palette.foreground,
        inverseText: palette.background,
        inactive: palette.muted,
        subtle: palette.border,
        permission: palette.info,
        permissionShimmer: palette.accent,
        promptBorder: palette.accent,
        promptBorderShimmer: palette.shimmer,
        planMode: palette.info,
        autoAccept: palette.success,
        success: palette.success,
        error: palette.error,
        warning: palette.warning,
        warningShimmer: palette.warning,
        remember: palette.accent,
        userMessageBackground: palette.surface,
        userMessageBackgroundHover: palette.hover,
        bashMessageBackgroundColor: palette.surface,
        memoryBackgroundColor: palette.surface,
        selectionBg: palette.selection,
        composerSidebarBackground: palette.background,
      },
    };
    await backupConfigFile(targetPath);
    await writeJson(targetPath, theme);
  }

  return themeIds[appearance];
}

// --- Settings ---

/**
 * Managed settings to merge into ~/.claude/settings.json.
 * Only these keys are touched — all other user settings are preserved.
 *
 * When adding a new managed setting, also update the settings-intent table in
 * `software/scripts/advanced/llm/llm.md` so cross-CLI parity stays
 * visible at review time (intent must be implemented in copilot/gemini/opencode
 * too, or explicitly marked n/a there).
 *
 * @type {Record<string, any>}
 */
const CLAUDE_MANAGED_SETTINGS = {
  // Select only the model ID; [1m] explicitly overrides the native context-window choice.
  model: "claude-opus-4-7",
  // skip confirmation prompt before entering bypass permissions mode. tradeoff: no safety prompt. risk: medium
  skipDangerousModePermissionPrompt: true,
  // auto-delete session files older than 30 days. tradeoff: lose old history. risk: low
  cleanupPeriodDays: 30,
  // hide tips in the loading spinner. tradeoff: miss occasional tips. risk: none
  spinnerTipsEnabled: false,
  // reduce UI animations for cleaner output. tradeoff: less visual feedback. risk: none
  prefersReducedMotion: true,
  // show more detail in transcript by default. tradeoff: noisier output. risk: none
  viewMode: "verbose",
  // enable extended thinking by default for better quality. tradeoff: more tokens, slightly slower. risk: low
  alwaysThinkingEnabled: true,
  // drop commit/PR attribution trailers and the claude.ai session link. tradeoff: work not attributed to Claude. risk: none
  attribution: {
    commit: "",
    pr: "",
    sessionUrl: false,
  },
};

/**
 * Merges managed defaults, deploys Sy themes, and migrates the former managed [1m] model selection.
 * Preserves explicit user model choices and unrelated settings; replaces the theme selection.
 * @param {string} targetDir - Path to the ~/.claude folder.
 * @returns {Promise<void>} Resolves after backing up and writing settings; write errors propagate.
 */
async function _doSettingsWork(targetDir) {
  const targetPath = path.join(targetDir, "settings.json");

  log(">> Claude Code Settings:", targetPath);

  /** @type {object} Existing user settings (empty object if file missing or invalid). */
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(targetPath, "utf-8")) || {};
  } catch (e) {}

  // merge: managed settings are applied as defaults, existing user overrides are preserved
  const merged = { ...CLAUDE_MANAGED_SETTINGS, ...existing };
  // Retire only our former default, not arbitrary user-selected context variants.
  if (merged.model === "claude-opus-4-7[1m]") merged.model = CLAUDE_MANAGED_SETTINGS.model;
  merged.theme = await _doClaudeTheme(targetDir, existing.theme);

  mergeLLMHookEntry(merged, "UserPromptSubmit", {
    hooks: [
      {
        type: "command",
        command: process.execPath,
        args: [LLM_PERSONA_HOOK_HELPER_PATH, "claude", LLM_PERSONA_REMINDER],
      },
    ],
  });

  await backupConfigFile(targetPath);
  await writeJson(targetPath, merged);
}

// --- Instructions (User-Level CLAUDE.md) ---

/**
 * Deploys stack-agnostic engineering principles into ~/.claude/CLAUDE.md between BEGIN/END markers.
 * The markdown source uses backticks for inline code; readText returns the file content verbatim
 * (only the path argument is a template literal), and the content flows into replaceBlock as a
 * plain string — no re-templating, so backticks are safe here.
 * Existing user content outside the marker block is preserved.
 * @param {string} targetDir - Path to the ~/.claude directory.
 */
async function _doInstructionsWork(targetDir) {
  const targetPath = path.join(targetDir, "CLAUDE.md");

  log(">> Claude Code Instructions:", targetPath);

  /** @type {string} The markdown source for the managed engineering principles block. */
  const sourceContent = await getLLMCustomInstructions();

  /** @type {string} Existing CLAUDE.md content (empty if file is missing). */
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
  // insertMode: "append" creates the block when CLAUDE.md is brand new or the markers are missing.
  // Then refresh any user-authored `<!-- BEGIN <label> | <path> -->` block already in the file.
  const merged =
    refreshPathKeyedBlocks(replaceBlock(existing, LLM_INSTRUCTIONS_MARKER, sourceContent, "<!--", " -->", "append")).trim() + "\n";

  await backupConfigFile(targetPath);
  await writeText(targetPath, merged);
}

/**
 * Orchestrates Claude Code settings, native user MCP, keybindings, and skills.
 * @returns {Promise<void>} Resolves after deployment; MCP validation and IO errors propagate.
 */
async function doWork() {
  const targetDir = path.join(BASE_HOMEDIR_LINUX, ".claude");

  if (!fs.existsSync(targetDir)) {
    log(">> Skipping Claude Code setup — ~/.claude not found");
    return;
  }

  log(">> Configuring Claude Code:", targetDir);

  await _doSettingsWork(targetDir);
  // User-scoped MCP belongs in ~/.claude.json, not ~/.claude/settings.json.
  await deploySharedMcpServers(path.join(BASE_HOMEDIR_LINUX, ".claude.json"), {}, "standard", "claude");
  await _doKeysWork(targetDir);
  // Skills are written once to $LLM_ROOT_FOLDER/skills and symlinked into
  // ~/.claude/skills — no CLI-local copy of a command body exists anymore.
  await deploySharedLLMSkills();
  // Shared on-demand instruction files must exist before the always-loaded block
  // that points at them. Safe to run from every CLI — writeText no-ops when unchanged.
  await deploySharedLLMInstructions();
  await _doInstructionsWork(targetDir);

  // Named worker agents. Rendered per CLI from one shared source — see
  // LLM_AGENT_DEPLOY_FOLDERS. Safe to call from every setup script: the bytes are
  // deterministic, so whichever CLI runs first does the work and the rest no-op,
  // and each CLI stays able to repair the shared corpus on its own.
  await deploySharedLLMAgents();
}

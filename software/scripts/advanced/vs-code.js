/** VS Code editor setup: settings, keybindings, color customizations, extensions installer scripts, and devcontainer.json sync. Mirrors sublime-text.js / sublime-merge.js / zed.js. */
// SOURCE software/scripts/advanced/editor.common.js

////// Constants //////

/** @type {string} VS Code dark color theme name (resolved from editor.common.js). */
const VS_CODE_DARK_THEME = VSCODE_DARK_COLOR_THEME;
/** @type {string} VS Code light color theme name (resolved from editor.common.js). */
const VS_CODE_LIGHT_THEME = VSCODE_LIGHT_COLOR_THEME;

/**
 * Single source of truth for VS Code extensions installed across all platforms.
 * Mirrored to `.devcontainer/devcontainer.json` (codespaces) and `.build/vs-code-ext-{mac,linux,windows}` (CLI installer scripts).
 */
const TO_INSTALL_EXTENSIONS = list`
  // theme & icons
  dracula-theme.theme-dracula
  PKief.material-icon-theme
  oderwat.indent-rainbow
  aaron-bond.better-comments

  // formatting & linting
  esbenp.prettier-vscode
  dbaeumer.vscode-eslint
  streetsidesoftware.code-spell-checker

  // refactor & utilities
  wmaurer.change-case
  nicoespeon.abracadabra
  formulahendry.code-runner
  dakara.transformer

  // languages
  redhat.vscode-yaml
  wholroyd.jinja
  clinyong.vscode-css-modules
  andrejunges.handlebars
`;

/**
 * Deprecated / unwanted extensions that prior versions of this repo or VS Code
 * itself may have auto-installed. Each setup run actively removes them so old
 * machines stop carrying them around. IntelliCode in particular used to be
 * bundled by default and is now superseded by the built-in copilot/AI features.
 */
const TO_UNINSTALL_EXTENSIONS = list`
  visualstudioexptteam.vscodeintellicode
  visualstudioexptteam.intellicode-api-usage-examples
`;

////// Path Discovery //////

/**
 * Returns the list of `User/` config directories for every detected VS Code install
 * (stable + Insiders, native + WSL Windows host, Linux Flatpak).
 * @returns {string[]} Absolute paths to each `<Code>/User` folder. May be empty.
 */
function _getVSCodeUserPaths() {
  const roots = _getVSCodePaths();
  return roots.map((r) => path.join(r, "User"));
}

////// Settings //////

/**
 * Derives the `terminal.integrated.commandsToSkipShell` list from the resolved keybindings.
 * VS Code's terminal forwards keypresses to the shell by default — alt+X / cmd+X chords get
 * eaten as meta sequences (bash readline, etc.) before VS Code can fire the bound command.
 * Adding the command IDs to this list bypasses the shell so those bindings fire from terminal
 * focus too. We include every binding whose first chord starts with `alt+` or `cmd+` (i.e.,
 * uses the OS modifier) — `when` clauses still apply, so this is safe for editor-only
 * bindings. Generic so new OS_KEY+X bindings "just work" without hand-maintaining a skip list.
 * @param {object[]} keybindings - Resolved keybinding array (post OS_KEY substitution).
 * @returns {string[]} Sorted, deduped command IDs.
 */
function _getCommandsToSkipShell(keybindings) {
  const cmds = new Set();
  for (const kb of keybindings) {
    if (typeof kb.key !== "string" || !kb.command) continue;
    // Take the first chord (chords are space-separated, e.g. "ctrl+k ctrl+s").
    const firstChord = kb.key.split(/\s+/)[0];
    if (/^(alt|cmd)\+/i.test(firstChord)) {
      cmds.add(kb.command);
    }
  }
  return Array.from(cmds).sort();
}

/**
 * Builds the merged VS Code settings object: starts from `vs-code-config.jsonc`, layers
 * EDITOR_CONFIGS-driven editor/font/terminal/ignored-files settings, overlays the dark
 * and light high-contrast color schemes inside `[Theme Name]` scopes so each theme keeps
 * its own customizations, pins the dark/light theme names, and auto-populates
 * `terminal.integrated.commandsToSkipShell` from `keybindings` so OS_KEY+X bindings fire
 * from terminal focus.
 * @param {object} baseConfig - Parsed `vs-code-config.jsonc`.
 * @param {object} darkColors - Parsed `vs-code-color-dark.jsonc` (workbench.colorCustomizations + editor.tokenColorCustomizations).
 * @param {object} lightColors - Parsed `vs-code-color-light.jsonc`.
 * @param {object[]} keybindings - Resolved keybinding array used to auto-derive the skip-shell list.
 * @param {object} options - Build options.
 * @param {boolean} [options.is_prebuilt_config] - When true, use safe fallback fonts/sizes for shipped artifacts.
 * @param {boolean} [options.isOsMac] - When true, override `editor.multiCursorModifier` to `"alt"` so Cmd+click opens terminal links on macOS. Defaults to the global `is_os_mac` flag.
 * @returns {object} The fully resolved settings.json content.
 */
function _getSettings(baseConfig, darkColors, lightColors, keybindings, { is_prebuilt_config = false, isOsMac } = {}) {
  const fontFamily = is_prebuilt_config ? EDITOR_CONFIGS.fontFamilyDefaultFallback : EDITOR_CONFIGS.fontFamily;
  const fontSize = is_prebuilt_config ? EDITOR_CONFIGS.fontSizeDefaultFallback : EDITOR_CONFIGS.fontSize;
  // VS Code ties the terminal link-click modifier to the inverse of editor.multiCursorModifier.
  // Mac: "alt" → Cmd+click opens terminal links. Win/Linux: "ctrlCmd" → Alt+click opens terminal links.
  const isMac = isOsMac !== undefined ? isOsMac : is_os_mac;
  const multiCursorModifier = isMac ? "alt" : "ctrlCmd";

  return {
    ...baseConfig,
    "editor.multiCursorModifier": multiCursorModifier,

    // --- Typography ---
    "editor.fontFamily": fontFamily,
    "editor.fontSize": fontSize,
    "editor.fontWeight": EDITOR_CONFIGS.fontWeightNumber,
    "terminal.integrated.fontFamily": fontFamily,
    "terminal.integrated.fontSize": fontSize,

    // --- Editing ---
    "editor.tabSize": EDITOR_CONFIGS.tabSize,
    "editor.rulers": [EDITOR_CONFIGS.maxLineSize],
    "editor.wordWrapColumn": EDITOR_CONFIGS.maxLineSize,

    // --- Terminal scrollback (mirrors all other terminals) ---
    "terminal.integrated.scrollback": EDITOR_CONFIGS.terminalScrollback,

    // --- Theme: pin dark/light names so window.autoDetectColorScheme has known values ---
    "workbench.colorTheme": VS_CODE_DARK_THEME,
    "workbench.preferredDarkColorTheme": VS_CODE_DARK_THEME,
    "workbench.preferredLightColorTheme": VS_CODE_LIGHT_THEME,

    // --- Per-theme color customizations (scoped under [Theme Name] keys) ---
    [`[${VS_CODE_DARK_THEME}]`]: {
      "workbench.colorCustomizations": darkColors["workbench.colorCustomizations"] || {},
      "editor.tokenColorCustomizations": darkColors["editor.tokenColorCustomizations"] || {},
    },
    [`[${VS_CODE_LIGHT_THEME}]`]: {
      "workbench.colorCustomizations": lightColors["workbench.colorCustomizations"] || {},
      "editor.tokenColorCustomizations": lightColors["editor.tokenColorCustomizations"] || {},
    },

    // --- File hiding (sidebar + search) ---
    "files.exclude": Object.fromEntries(EDITOR_CONFIGS.ignoredFiles.concat(EDITOR_CONFIGS.ignoredFolders).map((p) => [p, true])),
    "search.exclude": Object.fromEntries(EDITOR_CONFIGS.ignoredFiles.concat(EDITOR_CONFIGS.ignoredFolders).map((p) => [p, true])),
    "files.watcherExclude": Object.fromEntries(EDITOR_CONFIGS.ignoredFolders.map((p) => [p, true])),

    // --- Auto-derived: every OS_KEY+X binding bypasses the shell so it fires from terminal focus too ---
    "terminal.integrated.commandsToSkipShell": _getCommandsToSkipShell(keybindings),
  };
}

////// Keybindings //////

/**
 * Returns the merged VS Code keybinding array for the given OS, with `OS_KEY` placeholders
 * resolved to the OS-specific modifier (cmd on macOS, alt on Windows/Linux).
 * VS Code's keybindings.json schema uses a singular string `key` field, NOT the `keys` array
 * that `formatEditorKeybindings` writes for Sublime/Zed — so we re-flatten back to `key` here.
 * @param {object[]} commonKeyBindings - Parsed `vs-code-keys.common.jsonc`.
 * @param {object[]} windowsKeyBindings - Parsed `vs-code-keys.windows.jsonc`.
 * @param {boolean} [isOsMac] - Override for macOS detection. When omitted, uses the global is_os_mac flag.
 * @returns {object[]} Array of resolved keybinding objects ready to write to `keybindings.json`.
 */
function _getKeyConfigs(commonKeyBindings, windowsKeyBindings, isOsMac) {
  const isMac = isOsMac !== undefined ? isOsMac : is_os_mac;
  // VS Code uses `cmd` on macOS, `alt` on Windows/Linux.
  const osKey = isMac ? "cmd" : EDITOR_WINDOWS_OS_KEY;
  const merged = isMac ? commonKeyBindings : [...commonKeyBindings, ...windowsKeyBindings];

  // Substitute OS_KEY directly on the singular `key` string — don't go through
  // formatEditorKeybindings (which collapses key→keys for Sublime/Zed).
  return clone(merged).map((kb) => {
    const out = { ...kb };
    if (typeof out.key === "string") {
      out.key = out.key.replace(/OS_KEY/g, osKey);
    }
    return out;
  });
}

////// Extensions Installer Script //////

/**
 * Builds the bash installer script that first uninstalls every entry in
 * `TO_UNINSTALL_EXTENSIONS` (deprecated / unwanted), then runs
 * `code --install-extension <id>` for every entry in `TO_INSTALL_EXTENSIONS`.
 * Used as the `.build/vs-code-ext-{os}` artifact downloaded by
 * `advanced/vs-code-ext.sh`.
 * @returns {string} Bash script content.
 */
function _getExtInstallScript() {
  const extLines = TO_INSTALL_EXTENSIONS.map((ext) => `  "${ext}"`).join("\n");
  const uninstallLines = TO_UNINSTALL_EXTENSIONS.map((ext) => `  "${ext}"`).join("\n");
  return `#!/usr/bin/env bash
# ${getAutoGeneratedText().trim()}
set -u
deprecated_extensions=(
${uninstallLines}
)
extensions=(
${extLines}
)
if ! type -P code > /dev/null 2>&1; then
  echo ">>> Skipped : 'code' binary not on PATH"
  exit 0
fi
for ext in "\${deprecated_extensions[@]}"; do
  if code --list-extensions 2>/dev/null | grep -qix "$ext"; then
    echo ">> Uninstalling deprecated VS Code extension: $ext"
    code --uninstall-extension "$ext" || true
  fi
done
for ext in "\${extensions[@]}"; do
  echo ">> Installing VS Code extension: $ext"
  code --install-extension "$ext" --force || true
done
`;
}

////// Devcontainer Sync //////

/**
 * Updates `.devcontainer/devcontainer.json` so its `customizations.vscode.extensions`
 * array matches `TO_INSTALL_EXTENSIONS` (single source of truth).
 * Skipped silently when the file does not exist (e.g., in a partial checkout).
 */
async function _updateDevcontainerExtensions() {
  const devcontainerPath = ".devcontainer/devcontainer.json";
  let devcontainer;
  try {
    devcontainer = await readJson`${devcontainerPath}`;
  } catch (e) {
    log(">>> Skipped devcontainer.json sync (file not readable):", e.message);
    return;
  }
  if (!devcontainer || typeof devcontainer !== "object") {
    log(">>> Skipped devcontainer.json sync (empty/invalid)");
    return;
  }

  devcontainer.customizations = devcontainer.customizations || {};
  devcontainer.customizations.vscode = devcontainer.customizations.vscode || {};
  devcontainer.customizations.vscode.extensions = TO_INSTALL_EXTENSIONS;

  await backupConfigFile(devcontainerPath);
  await writeJson(devcontainerPath, devcontainer);
  log(">>> Synced .devcontainer/devcontainer.json extensions list");
}

////// Main Entry Point //////

/**
 * Orchestrates VS Code setup: writes settings + keybindings to every detected install
 * (stable, Insiders, WSL Windows host), syncs the devcontainer extensions list, and
 * queues prebuilt build artifacts for the bash/PowerShell setup paths.
 * Build artifacts are batched into one `writeBuildArtifact` call because in CI it
 * throws `ScriptSkipError` after the first invocation.
 */
async function doWork() {
  const userPaths = _getVSCodeUserPaths();
  log(">>> VS Code User config paths:", userPaths.length ? userPaths : "[none found]");

  // --- Read source files ---
  const baseConfig = (await readJson`software/scripts/advanced/vs-code-config.jsonc`) || {};
  const darkColors = (await readJson`software/scripts/advanced/vs-code-color-dark.jsonc`) || {};
  const lightColors = (await readJson`software/scripts/advanced/vs-code-color-light.jsonc`) || {};
  const commonKeyBindings = (await readJson`software/scripts/advanced/vs-code-keys.common.jsonc`) || [];
  const windowsKeyBindings = (await readJson`software/scripts/advanced/vs-code-keys.windows.jsonc`) || [];

  // --- Local system: write settings + keybindings into each detected install ---
  const localKeybindings = _getKeyConfigs(commonKeyBindings, windowsKeyBindings);
  for (const userPath of userPaths) {
    log(">>> Deploying to local VS Code install:", userPath);

    const settingsPath = path.join(userPath, "settings.json");
    await backupConfigFile(settingsPath);
    await writeJson(settingsPath, _getSettings(baseConfig, darkColors, lightColors, localKeybindings, { is_prebuilt_config: false }));

    const keybindingsPath = path.join(userPath, "keybindings.json");
    await backupConfigFile(keybindingsPath);
    await writeJson(keybindingsPath, localKeybindings);
  }

  // --- Devcontainer extensions list (single source of truth) ---
  await _updateDevcontainerExtensions();

  // --- Prebuilt build artifacts (used by setup scripts and the webapp) ---
  // Use the union of mac + windows/linux keybindings so the prebuilt skip-shell list covers
  // every OS the artifact might land on (extra entries are harmless on the wrong OS).
  log(">>> Writing prebuilt VS Code build artifacts");
  const prebuiltKeybindings = [
    ..._getKeyConfigs(commonKeyBindings, windowsKeyBindings, false),
    ..._getKeyConfigs(commonKeyBindings, windowsKeyBindings, true),
  ];
  // Prebuilt artifact targets Linux (codespaces, devcontainer) — pin isOsMac=false so the
  // built-on-Mac case doesn't leak "alt" into the Linux settings file.
  const settingsArtifact = _getSettings(baseConfig, darkColors, lightColors, prebuiltKeybindings, {
    is_prebuilt_config: true,
    isOsMac: false,
  });
  await writeBuildArtifact([
    {
      file: `${BUILD_DIR}/vs-code-config`,
      data: settingsArtifact,
      isJson: true,
      comments: "VS Code settings.json (drop into <Code>/User/)",
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/vs-code-color-dark`,
      data: darkColors,
      isJson: true,
      comments: "VS Code dark color customizations",
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/vs-code-color-light`,
      data: lightColors,
      isJson: true,
      comments: "VS Code light color customizations",
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/vs-code-keys-windows`,
      data: _getKeyConfigs(commonKeyBindings, windowsKeyBindings, false),
      isJson: true,
      comments: "VS Code keybindings.json (Windows/Linux)",
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/vs-code-keys-linux`,
      data: _getKeyConfigs(commonKeyBindings, windowsKeyBindings, false),
      isJson: true,
      comments: "VS Code keybindings.json (Linux)",
      commentStyle: "json",
    },
    {
      file: `${BUILD_DIR}/vs-code-keys-mac`,
      data: _getKeyConfigs(commonKeyBindings, windowsKeyBindings, true),
      isJson: true,
      comments: "VS Code keybindings.json (macOS)",
      commentStyle: "json",
    },
    { file: `${BUILD_DIR}/vs-code-ext-mac`, data: _getExtInstallScript() },
    { file: `${BUILD_DIR}/vs-code-ext-linux`, data: _getExtInstallScript() },
    { file: `${BUILD_DIR}/vs-code-ext-windows`, data: _getExtInstallScript() },
  ]);
}

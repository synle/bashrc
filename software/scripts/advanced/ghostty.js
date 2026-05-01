/** Ghostty terminal config: writes ~/.config/ghostty/config with base settings + keybindings driven by ghostty-keys.common.jsonc. The single terminal emulator config across macOS and Linux, using the shared OS_KEY pattern (cmd on mac, alt on linux). Skipped on Windows / mingw64 / Android Termux — Ghostty is unavailable there. */
// SOURCE software/scripts/advanced/editor.common.js

/**
 * Resolves the on-disk Ghostty config path. Ghostty reads `$XDG_CONFIG_HOME/ghostty/config`
 * on every supported platform (on macOS it ALSO reads `~/Library/Application Support/com.mitchellh.ghostty/config`,
 * but XDG works there too — using one canonical path keeps the script simple).
 * @returns {string} Absolute path to the Ghostty config file.
 */
function _getGhosttyConfigPath() {
  return path.join(BASE_HOMEDIR_LINUX, ".config/ghostty/config");
}

/**
 * Loads the keybindings JSONC and substitutes `OS_KEY` for the given platform.
 * @param {boolean} isOsMac - Whether to render the macOS variant (cmd) vs Linux (alt).
 * @returns {Promise<object[]>} Array of `{ keys: ["cmd+t"], action: "new_tab" }` objects.
 */
async function _getKeyBindings(isOsMac) {
  const raw = (await readJson`software/scripts/advanced/ghostty-keys.common.jsonc`) || [];
  const osKey = getEditorOsKey("ghostty", isOsMac);
  return formatEditorKeybindings(raw, osKey);
}

/**
 * Formats the resolved keybindings into Ghostty's `keybind = trigger=action` syntax.
 * formatEditorKeybindings normalizes each entry to `{ keys: [trigger], action }`.
 * @param {object[]} bindings - Resolved keybinding objects.
 * @returns {string} Newline-joined `keybind = ...` lines.
 */
function _renderKeybindLines(bindings) {
  return bindings.map((b) => `keybind = ${b.keys[0]}=${b.action}`).join("\n");
}

/**
 * Builds the full Ghostty config text: base settings (font, theme, scrollback, etc.)
 * followed by the resolved keybind lines for the target platform.
 * @param {boolean} isOsMac - Render the macOS variant (cmd) when true, Linux (alt) when false.
 * @returns {Promise<string>} Full text of `~/.config/ghostty/config`.
 */
async function _buildConfigContent(isOsMac) {
  const fontFamily = EDITOR_CONFIGS.fontFamily;
  const fontSize = EDITOR_CONFIGS.fontSize;
  const scrollback = EDITOR_CONFIGS.terminalScrollback;
  const bindings = await _getKeyBindings(isOsMac);

  // macOS-only block: option-as-alt is required for readline word-jumps, the
  // tabs-in-titlebar style matches modern Mac apps, and a cmd+grave quick
  // terminal gives a Quake-style drop-down. Skipped on Linux where most of
  // these settings either don't apply or use a different keybind.
  const macOnlyBlock = isOsMac
    ? code`

        # ---- macOS-specific ----
        macos-option-as-alt = true
        macos-titlebar-style = tabs
        macos-non-native-fullscreen = visible-menu
        quit-after-last-window-closed = true
        keybind = global:cmd+grave_accent=toggle_quick_terminal
        quick-terminal-position = top
        quick-terminal-animation-duration = 0.1
        quick-terminal-screen = mouse
      `
    : "";

  return code`
    # ---- Typography ----
    font-family = ${fontFamily}
    font-size = ${fontSize}
    # Render the regular face in bold by default — matches the user's "heavy" look.
    font-style = bold
    font-style-italic = bold italic

    # ---- Theme (auto-switch with OS appearance, high-contrast both ways) ----
    # GitHub's high-contrast pair: maximum readability in either mode.
    theme = light:GitHub Light High Contrast,dark:GitHub Dark High Contrast

    # ---- Shell integration ----
    # Auto-detect bash/zsh/fish; enable sudo askpass integration and dynamic
    # window title from the shell. Cursor-shape control is intentionally
    # OMITTED so the shell can't override our \`cursor-style = block\` to a
    # bar/beam in insert mode.
    shell-integration = detect
    shell-integration-features = sudo,title
    # New tabs/splits/windows open in the same cwd as the active pane.
    working-directory = inherit

    # ---- Window / Behavior ----
    scrollback-limit = ${scrollback}
    mouse-hide-while-typing = true
    copy-on-select = false
    confirm-close-surface = false
    window-padding-x = 6
    window-padding-y = 6
    # Even padding on both sides of a split, regardless of split orientation.
    window-padding-balance = true
    window-save-state = always

    # ---- Splits (focus visibility) ----
    # Aggressive dimming on unfocused splits so the active pane is obvious in
    # both light and dark modes. Default is ~0.7; lower = more contrast.
    unfocused-split-opacity = 0.65
    # Mid-tone gray fill so unfocused panes are visibly tinted in BOTH modes:
    # in light mode the gray darkens them, in dark mode it lightens them.
    # (Ghostty has no light:/dark: variant for this setting, so we need a
    # color that contrasts against both backgrounds — pure black would be a
    # no-op against a near-black dark theme.)
    unfocused-split-fill = #808080
    # Vibrant divider line between splits — uses GitHub's high-contrast blue
    # accent so the boundary between focused and unfocused panes is obvious.
    split-divider-color = #0969da

    # ---- Cursor ----
    cursor-style = block
    cursor-style-blink = true
    ${macOnlyBlock}

    # ---- Keybindings (managed by software/scripts/advanced/ghostty.js) ----
    ${_renderKeybindLines(bindings)}
  `;
}

/**
 * Main entry. Writes prebuilt mac + linux config build artifacts and, when running
 * on a supported OS, deploys the resolved config to ~/.config/ghostty/config.
 */
async function doWork() {
  // ---- Prebuilt artifacts (used by setup scripts and webapp downloads) ----
  const macContent = await _buildConfigContent(true);
  const linuxContent = await _buildConfigContent(false);

  await writeBuildArtifact([
    {
      file: `${BUILD_DIR}/ghostty-config-mac`,
      data: `# ~/.config/ghostty/config (macOS variant — OS_KEY = cmd)\n\n${macContent}`,
    },
    {
      file: `${BUILD_DIR}/ghostty-config-linux`,
      data: `# ~/.config/ghostty/config (Linux variant — OS_KEY = alt)\n\n${linuxContent}`,
    },
  ]);

  // ---- Skip writing locally on platforms where Ghostty is unavailable ----
  if (is_os_windows || is_os_mingw64 || is_os_android_termux) {
    log(">>> Skipped (Ghostty not supported on this OS)");
    return;
  }

  // ---- Deploy to local install ----
  const targetPath = _getGhosttyConfigPath();
  log(">>> Ghostty config path:", targetPath);

  await mkdir(path.dirname(targetPath));
  await backupConfigFile(targetPath);
  await writeText(targetPath, is_os_mac ? macContent : linuxContent);
}

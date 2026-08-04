/** Wires shared LSP server binaries into Zed by overlaying an `lsp.<name>.binary.path` block on top of the user's existing settings.json. Independent of the install layer (lsp/install.sh) — both ship in separate PRs. */
// SOURCE software/scripts/advanced/lsp/lsp-common.js

/**
 * Locates the Zed config directory across platforms. Re-implemented locally rather than
 * imported from `software/scripts/advanced/zed.js` so the LSP wiring is decoupled from the main
 * Zed setup script — each script owns its own discovery.
 *
 * Returns the path containing settings.json + themes/, or null if not found.
 * macOS / Linux: ~/.config/zed
 * Windows native: %APPDATA%/Zed
 * WSL → Windows host: /mnt/c/Users/<user>/AppData/Roaming/Zed
 *
 * @returns {Promise<string|null>} Absolute path to the Zed config dir, or null.
 */
async function _getPathZed() {
  /** @type {string[]} Candidate config-dir locations to probe in order; first existing folder wins. */
  const candidates = [];
  if (is_os_windows) {
    candidates.push(path.join(getWindowAppDataRoamingUserPath(), "Zed"));
  }
  if (is_os_mac || is_os_ubuntu || is_os_arch_linux || is_os_redhat || is_os_steamos || is_os_chromeos) {
    candidates.push(path.join(BASE_HOMEDIR_LINUX, ".config/zed"));
  }
  for (const candidate of candidates) {
    if (pathExists(candidate)) return candidate;
  }
  return null;
}

/**
 * Reads the current Zed settings.json into a plain object, returning `{}` when the file is
 * missing or unparseable so the overlay merge below has a stable starting point. We don't
 * want a malformed settings.json to abort the run — overwriting with a fresh `lsp` block on
 * top of `{}` is still a strict improvement.
 *
 * @param {string} settingsPath - Absolute path to Zed's settings.json.
 * @returns {Promise<object>} Parsed settings object (may be empty).
 */
async function _readExistingZedSettings(settingsPath) {
  if (!pathExists(settingsPath)) return {};
  try {
    return (await readJson`${settingsPath}`) || {};
  } catch (e) {
    log(">>> zed-lsp: existing settings.json unreadable — starting from empty object:", e.message);
    return {};
  }
}

/**
 * Main entry: overlays an `lsp` block onto Zed's settings.json (when Zed is locally
 * installed) and queues a prebuilt artifact at `${BUILD_DIR}/zed-lsp-config` so the same
 * block can be served via the raw URL for prebuilt-setup paths.
 */
async function doWork() {
  const lspBlock = buildZedLspBlock();

  // --- Local Zed install: merge the lsp block into existing settings.json ---
  const targetPath = await _getPathZed();
  if (targetPath) {
    log(">>> zed-lsp: deploying to local Zed install:", targetPath);
    const settingsPath = path.join(targetPath, "settings.json");
    const existing = await _readExistingZedSettings(settingsPath);

    /** @type {object} Merged settings — preserve every existing top-level key, replace `lsp` with our managed block. Replacing (not deep-merging) so removed entries from `LSP_SERVERS` actually disappear. */
    const merged = { ...existing, lsp: { ...(existing.lsp || {}), ...lspBlock } };

    await backupConfigFile(settingsPath);
    await writeJson(settingsPath, merged);
  } else {
    log(">>> zed-lsp: Zed config dir not found — skipping local deploy");
  }

  // --- Prebuilt artifact (raw URL consumers + webapp) ---
  log(">>> zed-lsp: writing prebuilt artifact zed-lsp-config");
  await writeBuildArtifact([
    {
      file: `${BUILD_DIR}/zed-lsp-config`,
      data: { lsp: lspBlock },
      isJson: true,
      comments: "Zed LSP server binary overrides — merge into <Zed>/settings.json",
      commentStyle: "json",
    },
  ]);
}

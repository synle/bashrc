/** Configures Audacity: 48kHz/32-bit float defaults, overdub enabled, latency tuning, auto-scroll, update check disabled. */
/**
 * Finds the Audacity config file path across platforms.
 * @returns {string|undefined} Path to audacity.cfg, or undefined if not found.
 */
function _getAudacityCfgPath() {
  const candidates = [
    path.join(BASE_HOMEDIR_LINUX, ".config/audacity/audacity.cfg"), // Linux (3.x+)
    path.join(BASE_HOMEDIR_LINUX, ".audacity-data/audacity.cfg"), // Linux (older)
    path.join(BASE_HOMEDIR_LINUX, "Library/Application Support/audacity/audacity.cfg"), // macOS
  ];
  // Windows (WSL): resolve real Windows user folder — Linux username may differ from
  // Windows folder name (e.g. "syle" vs "Sy Le"). getWindowAppDataRoamingUserPath()
  // throws when getWindowUserBaseDir() returns undefined, so gate + try/catch.
  if (is_os_windows) {
    try {
      const winRoaming = getWindowAppDataRoamingUserPath();
      if (winRoaming) candidates.push(path.join(winRoaming, "audacity/audacity.cfg"));
    } catch (e) {}
  }
  return candidates.find((p) => pathExists(p));
}

/**
 * Sets a key=value in a wxFileConfig-style INI file under the given section.
 * Creates the section if it doesn't exist. Replaces value if key already set.
 * @param {string} content - The config file content.
 * @param {string} section - The section name (e.g., "SamplingRate", "AudioIO").
 * @param {string} key - The setting key.
 * @param {string} value - The value to set.
 * @returns {string} Updated content.
 */
function _setAudacitySetting(content, section, key, value) {
  const sectionPattern = new RegExp(`^\\[${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`, "m");
  const keyPattern = new RegExp(`^(${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})=.*$`, "m");
  const replacement = `${key}=${value}`;

  // key exists anywhere - replace it
  if (keyPattern.test(content)) {
    return content.replace(keyPattern, replacement);
  }

  // section exists - append after section header
  if (sectionPattern.test(content)) {
    return content.replace(sectionPattern, `[${section}]\n${replacement}`);
  }

  // section doesn't exist - add at end
  return `${content}\n\n[${section}]\n${replacement}`;
}

/**
 * Returns the desired Audacity settings organized by section.
 * @returns {Array<{section: string, key: string, value: string}>} Settings list.
 */
function _getAudacitySettings() {
  return [
    // ---- Audio Quality ----
    { section: "SamplingRate", key: "DefaultProjectSampleRate", value: "48000" }, // 48kHz (video standard, better than 44.1kHz CD default)
    { section: "SamplingRate", key: "DefaultProjectSampleFormatChoice", value: "Format32BitFloat" }, // 32-bit float for headroom during editing

    // ---- Recording / I/O ----
    { section: "AudioIO", key: "Duplex", value: "1" }, // hear other tracks while recording (overdub)
    { section: "AudioIO", key: "SWPlaythrough", value: "0" }, // disable software monitoring (use hardware monitoring instead)
    { section: "AudioIO", key: "LatencyDuration", value: "100.0" }, // audio buffer size in ms
    { section: "AudioIO", key: "LatencyCorrection", value: "-130.0" }, // recording latency offset in ms (compensates for buffer delay)

    // ---- GUI / Interface ----
    { section: "GUI", key: "AutoScroll", value: "1" }, // auto-scroll waveform display during playback
    { section: "GUI", key: "DefaultViewModeChoice", value: "Waveform" }, // default track view: Waveform, WaveformDB, or Spectrogram

    // ---- Telemetry & Updates ----
    { section: "Update", key: "DefaultUpdatesChecking", value: "0" }, // disable automatic update checks on startup
  ];
}

/** Applies optimized Audacity audio quality and interface settings. */
async function doWork() {
  log(">> Install Audacity configs");

  const cfgPath = _getAudacityCfgPath();
  if (!cfgPath) {
    log(">>> Skipped: Audacity config file not found (not installed or not launched yet)");
    return;
  }

  log(">>> Audacity config:", cfgPath);
  await backupConfigFile(cfgPath);

  let content = await readText`${cfgPath}`;
  for (const { section, key, value } of _getAudacitySettings()) {
    log(`>>>> ${section}.${key} = ${value}`);
    content = _setAudacitySetting(content, section, key, value);
  }

  await writeText(cfgPath, content);
  log(">>> Done. Restart Audacity for changes to take effect.");
}

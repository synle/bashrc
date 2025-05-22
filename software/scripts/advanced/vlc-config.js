/** Configures VLC: HW accel, resume playback always, disable telemetry/update checks, network buffer 1500ms, subtitle background, skip deblock for HD. */
/**
 * Finds the VLC config directory across platforms.
 * @returns {string|undefined} Path to the vlcrc file, or undefined if not found.
 */
function _getVlcConfigPath() {
  const candidates = [
    path.join(BASE_HOMEDIR_LINUX, ".config/vlc/vlcrc"), // Linux
    path.join(BASE_HOMEDIR_LINUX, "Library/Preferences/org.videolan.vlc/vlcrc"), // macOS
    `/mnt/c/Users/${CURRENT_USER}/AppData/Roaming/vlc/vlcrc`, // Windows (WSL)
  ];
  return candidates.find((p) => pathExists(p));
}

/**
 * Parses a vlcrc file into a map of key-value pairs grouped by section.
 * Commented-out keys (prefixed with #) are stored under section with a leading # in the key name.
 * @param {string} content - The vlcrc file content.
 * @returns {Map<string, Map<string, string>>} Section -> key -> value map.
 */
function _parseVlcrc(content) {
  const sections = new Map();
  let currentSection = "core";
  sections.set(currentSection, new Map());

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    const sectionMatch = trimmed.match(/^\[(.+)]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!sections.has(currentSection)) sections.set(currentSection, new Map());
      continue;
    }
    // active key=value
    const kvMatch = trimmed.match(/^([a-z][a-z0-9_-]*)=(.*)$/);
    if (kvMatch) {
      sections.get(currentSection).set(kvMatch[1], kvMatch[2]);
      continue;
    }
    // commented-out default: #key=value
    const commentKvMatch = trimmed.match(/^#([a-z][a-z0-9_-]*)=(.*)$/);
    if (commentKvMatch) {
      const key = commentKvMatch[1];
      if (!sections.get(currentSection).has(key)) {
        sections.get(currentSection).set(`#${key}`, commentKvMatch[2]);
      }
    }
  }
  return sections;
}

/**
 * Applies a setting to the vlcrc content string. Uncomments the key if it exists as a comment,
 * or appends it under the correct section.
 * @param {string} content - The vlcrc file content.
 * @param {string} section - The section name (e.g., "core", "qt", "avcodec").
 * @param {string} key - The setting key name.
 * @param {string} value - The value to set.
 * @returns {string} The updated vlcrc content.
 */
function _setVlcSetting(content, section, key, value) {
  const activePattern = new RegExp(`^(${key})=.*$`, "m");
  const commentPattern = new RegExp(`^#(${key})=.*$`, "m");
  const sectionPattern = new RegExp(`^\\[${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`, "m");
  const replacement = `${key}=${value}`;

  // already set as active key - replace value
  if (activePattern.test(content)) {
    return content.replace(activePattern, replacement);
  }

  // exists as commented default - uncomment and set value
  if (commentPattern.test(content)) {
    return content.replace(commentPattern, replacement);
  }

  // section exists - append after section header
  if (sectionPattern.test(content)) {
    return content.replace(sectionPattern, `[${section}]\n${replacement}`);
  }

  // section doesn't exist - add at end
  return `${content}\n\n[${section}]\n${replacement}`;
}

/**
 * Returns the desired VLC settings organized by section.
 * @returns {Array<{section: string, key: string, value: string}>} Flat list of settings to apply.
 */
function _getVlcSettings() {
  return [
    // ---- Performance ----
    { section: "core", key: "network-caching", value: "1500" }, // network stream buffer in ms (default 1000, higher = more stable)
    { section: "avcodec", key: "avcodec-hw", value: "any" }, // auto-select best HW decoder (VAAPI/VDPAU/VideoToolbox/DXVA)
    { section: "avcodec", key: "avcodec-threads", value: "0" }, // 0 = auto-detect CPU thread count
    { section: "avcodec", key: "avcodec-skiploopfilter", value: "1" }, // skip deblocking on non-ref frames (faster HD playback)
    { section: "avcodec", key: "avcodec-hurry-up", value: "1" }, // skip frames when CPU can't keep up

    // ---- Privacy / Telemetry ----
    { section: "core", key: "metadata-network-access", value: "0" }, // don't fetch album art / metadata from network
    { section: "core", key: "auto-preparse", value: "0" }, // don't auto-scan media info on playlist add
    { section: "qt", key: "qt-updates-notif", value: "0" }, // disable update check notifications
    { section: "qt", key: "qt-privacy-ask", value: "0" }, // suppress network/privacy prompt on first launch

    // ---- Usability ----
    { section: "qt", key: "qt-continue", value: "2" }, // 0=never, 1=ask, 2=always resume playback where left off
    { section: "qt", key: "qt-recentplay", value: "1" }, // remember recently played items
    { section: "qt", key: "qt-video-autoresize", value: "1" }, // resize window to match video dimensions

    // ---- Subtitles ----
    { section: "freetype", key: "freetype-outline-thickness", value: "4" }, // subtitle text outline width in px
    { section: "freetype", key: "freetype-background-opacity", value: "128" }, // semi-transparent subtitle background box
    { section: "core", key: "sub-autodetect-file", value: "1" }, // auto-detect .srt/.sub files next to video
  ];
}

/** Applies optimized VLC media player preferences across all supported platforms. */
async function doWork() {
  log(">> Install VLC configs");

  const vlcrcPath = _getVlcConfigPath();
  if (!vlcrcPath) {
    log(">>> Skipped: VLC config file not found (not installed or not launched yet)");
    return;
  }

  log(">>> VLC config:", vlcrcPath);
  await backupConfigFile(vlcrcPath);

  let content = await readText`${vlcrcPath}`;
  const settings = _getVlcSettings();

  for (const { section, key, value } of settings) {
    log(`>>>> ${section}.${key} = ${value}`);
    content = _setVlcSetting(content, section, key, value);
  }

  await writeText(vlcrcPath, content);
  log(">>> Done. Restart VLC for changes to take effect.");
}

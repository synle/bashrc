/** Configures Remmina: disable telemetry/news/tips, SSH keepalive, 4K resolution support, high scale quality, screenshot naming. */
/**
 * Finds the Remmina preferences file path.
 * @returns {string|undefined} Path to remmina.pref, or undefined if not found.
 */
function _getRemminaPrefsPath() {
  const candidates = [
    path.join(BASE_HOMEDIR_LINUX, ".config/remmina/remmina.pref"),
    path.join(BASE_HOMEDIR_LINUX, ".local/share/remmina/remmina.pref"),
  ];
  return candidates.find((p) => pathExists(p));
}

/**
 * Sets a key=value in an INI-style config file under the given section.
 * Creates the section if it doesn't exist. Replaces value if key already set.
 * @param {string} content - The config file content.
 * @param {string} section - The section name.
 * @param {string} key - The setting key.
 * @param {string} value - The value to set.
 * @returns {string} Updated content.
 */
function _setRemminaSetting(content, section, key, value) {
  const sectionPattern = new RegExp(`^\\[${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`, "m");
  const keyPattern = new RegExp(`^(${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})=.*$`, "m");
  const replacement = `${key}=${value}`;

  if (keyPattern.test(content)) {
    return content.replace(keyPattern, replacement);
  }

  if (sectionPattern.test(content)) {
    return content.replace(sectionPattern, `[${section}]\n${replacement}`);
  }

  return `${content}\n\n[${section}]\n${replacement}`;
}

/**
 * Returns the desired Remmina preference settings.
 * @returns {Array<{section: string, key: string, value: string}>} Settings list.
 */
function _getRemminaSettings() {
  return [
    // ---- Privacy / Telemetry ----
    { section: "remmina_pref", key: "disable_news", value: "1" }, // suppress in-app news feed
    { section: "remmina_pref", key: "disable_stats", value: "1" }, // don't send anonymous usage statistics
    { section: "remmina_pref", key: "disable_tip", value: "1" }, // hide tip-of-the-day dialog
    { section: "remmina_pref", key: "deny_screenshot_clipboard", value: "1" }, // block screenshots from reaching clipboard (security)

    // ---- Connection behavior ----
    { section: "remmina_pref", key: "confirm_close", value: "1" }, // warn before closing active connections
    { section: "remmina_pref", key: "save_view_mode", value: "1" }, // remember last view mode (windowed/fullscreen) per connection
    { section: "remmina_pref", key: "auto_scroll_step", value: "10" }, // pixels to scroll when cursor reaches edge in scaled mode

    // ---- Display ----
    { section: "remmina_pref", key: "scale_quality", value: "3" }, // scaling interpolation: 0=nearest, 1=bilinear, 3=best
    { section: "remmina_pref", key: "resolutions", value: "640x480,800x600,1024x768,1280x960,1920x1080,2560x1440,3840x2160" }, // resolution presets including 4K

    // ---- SSH ----
    { section: "remmina_pref", key: "ssh_parseconfig", value: "1" }, // read ~/.ssh/config for host aliases and keys
    { section: "remmina_pref", key: "ssh_tcp_keepidle", value: "20" }, // seconds idle before sending first keepalive
    { section: "remmina_pref", key: "ssh_tcp_keepintvl", value: "10" }, // seconds between keepalive probes
    { section: "remmina_pref", key: "ssh_tcp_keepcnt", value: "3" }, // failed keepalives before disconnect

    // ---- UI ----
    { section: "remmina_pref", key: "recent_maximum", value: "10" }, // max recent connections shown
    { section: "remmina_pref", key: "always_show_tab", value: "1" }, // show tab bar even with single connection
    { section: "remmina_pref", key: "hide_searchbar", value: "0" }, // keep search bar visible

    // ---- Screenshots ----
    { section: "remmina_pref", key: "screenshot_name", value: "remmina_%p_%h_%Y%m%d-%H%M%S" }, // screenshot filename: protocol_host_datetime
  ];
}

/** Applies Remmina remote desktop preferences with disabled telemetry and optimized defaults. */
async function doWork() {
  exitIfLimitedSupportOs();
  if (is_os_mac || is_os_windows) return;

  log(">> Install Remmina configs");

  const prefsPath = _getRemminaPrefsPath();
  if (!prefsPath) {
    log(">>> Skipped: Remmina preferences not found (not installed or not launched yet)");
    return;
  }

  log(">>> Remmina preferences:", prefsPath);
  await backupConfigFile(prefsPath);

  let content = await readText`${prefsPath}`;
  for (const { section, key, value } of _getRemminaSettings()) {
    log(`>>>> ${key} = ${value}`);
    content = _setRemminaSetting(content, section, key, value);
  }

  await writeText(prefsPath, content);
  log(">>> Done. Restart Remmina for changes to take effect.");
}

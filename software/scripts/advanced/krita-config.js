/** Configures Krita: OpenGL high-quality filter, 65% RAM limit, 8GB swap, autosave 5min, 60fps cap, Level of Detail for large canvases, LCMS optimization, update check disabled. */
/**
 * Finds the Krita config directory across platforms.
 * @param {string} fileName - The config file name (e.g., "kritarc", "kritadisplayrc").
 * @returns {string|undefined} Path to the config file, or undefined if not found.
 */
function _getKritaConfigPath(fileName) {
  const candidates = [
    path.join(BASE_HOMEDIR_LINUX, `.config/${fileName}`), // Linux
    path.join(BASE_HOMEDIR_LINUX, `Library/Preferences/${fileName}`), // macOS
  ];
  // Windows (WSL): resolve real Windows user folder. CURRENT_USER is the Linux name and may
  // not match the Windows folder (e.g. "syle" vs "Sy Le").
  if (is_os_windows) {
    try {
      const winLocal = getWindowAppDataLocalUserPath();
      if (winLocal) candidates.push(path.join(winLocal, fileName));
    } catch (e) {}
  }
  return candidates.find((p) => pathExists(p));
}

/**
 * Applies a key=value setting under a section in a KDE-style INI config file.
 * Creates the section if it doesn't exist. Replaces value if key already exists.
 * @param {string} content - The config file content.
 * @param {string} section - The INI section name (e.g., "General").
 * @param {string} key - The setting key.
 * @param {string} value - The value to set.
 * @returns {string} The updated content.
 */
function _setKritaSetting(content, section, key, value) {
  const sectionPattern = new RegExp(`^\\[${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`, "m");
  const keyPattern = new RegExp(`^(${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})=.*$`, "m");
  const replacement = `${key}=${value}`;

  // check if key exists anywhere in the file and replace it
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
 * Returns optimized kritarc settings for performance and usability.
 * @returns {Array<{section: string, key: string, value: string}>} Settings list.
 */
function _getKritaRcSettings() {
  return [
    // ---- Memory / Swap ----
    { section: "General", key: "memoryHardLimitPercent", value: "65" }, // max % of system RAM Krita can use (default 50)
    { section: "General", key: "memorySoftLimitPercent", value: "2" }, // offset from hard limit before swapping to disk
    { section: "General", key: "memoryPoolLimitPercent", value: "0" }, // deprecated since 4.4, keep at 0
    { section: "General", key: "maxSwapSize", value: "8192" }, // max swap file size in MiB (default 4096)

    // ---- Undo ----
    { section: "General", key: "undoEnabled", value: "true" },
    { section: "General", key: "undoStackLimit", value: "60" }, // undo steps (0=unlimited, 60 balances RAM vs safety)

    // ---- Autosave ----
    { section: "General", key: "AutoSaveInterval", value: "300" }, // seconds between autosaves (300 = 5 min)
    { section: "General", key: "CreateBackupFile", value: "true" }, // keep .kra~ backup of previous save

    // ---- Performance ----
    { section: "General", key: "fpsLimit", value: "60" }, // canvas FPS cap while painting (lower = less GPU load)
    { section: "General", key: "detectFpsLimit", value: "true" }, // auto-detect monitor refresh rate for FPS cap
    { section: "General", key: "levelOfDetailEnabled", value: "true" }, // Instant Preview: reduced quality during brush strokes on large canvases
    { section: "General", key: "disableAVXOptimizations", value: "false" }, // keep AVX on (set true only for AMD CPU rendering bugs)
    { section: "General", key: "enableProgressReporting", value: "true" }, // show progress bar for long operations

    // ---- Color management ----
    { section: "General", key: "allowLCMSOptimization", value: "true" }, // faster color conversions (disable only for linear light precision work)
    { section: "General", key: "useBlackPointCompensation", value: "true" }, // better shadow mapping for print workflows

    // ---- Telemetry & Updates ----
    { section: "General", key: "CheckUpdates", value: "false" }, // disable automatic update checks on startup
  ];
}

/**
 * Returns optimized kritadisplayrc settings for GPU rendering.
 * @returns {Array<{section: string, key: string, value: string}>} Settings list.
 */
function _getKritaDisplayRcSettings() {
  return [
    { section: "General", key: "canvasState", value: "OPENGL_SUCCESS" }, // mark OpenGL as working (skip detection dialog)
    { section: "General", key: "OpenGLRenderer", value: "auto" }, // auto-select: desktop OpenGL, ES, or ANGLE
    { section: "General", key: "OpenGLFilterMode", value: "3" }, // 0=nearest, 1=bilinear, 2=trilinear, 3=high quality
    { section: "General", key: "useOpenGLTextureBuffer", value: "true" }, // use GPU texture buffer for canvas tiles
    { section: "General", key: "EnableHiDPI", value: "true" }, // scale UI for high-DPI displays
    { section: "General", key: "EnableHiDPIFractionalScaling", value: "false" }, // avoid blurry fractional scaling
    { section: "General", key: "rootSurfaceFormat", value: "bt709-g22" }, // sRGB-compatible surface color format
  ];
}

/** Applies optimized Krita performance settings for kritarc and kritadisplayrc. */
async function doWork() {
  log(">> Install Krita configs");

  // ---- kritarc ----
  const kritarcPath = _getKritaConfigPath("kritarc");
  if (kritarcPath) {
    log(">>> kritarc:", kritarcPath);
    await backupConfigFile(kritarcPath);
    let content = await readText`${kritarcPath}`;
    for (const { section, key, value } of _getKritaRcSettings()) {
      log(`>>>> ${key} = ${value}`);
      content = _setKritaSetting(content, section, key, value);
    }
    await writeText(kritarcPath, content);
  } else {
    log(">>> Skipped kritarc: not found (Krita not installed or not launched yet)");
  }

  // ---- kritadisplayrc ----
  const displayrcPath = _getKritaConfigPath("kritadisplayrc");
  if (displayrcPath) {
    log(">>> kritadisplayrc:", displayrcPath);
    await backupConfigFile(displayrcPath);
    let content = await readText`${displayrcPath}`;
    for (const { section, key, value } of _getKritaDisplayRcSettings()) {
      log(`>>>> ${key} = ${value}`);
      content = _setKritaSetting(content, section, key, value);
    }
    await writeText(displayrcPath, content);
  } else {
    log(">>> Skipped kritadisplayrc: not found");
  }

  if (!kritarcPath && !displayrcPath) return;
  log(">>> Done. Restart Krita for changes to take effect.");
}

/** Configures Chromium-based browser preferences and keyboard shortcuts (Brave, Chrome, Edge). */
// brave://settings/system/shortcuts
// chrome://settings/system/shortcuts
// edge://settings/system/shortcuts

/**
 * Searches for the Brave Browser Preferences file path based on the current OS.
 * Supports macOS (native), Windows (WSL/MinGW), and Linux (flatpak/native).
 * @returns {string|null} Path to the Brave Browser "Default" profile directory, or null if not found.
 */
function _getBraveProfilePath() {
  const home = process.env.HOME || process.env.USERPROFILE;

  // macOS: ~/Library/Application Support/BraveSoftware/Brave-Browser/Default
  if (is_os_mac) {
    const macPath = path.join(home, "Library/Application Support/BraveSoftware/Brave-Browser/Default");
    if (fs.existsSync(macPath)) return macPath;
  }

  // Windows via WSL or MinGW: /mnt/c/Users/*/AppData/Local/BraveSoftware/Brave-Browser/User Data/Default
  if (is_os_windows) {
    const winPath = path.join(getWindowAppDataLocalUserPath(), "BraveSoftware/Brave-Browser/User Data/Default");
    if (fs.existsSync(winPath)) return winPath;
  }

  // Linux flatpak: ~/.var/app/com.brave.Browser/config/BraveSoftware/Brave-Browser/Default
  const flatpakPath = path.join(home, ".var/app/com.brave.Browser/config/BraveSoftware/Brave-Browser/Default");
  if (fs.existsSync(flatpakPath)) return flatpakPath;

  // Linux native: ~/.config/BraveSoftware/Brave-Browser/Default
  const linuxPath = path.join(home, ".config/BraveSoftware/Brave-Browser/Default");
  if (fs.existsSync(linuxPath)) return linuxPath;

  return null;
}

/**
 * Searches for the Google Chrome Preferences file path based on the current OS.
 * Supports macOS (native), Windows (WSL/MinGW), and Linux (flatpak/native).
 * @returns {string|null} Path to the Chrome "Default" profile directory, or null if not found.
 */
function _getChromeProfilePath() {
  const home = process.env.HOME || process.env.USERPROFILE;

  // macOS: ~/Library/Application Support/Google/Chrome/Default
  if (is_os_mac) {
    const macPath = path.join(home, "Library/Application Support/Google/Chrome/Default");
    if (fs.existsSync(macPath)) return macPath;
  }

  // Windows via WSL or MinGW: /mnt/c/Users/*/AppData/Local/Google/Chrome/User Data/Default
  if (is_os_windows) {
    const winPath = path.join(getWindowAppDataLocalUserPath(), "Google/Chrome/User Data/Default");
    if (fs.existsSync(winPath)) return winPath;
  }

  // Linux flatpak: ~/.var/app/com.google.Chrome/config/google-chrome/Default
  const flatpakPath = path.join(home, ".var/app/com.google.Chrome/config/google-chrome/Default");
  if (fs.existsSync(flatpakPath)) return flatpakPath;

  // Linux native: ~/.config/google-chrome/Default
  const linuxPath = path.join(home, ".config/google-chrome/Default");
  if (fs.existsSync(linuxPath)) return linuxPath;

  return null;
}

/**
 * Searches for the Microsoft Edge Preferences file path based on the current OS.
 * Supports macOS (native), Windows (WSL/MinGW), and Linux (native).
 * @returns {string|null} Path to the Edge "Default" profile directory, or null if not found.
 */
function _getEdgeProfilePath() {
  const home = process.env.HOME || process.env.USERPROFILE;

  // macOS: ~/Library/Application Support/Microsoft Edge/Default
  if (is_os_mac) {
    const macPath = path.join(home, "Library/Application Support/Microsoft Edge/Default");
    if (fs.existsSync(macPath)) return macPath;
  }

  // Windows via WSL or MinGW: /mnt/c/Users/*/AppData/Local/Microsoft/Edge/User Data/Default
  if (is_os_windows) {
    const winPath = path.join(getWindowAppDataLocalUserPath(), "Microsoft/Edge/User Data/Default");
    if (fs.existsSync(winPath)) return winPath;
  }

  // Linux native: ~/.config/microsoft-edge/Default
  const linuxPath = path.join(home, ".config/microsoft-edge/Default");
  if (fs.existsSync(linuxPath)) return linuxPath;

  return null;
}

/**
 * Deep merges source object into target object recursively.
 * Arrays and primitives from source overwrite target. Objects are merged recursively.
 * @param {object} target - The base object to merge into.
 * @param {object} source - The object with values to apply.
 * @returns {object} The merged result (mutates target).
 */
function _deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      _deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

/**
 * Returns Chromium settings shared across all browsers (Brave, Chrome, Edge).
 * These are standard Chromium Preferences keys that work on any Chromium-based browser.
 * @returns {object} Common Chromium Preferences to merge.
 */
function _getChromiumConfigs() {
  return {
    // =========================================================================
    // browser — General browser settings
    // =========================================================================
    browser: {
      clear_data: {
        time_period_basic: 4, // Settings > "Clear browsing data" > Time range = "All time" (4)
      },
      theme: {
        color_scheme2: 0, // Appearance > Color scheme = Dark (0)
      },
    },

    // =========================================================================
    // download — Settings > Downloads
    // =========================================================================
    download: {
      prompt_for_download: false, // Downloads > "Ask where to save each file before downloading" = OFF
    },

    // =========================================================================
    // enable_do_not_track — Settings > Privacy
    // =========================================================================
    enable_do_not_track: true, // Privacy > 'Send a "Do Not Track" request' = ON

    // =========================================================================
    // media_router — Chromecast / Google Cast
    // =========================================================================
    media_router: {
      enable_media_router: false, // Settings > "Google Cast" = OFF (disables Cast device discovery)
    },

    // =========================================================================
    // omnibox — Address bar settings
    // =========================================================================
    omnibox: {
      prevent_url_elisions: true, // Appearance > "Always show full URLs" = ON
    },

    // =========================================================================
    // search — Settings > Search
    // =========================================================================
    search: {
      suggest_enabled: false, // Search > "Show search suggestions" = OFF
    },

    // =========================================================================
    // signin — Browser sign-in
    // =========================================================================
    signin: {
      allowed: false, // Settings > "Allow browser sign-in" = OFF
    },

    // =========================================================================
    // privacy_sandbox — Settings > Privacy (Privacy Sandbox / Ad topics)
    // =========================================================================
    privacy_sandbox: {
      first_party_sets_enabled: false, // Privacy > "First-Party Sets" = OFF
      m1: {
        topics_enabled: false, // Privacy > "Ad topics" = OFF (don't let sites build topic profile)
        fledge_enabled: false, // Privacy > "Site-suggested ads" = OFF (disable FLEDGE/Protected Audience)
        ad_measurement_enabled: false, // Privacy > "Ad measurement" = OFF (disable attribution reporting)
      },
    },

    // =========================================================================
    // profile — Settings > Privacy (Cookie & content settings)
    // =========================================================================
    profile: {
      cookie_controls_mode: 1, // Privacy > "Block third-party cookies" (1 = block in incognito)
      default_content_setting_values: {
        anti_abuse: 2, // Privacy > "Anti-abuse" = Block (2)
      },
    },

    // =========================================================================
    // tracking_protection — Settings > Privacy (Tracking protection)
    // =========================================================================
    tracking_protection: {
      tracking_protection_3pcd_enabled: false, // Privacy > "Third-party cookie deprecation" tracking UI = OFF
    },

    // =========================================================================
    // alternate_error_pages — Settings > Privacy
    // =========================================================================
    alternate_error_pages: {
      backup: false, // Privacy > "Use a web service to help resolve navigation errors" = OFF
    },

    // =========================================================================
    // safebrowsing — Settings > Privacy
    // =========================================================================
    safebrowsing: {
      enabled: false, // Privacy > "Safe Browsing" = OFF (disable Safe Browsing)
    },

    // =========================================================================
    // payments — Settings > Payments
    // =========================================================================
    payments: {
      can_make_payment_enabled: false, // Privacy > "Allow sites to check if you have payment methods saved" = OFF
    },

    // =========================================================================
    // credentials — Settings > Passwords
    // =========================================================================
    credentials_enable_service: true, // Passwords > "Offer to save passwords" = ON
    credentials_enable_autosignin: true, // Passwords > "Auto sign-in" = ON

    // =========================================================================
    // spellcheck — Settings > Languages
    // =========================================================================
    spellcheck: {
      dictionaries: ["en-US"], // Languages > Spell check language = English (US)
    },

    // =========================================================================
    // intl — Settings > Languages
    // =========================================================================
    intl: {
      selected_languages: "en-US,en", // Languages > Preferred languages = English (US), English
    },
  };
}

/**
 * Returns Brave-specific settings (brave.* namespace, extensions, NTP).
 * These only apply to Brave Browser — not Chrome or Edge.
 * @returns {object} Brave-specific Preferences to merge.
 */
function _getBraveConfigs() {
  return {
    brave: {
      // -- brave://settings/newTab — New Tab Page --
      new_tab_page: {
        show_background_image: false, // New Tab Page > "Show background image" = OFF
        show_clock: false, // New Tab Page > "Show clock" = OFF
        show_rewards: false, // New Tab Page > "Show Brave Rewards" = OFF
        show_stats: false, // New Tab Page > "Show stats" = OFF (tracker/ads/bandwidth counters)
        show_together: false, // New Tab Page > "Show Brave Together" = OFF
        hide_all_widgets: true, // New Tab Page > Hides all card widgets (Rewards, Together, etc.)
        shows_options: 1, // New Tab Page > Dashboard display option (1 = simplified view)
      },
      always_show_bookmark_bar_on_ntp: false, // New Tab Page > Don't force bookmark bar on NTP
      rewards: {
        show_brave_rewards_button_in_location_bar: false, // Brave Rewards > "Show Brave Rewards icon in address bar" = OFF
      },
      brave_ads: {
        should_allow_ads_subdivision_targeting: false, // Ads > Don't allow subdivision ad targeting
      },
      brave_vpn: {
        show_button: false, // Appearance > "Show VPN button in toolbar" = OFF
      },
      show_side_panel_button: false, // Appearance > "Show side panel button" = OFF
      location_bar_is_wide: true, // Appearance > "Use wide URL bar" = ON
      branded_wallpaper_notification_dismissed: true, // Dismiss the sponsored wallpaper notification prompt
      enable_window_closing_confirm: true, // Appearance > "Warn before closing window with multiple tabs" = ON
      google_login_default: false, // Social media blocking > "Allow Google login buttons on third party sites" = OFF
      fb_embed_default: false, // Social media blocking > "Allow Facebook logins and embedded posts" = OFF
      twitter_embed_default: false, // Social media blocking > "Allow Twitter embedded tweets" = OFF
      wallet: {
        show_wallet_icon_on_toolbar: false, // Web3 > "Show Brave Wallet icon on toolbar" = OFF
      },
      ai_chat: {
        autocomplete_provider_enabled: false, // AI Chat > "Show autocomplete suggestions in address bar" = OFF
        context_menu_enabled: false, // AI Chat > "Show AI Chat in context menu" = OFF
        show_toolbar_button: false, // AI Chat > "Show AI Chat button in toolbar" = OFF
        storage_enabled: false, // AI Chat > "Store AI Chat history" = OFF
        tab_organization_enabled: false, // AI Chat > "AI tab organization" = OFF
      },
      ipfs: {
        auto_redirect_to_configured_gateway: false, // IPFS > Don't auto-redirect IPFS links to gateway
      },
      today: {
        should_show_toolbar_button: false, // Brave News > "Show Brave News button in toolbar" = OFF
      },
      enable_media_router_on_restart: false, // Settings > "Enable Media Router (Chromecast)" = OFF
      web_discovery: {
        enabled: false, // Privacy > "Web Discovery Project" = OFF (don't send anonymous usage data)
      },
      omnibox: {
        commander_suggestions_enabled: false, // Omnibox > "Show commander suggestions" = OFF
      },
      shields: {
        advanced_view_enabled: true, // Shields > "Advanced View" = ON (show detailed shields panel)
      },
      sidebar: {
        hidden_built_in_items: [7, 1, 2, 3, 4], // Sidebar > Hide built-in items (Wallet, Bookmarks, Reading List, History, AI Chat)
        sidebar_show_option: 3, // Sidebar > "Show sidebar" = Never (3)
      },
    },
    "tabgroup.sync_enabled": false, // Tab Groups > "Sync tab groups across devices" = OFF
    auto_open_synced_tab_groups: false, // Tab Groups > "Auto-open synced tab groups" = OFF
    auto_pin_new_tab_groups: false, // Tab Groups > "Auto-pin new tab groups" = OFF
    ntp: {
      shortcust_visible: false, // New Tab Page > "Show shortcuts" = OFF (note: Brave's actual key has this typo)
    },
    extensions: {
      commands: {
        // Streamkeys (hdhinadidafjejdhmfkjgnolgimiaplp) — media playback control
        "linux:Alt+Comma": { command_name: "rewind", extension: "hdhinadidafjejdhmfkjgnolgimiaplp", global: false },
        "linux:Alt+Period": { command_name: "forward", extension: "hdhinadidafjejdhmfkjgnolgimiaplp", global: false },
        "linux:Alt+P": { command_name: "play", extension: "hdhinadidafjejdhmfkjgnolgimiaplp", global: false },
        "linux:Alt+O": { command_name: "stop", extension: "hdhinadidafjejdhmfkjgnolgimiaplp", global: false },
        "mac:Alt+Comma": { command_name: "rewind", extension: "hdhinadidafjejdhmfkjgnolgimiaplp", global: false },
        "mac:Alt+Period": { command_name: "forward", extension: "hdhinadidafjejdhmfkjgnolgimiaplp", global: false },
        "mac:Alt+P": { command_name: "play", extension: "hdhinadidafjejdhmfkjgnolgimiaplp", global: false },
        "mac:Alt+O": { command_name: "stop", extension: "hdhinadidafjejdhmfkjgnolgimiaplp", global: false },
        "windows:Alt+Comma": { command_name: "rewind", extension: "hdhinadidafjejdhmfkjgnolgimiaplp", global: false },
        "windows:Alt+Period": { command_name: "forward", extension: "hdhinadidafjejdhmfkjgnolgimiaplp", global: false },
        "windows:Alt+P": { command_name: "play", extension: "hdhinadidafjejdhmfkjgnolgimiaplp", global: false },
        "windows:Alt+O": { command_name: "stop", extension: "hdhinadidafjejdhmfkjgnolgimiaplp", global: false },
        // Materialistic (cfpdompphcacgpjfbonkdokgjhgabpij) — activate extension
        "linux:Alt+J": { command_name: "_execute_action", extension: "cfpdompphcacgpjfbonkdokgjhgabpij", global: false },
        // OkTabs (glnpjglilkicbckjpbgcfkogebgllemb) — activate extension
        "mac:Command+Shift+O": { command_name: "_execute_action", extension: "glnpjglilkicbckjpbgcfkogebgllemb", global: false },
      },
    },
  };
}

/**
 * Returns Chrome-specific settings. Minimal — most settings are in _getChromiumConfigs().
 * @returns {object} Chrome-specific Preferences to merge.
 */
function _getChromeConfigs() {
  return {
    ntp: {
      shortcust_visible: false, // New Tab Page > "Show shortcuts" = OFF
    },
  };
}

/**
 * Returns Edge-specific settings. Minimal — most settings are in _getChromiumConfigs().
 * @returns {object} Edge-specific Preferences to merge.
 */
function _getEdgeConfigs() {
  return {};
}

/**
 * Returns merged browser configs for the given browser name.
 * Combines shared Chromium settings with browser-specific overrides, then applies
 * accelerator keymaps. Accepts optional existingPrefs to deep-merge on top of.
 * @param {string} browserName - Inferred browser name (e.g. "Brave-Browser", "Chrome", "Microsoft Edge").
 * @param {object} [existingPrefs={}] - Existing Preferences to merge our configs on top of.
 * @returns {object} Merged Preferences object for the browser.
 */
function _getBrowserConfigs(browserName, existingPrefs = {}) {
  const chromium = _getChromiumConfigs();
  const name = browserName.toLowerCase();
  let browserSpecific = {};
  if (name.includes("brave")) browserSpecific = _getBraveConfigs();
  else if (name.includes("chrome")) browserSpecific = _getChromeConfigs();
  else if (name.includes("edge")) browserSpecific = _getEdgeConfigs();

  // Merge: existing → chromium common → browser-specific
  const merged = _deepMerge(_deepMerge(existingPrefs, chromium), browserSpecific);

  // Replace all browser accelerator keymaps (wipe existing, use only our definitions)
  if (!merged.brave) merged.brave = {};
  merged.brave.accelerators = _getBrowserAccelerators();

  return merged;
}

//////////////////////////////////////////////////////
// Browser Accelerator Keymaps (shared Chromium logic)
//////////////////////////////////////////////////////

/**
 * Returns browser accelerator overrides shared across all platforms.
 * Uses OS_KEY placeholder — resolved to Meta (macOS) or Alt (Windows/Linux) by _getBrowserAccelerators().
 * @returns {object} Common accelerator overrides with OS_KEY placeholders.
 */
function _getBrowserAcceleratorsCommon() {
  return {
    33000: ["OS_KEY+ArrowLeft"], // Back
    33001: ["OS_KEY+ArrowRight"], // Forward
    33002: ["OS_KEY+KeyR"], // Reload
    33003: ["OS_KEY+Home"], // Home
    33007: ["F5", "OS_KEY+Shift+KeyR"], // Hard reload (bypass cache)
    34000: ["OS_KEY+KeyN"], // New window
    34001: ["OS_KEY+Shift+KeyN"], // New incognito window
    34014: ["OS_KEY+KeyT"], // New tab
    34015: ["OS_KEY+KeyW"], // Close tab
    34016: ["OS_KEY+Shift+BracketRight"], // Next tab
    34017: ["OS_KEY+Shift+BracketLeft"], // Previous tab
    34018: ["OS_KEY+Digit1"], // Tab 1
    34019: ["OS_KEY+Digit2"], // Tab 2
    34020: ["OS_KEY+Digit3"], // Tab 3
    34021: ["OS_KEY+Digit4"], // Tab 4
    34022: ["OS_KEY+Digit5"], // Tab 5
    34023: ["OS_KEY+Digit6"], // Tab 6
    34024: ["OS_KEY+Digit7"], // Tab 7
    34025: ["OS_KEY+Digit8"], // Tab 8
    34026: ["OS_KEY+Digit9"], // Tab 9
    34030: ["F11"], // Fullscreen
    34100: ["OS_KEY+Shift+KeyC"], // Brave cleanup
    34101: ["OS_KEY+Shift+KeyP"], // Brave private
    34102: ["OS_KEY+Shift+KeyX"], // Brave close all
    34103: ["OS_KEY+Shift+KeyZ"], // Brave undo close
    35000: ["OS_KEY+KeyD"], // Bookmark this page
    35003: ["OS_KEY+KeyP"], // Print
    35004: ["OS_KEY+KeyS"], // Save page
    36000: ["OS_KEY+KeyX"], // Cut
    36001: ["OS_KEY+KeyC"], // Copy
    36003: ["OS_KEY+KeyV"], // Paste
    37000: ["OS_KEY+KeyF"], // Find
    37001: ["OS_KEY+KeyG"], // Find next
    37002: ["OS_KEY+Shift+KeyG"], // Find previous
    38001: ["OS_KEY+Equal"], // Zoom in
    38002: ["OS_KEY+Digit0"], // Reset zoom
    38003: ["OS_KEY+Minus"], // Zoom out
    39000: ["OS_KEY+Shift+KeyT"], // Focus toolbar
    39001: ["OS_KEY+KeyL"], // Focus address bar
    39007: ["OS_KEY+Shift+KeyA"], // Focus inactive popup
    40000: ["OS_KEY+KeyO"], // Open file
    40004: ["OS_KEY+Shift+KeyI"], // DevTools
    40009: ["OS_KEY+Shift+KeyB"], // Bookmark bar toggle
    40010: ["OS_KEY+KeyH"], // History
    40012: ["OS_KEY+KeyJ", "OS_KEY+Shift+KeyJ"], // Downloads
    40013: ["OS_KEY+Shift+Backspace"], // Clear browsing data
    40021: ["OS_KEY+KeyE"], // Browser menu (⋮ hamburger menu, top-right)
  };
}

/**
 * Returns browser accelerator overrides for macOS only.
 * @returns {object} macOS-specific accelerator overrides.
 */
function _getBrowserAcceleratorsMac() {
  return {};
}

/**
 * Returns browser accelerator overrides for Windows/Linux only.
 * Includes Alt+F4 and other Win/Linux-specific keys with no macOS equivalent.
 * @returns {object} Windows/Linux-specific accelerator overrides.
 */
function _getBrowserAcceleratorsWindowsLinux() {
  return {
    34012: ["Alt+F4", "Alt+Shift+KeyW"], // Close window (Alt+F4 is Windows convention)
  };
}

/**
 * Resolves OS_KEY placeholders in accelerator values to platform-specific modifier keys.
 * OS_KEY becomes Command on macOS and Alt on Windows/Linux.
 * @param {object} accelerators - Accelerator map with OS_KEY placeholders in values.
 * @returns {object} Accelerator map with OS_KEY resolved to the platform modifier.
 */
function _resolveBrowserOsKey(accelerators) {
  const osKey = is_os_mac ? "Command" : "Alt";
  const resolved = {};
  for (const [id, keys] of Object.entries(accelerators)) {
    resolved[id] = keys.map((k) => k.replace(/OS_KEY/g, osKey));
  }
  return resolved;
}

/**
 * Builds browser accelerator keymaps by merging common + platform-specific overrides.
 * Common keys use OS_KEY (resolved to Meta on macOS, Alt on Win/Linux). Platform-specific
 * entries override common ones when the same ID appears in both.
 * @returns {object} The merged accelerator overrides to apply to browser preferences.
 */
function _getBrowserAccelerators() {
  const common = _resolveBrowserOsKey(_getBrowserAcceleratorsCommon());
  const platformSpecific = is_os_mac ? _getBrowserAcceleratorsMac() : _getBrowserAcceleratorsWindowsLinux();
  return Object.assign({}, common, platformSpecific);
}

/**
 * Infers a display name from a Chromium profile path by extracting the browser folder name.
 * Strips everything before the vendor folder and after /User Data/Default or /Default.
 * e.g. "~/Library/.../BraveSoftware/Brave-Browser/Default" => "Brave-Browser"
 * @param {string} profilePath - Path to the browser's profile directory.
 * @returns {string} The inferred browser name.
 */
function _inferBrowserName(profilePath) {
  return path.basename(profilePath.replace(/\/(User Data\/)?Default\/?$/, ""));
}

/**
 * Applies Chromium browser configuration to a profile path. Reads existing Preferences,
 * deep-merges settings and accelerator overrides, and writes back. Browser must be closed.
 * Browser name is inferred from the profile path for logging. Configs and accelerators
 * are built internally from _getBrowserConfigs() and _getBrowserAccelerators().
 * @param {string} profilePath - Path to the browser's "Default" profile directory.
 */
async function _applyBrowserConfig(profilePath) {
  log(`>> Apply Browser Config`, profilePath);
  const browserName = profilePath ? _inferBrowserName(profilePath) : "Unknown";
  if (!profilePath) {
    log(`>>> ${browserName}: profile not found, skipping`);
    return;
  }
  const prefsFile = path.join(profilePath, "Preferences");
  if (!fs.existsSync(prefsFile)) {
    log(`>>> ${browserName}: Preferences file not found at ${prefsFile}, skipping`);
    return;
  }
  log(`>> ${browserName} Configurations / Settings:`);
  log(`>>> ${browserName} profile path:`, profilePath);

  // Read existing preferences (preserve all user data like bookmarks, history, etc.)
  let existingPrefs = {};
  try {
    existingPrefs = await readJson`${prefsFile}`;
  } catch (e) {
    log(`>>> Warning: Could not read existing ${browserName} Preferences, starting fresh`, e);
  }

  // Merge: existing prefs → chromium common → browser-specific → accelerators
  const mergedPrefs = _getBrowserConfigs(browserName, existingPrefs);

  // Write back the merged preferences
  log(`>>> Writing merged ${browserName} preferences`);
  await backupConfigFile(prefsFile);
  await writeText(prefsFile, JSON.stringify(mergedPrefs, null, 2));
  log(`>>> Done. Restart ${browserName} for changes to take effect.`);
}

/**
 * Applies browser configuration to all installed Chromium browsers.
 * Loops through known browser profile paths and applies config to each found.
 */
async function doWork() {
  const browserProfilePaths = [
    _getBraveProfilePath(),
    _getChromeProfilePath(),
    _getEdgeProfilePath(),
  ];

  for (const profilePath of browserProfilePaths) {
    await _applyBrowserConfig(profilePath);
  }
}

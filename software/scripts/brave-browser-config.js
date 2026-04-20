/** Configures Brave Browser preferences and settings. */
// brave://settings/system/shortcuts

/**
 * Searches for the Brave Browser Preferences file path based on the current OS.
 * Supports macOS (native), Windows (WSL/MinGW), and Linux (flatpak).
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
 * Builds the Brave Browser settings object with all desired configurations.
 * Each setting is documented with which Brave settings page/section it maps to.
 * @returns {object} The Brave Browser Preferences object to merge.
 */
function _getBraveConfigs() {
  return {
    // =========================================================================
    // brave.* — Brave-specific features
    // =========================================================================
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

      // -- brave://settings/rewards — Brave Rewards --
      rewards: {
        show_brave_rewards_button_in_location_bar: false, // Brave Rewards > "Show Brave Rewards icon in address bar" = OFF
      },

      // -- brave://settings/ — Brave Ads --
      brave_ads: {
        should_allow_ads_subdivision_targeting: false, // Ads > Don't allow subdivision ad targeting
      },

      // -- brave://settings/appearance — Appearance --
      brave_vpn: {
        show_button: false, // Appearance > "Show VPN button in toolbar" = OFF
      },
      show_side_panel_button: false, // Appearance > "Show side panel button" = OFF
      location_bar_is_wide: true, // Appearance > "Use wide URL bar" = ON
      branded_wallpaper_notification_dismissed: true, // Dismiss the sponsored wallpaper notification prompt
      enable_window_closing_confirm: true, // Appearance > "Warn before closing window with multiple tabs" = ON

      // -- brave://settings/socialBlocking — Social media blocking --
      google_login_default: false, // Social media blocking > "Allow Google login buttons on third party sites" = OFF
      fb_embed_default: false, // Social media blocking > "Allow Facebook logins and embedded posts" = OFF
      twitter_embed_default: false, // Social media blocking > "Allow Twitter embedded tweets" = OFF

      // -- brave://settings/web3 — Web3 / Wallet --
      wallet: {
        show_wallet_icon_on_toolbar: false, // Web3 > "Show Brave Wallet icon on toolbar" = OFF
      },

      // -- brave://settings/ — AI Chat --
      ai_chat: {
        autocomplete_provider_enabled: false, // AI Chat > "Show autocomplete suggestions in address bar" = OFF
        context_menu_enabled: false, // AI Chat > "Show AI Chat in context menu" = OFF
        show_toolbar_button: false, // AI Chat > "Show AI Chat button in toolbar" = OFF
        storage_enabled: false, // AI Chat > "Store AI Chat history" = OFF
        tab_organization_enabled: false, // AI Chat > "AI tab organization" = OFF
      },

      // -- brave://settings/ — IPFS --
      ipfs: {
        auto_redirect_to_configured_gateway: false, // IPFS > Don't auto-redirect IPFS links to gateway
      },

      // -- brave://settings/ — Brave News (Today) --
      today: {
        should_show_toolbar_button: false, // Brave News > "Show Brave News button in toolbar" = OFF
      },

      // -- brave://settings/ — Media Router (Chromecast) --
      enable_media_router_on_restart: false, // Settings > "Enable Media Router (Chromecast)" = OFF

      // -- brave://settings/ — Web Discovery --
      web_discovery: {
        enabled: false, // Privacy > "Web Discovery Project" = OFF (don't send anonymous usage data)
      },

      // -- brave://settings/ — Omnibox --
      omnibox: {
        commander_suggestions_enabled: false, // Omnibox > "Show commander suggestions" = OFF
      },

      // -- brave://settings/shields — Shields --
      shields: {
        advanced_view_enabled: true, // Shields > "Advanced View" = ON (show detailed shields panel)
      },

      // -- brave://settings/ — Sidebar --
      sidebar: {
        hidden_built_in_items: [7, 1, 2, 3, 4], // Sidebar > Hide built-in items (Wallet, Bookmarks, Reading List, History, AI Chat)
        sidebar_show_option: 3, // Sidebar > "Show sidebar" = Never (3)
      },
    },

    // =========================================================================
    // tab groups — brave://settings (Tab group preferences)
    // =========================================================================
    "tabgroup.sync_enabled": false, // Tab Groups > "Sync tab groups across devices" = OFF
    auto_open_synced_tab_groups: false, // Tab Groups > "Auto-open synced tab groups" = OFF
    auto_pin_new_tab_groups: false, // Tab Groups > "Auto-pin new tab groups" = OFF

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
    // download — brave://settings/downloads
    // =========================================================================
    download: {
      prompt_for_download: false, // Downloads > "Ask where to save each file before downloading" = OFF
    },

    // =========================================================================
    // enable_do_not_track — brave://settings/privacy
    // =========================================================================
    enable_do_not_track: true, // Privacy > 'Send a "Do Not Track" request' = ON

    // =========================================================================
    // media_router — Chromecast / Google Cast
    // =========================================================================
    media_router: {
      enable_media_router: false, // Settings > "Google Cast" = OFF (disables Cast device discovery)
    },

    // =========================================================================
    // ntp — New Tab Page (Chromium-level settings)
    // =========================================================================
    ntp: {
      shortcust_visible: false, // New Tab Page > "Show shortcuts" = OFF (note: Brave's actual key has this typo)
    },

    // =========================================================================
    // omnibox — Address bar settings
    // =========================================================================
    omnibox: {
      prevent_url_elisions: true, // Appearance > "Always show full URLs" = ON
    },

    // =========================================================================
    // search — brave://settings/search
    // =========================================================================
    search: {
      suggest_enabled: false, // Search > "Show search suggestions" = OFF
    },

    // =========================================================================
    // signin — Google / Browser sign-in
    // =========================================================================
    signin: {
      allowed: false, // Settings > "Allow Brave sign-in" = OFF
    },

    // =========================================================================
    // privacy_sandbox — brave://settings/privacy (Privacy Sandbox / Ad topics)
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
    // profile — brave://settings/privacy (Cookie & content settings)
    // =========================================================================
    profile: {
      cookie_controls_mode: 1, // Privacy > "Block third-party cookies" (1 = block in incognito)
      default_content_setting_values: {
        anti_abuse: 2, // Privacy > "Anti-abuse" = Block (2)
      },
    },

    // =========================================================================
    // tracking_protection — brave://settings/privacy (Tracking protection)
    // =========================================================================
    tracking_protection: {
      tracking_protection_3pcd_enabled: false, // Privacy > "Third-party cookie deprecation" tracking UI = OFF
    },

    // =========================================================================
    // alternate_error_pages — brave://settings/privacy
    // =========================================================================
    alternate_error_pages: {
      backup: false, // Privacy > "Use a web service to help resolve navigation errors" = OFF
    },

    // =========================================================================
    // safebrowsing — brave://settings/privacy
    // =========================================================================
    safebrowsing: {
      enabled: false, // Privacy > "Safe Browsing" = OFF (disable Google Safe Browsing)
    },

    // =========================================================================
    // payments — brave://settings/payments
    // =========================================================================
    payments: {
      can_make_payment_enabled: false, // Privacy > "Allow sites to check if you have payment methods saved" = OFF
    },

    // =========================================================================
    // credentials — brave://settings/passwords
    // =========================================================================
    credentials_enable_service: true, // Passwords > "Offer to save passwords" = ON
    credentials_enable_autosignin: true, // Passwords > "Auto sign-in" = ON

    // =========================================================================
    // extensions — Extension keyboard shortcuts (brave://extensions/shortcuts)
    // =========================================================================
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

    // =========================================================================
    // spellcheck — brave://settings/languages
    // =========================================================================
    spellcheck: {
      dictionaries: ["en-US"], // Languages > Spell check language = English (US)
    },

    // =========================================================================
    // intl — brave://settings/languages
    // =========================================================================
    intl: {
      selected_languages: "en-US,en", // Languages > Preferred languages = English (US), English
    },
  };
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
 * OS_KEY becomes Meta on macOS (Cmd key) and Alt on Windows/Linux.
 * @param {object} accelerators - Accelerator map with OS_KEY placeholders in values.
 * @returns {object} Accelerator map with OS_KEY resolved to the platform modifier.
 */
function _resolveBrowserOsKey(accelerators) {
  const osKey = is_os_mac ? "Meta" : "Alt";
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
 * Applies Chromium browser configuration to a profile path. Reads existing Preferences,
 * deep-merges settings and accelerator overrides, and writes back. Browser must be closed.
 * @param {string} browserName - Display name for logging (e.g. "Brave", "Chrome").
 * @param {string} profilePath - Path to the browser's "Default" profile directory.
 * @param {object} configs - Browser-specific settings to deep-merge into Preferences.
 * @param {object} accelerators - Accelerator overrides to merge into brave.accelerators.
 */
async function _applyBrowserConfig(browserName, profilePath, configs, accelerators) {
  const prefsFile = path.join(profilePath, "Preferences");
  log(`>>> ${browserName} profile path:`, profilePath);
  exitIfPathNotFound(prefsFile);

  // Read existing preferences (preserve all user data like bookmarks, history, etc.)
  let existingPrefs = {};
  try {
    existingPrefs = await readJson`${prefsFile}`;
  } catch (e) {
    log(`>>> Warning: Could not read existing ${browserName} Preferences, starting fresh`, e);
  }

  // Deep merge desired settings into existing preferences
  const mergedPrefs = _deepMerge(existingPrefs, configs);

  // Merge browser accelerator keymaps (only non-default overrides)
  if (!mergedPrefs.brave) mergedPrefs.brave = {};
  if (!mergedPrefs.brave.accelerators) mergedPrefs.brave.accelerators = {};
  for (const key of Object.keys(accelerators)) {
    mergedPrefs.brave.accelerators[key] = accelerators[key];
  }

  // Write back the merged preferences
  log(`>>> Writing merged ${browserName} preferences`);
  await backupConfigFile(prefsFile);
  await writeText(prefsFile, JSON.stringify(mergedPrefs, null, 2));
  log(`>>> Done. Restart ${browserName} for changes to take effect.`);
}

/**
 * Applies Brave Browser configuration by finding the profile path, building configs, and writing.
 * Runs on macOS, Windows, and Linux where Brave is installed. Brave must be closed before running.
 */
async function doWork() {
  log(`>> Brave Browser Configurations / Settings:`);

  const profilePath = _getBraveProfilePath();
  exitIfPathNotFound(profilePath, "Brave Browser profile not found, skipping");

  await _applyBrowserConfig("Brave", profilePath, _getBraveConfigs(), _getBrowserAccelerators());
}

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
  if (is_os_window) {
    const windowsMounts = ["/mnt/c/Users", "/c/Users"];
    for (const mount of windowsMounts) {
      if (!fs.existsSync(mount)) continue;
      try {
        const users = fs.readdirSync(mount);
        for (const user of users) {
          const winPath = path.join(mount, user, "AppData/Local/BraveSoftware/Brave-Browser/User Data/Default");
          if (fs.existsSync(winPath)) return winPath;
        }
      } catch (e) {}
    }
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
    },

    // =========================================================================
    // brave_shields — Shields defaults (brave://settings/shields)
    // =========================================================================
    // Note: Per-site shield overrides live in profile.content_settings.exceptions.braveShields
    // These p3a counters are analytics; the actual shield defaults are in brave://settings/shields

    // =========================================================================
    // bookmark_bar — Bookmark bar visibility
    // =========================================================================
    bookmark_bar: {
      show_on_all_tabs: true, // Appearance > "Always show bookmark bar" = ON (on all pages, not just NTP)
    },

    // =========================================================================
    // browser — General browser settings
    // =========================================================================
    browser: {
      clear_data: {
        time_period_basic: 4, // Settings > "Clear browsing data" > Time range = "All time" (4)
      },
    },

    // =========================================================================
    // download — brave://settings/downloads
    // =========================================================================
    download: {
      prompt_for_download: false, // Downloads > "Ask where to save each file before downloading" = OFF
    },

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
    // signin — Google / Browser sign-in
    // =========================================================================
    signin: {
      allowed: false, // Settings > "Allow Brave sign-in" = OFF
    },

    // =========================================================================
    // privacy_sandbox — brave://settings/privacy (Privacy Sandbox / Ad topics)
    // =========================================================================
    privacy_sandbox: {
      m1: {
        topics_enabled: false, // Privacy > "Ad topics" = OFF (don't let sites build topic profile)
        fledge_enabled: false, // Privacy > "Site-suggested ads" = OFF (disable FLEDGE/Protected Audience)
        ad_measurement_enabled: false, // Privacy > "Ad measurement" = OFF (disable attribution reporting)
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
    // credentials — brave://settings/passwords
    // =========================================================================
    credentials_enable_service: true, // Passwords > "Offer to save passwords" = ON
    credentials_enable_autosignin: true, // Passwords > "Auto sign-in" = ON

    // =========================================================================
    // autofill — brave://settings/autofill
    // =========================================================================
    // (autofill settings are managed per-section in Brave's UI, keeping defaults)

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

    // =========================================================================
    // tor — brave://settings/privacy (Tor)
    // =========================================================================
    tor: {
      onion_only_in_tor_windows: false, // Privacy > "Resolve .onion sites only in Tor windows" = OFF
    },

    // =========================================================================
    // ephemeral_storage — brave://settings/privacy
    // =========================================================================
    ephemeral_storage: {
      first_party_storage_origins_to_cleanup: [], // Privacy > Ephemeral storage cleanup list (empty = no overrides)
    },
  };
}

/**
 * Applies Brave Browser configuration by reading existing Preferences, deep-merging desired settings, and writing back.
 * Only runs on macOS and Windows. Brave must be closed before running.
 */
async function doWork() {
  // Only run on macOS and Windows (and Linux if Brave is installed)
  if (!is_os_mac && !is_os_window) {
    log(">> Skipping: Brave Browser config only targets macOS and Windows");
    return;
  }

  log(`>> Brave Browser Configurations / Settings:`);

  if (true) {
    log(`>> Skipped for testing`);
    return;
  }

  const profilePath = _getBraveProfilePath();
  log(">>> Profile path:", profilePath);
  exitIfPathNotFound(profilePath);

  const prefsFile = path.join(profilePath, "Preferences");
  log(">>> Preferences file:", prefsFile);
  exitIfPathNotFound(prefsFile);

  // Read existing preferences (preserve all user data like bookmarks, history, etc.)
  let existingPrefs = {};
  try {
    existingPrefs = readJson(prefsFile);
  } catch (e) {
    log(">>> Warning: Could not read existing Preferences, starting fresh", e);
  }

  // Deep merge our desired settings into the existing preferences
  const desiredSettings = _getBraveConfigs();
  const mergedPrefs = _deepMerge(existingPrefs, desiredSettings);

  // Write back the merged preferences
  log(">>> Writing merged Brave Browser preferences");
  writeText(prefsFile, JSON.stringify(mergedPrefs, null, 2));
  log(">>> Done. Restart Brave Browser for changes to take effect.");
}

/** Shared Chromium launch flags for shell commands, Mac launcher apps, and Windows shortcuts. */
const _BROWSER_SHARED_LAUNCH_OPTIONS = [
  { flag: "--source-shortcut-location=desktop", description: "Marks the browser launch as coming from a Desktop shortcut." },
  { flag: "--disable-smooth-scrolling", description: "Disables smooth-scrolling animations." },
  { flag: "--disable-breakpad", description: "Disables crash reporting." },
  { flag: "--enable-gpu-rasterization", description: "Rasterizes page content on the GPU." },
  { flag: "--enable-zero-copy", description: "Enables zero-copy GPU raster uploads." },
  {
    flag: "--ignore-gpu-blocklist",
    description: "Forces GPU acceleration on blocked hardware; this can cause glitches on some systems.",
  },
  { flag: "--disk-cache-size=1073741824", description: "Sets the disk cache size to 1 GB." },
  { flag: "--no-pings", description: "Disables hyperlink-auditing pings." },
  { flag: "--no-default-browser-check", description: "Skips the default-browser nag." },
  { flag: "--no-first-run", description: "Skips first-run setup screens." },
  { flag: "--disable-search-engine-choice-screen", description: "Skips the search-engine choice screen." },
];

/** Existing shared Chromium feature toggles, plus the AI and ad-study features to keep disabled. */
const _BROWSER_SHARED_DISABLED_FEATURES = [
  "Translate",
  "InterestFeedContentSuggestions",
  "OptimizationHints",
  "GlobalMediaControls",
  "IPH_GMCSaveVideoFrame",
  "ChromeWhatsNewUI",
  "MediaRouter",
  // --- AI & Chat ---
  "AIChatCodeExecutionTool", // Brave AI Chat: in-chat code execution tool study
  "AIChatNEARModelsStudy_Release", // Brave AI: NEAR (on-device model) study, release channel
  // --- Ads & Promotion ---
  "BraveAdsObliviousHttpStudy", // Brave Ads: Oblivious-HTTP encrypted fetch routing for ad/news catalogs
  "BraveNTPBrandedWallpaperStudy", // New Tab Page: sponsored/branded wallpaper study
  "WhatsNewStudy", // "What's New" promo prompt study
];

/** Edge-only feature toggles; the Copilot toolbar switch is better documented than the sidebar switch. */
const _EDGE_DISABLED_FEATURES = ["msUndersideButton", "msEdgeSidebarV2"];

/** Flags that must remain disabled by default because they weaken browser security. */
const _BROWSER_UNSAFE_DEBUG_OPTION = {
  flag: "--disable-web-security",
  description: "Local testing/debugging only: disables the same-origin policy and is unsafe for normal browsing. DO NOT ENABLE by default.",
};

/**
 * Returns launch flags for one supported browser and platform.
 * @param {"brave"|"chrome"|"edge"} browserName - Browser whose flags are requested.
 * @param {"default"|"mac"|"windows"|"linux"} [platform="default"] - Platform-specific launch behavior.
 * @returns {{flag: string, description: string}[]} Ordered flags with inline descriptions.
 * @throws {Error} If the browser name or platform is unsupported.
 */
function getBrowserLaunchOptions(browserName, platform = "default") {
  const normalizedBrowserName = browserName.toLowerCase();
  const supportedBrowsers = ["brave", "chrome", "edge"];
  const supportedPlatforms = ["default", "mac", "windows", "linux"];
  if (!supportedBrowsers.includes(normalizedBrowserName)) throw new Error(`Unsupported browser: ${browserName}`);
  if (!supportedPlatforms.includes(platform)) throw new Error(`Unsupported browser launch platform: ${platform}`);

  const disabledFeatures = [..._BROWSER_SHARED_DISABLED_FEATURES];
  if (normalizedBrowserName === "edge") disabledFeatures.push(..._EDGE_DISABLED_FEATURES);

  const featureDescription = [
    "retains existing Translate, InterestFeedContentSuggestions, GlobalMediaControls, and IPH_GMCSaveVideoFrame settings",
    "hides the Chrome What's New page",
    "removes Cast/Media Router and its network probing",
    "stops OptimizationHints fetching",
    "disables the AI Chat tools and the Brave/Chrome ads, wallpaper, and What's-New study features",
  ];
  if (normalizedBrowserName === "edge") {
    featureDescription.push("disables the Edge Copilot toolbar button; msEdgeSidebarV2 is less documented and hit-or-miss");
  }

  const options = [
    ..._BROWSER_SHARED_LAUNCH_OPTIONS,
    {
      flag: `--disable-features=${disabledFeatures.join(",")}`,
      description: `${featureDescription.join("; ")}.`,
    },
  ];

  if (normalizedBrowserName === "brave") {
    options.push({ flag: "--disable-brave-rewards-extension", description: "Brave only: disables the Brave Rewards extension." });
    if (platform === "windows") {
      options.push({ flag: "--windows-native-window", description: "Preserves the existing Brave Windows native-window setting." });
    }
  }

  if (platform === "linux") {
    options.push({ flag: "--enable-features=VaapiVideoDecoder", description: "Enables hardware video decoding on Linux." });
  }

  return options;
}

/**
 * Renders shared and per-browser arrays for the generated Bash profile.
 * @param {"default"|"mac"|"windows"|"linux"} platform - Platform selected during profile generation.
 * @returns {string} Bash declarations for common and browser-specific launch flags.
 */
function renderBrowserLaunchOptionsForBash(platform) {
  const braveOptions = getBrowserLaunchOptions("brave", platform);
  const chromeOptions = getBrowserLaunchOptions("chrome", platform);
  const edgeOptions = getBrowserLaunchOptions("edge", platform);
  const commonDisabledFeatures = _BROWSER_SHARED_DISABLED_FEATURES.join(",");
  const braveOnlyOptions = braveOptions.filter(
    ({ flag }) =>
      !_BROWSER_SHARED_LAUNCH_OPTIONS.some((shared) => shared.flag === flag) &&
      !flag.startsWith("--disable-features=") &&
      !flag.startsWith("--enable-features="),
  );
  const edgeDisabledFeatures = edgeOptions.find(({ flag }) => flag.startsWith("--disable-features="));
  const linuxOptions =
    platform === "linux" ? getBrowserLaunchOptions("chrome", "linux").filter(({ flag }) => flag.startsWith("--enable-features=")) : [];
  const bashArray = (name, options) =>
    `${name}=(\n${options.map(({ flag, description }) => `  ${JSON.stringify(flag)} # ${description}`).join("\n")}\n)`;

  return [
    "# Shared Chromium launch options. Keep feature toggles in one --disable-features argument.",
    bashArray("_BROWSER_COMMON_ARGS", _BROWSER_SHARED_LAUNCH_OPTIONS),
    `_BROWSER_COMMON_DISABLE_FEATURES='${commonDisabledFeatures}'`,
    `_CHROME_LAUNCH_OPTIONS=(\n  \"\${_BROWSER_COMMON_ARGS[@]}\"\n  \"--disable-features=\${_BROWSER_COMMON_DISABLE_FEATURES}\" # ${chromeOptions.find(({ flag }) => flag.startsWith("--disable-features=")).description}\n)`,
    `_BRAVE_LAUNCH_OPTIONS=(\n  \"\${_CHROME_LAUNCH_OPTIONS[@]}\"\n${braveOnlyOptions
      .map(({ flag, description }) => `  ${JSON.stringify(flag)} # ${description}`)
      .join("\n")}\n)`,
    `_EDGE_LAUNCH_OPTIONS=(\n  \"\${_BROWSER_COMMON_ARGS[@]}\"\n  ${JSON.stringify(edgeDisabledFeatures.flag)} # ${edgeDisabledFeatures.description}\n)`,
    bashArray("_BROWSER_PLATFORM_ARGS", linuxOptions),
    "# Local testing/debugging only; intentionally disabled for normal browsing:",
    `# ${JSON.stringify(_BROWSER_UNSAFE_DEBUG_OPTION.flag)} # ${_BROWSER_UNSAFE_DEBUG_OPTION.description}`,
  ].join("\n");
}

/**
 * Renders the Windows PowerShell browser-to-flags map.
 * @returns {string} PowerShell hashtable of browser-specific launch options and descriptions.
 */
function renderBrowserLaunchOptionsForPowerShell() {
  const browserNames = ["brave", "chrome", "edge"];
  const optionLines = browserNames.map((browserName) => {
    const entries = getBrowserLaunchOptions(browserName, "windows")
      .map(({ flag, description }) => `        '${flag.replace(/'/g, "''")}' # ${description}`)
      .join("\n");
    return `    ${browserName[0].toUpperCase()}${browserName.slice(1)} = @(\n${entries}\n    )`;
  });

  return [
    "# Local testing/debugging only; intentionally disabled for normal browsing:",
    `# '${_BROWSER_UNSAFE_DEBUG_OPTION.flag}' # ${_BROWSER_UNSAFE_DEBUG_OPTION.description}`,
    "$browserLaunchOptions = @{",
    ...optionLines,
    "}",
  ].join("\n");
}

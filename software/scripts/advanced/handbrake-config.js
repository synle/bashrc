/** Configures HandBrake: HW decode (NVDEC + QSV + DirectX), auto-naming, custom "Optimized General (x265)" preset at CRF 22 with AAC 160kbps. */
/**
 * Finds the HandBrake config directory across platforms.
 * @returns {string|undefined} Path to the HandBrake config directory, or undefined if not found.
 */
function _getHandBrakeConfigDir() {
  const candidates = [
    path.join(BASE_HOMEDIR_LINUX, ".config/ghb"), // Linux (GTK)
    path.join(BASE_HOMEDIR_LINUX, "Library/Application Support/HandBrake"), // macOS
    `/mnt/c/Users/${CURRENT_USER}/AppData/Roaming/HandBrake`, // Windows (WSL)
  ];
  return candidates.find((d) => pathExists(d));
}

/**
 * Returns the optimized HandBrake application settings.
 * Enables hardware decoding, auto-naming, and sensible defaults.
 * @returns {object} Settings to deep merge into the existing settings file.
 */
function _getHandBrakeSettings() {
  return {
    autoNaming: true, // auto-generate output filename
    autoNameFormat: "{source}-{title}", // output naming pattern
    AutoNameRemoveUnderscore: true, // replace underscores with spaces in auto names
    AutoNameTitleCase: true, // title-case auto-generated names
    PreventSleep: true, // keep system awake during encoding
    PauseOnLowDiskspace: true, // pause encode if disk space drops below threshold
    LowDiskSpaceWarningLevelInBytes: 2147483648, // 2 GB low disk warning threshold
    EnableQuickSyncDecoding: true, // Intel QSV hardware decode
    EnableNvDecSupport: true, // NVIDIA NVDEC hardware decode
    EnableDirectXDecoding: true, // DirectX Video Acceleration decode (Windows)
    ForceDisableHardwareSupport: false, // keep HW support enabled
    clearOldLogs: true, // auto-remove old encoding logs
    ShowStatusInTitleBar: false, // cleaner title bar (progress in taskbar instead)
    previewScanCount: 10, // number of preview thumbnails to generate
    MinTitleScanDuration: 10, // ignore titles shorter than 10 seconds
  };
}

/**
 * Returns an optimized custom encoding preset for general-purpose video transcoding.
 * Uses x265 CRF 22 with AAC audio for a good quality/size balance.
 * @returns {Array} Preset array in HandBrake's preset format.
 */
function _getHandBrakePreset() {
  return [
    {
      Folder: true,
      PresetName: "Custom Presets",
      Type: 0,
      ChildrenArray: [
        {
          PresetName: "Optimized General (x265)",
          PresetDescription: "x265 CRF 22, AAC 160kbps, auto-crop, auto-framerate",
          Default: false,
          Folder: false,
          Type: 1,
          FileFormat: "av_mp4", // MP4 container (most compatible)
          ChapterMarkers: true, // preserve chapter markers from source
          Optimize: false, // no web-optimized moov atom (faster encode)
          Mp4iPodCompatible: false,
          VideoEncoder: "x265", // HEVC encoder (better compression than x264)
          VideoPreset: "medium", // speed/quality tradeoff (ultrafast..placebo)
          VideoTune: "",
          VideoProfile: "auto",
          VideoLevel: "auto",
          VideoOptionExtra: "",
          VideoQualityType: 2, // 0=avg bitrate, 2=constant quality (CRF)
          VideoQualitySlider: 22.0, // CRF value (lower=better, 18-22 typical for x265)
          VideoFramerate: "auto", // match source framerate
          VideoFramerateMode: "vfr", // variable framerate (preserves source timing)
          VideoMultiPass: false,
          VideoGrayScale: false,
          VideoHWDecode: 0,
          AudioList: [
            {
              AudioBitrate: 160, // AAC bitrate in kbps (128=good, 160=better, 192=overkill)
              AudioEncoder: "aac", // AAC encoder (most compatible)
              AudioMixdown: "stereo", // downmix to stereo
              AudioSamplerate: "auto",
              AudioTrackQualityEnable: false,
              AudioTrackGainSlider: 0.0,
              AudioTrackDRCSlider: 0.0,
            },
          ],
          AudioCopyMask: ["copy:aac", "copy:ac3", "copy:eac3", "copy:flac"], // passthrough these codecs without re-encode
          AudioEncoderFallback: "aac", // fallback encoder when passthrough isn't possible
          AudioTrackSelectionBehavior: "first", // auto-select first audio track
          AudioLanguageList: [],
          PictureCropMode: 0,
          PictureWidth: 0,
          PictureHeight: 0,
          PictureKeepRatio: true,
          PictureModulus: 2,
          PicturePAR: "auto",
          PictureDeblockPreset: "off",
          PictureCombDetectPreset: "off",
          PictureDeinterlaceFilter: "off",
          PictureDenoiseFilter: "off",
          PictureSharpenFilter: "off",
          PictureDetelecine: "off",
          SubtitleTrackSelectionBehavior: "none",
          SubtitleBurnBehavior: "none",
          SubtitleLanguageList: [],
          MetadataPassthru: true,
        },
      ],
    },
  ];
}

/**
 * Deep merges source object into target object recursively.
 * @param {object} target - The base object.
 * @param {object} source - The overrides.
 * @returns {object} The merged result.
 */
function _deepMergeHandBrake(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      _deepMergeHandBrake(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

/** Applies HandBrake settings and installs a custom encoding preset. */
async function doWork() {
  log(">> Install HandBrake configs");

  const configDir = _getHandBrakeConfigDir();
  if (!configDir) {
    log(">>> Skipped: HandBrake config directory not found (not installed or not launched yet)");
    return;
  }

  // ---- Application settings ----
  // Linux uses preferences.json, Windows/macOS use settings.json
  const settingsFileName = pathExists(path.join(configDir, "preferences.json")) ? "preferences.json" : "settings.json";
  const settingsPath = path.join(configDir, settingsFileName);

  if (pathExists(settingsPath)) {
    log(">>> HandBrake settings:", settingsPath);
    await backupConfigFile(settingsPath);
    let existing = {};
    try {
      existing = await readJson`${settingsPath}`;
    } catch (e) {
      log(">>> Warning: Could not read existing settings, starting fresh");
    }
    const merged = _deepMergeHandBrake(existing, _getHandBrakeSettings());
    await writeText(settingsPath, JSON.stringify(merged, null, 2));
  } else {
    log(">>> Skipped settings: file not found at", settingsPath);
  }

  // ---- Custom preset ----
  const presetsPath = path.join(configDir, "presets.json");
  if (pathExists(presetsPath)) {
    log(">>> HandBrake presets:", presetsPath);
    await backupConfigFile(presetsPath);
    let existingPresets = [];
    try {
      existingPresets = await readJson`${presetsPath}`;
    } catch (e) {
      existingPresets = [];
    }
    if (!Array.isArray(existingPresets)) existingPresets = [];

    // remove existing "Custom Presets" folder to avoid duplicates
    existingPresets = existingPresets.filter((p) => p.PresetName !== "Custom Presets");
    existingPresets.push(..._getHandBrakePreset());
    await writeText(presetsPath, JSON.stringify(existingPresets, null, 2));
  } else {
    // create presets file with our custom preset
    log(">>> Creating HandBrake presets:", presetsPath);
    await writeText(presetsPath, JSON.stringify(_getHandBrakePreset(), null, 2));
  }

  log(">>> Done. Restart HandBrake for changes to take effect.");
}

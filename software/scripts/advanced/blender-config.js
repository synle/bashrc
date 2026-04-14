/** Configures Blender: Python startup script auto-detecting GPU (Metal on Mac, OPTIX on Linux/Win), FXAA viewport, 128 undo steps, 4GB cache, autosave 2min. */
/**
 * Finds the Blender user config directory, auto-detecting the highest installed version.
 * @returns {string|undefined} Path to the versioned Blender config dir, or undefined if not found.
 */
function _getBlenderConfigDir() {
  const baseDirs = [
    path.join(BASE_HOMEDIR_LINUX, ".config/blender"), // Linux
    path.join(BASE_HOMEDIR_LINUX, "Library/Application Support/Blender"), // macOS
    `/mnt/c/Users/${CURRENT_USER}/AppData/Roaming/Blender Foundation/Blender`, // Windows (WSL)
  ];

  for (const baseDir of baseDirs) {
    if (!pathExists(baseDir)) continue;
    try {
      const versions = fs
        .readdirSync(baseDir)
        .filter((d) => /^[0-9]+\.[0-9]+$/.test(d))
        .sort((a, b) => {
          const [aMaj, aMin] = a.split(".").map(Number);
          const [bMaj, bMin] = b.split(".").map(Number);
          return bMaj - aMaj || bMin - aMin;
        });
      if (versions.length > 0) {
        return path.join(baseDir, versions[0]);
      }
    } catch (err) {}
  }
  return undefined;
}

/**
 * Generates the Python startup script content for Blender preferences.
 * Auto-detects GPU compute type based on the current OS platform.
 * @returns {string} Python script content.
 */
function _getBlenderStartupScript() {
  let gpuType = "NONE";
  if (is_os_mac) gpuType = "METAL";
  else gpuType = "OPTIX"; // CUDA/OPTIX for Linux/Windows (NVIDIA); falls back gracefully

  return code`
    """Automated Blender preferences: GPU, undo, autosave, viewport performance."""
    import bpy
    from bpy.app.handlers import persistent


    @persistent
    def _set_preferences(dummy=None):
        """Apply optimized Blender preferences on startup."""
        prefs = bpy.context.preferences

        # ---- System / Viewport Performance ----
        prefs.system.viewport_aa = 'FXAA'  # lightweight anti-aliasing (fast, good enough)
        prefs.system.gl_texture_limit = 'CLAMP_4096'  # cap GPU textures at 4K to save VRAM
        prefs.system.anisotropic_filter = 'FILTER_8'  # 8x anisotropic filtering for textures
        prefs.system.memory_cache_limit = 4096  # 4 GB sequencer/compositor cache
        prefs.system.use_overlay_smooth_wire = True  # smooth wireframe overlays
        prefs.system.use_edit_mode_smooth_wire = True  # smooth wires in edit mode
        prefs.system.texture_time_out = 120  # seconds before unused textures freed from GPU
        prefs.system.texture_collection_rate = 120  # texture garbage collection rate (seconds)

        # ---- Undo ----
        prefs.edit.undo_steps = 128  # max undo steps (default 32, max 256)
        prefs.edit.undo_memory_limit = 4096  # 4 GB undo memory cap
        prefs.edit.use_global_undo = True  # undo works across all operations

        # ---- Autosave & Files ----
        prefs.filepaths.use_auto_save_temporary_files = True  # enable periodic autosave
        prefs.filepaths.auto_save_time = 2  # autosave every 2 minutes
        prefs.filepaths.recent_files = 20  # remember 20 recent files

        # ---- Interface ----
        prefs.view.ui_line_width = 'AUTO'  # auto-detect UI line width for display
        prefs.view.color_picker_type = 'CIRCLE_HSV'  # HSV color wheel picker
        prefs.view.smooth_view = 200  # smooth view transition time in ms

        # ---- Cycles GPU (auto-detect) ----
        try:
            cycles_prefs = prefs.addons['cycles'].preferences
            cycles_prefs.compute_device_type = '${gpuType}'
            cycles_prefs.refresh_devices()
            for device in cycles_prefs.devices:
                device.use = (device.type != 'CPU')
        except (KeyError, RuntimeError):
            pass

        # persist preferences to disk
        try:
            bpy.ops.wm.save_userpref()
        except RuntimeError:
            pass


    def register():
        """Register the startup handler."""
        bpy.app.handlers.load_factory_startup_post.append(_set_preferences)


    def unregister():
        """Unregister the startup handler."""
        try:
            bpy.app.handlers.load_factory_startup_post.remove(_set_preferences)
        except ValueError:
            pass
  `;
}

/** Installs a Blender Python startup script that configures GPU, undo, autosave, and viewport settings. */
async function doWork() {
  log(">> Install Blender configs");

  const configDir = _getBlenderConfigDir();
  if (!configDir) {
    log(">>> Skipped: Blender config directory not found (not installed or not launched yet)");
    return;
  }

  const startupDir = path.join(configDir, "scripts/startup");
  await mkdir(startupDir);

  const scriptPath = path.join(startupDir, "bashrc_prefs.py");
  log(">>> Blender startup script:", scriptPath);
  await backupConfigFile(scriptPath);

  const content = _getBlenderStartupScript();
  await writeText(scriptPath, content);
  log(">>> Done. Restart Blender for changes to take effect.");
}

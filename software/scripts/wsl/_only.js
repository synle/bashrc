/** Platform tweaks for Windows Subsystem for Linux. */
/**
 * Register a one-time startup redirect for WSL shells launched from Windows System32.
 * @returns {Promise<void>} Resolves after queuing the WSL profile block; does not change the installer's folder.
 */
async function doWork() {
  registerPlatformTweaks(
    "WSL",
    code`
    # Explorer/elevated launches can inherit System32; preserve every other launch folder.
    # Do not export this sentinel: child shells need their own startup check.
    if ((is_os_wsl)) && [ "\${_SY_WSL_STARTUP_FOLDER_CHECKED:-0}" = 0 ]; then
      _SY_WSL_STARTUP_FOLDER_CHECKED=1
      case "$PWD" in
        /mnt/c/[Ww][Ii][Nn][Dd][Oo][Ww][Ss]/[Ss][Yy][Ss][Tt][Ee][Mm]32) cd "$HOME" ;;
      esac
    fi
  `,
  );
}

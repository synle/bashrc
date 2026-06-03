/** @type {string} GitHub repo identifier for display-dj releases. */
const DISPLAY_DJ_REPO = "synle/display-dj";

/** @type {string} macOS bundle identifier for display-dj. */
const DISPLAY_DJ_BUNDLE_ID = "com.synle.display-dj";

/**
 * Downloads the display-dj application binary for the current platform and, on macOS,
 * resets the app's Accessibility permission grant ONLY when an upgrade actually
 * happened. Forcing a re-grant fixes the common "permission shows granted in
 * System Settings but display-dj still can't read input events" stuck state
 * that tends to surface after a version upgrade. Gated on the install boolean
 * so no-op skip runs (installed version already matches upstream) don't make
 * the user re-grant Accessibility every time. The user re-grants access in
 * System Settings > Privacy & Security > Accessibility after this runs.
 */
async function doWork() {
  const installed = await downloadAndInstallBinary(DISPLAY_DJ_REPO, (ver, isArm64) => {
    return is_os_mac
      ? `Display.DJ_${ver}_${isArm64 ? "aarch64" : "x64"}.dmg`
      : is_os_windows
        ? `Display.DJ_${ver}_x64-setup.exe`
        : `Display.DJ_${ver}_amd64.AppImage`;
  });

  if (is_os_mac && installed) {
    if (IS_DRY_RUN) {
      log(`>> [DryRun] Would reset macOS Accessibility for ${DISPLAY_DJ_BUNDLE_ID}`);
    } else {
      log(`>> Resetting macOS Accessibility for ${DISPLAY_DJ_BUNDLE_ID}`);
      log(">>   Re-grant access in: System Settings > Privacy & Security > Accessibility");
      await execBash(`tccutil reset Accessibility ${DISPLAY_DJ_BUNDLE_ID}`);
    }
  }
}

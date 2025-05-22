/** @type {string} GitHub repo identifier for display-dj releases. */
const DISPLAY_DJ_REPO = "synle/display-dj";

/** @type {string} macOS bundle identifier for display-dj. */
const DISPLAY_DJ_BUNDLE_ID = "com.synle.display-dj";

/** Downloads the display-dj application binary for the current platform and generates helper scripts. */
async function doWork() {
  await downloadAndInstallBinary(DISPLAY_DJ_REPO, (ver, isArm64) => {
    return is_os_mac
      ? `Display.DJ_${ver}_${isArm64 ? "aarch64" : "x64"}.dmg`
      : is_os_windows
        ? `Display.DJ_${ver}_x64-setup.exe`
        : `Display.DJ_${ver}_amd64.AppImage`;
  });

  if (is_os_mac) {
    await _doResetAccessibilityScript();
  }
}

/** Generates a macOS script to reset accessibility permissions for display-dj. */
async function _doResetAccessibilityScript() {
  const scriptContent = trimLeftSpaces(`
    #!/usr/bin/env bash
    # Resets macOS accessibility permissions for Display DJ.
    # After running, re-grant accessibility access in System Settings > Privacy & Security > Accessibility.

    tccutil reset Accessibility ${DISPLAY_DJ_BUNDLE_ID}
    echo "Accessibility permissions reset for ${DISPLAY_DJ_BUNDLE_ID}"
    echo "Re-grant access in: System Settings > Privacy & Security > Accessibility"
  `);

  await writeBuildArtifact({
    file: `${BUILD_DIR}/display-dj-reset-accessibility-mac.sh`,
    data: scriptContent,
    comments: "Reset macOS Accessibility permissions for Display DJ",
    commentStyle: "bash",
  });
}

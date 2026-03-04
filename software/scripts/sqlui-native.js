const SQLUI_NATIVE_RELEASE_URL = "https://raw.githubusercontent.com/synle/sqlui-native/refs/heads/main/release.json";

/** * Downloads the sqlui-native application binary for the current platform. */
async function doWork() {
  const SQLUI_NATIVE_VERSION = (await fetchUrlAsJson(SQLUI_NATIVE_RELEASE_URL)).version;
  exitIfLimitedSupportOs();
  const targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, "sqlui-native");
  const baseUrl = `https://github.com/synle/sqlui-native/releases/download/${SQLUI_NATIVE_VERSION}`;

  let fileName;
  if (is_os_windows) {
    fileName = `sqlui-native-${SQLUI_NATIVE_VERSION}-x64.exe`;
  } else if (is_os_mac) {
    fileName = `sqlui-native-${SQLUI_NATIVE_VERSION}-x64.dmg`;
  } else {
    fileName = `sqlui-native-${SQLUI_NATIVE_VERSION}.AppImage`;
  }

  const url = `${baseUrl}/${fileName}`;
  const destination = path.join(targetPath, fileName);

  if (IS_FORCE_REFRESH) {
    log(">> Force refresh: deleting old sqlui-native files");
    await deleteFolder(targetPath);
  }

  if (fs.existsSync(targetPath)) {
    log(`>> sqlui-native v${SQLUI_NATIVE_VERSION} already installed, skipping:`, targetPath);
    return;
  }

  log(`>> Installing sqlui-native v${SQLUI_NATIVE_VERSION} to:`, targetPath);

  await mkdir(targetPath);
  downloadAsset(url, destination).then(() => {
    log(`>> sqlui-native v${SQLUI_NATIVE_VERSION} downloaded:`, destination);

    if (is_os_mac) {
      const mountPoint = `/tmp/sqlui-native-dmg`;
      execBash(`hdiutil attach "${destination}" -mountpoint "${mountPoint}" -nobrowse -quiet`);
      execBash(`cp -R "${mountPoint}/sqlui-native.app" /Applications/`);
      execBash(`hdiutil detach "${mountPoint}" -quiet`);
      execBash("xattr -cr /Applications/sqlui-native.app");
      log(">> Installed sqlui-native.app to /Applications");

      writeText(
        path.join(targetPath, "README.txt"),
        trimLeftSpaces(`
          # Why do we need "xattr -cr /Applications/sqlui-native.app"?
          #
          # macOS Gatekeeper quarantines apps downloaded outside the App Store by setting
          # an extended attribute (com.apple.quarantine) on the .app bundle. This causes
          # the "app is damaged and can't be opened" or "unidentified developer" error
          # when you try to launch the app.
          #
          # "xattr -cr" recursively clears all extended attributes from the app bundle,
          # removing the quarantine flag so macOS allows the app to run.
          #
          # To fix manually if needed:
          xattr -cr /Applications/sqlui-native.app
        `).trim(),
      );
    }
  });
}

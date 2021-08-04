let SUBLIME_VERSION;

async function _getPathSublimeText() {
  try {
    if (is_os_window) {
      return findDirSingle(
        getWindowAppDataRoamingUserPath(),
        /Sublime[ ]*Text/i
      );
    }

    if (is_os_darwin_mac) {
      return findDirSingle(
        getOsxApplicationSupportCodeUserPath(),
        /Sublime[ ]*Text/i
      );
    }

    // for debian or chrome os debian linux
    return findDirSingle(
      globalThis.BASE_HOMEDIR_LINUX + "/.config",
      /Sublime[ ]*Text/i
    );
  } catch (err) {
    console.log("      >> Failed to get the path for Sublime Text", url, err);
  }

  return null;
}

async function doWork() {
  let targetPath = await _getPathSublimeText();

  console.log(
    `  >> Setting up Sublime Text ${SUBLIME_VERSION} configurations:`,
    targetPath
  );

  if (!fs.existsSync(targetPath)) {
    console.log(consoleLogColor1("    >> Skipped : Target path not found"));
    process.exit();
  }

  //
  const sublimePackageControlConfigPath = path.join(
    targetPath,
    "Packages/User/Package Control.sublime-settings"
  );
  console.log(
    "    >> Package Control.sublime-settings",
    sublimePackageControlConfigPath
  );

  writeJson(sublimePackageControlConfigPath, {
    bootstrapped: true,
    in_process_packages: [],
    installed_packages: [
      //       "Alignment",
      "All Autocomplete",
      //       "Babel",
      "BracketHighlighter",
      "Case Conversion",
      "CodeFormatter",
      "Compare Side-By-Side",
      "DocBlockr",
      "Dracula Color Scheme",
      // "LESS",
      "Markdown Preview",
      // "Package Control",
      "SCSS",
      "SideBarEnhancements",
      "SublimeCodeIntel",
      "SyncedSideBar",
      //       "Tabnine",
      "TodoReview",
      "TypeScript",
    ],
  });
}

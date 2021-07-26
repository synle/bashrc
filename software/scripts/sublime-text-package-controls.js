let SUBLIME_VERSION;

async function _getPathSublimeText() {
  const url =
    "https://raw.githubusercontent.com/synle/bashrc/master/software/metadata/sublime-text.config.json";
  try {
    let config = await fetchUrlAsJson(url);

    SUBLIME_VERSION = config.sublime_version;

    if (is_os_window) {
      return path.join(getWindowAppDataRoamingUserPath(), config.sublime_path);
    }
    if (is_os_darwin_mac) {
      return path.join(
        getOsxApplicationSupportCodeUserPath(),
        config.sublime_path
      );
    }
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

  console.log("    >> Package Control.sublime-settings");
  writeJson(path.join(targetPath, "Package Control.sublime-settings"), {
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

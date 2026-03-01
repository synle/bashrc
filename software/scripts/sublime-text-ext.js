// BEGIN software/scripts/editor.common.js

// END software/scripts/editor.common.js

const toInstallExtensions = convertTextToList(`
  // icons and themes
  A File Icon

  // language server and intelligence
  LSP
  LSP-css
  LSP-html
  LSP-json
  LSP-pyright
  LSP-typescript

  // syntax highlighting
  Sass
  TypeScript

  // code formatting
  CodeFormatter
  JsPrettier

  // editing
  Alignment
  All Autocomplete
  BracketHighlighter
  Case Conversion
  DocBlockr
  // ui
  SideBarEnhancements
  SyncedSideBar

  // git
  GitGutter

  // utilities
  Compare Side-By-Side
  MarkdownPreview
  SublimeLinter
`);

async function doWork() {
  exitIfLimitedSupportOs();
  log(`  >> Sublime Text Extensions:`);

  // write to build file
  writeToBuildFile([
    {
      file: "sublime-text-ext",
      data: `# Use Preferences > Package Control > Package Control: Advanced Install Package. \n${toInstallExtensions.join(",")}`,
    },
  ]);

  // write Package Control settings to local Sublime Text installation
  let targetPath = await _getPathSublimeText();
  log("    >> For my own system", colorDim(targetPath));
  exitIfPathNotFound(targetPath);

  const pkgControlPath = path.join(targetPath, "Packages/User/Package Control.sublime-settings");
  let existingPackages = [];
  try {
    const existing = readJson(pkgControlPath);
    existingPackages = existing.installed_packages || [];
  } catch (e) {}

  // merge: keep existing packages and add new ones
  const mergedPackages = [...new Set([...existingPackages, ...toInstallExtensions])].sort();

  writeConfigToFile(targetPath, "Packages/User/Package Control.sublime-settings", {
    installed_packages: mergedPackages,
  });
}

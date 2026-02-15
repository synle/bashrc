includeSource('software/scripts/sublime-text.common.js');

const toInstallExtensions = convertTextToList(`
  A File Icon
  Alignment
  All Autocomplete
  BracketHighlighter
  Case Conversion
  CodeFormatter
  DocBlockr
  Dracula Color Scheme
  JsPrettier
  SideBarEnhancements
  SublimeCodeIntel
  SyncedSideBar
`);

async function doWork() {
  console.log(`  >> Sublime Text Extensions:`);

  // write to build file
  writeToBuildFile([
    [
      'sublime-text-extensions',
      `# Use Preferences > Package Control > Package Control: Advanced Install Package. \n${toInstallExtensions.join(',')}`,
      false,
    ],
  ]);
}

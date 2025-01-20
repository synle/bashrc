includeSource('software/scripts/sublime-text.common.js');

const toInstallExtensions = convertTextToList(`
  Alignment
  All Autocomplete
  BracketHighlighter
  Case Conversion
  CodeFormatter
  Compare Side-By-Side
  DocBlockr
  Dracula Color Scheme
  FileIcons
  SideBarEnhancements
  SublimeCodeIntel
  SyncedSideBar
  TypeScript
  Non Text Files
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

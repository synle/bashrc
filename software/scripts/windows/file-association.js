const sublimeProgramBinaryName = 'sublime';

const sublimeBinaryPath = `ftype ${sublimeProgramBinaryName}="C:/Program Files/Sublime Text/sublime_text.exe" "%1"`;

let extensionsToOpenWithEditor = [];

async function doInit() {
  extensionsToOpenWithEditor = convertTextToList(await fetchUrlAsString('software/scripts/windows/file-association.config'));

  associationContent = `
${extensionsToOpenWithEditor.map((extension) => `assoc ${extension}=${sublimeProgramBinaryName}`).join('\n')}
${sublimeBinaryPath}
  `.trim();
}

async function doWork() {
  console.log('  >> Installing Windows Only - File Associations');
  writeToBuildFile([['windows-file-association.cmd', associationContent]]);
}

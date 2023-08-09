const sublimeProgramBinaryName = 'sublime';
const sublimeBinaryPath = `ftype ${sublimeProgramBinaryName}="C:/Program Files/Sublime Text/sublime_text.exe" "%1"`;

const vlcProgramBinaryName = 'vlc';
const vlcBinaryPath = `ftype ${vlcProgramBinaryName}="C:/Program Files/VideoLAN/VLC/vlc.exe" "%1"`;

async function doInit() {
  associationContent = trimLeftSpaces(`
    ########################
    # text file association
    ########################

    ${convertTextToList(await fetchUrlAsString('software/scripts/windows/file-association.textfile.config'))
      .map((extension) => `assoc ${extension}=${sublimeProgramBinaryName}`)
      .join('\n')}
    ${sublimeBinaryPath}

    ########################
    # media file association
    ########################
    ${convertTextToList(await fetchUrlAsString('software/scripts/windows/file-association.media.config'))
      .map((extension) => `assoc ${extension}=${vlcProgramBinaryName}`)
      .join('\n')}
    ${vlcBinaryPath}
  `);
}

async function doWork() {
  console.log('  >> Installing Windows Only - File Associations');
  writeToBuildFile([['windows-file-association.cmd', associationContent]]);
}

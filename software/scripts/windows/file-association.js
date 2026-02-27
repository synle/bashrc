/// <reference path="../../index.js" />

const sublimeProgramBinaryName = "sublime";
const sublimeBinaryPath = `ftype ${sublimeProgramBinaryName}="C:/Program Files/Sublime Text/sublime_text.exe" "%1"`;

const vlcProgramBinaryName = "vlc";
const vlcBinaryPath = `ftype ${vlcProgramBinaryName}="C:/Program Files/VideoLAN/VLC/vlc.exe" "%1"`;

let associationContent;

/**
 * Builds file association commands for text and media files, then writes the Windows batch script to the build output.
 */
async function doWork() {
  associationContent = trimLeftSpaces(`
    ########################
    # text file association
    ########################
    ${sublimeBinaryPath}

    ${convertTextToList(await fetchUrlAsString("software/scripts/windows/file-association.textfile.config"))
      .map((extension) => `assoc .${extension}=${sublimeProgramBinaryName}`)
      .join("\n")}

    ########################
    # media file association
    ########################
    ${vlcBinaryPath}

    ${convertTextToList(await fetchUrlAsString("software/scripts/windows/file-association.media.config"))
      .map((extension) => `assoc .${extension}=${vlcProgramBinaryName}`)
      .join("\n")}
  `);

  console.log("  >> Installing Windows Only - File Associations");
  writeToBuildFile([{ file: "windows-file-association.cmd", data: associationContent }]);
}

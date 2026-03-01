const sublimeProgramBinaryName = "sublime";
const sublimeBinaryPath = `C:/Program Files/Sublime Text/sublime_text.exe`;

const vlcProgramBinaryName = "vlc";
const vlcBinaryPath = `C:/Program Files/VideoLAN/VLC/vlc.exe`;

const sevenZipProgramBinaryName = "7-Zip";
const sevenZipBinaryPath = `C:/Program Files/7-Zip/7zFM.exe`;

const psFooter = `
# Rebuild icon cache
Write-Host "Rebuilding icon cache..."
Remove-Item "$env:LOCALAPPDATA\\IconCache.db" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\\Microsoft\\Windows\\Explorer\\iconcache*" -Force -ErrorAction SilentlyContinue
& ie4uinit.exe -show

Write-Host ""
Write-Host "Done. Please restart your computer to fully apply the changes."
`.trim();

/**
 * Builds PowerShell scripts for setting and reverting Windows file associations, then writes them to the build output.
 */
async function doWork() {
  const textExtensions = convertTextToList(await fetchUrlAsString("software/metadata/file-association.textfile.config"));
  const mediaExtensions = convertTextToList(await fetchUrlAsString("software/metadata/file-association.media.config"));
  const archiveExtensions = convertTextToList(await fetchUrlAsString("software/metadata/file-association.archive.config"));
  const allExtensions = [...textExtensions, ...mediaExtensions, ...archiveExtensions];

  const associationContent = trimLeftSpaces(`
    # Requires running as Administrator
    # Sets Sublime Text as default for text files, VLC as default for media files, and 7-Zip as default for archive files

    # Register file types
    cmd /c 'ftype ${sublimeProgramBinaryName}="${sublimeBinaryPath}" "%1"'
    cmd /c 'ftype ${vlcProgramBinaryName}="${vlcBinaryPath}" "%1"'
    cmd /c 'ftype ${sevenZipProgramBinaryName}="${sevenZipBinaryPath}" "%1"'

    ${LINE_BREAK_HASH}
    # 7-Zip context menu settings
    # Only show: Extract Here (0x02), Extract to <folder> (0x04), Add to <name>.zip (0x20)
    ${LINE_BREAK_HASH}
    New-Item -Path "HKCU:\\Software\\7-Zip\\Options" -Force | Out-Null
    Set-ItemProperty -Path "HKCU:\\Software\\7-Zip\\Options" -Name "ContextMenu" -Value 0x26 -Type DWord
    Set-ItemProperty -Path "HKCU:\\Software\\7-Zip\\Options" -Name "CascadedMenu" -Value 1 -Type DWord

    ${LINE_BREAK_HASH}
    # text file association
    ${LINE_BREAK_HASH}
    $textExtensions = @(
    ${textExtensions.map((ext) => `  ".${ext}"`).join("\n")}
    )

    foreach ($ext in $textExtensions) {
      cmd /c "assoc $ext=${sublimeProgramBinaryName}"
    }

    ${LINE_BREAK_HASH}
    # media file association
    ${LINE_BREAK_HASH}
    $mediaExtensions = @(
    ${mediaExtensions.map((ext) => `  ".${ext}"`).join("\n")}
    )

    foreach ($ext in $mediaExtensions) {
      cmd /c "assoc $ext=${vlcProgramBinaryName}"
    }

    ${LINE_BREAK_HASH}
    # archive file association (7-Zip)
    ${LINE_BREAK_HASH}
    $archiveExtensions = @(
    ${archiveExtensions.map((ext) => `  ".${ext}"`).join("\n")}
    )

    foreach ($ext in $archiveExtensions) {
      cmd /c "assoc $ext=${sevenZipProgramBinaryName}"
    }

    ${psFooter}
  `);

  const revertContent = trimLeftSpaces(`
    # Requires running as Administrator
    # This script reverts all file associations set by windows-file-association.ps1
    # It removes the custom file types and deletes the registry overrides for each extension

    # Remove custom file types
    cmd /c "ftype ${sublimeProgramBinaryName}="
    cmd /c "ftype ${vlcProgramBinaryName}="
    cmd /c "ftype ${sevenZipProgramBinaryName}="

    # Remove 7-Zip context menu registry settings
    Remove-ItemProperty -Path "HKCU:\\Software\\7-Zip\\Options" -Name "ContextMenu" -Force -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path "HKCU:\\Software\\7-Zip\\Options" -Name "CascadedMenu" -Force -ErrorAction SilentlyContinue

    # Remove file association overrides from registry
    $extensions = @(
    ${allExtensions.map((ext) => `  ".${ext}"`).join("\n")}
    )

    foreach ($ext in $extensions) {
      # Remove the user-level override (FileExts)
      $userPath = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\$ext"
      if (Test-Path "$userPath\\UserChoice") {
        Remove-Item "$userPath\\UserChoice" -Force -ErrorAction SilentlyContinue
      }

      # Reset the class-level association
      cmd /c "assoc $ext="
    }

    ${psFooter}
  `);

  log(">> Installing Windows Only - File Associations for PowerShell");
  writeToBuildFile([
    {
      file: "file-association-windows.ps1",
      data: associationContent,
      comments: `
        File Associations for Windows
        Run as Administrator: powershell -ExecutionPolicy Bypass -File file-association-windows.ps1
        Sets Sublime Text, VLC, and 7-Zip as default apps for text, media, and archive files
        To revert, run file-association-windows-revert.ps1 as Administrator
      `,
      commentStyle: "bash",
    },
    {
      file: "file-association-windows-revert.ps1",
      data: revertContent,
      comments: `
        Revert File Associations for Windows
        Run as Administrator: powershell -ExecutionPolicy Bypass -File file-association-windows-revert.ps1
        This removes all custom file associations set by file-association-windows.ps1
      `,
      commentStyle: "bash",
    },
  ]);
}

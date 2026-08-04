/** Configures macOS default file associations for Sublime Text, VLC, Keka, and Ghostty. */
const sublimeBundleId = "com.sublimetext.4";
const vlcBundleId = "org.videolan.vlc";
const kekaBundleId = "com.aone.keka";
const ghosttyBundleId = "com.mitchellh.ghostty";

const shFooter = `
echo ""
echo "Done. You may need to restart Finder for changes to take effect:"
echo "  killall Finder"
`.trim();

/**
 * Builds shell scripts for setting and reverting macOS file associations using duti, then writes them to the build output.
 */
async function doWork() {
  const textExtensions = await readSet`software/metadata/file-association.textfile.config`;
  const mediaExtensions = await readSet`software/metadata/file-association.media.config`;
  const archiveExtensions = await readSet`software/metadata/file-association.archive.config`;
  const terminalExtensions = await readSet`software/metadata/file-association.terminal.config`;
  const allExtensions = [...textExtensions, ...mediaExtensions, ...archiveExtensions, ...terminalExtensions];

  // duti is installed by software/scripts/mac/_full-setup.sh via installBrewPackageInBackground.
  // The generated scripts below also check `type -P duti` at run time and exit with a
  // friendly error message if it is somehow missing.

  const associationContent = trimLeftSpaces(`
    #!/usr/bin/env bash
    # Sets Sublime Text for text files, VLC for media files, and Keka for archive files
    # Requires duti: brew install duti

    if ! type -P duti &>/dev/null; then
      echo "duti is not installed. Install it with: brew install duti"
      exit 1
    fi

    ${LINE_BREAK_HASH}
    # text file association
    ${LINE_BREAK_HASH}
    TEXT_EXTENSIONS=(
    ${textExtensions.map((ext) => `  "${ext}"`).join("\n")}
    )

    for ext in "\${TEXT_EXTENSIONS[@]}"; do
      duti -s ${sublimeBundleId} ".$ext" all 2>/dev/null
    done

    ${LINE_BREAK_HASH}
    # media file association
    ${LINE_BREAK_HASH}
    MEDIA_EXTENSIONS=(
    ${mediaExtensions.map((ext) => `  "${ext}"`).join("\n")}
    )

    for ext in "\${MEDIA_EXTENSIONS[@]}"; do
      duti -s ${vlcBundleId} ".$ext" all 2>/dev/null
    done

    ${LINE_BREAK_HASH}
    # archive file association
    ${LINE_BREAK_HASH}
    ARCHIVE_EXTENSIONS=(
    ${archiveExtensions.map((ext) => `  "${ext}"`).join("\n")}
    )

    for ext in "\${ARCHIVE_EXTENSIONS[@]}"; do
      duti -s ${kekaBundleId} ".$ext" all 2>/dev/null
    done

    ${LINE_BREAK_HASH}
    # terminal file association (e.g. .command — double-click runs in Ghostty)
    ${LINE_BREAK_HASH}
    TERMINAL_EXTENSIONS=(
    ${terminalExtensions.map((ext) => `  "${ext}"`).join("\n")}
    )

    for ext in "\${TERMINAL_EXTENSIONS[@]}"; do
      duti -s ${ghosttyBundleId} ".$ext" all 2>/dev/null
    done

    ${shFooter}
  `);

  const revertContent = trimLeftSpaces(`
    #!/usr/bin/env bash
    # Reverts all file associations set by mac-file-association.sh
    # Resets extensions back to macOS default handlers
    # Requires duti: brew install duti

    if ! type -P duti &>/dev/null; then
      echo "duti is not installed. Install it with: brew install duti"
      exit 1
    fi

    # Reset all extensions by removing Launch Services overrides
    ALL_EXTENSIONS=(
    ${allExtensions.map((ext) => `  "${ext}"`).join("\n")}
    )

    for ext in "\${ALL_EXTENSIONS[@]}"; do
      # Remove the user override from Launch Services database
      /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -u ".$ext" 2>/dev/null
    done

    # Reset Launch Services database to rebuild defaults
    /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain system -domain user 2>/dev/null

    ${shFooter}
  `);

  log(">> Installing Mac Only - File Associations");
  await writeBuildArtifact([
    {
      file: `${BUILD_DIR}/file-association-mac.sh`,
      data: associationContent,
      comments: `
        File Associations for macOS
        Requires duti: brew install duti
        Sets Sublime Text, VLC, and Keka as default apps for text, media, and archive files
        To revert, run file-association-mac-revert.sh
      `,
      commentStyle: "bash",
    },
    {
      file: `${BUILD_DIR}/file-association-mac-revert.sh`,
      data: revertContent,
      comments: `
        Revert File Associations for macOS
        This resets the Launch Services database to restore default file associations
      `,
      commentStyle: "bash",
    },
  ]);
}

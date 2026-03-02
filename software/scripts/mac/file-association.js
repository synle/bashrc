const sublimeBundleId = "com.sublimetext.4";
const vlcBundleId = "org.videolan.vlc";

const shFooter = `
echo ""
echo "Done. You may need to restart Finder for changes to take effect:"
echo "  killall Finder"
`.trim();

/**
 * Builds shell scripts for setting and reverting macOS file associations using duti, then writes them to the build output.
 */
async function doWork() {
  const textExtensions = convertTextToList(await fetchUrlAsString("software/metadata/file-association.textfile.config"));
  const mediaExtensions = convertTextToList(await fetchUrlAsString("software/metadata/file-association.media.config"));
  const allExtensions = [...textExtensions, ...mediaExtensions];

  // install duti if not already installed
  execBash(`command -v duti &>/dev/null || brew install duti`, true);

  const associationContent = trimLeftSpaces(`
    #!/usr/bin/env bash
    # Sets Sublime Text as default for text files and VLC as default for media files
    # Requires duti: brew install duti

    if ! command -v duti &>/dev/null; then
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

    ${shFooter}
  `);

  const revertContent = trimLeftSpaces(`
    #!/usr/bin/env bash
    # Reverts all file associations set by mac-file-association.sh
    # Resets extensions back to macOS default handlers
    # Requires duti: brew install duti

    if ! command -v duti &>/dev/null; then
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
  writeToBuildFile([
    {
      file: "file-association-mac.sh",
      data: associationContent,
      comments: `
        File Associations for macOS
        Requires duti: brew install duti
        Sets Sublime Text and VLC as default apps for text and media files
        To revert, run file-association-mac-revert.sh
      `,
      commentStyle: "bash",
    },
    {
      file: "file-association-mac-revert.sh",
      data: revertContent,
      comments: `
        Revert File Associations for macOS
        This resets the Launch Services database to restore default file associations
      `,
      commentStyle: "bash",
    },
  ]);
}

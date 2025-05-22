/** Final cleanup for Windows - strips empty markers, deploys PowerShell profile, and removes working copy.
 * The ~ prefix ensures this runs last (ASCII 126 sorts after all alphanumeric characters).
 */

/**
 * Resolves the file path for the Windows PowerShell profile script.
 * @returns {Promise<string|null>} The path to the PowerShell profile file, or null if not found.
 */
async function _getPowershellProfilePath() {
  try {
    const documentsDir = await getWindowDocumentsPath();
    if (documentsDir) {
      const targetPath = path.join(documentsDir, "WindowsPowerShell");
      await mkdir(targetPath);
      return path.join(targetPath, "Microsoft.PowerShell_profile.ps1");
    }
  } catch (err) {
    log(">> Failed to get the path for Powershell Profile", err);
  }

  return null;
}

/** Deploys the PowerShell profile and cleans up the working copy. */
async function doWork() {
  log(">> Windows cleanup - finalizing PowerShell profile");

  // strip empty markers and clean up whitespace
  let outputContent = await readText`${POWERSHELL_SYLE_PATH}`;
  outputContent = removeEmptyBlocks(outputContent);
  outputContent = cleanupExtraWhitespaces(outputContent);

  // write powershell profile build artifact (always windows)
  log(">> Writing PowerShell profile build artifact");
  await writeBuildArtifact([
    {
      file: `${BUILD_DIR}/profile_powershell_windows.ps1`,
      data: outputContent,
      comments: "Precompiled PowerShell profile for windows",
      commentStyle: "bash",
    },
  ]);

  // deploy to the actual PowerShell profile path
  const targetPath = await _getPowershellProfilePath();
  if (!targetPath) {
    log(">>> Skipped : PowerShell profile path not found");
    return;
  }

  log(">>> Deploying PowerShell profile to", targetPath);
  await writeText(targetPath, outputContent);

  // clean up the working copy now that the final profile has been deployed
  log(">>> Cleaning up working copy:", POWERSHELL_SYLE_PATH);
  await deleteFile(POWERSHELL_SYLE_PATH);
}

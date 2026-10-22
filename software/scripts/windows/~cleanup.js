/** Final cleanup for Windows - deploys PowerShell profiles, applies Explorer menus, and removes working copy.
 * The ~ prefix ensures this runs last (ASCII 126 sorts after all alphanumeric characters).
 */

/**
 * Resolve both editions' profile files from the Windows Documents known folder.
 * Uses inbox Windows PowerShell without a profile so discovery works before PowerShell 7 is installed.
 * @returns {Promise<string[]>} WSL-mounted current-user console profile paths, modern edition first.
 * @throws {Error} If Documents cannot be resolved to an accessible drive-mounted folder.
 * @sideEffects Probes Windows and creates the two profile folders; does not load user profiles.
 */
async function _getPowershellProfilePaths() {
  const probe = Buffer.from(
    "[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding; [Environment]::GetFolderPath('MyDocuments')",
    "utf16le",
  ).toString("base64");
  const documents = (await execBash(`powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand ${probe}`)).trim();
  if (!/^[A-Za-z]:\\/.test(documents)) {
    throw new Error("Windows Documents folder could not be resolved to a drive-mounted path");
  }
  const documentsFolder = documents.replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`).replace(/\\/g, "/");
  if (!pathExists(documentsFolder)) {
    throw new Error("Windows Documents folder is not accessible from WSL");
  }
  const profilePaths = [];
  for (const edition of ["PowerShell", "WindowsPowerShell"]) {
    const profileFolder = path.join(documentsFolder, edition);
    await mkdir(profileFolder);
    profilePaths.push(path.join(profileFolder, "Microsoft.PowerShell_profile.ps1"));
  }
  return profilePaths;
}

/**
 * Deploy both PowerShell profiles and apply backed-up Explorer menu maintenance after installers.
 * @returns {Promise<void>} Resolves after profile/menu deployment and working-copy cleanup.
 * @throws {Error} Propagates discovery, write, or maintenance failures, preserving the working copy on failure.
 * @sideEffects Writes profiles and registry backups, updates owned Explorer verbs, and removes the working copy after success.
 */
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

  // Offline dry-runs build the artifact but cannot discover another OS's known folders.
  if (IS_DRY_RUN) {
    log(">>> [DryRun] Would deploy both PowerShell profiles and apply Explorer menu maintenance");
    return;
  }

  // Each edition has its own current-user profile, including when Documents is redirected.
  const profilePaths = await _getPowershellProfilePaths();
  for (const targetPath of profilePaths) {
    log(">>> Deploying PowerShell profile to", targetPath);
    await backupConfigFile(targetPath);
    await writeText(targetPath, outputContent);
  }

  // Run after package installers; copying the Desktop helper alone never changes Explorer.
  log(">>> Applying backed-up Windows Explorer menu maintenance");
  /** Shared registry maintenance source, also deployed for manual use. @type {string} */
  const menuScript = await readText`software/scripts/windows/windows-context-menu.ps1.bash`;
  /** Encoded source avoids shell interpolation of Windows paths and registry values. @type {string} */
  const encodedMenuScript = Buffer.from(menuScript, "utf16le").toString("base64");
  // execBash swallows nonzero exits; use the throwing helper so registry failures stop cleanup.
  execBashSync(`powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand ${encodedMenuScript}`);

  // Keep the working copy if either profile deployment or menu maintenance fails.
  log(">>> Cleaning up working copy:", POWERSHELL_SYLE_PATH);
  await deleteFile(POWERSHELL_SYLE_PATH);
}

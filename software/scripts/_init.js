/** Bootstraps .bash_profile, .bashrc, and assembles .bash_syle with core and advanced profile content.
 * Empty BEGIN/END markers are pre-placed in profile-core.sh and profile-advanced.sh
 * so that later scripts can update blocks in place via registerWithBashSyleProfile.
 */
async function doWork() {
  // backup current profile files before any modifications
  await backupProfileFilesToTempDir("before");

  // snapshot before any modifications (for debugging profile syntax failures)
  await backupProfileSnapshot("bash_syle.0-before-run");

  // wipe out the old bash_syle first
  const coreBashProfileFiles = [BASH_SYLE_PATH];
  for (const file of coreBashProfileFiles) {
    log(">> Wiping out the old bash profile asset: ", file);
    await writeText(file, ``);
  }

  // ---- assemble .bash_syle with profile-core and profile-advanced ----
  log(">> Setting up .bash_syle");

  let contentProfileCore = await readText`software/bootstrap/profile-core.sh`;
  let contentProfileAdvanced = await readText`software/bootstrap/profile-advanced.sh`;

  contentProfileCore = `
${LINE_BREAK_HASH}
# ---- begin core profile ----
${LINE_BREAK_HASH}

${contentProfileCore}

${LINE_BREAK_HASH}
# ---- end core profile ----
${LINE_BREAK_HASH}
  `.trim();

  contentProfileAdvanced = `
${LINE_BREAK_HASH}
# ---- begin advanced profile ----
# skipped in Claude Code sessions (CLAUDECODE=1) for a lean, fast shell
${LINE_BREAK_HASH}
if [ -z "\$CLAUDECODE" ]; then

${contentProfileAdvanced}

fi
${LINE_BREAK_HASH}
# ---- end advanced profile ----
${LINE_BREAK_HASH}
  `.trim();

  let bashSyleContent = "";

  // core profile
  log(">>> Core profile");
  bashSyleContent += contentProfileCore.trim();

  // append advanced profile only for fancier OS
  log(">>> Advanced profile");
  if (IS_ADVANCED_PROFILE_ENABLED) {
    log(">>>> Installed for advanced OS");
    bashSyleContent += contentProfileAdvanced.trim();
  } else {
    log(">>>> Skipped : Lightweight mode or limited-support OS");
  }

  await writeText(BASH_SYLE_PATH, bashSyleContent);

  // flush immediately to expand short-form markers and resolve SOURCE includes
  await flushProfileBlocks(true);

  const entryPointSourceFiles = [BASH_SYLE_COMMON_PATH, ...coreBashProfileFiles];
  const entryPointContent = trimSpacesOnBothEnd(`
    function safe_source() { bash -n "$1" 2>/dev/null && . "$1" || echo "[Warning] source $1 failed" >&2; }
    ${entryPointSourceFiles.map((file) => 'safe_source "' + file + '"').join("\n")}
  `);

  // bootstrap .bash_profile (login shells on all platforms)
  {
    const targetPath = path.join(BASE_HOMEDIR_LINUX, ".bash_profile");
    log(">> Updating .bash_profile with bash_syle entry point", targetPath);
    let textContent = await readText`${targetPath}`;
    textContent = appendTextBlock(textContent, "Sy bash_syle entry point", entryPointContent);
    await writeText(targetPath, textContent);
  }

  // bootstrap .bashrc (interactive non-login shells)
  {
    const targetPath = path.join(BASE_HOMEDIR_LINUX, ".bashrc");
    log(">> Updating .bashrc with bash_syle entry point", targetPath);
    let textContent = await readText`${targetPath}`;
    textContent = appendTextBlock(textContent, "Sy bash_syle entry point", entryPointContent);
    await writeText(targetPath, textContent);
  }

  // snapshot after bootstrap assembled the template (before other scripts fill it in)
  await backupProfileSnapshot("bash_syle.1-after-bootstrap");
}

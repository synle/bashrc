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
    log(">>>> Skipped : Limited-support OS");
  }

  await writeText(BASH_SYLE_PATH, bashSyleContent);

  // flush immediately to expand short-form markers and resolve SOURCE includes
  await flushProfileBlocks(true);

  const bashProfilePath = path.join(BASE_HOMEDIR_LINUX, ".bash_profile");
  const bashrcPath = path.join(BASE_HOMEDIR_LINUX, ".bashrc");

  const entryPointSourceFiles = [BASH_SYLE_COMMON_PATH, ...coreBashProfileFiles];
  const entryPointContent = trimSpacesOnBothEnd(`
    # define safe_source for non-login shells that skip .bash_profile
    function safe_source() { if ! bash -n "$1" 2>/dev/null; then echo "[Warning] source $1 failed (syntax error)" >&2; return 1; fi; . "$1"; }
    ${entryPointSourceFiles.map((file) => 'safe_source "' + file + '"').join("\n")}
  `);

  // bootstrap .bash_profile (login shells on all platforms) — sources .bashrc
  log(">> Updating .bash_profile to source .bashrc", bashProfilePath);
  let textContent = await readText`${bashProfilePath}`;
  const bashProfileContent = trimSpacesOnBothEnd(`
    # .bash_profile delegates to .bashrc for all shell init
    function safe_source() { if ! bash -n "$1" 2>/dev/null; then echo "[Warning] source $1 failed (syntax error)" >&2; return 1; fi; . "$1"; }
    safe_source "${bashrcPath}"
  `);
  textContent = moveTextBlockToEnd(textContent, "Sy bash_syle entry point", bashProfileContent);
  await writeText(bashProfilePath, textContent);

  // bootstrap .bashrc (interactive non-login shells)
  log(">> Updating .bashrc with bash_syle entry point", bashrcPath);
  textContent = await readText`${bashrcPath}`;
  textContent = moveTextBlockToEnd(textContent, "Sy bash_syle entry point", entryPointContent);
  await writeText(bashrcPath, textContent);

  // snapshot after bootstrap assembled the template (before other scripts fill it in)
  await backupProfileSnapshot("bash_syle.1-after-bootstrap");
}

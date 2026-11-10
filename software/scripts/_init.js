/** Bootstraps .bash_profile, .bashrc, and assembles .bash_syle with core and advanced profile content.
 * Empty BEGIN/END markers are pre-placed in profile-core.sh and profile-advanced.sh
 * so that later scripts can update blocks in place via registerWithBashSyleProfile.
 * Shell entry points cache ordered profile sources separately from the minimal bootstrap loader.
 * @returns {Promise<void>} Resolves after writing profiles and startup files.
 * @throws {Error} If profile generation or filesystem writes fail.
 */
async function doWork() {
  /** @type {string} Runtime source owns the shared managed-block identity. */
  const profileSourcesContent = await readText`software/bootstrap/profile-sources.bash`;
  /** @type {string | undefined} Stable marker name used by runtime refreshes. */
  const profileSourcesKey = profileSourcesContent.match(/^_PROFILE_SOURCES_BLOCK='([^']+)'$/m)?.[1];
  if (!profileSourcesKey) throw new Error("Missing shared profile-source runtime");

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

  // --- Assemble .bash_syle with profile-core and profile-advanced ---
  log(">> Setting up .bash_syle");

  let contentProfileCore = await readText`software/bootstrap/profile-core.sh`;
  let contentProfileAdvanced = await readText`software/bootstrap/profile-advanced.sh`;

  contentProfileCore = `
${LINE_BREAK_HASH}
# --- Begin core profile ---
${LINE_BREAK_HASH}

${contentProfileCore}

${LINE_BREAK_HASH}
# --- End core profile ---
${LINE_BREAK_HASH}
  `.trim();

  contentProfileAdvanced = `
${LINE_BREAK_HASH}
# --- Begin advanced profile ---
# skipped in Claude Code sessions (CLAUDECODE=1) for a lean, fast shell
${LINE_BREAK_HASH}
if [ -z "\$CLAUDECODE" ]; then

${contentProfileAdvanced}

fi
${LINE_BREAK_HASH}
# --- End advanced profile ---
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

  /** @type {string[]} Pinned core files precede lexical, eligible work overlays. */
  const profileSourceFiles = [
    BASH_SYLE_COMMON_PATH,
    ...coreBashProfileFiles,
    BASH_SYLE_CACHE_PATH,
    ...findPathList(BASE_HOMEDIR_LINUX, /^\.work.*\.bash$/, { type: "file" })
      .filter((file) => !file.includes(".secret.") && !/[\x00-\x1f\x7f]/.test(file))
      .sort(),
  ];
  /** @type {string} Minimal .bashrc loader validates and sources the common profile without requiring full runtime helpers. */
  const entryPointContent = trimSpacesOnBothEnd(`
    function safe_source() { [[ -f "$1" && ! -L "$1" && "$1/$(cd -P -- "\${1%/*}" && pwd -P)" != *'.secret.'* ]] && BASH_ENV='' "$BASH" -n "$1" 2> /dev/null || { printf '%s\\n' '[Warning] safe_source bootstrap validation failed' >&2; return 1; };
      . "$1"; }
  `);
  /** @type {string} Cached manifest; refreshing it affects only later shell starts. */
  const profileSourcesBlock = [
    `# Refreshed at epoch: ${Math.floor(Date.now() / 1000)}`,
    ...profileSourceFiles.map(
      (file) => "safe_source '" + file.replace(/'/g, "'\\''") + "'" + (file === BASH_SYLE_COMMON_PATH ? " || return" : ""),
    ),
    "refresh_profiles --if-stale",
  ].join("\n");

  // bootstrap .bash_profile (login shells on all platforms) — sources .bashrc
  log(">> Updating .bash_profile to source .bashrc", bashProfilePath);
  let textContent = await readText`${bashProfilePath}`;
  /** @type {string} Login startup delegates directly; only .bashrc defines the minimal loader. */
  const bashProfileContent = ". '" + bashrcPath.replace(/'/g, "'\\''") + "'";
  // appendTextBlock (not moveTextBlockToEnd): refresh the block in place when it already
  // exists, so user commands deliberately placed after it keep running after it.
  textContent = appendTextBlock(textContent, "Sy bash_syle entry point", bashProfileContent);
  await writeText(bashProfilePath, textContent);

  // bootstrap .bashrc (interactive non-login shells)
  log(">> Updating .bashrc with bash_syle entry point", bashrcPath);
  textContent = await readText`${bashrcPath}`;
  // Placement is preserved on re-run; only brand-new files get the block at the bottom.
  textContent = appendTextBlock(textContent, "Sy bash_syle entry point", entryPointContent);
  /** @type {string} Existing dynamic block is removed before placing it immediately after the entry point. */
  const withoutSources = removeBlock(textContent, profileSourcesKey, "#").trim();
  /** @type {string} Entry-point closing marker retained at its original position. */
  const entryEnd = "# END Sy bash_syle entry point";
  textContent = withoutSources.replace(entryEnd, entryEnd + "\n" + appendTextBlock("", profileSourcesKey, profileSourcesBlock).trim());
  await writeText(bashrcPath, textContent);

  // snapshot after bootstrap assembled the template (before other scripts fill it in)
  await backupProfileSnapshot("bash_syle.1-after-bootstrap");
}

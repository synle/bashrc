/** Bootstraps .bash_profile, .bashrc, and assembles .bash_syle with core and advanced profile content.
 * Empty BEGIN/END markers are pre-placed in profile-core.sh and profile-advanced.sh
 * so that later scripts can update blocks in place via registerWithBashSyleProfile.
 * Shell entry points list discovered work overlays and retain runtime discovery with source-once loading.
 * @returns {Promise<void>} Resolves after writing profiles and startup files.
 * @throws {Error} If profile generation or filesystem writes fail.
 */
async function doWork() {
  /** @type {string} Canonical helper definitions; redeclaration preserves per-shell registry state. */
  const safeSourceContent = await readText`software/bootstrap/safe-source.bash`;
  if (!safeSourceContent.trim()) throw new Error("Missing shared safe_source bootstrap");

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

  /** @type {string[]} Core startup files loaded through the same source-once registry. */
  const entryPointSourceFiles = [BASH_SYLE_COMMON_PATH, ...coreBashProfileFiles, BASH_SYLE_CACHE_PATH];
  /** @type {string[]} Overlay names known during generation; runtime discovery handles later additions. */
  const workProfileFiles = findPathList(BASE_HOMEDIR_LINUX, /^\.work.*\.bash$/, { type: "file" })
    .filter((file) => !file.includes(".secret."))
    .sort();
  /** @type {string} Startup block with quoted explicit entries and a late-discovery fallback. */
  const entryPointContent = trimSpacesOnBothEnd(`
    # define safe_source for non-login shells that skip .bash_profile
    ${safeSourceContent}
    ${entryPointSourceFiles.map((file) => "safe_source '" + file.replace(/'/g, "'\\''") + "'").join("\n")}
    # work profiles discovered during generation
    ${workProfileFiles.map((file) => "safe_source '" + file.replace(/'/g, "'\\''") + "'").join("\n")}
    # runtime discovery also loads eligible work profiles added after generation
    for _sy_work_file in "\$HOME"/.work*.bash; do
      case "\$_sy_work_file" in *.secret.*) continue ;; esac
      [ -f "\$_sy_work_file" ] || continue
      _sy_work_target="$(_safe_source_resolve "\$_sy_work_file")" || continue
      _safe_source_contains "\$_sy_work_target" \${_SY_SAFE_SOURCE_LOADED[@]+"\${_SY_SAFE_SOURCE_LOADED[@]}"} && continue
      safe_source "\$_sy_work_target"
    done
    unset _sy_work_file _sy_work_target
  `);

  // bootstrap .bash_profile (login shells on all platforms) — sources .bashrc
  log(">> Updating .bash_profile to source .bashrc", bashProfilePath);
  let textContent = await readText`${bashProfilePath}`;
  const bashProfileContent = trimSpacesOnBothEnd(`
    # .bash_profile delegates to .bashrc for all shell init
    ${safeSourceContent}
    safe_source '${bashrcPath.replace(/'/g, "'\\''")}'
  `);
  // appendTextBlock (not moveTextBlockToEnd): refresh the block in place when it already
  // exists, so user commands deliberately placed after it keep running after it.
  textContent = appendTextBlock(textContent, "Sy bash_syle entry point", bashProfileContent);
  await writeText(bashProfilePath, textContent);

  // bootstrap .bashrc (interactive non-login shells)
  log(">> Updating .bashrc with bash_syle entry point", bashrcPath);
  textContent = await readText`${bashrcPath}`;
  // Placement is preserved on re-run; only brand-new files get the block at the bottom.
  textContent = appendTextBlock(textContent, "Sy bash_syle entry point", entryPointContent);
  await writeText(bashrcPath, textContent);

  // snapshot after bootstrap assembled the template (before other scripts fill it in)
  await backupProfileSnapshot("bash_syle.1-after-bootstrap");
}

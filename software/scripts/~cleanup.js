/** Final cleanup - strips empty BEGIN/END marker pairs, removes legacy files, and writes per-OS build artifacts.
 * The ~ prefix ensures this runs last (ASCII 126 sorts after all alphanumeric characters).
 */

/**
 * Most-specific-first OS priority. Picks one primary OS to avoid duplicates
 * from overlapping flags (e.g. wsl+windows+ubuntu, steamos+arch_linux).
 * @type {string[]}
 */
const _OS_PRIORITY = ["steamos", "wsl", "chromeos", "android_termux", "mingw64", "mac", "ubuntu", "arch_linux", "redhat", "windows"];

/**
 * Returns the single primary OS name based on active flags and priority order.
 * @returns {string|null} The primary OS name (e.g. "mac", "wsl"), or null if none active.
 */
function _getPrimaryOsName() {
  const activeSet = new Set(
    OS_SCRIPT_PATHS.filter(([active]) => active).map(([, folderPath]) => folderPath.replace("software/scripts/", "")),
  );
  return _OS_PRIORITY.find((name) => activeSet.has(name)) || null;
}

/** Normalizes `test -e/-f ... && source ...` to `[ -f ... ] && . ...` for consistency. */
function _normalizeSourceLines(content) {
  return content.replace(/test -[ef] (".*?") && source (".*?")/g, '[ -f $1 ] && . $2');
}

async function doWork() {
  log(">> Cleaning up bash profile");

  // register profile generated timestamp
  const timestamp = new Date().toISOString();
  registerProfileBlock({
    profilePath: BASH_SYLE_PATH,
    configKey: "Profile Generated Timestamp",
    content: `# Generated: ${timestamp}`,
  });
  await flushProfileBlocks(true);

  // snapshot before cleanup (for debugging profile syntax failures)
  await backupProfileSnapshot("bash_syle.2-before-cleanup");

  let content = await readText`${BASH_SYLE_PATH}`;
  content = removeEmptyBlocks(content);
  content = cleanupExtraWhitespaces(content);
  content = _normalizeSourceLines(content);
  await writeText(BASH_SYLE_PATH, content);

  // normalize source lines in .bash_profile and .bashrc
  const bashProfilePath = path.join(BASE_HOMEDIR_LINUX, ".bash_profile");
  const bashrcPath = path.join(BASE_HOMEDIR_LINUX, ".bashrc");
  for (const filePath of [bashProfilePath, bashrcPath]) {
    let fileContent = await readText`${filePath}`;
    const normalized = _normalizeSourceLines(fileContent);
    if (normalized !== fileContent) {
      log(">> Normalizing source lines in", filePath);
      await writeText(filePath, normalized);
    }
  }

  // snapshot after cleanup
  await backupProfileSnapshot("bash_syle.3-after-cleanup");

  // write bash profile build artifact for the primary OS
  const osName = _getPrimaryOsName();
  if (osName) {
    log(">> Writing bash profile build artifact for:", osName);
    await writeBuildArtifact([
      {
        file: `${BUILD_DIR}/profile_bashrc_${osName}.sh`,
        data: content,
        comments: `Precompiled bash profile for ${osName}`,
        commentStyle: "bash",
      },
    ]);
  }
}

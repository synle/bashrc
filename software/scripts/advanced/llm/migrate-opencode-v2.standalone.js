/** Promote the OpenCode 2 preview install to the canonical OpenCode command. */

// TODO: Remove this migration script and its regression test after existing
// machines have completed the OpenCode v2 migration.
// Run explicitly after installing the v2 package:
// bash run.sh --files=migrate-opencode-v2.standalone.js

/**
 * Move the old isolated preview prefix into a timestamped backup and leave the
 * shared OpenCode config, sessions, and credentials untouched.
 * @returns {Promise<void>} Resolves after the legacy prefix is migrated.
 * @throws {Error} If the legacy prefix cannot be moved safely.
 */
async function doWork() {
  const legacyPrefix = path.join(BASE_HOMEDIR_LINUX, ".local/opencode-2");
  if (!fs.existsSync(legacyPrefix)) {
    log(">> OpenCode v2 migration: no isolated preview prefix found");
    return;
  }

  const canonicalBinary = path.join(BASE_HOMEDIR_LINUX, ".local/bin/opencode");
  if (!fs.existsSync(canonicalBinary) && !fs.isSymbolicLink(canonicalBinary)) {
    throw new Error("OpenCode v2 migration stopped: canonical ~/.local/bin/opencode is missing");
  }

  if (IS_DRY_RUN) {
    log(`<<<< [DryRun] Would move ${legacyPrefix} into an OpenCode migration backup`);
    return;
  }

  const backupRoot = path.join(BASE_HOMEDIR_LINUX, ".local/opencode-migrations");
  await mkdir(backupRoot);
  const backupPath = path.join(backupRoot, `opencode-2-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  fs.renameSync(legacyPrefix, backupPath);
  log(">> OpenCode v2 migration: moved isolated preview prefix to", backupPath);
}

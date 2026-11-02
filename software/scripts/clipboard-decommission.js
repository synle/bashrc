/** NOTE TODO DECOMMISION: remove this bootstrap after legacy text history has migrated. */

/**
 * Move old clipboard text files without overwriting entries, then remove the empty legacy folder.
 * Images and the Vim image executable are preserved.
 * @returns {Promise<void>} Resolves after migration, or without writes during dry runs.
 * @throws {Error} On migration failures; non-regular legacy entries are left for manual handling.
 */
async function doWork() {
  /** @type {string} Exact retired text-history folder. */
  const legacy = path.join(BASE_HOMEDIR_LINUX, ".bash_syle_copies");
  if (IS_DRY_RUN || !fs.existsSync(legacy) || fs.lstatSync(legacy).isSymbolicLink()) return;
  /** @type {string} Replacement history folder derived from the canonical personal root. */
  const destination = path.join(SY_ROOT_FOLDER, ".syle_clipboard", "plain");
  fs.mkdirSync(destination, { recursive: true });
  for (const name of fs.readdirSync(legacy)) {
    /** @type {string} Source entry; never follow links. */
    const source = path.join(legacy, name);
    if (!fs.lstatSync(source).isFile()) continue;
    /** @type {string} Non-overwriting destination; collisions preserve the legacy entry. */
    const target = path.join(destination, name);
    if (fs.existsSync(target)) continue;
    // Exclusive creation avoids overwrites and the cross-device copyFile failure path.
    fs.writeFileSync(target, fs.readFileSync(source), { flag: "wx", mode: 0o600 });
    fs.utimesSync(target, fs.statSync(source).atime, fs.statSync(source).mtime);
    fs.unlinkSync(source);
  }
  if (fs.readdirSync(legacy).length === 0) fs.rmdirSync(legacy);
  else log(">> Legacy clipboard entries remain; inspect before removing", legacy);
}

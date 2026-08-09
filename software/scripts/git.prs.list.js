/**
 * Installer for the `list_prs` CLI.
 *
 * Copies the self-contained Node program `git.prs.list.javascript` to
 * `~/.local/bin/list_prs` and marks it executable, so it runs as a plain
 * `list_prs` on the PATH (`~/.local/bin` is already on PATH — see
 * `bash-path-candidate.profile.bash`).
 *
 * The source keeps its `.javascript` extension on purpose: only `.js` / `.sh`
 * files are picked up by script discovery, so the payload is never mistaken for
 * a doWork() script — it is pure data this installer stamps out. The install is
 * idempotent: `writeText` skips the copy when the destination already matches.
 */

/** @type {string} Repo-relative path to the CLI payload. */
const LIST_PRS_SOURCE = `software/scripts/git.prs.list.javascript`;

/**
 * Absolute path where the executable is installed.
 * @returns {string}
 */
function _listPrsDestination() {
  return path.join(BASE_HOMEDIR_LINUX, `.local`, `bin`, `list_prs`);
}

/** Install `list_prs` into `~/.local/bin` and make it executable. */
async function doWork() {
  const dest = _listPrsDestination();
  const content = await readText`${LIST_PRS_SOURCE}`;

  if (!IS_DRY_RUN) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
  }

  await writeText(dest, content);

  if (!IS_DRY_RUN) {
    fs.chmodSync(dest, 0o755);
  }

  log(`list_prs installed at ${dest}`);
}

/** Remove the installed `list_prs` executable. */
async function undoWork() {
  const dest = _listPrsDestination();
  if (IS_DRY_RUN) {
    log(`[dry-run] would remove ${dest}`);
    return;
  }
  if (fs.existsSync(dest)) {
    fs.unlinkSync(dest);
    log(`Removed ${dest}`);
  }
}

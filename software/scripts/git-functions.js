/**
 * Installs the standalone Git command-line functions.
 *
 * Payloads use `.cjs` so script discovery does not execute them as setup scripts
 * and older Node runtimes can execute their CommonJS `require` calls.
 * This installer copies each payload to `~/.local/bin`, where it becomes an
 * executable command on PATH.
 */

/** @type {Array<{source: string, command: string}>} Git CLI payloads to install. */
const GIT_FUNCTION_PAYLOADS = [
  { source: `software/scripts/git.pr_list.cjs`, command: `list_prs` },
  { source: `software/scripts/git.worktree_clean.cjs`, command: `worktree_clean` },
  { source: `software/scripts/git.pr_merge.cjs`, command: `pr_merge` },
  { source: `software/scripts/git.worktree_create.cjs`, command: `worktree_create` },
];

/**
 * Resolve an installed command path.
 * @param {string} command Command name.
 * @returns {string} Absolute executable path.
 */
function _gitFunctionDestination(command) {
  return path.join(BASE_HOMEDIR_LINUX, `.local`, `bin`, command);
}

/** Install all standalone Git command-line functions. */
async function doWork() {
  for (const payload of GIT_FUNCTION_PAYLOADS) {
    const dest = _gitFunctionDestination(payload.command);
    const content = await readText`${payload.source}`;

    if (!IS_DRY_RUN) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
    }

    await writeText(dest, content);

    if (!IS_DRY_RUN) {
      fs.chmodSync(dest, 0o755);
    }

    log(`${payload.command} installed at ${dest}`);
  }
}

/** Remove all installed Git command-line functions. */
async function undoWork() {
  for (const payload of GIT_FUNCTION_PAYLOADS) {
    const dest = _gitFunctionDestination(payload.command);
    if (IS_DRY_RUN) {
      log(`[dry-run] would remove ${dest}`);
      continue;
    }
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
      log(`Removed ${dest}`);
    }
  }
}

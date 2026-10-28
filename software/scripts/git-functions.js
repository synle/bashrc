/**
 * Installs the standalone Git command-line functions.
 *
 * Payloads use `.cjs` so script discovery does not execute them as setup scripts
 * and older Node runtimes can execute their CommonJS `require` calls.
 * This installer copies commands and sibling support modules to `~/.local/bin`.
 * Commands are executable; support modules are non-executable.
 */

/** @type {Array<{source: string, command: string, mode?: number}>} Git commands and sibling support modules to install. */
const GIT_FUNCTION_PAYLOADS = [
  { source: `software/scripts/git.worktree_info.cjs`, command: `git.worktree_info.cjs`, mode: 0o644 },
  { source: `software/scripts/git.codegraph_refresh.cjs`, command: `codegraph_refresh` },
  { source: `software/scripts/git.checkout.cjs`, command: `git_checkout` },
  { source: `software/scripts/git.pr_list.cjs`, command: `list_prs` },
  { source: `software/scripts/git.worktree_clean.cjs`, command: `worktree_clean` },
  { source: `software/scripts/git.worktree_list.cjs`, command: `worktree_list` },
  { source: `software/scripts/git.pr_merge.cjs`, command: `pr_merge` },
  { source: `software/scripts/git.worktree_create.cjs`, command: `worktree_create` },
];

/**
 * Resolve an installed payload path.
 * @param {string} command Registered destination filename.
 * @returns {string} Absolute payload path.
 */
function _gitFunctionDestination(command) {
  return path.join(BASE_HOMEDIR_LINUX, `.local`, `bin`, command);
}

/**
 * Install standalone Git commands and sibling support modules with their declared permissions.
 * @returns {Promise<void>} Resolves after every registered payload is deployed.
 * @throws {Error} Reading, writing, or permission updates fail.
 * @sideEffects Logs destinations; writes payloads and permissions only outside dry-run mode.
 */
async function doWork() {
  for (const payload of GIT_FUNCTION_PAYLOADS) {
    const dest = _gitFunctionDestination(payload.command);
    const content = await readText`${payload.source}`;

    if (!IS_DRY_RUN) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
    }

    await writeText(dest, content);

    if (!IS_DRY_RUN) {
      fs.chmodSync(dest, payload.mode ?? 0o755);
    }

    log(`${payload.command} installed at ${dest}`);
  }
}

/**
 * Remove installed Git commands and their registered sibling support modules.
 * @returns {Promise<void>} Resolves after registered installed payloads are removed.
 * @throws {Error} A payload cannot be inspected or removed.
 * @sideEffects Deletes registered payloads outside dry-run mode and logs each operation.
 */
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

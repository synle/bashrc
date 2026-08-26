/**
 * Installs the standalone `set_terminal_title` command.
 *
 * The payload uses a `.bash` extension so script discovery (which runs only
 * `.js` / `.sh`) does not execute it as a setup script. This installer copies
 * it to `~/.local/bin`, where it becomes an executable command on PATH -
 * callable from any shell or agent CLI without sourcing the profile, which a
 * non-interactive agent tool shell never does.
 *
 * See software/scripts/set_terminal_title.cli.bash for the routing rationale
 * (tmux self-rename vs OSC vs no-op) and tmux.config's `set-titles on` for how
 * a renamed window reaches the outer terminal tab.
 */

/** @type {Array<{source: string, command: string}>} Standalone CLI payloads to install. */
const TERMINAL_TITLE_PAYLOADS = [
  { source: `software/scripts/set_terminal_title.cli.bash`, command: `set_terminal_title` },
];

/**
 * Resolve an installed command path.
 * @param {string} command Command name.
 * @returns {string} Absolute executable path.
 */
function _terminalTitleDestination(command) {
  return path.join(BASE_HOMEDIR_LINUX, `.local`, `bin`, command);
}

/** Install the standalone terminal-title command. */
async function doWork() {
  for (const payload of TERMINAL_TITLE_PAYLOADS) {
    const dest = _terminalTitleDestination(payload.command);
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

/** Remove the installed terminal-title command. */
async function undoWork() {
  for (const payload of TERMINAL_TITLE_PAYLOADS) {
    const dest = _terminalTitleDestination(payload.command);
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

/** Installs tmux plugin manager (tpm) and writes tmux configuration. */

/**
 * @type {Object<string, string|number>} Tunable values substituted into
 * `tmux.config` at write time. The config file carries `{{KEY}}` placeholders;
 * every entry here replaces its matching token, so a number like the pane
 * resize step is declared once here instead of repeated across eight `bind`
 * lines. Keys are the bare token name without the braces.
 */
const TMUX_CONFIG = {
  // Cells moved per prefix+alt-arrow / prefix+ctrl-arrow resize step. tmux's
  // stock steps are 5 and 1, both too small to cross a wide pane without a
  // long key repeat.
  RESIZE_PANE_CELLS: 10,
};

/**
 * Replaces every `{{KEY}}` placeholder in the raw tmux config with its value
 * from {@link TMUX_CONFIG}.
 *
 * @param {string} content - Raw `tmux.config` text, placeholders intact.
 * @returns {string} The config with every known placeholder substituted.
 */
function resolveTmuxConfigPlaceholders(content) {
  for (const [token, value] of Object.entries(TMUX_CONFIG)) {
    content = content.split(`{{${token}}}`).join(String(value));
  }
  return content;
}

/**
 * Installs tpm and writes `~/.tmux.conf` plus the copy shim.
 *
 * @returns {Promise<void>}
 */
async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".tmux.conf");
  const tpmPath = path.join(BASE_HOMEDIR_LINUX, ".tmux", "plugins", "tpm");

  // install tpm (tmux plugin manager)
  if (isForceRefreshStale(tpmPath)) {
    await deleteFolder(tpmPath);
  }

  if (!fs.existsSync(tpmPath)) {
    log(">> Installing tmux plugin manager (tpm)", tpmPath);
    gitClone("https://github.com/tmux-plugins/tpm.git", tpmPath);
  } else {
    log(">> tpm already installed", tpmPath);
  }

  // write tmux config
  log(">> Updating .tmux.conf", targetPath);
  const content = resolveTmuxConfigPlaceholders(await readText`software/scripts/advanced/tmux.config`);
  await writeText(targetPath, content);

  await writeTmuxCopyShim();
}

/**
 * Writes the `sy-tmux-copy` shim onto PATH.
 *
 * tmux runs every `copy-pipe` / `run-shell` target through `sh -c`, which has
 * no shell profile loaded, so the interactive `copy()` bash function is simply
 * not found and every yank fails silently. The shim is the one place that
 * bridges the two: it sources the profile, then calls `copy --raw`.
 *
 * @returns {Promise<void>}
 */
async function writeTmuxCopyShim() {
  const shimPath = path.join(BASE_HOMEDIR_LINUX, ".local", "bin", "sy-tmux-copy");

  log(">> Updating tmux copy shim", shimPath);

  if (!IS_DRY_RUN) {
    fs.mkdirSync(path.dirname(shimPath), { recursive: true });
  }

  await writeText(
    shimPath,
    code`
      #!/usr/bin/env bash
      # Bridge tmux copy-mode to the profile's copy() function.
      # tmux runs this through \`sh -c\` with no profile loaded, so source it here.
      # --raw keeps the selection byte-exact (unwrap would reflow it).
      # shellcheck disable=SC1090,SC1091
      source "$HOME/.bash_syle" > /dev/null 2>&1 || true
      if type copy > /dev/null 2>&1; then
        copy --raw
      else
        # No profile clipboard on this host. Drain stdin so the pipe never
        # blocks - tmux has already set its own buffer and emitted OSC 52,
        # which is the fallback clipboard path.
        command cat > /dev/null
        echo "sy-tmux-copy: copy() not available" >&2
        exit 1
      fi
    `,
  );

  if (!IS_DRY_RUN) {
    fs.chmodSync(shimPath, 0o755);
  }
}

/** Installs tmux plugin manager (tpm) and writes tmux configuration. */

/**
 * @type {Object<string, string|number>} Tunable values substituted into
 * `tmux.config` at write time. The config file carries `<NAME>` placeholders;
 * every entry here replaces its matching token, so a number like the pane
 * resize step is declared once here instead of repeated across eight `bind`
 * lines. Keys are bare token names — `resolvePlaceholders` adds the brackets,
 * and merges in the shared `<<SY_ROOT_FOLDER>>` / `<<HOME>>` tokens for free.
 */
const TMUX_CONFIG = {
  // Cells moved per prefix+alt-arrow / prefix+ctrl-arrow resize step. tmux's
  // stock steps are 5 and 1, both too small to cross a wide pane without a
  // long key repeat.
  RESIZE_PANE_CELLS: 10,
};

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
  const content = resolvePlaceholders(await readText`software/scripts/advanced/tmux.config`, TMUX_CONFIG);
  await writeText(targetPath, content);

  await writeTmuxCopyShim();
  await writeTmuxKeysShim();
}

/**
 * Writes the `sy-tmux-keys` shim onto PATH — the searchable key palette.
 *
 * Stock `prefix+?` runs `list-keys -N`, which prints ONLY the bindings that
 * carry a `-N` note. Every binding this repo adds is written without one, so
 * roughly sixty custom chords are invisible in the built-in help — the reason
 * they are impossible to remember. This lists every binding in both tables
 * instead, formatted one per line and piped into a filter.
 *
 * fzf when it is on PATH, `less` otherwise: tmux runs a popup through `sh -c`
 * with no profile, so the PATH here is whatever the SERVER inherited at start,
 * and fzf cannot be assumed. `less` is POSIX-ish enough to be everywhere and
 * still supports `/` search, so the palette degrades instead of failing.
 *
 * @returns {Promise<void>}
 */
async function writeTmuxKeysShim() {
  const shimPath = path.join(BASE_HOMEDIR_LINUX, ".local", "bin", "sy-tmux-keys");

  log(">> Updating tmux key palette shim", shimPath);

  if (!IS_DRY_RUN) {
    fs.mkdirSync(path.dirname(shimPath), { recursive: true });
  }

  await writeText(
    shimPath,
    code`
      #!/usr/bin/env bash
      # Searchable list of every tmux key binding, for the alt+p / prefix+? palette.
      # Run through \`sh -c\` by tmux with no profile loaded - keep this self-contained.

      # Render one table into "<key>\\t<command>" rows.
      # list-keys prints "bind-key [-r] -T <table> <key> <command>"; drop everything
      # through the table name so the key sorts first, and label the prefix rows so a
      # chord reads the way it is typed.
      function _sy_tmux_table() {
        local table="\$1" label="\$2"
        tmux list-keys -T "\$table" 2> /dev/null | sed -E "s/^bind-key +(-r )?-T \$table +//" | while IFS= read -r line; do
          local key="\${line%% *}"
          local cmd="\${line#* }"
          printf '%s%-18s  %s\\n' "\$label" "\$key" "\$cmd"
        done
      }

      {
        _sy_tmux_table root ""
        _sy_tmux_table prefix "C-b "
      } | sort -u | {
        if type -P fzf > /dev/null 2>&1; then
          fzf --prompt='tmux keys> ' --header='type to filter - esc to close' --no-sort
        else
          less -R
        fi
      }
    `,
  );

  if (!IS_DRY_RUN) {
    fs.chmodSync(shimPath, 0o755);
  }
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

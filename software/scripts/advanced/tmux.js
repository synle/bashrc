/** Installs tmux plugin manager (tpm) and writes tmux configuration. */

/**
 * @type {Object<string, string|number>} Tunable values and shared fragments substituted into
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
  // Right-click pane menu items, shared by the MouseDown3Border and
  // MouseDown3Pane bindings so the two menus can never drift apart.
  PANE_MENU_ITEMS: String.raw`"Rename Session" s { command-prompt -p "session name:" -I "#S" "rename-session '%%'" } "Rename Tab" t { command-prompt -p "window name:" -I "#W" "rename-window '%%'" } "Rename Pane Split" p { command-prompt -p "pane name:" -I "#{@pane_name}" "set -p @pane_name '%%'" } "" "Close Session" S { confirm-before -p "close session #S and ALL its windows? (y/n)" kill-session } "Close Tab" T { confirm-before -p "close window T#I and all its panes? (y/n)" kill-window } "Close Pane Split" P { confirm-before -p "close pane #{pane_index}? (y/n)" kill-pane } "" "Vertical Split" v { split-window -h -c "#{pane_current_path}" } "Horizontal Split" h { split-window -v -c "#{pane_current_path}" } "#{?#{>:#{window_panes},1},,-}Break Pane to New Tab" b { break-pane } "" "#{?#{>:#{window_panes},1},,-}Swap Up" u { swap-pane -U } "#{?#{>:#{window_panes},1},,-}Swap Down" d { swap-pane -D } "#{?#{>:#{window_panes},1},,-}#{?window_zoomed_flag,Unzoom,Zoom}" z { resize-pane -Z } "" "Find in Scrollback" f { copy-mode ; send-keys / } "Copy Mode (vim keys)" g { copy-mode } "Copy All Scrollback" y { run "tmux capture-pane -p -J -S - -t #{pane_id} | $HOME/.local/bin/sy-tmux-copy --trim" ; display "Scrollback copied to clipboard" } "Open URLs" o { display-popup -E -w 80% -h 60% -T " open url " "$HOME/.local/bin/sy-tmux-urls #{pane_id}" } "" "Export Workspace" e { run "$HOME/.local/bin/sy-tmux-export '#{session_name}'" }`,
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
  await writeTmuxUrlsShim();
  await writeTmuxExportShim();
}

/**
 * Writes the `sy-tmux-urls` shim onto PATH — the alt+u / prefix+u URL picker.
 *
 * With `mouse on`, tmux swallows plain clicks, so URLs printed as text (not
 * OSC 8) are hard to open. The shim scrapes the target pane's whole scrollback
 * for http(s) URLs, dedupes them newest first, lets fzf pick one or several,
 * and opens each through the profile's cross-platform `open()`.
 *
 * Args at runtime: `$1` = tmux pane id to scrape (the popup is its own pane).
 *
 * @returns {Promise<void>}
 */
async function writeTmuxUrlsShim() {
  const shimPath = path.join(BASE_HOMEDIR_LINUX, ".local", "bin", "sy-tmux-urls");

  log(">> Updating tmux URL picker shim", shimPath);

  if (!IS_DRY_RUN) {
    fs.mkdirSync(path.dirname(shimPath), { recursive: true });
  }

  await writeText(
    shimPath,
    code`
      #!/usr/bin/env bash
      # Pick URLs from a tmux pane's scrollback and open them in the browser.
      # Usage: sy-tmux-urls <pane-id>
      # Run by tmux with no profile loaded, so source it for open() and PATH.
      # shellcheck disable=SC1090,SC1091
      source "$HOME/.bash_syle" > /dev/null 2>&1 || true

      pane="\${1:-}"
      # Dedupe + sort: the dedupe key ignores trailing slashes so \`abc.com\` and
      # \`abc.com/\` collapse to one row; the list is then sorted A-Z, case-insensitive.
      # Pipeline: split into tokens on whitespace and markdown/quote delimiters
      # (\`](\` splits nested links like \`[![a](u1)](u2)\`), strip leading \`(*_~!\`,
      # keep tokens that START as a URL - \`http(s)://\`, \`www.\`, or a bare
      # \`host.tld/\` (the slash is required so \`foo.js\` / \`index.js:412\` never
      # match; anchoring at token start keeps \`~/x/a.io/\` paths out). The trim
      # loop drops trailing prose/emphasis (\`.,;:!?}>*_~\`) plus any unbalanced
      # \`)\`, and scheme-less hits get \`https://\` so open() sees a URL, not a file.
      # Final gate: after the scheme the host must contain a dot or a port (\`:\`),
      # OR a \`/\` must follow - drops junk like \`http://www\` while keeping
      # \`http://localhost:3000\` and \`http://localhost/x\`.
      urls="\$(tmux capture-pane -p -J -S - \${pane:+-t "\$pane"} \\
        | sed -E 's/\\]\\(/ /g' \\
        | tr -s ' \\t<>"'"'"'\`[]' '\\n' \\
        | sed -E 's/^[(*_~!]+//' \\
        | command grep -oE '^(https?://|www\\.|[[:alnum:]][[:alnum:]-]*(\\.[[:alnum:]-]+)*\\.[[:alpha:]]{2,}/)[^[:space:]]*' \\
        | awk '{ u = \$0; while (length(u)) { c = substr(u, length(u), 1); if (index(".,;:!?}>*_~", c)) { u = substr(u, 1, length(u) - 1); continue } if (c == ")") { t = u; o = gsub(/\\(/, "", t); t = u; cl = gsub(/\\)/, "", t); if (cl > o) { u = substr(u, 1, length(u) - 1); continue } } break } if (u !~ /^https?:\\/\\//) u = "https://" u; r = substr(u, index(u, "://") + 3); if (r ~ /^[^\\/]*[.:]/ || r ~ /\\//) print u }' \\
        | awk '{ k = \$0; sub(/\\/+\$/, "", k); if (!seen[k]++) print }' \\
        | sort -f)"

      if [ -z "\$urls" ]; then
        echo "No URLs found in this pane. Press any key."
        read -r -n 1 -s
        exit 0
      fi

      if type -P fzf > /dev/null 2>&1; then
        picked="\$(printf '%s\\n' "\$urls" | fzf --multi --no-sort --prompt='open url> ' --header='enter open - tab multi-select - esc close')"
      else
        # No fzf: open the newest URL.
        picked="\$(printf '%s\\n' "\$urls" | head -n 1)"
      fi
      [ -z "\$picked" ] && exit 0

      printf '%s\\n' "\$picked" | while IFS= read -r url; do
        if type open > /dev/null 2>&1; then
          open "\$url" > /dev/null 2>&1
        elif type -P xdg-open > /dev/null 2>&1; then
          xdg-open "\$url" > /dev/null 2>&1 &
        fi
      done
    `,
  );

  if (!IS_DRY_RUN) {
    fs.chmodSync(shimPath, 0o755);
  }
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

      # Resolve tmux by absolute path when it is not on the inherited PATH. A tmux
      # popup runs with whatever PATH the SERVER started with, which on macOS often
      # lacks /opt/homebrew/bin - and a bare \`tmux\` there prints nothing at all.
      TMUX_BIN="\$(type -P tmux 2> /dev/null)"
      for _candidate in /opt/homebrew/bin/tmux /usr/local/bin/tmux /usr/bin/tmux; do
        [ -n "\$TMUX_BIN" ] && break
        [ -x "\$_candidate" ] && TMUX_BIN="\$_candidate"
      done
      if [ -z "\$TMUX_BIN" ]; then
        echo "sy-tmux-keys: tmux not found on PATH" >&2
        exit 1
      fi

      # Render one table into "<key>  <command>" rows.
      # list-keys prints "bind-key [-r] -T <table> <key> <command>"; drop everything
      # through the table name so the key sorts first, and label the prefix rows so a
      # chord reads the way it is typed.
      function _sy_tmux_table() {
        local table="\$1" label="\$2"
        "\$TMUX_BIN" list-keys -T "\$table" 2> /dev/null | sed -E "s/^bind-key +(-r )?-T \$table +//" | while IFS= read -r line; do
          local key="\${line%% *}"
          local cmd="\${line#* }"
          # list-keys pads its own key column, so cmd arrives with leading blanks.
          cmd="\${cmd#"\${cmd%%[![:space:]]*}"}"
          printf '%s%-18s  %s\\n' "\$label" "\$key" "\$cmd"
        done
      }

      {
        _sy_tmux_table root ""
        _sy_tmux_table prefix "C-b "
      } | sort -u | {
        # Only reach for an interactive filter when there is a terminal to drive it.
        # Without this a non-tty caller (a test, a pipe) hangs in fzf forever.
        if [ ! -t 1 ]; then
          command cat
        elif type -P fzf > /dev/null 2>&1; then
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
 * Writes the `sy-tmux-export` shim onto PATH — the right-click "Export
 * Workspace" item.
 *
 * Two modes, so no quoting of user text ever lands in tmux.config:
 * - `sy-tmux-export <session>` opens a tmux prompt (`export to:`) prefilled
 *   with `~/tmux_workspace_<stamp>.json`; the user edits it or presses Enter.
 * - `sy-tmux-export --save <session> <path>` is the prompt's callback: it
 *   sources the profile (run-shell has none) and calls `workspace_export`,
 *   which names the saved session after the file and reports via
 *   `tmux display-message`.
 *
 * Side effects: writes and chmods `~/.local/bin/sy-tmux-export`.
 *
 * @returns {Promise<void>}
 */
async function writeTmuxExportShim() {
  const shimPath = path.join(BASE_HOMEDIR_LINUX, ".local", "bin", "sy-tmux-export");

  log(">> Updating tmux export shim", shimPath);

  if (!IS_DRY_RUN) {
    fs.mkdirSync(path.dirname(shimPath), { recursive: true });
  }

  await writeText(
    shimPath,
    code`
      #!/usr/bin/env bash
      # Right-click "Export Workspace": prompt for the path, then export.
      # A path containing a single quote is not supported (it is spliced into
      # the prompt's callback inside single quotes).
      if [ "$1" = "--save" ]; then
        # shellcheck disable=SC1090,SC1091
        source "$HOME/.bash_syle" > /dev/null 2>&1 || true
        workspace_export "$2" "$3" > /dev/null
        exit $?
      fi
      session="$1"
      [ -n "$session" ] || session=$(tmux display-message -p '#{session_name}')
      default="$HOME/tmux_workspace_$(date +%Y-%m-%d_%H-%M-%S).json"
      tmux command-prompt -p "export to:" -I "$default" "run-shell \\"$0 --save '$session' '%%'\\""
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
      # --trim (scrollback captures only) strips trailing spaces on every line
      # and drops blank lines at the start and end - capture-pane pads each
      # line to the pane width and returns the empty screen rows below the
      # prompt. Blank lines in the middle are kept. A copy-mode selection is
      # passed without --trim, so what you selected is what you get.
      # shellcheck disable=SC1090,SC1091
      source "$HOME/.bash_syle" > /dev/null 2>&1 || true
      function _sy_filter() {
        if [ "$1" = "--trim" ]; then
          awk '{ sub(/[ \\t]+$/, "") } NF { if (seen) for (i = 0; i < gap; i++) print ""; gap = 0; seen = 1; print; next } { gap++ }'
        else
          command cat
        fi
      }
      if type copy > /dev/null 2>&1; then
        _sy_filter "$1" | copy --raw
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

/** * Bootstraps .bash_profile and .bashrc with entry points for .bash_syle, the single source of all shell config. */
async function doWork() {
  // wipe out the old bash_syle first
  const coreBashProfileFiles = [BASH_SYLE_PATH, BASH_SYLE_AUTOCOMPLETE_PATH];
  for (const file of coreBashProfileFiles) {
    log(">> Wiping out the old bash profile asset: ", file);
    writeText(file, ``);
  }

  const entryPointContent = trimSpacesOnBothEnd(`
    [ -f "${BASH_SYLE_COMMON_PATH}" ] && . "${BASH_SYLE_COMMON_PATH}" > /dev/null 2>&1
    ${coreBashProfileFiles.map((file) => '[ -f "' + file + '" ] && . "' + file + '" > /dev/null 2>&1').join("\n")}

    # ---- Keybindings ----
    # Tab Completion
    bind '"\\t": menu-complete'                        # Tab — cycle completions forward
    bind '"\\e[Z": menu-complete-backward'             # Shift+Tab — cycle completions backward

    # Cursor Movement — Linux / WSL
    bind '"\\e[1;5A": beginning-of-line'               # Ctrl+Up — jump to beginning of line
    bind '"\\e[1;5B": end-of-line'                     # Ctrl+Down — jump to end of line
    bind '"\\e[1;5D": backward-word'                   # Ctrl+Left — jump one word backward
    bind '"\\e[1;5C": forward-word'                    # Ctrl+Right — jump one word forward

    # Cursor Movement — macOS (Option key)
    bind '"\\e\\e[C": forward-word'                    # Option+Right — jump one word forward
    bind '"\\e\\e[D": backward-word'                   # Option+Left — jump one word backward
    bind '"\\e\\e[A": beginning-of-line'               # Option+Up — jump to beginning of line
    bind '"\\e\\e[B": end-of-line'                     # Option+Down — jump to end of line

    # History Navigation
    bind '"\\e[A": history-search-backward'            # Up arrow — search history backward matching prefix
    bind '"\\e[B": history-search-forward'             # Down arrow — search history forward matching prefix

    # Shortcuts
    bind '"\\C-a": beginning-of-line'                    # Ctrl+A — jump to beginning of line
    bind '"\\C-e": end-of-line'                          # Ctrl+E — jump to end of line
    bind '"\\C-l": clear-screen'                       # Ctrl+L — clear screen
    bind '"\\C-x": edit-and-execute-command'             # Ctrl+X — open command in $EDITOR
    bind '"\\C-t": "fuzzy_open vim\\r"'               # Ctrl+T — fuzzy open with vim
    bind '"\\C-p": "fuzzy_open\\r"'                   # Ctrl+P — fuzzy open (files + folders)
    bind '"\\C-b": "fuzzy_favorite_command\\r"'        # Ctrl+B — fuzzy favorite command picker
    bind '"\\C-n": "fuzzy_make_component\\r"'          # Ctrl+N — fuzzy make-component scaffold

    # Ctrl+R — fzf history search (falls back to default reverse-i-search)
    if command -v fzf &>/dev/null; then
      __fzf_history__(){
        local selected
        selected=$(history | sed 's/^ *[0-9]* *\\(\\[[^]]*\\] \\)*//' | tac | awk '!seen[$0]++' | fzf --height=40% --reverse --tac +s -e -q "\\${READLINE_LINE}")
        if [ -n "$selected" ]; then
          READLINE_LINE="$selected"
          READLINE_POINT=\\${#selected}
        fi
      }
      bind -x '"\\C-r": "__fzf_history__"'
    fi
  `);

  // bootstrap .bash_profile (login shells on all platforms)
  {
    const targetPath = path.join(BASE_HOMEDIR_LINUX, ".bash_profile");
    log(">> Updating .bash_profile with bash_syle entry point", targetPath);
    let textContent = readText(targetPath);
    textContent = prependTextBlock(textContent, "Sy bash_syle entry point", entryPointContent);
    writeText(targetPath, textContent);
  }

  // bootstrap .bashrc (interactive non-login shells)
  {
    const targetPath = path.join(BASE_HOMEDIR_LINUX, ".bashrc");
    log(">> Updating .bashrc with bash_syle entry point", targetPath);
    let textContent = readText(targetPath);
    textContent = prependTextBlock(textContent, "Sy bash_syle entry point", entryPointContent);
    writeText(targetPath, textContent);
  }
}

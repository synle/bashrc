/** * Writes the .inputrc file with readline keybindings, autocomplete settings, and fzf shortcuts. */
async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".inputrc");

  log(">> Updating .inputrc", targetPath);

  const content = `
# To install manually:
# curl -o ~/.inputrc ${BASH_PROFILE_CODE_REPO_RAW_URL}/.build/inputrc

################################################################################
# ---- Completion Behavior ----
################################################################################
set completion-ignore-case on          # Case-insensitive tab completion (e.g. "doc" matches "Documents")
set expand-tilde on                    # Expand ~ to the full home directory path during completion
set show-all-if-ambiguous on           # Show all completions immediately instead of waiting for a second Tab press
set visible-stats on                   # Append file type indicators (/ for dirs, * for executables, @ for symlinks)
set colored-stats on                   # Color-code completions by file type (like ls --color)
set colored-completion-prefix on       # Highlight the common prefix in completion results
set mark-symlinked-directories on      # Append / to symlinked directories during completion
set completion-map-case on             # Treat hyphens and underscores as equivalent during completion
set skip-completed-text on             # Don't duplicate text when completing in the middle of a word
set menu-complete-display-prefix on    # Show the common prefix before cycling through completions
set match-hidden-files off             # Don't complete dotfiles unless you type the leading .
set page-completions off               # Show all completions at once instead of paging with --More--
set completion-query-items 250         # Raise threshold before "Display all N possibilities?" prompt (default 100)
set echo-control-characters off        # Don't print ^C on Ctrl+C — cleaner terminal output

################################################################################
# ---- Editing Behavior ----
################################################################################
# Disable the terminal bell — no beep or flash on errors
set bell-style none
set enable-bracketed-paste on          # Paste multi-line text safely without executing each line

################################################################################
# ---- History ----
################################################################################
set revert-all-at-newline on           # Reset edited history entries when you press Enter — keeps history clean

################################################################################
# ---- Tab Completion ----
################################################################################
# Tab to cycle through completions (forward)
"\\t": menu-complete

# Shift+Tab to cycle through completions (backward)
"\\e[Z": menu-complete-backward

################################################################################
# ---- Cursor Movement — Linux / WSL ----
################################################################################
"\\e[1;5A": beginning-of-line          # Ctrl+Up — jump to beginning of line
"\\e[1;5B": end-of-line                # Ctrl+Down — jump to end of line
"\\e[1;5D": backward-word              # Ctrl+Left — jump one word backward
"\\e[1;5C": forward-word               # Ctrl+Right — jump one word forward

################################################################################
# ---- Cursor Movement — macOS (Option key) ----
################################################################################
"\\e\\e[C": forward-word               # Option+Right — jump one word forward
"\\e\\e[D": backward-word              # Option+Left — jump one word backward
"\\e\\e[A": beginning-of-line          # Option+Up — jump to beginning of line
"\\e\\e[B": end-of-line                # Option+Down — jump to end of line

################################################################################
# ---- History Navigation ----
################################################################################
"\\e[A": history-search-backward       # Up arrow — search history backward matching current prefix
"\\e[B": history-search-forward        # Down arrow — search history forward matching current prefix

################################################################################
# ---- Custom Shortcuts ----
################################################################################
"\\C-l": clear-screen                  # Ctrl+L — clear screen (explicit, some terminals don't set this)
"\\C-e": edit-and-execute-command      # Ctrl+E — open current command in $EDITOR
"\\C-o": "fuzzy_directory\\r"          # Ctrl+O — run fuzzy directory picker
"\\C-t": "fuzzy_vim\\r"               # Ctrl+T — run fuzzy vim opener
"\\C-p": "fuzzy_view_file\\r"         # Ctrl+P — run fuzzy file viewer
"\\C-b": "fuzzy_favorite_command\\r"   # Ctrl+B — run fuzzy favorite command picker
"\\C-n": "fuzzy_make_component\\r"       # Ctrl+N — run fuzzy make-component scaffold
    `.trim();

  // write to build file
  writeToBuildFile([{ file: "inputrc", data: content }]);

  // write if there are change
  writeText(targetPath, content);
}

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
    `.trim();

  // write to build file
  writeToBuildFile([{ file: "inputrc", data: content }]);

  // write if there are change
  writeText(targetPath, content);
}

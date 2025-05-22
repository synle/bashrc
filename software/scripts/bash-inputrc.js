/** Writes the .inputrc file with readline keybindings, autocomplete settings, and fzf shortcuts. */
async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".inputrc");

  log(">> Updating .inputrc", targetPath);

  const content = code`
    # To install manually:
    # curl -o ~/.inputrc ${BASH_PROFILE_CODE_REPO_RAW_URL}/.build/inputrc?raw=1

    ${LINE_BREAK_HASH}
    # ---- Completion Behavior ----
    ${LINE_BREAK_HASH}
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

    ${LINE_BREAK_HASH}
    # ---- Editing Behavior ----
    ${LINE_BREAK_HASH}
    # Disable the terminal bell — no beep or flash on errors
    set bell-style none
    set enable-bracketed-paste on          # Paste multi-line text safely without executing each line

    ${LINE_BREAK_HASH}
    # ---- History ----
    ${LINE_BREAK_HASH}
    set revert-all-at-newline on           # Reset edited history entries when you press Enter — keeps history clean
  `;

  // write to build file
  await writeBuildArtifact([{ file: `${BUILD_DIR}/inputrc`, data: content }]);

  // write if there are change
  await backupConfigFile(targetPath);
  await writeText(targetPath, content);
}

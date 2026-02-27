/// <reference path="../index.js" />

/** * Clones, installs, and registers fzf (fuzzy finder) with bashrc and bookmark aliases. */
async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".fzf");

  console.log("  >> Download and installing fzf:", consoleLogColor4(targetPath));

  if (TEST_FORCE_REFRESH) {
    await deleteFolder(targetPath);
  }

  exitIfPathFound(targetPath);

  await execBash(`
    git clone https://github.com/junegunn/fzf.git ${targetPath} &>/dev/null;
    `);

  await execBash(`
    ${targetPath}/install --no-key-bindings --no-completion --no-update-rc &>/dev/null;
  `);

  console.log("    >> Register binary with bashrc", BASH_SYLE_PATH);
  registerWithBashSyleProfile("fzf - Fuzzy Find", `[ -f ~/.fzf.bash ] && . ~/.fzf.bash`);

  registerWithBashSyleProfile(
    "fzf - Fuzzy Find Aliases",
    trimLeftSpaces(`
      BOOKMARK_PATH=~/.syle_bookmark

      add_bookmark(){
        local _temp_bookmark="/tmp/syle_bookmark"

        echo "$1" >> "$BOOKMARK_PATH"

        # Remove duplicates, sort, and update the bookmark file
        sort "$BOOKMARK_PATH" | uniq > "$_temp_bookmark" && mv "$_temp_bookmark" "$BOOKMARK_PATH"
      } >/dev/null 2>&1

      add_bookmark_dir(){
        dir="\${1:-\$(pwd)}"
        add_bookmark "cd $dir"
      }

      fuzzy_favorite_command(){
        local cmd
        cmd=$(cat "$BOOKMARK_PATH" 2>/dev/null | sort | uniq | fzf)

        if [ -n "$cmd" ]; then
          echo "### Command Selected from Bookmarks ###"
          echo "$cmd"
          eval "$cmd"
          history -s "$cmd"
        fi
      }
    `),
  );
}

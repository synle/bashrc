async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, '.fzf');

  console.log('  >> Download and installing fzf:', consoleLogColor4(targetPath));

  // clone it
  await execBashSilent(`
    rm -rf "${targetPath}";
    git clone https://github.com/junegunn/fzf.git ${targetPath} &>/dev/null;
    `);

  await execBashSilent(`
    ${targetPath}/install --no-key-bindings --no-completion --no-update-rc &>/dev/null;
  `);

  console.log('    >> Register binary with bashrc', BASE_BASH_SYLE);
  registerWithBashSyle('fzf - Fuzzy Find', `[ -f ~/.fzf.bash ] && . ~/.fzf.bash`);

  registerWithBashSyle(
    'fzf - Fuzzy Find Aliases',
    trimLeftSpaces(`
      BOOKMARK_PATH=~/.syle_bookmark

      getCommandFromBookmark(){
        touch $BOOKMARK_PATH
        cat $BOOKMARK_PATH
      }

      addCommandToBookmarks(){
        local _temp_bookmark="/tmp/syle_bookmark"

        echo "$1" >> "$BOOKMARK_PATH"

        # Remove duplicates, sort, and update the bookmark file
        sort "$BOOKMARK_PATH" | uniq > "$_temp_bookmark" && mv "$_temp_bookmark" "$BOOKMARK_PATH"
      } >/dev/null 2>&1
      alias bookmarkCommand=addCommandToBookmarks

      addDirToBookmarks(){
        dir="\${1:-\$(pwd)}"
        addCommandToBookmarks "cd $dir"
      }
      alias bookmarkDir=addDirToBookmarks

      fuzzyFavoriteCommand(){
        bookmarkedCommands=$((getCommandFromBookmark) | sort | uniq | fzf)

        echo '### Command Selected from Bookmarks ###'
        echo "$bookmarkedCommands"

        # run the command
        eval "$bookmarkedCommands"

        # put the command into history
        history -s "$bookmarkedCommands"
      }
    `),
  );
}

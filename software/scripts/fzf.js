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
  let textContent = readText(BASE_BASH_SYLE);
  textContent = prependTextBlock(
    textContent,
    'fzf - Fuzzy Find', // key
    `[ -f ~/.fzf.bash ] && . ~/.fzf.bash`,
  );

  textContent = prependTextBlock(
    textContent,
    'fzf - Fuzzy Find Aliases', // key
    trimLeftSpaces(`
      # create the syle bookmark file
      touch ~/.syle_bookmark

      getCommandFromBookmark(){
        cat ~/.syle_bookmark
      }

      addCommandToBookmarks(){
        echo $@ >> ~/.syle_bookmark
        echo "Bookmarking '"$@"'"
        sort  ~/.syle_bookmark | uniq > /tmp/syle_bookmark
        cp /tmp/syle_bookmark ~/.syle_bookmark
      }

      fuzzyFavoriteCommand(){
        bookmarkedCommands=$((getCommandFromBookmark) | sed '/^\s*$/d' | uniq | fzf)

        echo "$bookmarkedCommands"

        # run the command
        eval "$bookmarkedCommands"

        # put the command into history
        history -s "$bookmarkedCommands"
      }
    `),
  );

  writeText(BASE_BASH_SYLE, textContent);
}

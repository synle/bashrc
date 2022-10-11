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
      touch $HOME/.syle_bookmark

      getCommandFromBookmark(){
        cat $HOME/.syle_bookmark
      }

      addCommandToBookmarks(){
        echo $@ >> $HOME/.syle_bookmark
        echo "Bookmarking '"$@"'"
        removeDuplicateLines ~/.syle_bookmark > /tmp/syle-bookmark-temp
        cat /tmp/syle-bookmark-temp > ~/.syle_bookmark

        # remove the temp file
        rm /tmp/syle-bookmark-temp
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

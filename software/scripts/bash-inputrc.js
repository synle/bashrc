async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, '.inputrc');

  console.log('  >> Updating .inputrc', consoleLogColor4(targetPath));

  const content = `
# To install manually:
# curl -o ~/.inputrc https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/inputrc

## case insenstive autocomplete - ignore case for autocomplete
set completion-ignore-case on

## https://gist.github.com/gregorynicholas/1812027
set expand-tilde on
set show-all-if-ambiguous on
set visible-stats on

## set match-hidden-files off

## http://hiltmon.com/blog/2013/03/12/better-bash-shell-expansion/

## shift tab to reverse auto complete.
"\\e[Z": "\\e-1\\C-i"

## ctrl + key bindings for cursor movements for WSL or Linux
"\\e[1;5A": beginning-of-line  # ctrl + up
"\\e[1;5B": end-of-line  # ctrl + down
"\\e[1;5D": backward-word  # ctrl + left
"\\e[1;5C": forward-word   # ctrl + right
#"\\C-H": shell-backward-kill-word # ctrl + backspace to delete

## option + key for cursor movements for Mac OSX
"\\e\\e[C": forward-word # right
"\\e\\e[D": backward-word # left
"\\e\\e[A": beginning-of-line  # up
"\\e\\e[B": end-of-line  # down

## this command uses TAB to autocomplete forward paths
"\\t":menu-complete

## ctrl + key bindings for utils
#"\\C-o": "fcd\\r"
#"\\C-p": "fviewfile\\r"
"\\C-b": "fuzzyFavoriteCommand\\r"
"\\C-n": "fuzzyMakeComponent\\r"

## alt + key bindings for utils
#"\\er": "clear\\n" # alt r to clear (for WSL and linux)
#"\\eo": "fcd\\r" # alt o
#"\\ep": "fviewfile\\r" # alt o
#"\\eb": "fuzzyFavoriteCommand\\r" # alt b
#"\\en": "fuzzyMakeComponent\\r"
    `.trim();

  // write to build file
  writeToBuildFile([['inputrc', content, false]]);

  // write if there are change
  writeText(targetPath, content);
}

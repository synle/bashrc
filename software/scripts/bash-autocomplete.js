async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".bash_syle_autocomplete");
  console.log("  >> Installing Bash Autocomplete", targetPath);

  let res = "";

  res += `
##########################################################
# Bash Tab Autocomplete
##########################################################
  `;

  // getting upstream
  console.log("    >> Git Bash Autocomplete");
  const gitAutocompleteScript = await fetchUrlAsString(
    "https://raw.githubusercontent.com/git/git/master/contrib/completion/git-completion.bash"
  );
  res += `
${gitAutocompleteScript}
  `;

  // our base
  console.log("    >> Other Bash Autocomplete");
  res += `
##########################################################
# begin sy custom autocomplete
##########################################################

# git auto complete...
# auto complete for git with this short hand 'g' and 'git'
__git_complete g __git_main
__git_complete git __git_main


# ssh server autocomplete
__ssh_complete(){
  cur="\${COMP_WORDS[COMP_CWORD]}"
  opts=$(grep "^Host" ~/.ssh/config ~/.ssh/config.d/* 2>/dev/null | grep -v "[?*]" | cut -d " " -f 2-)
  COMPREPLY=( $(compgen -W "$opts" -- \${cur}) )
  return 0
}
complete -F __ssh_complete ssh
complete -F __ssh_complete s

# make autocomplete
__make_complete ()
{
    local cur prev opts;
    COMPREPLY=();
    cur="${COMP_WORDS[COMP_CWORD]}";
    opts=$(cat Makefile | grep -v " " | uniq | cut -d ":" -f 1);
    COMPREPLY=($(compgen -W "$opts" -- ${cur}));
    return 0
}
complete -F __make_complete make
  `;

  writeText(targetPath, res);

  // bootstrap nvm with bash_syle
  console.log("    >> Register binary with bashrc", BASE_BASH_SYLE);
  let bashrcTextContent = readText(BASE_BASH_SYLE);
  bashrcTextContent = prependTextBlock(
    bashrcTextContent,
    "Sy bash autocomplete", // key
    `[ -s ${targetPath} ] && . ${targetPath}`.trim()
  );
  writeText(BASE_BASH_SYLE, bashrcTextContent);
}

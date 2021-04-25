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
  opts=$([ -f ~/.ssh/config ] && grep "^Host" ~/.ssh/config ~/.ssh/config.d/* 2>/dev/null | grep -v "[?*]" | cut -d " " -f 2-)
  cur="\${COMP_WORDS[COMP_CWORD]}"
  COMPREPLY=( $(compgen -W "$opts" -- \${cur}) )
}
complete -F __ssh_complete ssh
complete -F __ssh_complete s

# make autocomplete
__make_complete ()
{
    opts=$([ -f Makefile ] && cat Makefile | grep -v ' ' | cut -d ':' -f 1 | uniq);
    cur="\${COMP_WORDS[COMP_CWORD]}";
    COMPREPLY=($(compgen -W "$opts" -- \${cur}));
}
complete -F __make_complete make


# npm autocomplete
__npm_complete ()
{
    cur="\${COMP_WORDS[COMP_CWORD]}";
    prev="\${COMP_WORDS[COMP_CWORD-1]}";

    if [[ $prev == "run" ]]
    then
      # npm run => then shows all package.json script
      opts=$([ -f package.json ] && cat package.json | jq .scripts | grep '"' | cut -d '"' -f 2 | uniq);
    else
      # npm => then shows run start test
      opts=$(
        echo '''
          run
          test
          start
        ''' | tr -d " \t"
      )
    fi

    COMPREPLY=($(compgen -W "$opts" -- \${cur}));
}
complete -F __npm_complete npm
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

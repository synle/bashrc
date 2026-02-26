/// <reference path="../index.js" />

/**
Different options and code styles

// option 1 with static options
opts=$(
  echo '''
    run
    test
    start
  ''' | tr -d " \t"
)

// option 2 with no dependencies
opts=$([ -f package.json ] && cat package.json | jq .scripts | grep '"' | cut -d '"' -f 2 | uniq);


// option 3 with node
opts=$(node -e """
  try{
   console.log(Object.keys(JSON.parse(fs.readFileSync('package.json')).scripts).join(' '));
  } catch(err){}
""");


// option 4 with python but more common than node
opts=$(
        python -c """
import json
try:
  with open('package.json') as f:
    data = json.load(f)
  print(' '.join(data['scripts'].keys()))
except:
  print('')
        """
  )
 */

/**
 * Generates a bash autocomplete function for a command using a spec file that maps subcommands to their options.
 * @param {string} command - The command name to create autocomplete for.
 * @param {string} completeSpecURL - URL or path to the autocomplete spec file.
 * @returns {Promise<string>} The generated bash autocomplete script block.
 */
async function _getAutoCompleteWithSpec(command, completeSpecURL) {
  const completeSpecContent = await fetchUrlAsString(completeSpecURL);

  return trimLeftSpaces(`
    ####################################
    # ${command} Spec Tab Autocomplete
    ####################################
    ${command}_complete()
    {
      opts=\$(
      echo "\${COMP_WORDS[*]}" | node -e """
        let data = '';

        process.openStdin().addListener('data', (d) => data += d.toString());

        process.openStdin().addListener('end', (d) => {
          doWork(data.trim());
          process.exit();
        });

        async function doWork(input){
          const commands = \\\`${completeSpecContent}\\\`
            .split('\\n')
            .map( s => s.trim())
            .filter(s => s)
            .map(s => s.split(/[|,]/g));


          let matchingOptions = [];
          let commandFound = false;
          commands.forEach(([command, ...options])=> {
            if(commandFound === false){
              if(input.indexOf(command) === 0){
                commandFound = true;
                matchingOptions = options;
              }
            }
          })

          console.log(matchingOptions.join('\\n'))
        }
      """
      )
      cur="\${COMP_WORDS[COMP_CWORD]}";
      prev="\${COMP_WORDS[COMP_CWORD-1]}";
      COMPREPLY=(\$(compgen -W "\$opts" -- \${cur}));
    }
    complete -F ${command}_complete docker
  `);
}

/**
 * Installs bash autocomplete scripts for git, ssh, make, npm, npx, yarn, and docker.
 */
async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".bash_syle_autocomplete");
  console.log("  >> Installing Bash Autocomplete", consoleLogColor4(targetPath));

  let res = "";

  res += `
##########################################################
# Bash Tab Autocomplete
##########################################################
  `;

  // ========================================================
  // Git — upstream completion script + alias support
  // ========================================================
  console.log("    >> Git Bash Autocomplete");
  const gitAutocompleteScript = await fetchUrlAsString(
    "https://raw.githubusercontent.com/git/git/master/contrib/completion/git-completion.bash",
  );
  res += `
##########################################################
# Git Autocomplete (upstream)
# Provides full tab completion for all git commands,
# branches, remotes, tags, and options.
##########################################################
${gitAutocompleteScript}
`;

  console.log("    >> Other Bash Autocomplete");
  res += `
##########################################################
# Custom Autocomplete Functions
##########################################################

# ---------------------------------------------------------
# Git Aliases
# Enable git tab completion for the 'g' shorthand alias
# so 'g che<TAB>' expands just like 'git che<TAB>'
# ---------------------------------------------------------
__git_complete g __git_main
__git_complete git __git_main


# ---------------------------------------------------------
# SSH
# Autocomplete hostnames from ~/.ssh/config and
# ~/.ssh/config.d/* — filters out wildcard entries
# ---------------------------------------------------------
__ssh_complete(){
  opts=\$([ -f ~/.ssh/config ] && grep "^Host" ~/.ssh/config ~/.ssh/config.d/* 2>/dev/null | grep -v "[?*]" | cut -d " " -f 2-)
  cur="\${COMP_WORDS[COMP_CWORD]}"
  COMPREPLY=( \$(compgen -W "\$opts" -- \${cur}) )
}
complete -F __ssh_complete ssh
complete -F __ssh_complete s


# ---------------------------------------------------------
# Make
# Autocomplete Makefile target names by parsing the
# Makefile in the current directory
# ---------------------------------------------------------
__make_complete ()
{
  opts=\$([ -f Makefile ] && cat Makefile | grep -v ' ' | cut -d ':' -f 1 | uniq);
  cur="\${COMP_WORDS[COMP_CWORD]}";
  COMPREPLY=(\$(compgen -W "\$opts" -- \${cur}));
}
complete -F __make_complete make


# ---------------------------------------------------------
# npm
# - 'npm <TAB>' suggests: run, test, start, install, ci
# - 'npm run <TAB>' reads script names from package.json
# ---------------------------------------------------------
__npm_run_complete_options()
{
node -e """
   try{
     console.log(Object.keys(JSON.parse(fs.readFileSync('package.json')).scripts).join(' '));
   } catch(err){}
"""
}

__npm_complete ()
{
  cur="\${COMP_WORDS[COMP_CWORD]}";
  prev="\${COMP_WORDS[COMP_CWORD-1]}";

  if [[ $prev == "run" ]]
  then
    opts=$(__npm_run_complete_options)
  else
    # Top-level npm subcommands
    opts=$(
      echo '''
        run
        test
        start
        install
        ci
      ''' | tr -d " \t"
    )
  fi

  COMPREPLY=(\$(compgen -W "\$opts" -- \${cur}));
}
complete -F __npm_complete npm


# ---------------------------------------------------------
# npm-run (direct alias)
# 'npm-run <TAB>' suggests script names from package.json
# Only completes the first argument (the script name)
# ---------------------------------------------------------
__npm_run_complete ()
{
  cur="\${COMP_WORDS[COMP_CWORD]}";

  case \$COMP_CWORD in
    1)
      opts=$(__npm_run_complete_options)
      COMPREPLY=(\$(compgen -W "\$opts" -- \${cur}));
      ;;
    2)
      return 0
      ;;
  esac
}
complete -F __npm_run_complete npm-run


# ---------------------------------------------------------
# npx
# Autocomplete common npx commands: prettier, ts-node,
# tsx, tsc, eslint. Only completes the first argument.
# ---------------------------------------------------------
__npx_complete ()
{
  cur="\${COMP_WORDS[COMP_CWORD]}";

  case \$COMP_CWORD in
    1)
      opts=\$(
        echo '''
          prettier
          ts-node
          tsx
          tsc
          eslint
        ''' | tr -d " \t"
      )

      COMPREPLY=(\$(compgen -W "\$opts" -- \${cur}));
      ;;
    2)
      return 0
      ;;
  esac
}
complete -F __npx_complete npx


# ---------------------------------------------------------
# Yarn
# Autocomplete yarn commands with script names from
# package.json — same source as npm run
# ---------------------------------------------------------
__yarn_complete ()
{
  opts=\$(__npm_run_complete_options)
  cur="\${COMP_WORDS[COMP_CWORD]}";
  prev="\${COMP_WORDS[COMP_CWORD-1]}";
  COMPREPLY=(\$(compgen -W "\$opts" -- \${cur}));
}
complete -F __yarn_complete yarn


# ---------------------------------------------------------
# Docker (spec-based)
# Uses a spec file to map docker subcommands to their
# available options for context-aware completion
# ---------------------------------------------------------
${await _getAutoCompleteWithSpec("docker", "software/metadata/bash-autocomplete.docker.config")}
`;

  writeText(targetPath, res);

  // bootstrap mise with bash_syle
  console.log("    >> Register binary with bashrc", BASE_BASH_SYLE);
  registerWithBashSyle("Sy bash autocomplete", `[ -s ${targetPath} ] && . ${targetPath}`);
}

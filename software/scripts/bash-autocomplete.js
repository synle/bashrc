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

async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, '.bash_syle_autocomplete');
  console.log('  >> Installing Bash Autocomplete', consoleLogColor4(targetPath));

  let res = '';

  res += `
##########################################################
# Bash Tab Autocomplete
##########################################################
  `;

  // getting upstream
  console.log('    >> Git Bash Autocomplete');
  const gitAutocompleteScript = await fetchUrlAsString(
    'https://raw.githubusercontent.com/git/git/master/contrib/completion/git-completion.bash',
  );
  res += `
${gitAutocompleteScript}
  `;

  // our base
  console.log('    >> Other Bash Autocomplete');
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
  opts=\$([ -f ~/.ssh/config ] && grep "^Host" ~/.ssh/config ~/.ssh/config.d/* 2>/dev/null | grep -v "[?*]" | cut -d " " -f 2-)
  cur="\${COMP_WORDS[COMP_CWORD]}"
  COMPREPLY=( \$(compgen -W "\$opts" -- \${cur}) )
}
complete -F __ssh_complete ssh
complete -F __ssh_complete s

# make autocomplete
__make_complete ()
{
  opts=\$([ -f Makefile ] && cat Makefile | grep -v ' ' | cut -d ':' -f 1 | uniq);
  cur="\${COMP_WORDS[COMP_CWORD]}";
  COMPREPLY=(\$(compgen -W "\$opts" -- \${cur}));
}
complete -F __make_complete make


# npm autocomplete
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
    # npm => then shows run start test
    opts=$(
      echo '''
        run
        test
        start
      ''' | tr -d " \t"
    )
  fi

  COMPREPLY=(\$(compgen -W "\$opts" -- \${cur}));
}
complete -F __npm_complete npm

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

# npx
__npx_complete ()
{
  cur="\${COMP_WORDS[COMP_CWORD]}";

  case \$COMP_CWORD in
    1)
      opts=\$(
        echo '''
          prettier
          ts-node
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

# yarn
__yarn_complete ()
{
  opts=\$(__npm_run_complete_options)
  cur="\${COMP_WORDS[COMP_CWORD]}";
  prev="\${COMP_WORDS[COMP_CWORD-1]}";
  COMPREPLY=(\$(compgen -W "\$opts" -- \${cur}));
}
complete -F __yarn_complete yarn

${await _getAutoCompleteWithSpec('docker', 'software/metadata/bash-autocomplete.docker.config')}
`;

  writeText(targetPath, res);

  // bootstrap nvm with bash_syle
  console.log('    >> Register binary with bashrc', BASE_BASH_SYLE);
  let bashrcTextContent = readText(BASE_BASH_SYLE);
  bashrcTextContent = prependTextBlock(
    bashrcTextContent,
    'Sy bash autocomplete', // key
    `[ -s ${targetPath} ] && . ${targetPath}`.trim(),
  );
  writeText(BASE_BASH_SYLE, bashrcTextContent);
}

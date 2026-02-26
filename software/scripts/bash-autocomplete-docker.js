/// <reference path="../index.js" />

/**
 * Installs bash autocomplete for docker using a spec-based approach.
 */
async function doWork() {
  console.log("    >> Docker Bash Autocomplete");

  const completeSpecContent = await fetchUrlAsString("software/scripts/bash-autocomplete-docker.complete-spec");

  registerWithBashSyleAutocomplete(
    "Docker Autocomplete",
    trimLeftSpaces(`
      # ---------------------------------------------------------
      # Docker (spec-based)
      # Uses a spec file to map docker subcommands to their
      # available options for context-aware completion
      # ---------------------------------------------------------
      docker_complete()
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
      complete -F docker_complete docker
    `),
  );
}

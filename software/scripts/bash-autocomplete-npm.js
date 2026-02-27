/**
 * Installs bash autocomplete for npm, npm-run, and npx commands.
 */
async function doWork() {
  exitIfUnsupportedOs("is_os_android_termux", "is_os_arch_linux", "is_os_chromeos");
  console.log("    >> npm/npx Bash Autocomplete");

  registerWithBashSyleAutocompleteWithRawContent(
    "npm npx Autocomplete",
    trimLeftSpaces(`
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
    `),
  );
}

/** Deploys starship.toml config and registers starship init with bash profile. */
async function doWork() {
  const targetDir = path.join(BASE_HOMEDIR_LINUX, ".config");
  const targetPath = path.join(targetDir, "starship.toml");

  log(">> Configuring starship prompt:", targetPath);

  // fetch the toml config from the repo source file
  const starshipConfig = await readText`software/scripts/advanced/starship-config.toml`;
  await backupConfigFile(targetPath);
  await writeText(targetPath, starshipConfig);

  // register starship init with bash profile, including the env var updates
  // that feed get_time, ifconfig2, and shorter_pwd_path into starship env vars
  log(">>> Registering starship with bash profile");
  const starshipProfile = code`
    if type -P starship &> /dev/null; then
      # init starship first so it sets up its own PROMPT_COMMAND
      eval "$(starship init bash --print-full-init)"

      # plain time helper for starship env vars (no PS1 ANSI wrappers)
      # get_time() uses \001/\002 escapes that only work inside PS1
      function _starship_time() {
        local tz="$1"
        local time_str ampm
        if [ "$tz" = "UTC" ]; then
          time_str=$(command date -u +'%I:%M:%S')
          ampm=$(command date -u +'%p')
        elif [ -n "$tz" ]; then
          time_str=$(TZ="$tz" command date +'%I:%M:%S')
          ampm=$(TZ="$tz" command date +'%p')
        else
          time_str=$(command date +'%I:%M:%S')
          ampm=$(command date +'%p')
        fi
        printf '%s%s' "$time_str" "$ampm"
      }

      # update starship env vars before each prompt render
      # must be defined after starship init so it doesn't get overwritten
      function _starship_preexec() {
        export STARSHIP_LOCAL_TIME="$(_starship_time)"
        export STARSHIP_UTC_TIME="$(_starship_time 'UTC')"
        export STARSHIP_IP_ADDR="$(ifconfig2)"
        export STARSHIP_SHORT_PWD="$(shorter_pwd_path)"
      }
      starship_precmd_user_func="_starship_preexec"

      # bash version is static, set once
      export STARSHIP_BASH_VER="$BASH_VERSINFO.$(echo "$BASH_VERSION" | cut -d. -f2)"

      # run once immediately so the first prompt has values
      _starship_preexec
    fi
  `;
  registerWithBashSyleProfile("starship prompt", starshipProfile);
}

/** Deploys shared Starship settings to the host and Windows homes and registers bash initialization. */
/**
 * Configure Starship for bash and, on WSL/Windows, for the Windows PowerShell prompt.
 * @returns {Promise<void>} Resolves after configuration and profile registration.
 * @throws {Error} If Windows home cannot be resolved or a configuration write fails.
 * @sideEffects Backs up and writes prompt configs and queues bash profile initialization.
 */
async function doWork() {
  const targetDir = path.join(BASE_HOMEDIR_LINUX, ".config");
  const targetPath = path.join(targetDir, "starship.toml");

  log(">> Configuring starship prompt:", targetPath);

  // fetch the toml config from the repo source file
  const starshipConfig = await readText`software/scripts/advanced/starship-config.toml`;
  await mkdir(targetDir);
  await backupConfigFile(targetPath);
  await writeText(targetPath, starshipConfig);

  // Windows Starship reads the Windows home, not the WSL user's .config folder.
  if (is_os_windows) {
    const windowsHome = getWindowUserBaseDir();
    if (!windowsHome) throw new Error("Windows user home could not be resolved for Starship configuration");
    const windowsConfigFolder = path.join(windowsHome, ".config");
    const windowsConfigPath = path.join(windowsConfigFolder, "starship.toml");
    await mkdir(windowsConfigFolder);
    await backupConfigFile(windowsConfigPath);
    await writeText(windowsConfigPath, starshipConfig);
  }

  // register starship init with bash profile, including the env var updates
  // that feed get_time, ifconfig2, and shorter_pwd_path into starship env vars
  log(">>> Registering starship with bash profile");
  const starshipProfile = code`
    if type -P starship &> /dev/null; then
      # a slow repo makes starship kill its git call and print
      # "Executing command ... timed out" to stderr on every single prompt render.
      # The timeout is already handled (see command_timeout in starship.toml); the
      # warning just spams the terminal, so keep only real errors.
      export STARSHIP_LOG=error

      # init starship first so it sets up its own PROMPT_COMMAND
      eval "$(starship init bash --print-full-init)"

      # plain time helper for starship env vars (no PS1 ANSI wrappers)
      # get_time() uses \001/\002 escapes that only work inside PS1
      function _starship_time() {
        local tz="$1"
        local datetime
        if [ "$tz" = "UTC" ]; then
          datetime=$(command date -u +'%I:%M:%S %p')
        elif [ -n "$tz" ]; then
          datetime=$(TZ="$tz" command date +'%I:%M:%S %p')
        else
          datetime=$(command date +'%I:%M:%S %p')
        fi
        printf '%s%s' "\${datetime% *}" "\${datetime##* }"
      }

      # Update prompt fields after Starship initialization; retain IP cache updates in this shell.
      # Takes no arguments, exports display fields, and returns the final export status.
      function _starship_preexec() {
        export STARSHIP_LOCAL_TIME="$(_starship_time)"
        export STARSHIP_UTC_TIME="$(_starship_time 'UTC')"
        if ((is_work_profile)); then
          export STARSHIP_PROFILE_MARKER='💼'
        else
          export STARSHIP_PROFILE_MARKER='🏠'
        fi
        ifconfig2 > /dev/null
        # Keep machine-facing ifconfig2 output unchanged; space only the prompt list.
        export STARSHIP_IP_ADDR="\${_ifconfig2_cache//,/, }"
        export STARSHIP_SHORT_PWD="$(shorter_pwd_path)"
      }
      starship_precmd_user_func="_starship_preexec"

      # bash version is static, set once
      export STARSHIP_BASH_VER="$BASH_VERSINFO.$(echo "$BASH_VERSION" | cut -d. -f2)"
      if [ "$(id -u)" = "0" ]; then
        export STARSHIP_PROMPT_SYMBOL="#"
      else
        export STARSHIP_PROMPT_SYMBOL="$"
      fi

      # run once immediately so the first prompt has values
      _starship_preexec
    fi
  `;
  registerWithBashSyleProfile("starship prompt", starshipProfile);
}

/** Deploys starship.toml config and registers starship init with bash profile. */
async function doWork() {
  const targetDir = path.join(BASE_HOMEDIR_LINUX, ".config");
  const targetPath = path.join(targetDir, "starship.toml");

  log(">> Configuring starship prompt:", targetPath);

  // fetch the toml config from the repo source file
  const starshipConfig = await readText`software/scripts/advanced/starship-config.toml`;
  await mkdir(targetDir);
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

      # get active python path shortened and version for prompt display
      # includes venv name prefix when a virtual environment is active
      function _starship_python_info() {
        local py_bin
        py_bin="$(type -P python3 2>/dev/null || type -P python 2>/dev/null)" || return
        [ -z "\$py_bin" ] && return
        local py_ver
        py_ver="$("\$py_bin" --version 2>&1)" || return
        py_ver="\${py_ver##* }"
        local py_path
        py_path="$(readlink -f "\$py_bin" 2>/dev/null || echo "\$py_bin")"
        IFS='/' read -r -a parts <<< "\$py_path"
        local total=\${#parts[@]}
        local result=""
        local i
        for ((i=0; i<total; i++)); do
          [ -z "\${parts[i]}" ] && continue
          if ((i < total - 3)); then
            result+="/\${parts[i]:0:1}"
          else
            result+="/\${parts[i]}"
          fi
        done
        local venv_prefix=""
        if [ -n "\$VIRTUAL_ENV" ]; then
          venv_prefix="(\${VIRTUAL_ENV##*/}) "
        fi
        printf '%s[%s:%s]' "\$venv_prefix" "\$result" "\$py_ver"
      }

      # get active node path shortened and version for prompt display
      function _starship_node_info() {
        local node_bin
        node_bin="$(type -P node 2>/dev/null)" || return
        [ -z "\$node_bin" ] && return
        local node_ver
        node_ver="$("\$node_bin" --version 2>&1)" || return
        node_ver="\${node_ver#v}"
        local node_path
        node_path="$(readlink -f "\$node_bin" 2>/dev/null || echo "\$node_bin")"
        IFS='/' read -r -a parts <<< "\$node_path"
        local total=\${#parts[@]}
        local result=""
        local i
        for ((i=0; i<total; i++)); do
          [ -z "\${parts[i]}" ] && continue
          if ((i < total - 3)); then
            result+="/\${parts[i]:0:1}"
          else
            result+="/\${parts[i]}"
          fi
        done
        printf '[%s:%s]' "\$result" "\$node_ver"
      }

      # update starship env vars before each prompt render
      # must be defined after starship init so it doesn't get overwritten
      function _starship_preexec() {
        export STARSHIP_LOCAL_TIME="$(_starship_time)"
        export STARSHIP_UTC_TIME="$(_starship_time 'UTC')"
        export STARSHIP_IP_ADDR="$(ifconfig2)"
        export STARSHIP_SHORT_PWD="$(shorter_pwd_path)"
        # disabled: python/node path:version info (uncomment to re-enable)
        # local _py_info
        # _py_info="$(_starship_python_info)"
        # if [ -n "$_py_info" ]; then
        #   export STARSHIP_PYTHON_INFO="$_py_info"
        # else
        #   unset STARSHIP_PYTHON_INFO
        # fi
        # local _node_info
        # _node_info="$(_starship_node_info)"
        # if [ -n "$_node_info" ]; then
        #   export STARSHIP_NODE_INFO="$_node_info"
        # else
        #   unset STARSHIP_NODE_INFO
        # fi
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

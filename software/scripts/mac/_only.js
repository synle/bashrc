/** Platform tweaks for macOS - registers Mac profile, Homebrew paths, and shell config. */
async function doWork() {
  const onlyMacProfile = code`
    # Suppress bash legacy warning in Catalina+
    export BASH_SILENCE_DEPRECATION_WARNING=1

    ##########################################################
    # Mac-Only Aliases
    ##########################################################

    alias find2='fd'
    alias brave='open "/Applications/Brave\\ Browser.app" --args --disable-smooth-scrolling'
    alias chrome='open "/Applications/Google\\ Chrome.app" --args --disable-smooth-scrolling'
    alias sqluinative='open "/Applications/sqlui-native.app" --args --disable-smooth-scrolling'
    alias sql="sqluinative"
    alias displaydj='open "/Applications/Display DJ.app"'
    alias skiff='open "/Applications/Skiff Files.app"'
    alias proxie='open "/Applications/Proxie.app"'

    # accessibility: jump straight to System Settings > Privacy & Security > Accessibility
    # (where you grant input-event permission to apps like Display DJ, Ghostty, etc.)
    alias accessibility='open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"'

    # make: use GNU Make (gmake) for .ONESHELL support (macOS ships Make 3.81)
    if type -P gmake &> /dev/null; then alias make='gmake'; fi

    # update: OS package manager update/upgrade only
    alias update='brew update && brew upgrade && brew cleanup'

    # clear macOS Gatekeeper quarantine on sideloaded apps, at most once per 3 hours
    #
    # The guard is the *filename*, not the file contents: it encodes the current
    # 3-hour window, so a single [ -f ] answers "has this window already run?"
    # with zero subprocesses. Comparing an mtime instead would cost a stat plus
    # a date fork on every shell start. Measured on an M-series Mac: the
    # unguarded block cost ~22ms of every interactive shell, the guarded warm
    # path costs ~1ms.
    if type -P xattr &> /dev/null; then
      _xattr_day=""
      _xattr_hour=""
      if [ "\${BASH_VERSINFO[0]:-0}" -ge 5 ]; then
        # bash 4.2+ formats time internally, no subprocess
        printf -v _xattr_day '%(%Y%m%d)T' -1
        printf -v _xattr_hour '%(%H)T' -1
      else
        # macOS /bin/bash is 3.2 and has neither printf %()T nor EPOCHSECONDS
        _xattr_day=$(date +%Y%m%d)
        _xattr_hour=$(date +%H)
      fi
      # 10# is mandatory: "08" and "09" are invalid octal and abort the shell
      _xattr_temp_folder="\${BASHRC_TEMP_ROOT_DIR:-/tmp/synle/bashrc}"
      _xattr_guard="\${_xattr_temp_folder}/synle_bashrc_macosx_xattr_last_\${_xattr_day}_$((10#\$_xattr_hour / 3))"

      if [ ! -f "\${_xattr_guard}" ]; then
        _xattr_app_list=(
          "/Applications/sqlui-native.app"
          "/Applications/Display DJ.app"
          "/Applications/Skiff Files.app"
          "/Applications/Proxie.app"
        )
        _xattr_app=""
        for _xattr_app in "\${_xattr_app_list[@]}"; do
          [ -d "\${_xattr_app}" ] && xattr -cr "\${_xattr_app}"
        done
        mkdir -p "\${_xattr_temp_folder}"
        # sweep prior windows so the guard folder holds exactly one stamp
        rm -f "\${_xattr_temp_folder}"/synle_bashrc_macosx_xattr_last_*
        : > "\${_xattr_guard}"
        unset _xattr_app_list _xattr_app
      fi
      unset _xattr_day _xattr_hour _xattr_temp_folder _xattr_guard
    fi
  `;
  log(">>> Only Mac profile loaded:", onlyMacProfile.split("\n").length, "lines");

  // register platform tweaks for mac
  await registerPlatformTweaks("Mac", onlyMacProfile);

  // mac system setup (homebrew paths)
  log(">>> Register mac system setup with bashrc", BASH_SYLE_PATH);
  await registerWithBashSyleProfile(
    "mac-system-setup",
    code`
    # homebrew paths
    for brew_prefix in /opt/homebrew /usr/local; do
      if [ -d "$brew_prefix" ] && [ -x "$brew_prefix/bin/brew" ]; then
        export HOMEBREW_PREFIX="$brew_prefix"
        export HOMEBREW_CELLAR="$brew_prefix/Cellar"
        export HOMEBREW_REPOSITORY="$brew_prefix"
        export PATH="$brew_prefix/bin:$brew_prefix/sbin:$PATH"
        export MANPATH="$brew_prefix/share/man:$MANPATH"
        export INFOPATH="$brew_prefix/share/info:$INFOPATH"
        break
      fi
    done
  `,
  );
}

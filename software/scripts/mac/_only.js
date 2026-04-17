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

    # make: use GNU Make (gmake) for .ONESHELL support (macOS ships Make 3.81)
    if type -P gmake &> /dev/null; then alias make='gmake'; fi

    # update: OS package manager update/upgrade only
    alias update='brew update && brew upgrade && brew cleanup'

  `;
  log(">>> Only Mac profile loaded:", onlyMacProfile.split("\n").length, "lines");

  // register platform tweaks for mac
  await registerPlatformTweaks("Mac", onlyMacProfile);

  // homebrew and mac system setup
  log(">>> Register Homebrew and mac system setup with bashrc", BASH_SYLE_PATH);
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

    # clear macOS Gatekeeper quarantine on sideloaded apps
    if type -P xattr &> /dev/null; then
      local _xattr_app_list=(
        "/Applications/sqlui-native.app"
        "/Applications/Display DJ.app"
      )
      local _xattr_app
      for _xattr_app in "\${_xattr_app_list[@]}"; do
        [ -d "\${_xattr_app}" ] && xattr -cr "\${_xattr_app}"
      done
      unset _xattr_app_list _xattr_app
    fi
  `,
  );
}

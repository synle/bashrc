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

    # unquarantine: clear the macOS Gatekeeper quarantine attribute on demand
    #
    # Apps installed by this repo are already cleared at install time by
    # installMacDmg -> clearMacQuarantine in software/index.js, and macOS only
    # stamps com.apple.quarantine when a file is downloaded. Re-clearing it on
    # every shell start was redundant work, so this covers the one case the
    # install path does not: an app you sideload by hand.
    alias unquarantine='xattr -cr'
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

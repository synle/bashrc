/** * Gate check that exits early if the current OS is not macOS. */
async function doWork() {
  const onlyMacProfile = (await fetchUrlAsString("software/scripts/mac/_only-profile.bash")).trim();
  log(">>> Only Mac profile loaded:", onlyMacProfile.split("\n").length, "lines");

  // register platform tweaks for mac
  registerPlatformTweaks("Mac", onlyMacProfile);

  // homebrew
  log(">>> Register Homebrew with bashrc", BASH_SYLE_PATH);
  registerWithBashSyleProfile(
    "homebrew",
    trimLeftSpaces(`
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
  `),
  );

  // write to build file
  const comments = "This is a bash only meant for mac";
  writeToBuildFile([{ file: "only-mac-profile", data: onlyMacProfile, comments, commentStyle: "bash" }]);
}

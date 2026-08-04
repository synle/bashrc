/** Registers zoxide init with bash profile, appended last to avoid PROMPT_COMMAND conflicts. */
async function doWork() {
  if (!(await isBinaryFound("zoxide"))) {
    log(">> Skipped zoxide: not installed");
    return;
  }

  // zoxide must be initialized at the very end of the shell config, after
  // starship, because both modify PROMPT_COMMAND and the last one wins.
  // "zoxide.js" sorts after "starship-config.js" ensuring correct order.
  // see: https://github.com/ajeetdsouza/zoxide/issues
  log(">> Registering zoxide with bash profile");
  registerWithBashSyleProfile(
    "zoxide init",
    code`
      type -P zoxide &>/dev/null && eval "\$(zoxide init bash --cmd cd)"
    `,
  );
}

/** * Clones, builds, and registers the synle-make-component tool with bashrc and fzf integration. */
async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".synle-make-component");

  log("  >> Download and installing synle-make-component:", colorDim(targetPath));

  if (IS_FORCE_REFRESH) {
    await deleteFolder(targetPath);
  }

  exitIfPathFound(targetPath);

  log("    >> Cloning and building", colorDim(targetPath));

  await gitClone("https://github.com/synle/make-component.git", targetPath);

  await execBash(`npm i && npm run build`, false, {
    cwd: targetPath,
  });

  log("    >> Register binary with bashrc", colorDim(BASH_SYLE_PATH));
  registerWithBashSyleProfile(
    "Sy Make Component",
    trimLeftSpaces(`
      [ -f ${targetPath}/setup.sh ] && . ${targetPath}/setup.sh

      ## fzf alias for synle-make-component
      get_make_component_options(){
        make-help
      }

      fuzzy_make_component(){
        makeComponentCommand=$(( \
        get_make_component_options \
        ) | sed '/^\s*$/d' | uniq | fzf)
        echo "$makeComponentCommand"
        $makeComponentCommand
      }
    `),
  );
}

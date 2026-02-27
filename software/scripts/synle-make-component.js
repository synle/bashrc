/** * Clones, builds, and registers the synle-make-component tool with bashrc and fzf integration. */
async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".synle-make-component");

  console.log("  >> Download and installing synle-make-component:", consoleLogColor4(targetPath));

  console.log("    >> Cloning and building", consoleLogColor4(targetPath));

  await deleteFolder(targetPath);

  await execBash(`
    git clone --depth 1 -b master https://github.com/synle/make-component.git "${targetPath}"
  `);

  await execBash(`npm i && npm run build`, false, {
    cwd: targetPath,
  });

  console.log("    >> Register binary with bashrc", BASH_SYLE_PATH);
  registerWithBashSyleProfile(
    "Sy Make Component",
    trimLeftSpaces(`
      [ -f ${targetPath}/setup.sh ] && . ${targetPath}/setup.sh

      ## fzf alias for synle-make-component
      getMakeComponentOptions(){
        make-help
      }

      fuzzyMakeComponent(){
        makeComponentCommand=$(( \
        getMakeComponentOptions \
        ) | sed '/^\s*$/d' | uniq | fzf)
        echo "$makeComponentCommand"
        $makeComponentCommand
      }
    `),
  );
}

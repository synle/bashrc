/** * Bootstraps .bash_profile and .bashrc with entry points for .bash_syle, the single source of all shell config. */
async function doWork() {
  // wipe out the old bash_syle first
  const coreBashProfileFiles = [BASH_SYLE_PATH, BASH_SYLE_AUTOCOMPLETE_PATH];
  for (const file of coreBashProfileFiles) {
    console.log("  >> Wiping out the old bash profile asset: ", file);
    writeText(file, ``);
  }

  const entryPointContent = trimSpacesOnBothEnd(`
    [ -f ${BASH_SYLE_COMMON} ] && . ${BASH_SYLE_COMMON} > /dev/null 2>&1
    ${coreBashProfileFiles.map((file) => "[ -f " + file + " ] && . " + file + " > /dev/null 2>&1").join("\n")}
  `);

  // bootstrap .bash_profile (login shells on all platforms)
  {
    const targetPath = path.join(BASE_HOMEDIR_LINUX, ".bash_profile");
    console.log("  >> Updating .bash_profile with bash_syle entry point", consoleLogColor4(targetPath));
    let textContent = readText(targetPath);
    textContent = appendTextBlock(textContent, "Sy bash_syle entry point", entryPointContent);
    writeText(targetPath, textContent);
  }

  // bootstrap .bashrc (interactive non-login shells)
  {
    const targetPath = path.join(BASE_HOMEDIR_LINUX, ".bashrc");
    console.log("  >> Updating .bashrc with bash_syle entry point", consoleLogColor4(targetPath));
    let textContent = readText(targetPath);
    textContent = appendTextBlock(textContent, "Sy bash_syle entry point", entryPointContent);
    writeText(targetPath, textContent);
  }
}

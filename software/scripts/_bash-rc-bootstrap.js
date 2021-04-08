async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, ".bashrc");
  let bashrcTextContent = readText(targetPath);

  console.log("  >> Updating .bashrc initial setup", targetPath);

  // add tweaks...
  bashrcTextContent = appendTextBlock(
    bashrcTextContent,
    "Sy bashrc entry point", // key
    `[ -s ~/.bash_syle ] && . ~/.bash_syle`
  );

  // write if there are change
  writeText(targetPath, bashrcTextContent);

  // wipe out the bash syle
  console.log("  >> Wiping out the old .bash_syle", BASE_BASH_SYLE);
  writeText(BASE_BASH_SYLE, "");
}

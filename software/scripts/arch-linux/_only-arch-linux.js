async function doWork() {
  const targetPath = path.join(BASE_HOMEDIR_LINUX, '.bash_syle_only_arch_linux');

  console.log('  >> Register Only Arch Linux profile', BASE_BASH_SYLE);
  let textContent = readText(BASE_BASH_SYLE);
  textContent = prependTextBlock(
    textContent,
    'Only Arch Linux - PLATFORM SPECIFIC TWEAKS', // key
    `. ${targetPath}`,
  );
  writeText(BASE_BASH_SYLE, textContent);

  console.log('  >> Installing Only Arch Linux tweaks: ', consoleLogColor4(targetPath));
  writeText(
    targetPath,
    trimLeftSpaces(`
      # Only Arch Linux alias
      function open(){
        pwd
        dolphin "$1" 1>&- 2>&-  &
      }

      # override steamdeck prompt and properly use PS1 prompt
      PROMPT_COMMAND=""
    `).trim(),
  );
}

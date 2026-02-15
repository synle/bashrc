async function doWork() {
  registerPlatformTweaks(
    'Only Arch Linux',
    '.bash_syle_only_arch_linux',
    trimLeftSpaces(`
      # Only Arch Linux alias
      function open(){
        pwd
        dolphin "$1" 1>&- 2>&-  &
      }

      # set brightness via ddc/ci (for external monitor)
      # more info here - https://moverest.xyz/blog/control-display-with-ddc-ci/
      alias set-brightness='sudo modprobe i2c-dev; sudo ddcutil setvcp 10'
      alias brightness='set-brightness'

      # override steamdeck prompt and properly use PS1 prompt
      PROMPT_COMMAND=""
    `).trim(),
  );
}

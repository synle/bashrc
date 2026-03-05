/** * Gate check that exits early if the current OS is not Arch Linux. */
async function doWork() {
  registerPlatformTweaks(
    "Arch Linux",
    trimLeftSpaces(`
      # Only Arch Linux alias

      # set brightness via ddc/ci (for external monitor)
      # more info here - https://moverest.xyz/blog/control-display-with-ddc-ci/
      alias set-brightness='sudo modprobe i2c-dev; sudo ddcutil setvcp 10'
      alias brightness='set-brightness'

      # override steamos prompt and properly use PS1 prompt
      PROMPT_COMMAND=""
    `).trim(),
  );
}

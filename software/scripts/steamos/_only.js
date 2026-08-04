/** Platform tweaks for SteamOS - registers shell config. */
async function doWork() {
  registerPlatformTweaks(
    "SteamOS",
    code`
      # update: OS package manager update/upgrade only
      # SteamOS uses pacman like Arch (immutable rootfs handling lives in steamos/_full-setup.sh)
      alias update='sudo pacman -Syu --noconfirm && sudo pacman -Sc --noconfirm'
    `,
  );
}

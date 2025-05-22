/** Platform tweaks for Windows - registers WSL / Ubuntu shell config. */
async function doWork() {
  /**
   * Windows mapped drive letters to auto-mount into WSL via drvfs.
   * WSL2 can't reach network shares directly (VM network isolation), so we map in Windows first
   * then use drvfs to bridge them into WSL. Skips drives that don't exist or are already mounted.
   * drvfs mounts don't persist across WSL restarts. Every time you open a new WSL session, this will:
   *   1. check if the Windows drive exists
   *   2. if not already mounted, prompt for sudo and mount it
   *   3. verify it's reachable (unmount and clean up if not)
   * you'll get a sudo password prompt once per WSL session if there are drives to mount.
   * if you wsl --shutdown and reopen, it'll prompt again.
   * prerequisite: manually map network drives in Windows first, e.g.:
   *   net use X: \\192.168.1.1\share1 /user:admin password
   *   net use Y: \\192.168.1.1\share2 /user:admin password
   *   net use Z: \\192.168.1.1\share3 /user:admin password
   * to remap a drive to a different share:
   *   net use Z: /delete
   *   net use Z: \\192.168.1.1\new_share /user:admin password
   *   then in WSL: sudo umount /mnt/z && sudo mount -t drvfs Z: /mnt/z
   *   or just wsl --shutdown and reopen — the auto-mount code will pick up the new mapping.
   */
  const EXTRA_DRIVES = ["X", "Y", "Z"];

  const profile = code`
    function cmd() {
      cmd.exe '/C' "$@"
    }

    alias adb='adb.exe'
    alias fastboot='fastboot.exe'
    # update: OS package manager update/upgrade only
    alias update='sudo apt-get update -y && sudo apt-get upgrade -y && sudo apt-get autoclean && sudo apt-get clean && sudo apt-get autoremove -y'
    alias docker='docker.exe'

    # last_folder (workaround for the last folder — suppress output during profile load)
    last_folder

    # auto-mount Windows mapped drives into WSL via drvfs (see EXTRA_DRIVES above for details)
    _EXTRA_DRIVES=(X Y Z)
    _NEEDS_MOUNT=()
    if type -P cmd.exe &>/dev/null; then
      for drv in "\${_EXTRA_DRIVES[@]}"; do
        ldrv="\${drv,,}"
        if cmd.exe /c "if exist \${drv}:\\ echo YES" 2>/dev/null | command grep -q YES && ! mountpoint -q "/mnt/\${ldrv}" 2>/dev/null; then
          _NEEDS_MOUNT+=("\${drv}")
        fi
      done
      if [ \${#_NEEDS_MOUNT[@]} -gt 0 ]; then
        echo ">> Mounting drives: \${_NEEDS_MOUNT[*]} (sudo password required)"
        for drv in "\${_NEEDS_MOUNT[@]}"; do
          ldrv="\${drv,,}"
          sudo mkdir -p "/mnt/\${ldrv}"
          if sudo mount -t drvfs "\${drv}:" "/mnt/\${ldrv}" 2>/dev/null && ls "/mnt/\${ldrv}" &>/dev/null; then
            echo ">> Mounted \${drv}: to /mnt/\${ldrv}"
          else
            sudo umount "/mnt/\${ldrv}" 2>/dev/null
            sudo rmdir "/mnt/\${ldrv}" 2>/dev/null
            echo ">> Failed to mount \${drv}: (drive unreachable)"
          fi
        done
      fi
    fi
  `;
  registerPlatformTweaks("Windows", profile);
}

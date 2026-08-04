/** Platform tweaks for Android Termux - registers termux-chroot and shell config. */
async function doWork() {
  registerPlatformTweaks(
    "Android Termux",
    code`
      # update: OS package manager update/upgrade only
      alias update='pkg update -y && pkg upgrade -y && pkg autoclean'

      # chroot to set up /tmp /etc and other fds for linux
      #
      # Guarded on three conditions:
      #   - interactive only — a non-interactive shell (scripts, ssh commands,
      #     the node|bash setup pipeline) must not be swallowed by proot
      #   - BASHRC_TERMUX_CHROOT unset — termux-chroot spawns a login shell that
      #     re-sources this profile; without the sentinel that shell would chroot
      #     again, and again. proot passes the environment through, so setting the
      #     var on the command line is enough to break the recursion, and it stays
      #     out of the outer shell so a later child shell still gets its chroot.
      #   - termux-chroot present — it ships in the proot package, which is not
      #     installed until _full-setup.sh has run at least once
      if [[ $- == *i* ]] && [ -z "\${BASHRC_TERMUX_CHROOT:-}" ] && type -P termux-chroot &> /dev/null; then
        BASHRC_TERMUX_CHROOT=1 termux-chroot

        # clear the console (runs when the chroot shell exits)
        clear
      fi
    `,
  );
}

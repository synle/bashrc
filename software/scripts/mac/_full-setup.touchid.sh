#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash
#
# Touch ID for sudo on macOS — the PAM half (make Touch ID an accepted sudo auth) and the
# sudoers half (how long an approval stays valid, and whether it is shared across ttys).
#
# Named `_full-setup.touchid.sh` rather than `_full-setup-touchid.sh`: script discovery
# gates setup-only files on the literal substring `_full-setup.` (with the dot), so the
# hyphenated form would leak into every plain profile refresh and prompt for sudo on a
# non-setup run. The `.sh` file sorts before `.touchid.sh`, so mac/_full-setup.sh still
# runs first.

################################################################################
# --- PAM: allow Touch ID as a sudo authentication method ---
################################################################################
# /etc/pam.d/sudo_local is the Apple-sanctioned drop-in — unlike /etc/pam.d/sudo and
# /etc/sudoers, it survives OS updates. Ships as a .template with the auth line commented
# out; copy it and uncomment. Works in every terminal, Ghostty included.
if [ -f /etc/pam.d/sudo_local.template ] && ! grep -q '^auth' /etc/pam.d/sudo_local 2> /dev/null; then
  echo '>> TouchID sudo'
  sudo cp /etc/pam.d/sudo_local.template /etc/pam.d/sudo_local
  sudo sed -i '' 's/^#auth/auth/' /etc/pam.d/sudo_local
fi

################################################################################
# --- sudoers: how long an approval lasts, and who it is shared with ---
################################################################################
# Symptom this fixes: Touch ID for sudo "stops working" and re-prompts constantly, even
# though pam_tid.so is correctly enabled in /etc/pam.d/sudo_local. Touch ID is NOT broken
# in that state — it fires and authenticates fine; the credential just expires almost
# immediately. macOS ships sudo with a 5-minute timestamp_timeout and tty_tickets on, so
# every 5-minute gap re-authenticates AND every new terminal tab/pane authenticates on its
# own. Verify with `sudo -V | grep -i timestamp` (shows the effective timeout and whether
# the record type is `tty` or `global`); a /var/db/sudo/ts/<uid> file holding dozens of
# 56-byte records is the tell that tickets are fragmenting per-tty instead of being reused.
#
# Root cause of the regression: macOS updates overwrite /etc/sudoers wholesale AND recreate
# /etc/sudoers.d empty (a 26.6 update did exactly this), silently dropping whatever tuning
# was there. /etc/pam.d/sudo_local survives updates by design, which is why the PAM half
# keeps working and only the caching half reverts — and why this looks like a Touch ID bug.
#
# Options considered:
#   1. timestamp_timeout=10 + Defaults !tty_tickets   <-- CHOSEN
#      One touch unlocks every tab/pane for 10 minutes. `!tty_tickets` is the half that
#      actually removes the repeated prompts — raising the timeout alone does nothing for a
#      fresh terminal, which is why the first attempt at this (60 minutes, tty_tickets left
#      on) did not change the observed behavior at all. The window is deliberately short
#      (10, not 60) to bound the cost of sharing: a background process in another pane can
#      ride on a ticket approved interactively, so the ticket should not live long.
#   2. timestamp_timeout=60 + !tty_tickets. Rejected: same sharing exposure as above but for
#      an hour; the prompt savings past ~10 minutes are marginal.
#   3. timestamp_timeout only, tty_tickets left on. Rejected: measured as ineffective — the
#      per-tty tickets, not the timeout, are what re-prompt on every new terminal.
#   4. Edit /etc/sudoers directly. Rejected: that is the file macOS updates replace, so the
#      setting would be lost again on the next update. A drop-in re-applied by this script
#      survives both the update and the emptied /etc/sudoers.d.
#
# SAFETY: the file is written to a temp path and validated with `visudo -c` first. A syntax
# error in a sudoers file locks the account out of sudo entirely, so the install only runs
# on a clean parse, and the file is installed 0440 root:wheel as sudo requires.
_SUDOERS_DROPIN=/etc/sudoers.d/bashrc-sudo
_SUDOERS_TIMEOUT_MINUTES=10
# Compare the whole rendered file, not just the timeout line — a host that already has the
# old timeout-only drop-in must still be upgraded to pick up `!tty_tickets`.
_SUDOERS_CONTENT="Defaults timestamp_timeout=$_SUDOERS_TIMEOUT_MINUTES
Defaults !tty_tickets"
if [ "$(sudo cat "$_SUDOERS_DROPIN" 2> /dev/null)" != "$_SUDOERS_CONTENT" ]; then
  echo -n ">> sudo timestamp_timeout=$_SUDOERS_TIMEOUT_MINUTES minutes, shared across ttys >> "
  _sudoers_tmp="$BASHRC_TEMP_DIR/bashrc-sudo.sudoers"
  echo "$_SUDOERS_CONTENT" > "$_sudoers_tmp"
  if sudo visudo -c -f "$_sudoers_tmp" &>> $BASHRC_TEMP_DIR/fullsetup.log \
    && sudo install -m 0440 -o root -g wheel "$_sudoers_tmp" "$_SUDOERS_DROPIN"; then
    echo "Done"
  else
    echo "Error (see $BASHRC_TEMP_DIR/fullsetup.log)"
  fi
  rm -f "$_sudoers_tmp"
fi

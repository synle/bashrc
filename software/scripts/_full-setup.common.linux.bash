#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# ---- Package Manager Lock ----

# wait for package manager locks to be released before running install commands
# first recovers any interrupted dpkg state, then polls every 10 seconds, times out after 300 seconds
function _waitForAptLock() {
  local _lock_files="/var/lib/dpkg/lock /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock /var/cache/apt/archives/lock"
  local _label="apt"
  local _max_wait=300
  local _elapsed=0
  local _locked=1

  # recover interrupted dpkg state (e.g. prior install was killed or crashed)
  echo -n ">> Recovering dpkg state >> "
  if sudo dpkg --configure -a < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log; then
    echo "Done"
  else
    echo "Error"
  fi

  while ((_locked)) && [ "$_elapsed" -lt "$_max_wait" ]; do
    _locked=0
    for _lf in $_lock_files; do
      if [ -f "$_lf" ] && sudo fuser "$_lf" &> /dev/null; then
        _locked=1
        break
      fi
    done
    if ((_locked)); then
      if [ "$_elapsed" -eq 0 ]; then
        echo -n ">> Waiting for $_label lock to be released"
      fi
      echo -n "."
      sleep 10
      _elapsed=$((_elapsed + 10))
    fi
  done

  if ((_locked)); then
    echo " Timeout (${_max_wait}s) — killing stale $_label processes"
    sudo killall apt-get &> /dev/null
    sudo killall dpkg &> /dev/null
    sudo rm -f $_lock_files
    sudo dpkg --configure -a < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log
  elif [ "$_elapsed" -gt 0 ]; then
    echo " Released (${_elapsed}s)"
  fi
}

# wait for dnf/yum lock to be released before running install commands
# polls every 10 seconds, times out after 300 seconds — then kills stale processes
function _waitForDnfLock() {
  local _lock_files="/var/run/dnf.pid /var/run/yum.pid /var/cache/dnf/metadata_lock.pid"
  local _label="dnf"
  local _max_wait=300
  local _elapsed=0
  local _locked=1

  while ((_locked)) && [ "$_elapsed" -lt "$_max_wait" ]; do
    _locked=0
    for _lf in $_lock_files; do
      if [ -f "$_lf" ] && kill -0 "$(cat "$_lf" 2> /dev/null)" &> /dev/null; then
        _locked=1
        break
      fi
    done
    if ((_locked)); then
      if [ "$_elapsed" -eq 0 ]; then
        echo -n ">> Waiting for $_label lock to be released"
      fi
      echo -n "."
      sleep 10
      _elapsed=$((_elapsed + 10))
    fi
  done

  if ((_locked)); then
    echo " Timeout (${_max_wait}s) — killing stale $_label processes"
    sudo killall dnf &> /dev/null
    sudo killall yum &> /dev/null
    sudo rm -f $_lock_files
  elif [ "$_elapsed" -gt 0 ]; then
    echo " Released (${_elapsed}s)"
  fi
}

# wait for pacman lock to be released before running install commands
# polls every 10 seconds, times out after 300 seconds — then removes stale lock file
function _waitForPacmanLock() {
  local _lock_file="/var/lib/pacman/db.lck"
  local _label="pacman"
  local _max_wait=300
  local _elapsed=0

  while [ -f "$_lock_file" ] && [ "$_elapsed" -lt "$_max_wait" ]; do
    if [ "$_elapsed" -eq 0 ]; then
      echo -n ">> Waiting for $_label lock to be released"
    fi
    echo -n "."
    sleep 10
    _elapsed=$((_elapsed + 10))
  done

  if [ -f "$_lock_file" ]; then
    echo " Timeout (${_max_wait}s) — removing stale $_label lock"
    sudo rm -f "$_lock_file"
  elif [ "$_elapsed" -gt 0 ]; then
    echo " Released (${_elapsed}s)"
  fi
}

# wait for Termux pkg (apt-based) lock to be released before running install commands
# first recovers any interrupted dpkg state, then polls every 10 seconds, times out after 300 seconds
function _waitForPkgLock() {
  local _lock_files="/data/data/com.termux/files/usr/var/lib/dpkg/lock /data/data/com.termux/files/usr/var/lib/dpkg/lock-frontend"
  local _label="pkg"
  local _max_wait=300
  local _elapsed=0
  local _locked=1

  # recover interrupted dpkg state (e.g. prior install was killed or crashed)
  echo -n ">> Recovering dpkg state >> "
  if dpkg --configure -a < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log; then
    echo "Done"
  else
    echo "Error"
  fi

  while ((_locked)) && [ "$_elapsed" -lt "$_max_wait" ]; do
    _locked=0
    for _lf in $_lock_files; do
      if [ -f "$_lf" ] && fuser "$_lf" &> /dev/null; then
        _locked=1
        break
      fi
    done
    if ((_locked)); then
      if [ "$_elapsed" -eq 0 ]; then
        echo -n ">> Waiting for $_label lock to be released"
      fi
      echo -n "."
      sleep 10
      _elapsed=$((_elapsed + 10))
    fi
  done

  if ((_locked)); then
    echo " Timeout (${_max_wait}s) — killing stale $_label processes"
    killall apt-get &> /dev/null
    killall dpkg &> /dev/null
    rm -f $_lock_files
    dpkg --configure -a < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log
  elif [ "$_elapsed" -gt 0 ]; then
    echo " Released (${_elapsed}s)"
  fi
}

# ---- Install ----

# install fnm (Fast Node Manager) and Node.js via curl — skips if fnm is already installed
function _installFnmAndNode() {
  echo -n ">> fnm >> Installing with curl >> "
  if type -P fnm &> /dev/null; then
    echo "Skipped"
  else
    if curl_bash_install https://fnm.vercel.app/install --skip-shell; then
      echo "Success"
    else
      echo "Error"
    fi
  fi
  if type -P fnm &> /dev/null || [ -x "$FNM_DIR/fnm" ]; then
    export PATH="$FNM_DIR:$PATH"
    eval "$(fnm env)" 2> /dev/null
    if ! fnm ls "$NODE_JS_VERSION" > /dev/null 2>&1; then
      echo -n ">> Node $NODE_JS_VERSION >> Installing with fnm >> "
      if fnm install "$NODE_JS_VERSION" > /dev/null 2>&1; then
        echo "Success"
      else
        echo "Error"
      fi
    fi
    fnm default "$NODE_JS_VERSION" > /dev/null 2>&1
    fnm use "$NODE_JS_VERSION" > /dev/null 2>&1
    export FNM_DEFAULT_NODE_PATH="$FNM_DIR/node-versions/$(node -v 2> /dev/null)/installation"
  fi
}

# install cloudflared binary directly — fallback for Linux distros without a native package
# guard: skips if cloudflared is already installed (e.g. via apt, pacman, brew, or prior curl)
function _installCloudflaredBinary() {
  echo -n ">> cloudflared >> Installing with curl >> "
  if type -P cloudflared &> /dev/null; then
    echo "Skipped"
    return
  fi
  if curl -fsSL -o /tmp/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    && sudo install -m 755 /tmp/cloudflared /usr/local/bin/cloudflared \
    && rm -f /tmp/cloudflared; then
    echo "Success"
  else
    echo "Error"
  fi
}

# install Zed editor via install script — fallback for Linux distros without a native package
# guard: skips if zed is already installed (e.g. via brew cask or prior curl)
function _installZedEditor() {
  echo -n ">> zed >> Installing with curl >> "
  if type -P zed &> /dev/null; then
    echo "Skipped"
    return
  fi
  if curl_bash_install https://zed.dev/install.sh; then
    echo "Success"
  else
    echo "Error"
  fi
}

# ---- Background Install Wait ----

# wait for background packages to finish (max 5 minutes to avoid blocking the build)
# after waiting, dumps background log to stdout so CI summary can capture results
# emits timeout entries for queued packages that did not complete
function _waitForBackgroundPackages() {
  if [ -z "$_BACKGROUND_INSTALL_PID" ]; then return; fi
  local _max_wait=300
  local _elapsed=0
  while kill -0 "$_BACKGROUND_INSTALL_PID" 2> /dev/null && [ "$_elapsed" -lt "$_max_wait" ]; do
    sleep 5
    _elapsed=$((_elapsed + 5))
  done
  local _timed_out=0
  if kill -0 "$_BACKGROUND_INSTALL_PID" 2> /dev/null; then
    echo ">> Background packages still running after ${_max_wait}s, proceeding"
    _timed_out=1
  else
    echo ">> Background packages completed (${_elapsed}s)"
  fi
  if [ -f "$_BACKGROUND_INSTALL_LOG" ]; then
    cat "$_BACKGROUND_INSTALL_LOG"
  fi
  if ((_timed_out)) && [ ${#_BACKGROUND_PKG_NAMES[@]} -gt 0 ]; then
    for _pkg in "${_BACKGROUND_PKG_NAMES[@]}"; do
      if ! grep -q ">> $_pkg >>" "$_BACKGROUND_INSTALL_LOG" 2> /dev/null; then
        echo ">> $_pkg >> Installing with Background >> ⏸️ Skipped (timeout)"
      fi
    done
  fi
}

# ---- Display DJ ----

# configure i2c permissions for display-dj (DDC monitor control) — all Linux distros
function _configureDisplayDjPermissions() {
  echo '>> display-dj: Loading i2c-dev kernel module'
  sudo modprobe i2c-dev &> /dev/null
  echo '>> display-dj: Adding user to i2c group'
  sudo usermod -aG i2c ${USER}
}

# ---- Power Management ----

# configure systemd power management — guard: requires systemctl (Linux only, no-op on mac/termux)
# WARNING: Hibernation saves RAM to disk on suspend. Disabling it means unsaved work is lost if battery drains.
#   To revert hibernation: sudo systemctl unmask hibernate.target hybrid-sleep.target suspend-then-hibernate.target
# WARNING: Closing the lid will power off the machine instead of sleeping.
#   To revert lid close: sudo sed -i 's/^HandleLidSwitch=poweroff/#HandleLidSwitch=suspend/' /etc/systemd/logind.conf && sudo systemctl restart systemd-logind
function _configureSystemdPowerManagement() {
  if ! type -P systemctl &> /dev/null; then return; fi

  # Power: Disable Hibernation
  echo '>> Power: Disable Hibernation'
  sudo systemctl mask hibernate.target hybrid-sleep.target suspend-then-hibernate.target &> /dev/null

  # Power: Lid Close to Shut Down (laptops only, ignored on desktops)
  echo '>> Power: Lid Close to Shut Down'
  sudo sed -i 's/^#\?HandleLidSwitch=.*/HandleLidSwitch=poweroff/' /etc/systemd/logind.conf
  sudo sed -i 's/^#\?HandleLidSwitchExternalPower=.*/HandleLidSwitchExternalPower=poweroff/' /etc/systemd/logind.conf
  sudo sed -i 's/^#\?HandleLidSwitchDocked=.*/HandleLidSwitchDocked=poweroff/' /etc/systemd/logind.conf

  # Power: Power Button to Shut Down
  echo '>> Power: Power Button to Shut Down'
  sudo sed -i 's/^#\?HandlePowerKey=.*/HandlePowerKey=poweroff/' /etc/systemd/logind.conf

  # Power: Disable Sleep Button (prevents accidental sleep)
  echo '>> Power: Disable Sleep Button'
  sudo sed -i 's/^#\?HandleSuspendKey=.*/HandleSuspendKey=ignore/' /etc/systemd/logind.conf

  sudo systemctl restart systemd-logind &> /dev/null
}

#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install azure-cli (`az`) on Linux distros that don't ship it in the main
# repos (Ubuntu/Debian apt and Fedora/RHEL dnf). Other platforms use their
# package managers: brew (mac), pacman (Arch/SteamOS), winget (Windows host).

# Skip on platforms whose package manager already ships azure-cli.
if ((is_os_mac)) || ((is_os_arch_linux)) || ((is_os_steamos)) || ((is_os_android_termux)); then
  echo ">>> Skipped azure-cli: package manager already provides azure-cli"
  exit 0
fi

# Only run on Linux flavors that match the apt/dnf installer fallback.
if ! ((is_os_ubuntu)) && ! ((is_os_redhat)) && ! ((is_os_chromeos)) && ! ((is_os_windows)); then
  echo ">>> Skipped azure-cli: unsupported platform"
  exit 0
fi

# Force refresh: uninstall existing az before reinstalling.
if is_force_refresh_stale "$(has_persistent_binary az 2> /dev/null)"; then
  echo ">> Force refresh: removing azure-cli"
  if ((is_os_ubuntu)) || ((is_os_chromeos)) || ((is_os_windows)); then
    sudo apt-get remove -y azure-cli < /dev/null &> /dev/null
  elif ((is_os_redhat)); then
    sudo dnf remove -y azure-cli < /dev/null &> /dev/null
  fi
fi

# Skip if az is already installed.
if has_persistent_binary az &> /dev/null; then
  echo ">> Skipped azure-cli: already installed at $(has_persistent_binary az)"
  exit 0
fi

echo '>> Installing azure-cli'

if ((is_os_ubuntu)) || ((is_os_chromeos)) || ((is_os_windows)); then
  # Microsoft's official one-liner: adds packages.microsoft.com apt repo and installs azure-cli.
  # https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-linux?pivots=apt
  if curl -fsSL https://aka.ms/InstallAzureCLIDeb | sudo bash > /dev/null; then
    echo ">> azure-cli installed via Microsoft apt installer"
  else
    echo ">> azure-cli install failed"
  fi
elif ((is_os_redhat)); then
  # Microsoft's RHEL/Fedora install: import key, add repo, install via dnf.
  # https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-linux?pivots=dnf
  sudo rpm --import https://packages.microsoft.com/keys/microsoft.asc &> /dev/null
  sudo tee /etc/yum.repos.d/azure-cli.repo > /dev/null << 'EOF'
[azure-cli]
name=Azure CLI
baseurl=https://packages.microsoft.com/yumrepos/azure-cli
enabled=1
gpgcheck=1
gpgkey=https://packages.microsoft.com/keys/microsoft.asc
EOF
  if sudo dnf install -y azure-cli < /dev/null &> /dev/null; then
    echo ">> azure-cli installed via Microsoft dnf repo"
  else
    echo ">> azure-cli install failed"
  fi
fi

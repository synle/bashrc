  #!/usr/bin/env bash
  set -euo pipefail

  # === Install Applications ===
  echo "Installing applications..."

  # Add repos and Brave installer
  sudo add-apt-repository -y ppa:xubuntu-dev/extras
  curl -fsS https://dl.brave.com/install.sh | sh

  # Install codium
  pushd /tmp >/dev/null || exit
  wget -q https://github.com/VSCodium/vscodium/releases/download/1.105.17075/codium_1.105.17075_amd64.deb
  sudo dpkg -i codium_1.105.17075_amd64.deb >/dev/null 2>&1 || sudo apt -f install -y >/dev/null 2>&1
  popd >/dev/null || exit
  echo "VSCodium installed successfully."

  # Update system and install core packages
  echo "Installing apt applications..."
  sudo apt update -y >/dev/null 2>&1 && \
    echo "Done apt update..." && \
    sudo apt install -y \
      git \
      vim \
      bat \
      terminator \
      remmina \
      grub2-theme-mint-2k \
      brightnessctl \
      ddcutil \
      xfce4-docklike-plugin \
      xfce4-appmenu-plugin \
      fonts-firacode \
      python3-pip \
      python3-venv \
      simplescreenrecorder \
      imagemagick \
      vlc \
      sublime-text >/dev/null 2>&1 && \
    echo "Done apt install..."

  # === Install Flatpak Applications ===
  echo "Installing Flatpak applications..."
  flatpak install -y flathub \
    com.bambulab.BambuStudio \
    com.discordapp.Discord \
    net.davidotek.pupgui2 \
    org.onlyoffice.desktopeditors \
    cc.arduino.arduinoide \
    org.blender.Blender \
    com.ultimaker.cura \
    && echo 'Done flatpak install...'

  # === Cleanup Unneeded Applications ===
  echo "Removing default and unused packages..."
  sudo apt purge -y firefox* \
    thunderbird* \
    celluloid* \
    xed \
    hypnotix* \
    rhythmbox* \
    xfce4-terminal \
    compiz \
    compiz-plugins \
    compizconfig-settings-manager \
    emerald \
    gnome-calendar \
    webapp-manager \
    && sudo apt autoremove -y --purge && sudo apt clean -y
    && echo 'Done apt remove install...'

  # === Install WhiteSur macOS Theme ===
  echo "Setting up WhiteSur macOS theme..."

  TMPDIR=$(mktemp -d /tmp/whitesur-XXXXXX)
  PICDIR="$HOME/Pictures"
  REPOS=(
    "https://github.com/vinceliuice/WhiteSur-gtk-theme.git"
    "https://github.com/vinceliuice/WhiteSur-icon-theme.git"
    "https://github.com/vinceliuice/WhiteSur-cursors.git"
    "https://github.com/vinceliuice/WhiteSur-wallpapers.git"
  )

  echo "Cloning WhiteSur repositories..."
  pushd "$TMPDIR" >/dev/null
  for repo in "${REPOS[@]}"; do
    name=$(basename "$repo" .git)
    [ -d "$name" ] && echo "Skipping existing repo: $name" && continue
    echo "Cloning: $name"
    git clone --depth 1 "$repo"
  done
  popd >/dev/null

  # 🔥 Delete all .git folders up to 2 levels deep
  find "$TMPDIR" -maxdepth 2 -type d -name ".git" -exec rm -rf {} +

  # Install icons
  echo "Installing WhiteSur icons..."
  sudo bash "$TMPDIR/WhiteSur-icon-theme/install.sh"

  # Install cursors
  echo "Installing WhiteSur cursors..."
  sudo bash "$TMPDIR/WhiteSur-cursors/install.sh"

  # Copy wallpapers and Apple logo icons
  echo "Copying wallpapers and Apple icons..."
  mkdir -p "$PICDIR"
  cp -R "$TMPDIR/WhiteSur-wallpapers" "$PICDIR/" || true
  cp ~/.local/share/icons/WhiteSur-dark/status@2x/32/start-here.svg "$PICDIR/Apple_logo_dark.svg" || true
  cp ~/.local/share/icons/WhiteSur-light/status@2x/32/start-here.svg "$PICDIR/Apple_logo_light.svg" || true

  # Install GTK theme
  echo "Installing WhiteSur GTK theme..."
  bash "$TMPDIR/WhiteSur-gtk-theme/install.sh" -t all

  echo "WhiteSur macOS theme setup complete."
  echo "Apply via: Settings → Appearance and Window Manager."

  # === Backup and Restore XFCE Configuration ===
  TIMESTAMP=$(date +"%Y-%m-%d-%H-%M-%S")
  BACKUP_DIR="$HOME/xfce-backup-$TIMESTAMP"
  CONFIG_DIR="$HOME/.config/xfce4"
  TEMP_DIR=$(mktemp -d /tmp/xfce-restore-XXXXXX)

  echo "Backing up current XFCE configuration..."
  if [ -d "$CONFIG_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    cp -r "$CONFIG_DIR" "$BACKUP_DIR/"
    echo "Full XFCE config backed up to $BACKUP_DIR/xfce4"
  else
    echo "No XFCE configuration found. Skipping backup."
  fi

  echo "Downloading and restoring XFCE configuration..."
  pushd "$TEMP_DIR" >/dev/null
  curl -fsSLO https://raw.githubusercontent.com/synle/bashrc/master/linux/xfce-config.tar.gz
  tar -xzf xfce-config.tar.gz -C ~/.config
  popd >/dev/null

  echo "Restarting XFCE components..."
  pkill xfce4-panel
  rm -rf ~/.cache/sessions/*  # Clear session cache to avoid stale configs
  sleep 1
  nohup xfce4-panel --disable-wm-check >/dev/null 2>&1 & # Restart panel (disable WM check prevents session interference)
  xfwm4 --replace >/dev/null 2>&1 &  # Replace window manager (refreshes borders, shadows, etc.)
  xfconf-query -c xfce4-keyboard-shortcuts -rR || true

  rm -rf "$TEMP_DIR" "$TMPDIR"
  echo "Temporary files removed."

  echo "Setup complete."
  echo "Backup stored in: $BACKUP_DIR"


  # Setting Terminator padding...
  GTK_DIR="$HOME/.config/gtk-3.0"
  CSS_FILE="$GTK_DIR/gtk.css"
  echo "Setting Terminator padding..."

  # Create GTK3 config directory if it doesn’t exist
  mkdir -p "$GTK_DIR"

  # Write padding CSS
  echo "/* Add padding inside Terminator terminal window */
VteTerminal, vte-terminal {
    padding: 15px 15px; /* vertical horizontal */
}" > $CSS_FILE


  # fix display
  sudo tee /usr/bin/fix-display-home > /dev/null <<'EOF'
#!/bin/bash
# Robust display + scaling fix for Linux Mint XFCE

# Set framebuffer large enough to hold both screens
xrandr --fb 2160x2720

# Configure displays
xrandr \
  --output DP-1-0 --primary --mode 2160x1440 --scale 1x1 --pos 0x1280 --rotate normal \
  --output eDP --mode 2560x1600 --scale 0.8x0.8 --pos 54x0 --rotate normal
EOF

sudo chmod +x /usr/bin/fix-display-home

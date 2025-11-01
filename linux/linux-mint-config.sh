  #!/usr/bin/env bash
  set -euo pipefail

  # === Install Applications ===
  echo "Installing applications..."

  # Add repos and Brave installer
  sudo add-apt-repository -y ppa:xubuntu-dev/extras
  curl -fsS https://dl.brave.com/install.sh | sh

  # Update system and install core packages
  sudo apt update -y
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
    sublime-text \
    && echo ''

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
    && echo ''

  # === Cleanup Unneeded Applications ===
  echo "Removing default and unused packages..."
  sudo apt purge -y firefox* thunderbird* celluloid* xed hypnotix* rhythmbox* xfce4-terminal
  sudo apt purge -y compiz compiz-plugins compizconfig-settings-manager emerald
  sudo apt autoremove -y && sudo apt clean -y

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
  # TIMESTAMP=$(date +"%Y-%m-%d-%H-%M-%S")
  # BACKUP_DIR="$HOME/xfce-backup-$TIMESTAMP"
  # CONFIG_DIR="$HOME/.config/xfce4"
  # TEMP_DIR=$(mktemp -d /tmp/xfce-restore-XXXXXX)

  # echo "Backing up current XFCE configuration..."
  # if [ -d "$CONFIG_DIR" ]; then
  #   mkdir -p "$BACKUP_DIR"
  #   cp -r "$CONFIG_DIR" "$BACKUP_DIR/"
  #   echo "Full XFCE config backed up to $BACKUP_DIR/xfce4"
  # else
  #   echo "No XFCE configuration found. Skipping backup."
  # fi

  # echo "Downloading and restoring XFCE configuration..."
  # pushd "$TEMP_DIR" >/dev/null
  # curl -fsSLO https://raw.githubusercontent.com/synle/bashrc/master/linux/xfce-config.tar.gz
  # tar -xzf xfce-config.tar.gz -C ~/.config
  # popd >/dev/null

  # echo "Restarting XFCE components..."
  # xfce4-panel -r
  # xfwm4 --replace &
  # xfconf-query -c xfce4-keyboard-shortcuts -rR || true

  # rm -rf "$TEMP_DIR" "$TMPDIR"
  # echo "Temporary files removed."

  # echo "Setup complete."
  # echo "Backup stored in: $BACKUP_DIR"


  # === Backup and Restore XFCE Configuration ===
  TIMESTAMP=$(date +"%Y-%m-%d-%H-%M-%S")
  BACKUP_DIR="$HOME/xfce-backup-$TIMESTAMP"
  CONFIG_DIR="$HOME/.config/xfce4"
  THEMES_DIR="$HOME/.themes"
  ICONS_DIR="$HOME/.icons"
  LOCAL_DIR="$HOME/.local"
  TEMP_DIR=$(mktemp -d /tmp/xfce-restore-XXXXXX)

  # Step 1: Backup current XFCE configuration
  echo "Backing up current XFCE configuration..."
  if [ -d "$CONFIG_DIR" ] || [ -d "$THEMES_DIR" ] || [ -d "$ICONS_DIR" ] || [ -d "$LOCAL_DIR" ]; then
    mkdir -p "$BACKUP_DIR"

    # Backup XFCE config, themes, icons, and local directories
    cp -r "$CONFIG_DIR" "$BACKUP_DIR/"
    cp -r "$THEMES_DIR" "$BACKUP_DIR/"
    cp -r "$ICONS_DIR" "$BACKUP_DIR/"
    cp -r "$LOCAL_DIR" "$BACKUP_DIR/"

    echo "Full XFCE config backed up to $BACKUP_DIR/"
  else
    echo "No XFCE configuration found. Skipping backup."
  fi

  # Step 2: Download and restore XFCE configuration
  echo "Downloading and restoring XFCE full configuration..."
  pushd "$TEMP_DIR" >/dev/null

  # Download the full XFCE configuration backup file
  curl -fsSLO https://raw.githubusercontent.com/synle/bashrc/master/linux/xfce-config-full.tar.gz

  # Extract the full backup archive into the appropriate directories
  tar -xzf xfce-config-full.tar.gz -C ~/

  # Extract individual directories (config, themes, icons, local)
  tar -xzf xfce-config-full.tar.gz -C ~/.config
  tar -xzf xfce-config-full.tar.gz -C ~/.local
  tar -xzf xfce-config-full.tar.gz -C ~/.themes
  tar -xzf xfce-config-full.tar.gz -C ~/.icons

  popd >/dev/null

  # Step 3: Restart XFCE components to apply the new configuration
  echo "Restarting XFCE components..."
  xfce4-panel -r
  xfwm4 --replace &
  xfconf-query -c xfce4-keyboard-shortcuts -rR || true

  # Step 4: Cleanup temporary files
  rm -rf "$TEMP_DIR" "$TMPDIR"
  echo "Temporary files removed."

  # Final Output
  echo "Setup complete."
  echo "Backup stored in: $BACKUP_DIR"

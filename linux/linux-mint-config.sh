#!/usr/bin/env bash

# Helper function to remove packages with apt
removePackageWithApt() {
  echo "  >> sudo apt remove -y --purge $@"
  sudo apt remove -y --purge "$@" &> /dev/null
}

installPackageWithApt() {
  echo "  >> sudo apt install -y $@"
  sudo apt install -y --fix-missing "$@" &> /dev/null
}

# Helper function to install packages with Flatpak
installPackageWithFlatpak() {
  echo "  >> flatpak install -y $@"
  flatpak install -y "$@" &> /dev/null
}


# ====== INSTALL APPLICATIONS ==============================================================================
echo "Installing applications..."

# Add repos and install Brave
sudo add-apt-repository -y ppa:xubuntu-dev/extras
curl -fsS https://dl.brave.com/install.sh | sh

# Install APT packages
echo "Installing APT packages..."
sudo apt update -y && echo "APT update done."
installPackageWithApt git
installPackageWithApt vim
installPackageWithApt bat
installPackageWithApt terminator
installPackageWithApt remmina
installPackageWithApt grub2-theme-mint-2k
installPackageWithApt brightnessctl
installPackageWithApt ddcutil
installPackageWithApt xfce4-docklike-plugin
# installPackageWithApt xfce4-appmenu-plugin
installPackageWithApt fonts-cantarell
installPackageWithApt fonts-firacode
installPackageWithApt python3-pip
installPackageWithApt python3-venv
installPackageWithApt simplescreenrecorder
installPackageWithApt imagemagick
installPackageWithApt vlc
installPackageWithApt sublime-text
installPackageWithApt mint-meta-codecs
echo "APT packages installed."

# ====== FLATPAK APPLICATIONS ==============================================================================
echo "Installing Flatpak applications..."
installPackageWithFlatpak flathub
installPackageWithFlatpak com.bambulab.BambuStudio
installPackageWithFlatpak com.discordapp.Discord
installPackageWithFlatpak net.davidotek.pupgui2
installPackageWithFlatpak org.onlyoffice.desktopeditors
installPackageWithFlatpak cc.arduino.arduinoide
installPackageWithFlatpak org.blender.Blender
installPackageWithFlatpak com.ultimaker.cura
echo "Flatpak applications installed."

# ====== CLEANUP ==============================================================================
echo "Removing unused packages..."
removePackageWithApt firefox*
removePackageWithApt thunderbird*
removePackageWithApt celluloid*
removePackageWithApt xed
removePackageWithApt hypnotix*
removePackageWithApt rhythmbox*
removePackageWithApt xfce4-terminal
removePackageWithApt compiz
removePackageWithApt compiz-plugins
removePackageWithApt compizconfig-settings-manager
removePackageWithApt emerald
removePackageWithApt mint-l-*
removePackageWithApt mint-y-*
removePackageWithApt mint-x-*
removePackageWithApt yaru-theme*
removePackageWithApt yaru-cinnamon*
removePackageWithApt gnome-calendar
removePackageWithApt webapp-manager
sudo apt autoremove -y --purge
sudo apt clean -y
echo "System cleaned."

# ====== WHITESUR THEME INSTALLATION ==============================================================================
TMPDIR=$(mktemp -d /tmp/whitesur-XXXXXX)
PICDIR="$HOME/Pictures"
REPOS=(
  "https://github.com/vinceliuice/WhiteSur-gtk-theme.git"
  "https://github.com/vinceliuice/WhiteSur-icon-theme.git"
  "https://github.com/vinceliuice/WhiteSur-cursors.git"
  "https://github.com/vinceliuice/WhiteSur-wallpapers.git"
)

echo "Setting up WhiteSur macOS theme in $TMPDIR..."
pushd "$TMPDIR" >/dev/null
for repo in "${REPOS[@]}"; do
  name=$(basename "$repo" .git)
  if [ -d "$name" ]; then
    echo "Skipping existing repo: $name"
  else
    echo "Cloning: $name"
    git clone --depth 1 "$repo"
  fi
done
popd

# Remove .git folders
find "$TMPDIR" -maxdepth 2 -type d -name ".git" -exec rm -rf {} + 2>/dev/null

# Icons
echo "Installing WhiteSur icons..."
pushd "$TMPDIR/WhiteSur-icon-theme" >/dev/null
sudo ./install.sh --remove
sudo ./install.sh
popd

# Cursors
echo "Installing WhiteSur cursors..."
pushd "$TMPDIR/WhiteSur-cursors/" >/dev/null
sudo ./install.sh
popd

# GTK Theme
echo "Installing WhiteSur GTK theme..."
pushd "$TMPDIR/WhiteSur-gtk-theme" >/dev/null
./tweaks.sh -g -r
./tweaks.sh -f -r
sudo ./install.sh -d /usr/share/themes -t blue -N stable --opacity normal --scheme standard
sudo flatpak override --filesystem=xdg-config/gtk-3.0
sudo flatpak override --filesystem=xdg-config/gtk-4.0
./tweaks.sh -F
sudo ./tweaks.sh -F
popd
sudo find /usr/share/icons -maxdepth 1 -type d \( ! -name "default" \) -exec sudo gtk-update-icon-cache -f {} \;
# update the cache for gtk


# Wallpapers
echo "Copying wallpapers..."
mkdir -p "$PICDIR/WhiteSur-wallpapers"
cp -R "$TMPDIR/WhiteSur-wallpapers/"* "$PICDIR/WhiteSur-wallpapers/"
cp /usr/share/icons/WhiteSur/status@2x/32/start-here.svg "$PICDIR/Apple_logo.svg"

# Refresh caches
echo "Refreshing caches..."
sudo gtk-update-icon-cache -f /usr/share/icons/WhiteSur
sudo update-icon-caches /usr/share/icons
sudo update-mime-database /usr/share/mime
echo "WhiteSur theme installation complete."

# ====== XFCE CONFIG BACKUP/RESTORE ==============================================================================
TIMESTAMP=$(date +"%Y-%m-%d-%H-%M-%S")
BACKUP_DIR="$HOME/xfce-backup-$TIMESTAMP"
CONFIG_DIR="$HOME/.config/xfce4"
TEMP_DIR=$(mktemp -d /tmp/xfce-restore-XXXXXX)

echo "Backing up XFCE configuration..."
if [ -d "$CONFIG_DIR" ]; then
  mkdir -p "$BACKUP_DIR"
  cp -r "$CONFIG_DIR" "$BACKUP_DIR/"
  echo "XFCE config backed up to $BACKUP_DIR/xfce4"
else
  echo "No XFCE configuration found. Skipping backup."
fi

echo "Restoring XFCE configuration..."
pushd "$TEMP_DIR" >/dev/null
curl -fsSLO https://raw.githubusercontent.com/synle/bashrc/master/linux/xfce-config.tar.gz
tar -xzf xfce-config.tar.gz -C ~/.config
popd

echo "Restarting XFCE..."
pkill xfce4-panel
rm -rf ~/.cache/sessions/*
sleep 1
nohup xfce4-panel --disable-wm-check &
sleep 3
xfce4-panel -r
xfwm4 --replace &
xfconf-query -c xfce4-keyboard-shortcuts -rR

# Cleanup
# rm -rf "$TEMP_DIR" "$TMPDIR"
echo "Temporary files removed."
echo "Setup complete. Backup stored in: $BACKUP_DIR"


# ====== Misc ==============================================================================
# Terminator padding fix
echo "Applying Terminator padding..."
GTK_DIR="$HOME/.config/gtk-3.0"
mkdir -p "$GTK_DIR"
echo "VteTerminal, vte-terminal {
  padding: 15px 15px;
}" > "$GTK_DIR/gtk.css"

# Display fix
echo "Installing fix-display-home helper..."
sudo bash -c 'cat <<EOF > /usr/bin/fix-display-home
#!/bin/bash
xrandr --fb 2160x2720
xrandr \
  --output DP-1-0 --primary --mode 2160x1440 --scale 1x1 --pos 0x1280 --rotate normal \
  --output eDP --mode 2560x1600 --scale 0.8x0.8 --pos 54x0 --rotate normal
EOF'
sudo chmod +x /usr/bin/fix-display-home

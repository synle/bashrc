#!/usr/bin/env bash
set -euo pipefail

# ====== INSTALL APPLICATIONS ==============================================================================
echo "Installing applications..."

# Add repos and install Brave
sudo add-apt-repository -y ppa:xubuntu-dev/extras
curl -fsS https://dl.brave.com/install.sh | sh

# Install VSCodium
CODIUM_VER="1.105.17075"
pushd /tmp >/dev/null || exit
echo "Installing VSCodium v$CODIUM_VER..."
wget -q "https://github.com/VSCodium/vscodium/releases/download/${CODIUM_VER}/codium_${CODIUM_VER}_amd64.deb"
sudo dpkg -i "codium_${CODIUM_VER}_amd64.deb" >/dev/null 2>&1 || sudo apt -f install -y >/dev/null 2>&1
popd >/dev/null || exit
echo "VSCodium installed successfully."

# Install APT packages
echo "Installing APT packages..."
sudo apt update -y >/dev/null 2>&1 && echo "APT update done."
sudo apt install -y \
  git vim bat terminator remmina grub2-theme-mint-2k \
  brightnessctl ddcutil xfce4-docklike-plugin xfce4-appmenu-plugin \
  fonts-firacode python3-pip python3-venv simplescreenrecorder \
  imagemagick vlc sublime-text >/dev/null 2>&1
echo "APT packages installed."

# ====== FLATPAK APPLICATIONS ==============================================================================
echo "Installing Flatpak applications..."
flatpak install -y flathub \
  com.bambulab.BambuStudio \
  com.discordapp.Discord \
  net.davidotek.pupgui2 \
  org.onlyoffice.desktopeditors \
  cc.arduino.arduinoide \
  org.blender.Blender \
  com.ultimaker.cura \
  >/dev/null 2>&1
echo "Flatpak applications installed."

# ====== CLEANUP ==============================================================================
echo "Removing unused packages..."
sudo apt purge -y firefox* thunderbird* celluloid* xed hypnotix* rhythmbox* \
  xfce4-terminal compiz compiz-plugins compizconfig-settings-manager emerald \
  mint-l-* mint-y-* mint-x-* yaru-theme* yaru-cinnamon* \
  gnome-calendar webapp-manager >/dev/null 2>&1 || true
sudo apt autoremove -y --purge >/dev/null 2>&1
sudo apt clean -y >/dev/null 2>&1
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
    git clone --depth 1 "$repo" >/dev/null 2>&1
  fi
done
popd >/dev/null

# Remove .git folders
find "$TMPDIR" -maxdepth 2 -type d -name ".git" -exec rm -rf {} + 2>/dev/null || true
sudo rm -rf /usr/share/themes/*

# Icons
echo "Installing WhiteSur icons..."
pushd "$TMPDIR/WhiteSur-icon-theme" >/dev/null
sudo ./install.sh --remove >/dev/null 2>&1 || true
sudo ./install.sh -b -d /usr/share/icons -n WhiteSur >/dev/null 2>&1
popd >/dev/null

# Cursors
echo "Installing WhiteSur cursors..."
sudo bash "$TMPDIR/WhiteSur-cursors/install.sh" >/dev/null 2>&1

# GTK Theme
echo "Installing WhiteSur GTK theme..."
pushd "$TMPDIR/WhiteSur-gtk-theme" >/dev/null
./tweaks.sh -g -r >/dev/null 2>&1 || true
./tweaks.sh -f -r >/dev/null 2>&1 || true
sudo ./install.sh -d /usr/share/themes \
  -c Dark -t blue -N stable --opacity normal --scheme standard >/dev/null 2>&1
sudo flatpak override --filesystem=xdg-config/gtk-3.0
sudo flatpak override --filesystem=xdg-config/gtk-4.0
./tweaks.sh -F >/dev/null 2>&1 || true
sudo ./tweaks.sh -F >/dev/null 2>&1 || true
popd >/dev/null
sudo find /usr/share/icons -maxdepth 1 -type d \( ! -name "default" \) -exec sudo gtk-update-icon-cache -f {} \;


# Wallpapers
echo "Copying wallpapers..."
mkdir -p "$PICDIR/WhiteSur-wallpapers"
cp -R "$TMPDIR/WhiteSur-wallpapers/"* "$PICDIR/WhiteSur-wallpapers/" 2>/dev/null || true
cp /usr/share/icons/WhiteSur/status@2x/32/start-here.svg "$PICDIR/Apple_logo.svg" 2>/dev/null || true

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

# Refresh caches
echo "Refreshing caches..."
sudo gtk-update-icon-cache -f /usr/share/icons/WhiteSur >/dev/null 2>&1 || true
sudo update-icon-caches /usr/share/icons >/dev/null 2>&1 || true
sudo update-mime-database /usr/share/mime >/dev/null 2>&1 || true
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
popd >/dev/null

echo "Restarting XFCE..."
pkill xfce4-panel || true
rm -rf ~/.cache/sessions/* >/dev/null 2>&1
sleep 1
nohup xfce4-panel --disable-wm-check >/dev/null 2>&1 &
sleep 3
xfce4-panel -r
xfwm4 --replace >/dev/null 2>&1 &
xfconf-query -c xfce4-keyboard-shortcuts -rR || true

# Cleanup
rm -rf "$TEMP_DIR" "$TMPDIR"
echo "Temporary files removed."
echo "Setup complete. Backup stored in: $BACKUP_DIR"


# # install kde
# sudo apt purge xfce4* mint-meta-xfce -y
# sudo apt autoremove --purge -y

# sudo apt install --no-install-recommends kde-plasma-desktop -y
# sudo apt install plasma-workspace-wayland -y
# sudo apt install sddm -y

# # sudo apt install kde-standard -y

# sudo dpkg-reconfigure sddm
# sudo systemctl enable sddm
# sudo systemctl disable lightdm
# rm -rf ~/.config/xfce4 ~/.cache/sessions




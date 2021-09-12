# Linux Notes

## Desktop Shortcuts (XFCE)

Desktop shortcut files are stored at:

```bash
~/.local/share/applications
```

### Sample .desktop File

```
[Desktop Entry]
Name=Arduino IDE
Comment=Arduino IDE
Exec=/home/syle/Apps/Arduino IDE/arduino-ide_2.3.2_Linux_64bit.AppImage
Icon=/home/syle/Apps/Arduino IDE/icon.png
Terminal=false
Type=Application
Categories=Development;
```

### Generate Shortcuts from App Folders

```bash
function setup_shortcut() {
  if [[ ! -f "_desktop.txt" ]]; then
    cat <<EOF > _desktop.txt
Type=Application
Categories=Development
EOF
  fi

  DESKTOP_SHORTCUT_EXTRA="$(< _desktop.txt)"
  CURRENT_PWD="$(pwd)"
  CURRENT_FOLDER_NAME="$(basename "$CURRENT_PWD")"

  cat <<EOF > "${CURRENT_FOLDER_NAME}.desktop"
[Desktop Entry]
Name=${CURRENT_FOLDER_NAME}
Comment=${CURRENT_FOLDER_NAME}
Exec=${CURRENT_PWD}/app.AppImage
Icon=${CURRENT_PWD}/app.jpg
Terminal=false
${DESKTOP_SHORTCUT_EXTRA}
EOF
}

for folder in */; do
  [[ -d "$folder" ]] || continue
  pushd "$folder"
  setup_shortcut
  popd
done

chmod +x */app.AppImage
cp */*.desktop ~/.local/share/applications/
```

### Revert XFCE Menu

```bash
mv ~/.config/menus/xfce-applications.menu ~/.config/menus/xfce-applications.menu.backup
```

---

## Brightness Controls

### External Displays with `ddcutil`

```bash
sudo apt-get install -y ddcutil

ddcutil detect
ddcutil -d 1 setvcp 10 30

brightness() {
    local brightness1=${1:-30}
    local brightness2=${2:-$brightness1}
    brightness1=$(($brightness1 < 30 ? 30 : $brightness1))
    brightness2=$(($brightness2 < 30 ? 30 : $brightness2))
    ddcutil -d 1 setvcp 10 $brightness1 && ddcutil -d 2 setvcp 10 $brightness2
}
```

### Laptop Display with `brightnessctl`

```bash
sudo apt-get install -y brightnessctl

sudo usermod -aG input ${USER}
sudo usermod -aG video ${USER}

# Open Keyboard > Application Shortcuts
brightnessctl s +15%
brightnessctl s +15%-
```

### Consolidated Brightness Scripts

```bash
sudo apt-get install -y ddcutil brightnessctl

sudo usermod -aG input ${USER}
sudo usermod -aG video ${USER}

echo """
brightnessctl set 25%
/usr/bin/ddcutil -d 1 setvcp 10 25
/usr/bin/ddcutil -d 2 setvcp 10 25
""" > /tmp/_change_brightness1

echo """
brightnessctl set 100%
/usr/bin/ddcutil -d 1 setvcp 10 100
/usr/bin/ddcutil -d 2 setvcp 10 100
""" > /tmp/_change_brightness2

echo """
brightnessctl set 100%
/usr/bin/ddcutil -d 1 setvcp 10 100
/usr/bin/ddcutil -d 2 setvcp 10 25
""" > /tmp/_change_brightness3

echo """
brightnessctl set 100%
/usr/bin/ddcutil -d 1 setvcp 10 25
/usr/bin/ddcutil -d 2 setvcp 10 100
""" > /tmp/_change_brightness4

chmod +x /tmp/_change_brightness1 && sudo mv /tmp/_change_brightness1 /usr/bin/_change_brightness1
chmod +x /tmp/_change_brightness2 && sudo mv /tmp/_change_brightness2 /usr/bin/_change_brightness2
chmod +x /tmp/_change_brightness3 && sudo mv /tmp/_change_brightness3 /usr/bin/_change_brightness3
chmod +x /tmp/_change_brightness4 && sudo mv /tmp/_change_brightness4 /usr/bin/_change_brightness4
```

---

## Input Devices

### Disable Middle Click

```bash
xinput list
xinput --get-button-map 19

# put this into ~/.xsessionrc
xinput --set-button-map 19 1 0 3 4 5 6 7
```

### Toggle Touchpad Script

```bash
sudo echo '''
#!/bin/bash
device_index=19
state=$(xinput list-props $device_index | grep "Device Enabled" | awk '{print $4}')

if [ "$state" -eq 1 ]; then
    xinput disable $device_index
else
    xinput enable $device_index
fi
''' > /usr/bin/toggle_touchpad

sudo chmod +x /usr/bin/toggle_touchpad
```

---

## Keyboard Shortcuts (`Keyboard` > `Application Shortcuts`)

### Brightness and Touchpad Controls

```bash
# Menu = toggle touchpad
/usr/bin/toggle_touchpad

# Shift + F1 / F2
## For laptop
brightnessctl s +15%
brightnessctl s +15%-

## For monitors
ddcutil -d 1 setvcp 10 30 ; ddcutil -d 2 setvcp 10 30
ddcutil -d 1 setvcp 10 100 ; ddcutil -d 2 setvcp 10 100
ddcutil -d 1 setvcp 10 100 ; ddcutil -d 2 setvcp 10 30
```

### XFCE Keyboard Shortcuts

```bash
vim ~/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-keyboard-shortcuts.xml
```

```bash
# backup
xfconf-query -c xfce4-keyboard-shortcuts -lv > ./xfce-keyboard-shortcuts-backup.txt

# restore
while read -r key value; do
  xfconf-query -c xfce4-keyboard-shortcuts -p "$key" -s "$value" --create
done < ~/xfce-keyboard-shortcuts-backup.txt
```

```bash
Keyboard Shortcuts
  ### xfce4-keyboard-settings
  # lock the desktop
  "xflock4" => Alt + Ctrl + Q

  # capture screenshot
  "xfce4-screenshooter -r" => Shift + Alt + 4
  "xfce4-screenshooter -r" => Ctrl + Alt + 4

  # Unbind Super whiskey menu
  "xfce4-popup-whiskermenu" => Super + Alt

  # open terminal
  "terminator" => Super R

Windows Manager
  Keyboard
    Alt + Super + Up => Tile window to the *
    Alt + Super + Left => Tile window to the *
    Alt + Super + Right=> Tile window to the *
    Alt + Super + Down => Tile window to the *
    Alt + Super + M => Maximize Windows *
    #
    Super + D => Show desktop
    Alt + Q => Close Windows
```

---

## Grub

```bash
NEW_TIMEOUT=6 && NEW_GFXMODE=1024x768 && sudo sed -i -E \
  -e "s|^GRUB_TIMEOUT=.*|GRUB_TIMEOUT=${NEW_TIMEOUT}|" \
  -e "s|^GRUB_GFXMODE=.*|GRUB_GFXMODE=${NEW_GFXMODE}|" \
  /etc/default/grub && sudo echo $NEW_TIMEOUT $NEW_GFXMODE

sudo apt-get install -y grub2-theme-mint-2k
sudo update-grub
```

---

## Restart / Reset WiFi Icon

```bash
alias reset-wifi-icon='nm-applet > /dev/null &'
```

## Brave Browser Path

```bash
sudo ln -s /var/lib/flatpak/app/com.brave.Browser/x86_64/stable/94c81a7888d58d424e186c8f619b38995ac9b8c3d61d36bc8c0f02f71ce9ad82/export/bin/com.brave.Browser /usr/bin/brave-browser
```

---

## Remove Linux Mint from Dual Boot with Windows

```bash
# look for ubuntu / linux mint identifier
bcdedit /enum firmware

# delete it
bcdedit /delete IDENTIFIER_ID

# remove the boot file
diskpart
list disk
select disk 0
list part
select partition 1 (SYSTEM)
assign letter=X
exit

# same as above but if boot file is in a separate partition
diskpart
sel part 5
delete partition override

# go to the mapped drive and remove the ubuntu
X:
cd EFI
rmdir /S ubuntu
```

---

## Linux Mint / XFCE Setup

### Install Dependencies

```bash
sudo apt-get update -y
sudo apt-get install -y git vim vlc sublime-text python3-pip bat python3-venv terminator remmina grub2-theme-mint-2k brightnessctl ddcutil simplescreenrecorder fonts-cantarell fonts-firacode imagemagick

# Windows-like dock taskbar
# https://github.com/nsz32/docklike-plugin
sudo add-apt-repository ppa:xubuntu-dev/extras
sudo apt-get update -y
sudo apt-get install -y xfce4-docklike-plugin  # then add docklike into the taskbar

sudo apt-get upgrade -y
```

### Surface Book Kernel

<https://github.com/linux-surface/linux-surface/wiki/Installation-and-Setup>

```bash
wget -qO - https://raw.githubusercontent.com/linux-surface/linux-surface/master/pkg/keys/surface.asc \
    | gpg --dearmor | sudo dd of=/etc/apt/trusted.gpg.d/linux-surface.gpg

echo "deb [arch=amd64] https://pkg.surfacelinux.com/debian release main" \
  | sudo tee /etc/apt/sources.list.d/linux-surface.list

sudo apt-get update -y
sudo apt install -y linux-image-surface linux-headers-surface libwacom-surface iptsd
```

### Debloat

```bash
sudo apt-get remove firefox* thunderbird* celluloid* xed hypnotix* rhythmbox* xfce4-terminal
sudo apt-get autoclean
sudo apt-get autoremove
```

### Theming and Appearance

#### Animation and Speed (Compiz)

```bash
Compiz
  Effects > Animation > Disable
  Effects > Decoration > Disable
  Effects > Firepaint > Disable

Thunar
  Preferences
    Display
      Show Thumbnails > Local Files Only > Disable Remote Files Thumbnails
      Only show Thumbnails for files less than 10MB
    Shortcuts
      Icons size > 24PX
    Advanced
      Volume Management > Disable It

Mouse
  Double Click Threshold > 1s
```

#### Appearance Settings

```bash
Style => Mint-Y (gtk3,2,xfwm4)
Icons => Humanity
```

### Mac OS X Like Theme (WhiteSur)

```bash
echo "Starting WhiteSur macOS theme setup..."

TMPDIR="/tmp"
PICDIR="$HOME/Pictures"
REPOS=(
  "https://github.com/vinceliuice/WhiteSur-gtk-theme.git"
  "https://github.com/vinceliuice/WhiteSur-icon-theme.git"
  "https://github.com/vinceliuice/WhiteSur-cursors.git"
  "https://github.com/vinceliuice/WhiteSur-wallpapers.git"
)

# Parallel clone phase
pushd "$TMPDIR" >/dev/null
PIDS=()

for repo in "${REPOS[@]}"; do
  name=$(basename "$repo" .git)
  if [ -d "$name" ]; then
    echo "Skipping existing repo: $name"
    continue
  fi
  echo "Cloning: $name"
  git clone --depth 1 "$repo" &
  PIDS+=($!)
done

for pid in "${PIDS[@]}"; do
  wait "$pid"
done
popd >/dev/null

# Install icons
pushd "$TMPDIR/WhiteSur-icon-theme" >/dev/null
./install.sh
popd >/dev/null

# Install cursors
pushd "$TMPDIR/WhiteSur-cursors" >/dev/null
sudo ./install.sh
popd >/dev/null

# Copy wallpapers and Apple icons
mkdir -p "$PICDIR"
cp -R "$TMPDIR/WhiteSur-wallpapers" "$PICDIR/" || true
cp ~/.local/share/icons/WhiteSur-dark/status@2x/32/start-here.svg "$PICDIR/Apple_logo_dark.svg" || true
cp ~/.local/share/icons/WhiteSur-light/status@2x/32/start-here.svg "$PICDIR/Apple_logo_light.svg" || true

# Install GTK theme
pushd "$TMPDIR/WhiteSur-gtk-theme" >/dev/null
./install.sh -t all
popd >/dev/null

echo "WhiteSur macOS theme setup complete!"
echo "Apply theme in: Settings > Appearance / Window Manager"
```

#### Activate WhiteSur Theme

```bash
### Menu > Settings > Appearance
# Theme > White Sur Light
# Icon > White Sur Light
# Font > Cantarell Regular / Fira Code

### Mouse > Theme > Whitesur

### Menu Mac OSX Icon ~/.local/share/icons/WhiteSur-light

### Lockscreen / Login Window
### Menu > Administration > Login Window
```

### Backup and Restore XFCE Config

```bash
# backup
TIMESTAMP=$(date +%Y%m%d-%H%M%S) && \
tar czf "./xfce-config$TIMESTAMP.tar.gz" -C "$HOME/.config" xfce4

# restore
tar xzf "./xfce-config*.tar.gz" -C "$HOME/.config"
```

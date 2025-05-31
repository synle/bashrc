## install

```bash
# curl -fsS https://dl.brave.com/install.sh | sh # brave
sudo apt-get update -y
sudo apt-get install -y git vim vlc sublime-text python3-pip bat python3-venv terminator remmina grub2-theme-mint-2k brightnessctl
sudo apt-get install -y simplescreenrecorder

# Windows like dock like taskbar
# https://github.com/nsz32/docklike-plugin
# sudo add-apt-repository ppa:xubuntu-dev/extras
sudo apt update -y
sudo apt install -y xfce4-docklike-plugin


####
sudo apt-get upgrade -y
```

## Debloat

```bash
sudo apt-get remove firefox* thunderbird* celluloid* xed hypnotix* rhythmbox* xfce4-terminal
sudo apt-get autoclean
sudo apt-get autoremove
```

## Theming & Appearance

### Appearance

```
Style => Mint-Y (gtk3,2,xfwm4)
ICons => Humanity
```

## Grub

```bash
# Follow the above to install grub2-theme-mint-2k
# Use the following options
sudo vim /etc/default/grub
GRUB_TIMEOUT=6
GRUB_GFXMODE=1024x768

sudo update-grub
```

## Disable middle click for mouse

```bash
xinput list
xinput --get-button-map 19

# put this into ~/.xsessionrc
xinput --set-button-map 19 1 0 3 4 5 6 7
```

## toggle mouse

```bash
sudo echo '''
#!/bin/bash

# Set the device index to a variable
device_index=19

# Get the current state of the device
state=$(xinput list-props $device_index | grep "Device Enabled" | awk '{print $4}')

# Check if the device is enabled (state == 1) or disabled (state == 0)
if [ "$state" -eq 1 ]; then
    # Disable the device
    xinput disable $device_index
else
    # Enable the device
    xinput enable $device_index
fi
''' > /usr/bin/toggle_touchpad

sudo chmod +x /usr/bin/toggle_touchpad
```

## Change brightness for external displays with `ddcutil`

```
sudo apt install ddcutil

ddcutil detect

ddcutil -d 1 setvcp 10 30

change_brightness() {
    ddcutil -d $1 setvcp 10 $2
}

brightness() {
    # Set default brightness value
    local brightness1=${1:-30}  # Default to 30 if no value is passed
    local brightness2=${2:-$brightness1}  # If no second value, use the first one

    # Ensure the brightness values are at least 30 (to avoid invalid values)
    brightness1=$(($brightness1 < 30 ? 30 : $brightness1))
    brightness2=$(($brightness2 < 30 ? 30 : $brightness2))

    # Set brightness for both displays
    ddcutil -d 1 setvcp 10 $brightness1 && ddcutil -d 2 setvcp 10 $brightness2
}
```

## Change brightness for laptop display with `brightnessctl`

```
sudo apt install brightnessctl -y

sudo usermod -aG input ${USER}
sudo usermod -aG video ${USER}

# Open Keyboard > Application Shortcuts
brightnessctl s +15%
brightnessctl s +15%-
```

## Brave path

```
sudo ln -s /var/lib/flatpak/app/com.brave.Browser/x86_64/stable/94c81a7888d58d424e186c8f619b38995ac9b8c3d61d36bc8c0f02f71ce9ad82/export/bin/com.brave.Browser /usr/bin/brave-browser
```

## How to remove linux mint from dual boot with windows

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

## Restart reset wifi icon

```
alias reset-wifi-icon='nm-applet > /dev/null &'
```

## Keyboard Shortcuts : `Keyboard` > `Application Shortcuts`

### For brightness (`Shift + F1 / F2`)and touchpad controls (`Menu`)

```
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

### Other useful keybindings / application shortcuts

```
# Unbind Super whiskey menu
Remove Super L - "xfce-4-popup-whiskermenu" or replace it with `Super + Space`

# open terminal
Add Super R - terminator

# locking desktop
Add Alt + Ctrl + Q => "xflock4" to lock the desktop

# capture screenshot
Add Shift + Alt + 4 => "xfce4-screenshooter -r"
```

## Keyboard Shortcuts : `Windows Manager`

```
> Super Up - Tile window to the *
> Super Left - Tile window to the *
> Super Right- Tile window to the *
> Super Down - Tile window to the *
> Super D - Show desktop
```


#### Auto keyboard
```
xfce4-keyboard-settings

bash -ic center_active_window
```


### Setting up Shortcuts
```

# Get current working directory
function setup_shortcut() {
  # Check if the file exists
  if [[ ! -f "_desktop.txt" ]]; then
    # Create the file with default content
    cat <<EOF > _desktop.txt
Type=Application
Categories=Development
EOF
  fi

  # Read the file content into the variable
  DESKTOP_SHORTCUT_EXTRA="$(< _desktop.txt)"

  # Get current working directory and folder name
  CURRENT_PWD="$(pwd)"
  CURRENT_FOLDER_NAME="$(basename "$CURRENT_PWD")"

  # Create .desktop file
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


ls | grep -v url-porter | grep -v note.txt


for folder in */; do
  # Skip if not a directory
  [[ -d "$folder" ]] || continue

  pushd "$folder"
  setup_shortcut
  popd
done

cp */*.desktop ~/.local/share/applications/
```

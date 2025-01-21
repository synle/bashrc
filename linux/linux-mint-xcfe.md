## install

```bash
# curl -fsS https://dl.brave.com/install.sh | sh # brave
sudo apt-get update -y
sudo apt-get install -y git vim vlc sublime-text python3-pip bat python3-venv terminator remmina grub2-theme-mint-2k brightnessctl

####
sudo apt-get upgrade -y
```

## Debloat

```bash
sudo apt-get remove firefox* thunderbird* celluloid* xed hypnotix* rhythmbox* xfce4-terminal
sudo apt-get autoclean
sudo apt-get autoremove
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


## Change brightness

```
sudo apt install brightnessctl -y

sudo usermod -aG input ${USER}
sudo usermod -aG video ${USER}

brightnessctl s +15%
brightnessctl s +15%-
```


## Brave path
```
sudo ln -s /var/lib/flatpak/app/com.brave.Browser/x86_64/stable/94c81a7888d58d424e186c8f619b38995ac9b8c3d61d36bc8c0f02f71ce9ad82/export/bin/com.brave.Browser /usr/bin/brave-browser
```

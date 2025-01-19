## install

```bash
# curl -fsS https://dl.brave.com/install.sh | sh # brave
sudo apt-get update -y
sudo apt-get install -y git vim vlc sublime-text python3-pip bat python3-venv terminator remmina grub2-theme-mint-2k

####
sudo apt-get upgrade -y
```

## Debloat

```bash
sudo apt-get remove firefox* thunderbird* celluloid* xed hypnotix* rhythmbox*
sudo apt-get autoclean
sudo apt-get autoremove
```

## Grub

```bash
# Follow the above to install grub2-theme-mint-2k
# Use the following options
sudo vim /etc/default/grub
GRUB_TIMEOUT=5
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

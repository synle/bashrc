## Debloat

```bash
sudo apt-get remove -y xed thunderbird* firefox*
```

## install

```bash
sudo apt-get install -y remmina vim git terminator vlc python3-pip
```

```bash
#brave
sudo curl -fsSLo /usr/share/keyrings/brave-browser-archive-keyring.gpg https://brave-browser-apt-release.s3.brave.com/brave-browser-archive-keyring.gpg

echo "deb [signed-by=/usr/share/keyrings/brave-browser-archive-keyring.gpg] https://brave-browser-apt-release.s3.brave.com/ stable main"|sudo tee /etc/apt/sources.list.d/brave-browser-release.list

sudo apt-get update -y
sudo apt-get install brave-browser
```

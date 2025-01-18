## install

```bash
# curl -fsS https://dl.brave.com/install.sh | sh # brave
sudo apt-get update -y
sudo apt-get install -y git vim vlc sublime-text python3-pip bat python3-venv terminator remmina

####
sudo apt-get upgrade -y
```


## Debloat

```bash
sudo apt-get remove firefox* thunderbird* celluloid* xed hypnotix* rhythmbox*
sudo apt-get autoclean
sudo apt-get autoremove
```

# notes-windows.md

## enable wsl

```bash
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

## set wsl2 as default

```bash
wsl --update
wsl --set-default-version 2
```

## Import WSL 2

```bash
wsl --export Debian Debian-WSL.tar
wsl --import Debian Debian-WSL.tar
```

### Set default user

Using register key, then update the default user to be 1000 (aka e38 in hex)
Then update `DefaultUid` to `3e8` (aka 1000)

```
HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Lxss
```

## mount point

```bash
\\wsl$
```

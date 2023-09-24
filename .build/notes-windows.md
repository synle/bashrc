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

## mount point

```bash
\\wsl$
```

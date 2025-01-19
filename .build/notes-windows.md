# notes-windows.md

## Enable wsl

```bash
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

## set wsl2 as default

```bash
wsl --update
wsl --set-default-version 2
```

## Export WSL 2

```bash
wsl --export Debian Debian-WSL.tar
```

## Import WSL 2

```bash
wsl --import Debian . Debian-WSL.tar
```

### Set default user

Using regedit, and then update `DefaultUid` to `3e8` (aka 1000)

```bash
HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Lxss
> navigate to the UUID
```

## Disable Search Internet in Start Menu

```bash
HKEY_CURRENT_USER\Software\Policies\Microsoft\Windows
New Key => Explorer
HKEY_CURRENT_USER\Software\Policies\Microsoft\Windows\Explorer
New DWord 32 Bit => DisableSearchBoxSuggestions => 1
```

## mount point

```bash
\\wsl$
```

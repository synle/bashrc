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

## Make password last longer

```bash
Set-ADUser -Identity "Sy Le" -PasswordNeverExpires $true
Set-ADUser -Identity "syle" -PasswordNeverExpires $true
```

## Gamebar Registry hacks

https://www.reddit.com/r/Windows11/comments/wwc9if/comment/ilodbyj/
https://www.reddit.com/r/WindowsHelp/comments/1h2cagi/xbox_gamebar_windows_11_help_removing_get_an_app/

```bash
# Disable Xbox Game Bar using registry
$regPath = "HKCU:\Software\Microsoft\GameBar"
$regValue = "AllowGameBar"

# Check if the registry key exists
if (-not (Test-Path $regPath)) {
    New-Item -Path $regPath -Force
}

# Set the value to 0 to disable Game Bar
Set-ItemProperty -Path $regPath -Name $regValue -Value 0

# Disable Game Bar for all users (optional)
$regPathAllUsers = "HKLM:\Software\Microsoft\GameBar"
if (-not (Test-Path $regPathAllUsers)) {
    New-Item -Path $regPathAllUsers -Force
}
Set-ItemProperty -Path $regPathAllUsers -Name $regValue -Value 0


## AveYo: fix ms-gamebar annoyance after uninstalling Xbox
reg add HKCR\ms-gamebar /f /ve /d URL:ms-gamebar 2>&1 >''
reg add HKCR\ms-gamebar /f /v "URL Protocol" /d "" 2>&1 >''
reg add HKCR\ms-gamebar /f /v "NoOpenWith" /d "" 2>&1 >''
reg add HKCR\ms-gamebar\shell\open\command /f /ve /d "\`"$env:SystemRoot\System32\systray.exe\`"" 2>&1 >''
reg add HKCR\ms-gamebarservices /f /ve /d URL:ms-gamebarservices 2>&1 >''
reg add HKCR\ms-gamebarservices /f /v "URL Protocol" /d "" 2>&1 >''
reg add HKCR\ms-gamebarservices /f /v "NoOpenWith" /d "" 2>&1 >''
reg add HKCR\ms-gamebarservices\shell\open\command /f /ve /d "\`"$env:SystemRoot\System32\systray.exe\`"" 2>&1 >''
```

## mount point

```bash
\\wsl$
```

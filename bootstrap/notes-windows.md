# `notes-windows.md`

## Setting up Personal Folders

```ps1
# ==========================================
# Move Desktop, Documents, Downloads, Pictures
# to D:\Desktop, D:\Documents, D:\Downloads, D:\Pictures
# ==========================================

# Known Folder GUIDs → New Paths
$folders = @{
    '{B4BFCC3A-DB2C-424C-B029-7FE99A87C641}' = 'D:\Desktop'     # Desktop
    '{FDD39AD0-238F-46AF-ADB4-6C85480369C7}' = 'D:\Documents'   # Documents
    '{374DE290-123F-4565-9164-39C4925E467B}' = 'D:\Downloads'   # Downloads
    '{33E28130-4E1E-4676-835A-98395C3BC3BB}' = 'D:\Pictures'    # Pictures
}

# Registry locations
$userShellFolders = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders"
$shellFolders     = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders"

foreach ($guid in $folders.Keys) {

    $target = $folders[$guid]

    # Ensure the new target folder exists
    if (-not (Test-Path $target)) {
        Write-Host "Creating: $target"
        New-Item -ItemType Directory -Path $target -Force | Out-Null
    }

    # Determine current folder path
    switch ($guid) {
        '{B4BFCC3A-DB2C-424C-B029-7FE99A87C641}' { $current = "$HOME\Desktop" }
        '{FDD39AD0-238F-46AF-ADB4-6C85480369C7}' { $current = "$HOME\Documents" }
        '{374DE290-123F-4565-9164-39C4925E467B}' { $current = "$HOME\Downloads" }
        '{33E28130-4E1E-4676-835A-98395C3BC3BB}' { $current = "$HOME\Pictures" }
    }

    # Move documents if source exists
    if (Test-Path $current) {
        Write-Host "Moving: $current → $target"
        robocopy $current $target /MOVE /E | Out-Null
    } else {
        Write-Host "Skipping (missing): $current"
    }

    # Update the registry mappings
    Set-ItemProperty -Path $userShellFolders -Name $guid -Value $target
    Set-ItemProperty -Path $shellFolders     -Name $guid -Value $target

    Write-Host "Updated location for: $guid → $target"
}

Write-Host "`nDone! Please sign out and back in for full effect."
```

---

## WSL Mount Point

```bash
\\wsl$
```

## Enable WSL

```bash
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

## Set WSL2 as Default

```bash
wsl --update
wsl --set-default-version 2
```

## Export WSL2

```bash
wsl --export Debian Debian-WSL.tar
```

## Import WSL2

```bash
wsl --import Debian . Debian-WSL.tar
```

### Set Default WSL User

Use regedit and update `DefaultUid` to `3e8` (decimal 1000):

```
HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Lxss
→ pick the correct UUID entry
```

---

## Disable Internet Search in Start Menu

```bash
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Search" `
    -Name "BingSearchEnabled" -Value 0 -Type DWord

Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Search" `
    -Name "CortanaConsent" -Value 0 -Type DWord
```

---

## Make Password Never Expire

```bash
Set-ADUser -Identity "Sy Le" -PasswordNeverExpires $true
Set-ADUser -Identity "syle" -PasswordNeverExpires $true
```

---

## Game Bar Registry Hacks

```ps1
# ================================
#  DISABLE XBOX GAME BAR
# ================================
Write-Host "`nDisabling Xbox Game Bar..." -ForegroundColor Cyan

$gameBarKeys = @(
    "HKCU:\Software\Microsoft\GameBar",
    "HKCU:\System\GameConfigStore",
    "HKLM:\Software\Microsoft\GameBar",
    "HKLM:\System\GameConfigStore"
)

foreach ($key in $gameBarKeys) {
    if (-not (Test-Path $key)) {
        New-Item -Path $key -Force | Out-Null
    }

    # Disable Game Bar
    Set-ItemProperty -Path $key -Name AllowGameBar -Value 0 -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $key -Name AutoGameModeEnabled -Value 0 -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $key -Name GameDVR_Enabled -Value 0 -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $key -Name GameDVR_EnabledForGameBar -Value 0 -Force -ErrorAction SilentlyContinue
}

# Disable Game Bar service if present
$svc = Get-Service -Name "XblGameSave" -ErrorAction SilentlyContinue
if ($svc) {
    Stop-Service $svc -Force -ErrorAction SilentlyContinue
    Set-Service $svc -StartupType Disabled -ErrorAction SilentlyContinue
}

# Fix ms-gamebar URL handler annoyance (AveYo)
reg add HKCR\ms-gamebar /f /ve /d "URL:ms-gamebar" >'' 2>&1
reg add HKCR\ms-gamebar /f /v "URL Protocol" /d "" >'' 2>&1
reg add HKCR\ms-gamebar /f /v "NoOpenWith" /d "" >'' 2>&1
reg add HKCR\ms-gamebar\shell\open\command /f /ve /d "`"$env:SystemRoot\System32\systray.exe`"" >'' 2>&1

reg add HKCR\ms-gamebarservices /f /ve /d "URL:ms-gamebarservices" >'' 2>&1
reg add HKCR\ms-gamebarservices /f /v "URL Protocol" /d "" >'' 2>&1
reg add HKCR\ms-gamebarservices /f /v "NoOpenWith" /d "" >'' 2>&1
reg add HKCR\ms-gamebarservices\shell\open\command /f /ve /d "`"$env:SystemRoot\System32\systray.exe`"" >'' 2>&1

Write-Host "`nXbox Game Bar disabled successfully." -ForegroundColor Green
```

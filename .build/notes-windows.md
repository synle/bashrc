# `notes-windows.md`

## Move my home directory
```powershell
# ==========================================
# Move Desktop, Documents, and Downloads
# to D:\Desktop, D:\Documents, D:\Downloads
# ==========================================

# Known Folder GUIDs → New Paths
$folders = @{
    '{B4BFCC3A-DB2C-424C-B029-7FE99A87C641}' = 'D:\Desktop'     # Desktop
    '{FDD39AD0-238F-46AF-ADB4-6C85480369C7}' = 'D:\Documents'   # Documents
    '{374DE290-123F-4565-9164-39C4925E467B}' = 'D:\Downloads'   # Downloads
}

# Registry locations
$userShellFolders = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders"
$shellFolders     = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders"

foreach ($guid in $folders.Keys) {

    $target = $folders[$guid]

    # Ensure the target folder exists
    if (-not (Test-Path $target)) {
        Write-Host "Creating folder: $target"
        New-Item -ItemType Directory -Path $target -Force | Out-Null
    }

    # Determine current folder path based on GUID
    switch ($guid) {
        '{B4BFCC3A-DB2C-424C-B029-7FE99A87C641}' {  # Desktop
            $current = "$HOME\Desktop"
        }
        '{FDD39AD0-238F-46AF-ADB4-6C85480369C7}' {  # Documents
            $current = "$HOME\Documents"
        }
        '{374DE290-123F-4565-9164-39C4925E467B}' {  # Downloads
            $current = "$HOME\Downloads"
        }
    }

    # Move existing files (if the current folder exists)
    if (Test-Path $current) {
        Write-Host "Moving contents: $current → $target"
        robocopy $current $target /MOVE /E | Out-Null
    }
    else {
        Write-Host "Source does not exist, skipping move: $current"
    }

    # Update registry to point Windows to new folder
    Set-ItemProperty -Path $userShellFolders -Name $guid -Value $target
    Set-ItemProperty -Path $shellFolders     -Name $guid -Value $target

    Write-Host "Updated registry for: $guid → $target"
}

Write-Host "Complete. Log off and back in for changes to apply."
```

## Explorers / Prefrences
```powershell
# Set `Start_SearchFiles`
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "Start_SearchFiles" -Value 2

# Set `Hidden` (Show Hidden Files)
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "Hidden" -Value 2

# Set `ShowCompColor` (Show Component Colors)
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "ShowCompColor" -Value 1

# Set `WebView` (Enable WebView in Explorer)
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "WebView" -Value 1

# Set `ShowInfoTip` (Enable Tooltips in Explorer)
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "ShowInfoTip" -Value 1

# Disable `TaskbarAnimations`
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarAnimations" -Value 0

# Disable `TaskbarSizeMove` (Prevent Resizing/Moving of Taskbar)
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarSizeMove" -Value 0

# Disable `DisablePreviewDesktop`
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "DisablePreviewDesktop" -Value 1

# Set `TaskbarSmallIcons` (Use Regular Icons on Taskbar)
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarSmallIcons" -Value 0

# Hide `ShowTaskViewButton`
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "ShowTaskViewButton" -Value 0

# Disable `TaskbarBadges` (No Badges on Taskbar Icons)
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarBadges" -Value 0
```

## All-in-one setup Script

```powershell
# Make Password Never Expire
Set-ADUser -Identity "Sy Le" -PasswordNeverExpires $true
Set-ADUser -Identity "syle" -PasswordNeverExpires $true

# ================================
#  WSL SETUP
# ================================
wsl --update
wsl --set-default-version 2

# ================================
#  REMOVE BLOAT + PRIVACY HARDENING
# ================================
Write-Host "`nRemoving selected Windows bloatware..." -ForegroundColor Cyan

$appsToRemove = @(
    'Microsoft.3DViewer','Microsoft.GetHelp','Microsoft.MicrosoftEdge',
    'Microsoft.Office.OneNote','Microsoft.People','Microsoft.WindowsAlarms',
    'Microsoft.WindowsCalculator','Microsoft.WindowsCamera',
    'Microsoft.WindowsMaps','Microsoft.ZuneMusic','Microsoft.ZuneVideo'
)

$appsToRemove | ForEach-Object {
    Write-Host "Removing $_..."
    Get-AppxPackage -Name $_ -ErrorAction SilentlyContinue |
        Remove-AppxPackage -ErrorAction SilentlyContinue
}

# Disable Cortana + Web Search
Write-Host "`nDisabling Cortana and Start Menu web search..." -ForegroundColor Cyan

$explorerPolicy = "HKCU:\Software\Policies\Microsoft\Windows\Explorer"
if (-not (Test-Path $explorerPolicy)) {
    New-Item -Path $explorerPolicy -Force | Out-Null
}

Set-ItemProperty -Path $explorerPolicy -Name AllowCortana -Value 0 -Force
Set-ItemProperty -Path $explorerPolicy -Name DisableSearchBoxSuggestions -Value 1 -Force

Stop-Process -Name explorer -Force
Start-Process explorer.exe

Write-Host "Bloatware removed and search hardened." -ForegroundColor Green

# ================================
#  DEFENDER EXCLUSION
# ================================
Write-Host "`nAdding Defender exclusion..." -ForegroundColor Cyan
Add-MpPreference -ExclusionPath "C:\Program Files (x86)\Microsoft Office\Office14"
Write-Host "Defender exclusion added."

# ================================
#  FIREWALL BLOCK RULES
# ================================
function Add-BlockRuleIfMissing {
    param(
        [string]$DisplayName,
        [string]$Program,
        [string]$Description
    )

    if (-not (Get-NetFirewallRule -DisplayName $DisplayName -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $DisplayName -Program $Program `
            -Direction Outbound -Action Block -Profile Any -Description $Description | Out-Null
        Write-Host "Added: $DisplayName" -ForegroundColor Green
    } else {
        Write-Host "Exists: $DisplayName" -ForegroundColor Yellow
    }
}

# ---- Block Office14 executables ----
Write-Host "`nBlocking Office14 executables..." -ForegroundColor Cyan

$officePath = "C:\Program Files (x86)\Microsoft Office\Office14"
$officeApps = @(
    "WINWORD.EXE","EXCEL.EXE","POWERPNT.EXE","OUTLOOK.EXE",
    "MSACCESS.EXE","VISIO.EXE","OIS.EXE","SETLANG.EXE",
    "MSOSYNC.EXE","MSOUC.EXE","NAMECONTROLSERVER.EXE","GRAPH.EXE"
)

foreach ($app in $officeApps) {
    $fullPath = Join-Path $officePath $app
    if (Test-Path $fullPath) {
        Add-BlockRuleIfMissing "_Sy_BLOCK_Office14_$app" $fullPath "Block Office14 outbound: $app"
    }
}

# ---- Block all Adobe ----
Write-Host "`nBlocking Adobe executables..." -ForegroundColor Cyan

$AdobePaths = @(
    "$env:ProgramFiles\Adobe",
    "$env:ProgramFiles(x86)\Adobe",
    "$env:ProgramFiles\Common Files\Adobe",
    "$env:ProgramFiles(x86)\Common Files\Adobe"
)

$AdobeExeList = $AdobePaths |
    Where-Object { Test-Path $_ } |
    ForEach-Object { Get-ChildItem -Path $_ -Recurse -Filter *.exe -ErrorAction SilentlyContinue }

$idx = 1
foreach ($exe in $AdobeExeList) {
    $rule = "_Sy_BLOCK_Adobe_{0:D3}_$($exe.BaseName)" -f $idx
    Add-BlockRuleIfMissing $rule $exe.FullName "Block Adobe outbound"
    $idx++
}

Write-Host "`nAdobe and Office firewall blocks applied." -ForegroundColor Green

# ================================
#  HOSTS FILE BLOCKING
# ================================
Write-Host "`nUpdating HOSTS file..." -ForegroundColor Cyan

$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$entriesToAdd = @(
    "0.0.0.0 lmlicenses.wip4.adobe.com",
    "0.0.0.0 lm.licenses.adobe.com",
    "0.0.0.0 na1r.services.adobe.com",
    "0.0.0.0 hlrcv.stage.adobe.com",
    "0.0.0.0 practivate.adobe.com",
    "0.0.0.0 activate.adobe.com",
    "0.0.0.0 officecdn.microsoft.com",
    "0.0.0.0 officecdn.microsoft.com.edgesuite.net",
    "0.0.0.0 config.office.com",
    "0.0.0.0 odc.officeapps.live.com"
)

$currentHosts = Get-Content -Path $hostsPath

foreach ($entry in $entriesToAdd) {
    if ($currentHosts -notcontains $entry) {
        Write-Host "Adding: $entry"
        Add-Content -Path $hostsPath -Value $entry
    } else {
        Write-Host "Exists: $entry"
    }
    Start-Sleep -Seconds 1
}

Write-Host "`nHOSTS file updated." -ForegroundColor Green
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

```powershell

# ================================
#  DISABLE XBOX GAME BAR
# ================================
Write-Host "`nDisabling Xbox Game Bar..." -ForegroundColor Cyan

$gameBarKeys = @(
    "HKCU:\Software\Microsoft\GameBar",
    "HKLM:\Software\Microsoft\GameBar"
)

foreach ($key in $gameBarKeys) {
    if (-not (Test-Path $key)) {
        New-Item -Path $key -Force | Out-Null
    }
    Set-ItemProperty -Path $key -Name AllowGameBar -Value 0 -Force
}

# Fix ms-gamebar URL handler annoyance (AveYo)
reg add HKCR\ms-gamebar /f /ve /d URL:ms-gamebar >'' 2>&1
reg add HKCR\ms-gamebar /f /v "URL Protocol" /d "" >'' 2>&1
reg add HKCR\ms-gamebar /f /v "NoOpenWith" /d "" >'' 2>&1
reg add HKCR\ms-gamebar\shell\open\command /f /ve /d "`"$env:SystemRoot\System32\systray.exe`"" >'' 2>&1
reg add HKCR\ms-gamebarservices /f /ve /d URL:ms-gamebarservices >'' 2>&1
reg add HKCR\ms-gamebarservices /f /v "URL Protocol" /d "" >'' 2>&1
reg add HKCR\ms-gamebarservices /f /v "NoOpenWith" /d "" >'' 2>&1
reg add HKCR\ms-gamebarservices\shell\open\command /f /ve /d "`"$env:SystemRoot\System32\systray.exe`"" >'' 2>&1

Write-Host "`nSystem cleanup and hardening complete." -ForegroundColor Green
```

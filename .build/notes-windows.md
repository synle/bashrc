# `notes-windows.md`

## Setting up Personal Folders

```powershell
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

## Getting Started and  All-in-one setup Script
```powershell
# ================================
#  Regedit for Adobe Photoshop
# ================================

$regPath  = "HKCU:\Software\Adobe\CSXS.6"
$regName  = "PlayerDebugMode"
$regValue = "1"

If (!(Test-Path $regPath)) {
    New-Item -Path $regPath -Force | Out-Null
}

New-ItemProperty `
    -Path $regPath `
    -Name $regName `
    -Value $regValue `
    -PropertyType String `
    -Force

Write-Host "Registry value updated successfully."



# ================================
#  WINDOWS CLEANUP & PRIVACY HARDENING
# ================================

Write-Host "`n=== Windows Cleanup & Privacy Hardening ===" -ForegroundColor Cyan



# --------------------------------
# Remove Microsoft Bloatware
# --------------------------------

Write-Host "`nRemoving Microsoft bloatware apps..." -ForegroundColor Yellow

$appsToRemove = @(
    'Microsoft.3DViewer',
    'Microsoft.549981C3F5F10',              # Cortana
    'Microsoft.BingFinance',
    'Microsoft.BingNews',
    'Microsoft.BingSports',
    'Microsoft.BingWeather',
    'Microsoft.GamingApp',                  # Xbox (optional)
    'Microsoft.GetHelp',
    'Microsoft.Getstarted',
    'Microsoft.MicrosoftOfficeHub',
    'Microsoft.MicrosoftSolitaireCollection',
    'Microsoft.MicrosoftStickyNotes',
    'Microsoft.Office.OneNote',
    'Microsoft.People',
    'Microsoft.PowerAutomateDesktop',
    'Microsoft.SkypeApp',
    'Microsoft.Todos',
    'Microsoft.WindowsAlarms',
    'Microsoft.WindowsFeedbackHub',
    'Microsoft.WindowsMaps',
    'Microsoft.WindowsSoundRecorder',
    'Microsoft.Xbox.TCUI',
    'Microsoft.XboxGameOverlay',
    'Microsoft.XboxGamingOverlay',
    'Microsoft.XboxIdentityProvider',
    'Microsoft.XboxSpeechToTextOverlay',
    'Microsoft.YourPhone',
    'Microsoft.ZuneMusic',
    'Microsoft.ZuneVideo',
    'MicrosoftTeams',
    'Clipchamp.Clipchamp'
) | Sort-Object -Unique

foreach ($app in $appsToRemove) {
    Write-Host "Uninstalling: $app"
    Get-AppxPackage -Name $app -ErrorAction SilentlyContinue |
        Remove-AppxPackage -ErrorAction SilentlyContinue
}

Write-Host "App cleanup complete." -ForegroundColor Green



# --------------------------------
# Disable Cortana + Web Search
# --------------------------------

Write-Host "`nDisabling Cortana & Internet search suggestions..." -ForegroundColor Yellow

# Cortana
$paths = @(
    "HKCU:\Software\Policies\Microsoft\Windows\Explorer",
    "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Search"
)

foreach ($path in $paths) {
    if (-not (Test-Path $path)) {
        New-Item -Path $path -Force | Out-Null
    }
}

Set-ItemProperty -Path "HKCU:\Software\Policies\Microsoft\Windows\Explorer" -Name "AllowCortana" -Type DWord -Value 0 -Force
Set-ItemProperty -Path "HKCU:\Software\Policies\Microsoft\Windows\Explorer" -Name "DisableSearchBoxSuggestions" -Type DWord -Value 1 -Force
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Search" -Name "AllowCortana" -Type DWord -Value 0 -Force

# Disable widgets
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarDa" -Type DWord -Value 0 -Force

Write-Host "Cortana + Search hardened." -ForegroundColor Green

# --------------------------------
# Disable Windows Telemetry / Tracking
# --------------------------------

Write-Host "`nDisabling telemetry services & tasks..." -ForegroundColor Yellow

$telemetryKey = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection"
if (-not (Test-Path $telemetryKey)) {
    New-Item -Path $telemetryKey -Force | Out-Null
}

Set-ItemProperty -Path $telemetryKey -Name "AllowTelemetry" -Type DWord -Value 0

$services = @(
    "DiagTrack",
    "DmWappushService",
    "diagnosticshub.standardcollector.service"
)

foreach ($svc in $services) {
    Write-Host "Stopping + disabling: $svc"
    Stop-Service $svc -Force -ErrorAction SilentlyContinue
    Set-Service $svc -StartupType Disabled -ErrorAction SilentlyContinue
}

$scheduledTasks = @(
    "\Microsoft\Windows\Customer Experience Improvement Program\",
    "\Microsoft\Windows\Application Experience\",
    "\Microsoft\Windows\Autochk\",
    "\Microsoft\Windows\Feedback\"
)

foreach ($taskPath in $scheduledTasks) {
    try {
        Get-ScheduledTask -TaskPath $taskPath -ErrorAction Stop |
            Disable-ScheduledTask -ErrorAction SilentlyContinue
    } catch {}
}

Write-Host "Telemetry disabled." -ForegroundColor Green



# --------------------------------
# Disable Windows Recall (AI screenshot history)
# --------------------------------

Write-Host "`nDisabling Windows Recall..." -ForegroundColor Yellow

$recallKey = "HKLM:\Software\Policies\Microsoft\Windows\WindowsAI"
if (-not (Test-Path $recallKey)) {
    New-Item -Path $recallKey -Force | Out-Null
}

Set-ItemProperty -Path $recallKey -Name "DisableAIDataAnalysis" -Type DWord -Value 1
Set-ItemProperty -Path $recallKey -Name "DisableCapture" -Type DWord -Value 1

$recallServices = @(
    "Recall",
    "DesktopAIClientService",
    "RecallSnapshot"
)

foreach ($svc in $recallServices) {
    Stop-Service $svc -Force -ErrorAction SilentlyContinue
    Set-Service $svc -StartupType Disabled -ErrorAction SilentlyContinue
}

# Copilot
$copilotKey = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot"
if (-not (Test-Path $copilotKey)) {
    New-Item -Path $copilotKey -Force | Out-Null
}
Set-ItemProperty -Path $copilotKey -Name "TurnOffWindowsCopilot" -Type DWord -Value 1 -Force

# Hide Copilot button
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "ShowCopilotButton" -Type DWord -Value 0 -Force

# Recall / AI Data Analysis
$recallKey = "HKLM:\Software\Policies\Microsoft\Windows\WindowsAI"
if (-not (Test-Path $recallKey)) {
    New-Item -Path $recallKey -Force | Out-Null
}
Set-ItemProperty -Path $recallKey -Name "DisableAIDataAnalysis" -Type DWord -Value 1 -Force

# Timeline
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" -Name "EnableActivityFeed" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" -Name "PublishUserActivities" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" -Name "UploadUserActivities" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue



Write-Host "Recall disabled successfully." -ForegroundColor Green


# ================================================================================================
#  PERFORMANCE OPTIMIZATIONS
# ================================================================================================

Write-Host "`nApplying performance optimizations..." -ForegroundColor Yellow

# Disable visual effects for best performance
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" -Name "VisualFXSetting" -Type DWord -Value 2 -Force

# Disable animations
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop\WindowMetrics" -Name "MinAnimate" -Type String -Value "0" -Force
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarAnimations" -Type DWord -Value 0 -Force

# Disable transparency
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" -Name "EnableTransparency" -Type DWord -Value 0 -Force

# Optimize for programs (not background services)
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl" -Name "Win32PrioritySeparation" -Type DWord -Value 38 -Force

# Disable startup delay
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Serialize" -Name "StartupDelayInMSec" -Type DWord -Value 0 -Force

# Disable search indexing on C: drive (speeds up disk I/O)
# Note: This will slow down file searches
# Get-WmiObject -Class Win32_Volume -Filter "DriveLetter='C:'" | Set-WmiInstance -Arguments @{IndexingEnabled=$false} | Out-Null

# Disable hibernation to save disk space
powercfg /hibernate off

# Set power plan to High Performance
$powerPlan = powercfg /list | Select-String "High performance"
if ($powerPlan) {
    $planGUID = ($powerPlan -split '\s+')[3]
    powercfg /setactive $planGUID
}

# ================================
#  HOSTS FILE BLOCKING
# ================================

Write-Host "`nUpdating HOSTS file..." -ForegroundColor Cyan

$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$entriesToAdd = @(
    "0.0.0.0 lmlicenses.wip4.adobe.com",
    "0.0.0.0 lm.licenses.adobe.com",
    "0.0.0.0 activate.adobe.com",
    "0.0.0.0 practivate.adobe.com",
    "0.0.0.0 na1r.services.adobe.com",
    "0.0.0.0 officecdn.microsoft.com",
    "0.0.0.0 officecdn.microsoft.com.edgesuite.net",
    "0.0.0.0 config.office.com",
    "0.0.0.0 odc.officeapps.live.com",
    "0.0.0.0 vortex.data.microsoft.com",
    "0.0.0.0 telemetry.microsoft.com"
) | Sort-Object -Unique

$currentHosts = Get-Content -Path $hostsPath -ErrorAction SilentlyContinue

foreach ($entry in $entriesToAdd) {
    if ($currentHosts -notcontains $entry) {
        Write-Host "Adding: $entry"
        Add-Content -Path $hostsPath -Value $entry
    }
}

Write-Host "`nHOSTS file updated." -ForegroundColor Green



# ================================
#  DEFENDER EXCLUSION
# ================================

Write-Host "`nAdding Defender exclusion..." -ForegroundColor Cyan
Add-MpPreference -ExclusionPath "C:\Program Files (x86)\Microsoft Office\Office14"
Write-Host "Defender exclusion added."



# --------------------------------
# Disable Windows Copilot / Recall / Telemetry (reg add style)
# --------------------------------

Write-Host "`nApplying additional registry hardening..." -ForegroundColor Yellow

# --- COPILOT ---
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot" /v TurnOffWindowsCopilot /t REG_DWORD /d 1 /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot" /v CopilotAllowed /t REG_DWORD /d 0 /f
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v ShowCopilotButton /t REG_DWORD /d 0 /f

# --- RECALL ---
dism /online /disable-feature /featurename:Recall /norestart
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\System" /v DisableAIDataAnalysis /t REG_DWORD /d 1 /f

# --- TIMELINE ---
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\System" /v EnableActivityFeed /t REG_DWORD /d 0 /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\System" /v PublishUserActivities /t REG_DWORD /d 0 /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\System" /v UploadUserActivities /t REG_DWORD /d 0 /f

# --- EDGE ---
$edgeKey = "HKLM:\SOFTWARE\Policies\Microsoft\Edge"
if (-not (Test-Path $edgeKey)) {
    New-Item -Path $edgeKey -Force | Out-Null
}

Set-ItemProperty -Path $edgeKey -Name "HubsSidebarEnabled" -Type DWord -Value 0 -Force
Set-ItemProperty -Path $edgeKey -Name "EdgeCopilotEnabled" -Type DWord -Value 0 -Force
Set-ItemProperty -Path $edgeKey -Name "DiagnosticData" -Type DWord -Value 0 -Force
Set-ItemProperty -Path $edgeKey -Name "PersonalizationReportingEnabled" -Type DWord -Value 0 -Force
Set-ItemProperty -Path $edgeKey -Name "UserFeedbackAllowed" -Type DWord -Value 0 -Force
reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge" /v HubsSidebarEnabled /t REG_DWORD /d 0 /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge" /v EdgeCopilotEnabled /t REG_DWORD /d 0 /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge" /v DiagnosticData /t REG_DWORD /d 0 /f

# --- PREVENT UPDATE RE-ENABLE ---
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate" /v DisableWUfBSafeguards /t REG_DWORD /d 1 /f

Write-Host "`nSystem cleanup completed successfully!" -ForegroundColor Cyan
Write-Host "Log off or reboot required for some changes to apply." -ForegroundColor Yellow


# ================================================================================================
#  DISK CLEANUP & MAINTENANCE
# ================================================================================================

Write-Host "`nRunning disk cleanup..." -ForegroundColor Yellow

# Clean temp files
Remove-Item -Path "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Windows\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Windows\Prefetch\*" -Force -ErrorAction SilentlyContinue


# ================================
# Make Password Never Expire
# ================================

Set-ADUser -Identity "Sy Le" -PasswordNeverExpires $true
Set-ADUser -Identity "syle" -PasswordNeverExpires $true



# ================================
#  WSL SETUP
# ================================

wsl --update
wsl --set-default-version 2



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
#  winget upgrade
# ================================

winget upgrade --all

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

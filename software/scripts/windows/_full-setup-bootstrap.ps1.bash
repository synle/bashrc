#!/usr/bin/env pwsh
################################################################################
# windows/windows-bootstrap.ps1 - First-time Windows bootstrap: enables
# WSL, Virtual Machine Platform, installs winget, activates Windows,
# applies registry tweaks, privacy hardening, and system cleanup.
#
# Run this ONCE on a fresh Windows install (before windows.ps1).
# Run as Administrator:
# ----  Set-Executionpolicy Unrestricted -Scope Currentuser ----
# ----  .\Software\Bootstrap\Dependencies/Windows-Bootstrap.Ps1 ----
#
# Sections:
#   INITIAL SETUP
#     - Enable WSL and Virtual Machine Platform
#     - Install Winget
#     - Create D Drive Folders
#     - Activate Windows (MAS)
#   PROFILE & SYSTEM CONFIGURATION
#     - Create Powershell Script Profile
#     - Ntp Time Server
#   EXPLORER & UI TWEAKS
#     - Explorer Tweaks
#     - Personalization > Taskbar Settings
#     - Personalization > Start Menu Settings
#     - Personalization > Lock Screen Settings
#     - Personalization > Themes & Colors
#     - System > Notifications Settings
#     - System > Multitasking Settings
#     - System > Clipboard Settings
#     - System > Storage Settings
#     - Sound Settings
#   INPUT & ACCESSIBILITY TWEAKS
#     - Mouse & Keyboard Tweaks
#     - Devices > Typing Settings
#     - Gaming Settings
#     - Accessibility Settings
#   PRIVACY & SECURITY HARDENING
#     - Privacy Hardening
#     - Cortana & Web Search
#     - Edge Privacy (Legacy Uwp + Chromium)
#     - Game Dvr / Game Bar
#     - Telemetry / Tracking
#     - Windows Recall / Copilot / Timeline
#     - Windows Update Settings
#   PERFORMANCE OPTIMIZATIONS
#     - Performance Optimizations
#     - System Tweaks
#   CLEANUP & REMOVAL
#     - Remove Bloatware Apps
#     - Onedrive / Skydrive Removal
#     - Adobe Photoshop Debug Mode
#     - Restore Windows Photo Viewer (LTSC)
#   SECURITY & USER SETTINGS
#     - Defender Exclusion
#     - Password / User Settings
#   DISK CLEANUP (LAST)
#     - Clean Up macOS Junk Files
#     - Disk Cleanup
################################################################################

# Disable progress bars to speed up Invoke-WebRequest
$ProgressPreference = 'SilentlyContinue'



################################################################################
# ---- Enable WSL and Virtual Machine Platform ----
################################################################################

Write-Host "`n=== Enabling WSL and Virtual Machine Platform ===" -ForegroundColor Cyan

$needsRestart = $false

$wslFeature = (Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux).State
if ($wslFeature -ne "Enabled") {
    Write-Host "Enabling Windows Subsystem for Linux..."
    dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
    $needsRestart = $true
} else {
    Write-Host "Windows Subsystem for Linux is already enabled." -ForegroundColor Yellow
}

$vmFeature = (Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform).State
if ($vmFeature -ne "Enabled") {
    Write-Host "Enabling Virtual Machine Platform..."
    dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
    $needsRestart = $true
} else {
    Write-Host "Virtual Machine Platform is already enabled." -ForegroundColor Yellow
}

Write-Host "Running wsl --install to ensure WSL is installed..."
Write-Host "  wsl --install Ubuntu-24.04" -ForegroundColor White
wsl --install Ubuntu-24.04 --no-launch



################################################################################
# ---- Install Winget ----
################################################################################

$wingetInstalled = Get-Command winget -ErrorAction SilentlyContinue
if (-not $wingetInstalled) {
    Write-Host "`n=== Installing Winget ===" -ForegroundColor Cyan

    $wingetDepsDir = "$env:TEMP\winget-deps"
    if (Test-Path $wingetDepsDir) { Remove-Item -Recurse -Force $wingetDepsDir }
    New-Item -Path $wingetDepsDir -ItemType Directory -Force | Out-Null

    # Download and extract winget dependency packages
    Write-Host "Downloading winget dependency packages..."
    $depsZip = "$wingetDepsDir\DesktopAppInstaller_Dependencies.zip"
    Invoke-WebRequest -Uri "https://github.com/microsoft/winget-cli/releases/download/v1.28.220/DesktopAppInstaller_Dependencies.zip" -OutFile $depsZip
    Expand-Archive -Path $depsZip -DestinationPath $wingetDepsDir -Force

    # Install x64 dependencies
    Write-Host "Installing x64 dependency packages..."
    Get-ChildItem -Path "$wingetDepsDir\x64\*.appx" | ForEach-Object {
        Write-Host "  Installing $($_.Name)..."
        Add-AppxPackage $_.FullName -ErrorAction SilentlyContinue
    }

    # Download and install winget itself
    Write-Host "Downloading winget (Microsoft Desktop App Installer)..."
    $wingetBundle = "$wingetDepsDir\Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle"
    Invoke-WebRequest -Uri "https://github.com/microsoft/winget-cli/releases/download/v1.28.220/Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle" -OutFile $wingetBundle
    Write-Host "Installing winget..."
    Add-AppxPackage $wingetBundle

    # Cleanup
    if (Test-Path $wingetDepsDir) { Remove-Item -Recurse -Force $wingetDepsDir -ErrorAction SilentlyContinue }

    Write-Host "Winget installed." -ForegroundColor Green
} else {
    Write-Host "Winget is already installed." -ForegroundColor Yellow
}



################################################################################
# ---- Create D Drive Folders ----
################################################################################

if (Test-Path "D:\") {
    Write-Host "`n=== Creating folders on D:\ ===" -ForegroundColor Cyan
    $dDriveFolders = @("Applications", "Desktop", "Documents", "Downloads", "Games", "Pictures")
    foreach ($folder in $dDriveFolders) {
        $folderPath = "D:\$folder"
        if (Test-Path $folderPath) {
            Write-Host "  $folderPath already exists." -ForegroundColor Yellow
        } else {
            New-Item -Path $folderPath -ItemType Directory -Force | Out-Null
            Write-Host "  Created $folderPath" -ForegroundColor Green
        }
    }
} else {
    Write-Host "`nD:\ drive not found, skipping folder creation." -ForegroundColor Yellow
}


################################################################################
# ---- Activate Windows (MAS) ----
################################################################################

Write-Host "`nActivating Windows (MAS)..." -ForegroundColor Yellow
irm https://get.activated.win | iex



################################################################################
#                                                                              #
#                     PROFILE & SYSTEM CONFIGURATION                           #
#                                                                              #
################################################################################



################################################################################
# ---- Create Powershell Script Profile ----
################################################################################

if (!(Test-Path $profile)) {
    New-Item -Path $profile -Type File -Force
    Write-Host "Profile created."
} else {
    Write-Host "Profile already exists at $profile"
}

# Allow PowerShell profile scripts to run without prompts
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force



################################################################################
# ---- Ntp Time Server ----
################################################################################

$NtpServers = "time.cloudflare.com,0x8 time.google.com,0x8 time.windows.com,0x8"
w32tm /config /manualpeerlist:"$NtpServers" /syncfromflags:manual /update
Restart-Service w32time
w32tm /resync
Set-ItemProperty `
  -Path "HKLM:\SYSTEM\CurrentControlSet\Services\W32Time\Parameters" `
  -Name NtpServer `
  -Value $NtpServers
Restart-Service w32time



################################################################################
#                                                                              #
#                          EXPLORER & UI TWEAKS                                #
#                                                                              #
################################################################################



################################################################################
# ---- Explorer Tweaks ----
################################################################################

Write-Host "`n=== Applying Explorer Tweaks ===" -ForegroundColor Cyan

$explorerAdvanced = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced"

# Show hidden files and folders (1=show, 2=hide)
Set-ItemProperty -Path $explorerAdvanced -Name "Hidden" -Type DWord -Value 2 -Force
# Show file extensions (0=show extensions, 1=hide extensions)
Set-ItemProperty -Path $explorerAdvanced -Name "HideFileExt" -Type DWord -Value 0 -Force
# Show drives with no media (0=show, 1=hide)
Set-ItemProperty -Path $explorerAdvanced -Name "HideDrivesWithNoMedia" -Type DWord -Value 0 -Force
# Hide OneDrive sync provider notifications (0=hide, 1=show)
Set-ItemProperty -Path $explorerAdvanced -Name "ShowSyncProviderNotifications" -Type DWord -Value 0 -Force
# Disable Aero-Shake minimize (0=enabled, 1=disabled)
Set-ItemProperty -Path $explorerAdvanced -Name "DisallowShaking" -Type DWord -Value 1 -Force
# Set default Explorer view to This PC (1=This PC, 2=Quick Access, 3=Downloads)
Set-ItemProperty -Path $explorerAdvanced -Name "LaunchTo" -Type DWord -Value 1 -Force

# Disable Edge desktop shortcut on new profiles (0=enabled, 1=disabled)
New-ItemProperty -Path "HKLM:\Software\Microsoft\Windows\CurrentVersion\Explorer" `
    -Name "DisableEdgeDesktopShortcutCreation" -PropertyType DWORD -Value 1 -Force -ErrorAction SilentlyContinue

# Disable Zone.Identifier files (NTFS alternate data streams) (1=disable zone info, 2=enable zone info)
# Prevents Windows from tagging downloaded files, which WSL exposes as *:Zone.Identifier files
@(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\Attachments",
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Attachments"
) | ForEach-Object {
    if (-not (Test-Path $_)) { New-Item -Path $_ -Force | Out-Null }
    Set-ItemProperty -Path $_ -Name "SaveZoneInformation" -Type DWord -Value 1 -Force
}

# Restore old volume slider (0=old horizontal slider, 1=new vertical slider)
$mtcuvcPath = "HKLM:\Software\Microsoft\Windows NT\CurrentVersion\MTCUVC"
if (-not (Test-Path $mtcuvcPath)) { New-Item -Path $mtcuvcPath -Force | Out-Null }
Set-ItemProperty -Path $mtcuvcPath -Name "EnableMtcUvc" -Type DWord -Value 0 -Force

# Remove clutter folders from This PC (Music, Videos, 3D Objects)
$folderGuids = @(
    "{1CF1260C-4DD0-4ebb-811F-33C572699FDE}",  # Music
    "{3dfdf296-dbec-4fb4-81d1-6a3438bcf4de}",  # Music (alternate)
    "{A0953C92-50DC-43bf-BE83-3742FED03C9C}",  # Videos
    "{f86fa3ab-70d2-4fc7-9c99-fcbf05467f3a}",  # Videos (alternate)
    "{0DB7E03F-FC29-4DC6-9020-FF41B59E513A}"   # 3D Objects
)
foreach ($guid in $folderGuids) {
    @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\MyComputer\NameSpace\$guid",
        "HKLM:\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Explorer\MyComputer\NameSpace\$guid"
    ) | ForEach-Object { Remove-Item -Path $_ -ErrorAction SilentlyContinue }
}

# Disable recent files and frequent folders in Quick Access sidebar (0=hide, 1=show)
Set-ItemProperty -Path $explorerAdvanced -Name "ShowRecent" -Type DWord -Value 0 -Force
Set-ItemProperty -Path $explorerAdvanced -Name "ShowFrequent" -Type DWord -Value 0 -Force

# Always show file transfer details dialog (speed, items remaining, throughput graph)
$opsStatusPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\OperationStatusManager"
if (-not (Test-Path $opsStatusPath)) { New-Item -Path $opsStatusPath -Force | Out-Null }
Set-ItemProperty -Path $opsStatusPath -Name "EnthusiastMode" -Type DWord -Value 1 -Force

Write-Host "Explorer tweaks applied." -ForegroundColor Green



################################################################################
# ---- Personalization > Taskbar Settings ----
################################################################################

Write-Host "`n=== Applying Taskbar Settings ===" -ForegroundColor Cyan

$taskbarPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced"

# Hide Search box from taskbar (0=hidden, 1=icon, 2=search box)
try { Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Search" -Name "SearchboxTaskbarMode" -Type DWord -Value 0 -Force }
catch { Write-Host "  Skipped: SearchboxTaskbarMode - $_" -ForegroundColor Yellow }

# Hide Widgets button (0=hide, 1=show)
try { Set-ItemProperty -Path $taskbarPath -Name "TaskbarDa" -Type DWord -Value 0 -Force }
catch { Write-Host "  Skipped: TaskbarDa - $_" -ForegroundColor Yellow }

# Hide Chat (Teams) button (0=hide, 1=show)
try { Set-ItemProperty -Path $taskbarPath -Name "TaskbarMn" -Type DWord -Value 0 -Force }
catch { Write-Host "  Skipped: TaskbarMn - $_" -ForegroundColor Yellow }

# Hide Task View button (0=hide, 1=show)
try { Set-ItemProperty -Path $taskbarPath -Name "ShowTaskViewButton" -Type DWord -Value 0 -Force }
catch { Write-Host "  Skipped: ShowTaskViewButton - $_" -ForegroundColor Yellow }

# Hide Copilot button (0=hide, 1=show)
try { Set-ItemProperty -Path $taskbarPath -Name "ShowCopilotButton" -Type DWord -Value 0 -Force }
catch { Write-Host "  Skipped: ShowCopilotButton - $_" -ForegroundColor Yellow }

# Taskbar alignment: Center (0=Left, 1=Center)
try { Set-ItemProperty -Path $taskbarPath -Name "TaskbarAl" -Type DWord -Value 1 -Force }
catch { Write-Host "  Skipped: TaskbarAl - $_" -ForegroundColor Yellow }

# Hide recently opened items in Start, Jump Lists, and File Explorer (0=hide, 1=show)
try { Set-ItemProperty -Path $taskbarPath -Name "Start_TrackDocs" -Type DWord -Value 0 -Force }
catch { Write-Host "  Skipped: Start_TrackDocs - $_" -ForegroundColor Yellow }

# Auto-hide taskbar (disabled by default, uncomment to enable)
# Byte 8 of Settings binary: 0x02 = auto-hide on, 0x03 = auto-hide off (default)
# $stuckRects = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3"
# $settings = (Get-ItemProperty -Path $stuckRects -Name "Settings").Settings
# $settings[8] = 0x02
# Set-ItemProperty -Path $stuckRects -Name "Settings" -Type Binary -Value $settings

# Never combine taskbar buttons (0=always combine, 1=when full, 2=never)
try { Set-ItemProperty -Path $taskbarPath -Name "TaskbarGlomLevel" -Type DWord -Value 0 -Force }
catch { Write-Host "  Skipped: TaskbarGlomLevel - $_" -ForegroundColor Yellow }

# Show labels on taskbar buttons (0=large icons with labels, 1=small icons no labels)
try { Set-ItemProperty -Path $taskbarPath -Name "TaskbarSmallIcons" -Type DWord -Value 1 -Force }
catch { Write-Host "  Skipped: TaskbarSmallIcons - $_" -ForegroundColor Yellow }

# Enable "End Task" in taskbar right-click context menu (Win11 only, force-kills apps without Task Manager)
try { Set-ItemProperty -Path $taskbarPath -Name "TaskbarEndTask" -Type DWord -Value 1 -Force }
catch { Write-Host "  Skipped: TaskbarEndTask - $_" -ForegroundColor Yellow }

# Show seconds in taskbar clock (0=hide, 1=show)
try { Set-ItemProperty -Path $taskbarPath -Name "ShowSecondsInSystemClock" -Type DWord -Value 1 -Force }
catch { Write-Host "  Skipped: ShowSecondsInSystemClock - $_" -ForegroundColor Yellow }

Write-Host "Taskbar settings applied." -ForegroundColor Green



################################################################################
# ---- Personalization > Start Menu Settings ----
################################################################################

Write-Host "`n=== Applying Start Menu Settings ===" -ForegroundColor Cyan

# Disable "Show recently added apps"
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-338388Enabled" -Type DWord -Value 0 -Force

# Disable "Show most used apps"
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "Start_TrackProgs" -Type DWord -Value 0 -Force

# Disable "Show suggestions and tips on Start" (recommendations)
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "Start_IrisRecommendations" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue

Write-Host "Start menu settings applied." -ForegroundColor Green



################################################################################
# ---- Personalization > Lock Screen Settings ----
################################################################################

Write-Host "`n=== Applying Lock Screen Settings ===" -ForegroundColor Cyan

# Disable Windows Spotlight on lock screen (use picture instead)
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "RotatingLockScreenEnabled" -Type DWord -Value 0 -Force
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "RotatingLockScreenOverlayEnabled" -Type DWord -Value 0 -Force

# Disable "Get fun facts, tips, and more" on lock screen
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-338387Enabled" -Type DWord -Value 0 -Force

# Disable lock screen tips
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-338393Enabled" -Type DWord -Value 0 -Force

Write-Host "Lock screen settings applied." -ForegroundColor Green



################################################################################
# ---- Personalization > Themes & Colors ----
################################################################################

Write-Host "`n=== Applying Theme Settings ===" -ForegroundColor Cyan

$personalizePath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"

# Enable dark mode for apps
Set-ItemProperty -Path $personalizePath -Name "AppsUseLightTheme" -Type DWord -Value 0 -Force

# Enable dark mode for system (taskbar, Start, etc.)
Set-ItemProperty -Path $personalizePath -Name "SystemUsesLightTheme" -Type DWord -Value 0 -Force

# Show accent color on title bars and window borders
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\DWM" -Name "ColorPrevalence" -Type DWord -Value 1 -Force

Write-Host "Theme settings applied." -ForegroundColor Green



################################################################################
# ---- System > Notifications Settings ----
################################################################################

Write-Host "`n=== Applying Notification Settings ===" -ForegroundColor Cyan

$notifPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\PushNotifications"
if (-not (Test-Path $notifPath)) { New-Item -Path $notifPath -Force | Out-Null }

# Disable toast notifications from apps
Set-ItemProperty -Path $notifPath -Name "ToastEnabled" -Type DWord -Value 0 -Force

# Disable lock screen notifications
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings" -Name "NOC_GLOBAL_SETTING_ALLOW_TOASTS_ABOVE_LOCK" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings" -Name "NOC_GLOBAL_SETTING_ALLOW_CRITICAL_TOASTS_ABOVE_LOCK" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue

# Disable notification sounds
$notifSettingsPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings"
if (-not (Test-Path $notifSettingsPath)) { New-Item -Path $notifSettingsPath -Force | Out-Null }
Set-ItemProperty -Path $notifSettingsPath -Name "NOC_GLOBAL_SETTING_ALLOW_NOTIFICATION_SOUND" -Type DWord -Value 0 -Force

# Disable "Get tips and suggestions when using Windows"
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-338389Enabled" -Type DWord -Value 0 -Force

# Disable "Suggest ways to get the most out of Windows"
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-310093Enabled" -Type DWord -Value 0 -Force

# Disable "Show me the Windows welcome experience"
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-310091Enabled" -Type DWord -Value 0 -Force

Write-Host "Notification settings applied." -ForegroundColor Green



################################################################################
# ---- System > Multitasking Settings ----
################################################################################

Write-Host "`n=== Applying Multitasking Settings ===" -ForegroundColor Cyan

$explorerAdvancedPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced"

# Disable Snap Assist suggestions (don't show what to snap next to a window)
Set-ItemProperty -Path $explorerAdvancedPath -Name "SnapAssist" -Type DWord -Value 0 -Force

# Disable "When I snap a window, show what I can snap next to it"
Set-ItemProperty -Path $explorerAdvancedPath -Name "DITest" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue

# Alt+Tab: show only open windows (not Edge tabs)
Set-ItemProperty -Path $explorerAdvancedPath -Name "MultiTaskingAltTabFilter" -Type DWord -Value 3 -Force

# Disable "Show snap layouts when I hover over a window's maximize button"
Set-ItemProperty -Path $explorerAdvancedPath -Name "EnableSnapAssistFlyout" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue

# Disable "Show snap layouts when I drag a window to the top of my screen"
Set-ItemProperty -Path $explorerAdvancedPath -Name "EnableSnapBar" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue

Write-Host "Multitasking settings applied." -ForegroundColor Green



################################################################################
# ---- System > Clipboard Settings ----
################################################################################

Write-Host "`n=== Applying Clipboard Settings ===" -ForegroundColor Cyan

# Enable clipboard history (Win+V)
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Clipboard" -Name "EnableClipboardHistory" -Type DWord -Value 1 -Force

# Disable clipboard sync across devices
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Clipboard" -Name "EnableCloudClipboard" -Type DWord -Value 0 -Force

Write-Host "Clipboard settings applied." -ForegroundColor Green



################################################################################
# ---- System > Storage Settings ----
################################################################################

Write-Host "`n=== Applying Storage Settings ===" -ForegroundColor Cyan

# Disable Storage Sense (automatic cleanup)
$storageSensePath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\StorageSense\Parameters\StoragePolicy"
if (-not (Test-Path $storageSensePath)) { New-Item -Path $storageSensePath -Force | Out-Null }
Set-ItemProperty -Path $storageSensePath -Name "01" -Type DWord -Value 0 -Force

Write-Host "Storage settings applied." -ForegroundColor Green



################################################################################
# ---- Sound Settings ----
################################################################################

Write-Host "`n=== Applying Sound Settings ===" -ForegroundColor Cyan

# Disable Windows startup sound
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Authentication\LogonUI\BootAnimation" -Name "DisableStartupSound" -Type DWord -Value 1 -Force -ErrorAction SilentlyContinue

# Set sound scheme to "No Sounds"
Set-ItemProperty -Path "HKCU:\AppEvents\Schemes" -Name "(Default)" -Value ".None" -Force

Write-Host "Sound settings applied." -ForegroundColor Green



################################################################################
#                                                                              #
#                     INPUT & ACCESSIBILITY TWEAKS                             #
#                                                                              #
################################################################################



################################################################################
# ---- Mouse & Keyboard Tweaks ----
################################################################################

Write-Host "`n=== Applying Mouse & Keyboard Tweaks ===" -ForegroundColor Cyan

# MarkC mouse acceleration fix (for 100% DPI)
Set-ItemProperty -Path "HKCU:\Control Panel\Mouse" -Name "MouseSensitivity" -Value "10" -Force
Set-ItemProperty -Path "HKCU:\Control Panel\Mouse" -Name "MouseSpeed" -Value "0" -Force
Set-ItemProperty -Path "HKCU:\Control Panel\Mouse" -Name "MouseThreshold1" -Value "0" -Force
Set-ItemProperty -Path "HKCU:\Control Panel\Mouse" -Name "MouseThreshold2" -Value "0" -Force
Set-ItemProperty -Path "HKCU:\Control Panel\Mouse" -Name "SmoothMouseXCurve" ([byte[]](0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0xC0, 0xCC, 0x0C, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x80, 0x99, 0x19, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x66, 0x26, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x33, 0x33, 0x00, 0x00, 0x00, 0x00, 0x00))
Set-ItemProperty -Path "HKCU:\Control Panel\Mouse" -Name "SmoothMouseYCurve" ([byte[]](0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x38, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x70, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xA8, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0xE0, 0x00, 0x00, 0x00, 0x00, 0x00))

# Disable mouse pointer hiding
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "UserPreferencesMask" ([byte[]](0x9e,
    0x1e, 0x06, 0x80, 0x12, 0x00, 0x00, 0x00))

# Disable Sticky Keys, Filter Keys, Toggle Keys shortcuts
Set-ItemProperty -Path "HKCU:\Control Panel\Accessibility\StickyKeys" -Name "Flags" -Value "506" -Force
Set-ItemProperty -Path "HKCU:\Control Panel\Accessibility\Keyboard Response" -Name "Flags" -Value "122" -Force
Set-ItemProperty -Path "HKCU:\Control Panel\Accessibility\ToggleKeys" -Name "Flags" -Value "58" -Force

Write-Host "Mouse & Keyboard tweaks applied." -ForegroundColor Green



################################################################################
# ---- Devices > Typing Settings ----
################################################################################

Write-Host "`n=== Applying Typing Settings ===" -ForegroundColor Cyan

# Disable autocorrect
Set-ItemProperty -Path "HKCU:\Software\Microsoft\TabletTip\1.7" -Name "EnableAutocorrection" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue

# Disable text suggestions when typing on hardware keyboard
Set-ItemProperty -Path "HKCU:\Software\Microsoft\TabletTip\1.7" -Name "EnableTextPrediction" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue

# Disable highlight misspelled words
Set-ItemProperty -Path "HKCU:\Software\Microsoft\TabletTip\1.7" -Name "EnableSpellchecking" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue

# Disable typing insights
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Input\Settings" -Name "InsightsEnabled" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue

Write-Host "Typing settings applied." -ForegroundColor Green



################################################################################
# ---- Gaming Settings ----
################################################################################

Write-Host "`n=== Applying Gaming Settings ===" -ForegroundColor Cyan

# Disable Game Mode
Set-ItemProperty -Path "HKCU:\Software\Microsoft\GameBar" -Name "AllowAutoGameMode" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKCU:\Software\Microsoft\GameBar" -Name "AutoGameModeEnabled" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue

# Disable Game Bar tips
Set-ItemProperty -Path "HKCU:\Software\Microsoft\GameBar" -Name "ShowStartupPanel" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue

# Disable "Open Xbox Game Bar using this button on a controller"
Set-ItemProperty -Path "HKCU:\Software\Microsoft\GameBar" -Name "UseNexusForGameBarEnabled" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue

Write-Host "Gaming settings applied." -ForegroundColor Green



################################################################################
# ---- Accessibility Settings ----
################################################################################

Write-Host "`n=== Applying Accessibility Settings ===" -ForegroundColor Cyan

# Disable Narrator auto-start
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Narrator\NoRoam" -Name "WinEnterLaunchEnabled" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue

# Disable Magnifier auto-start
Set-ItemProperty -Path "HKCU:\Software\Microsoft\ScreenMagnifier" -Name "FollowMouse" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue

Write-Host "Accessibility settings applied." -ForegroundColor Green



################################################################################
#                                                                              #
#                     PRIVACY & SECURITY HARDENING                             #
#                                                                              #
################################################################################



################################################################################
# ---- Privacy Hardening ----
################################################################################

Write-Host "`n=== Applying Privacy Settings ===" -ForegroundColor Cyan

# Stop sending typing/writing data to Microsoft
$tipcKey = "HKCU:\SOFTWARE\Microsoft\Input\TIPC"
if (-not (Test-Path $tipcKey)) { New-Item -Path $tipcKey -Force | Out-Null }
Set-ItemProperty -Path $tipcKey -Name "Enabled" -Type DWord -Value 0 -Force

# Stop apps from using advertising ID for cross-app ad targeting
$adInfoKey = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\AdvertisingInfo"
if (-not (Test-Path $adInfoKey)) { New-Item -Path $adInfoKey -Force | Out-Null }
Set-ItemProperty -Path $adInfoKey -Name "Enabled" -Type DWord -Value 0 -Force

# Stop sending speech, inking and typing samples to MS (Cortana personalization)
$personKey = "HKCU:\SOFTWARE\Microsoft\Personalization\Settings"
if (-not (Test-Path $personKey)) { New-Item -Path $personKey -Force | Out-Null }
Set-ItemProperty -Path $personKey -Name "AcceptedPrivacyPolicy" -Type DWord -Value 0 -Force

# Stop scanning contacts and sending them to Microsoft
$trainKey = "HKCU:\SOFTWARE\Microsoft\InputPersonalization\TrainedDataStore"
if (-not (Test-Path $trainKey)) { New-Item -Path $trainKey -Force | Out-Null }
Set-ItemProperty -Path $trainKey -Name "HarvestContacts" -Type DWord -Value 0 -Force

# Prevent websites from accessing your language list
Set-ItemProperty -Path "HKCU:\Control Panel\International\User Profile" -Name "HttpAcceptLanguageOptOut" -Type DWord -Value 1 -Force

# Disable network-based default printer switching
$printerKey = "HKCU:\Printers\Defaults"
if (-not (Test-Path $printerKey)) { New-Item -Path $printerKey -Force | Out-Null }
Set-ItemProperty -Path $printerKey -Name "NetID" -Value "{00000000-0000-0000-0000-000000000000}" -Force

# Block implicit ink and text data collection
$inputKey = "HKCU:\SOFTWARE\Microsoft\InputPersonalization"
if (-not (Test-Path $inputKey)) { New-Item -Path $inputKey -Force | Out-Null }
Set-ItemProperty -Path $inputKey -Name "RestrictImplicitInkCollection" -Type DWord -Value 1 -Force
Set-ItemProperty -Path $inputKey -Name "RestrictImplicitTextCollection" -Type DWord -Value 1 -Force

# Never prompt for Windows feedback
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "FeedbackFrequency" -Type DWord -Value 0 -Force

# UNSAFE: Disable SmartScreen URL checking (sends URLs to Microsoft)
# WARNING: This reduces phishing/malware protection. Only disable if you use a third-party security suite.
Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppHost" -Name "EnableWebContentEvaluation" -Type DWord -Value 0 -Force

# Disable synchronisation of settings (only applies with Microsoft account login)
$syncPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\SettingSync"
Set-ItemProperty -Path $syncPath -Name "BackupPolicy" -Type DWord -Value 0x3c -Force -ErrorAction SilentlyContinue
Set-ItemProperty -Path $syncPath -Name "DeviceMetadataUploaded" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue
Set-ItemProperty -Path $syncPath -Name "PriorLogons" -Type DWord -Value 1 -Force -ErrorAction SilentlyContinue

$syncGroups = @("Accessibility","AppSync","BrowserSettings","Credentials","DesktopTheme",
    "Language","PackageState","Personalization","StartLayout","Windows")
foreach ($group in $syncGroups) {
    $groupPath = "$syncPath\Groups\$group"
    if (-not (Test-Path $groupPath)) { New-Item -Path $groupPath -Force | Out-Null }
    Set-ItemProperty -Path $groupPath -Name "Enabled" -Type DWord -Value 0 -Force
}

# Disable background access of default apps
foreach ($key in (Get-ChildItem "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications" -ErrorAction SilentlyContinue)) {
    Set-ItemProperty -Path ("HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications\" + $key.PSChildName) "Disabled" 1 -ErrorAction SilentlyContinue
}

# Deny device access (disable sharing info with unpaired devices)
$deviceGlobalPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\DeviceAccess\Global"
$looselyPath = "$deviceGlobalPath\LooselyCoupled"
Set-ItemProperty -Path $looselyPath -Name "Type" -Value "LooselyCoupled" -Force -ErrorAction SilentlyContinue
Set-ItemProperty -Path $looselyPath -Name "Value" -Value "Deny" -Force -ErrorAction SilentlyContinue
Set-ItemProperty -Path $looselyPath -Name "InitialAppValue" -Value "Unspecified" -Force -ErrorAction SilentlyContinue
foreach ($key in (Get-ChildItem $deviceGlobalPath -ErrorAction SilentlyContinue)) {
    if ($key.PSChildName -EQ "LooselyCoupled") { continue }
    $keyPath = "$deviceGlobalPath\$($key.PSChildName)"
    Set-ItemProperty -Path $keyPath -Name "Type" -Value "InterfaceClass" -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $keyPath -Name "Value" -Value "Deny" -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $keyPath -Name "InitialAppValue" -Value "Unspecified" -Force -ErrorAction SilentlyContinue
}

# Disable location sensor
$locationPath = "HKCU:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Sensor\Permissions\{BFA794E4-F964-4FDB-90F6-51056BFE4B44}"
if (-not (Test-Path $locationPath)) { New-Item -Path $locationPath -Force | Out-Null }
Set-ItemProperty -Path $locationPath -Name "SensorPermissionState" -Type DWord -Value 0 -Force

# UNSAFE: Disable Windows Defender sample submission
# WARNING: This stops Defender from uploading suspicious files to Microsoft for analysis.
# Only disable if you use a third-party antivirus.
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows Defender\Spynet" -Name "SpyNetReporting" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows Defender\Spynet" -Name "SubmitSamplesConsent" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue

Write-Host "Privacy settings applied." -ForegroundColor Green



################################################################################
# ---- Cortana & Web Search ----
################################################################################

Write-Host "`n=== Disabling Cortana & Web Search ===" -ForegroundColor Cyan

$cortanaPaths = @(
    "HKCU:\Software\Policies\Microsoft\Windows\Explorer",
    "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Search",
    "HKLM:\Software\Policies\Microsoft\Windows\Explorer"
)
foreach ($path in $cortanaPaths) {
    if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
}

Set-ItemProperty -Path "HKCU:\Software\Policies\Microsoft\Windows\Explorer" -Name "AllowCortana" -Type DWord -Value 0 -Force
Set-ItemProperty -Path "HKCU:\Software\Policies\Microsoft\Windows\Explorer" -Name "DisableSearchBoxSuggestions" -Type DWord -Value 1 -Force
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Search" -Name "AllowCortana" -Type DWord -Value 0 -Force
Set-ItemProperty -Path "HKLM:\Software\Policies\Microsoft\Windows\Explorer" -Name "DisableSearchBoxSuggestions" -Type DWord -Value 1 -Force

# Disable web results in Windows Search
Set-WindowsSearchSetting -EnableWebResultsSetting $false -ErrorAction SilentlyContinue

Write-Host "Cortana & Search hardened." -ForegroundColor Green



################################################################################
# ---- Edge Privacy (Legacy Uwp + Chromium) ----
################################################################################

Write-Host "`n=== Applying Edge Privacy Settings ===" -ForegroundColor Cyan

# --- Legacy Edge UWP ---
$edgeBase = "HKCU:\SOFTWARE\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppContainer\Storage\microsoft.microsoftedge_8wekyb3d8bbwe\MicrosoftEdge"

$edgePaths = @{
    "$edgeBase\Main"                        = @{ "DoNotTrack" = 1 }
    "$edgeBase\User\Default\SearchScopes"   = @{ "ShowSearchSuggestionsGlobal" = 0 }
    "$edgeBase\FlipAhead"                   = @{ "FPEnabled" = 0 }
    "$edgeBase\PhishingFilter"              = @{ "EnabledV9" = 0 }
}

foreach ($path in $edgePaths.Keys) {
    if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
    foreach ($name in $edgePaths[$path].Keys) {
        Set-ItemProperty -Path $path -Name $name -Type DWord -Value $edgePaths[$path][$name] -Force
    }
}

# --- Edge Chromium policies ---
$edgeKey = "HKLM:\SOFTWARE\Policies\Microsoft\Edge"
if (-not (Test-Path $edgeKey)) { New-Item -Path $edgeKey -Force | Out-Null }
Set-ItemProperty -Path $edgeKey -Name "HubsSidebarEnabled" -Type DWord -Value 0 -Force
Set-ItemProperty -Path $edgeKey -Name "EdgeCopilotEnabled" -Type DWord -Value 0 -Force
Set-ItemProperty -Path $edgeKey -Name "DiagnosticData" -Type DWord -Value 0 -Force
Set-ItemProperty -Path $edgeKey -Name "PersonalizationReportingEnabled" -Type DWord -Value 0 -Force
Set-ItemProperty -Path $edgeKey -Name "UserFeedbackAllowed" -Type DWord -Value 0 -Force

# reg add fallbacks
reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge" /v HubsSidebarEnabled /t REG_DWORD /d 0 /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge" /v EdgeCopilotEnabled /t REG_DWORD /d 0 /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge" /v DiagnosticData /t REG_DWORD /d 0 /f

Write-Host "Edge privacy applied." -ForegroundColor Green



################################################################################
# ---- Game Dvr / Game Bar ----
################################################################################

Write-Host "`n=== Disabling Game DVR ===" -ForegroundColor Cyan

$gameDvrKey = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\GameDVR"
if (-not (Test-Path $gameDvrKey)) { New-Item -Path $gameDvrKey -Force | Out-Null }
Set-ItemProperty -Path $gameDvrKey -Name "AppCaptureEnabled" -Type DWord -Value 0 -Force
Set-ItemProperty -Path $gameDvrKey -Name "AllowGameDVR" -Type DWord -Value 0 -Force

Write-Host "Game DVR disabled." -ForegroundColor Green



################################################################################
# ---- Telemetry / Tracking ----
################################################################################

Write-Host "`n=== Disabling Telemetry ===" -ForegroundColor Cyan

$telemetryKey = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection"
if (-not (Test-Path $telemetryKey)) { New-Item -Path $telemetryKey -Force | Out-Null }
Set-ItemProperty -Path $telemetryKey -Name "AllowTelemetry" -Type DWord -Value 0

# Disable telemetry services
$services = @(
    "DiagTrack",                                  # Connected User Experiences and Telemetry
    "DmWappushService",                           # WAP Push Message Routing (telemetry relay)
    "diagnosticshub.standardcollector.service"     # Diagnostics Hub data collector
)
foreach ($svc in $services) {
    Write-Host "Stopping + disabling: $svc"
    Stop-Service $svc -Force -ErrorAction SilentlyContinue
    Set-Service $svc -StartupType Disabled -ErrorAction SilentlyContinue
}

# Disable telemetry scheduled tasks
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

# Disable specific Application Experience tasks
$appExpTasks = @(
    "\Microsoft\Windows\Application Experience\Microsoft Compatibility Appraiser",
    "\Microsoft\Windows\Application Experience\ProgramDataUpdater",
    "\Microsoft\Windows\Application Experience\StartupAppTask",
    "\Microsoft\Windows\Application Experience\PcaPatchDbTask"
)
foreach ($task in $appExpTasks) {
    Disable-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue
}

Write-Host "Telemetry disabled." -ForegroundColor Green



################################################################################
# ---- Windows Recall / Copilot / Timeline ----
################################################################################

Write-Host "`n=== Disabling Recall, Copilot & Timeline ===" -ForegroundColor Cyan

# --- Recall ---
$recallKey = "HKLM:\Software\Policies\Microsoft\Windows\WindowsAI"
if (-not (Test-Path $recallKey)) { New-Item -Path $recallKey -Force | Out-Null }
Set-ItemProperty -Path $recallKey -Name "DisableAIDataAnalysis" -Type DWord -Value 1 -Force
Set-ItemProperty -Path $recallKey -Name "DisableCapture" -Type DWord -Value 1 -Force

$recallServices = @("Recall", "DesktopAIClientService", "RecallSnapshot")
foreach ($svc in $recallServices) {
    Stop-Service $svc -Force -ErrorAction SilentlyContinue
    Set-Service $svc -StartupType Disabled -ErrorAction SilentlyContinue
}

$recallFeature = (Get-WindowsOptionalFeature -Online -FeatureName Recall -ErrorAction SilentlyContinue)
if ($recallFeature -and $recallFeature.State -eq "Enabled") {
    Write-Host "Disabling Recall feature..."
    dism /online /disable-feature /featurename:Recall /norestart 2>$null
} else {
    Write-Host "Recall feature is already disabled or not present." -ForegroundColor Yellow
}

# --- Copilot ---
$copilotKey = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot"
if (-not (Test-Path $copilotKey)) { New-Item -Path $copilotKey -Force | Out-Null }
Set-ItemProperty -Path $copilotKey -Name "TurnOffWindowsCopilot" -Type DWord -Value 1 -Force

reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot" /v TurnOffWindowsCopilot /t REG_DWORD /d 1 /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot" /v CopilotAllowed /t REG_DWORD /d 0 /f

# --- Timeline / Activity History ---
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\System" /v EnableActivityFeed /t REG_DWORD /d 0 /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\System" /v PublishUserActivities /t REG_DWORD /d 0 /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\System" /v UploadUserActivities /t REG_DWORD /d 0 /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\System" /v DisableAIDataAnalysis /t REG_DWORD /d 1 /f

# --- Prevent Windows Update from re-enabling features ---
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate" /v DisableWUfBSafeguards /t REG_DWORD /d 1 /f

Write-Host "Recall, Copilot & Timeline disabled." -ForegroundColor Green



################################################################################
# ---- Windows Update Settings ----
################################################################################

Write-Host "`n=== Applying Windows Update Settings ===" -ForegroundColor Cyan

$wuPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU"
if (-not (Test-Path $wuPath)) { New-Item -Path $wuPath -Force | Out-Null }

# Notify before downloading and installing updates (don't auto-install)
# 2=Notify before download, 3=Auto download & notify, 4=Auto download & schedule
Set-ItemProperty -Path $wuPath -Name "AUOptions" -Type DWord -Value 2 -Force

# Disable auto-restart for updates
Set-ItemProperty -Path $wuPath -Name "NoAutoRebootWithLoggedOnUsers" -Type DWord -Value 1 -Force

# Disable delivery optimization (P2P update sharing)
$doPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization"
if (-not (Test-Path $doPath)) { New-Item -Path $doPath -Force | Out-Null }
Set-ItemProperty -Path $doPath -Name "DODownloadMode" -Type DWord -Value 0 -Force

Write-Host "Windows Update settings applied." -ForegroundColor Green



################################################################################
#                                                                              #
#                       PERFORMANCE OPTIMIZATIONS                              #
#                                                                              #
################################################################################



################################################################################
# ---- Performance Optimizations ----
################################################################################

Write-Host "`n=== Applying Performance Optimizations ===" -ForegroundColor Cyan

# Visual effects: "Adjust for best performance"
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" -Name "VisualFXSetting" -Type DWord -Value 2 -Force

# Disable window minimize/maximize animations
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop\WindowMetrics" -Name "MinAnimate" -Type String -Value "0" -Force
# Increase window border padding to make it easier to grab and resize windows
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop\WindowMetrics" -Name "PaddedBorderWidth" -Type String -Value "-100" -Force
# Disable taskbar button animations
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarAnimations" -Type DWord -Value 0 -Force
# Disable Aero transparency/blur effects
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" -Name "EnableTransparency" -Type DWord -Value 0 -Force
# Prioritize foreground programs over background services
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl" -Name "Win32PrioritySeparation" -Type DWord -Value 38 -Force
# Remove startup delay
$serializePath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Serialize"
if (-not (Test-Path $serializePath)) { New-Item -Path $serializePath -Force | Out-Null }
Set-ItemProperty -Path $serializePath -Name "StartupDelayInMSec" -Type DWord -Value 0 -Force

# Power: Disable Hibernation — removes hiberfil.sys (can be several GB) and prevents hibernate
# as a power option. Also required for Fast Startup to stay off (Fast Startup uses hibernate internally).
Write-Host ">> Power: Disable Hibernation"
powercfg /hibernate off

# Set power plan to High Performance
$powerPlan = powercfg /list | Select-String "High performance"
if ($powerPlan) {
    $planGUID = ($powerPlan -split '\s+')[3]
    powercfg /setactive $planGUID
}

# Power: Display and sleep timeouts — desktops never sleep/dim, laptops use conservative timeouts
$chassisTypes = (Get-CimInstance -ClassName Win32_SystemEnclosure).ChassisTypes
$isDesktop = ($chassisTypes | Where-Object { $_ -in @(3, 4, 5, 6, 7, 15, 16) }).Count -gt 0
if ($isDesktop) {
    Write-Host ">> Power: Desktop detected — disabling sleep and display timeout"
    powercfg /change monitor-timeout-ac 0
    powercfg /change monitor-timeout-dc 0
    powercfg /change standby-timeout-ac 0
    powercfg /change standby-timeout-dc 0
} else {
    Write-Host ">> Power: Laptop detected — using conservative timeouts (3 hours)"
    powercfg /change monitor-timeout-ac 180
    powercfg /change monitor-timeout-dc 180
    powercfg /change standby-timeout-ac 180
    powercfg /change standby-timeout-dc 180
}

Write-Host "Performance optimizations applied." -ForegroundColor Green



################################################################################
# ---- System Tweaks ----
################################################################################

Write-Host "`n=== Applying System Tweaks ===" -ForegroundColor Cyan

# Disable Fast Startup — Windows uses hybrid shutdown by default, which can cause issues
# with dual-boot OS detection, USB devices not reinitializing, and updates not applying
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power" -Name "HiberbootEnabled" -Type DWord -Value 0 -Force

# Disable USB selective suspend — prevents Windows from powering off USB ports during idle,
# which can cause keyboards, mice, and external drives to randomly disconnect
$usbPath = "HKLM:\SYSTEM\CurrentControlSet\Services\USB"
if (!(Test-Path $usbPath)) { New-Item -Path $usbPath -Force | Out-Null }
New-ItemProperty -Path $usbPath -Name "DisableSelectiveSuspend" -PropertyType DWord -Value 1 -Force

# Set default terminal to Windows Terminal (Win11) — new console apps open in Windows Terminal
# instead of the legacy conhost.exe window
$wtStartupPath = "HKCU:\Console\%%Startup"
if (-not (Test-Path $wtStartupPath)) { New-Item -Path $wtStartupPath -Force | Out-Null }
Set-ItemProperty -Path $wtStartupPath -Name "DelegationConsole" -Value "{2EACA947-7F5F-4CFA-BA87-8F7FBEEFBE69}" -Force
Set-ItemProperty -Path $wtStartupPath -Name "DelegationTerminal" -Value "{E12CFF52-A866-4C77-9A90-F570A7AA2C6B}" -Force

# Enable long file paths — removes the legacy 260-character MAX_PATH limit,
# needed for deep node_modules trees and long Git repo paths
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Type DWord -Value 1 -Force

# Enable Developer Mode — allows sideloading UWP apps, creating symlinks without admin,
# and unlocks Settings > Developer options (same as toggling it in the UI)
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" -Name "AllowDevelopmentWithoutDevLicense" -Type DWord -Value 1 -Force

# Power: Button and Lid Actions (values: 0=Do nothing, 1=Sleep, 2=Hibernate, 3=Shut down)
# SETDCVALUEINDEX = on battery, SETACVALUEINDEX = plugged in

# Power: Lid Close to Shut Down (laptops only, ignored on desktops)
Write-Host ">> Power: Lid Close to Shut Down"
powercfg -SETDCVALUEINDEX SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 5ca83367-6e45-459f-a27b-476b1d01c936 3
powercfg -SETACVALUEINDEX SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 5ca83367-6e45-459f-a27b-476b1d01c936 3

# Power: Power Button to Shut Down
Write-Host ">> Power: Power Button to Shut Down"
powercfg -SETDCVALUEINDEX SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 7648efa3-dd9c-4e3e-b566-50f929386280 3
powercfg -SETACVALUEINDEX SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 7648efa3-dd9c-4e3e-b566-50f929386280 3

# Power: Disable Sleep Button (prevents accidental sleep)
Write-Host ">> Power: Disable Sleep Button"
powercfg -SETDCVALUEINDEX SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 96996bc0-ad50-47ec-923b-6f41874dd9eb 0
powercfg -SETACVALUEINDEX SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 96996bc0-ad50-47ec-923b-6f41874dd9eb 0

powercfg -SetActive SCHEME_CURRENT

# Restore classic Windows 10 right-click context menu — disables the Windows 11 modern
# "Show more options" menu so all items appear immediately on right-click
$classicMenuPath = "HKCU:\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32"
if (-not (Test-Path $classicMenuPath)) { New-Item -Path $classicMenuPath -Force | Out-Null }
Set-ItemProperty -Path $classicMenuPath -Name "(Default)" -Value "" -Force

Write-Host "System tweaks applied." -ForegroundColor Green



################################################################################
#                                                                              #
#                          CLEANUP & REMOVAL                                   #
#                                                                              #
################################################################################



################################################################################
# ---- Remove Bloatware Apps ----
################################################################################

Write-Host "`n=== Removing Bloatware Apps ===" -ForegroundColor Cyan

$appsToRemove = @(
    # ---- Microsoft Default Apps ----
    'Clipchamp.Clipchamp',                  # [safe] Microsoft video editor, rarely used
    'Microsoft.3DBuilder',                  # [safe] 3D model creation tool, discontinued
    'Microsoft.3DViewer',                   # [safe] 3D model viewer, niche use
    'Microsoft.549981C3F5F10',              # [safe] Cortana standalone app
    'Microsoft.Appconnector',               # [safe] App connector service
    'Microsoft.BingFinance',                # [safe] Bing stock/finance tracker widget
    'Microsoft.BingFoodAndDrink',           # [safe] Bing recipes/food widget
    'Microsoft.BingHealthAndFitness',       # [safe] Bing health tracker widget
    'Microsoft.BingNews',                   # [safe] Bing news aggregator widget
    'Microsoft.BingSports',                 # [safe] Bing sports scores widget
    'Microsoft.BingTranslator',             # [safe] Bing translator widget
    'Microsoft.BingTravel',                 # [safe] Bing travel planner widget
    'Microsoft.BingWeather',                # [safe] Bing weather widget
    'Microsoft.CommsPhone',                 # [safe] Legacy phone companion
    'Microsoft.ConnectivityStore',          # [safe] Connectivity store service
    'Microsoft.Copilot',                    # [safe] Microsoft Copilot AI assistant app
    'Microsoft.GamingApp',                  # [caution] Xbox app hub - WARNING: needed to manage Xbox Game Pass subscriptions and game installs
    'Microsoft.GamingServices',             # [caution] Xbox gaming services - WARNING: needed for Xbox Game Pass
    'Microsoft.GetHelp',                    # [safe] Microsoft support/help wizard
    'Microsoft.Getstarted',                 # [safe] Windows tips and welcome experience
    'Microsoft.Messaging',                  # [safe] Legacy SMS messaging app, replaced by Phone Link
    'Microsoft.Microsoft3DViewer',          # [safe] Alternate 3D viewer package name
    'Microsoft.MicrosoftJournal',           # [safe] Microsoft Journal inking/note app
    'Microsoft.MicrosoftOfficeHub',         # [safe] Office hub launcher, not needed if Office is installed separately
    'Microsoft.MicrosoftPowerBIForWindows', # [safe] Power BI report viewer, not needed for most consumers
    'Microsoft.MicrosoftSolitaireCollection', # [safe] Bundled solitaire games with ads
    'Microsoft.MicrosoftStickyNotes',       # [caution] Desktop sticky notes - WARNING: if you use sticky notes for quick reminders, removing this deletes them
    'Microsoft.MinecraftUWP',               # [safe] Minecraft UWP trial
    'Microsoft.MixedReality.Portal',        # [safe] VR/AR Mixed Reality portal, useless without headset
    'Microsoft.MSPaint',                    # [caution] Classic MS Paint - WARNING: removes Paint; install separately if needed
    'Microsoft.NetworkSpeedTest',           # [safe] Bing network speed test
    'Microsoft.News',                       # [safe] Microsoft News aggregator (Start menu feed)
    'Microsoft.Office.OneNote',             # [caution] OneNote UWP app - WARNING: removes UWP version; desktop OneNote (Office) is unaffected
    'Microsoft.Office.Sway',               # [safe] Sway presentation app, rarely used
    'Microsoft.OneConnect',                 # [safe] Paid Wi-Fi & cellular manager, rarely needed
    'Microsoft.OneDrive',                   # [caution] OneDrive cloud sync client - WARNING: if you sync files to OneDrive, removing this stops cloud backup and may lose unsynced files
    'Microsoft.OutlookForWindows',          # [caution] New Outlook app (replacing Mail & Calendar) - WARNING: if you rely on built-in Mail app, this removes it
    'Microsoft.Paint',                      # [caution] Modern Paint app - WARNING: same as MSPaint, removes the drawing tool
    'Microsoft.People',                     # [safe] Contact manager, mostly unused standalone
    'Microsoft.PowerAutomateDesktop',       # [safe] RPA/automation tool, unused by most consumers
    'Microsoft.Print3D',                    # [safe] 3D printing slicer companion, niche use
    'Microsoft.ScreenSketch',               # [safe] Snip & Sketch screenshot tool
    'Microsoft.SkypeApp',                   # [safe] Skype UWP, replaced by Teams
    'Microsoft.Todos',                      # [caution] Microsoft To Do task manager - WARNING: if you use To Do for task lists, removing this loses local access
    'Microsoft.Wallet',                     # [safe] Microsoft Wallet payments
    'Microsoft.WindowsAlarms',              # [caution] Clock, alarms and timers - WARNING: removes built-in alarm/timer/stopwatch/world clock
    'Microsoft.WindowsCalculator',          # [caution] Built-in Calculator - WARNING: removes Calculator; install a replacement first
    'Microsoft.WindowsCamera',              # [caution] Camera app - WARNING: removes camera/webcam capture app
    'Microsoft.windowscommunicationsapps',  # [caution] Mail & Calendar apps - WARNING: removes built-in Mail and Calendar
    'Microsoft.WindowsFeedbackHub',         # [safe] Sends feedback to Microsoft
    'Microsoft.WindowsMaps',                # [safe] Built-in Maps app, most use browser maps
    'Microsoft.WindowsPhone',               # [safe] Phone companion, replaced by Phone Link
    'Microsoft.WindowsReadingList',         # [safe] Reading list app, discontinued
    'Microsoft.WindowsSoundRecorder',       # [safe] Basic audio recorder
    'Microsoft.Xbox.TCUI',                  # [safe] Xbox text/chat UI overlay
    'Microsoft.XboxApp',                    # [safe] Legacy Xbox app
    'Microsoft.XboxGameOverlay',            # [safe] Xbox Game Bar overlay popup
    'Microsoft.XboxGamingOverlay',          # [safe] Xbox Game Bar (Win+G) overlay
    'Microsoft.XboxIdentityProvider',       # [caution] Xbox sign-in provider - WARNING: breaks Xbox Live authentication for any Xbox/MS Store game
    'Microsoft.XboxSpeechToTextOverlay',    # [safe] Xbox voice-to-text chat overlay
    'Microsoft.YourPhone',                  # [safe] Phone Link companion app
    'Microsoft.ZuneMusic',                  # [caution] Groove Music / modern media player - WARNING: removes default music player
    'Microsoft.ZuneVideo',                  # [caution] Movies & TV player - WARNING: removes default video player for purchased MS Store content
    'MicrosoftCorporationII.MicrosoftFamily', # [safe] Microsoft Family Safety parental controls
    'MicrosoftCorporationII.QuickAssist',   # [safe] Remote assistance tool
    'MicrosoftTeams',                       # [safe] Teams personal/consumer pre-install
    'MSTeams',                              # [safe] Teams (new) pre-install, alternate package name
    'Microsoft.Advertising.Xaml',           # [safe] Ad framework used by other apps

    # ---- Third-Party Bloatware ----
    '2FE3CB00.PicsArt-PhotoStudio',         # [safe] PicsArt photo editor
    '46928bounde.EclipseManager',           # [safe] OEM Eclipse IDE manager
    '4DF9E0F8.Netflix',                     # [safe] Netflix streaming app
    '613EBCEA.PolarrPhotoEditorAcademicEdition', # [safe] Polarr photo editor trial
    '6Wunderkinder.Wunderlist',             # [safe] Deprecated to-do app
    '7EE7776C.LinkedInforWindows',          # [safe] LinkedIn app
    '89006A2E.AutodeskSketchBook',          # [safe] Autodesk drawing app
    '9E2F88E3.Twitter',                     # [safe] Twitter/X app
    'A025C540.Yandex.Music',                # [safe] Yandex music app
    'A278AB0D.DisneyMagicKingdoms',         # [safe] Pre-installed Disney game ad
    'A278AB0D.MarchofEmpires',              # [safe] Pre-installed strategy game ad
    'ACGMediaPlayer',                       # [safe] Pre-installed third-party media player
    'ActiproSoftwareLLC',                   # [safe] OEM demo UI control library
    'ActiproSoftwareLLC.562882FEEB491',     # [safe] Code Writer from Actipro
    'AdobeSystemsIncorporated.AdobePhotoshopExpress', # [safe] Adobe Photoshop Express freemium app
    'Amazon.com.Amazon',                    # [safe] Amazon Shopping app
    'AmazonVideo.PrimeVideo',               # [safe] Prime Video streaming app
    'Asphalt8Airborne',                     # [safe] Pre-installed racing game
    'CAF9E577.Plex',                        # [safe] Plex media player app
    'CaesarsSlotsFreeCasino',               # [safe] Pre-installed casino game ad
    'ClearChannelRadioDigital.iHeartRadio', # [safe] iHeartRadio streaming app
    'COOKINGFEVER',                         # [safe] Pre-installed cooking game ad
    'CyberLinkMediaSuiteEssentials',        # [safe] OEM CyberLink media suite trial
    'D52A8D61.FarmVille2CountryEscape',     # [safe] Pre-installed Zynga game ad
    'D5EA27B7.Duolingo-LearnLanguagesforFree', # [safe] Duolingo language learning app
    'DB6EA5DB.CyberLinkMediaSuiteEssentials', # [safe] CyberLink alternate package name
    'Disney',                               # [safe] Disney+ streaming app
    'DolbyLaboratories.DolbyAccess',        # [safe] Dolby Atmos app
    'Drawboard.DrawboardPDF',               # [safe] PDF annotation app trial
    'Facebook.Facebook',                    # [safe] Facebook app
    'Fitbit.FitbitCoach',                   # [safe] Fitbit companion app
    'Flipboard.Flipboard',                  # [safe] News aggregator app
    'GAMELOFTSA.Asphalt8Airborne',          # [safe] Asphalt alternate package name
    'HiddenCity',                           # [safe] Pre-installed hidden object game ad
    'HULULLC.HULUPLUS',                     # [safe] Hulu streaming app
    'KeeperSecurityInc.Keeper',             # [safe] Keeper password manager trial
    'king.com.*',                           # [safe] All King games
    'king.com.BubbleWitch3Saga',            # [safe] Pre-installed King game ad
    'king.com.CandyCrushSaga',             # [safe] Pre-installed King game ad
    'king.com.CandyCrushSodaSaga',          # [safe] Pre-installed King game ad
    'NORDCURRENT.COOKINGFEVER',             # [safe] Cooking Fever alternate name
    'PandoraMediaInc',                      # [safe] Pandora music streaming app
    'PandoraMediaInc.29680B314EFC2',        # [safe] Pandora alternate package name
    'Playtika.CaesarsSlotsFreeCasino',      # [safe] Caesar Slots alternate name
    'Royal Revolt',                         # [safe] Pre-installed strategy game ad
    'flaregamesGmbH.RoyalRevolt2',          # [safe] Royal Revolt alternate name
    'ShazamEntertainmentLtd.Shazam',        # [safe] Shazam music identification app
    'Sidia.LiveWallpaper',                  # [safe] OEM live wallpaper app
    'SlingTVLLC.SlingTV',                   # [safe] Sling TV streaming app
    'Spotify',                              # [safe] Spotify music app pre-install
    'SpotifyAB.SpotifyMusic',              # [safe] Spotify alternate package name
    'ThumbmunkeysLtd.PhototasticCollage',   # [safe] OEM photo collage maker
    'TikTok',                               # [safe] TikTok short video app
    'TuneIn.TuneInRadio',                  # [safe] TuneIn radio streaming app
    'Twitter',                              # [safe] Twitter/X app
    'Viber',                                # [safe] Viber messaging app
    'WinZipComputing.WinZipUniversal',      # [safe] WinZip trial, use 7-Zip instead
    'XINGAG.XING',                          # [safe] XING professional network app
    'OneCalendar',                          # [safe] Third-party calendar widget
    'NYTCrossword'                          # [safe] NY Times crossword game
) | Sort-Object -Unique

foreach ($app in $appsToRemove) {
    Write-Host "Uninstalling: $app"
    Get-AppxPackage -Name $app -AllUsers -ErrorAction SilentlyContinue |
        Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue
    Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -EQ $app } |
        Remove-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue
}

# Remove Widget, Cortana packages by wildcard
Get-AppxPackage *WebExperience* | Remove-AppxPackage -ErrorAction SilentlyContinue
Get-AppxPackage *Cortana* | Remove-AppxPackage -ErrorAction SilentlyContinue

# Prevent bloatware from re-installing via Content Delivery Manager
$cdmPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"
if (-not (Test-Path $cdmPath)) { New-Item -Path $cdmPath -Force | Out-Null }
$cdmKeys = @(
    "ContentDeliveryAllowed", "FeatureManagementEnabled", "OemPreInstalledAppsEnabled",
    "PreInstalledAppsEnabled", "PreInstalledAppsEverEnabled", "SilentInstalledAppsEnabled",
    "SubscribedContent-314559Enabled", "SubscribedContent-338387Enabled",
    "SubscribedContent-338388Enabled", "SubscribedContent-338389Enabled",
    "SubscribedContent-338393Enabled", "SubscribedContentEnabled", "SystemPaneSuggestionsEnabled"
)
foreach ($key in $cdmKeys) {
    Set-ItemProperty -Path $cdmPath -Name $key -Type DWord -Value 0 -Force
}

# Disable auto-download of suggested apps from the Store
$storePolicyPath = "HKLM:\SOFTWARE\Policies\Microsoft\WindowsStore"
if (-not (Test-Path $storePolicyPath)) { New-Item -Path $storePolicyPath -Force | Out-Null }
Set-ItemProperty -Path $storePolicyPath -Name "AutoDownload" -Type DWord -Value 2 -Force

# Disable "Suggested Applications" returning via Cloud Content
$cloudPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent"
if (-not (Test-Path $cloudPath)) { New-Item -Path $cloudPath -Force | Out-Null }
Set-ItemProperty -Path $cloudPath -Name "DisableWindowsConsumerFeatures" -Type DWord -Value 1 -Force

Write-Host "App cleanup complete." -ForegroundColor Green



################################################################################
# ---- Onedrive / Skydrive Removal ----
################################################################################

Write-Host "`n=== Removing OneDrive / SkyDrive ===" -ForegroundColor Cyan

try {
    # Kill all OneDrive / SkyDrive processes
    Stop-Process -Name "OneDrive" -Force -ErrorAction SilentlyContinue
    Stop-Process -Name "OneDriveSetup" -Force -ErrorAction SilentlyContinue
    Stop-Process -Name "SkyDrive" -Force -ErrorAction SilentlyContinue

    # Uninstall via winget (catches Win32 and Store versions)
    winget uninstall --id "Microsoft.OneDrive" --silent --accept-source-agreements 2>$null
    winget uninstall --id "Microsoft.OneDriveForBusiness" --silent --accept-source-agreements 2>$null
    winget uninstall --id "Microsoft.SkyDrive" --silent --accept-source-agreements 2>$null

    # Uninstall Appx packages for all users
    Get-AppxPackage *OneDrive* -AllUsers | Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue
    Get-AppxPackage *SkyDrive* -AllUsers | Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue
    Get-AppxProvisionedPackage -Online | Where-Object { $_.DisplayName -match "OneDrive|SkyDrive" } |
        Remove-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue

    # Uninstall via setup executables
    if (Test-Path "$env:systemroot\System32\OneDriveSetup.exe") {
        & "$env:systemroot\System32\OneDriveSetup.exe" /uninstall
    }
    if (Test-Path "$env:systemroot\SysWOW64\OneDriveSetup.exe") {
        & "$env:systemroot\SysWOW64\OneDriveSetup.exe" /uninstall
    }

    # Remove leftover directories
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "$env:localappdata\Microsoft\OneDrive"
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "$env:localappdata\Microsoft\SkyDrive"
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "$env:programdata\Microsoft OneDrive"
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "$env:programdata\Microsoft\OneDrive"
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "$env:systemdrive\OneDriveTemp"

    if ((Test-Path "$env:userprofile\OneDrive") -and
        (Get-ChildItem "$env:userprofile\OneDrive" -Recurse | Measure-Object).Count -eq 0) {
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "$env:userprofile\OneDrive"
    }
    if ((Test-Path "$env:userprofile\SkyDrive") -and
        (Get-ChildItem "$env:userprofile\SkyDrive" -Recurse | Measure-Object).Count -eq 0) {
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "$env:userprofile\SkyDrive"
    }

    # Disable OneDrive via Group Policy (both WoW64 and native paths)
    @(
        "HKLM:\SOFTWARE\Wow6432Node\Policies\Microsoft\Windows\OneDrive",
        "HKLM:\SOFTWARE\Policies\Microsoft\Windows\OneDrive"
    ) | ForEach-Object {
        if (-not (Test-Path $_)) { New-Item -Path $_ -Force | Out-Null }
        Set-ItemProperty -Path $_ -Name "DisableFileSyncNGSC" -Type DWord -Value 1 -Force
        Set-ItemProperty -Path $_ -Name "DisableFileSync" -Type DWord -Value 1 -Force
    }
    Set-ItemProperty -Path "HKLM:\SOFTWARE\Wow6432Node\Policies\Microsoft\Windows\OneDrive" `
        -Name "DisableLibrariesDefaultSaveToSkyDrive" -Type DWord -Value 1 -Force

    # Remove OneDrive / SkyDrive from Explorer sidebar
    New-PSDrive -PSProvider "Registry" -Root "HKEY_CLASSES_ROOT" -Name "HKCR" -ErrorAction SilentlyContinue
    @(
        "HKCR:\CLSID\{018D5C66-4533-4307-9B53-224DE2ED1FE6}",
        "HKCR:\Wow6432Node\CLSID\{018D5C66-4533-4307-9B53-224DE2ED1FE6}",
        "HKCR:\CLSID\{04271989-C4D2-4E23-B7D5-BC5F64C5FA56}",
        "HKCR:\Wow6432Node\CLSID\{04271989-C4D2-4E23-B7D5-BC5F64C5FA56}"
    ) | ForEach-Object {
        if (-not (Test-Path $_)) { New-Item -Path $_ -Force | Out-Null }
        Set-ItemProperty -Path $_ -Name "System.IsPinnedToNameSpaceTree" -Type DWord -Value 0 -Force
    }
    Remove-PSDrive "HKCR" -ErrorAction SilentlyContinue

    # Remove from Explorer namespace
    @(
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Desktop\NameSpace\{018D5C66-4533-4307-9B53-224DE2ED1FE6}",
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Desktop\NameSpace\{04271989-C4D2-4E23-B7D5-BC5F64C5FA56}"
    ) | ForEach-Object {
        Remove-Item -Path $_ -Recurse -Force -ErrorAction SilentlyContinue
    }

    # Remove run hooks for current user
    Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "OneDrive" -Force -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "SkyDrive" -Force -ErrorAction SilentlyContinue

    # Remove run hooks for new users
    reg load "hku\Default" "C:\Users\Default\NTUSER.DAT" 2>$null
    reg delete "HKEY_USERS\Default\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "OneDriveSetup" /f 2>$null
    reg delete "HKEY_USERS\Default\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "SkyDrive" /f 2>$null
    reg unload "hku\Default" 2>$null

    # Remove startmenu entries and scheduled tasks
    Remove-Item -Force -ErrorAction SilentlyContinue "$env:userprofile\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\OneDrive.lnk"
    Remove-Item -Force -ErrorAction SilentlyContinue "$env:userprofile\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\SkyDrive.lnk"
    Get-ScheduledTask -TaskPath '\' -TaskName 'OneDrive*' -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$false
    Get-ScheduledTask -TaskPath '\' -TaskName 'SkyDrive*' -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$false

    # Stop and disable OneDrive sync service
    Get-Service -Name "OneSyncSvc*" -ErrorAction SilentlyContinue | Stop-Service -Force -ErrorAction SilentlyContinue
    Get-Service -Name "OneSyncSvc*" -ErrorAction SilentlyContinue | Set-Service -StartupType Disabled -ErrorAction SilentlyContinue
} catch {
    Write-Output "OneDrive/SkyDrive removal error: $_"
}

Write-Host "OneDrive/SkyDrive removed." -ForegroundColor Green



################################################################################
# ---- Adobe Photoshop Debug Mode ----
################################################################################

$regPath  = "HKCU:\Software\Adobe\CSXS.6"
$regName  = "PlayerDebugMode"
$regValue = "1"
if (!(Test-Path $regPath)) { New-Item -Path $regPath -Force | Out-Null }
New-ItemProperty -Path $regPath -Name $regName -Value $regValue -PropertyType String -Force
Write-Host "Adobe Photoshop debug mode enabled."



################################################################################
# ---- Restore Windows Photo Viewer (LTSC) ----
################################################################################

Write-Host "`n=== Restoring Windows Photo Viewer ===" -ForegroundColor Cyan

# On LTSC editions, Windows Photo Viewer is not registered by default.
# Re-enable it by adding the necessary registry entries.
$photoViewerDll = "%SystemRoot%\System32\shimgvw.dll"
$photoViewerExts = @(".bmp", ".gif", ".ico", ".jpeg", ".jpg", ".jfif", ".png", ".tif", ".tiff", ".wdp", ".hdp", ".jxr")

foreach ($ext in $photoViewerExts) {
    $progId = "PhotoViewer.FileAssoc$ext"
    $classPath = "HKLM:\SOFTWARE\Classes\$progId"
    if (-not (Test-Path $classPath)) {
        New-Item -Path $classPath -Force | Out-Null
        New-Item -Path "$classPath\DefaultIcon" -Force | Out-Null
        New-Item -Path "$classPath\shell" -Force | Out-Null
        New-Item -Path "$classPath\shell\open" -Force | Out-Null
        New-Item -Path "$classPath\shell\open\command" -Force | Out-Null
        New-Item -Path "$classPath\shell\open\DropTarget" -Force | Out-Null
        Set-ItemProperty -Path $classPath -Name "(Default)" -Value "Photo Viewer" -Force
        Set-ItemProperty -Path "$classPath\DefaultIcon" -Name "(Default)" -Value "$photoViewerDll,0" -Force
        Set-ItemProperty -Path "$classPath\shell\open\command" -Name "(Default)" -Value ('%SystemRoot%\System32\rundll32.exe "%ProgramFiles%\Windows Photo Viewer\PhotoViewer.dll", ImageView_Fullscreen %1') -Force
        Set-ItemProperty -Path "$classPath\shell\open\DropTarget" -Name "Clsid" -Value "{FFE2A43C-56B9-4bf5-9A79-CC6D4285608A}" -Force
        Write-Host "  Registered $progId" -ForegroundColor Green
    } else {
        Write-Host "  Already registered: $progId" -ForegroundColor Yellow
    }

    # Add Photo Viewer to the OpenWithProgids list for this extension
    $openWithPath = "HKLM:\SOFTWARE\Classes\$ext\OpenWithProgids"
    if (-not (Test-Path $openWithPath)) { New-Item -Path $openWithPath -Force | Out-Null }
    Set-ItemProperty -Path $openWithPath -Name $progId -Value ([byte[]]@()) -Type Binary -Force
}

Write-Host "Windows Photo Viewer restored." -ForegroundColor Green






################################################################################
#                                                                              #
#                       SECURITY & USER SETTINGS                               #
#                                                                              #
################################################################################



################################################################################
# ---- Defender Exclusion ----
################################################################################

Write-Host "`n=== Adding Defender Exclusions ===" -ForegroundColor Cyan
Add-MpPreference -ExclusionPath "C:\Program Files (x86)\Microsoft Office\Office14"
Write-Host "Defender exclusion added." -ForegroundColor Green



################################################################################
# ---- Password / User Settings ----
# ---- Unsafe: These Require Active Directory Module And May Fail On Non-Domain Machines. ----
################################################################################

if (Get-Command Set-ADUser -ErrorAction SilentlyContinue) {
  Set-ADUser -Identity "Sy Le" -PasswordNeverExpires $true -ErrorAction SilentlyContinue
  Set-ADUser -Identity "syle" -PasswordNeverExpires $true -ErrorAction SilentlyContinue
} else {
  Write-Host "Skipped: Set-ADUser not available (Active Directory module not installed)." -ForegroundColor Yellow
}



################################################################################
#                                                                              #
#                         DISK CLEANUP (LAST)                                  #
#                                                                              #
################################################################################



################################################################################
# ---- Clean Up macOS Junk Files ----
################################################################################

Write-Host "`n=== Cleaning macOS junk files (._*, .DS_Store) ===" -ForegroundColor Cyan

# Remove macOS resource fork files and .DS_Store from all drives
Get-PSDrive -PSProvider FileSystem | ForEach-Object {
    $root = $_.Root
    Write-Host "Scanning $root ..."
    Get-ChildItem -Path $root -Recurse -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like '._*' -or $_.Name -eq '.DS_Store' } |
        ForEach-Object {
            try { Remove-Item $_.FullName -Force -ErrorAction Stop; Write-Host "  Removed: $($_.FullName)" }
            catch { }
        }
}

Write-Host "macOS junk files cleanup done." -ForegroundColor Green



################################################################################
# ---- Disk Cleanup ----
################################################################################

Write-Host "`n=== Running Disk Cleanup ===" -ForegroundColor Cyan

try { Remove-Item -Path "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue }
catch { Write-Host "  Skipped: user temp cleanup - $_" -ForegroundColor Yellow }
try { Remove-Item -Path "C:\Windows\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue }
catch { Write-Host "  Skipped: Windows temp cleanup - $_" -ForegroundColor Yellow }
try { Remove-Item -Path "C:\Windows\Prefetch\*" -Recurse -Force -ErrorAction SilentlyContinue }
catch { Write-Host "  Skipped: Prefetch cleanup - $_" -ForegroundColor Yellow }

# Clean up superseded Windows Update files and remove old update backups to reclaim disk space
# WARNING: /ResetBase means old updates cannot be uninstalled afterward
Dism.exe /Online /Cleanup-Image /StartComponentCleanup /ResetBase /Quiet

# Run Disk Cleanup silently to remove temp files, thumbnails, old Windows Update files, and Recycle Bin contents
cleanmgr /d C: /autoclean

Write-Host "Disk cleanup complete." -ForegroundColor Green



################################################################################
# ---- Restart Prompt ----
################################################################################

if ($needsRestart) {
    Write-Host "`nA restart is required to complete WSL / Virtual Machine Platform setup." -ForegroundColor Red
    Write-Host "Please restart your computer, then re-run this script to continue setup." -ForegroundColor Red
    $response = Read-Host "Restart now? (y/n)"
    if ($response -eq "y") {
        Restart-Computer -Force
    }
    Write-Host "Exiting. Please restart manually and re-run this script." -ForegroundColor Yellow
    exit 0
}

Write-Host "`nBootstrap complete! You can now run windows.ps1 for software installation." -ForegroundColor Cyan
pause

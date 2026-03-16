################################################################################
# dependencies/windows-bootstrap.ps1 - First-time Windows setup: enables WSL,
# Virtual Machine Platform, restores Windows Photo Viewer, and installs winget.
#
# Run this ONCE on a fresh Windows install (before windows.ps1).
# Run as Administrator:
# ----  Set-Executionpolicy Unrestricted -Scope Currentuser ----
# ----  .\Software\Bootstrap\Dependencies/Windows-Bootstrap.Ps1 ----
################################################################################



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

$wslInstalled = Get-Command wsl -ErrorAction SilentlyContinue
if (-not $wslInstalled) {
    Write-Host "Installing WSL..."
    wsl --install
    $needsRestart = $true
} else {
    Write-Host "WSL is already installed." -ForegroundColor Yellow
}

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

Write-Host "Available WSL distros:"
wsl --list --online

# Only install Ubuntu if not already present
$wslList = wsl --list --quiet 2>$null
if ($wslList -notmatch "Ubuntu") {
    Write-Host "Installing Ubuntu 24.04..."
    wsl --install Ubuntu-24.04
} else {
    Write-Host "Ubuntu is already installed in WSL." -ForegroundColor Yellow
}

Write-Host "WSL and Virtual Machine Platform setup complete." -ForegroundColor Green



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
# ---- Install Winget Dependencies ----
################################################################################

Write-Host "`n=== Installing Winget Dependencies ===" -ForegroundColor Cyan

Write-Host "Downloading Windows App SDK runtime (required for winget)..."
$appSdkInstaller = "$env:TEMP\windowsappruntimeinstall-x64.exe"
Invoke-WebRequest -Uri "https://aka.ms/windowsappsdk/1.8/latest/windowsappruntimeinstall-x64.exe" -OutFile $appSdkInstaller
Write-Host "Installing Windows App SDK runtime..."
Start-Process -FilePath $appSdkInstaller -Wait

Write-Host "Installing winget (Microsoft Desktop App Installer)..."
$wingetBundle = "$env:TEMP\Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle"
Invoke-WebRequest -Uri "https://github.com/microsoft/winget-cli/releases/download/v1.28.220/Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle" -OutFile $wingetBundle
Add-AppxPackage $wingetBundle

Write-Host "Winget dependencies installed." -ForegroundColor Green



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

Write-Host "`n=== Post-Bootstrap Notes ===" -ForegroundColor Cyan

Write-Host "`nTo enable Windows Store on LTSC, run the following manually:" -ForegroundColor Yellow
Write-Host "  wsreset.exe -i" -ForegroundColor White

Write-Host "`nActivating Windows (MAS)..." -ForegroundColor Yellow
irm https://get.activated.win | iex

Write-Host "`nBootstrap complete! You can now run windows.ps1 for the full setup." -ForegroundColor Cyan

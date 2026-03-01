################################################################################
# dependencies/windows.ps1 - All-in-one Windows setup, cleanup,
# privacy hardening, and software installation.
#
# Run as Administrator:
# ----  Set-Executionpolicy Unrestricted -Scope Currentuser ----
# ----  .\Bootstrap\Dependencies/Windows.Ps1 ----
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
# ---- Adobe Photoshop Debug Mode ----
################################################################################

$regPath  = "HKCU:\Software\Adobe\CSXS.6"
$regName  = "PlayerDebugMode"
$regValue = "1"
if (!(Test-Path $regPath)) { New-Item -Path $regPath -Force | Out-Null }
New-ItemProperty -Path $regPath -Name $regName -Value $regValue -PropertyType String -Force
Write-Host "Adobe Photoshop debug mode enabled."



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

# Hide the Widgets button from taskbar
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarDa" -Type DWord -Value 0 -Force

Write-Host "Cortana & Search hardened." -ForegroundColor Green



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
# Hide Task View button (0=hide, 1=show)
Set-ItemProperty -Path $explorerAdvanced -Name "ShowTaskViewButton" -Type DWord -Value 0 -Force

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

Write-Host "Explorer tweaks applied." -ForegroundColor Green



################################################################################
# ---- Clean Up Macos Junk Files ----
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

dism /online /disable-feature /featurename:Recall /norestart 2>$null

# --- Copilot ---
$copilotKey = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot"
if (-not (Test-Path $copilotKey)) { New-Item -Path $copilotKey -Force | Out-Null }
Set-ItemProperty -Path $copilotKey -Name "TurnOffWindowsCopilot" -Type DWord -Value 1 -Force
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "ShowCopilotButton" -Type DWord -Value 0 -Force

reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot" /v TurnOffWindowsCopilot /t REG_DWORD /d 1 /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot" /v CopilotAllowed /t REG_DWORD /d 0 /f
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v ShowCopilotButton /t REG_DWORD /d 0 /f

# --- Timeline / Activity History ---
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\System" /v EnableActivityFeed /t REG_DWORD /d 0 /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\System" /v PublishUserActivities /t REG_DWORD /d 0 /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\System" /v UploadUserActivities /t REG_DWORD /d 0 /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\System" /v DisableAIDataAnalysis /t REG_DWORD /d 1 /f

# --- Prevent Windows Update from re-enabling features ---
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate" /v DisableWUfBSafeguards /t REG_DWORD /d 1 /f

Write-Host "Recall, Copilot & Timeline disabled." -ForegroundColor Green



################################################################################
# ---- Performance Optimizations ----
################################################################################

Write-Host "`n=== Applying Performance Optimizations ===" -ForegroundColor Cyan

# Visual effects: "Adjust for best performance"
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" -Name "VisualFXSetting" -Type DWord -Value 2 -Force

# Disable window minimize/maximize animations
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop\WindowMetrics" -Name "MinAnimate" -Type String -Value "0" -Force
# Disable taskbar button animations
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarAnimations" -Type DWord -Value 0 -Force
# Disable Aero transparency/blur effects
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" -Name "EnableTransparency" -Type DWord -Value 0 -Force
# Prioritize foreground programs over background services
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl" -Name "Win32PrioritySeparation" -Type DWord -Value 38 -Force
# Remove startup delay
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Serialize" -Name "StartupDelayInMSec" -Type DWord -Value 0 -Force

# Disable hibernation to save disk space
powercfg /hibernate off

# Set power plan to High Performance
$powerPlan = powercfg /list | Select-String "High performance"
if ($powerPlan) {
    $planGUID = ($powerPlan -split '\s+')[3]
    powercfg /setactive $planGUID
}

Write-Host "Performance optimizations applied." -ForegroundColor Green



################################################################################
# ---- Hosts File Blocking ----
################################################################################

Write-Host "`n=== Updating HOSTS File ===" -ForegroundColor Cyan

$entriesToAdd = @(
    # ---- Adobe License Servers ----
    "0.0.0.0 lmlicenses.wip4.adobe.com",
    "0.0.0.0 lm.licenses.adobe.com",
    "0.0.0.0 activate.adobe.com",
    "0.0.0.0 practivate.adobe.com",
    "0.0.0.0 na1r.services.adobe.com",

    # ---- Microsoft Telemetry ----
    "0.0.0.0 officecdn.microsoft.com",
    "0.0.0.0 officecdn.microsoft.com.edgesuite.net",
    "0.0.0.0 config.office.com",
    "0.0.0.0 odc.officeapps.live.com",
    "0.0.0.0 vortex.data.microsoft.com",
    "0.0.0.0 vortex-sandbox.data.microsoft.com",
    "0.0.0.0 vortex-win.data.microsoft.com",
    "0.0.0.0 cy2.vortex.data.microsoft.com.akadns.net",
    "0.0.0.0 telemetry.microsoft.com",
    "0.0.0.0 df.telemetry.microsoft.com",
    "0.0.0.0 oca.telemetry.microsoft.com",
    "0.0.0.0 oca.telemetry.microsoft.com.nsatc.net",
    "0.0.0.0 sqm.df.telemetry.microsoft.com",
    "0.0.0.0 sqm.telemetry.microsoft.com",
    "0.0.0.0 sqm.telemetry.microsoft.com.nsatc.net",
    "0.0.0.0 watson.telemetry.microsoft.com",
    "0.0.0.0 watson.telemetry.microsoft.com.nsatc.net",
    "0.0.0.0 watson.ppe.telemetry.microsoft.com",
    "0.0.0.0 watson.live.com",
    "0.0.0.0 watson.microsoft.com",
    "0.0.0.0 wes.df.telemetry.microsoft.com",
    "0.0.0.0 reports.wes.df.telemetry.microsoft.com",
    "0.0.0.0 services.wes.df.telemetry.microsoft.com",
    "0.0.0.0 telecommand.telemetry.microsoft.com",
    "0.0.0.0 telecommand.telemetry.microsoft.com.nsatc.net",
    "0.0.0.0 telemetry.appex.bing.net",
    "0.0.0.0 telemetry.urs.microsoft.com",
    "0.0.0.0 vortex-bn2.metron.live.com.nsatc.net",
    "0.0.0.0 vortex-cy2.metron.live.com.nsatc.net",
    "0.0.0.0 onesettings-db5.metron.live.nsatc.net",
    "0.0.0.0 settings-sandbox.data.microsoft.com",
    "0.0.0.0 diagnostics.support.microsoft.com",
    "0.0.0.0 survey.watson.microsoft.com",
    "0.0.0.0 feedback.microsoft-hohm.com",
    "0.0.0.0 feedback.search.microsoft.com",
    "0.0.0.0 feedback.windows.com",
    "0.0.0.0 statsfe1.ws.microsoft.com",
    "0.0.0.0 statsfe2.ws.microsoft.com",
    "0.0.0.0 statsfe2.update.microsoft.com.akadns.net",
    "0.0.0.0 corpext.msitadfs.glbdns2.microsoft.com",
    "0.0.0.0 corp.sts.microsoft.com",
    "0.0.0.0 compatexchange.cloudapp.net",
    "0.0.0.0 choice.microsoft.com",
    "0.0.0.0 choice.microsoft.com.nsatc.net",
    "0.0.0.0 redir.metaservices.microsoft.com",
    "0.0.0.0 schemas.microsoft.akadns.net",
    "0.0.0.0 fe2.update.microsoft.com.akadns.net",
    "0.0.0.0 sls.update.microsoft.com.akadns.net",
    "0.0.0.0 win10.ipv6.microsoft.com",
    "0.0.0.0 www.go.microsoft.akadns.net",
    "0.0.0.0 i1.services.social.microsoft.com",
    "0.0.0.0 i1.services.social.microsoft.com.nsatc.net",
    "0.0.0.0 lb1.www.ms.akadns.net",
    "0.0.0.0 ssw.live.com",
    "0.0.0.0 m.hotmail.com",
    "0.0.0.0 insiderservice.microsoft.com",
    "0.0.0.0 insiderservice.trafficmanager.net",
    "0.0.0.0 insiderppe.cloudapp.net",
    "0.0.0.0 flightingserviceweurope.cloudapp.net",
    "0.0.0.0 livetileedge.dsx.mp.microsoft.com",
    "0.0.0.0 wdcpalt.microsoft.com",
    "0.0.0.0 settings-ssl.xboxlive.com",
    "0.0.0.0 settings-ssl.xboxlive.com-c.edgekey.net",
    "0.0.0.0 settings-ssl.xboxlive.com-c.edgekey.net.globalredir.akadns.net",
    "0.0.0.0 client.wns.windows.com",

    # ---- Microsoft Edge / Msn / Bing ----
    "0.0.0.0 a-0001.a-msedge.net",
    "0.0.0.0 a-0002.a-msedge.net",
    "0.0.0.0 a-0003.a-msedge.net",
    "0.0.0.0 a-0004.a-msedge.net",
    "0.0.0.0 a-0005.a-msedge.net",
    "0.0.0.0 a-0006.a-msedge.net",
    "0.0.0.0 a-0007.a-msedge.net",
    "0.0.0.0 a-0008.a-msedge.net",
    "0.0.0.0 a-0009.a-msedge.net",
    "0.0.0.0 a-msedge.net",
    "0.0.0.0 msedge.net",
    "0.0.0.0 any.edge.bing.com",
    "0.0.0.0 ac3.msn.com",
    "0.0.0.0 c.msn.com",
    "0.0.0.0 flex.msn.com",
    "0.0.0.0 g.msn.com",
    "0.0.0.0 h1.msn.com",
    "0.0.0.0 h2.msn.com",
    "0.0.0.0 live.rads.msn.com",
    "0.0.0.0 preview.msn.com",
    "0.0.0.0 rad.msn.com",
    "0.0.0.0 a.rad.msn.com",
    "0.0.0.0 b.rad.msn.com",
    "0.0.0.0 rad.live.com",
    "0.0.0.0 msnbot-65-55-108-23.search.msn.com",
    "0.0.0.0 msntest.serving-sys.com",
    "0.0.0.0 bs.serving-sys.com",
    "0.0.0.0 pre.footprintpredict.com",
    "0.0.0.0 bingads.microsoft.com",
    "0.0.0.0 www.bingads.microsoft.com",

    # ---- Ad Networks ----
    "0.0.0.0 ads.msn.com",
    "0.0.0.0 a.ads1.msn.com",
    "0.0.0.0 a.ads2.msn.com",
    "0.0.0.0 b.ads1.msn.com",
    "0.0.0.0 b.ads2.msads.net",
    "0.0.0.0 ads1.msads.net",
    "0.0.0.0 ads1.msn.com",
    "0.0.0.0 a.ads2.msads.net",
    "0.0.0.0 adnexus.net",
    "0.0.0.0 adnxs.com",
    "0.0.0.0 m.adnxs.com",
    "0.0.0.0 secure.adnxs.com",
    "0.0.0.0 ad.doubleclick.net",
    "0.0.0.0 stats.g.doubleclick.net",
    "0.0.0.0 stats.l.doubleclick.net",
    "0.0.0.0 googleads.g.doubleclick.net",
    "0.0.0.0 pagead46.l.doubleclick.net",
    "0.0.0.0 adservice.google.com",
    "0.0.0.0 adservice.google.de",
    "0.0.0.0 ads.google.com",
    "0.0.0.0 ads.youtube.com",
    "0.0.0.0 ads-api.twitter.com",
    "0.0.0.0 advertising.twitter.com",
    "0.0.0.0 static.ads-twitter.com",
    "0.0.0.0 p.static.ads-twitter.com",
    "0.0.0.0 ads.facebook.com",
    "0.0.0.0 ads.reddit.com",
    "0.0.0.0 ads.tiktok.com",
    "0.0.0.0 ads.pinterest.com",
    "0.0.0.0 ads-dev.pinterest.com",
    "0.0.0.0 widgets.pinterest.com",
    "0.0.0.0 aidps.atdmt.com",
    "0.0.0.0 c.atdmt.com",
    "0.0.0.0 cdn.atdmt.com",
    "0.0.0.0 db3aqu.atdmt.com",
    "0.0.0.0 ec.atdmt.com",
    "0.0.0.0 view.atdmt.com",
    "0.0.0.0 aka-cdn-ns.adtech.de",
    "0.0.0.0 secure.flashtalking.com",
    "0.0.0.0 static.2mdn.net",
    "0.0.0.0 s0.2mdn.net",
    "0.0.0.0 adtago.s3.amazonaws.com",
    "0.0.0.0 adtechus.com",
    "0.0.0.0 advertising-api-eu.amazon.com",
    "0.0.0.0 advice-ads.s3.amazonaws.com",
    "0.0.0.0 affiliationjs.s3.amazonaws.com",
    "0.0.0.0 amazonaax.com",
    "0.0.0.0 analyticsengine.s3.amazonaws.com",
    "0.0.0.0 business.samsungusa.com",
    "0.0.0.0 criteo.net",
    "0.0.0.0 marvelpixel.io",
    "0.0.0.0 rubiconproject.com",
    "0.0.0.0 track-server.net",
    "0.0.0.0 youtube.cleverads.vn",
    "0.0.0.0 www-google-analytics.l.google.com",
    "0.0.0.0 hubspot.net.edge.net",
    "0.0.0.0 hubspot.net.edgekey.net",

    # ---- Error Reporting / Bug Tracking ----
    "0.0.0.0 api.bugsnag.com",
    "0.0.0.0 app.bugsnag.com",
    "0.0.0.0 notify.bugsnag.com",
    "0.0.0.0 sessions.bugsnag.com",
    "0.0.0.0 app.getsentry.com",
    "0.0.0.0 browser.sentry-cdn.com",

    # ---- Akamai Cdn (Telemetry-Related) ----
    "0.0.0.0 184-86-53-99.deploy.static.akamaitechnologies.com",
    "0.0.0.0 a1621.g.akamai.net",
    "0.0.0.0 a1856.g2.akamai.net",
    "0.0.0.0 a1961.g.akamai.net",
    "0.0.0.0 a978.i6g1.akamai.net",
    "0.0.0.0 az361816.vo.msecnd.net",
    "0.0.0.0 az512334.vo.msecnd.net",
    "0.0.0.0 cds26.ams9.msecn.net",
    "0.0.0.0 cs1.wpc.v0cdn.net",
    "0.0.0.0 e2835.dspb.akamaiedge.net",
    "0.0.0.0 e7341.g.akamaiedge.net",
    "0.0.0.0 e7502.ce.akamaiedge.net",
    "0.0.0.0 e8218.ce.akamaiedge.net",
    "0.0.0.0 e87.dspb.akamaidege.net",
    "0.0.0.0 e3843.g.akamaiedge.net",
    "0.0.0.0 e9483.a.akamaiedge.net",

    # ---- Skype (May Cause Issues With Skype) ----
    "0.0.0.0 apps.skype.com",
    "0.0.0.0 pricelist.skype.com",
    "0.0.0.0 s.gateway.messenger.live.com",
    "0.0.0.0 ui.skype.com"
) |
Where-Object { $_ -and $_.Trim() } |
Sort-Object -Unique

$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$tempPath  = "C:\temp-host.txt"

if (Test-Path $hostsPath) {
    Copy-Item -Path $hostsPath -Destination $tempPath -Force
    $currentContent = Get-Content $tempPath
} else {
    Write-Error "Original hosts file not found!"
    return
}

$existingHostnames = $currentContent | Where-Object { $_ -match '^\s*[0-9\.]+\s+(?<host>\S+)' } | ForEach-Object { $Matches.host.ToLower().Trim() }
$uniqueNewEntries = @()

foreach ($entry in $entriesToAdd) {
    $cleanEntry = $entry.Trim()
    if ($cleanEntry -match '\s+(?<host>\S+)$') {
        $hostName = $Matches.host.ToLower().Trim()
        if ($existingHostnames -notcontains $hostName) {
            $uniqueNewEntries += $cleanEntry
            $existingHostnames += $hostName
        }
    }
}

if ($uniqueNewEntries.Count -gt 0) {
    Add-Content -Path $tempPath -Value "`n# Added by dependencies/windows.ps1 $(Get-Date)"
    Add-Content -Path $tempPath -Value $uniqueNewEntries
    try {
        Move-Item -Path $tempPath -Destination $hostsPath -Force
        Write-Host "Updated HOSTS file with $($uniqueNewEntries.Count) new entries." -ForegroundColor Green
    } catch {
        Write-Error "Failed to write to $hostsPath. Ensure you are running as Administrator."
    }
} else {
    Write-Host "No new unique entries to add." -ForegroundColor Gray
    Remove-Item -Path $tempPath -ErrorAction SilentlyContinue
}



################################################################################
# ---- Firewall Blocking ----
################################################################################

Write-Host "`n=== Applying Firewall Rules ===" -ForegroundColor Cyan

# --- Block telemetry IPs ---
$telemetryIps = @(
    # Windows telemetry
    "134.170.30.202", "137.116.81.24", "157.56.106.189", "184.86.53.99",
    "2.22.61.43", "2.22.61.66", "204.79.197.200", "23.218.212.69",
    "65.39.117.230", "65.52.108.33", "65.55.108.23", "64.4.54.254",
    # NVIDIA telemetry
    "8.36.80.197", "8.36.80.224", "8.36.80.252", "8.36.113.118",
    "8.36.113.141", "8.36.80.230", "8.36.80.231", "8.36.113.126",
    "8.36.80.195", "8.36.80.217", "8.36.80.237", "8.36.80.246",
    "8.36.113.116", "8.36.113.139", "8.36.80.244", "216.228.121.209"
)
Remove-NetFirewallRule -DisplayName "Block Telemetry IPs" -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "Block Telemetry IPs" -Direction Outbound `
    -Action Block -RemoteAddress ([string[]]$telemetryIps)

# --- Helper for app-specific firewall rules ---
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

# --- Block Office14 executables ---
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

# --- Block all Adobe executables ---
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

Write-Host "Firewall rules applied." -ForegroundColor Green



################################################################################
# ---- Defender Exclusion ----
################################################################################

Write-Host "`n=== Adding Defender Exclusions ===" -ForegroundColor Cyan
Add-MpPreference -ExclusionPath "C:\Program Files (x86)\Microsoft Office\Office14"
Write-Host "Defender exclusion added." -ForegroundColor Green



################################################################################
# ---- Disk Cleanup ----
################################################################################

Write-Host "`n=== Running Disk Cleanup ===" -ForegroundColor Cyan

Remove-Item -Path "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Windows\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Windows\Prefetch\*" -Force -ErrorAction SilentlyContinue

Write-Host "Disk cleanup complete." -ForegroundColor Green



################################################################################
# ---- Password / User Settings ----
# ---- Unsafe: These Require Active Directory Module And May Fail On Non-Domain Machines. ----
################################################################################

Set-ADUser -Identity "Sy Le" -PasswordNeverExpires $true -ErrorAction SilentlyContinue
Set-ADUser -Identity "syle" -PasswordNeverExpires $true -ErrorAction SilentlyContinue



################################################################################
# ---- Wsl Setup ----
################################################################################

Write-Host "`n=== Setting up WSL ===" -ForegroundColor Cyan

wsl --update
wsl --set-default-version 2

Write-Host "WSL setup complete." -ForegroundColor Green



################################################################################
# ---- Winget Install & Upgrade ----
################################################################################

Write-Host "`n=== Installing Winget Packages ===" -ForegroundColor Cyan

$wingetPackages = @(
    "7zip.7zip",
    "Audacity.Audacity",
    "Bambulab.Bambustudio",
    "BlenderFoundation.Blender",
    "Brave.Brave",
    "CodeSector.TeraCopy",
    "Discord.Discord",
    "dotPDN.PaintDotNet",
    "EclipseAdoptium.Temurin.21.JDK",
    "Git.Git",
    "Greenshot.Greenshot",
    "HandBrake.HandBrake",
    "Inkscape.Inkscape",
    "KDE.Krita",
    "Microsoft.DotNet.DesktopRuntime.7",
    "Microsoft.VCRedist.2015+.x64",
    "Microsoft.VisualStudioCode",
    "Mozilla.FiraCode",
    "OpenJS.NodeJS",
    "PuTTY.PuTTY",
    "Python.Python.3",
    "Rufus.Rufus",
    "SublimeHQ.SublimeMerge",
    "SublimeHQ.SublimeText.4",
    "Ultimaker.Cura",
    "Valve.Steam",
    "VideoLAN.VLC",
    "VSCodium.VSCodium",
    "WinFSP.WinFSP",
    "WinFSP.SSHFS",
    "WinMerge.WinMerge",
    "WinSCP.WinSCP",
    "Zoom.Zoom"
)

foreach ($pkg in $wingetPackages) {
    Write-Host "Installing: $pkg"
    winget install --id $pkg -e --accept-source-agreements --accept-package-agreements 2>$null
}

Write-Host "`nUpgrading all winget packages..." -ForegroundColor Cyan
winget upgrade --all --include-unknown



################################################################################
# ---- Add Known Paths To Path If They Exist ----
################################################################################

$pathCandidates = @(
    "$env:JAVA_HOME\bin"                                          # java jdk
    "$env:LocalAppData\Microsoft\WindowsApps"                     # windows apps (user)
    "${env:ProgramFiles(x86)}\NVIDIA Corporation\PhysX\Common"    # nvidia physx
    "$env:ProgramFiles\Microsoft VS Code"                         # vs code
    "$env:ProgramFiles\Microsoft VS Code\bin"                     # vs code cli
    "$env:ProgramFiles\Sublime Text"                              # sublime text
    "$env:SystemRoot"                                             # windows root
    "$env:SystemRoot\System32"                                    # system32
    "$env:SystemRoot\System32\OpenSSH"                            # openssh
    "$env:SystemRoot\System32\Wbem"                               # wmi / wbem
    "$env:SystemRoot\System32\WindowsPowerShell\v1.0"             # powershell
    "$env:UserProfile\AppData\Local\Microsoft\WindowsApps"        # windows apps (profile)
)

$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
$added = @()

foreach ($p in $pathCandidates) {
    if ([string]::IsNullOrWhiteSpace($p)) { continue }
    if ((Test-Path $p) -and ($currentPath -notlike "*$p*")) {
        $currentPath = "$currentPath;$p"
        $added += $p
    }
}

if ($added.Count -gt 0) {
    Write-Host "Added to PATH:" -ForegroundColor Green
    $added | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "All paths already in PATH or do not exist." -ForegroundColor Yellow
}

# dedupe PATH while preserving order
$currentPath = (($currentPath -split ";") | Where-Object { $_ -ne "" } | Select-Object -Unique) -join ";"
[Environment]::SetEnvironmentVariable("Path", $currentPath, "User")

################################################################################
# ---- System > Display Settings ----
################################################################################

Write-Host "`n=== Applying Display Settings ===" -ForegroundColor Cyan

# Disable Night Light auto-schedule (user can still toggle manually)
$bluelightPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\DefaultAccount\Current\default`$windows.data.bluelightreduction.settings\windows.data.bluelightreduction.settings"
# Night light strength and schedule are stored as binary blobs; disable auto-schedule via registry
$nightLightPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\DefaultAccount\Current\default`$windows.data.bluelightreduction.bluelightreductionstate\windows.data.bluelightreduction.bluelightreductionstate"

# Set display scaling to 100% (96 DPI) - only applies after logoff
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "LogPixels" -Type DWord -Value 96 -Force -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "Win8DpiScaling" -Type DWord -Value 1 -Force -ErrorAction SilentlyContinue

Write-Host "Display settings applied." -ForegroundColor Green



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
# ---- Personalization > Taskbar Settings ----
################################################################################

Write-Host "`n=== Applying Taskbar Settings ===" -ForegroundColor Cyan

$taskbarPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced"

# Hide Search box from taskbar (0=hidden, 1=icon, 2=search box)
Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Search" -Name "SearchboxTaskbarMode" -Type DWord -Value 0 -Force

# Hide Widgets button (0=hide, 1=show)
Set-ItemProperty -Path $taskbarPath -Name "TaskbarDa" -Type DWord -Value 0 -Force

# Hide Chat (Teams) button (0=hide, 1=show)
Set-ItemProperty -Path $taskbarPath -Name "TaskbarMn" -Type DWord -Value 0 -Force

# Hide Task View button (0=hide, 1=show)
Set-ItemProperty -Path $taskbarPath -Name "ShowTaskViewButton" -Type DWord -Value 0 -Force

# Hide Copilot button (0=hide, 1=show)
Set-ItemProperty -Path $taskbarPath -Name "ShowCopilotButton" -Type DWord -Value 0 -Force

# Taskbar alignment: Left (0=Left, 1=Center)
Set-ItemProperty -Path $taskbarPath -Name "TaskbarAl" -Type DWord -Value 0 -Force

# Hide recently opened items in Start, Jump Lists, and File Explorer (0=hide, 1=show)
Set-ItemProperty -Path $taskbarPath -Name "Start_TrackDocs" -Type DWord -Value 0 -Force

# Auto-hide taskbar (disabled by default, uncomment to enable)
# Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3" ...

# Never combine taskbar buttons (0=always combine, 1=when full, 2=never)
Set-ItemProperty -Path $taskbarPath -Name "TaskbarGlomLevel" -Type DWord -Value 0 -Force

# Show labels on taskbar buttons (0=large icons with labels, 1=small icons no labels)
Set-ItemProperty -Path $taskbarPath -Name "TaskbarSmallIcons" -Type DWord -Value 1 -Force

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

# Disable "Show recently opened items in Start" (already set above too)
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "Start_TrackDocs" -Type DWord -Value 0 -Force

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

# Disable transparency effects (already in performance section, but explicit for personalization)
Set-ItemProperty -Path $personalizePath -Name "EnableTransparency" -Type DWord -Value 0 -Force

# Show accent color on title bars and window borders
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\DWM" -Name "ColorPrevalence" -Type DWord -Value 1 -Force

Write-Host "Theme settings applied." -ForegroundColor Green



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

# Disable animation effects
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "UserPreferencesMask" ([byte[]](0x90, 0x12, 0x03, 0x80, 0x10, 0x00, 0x00, 0x00)) -Force -ErrorAction SilentlyContinue

# Disable Magnifier auto-start
Set-ItemProperty -Path "HKCU:\Software\Microsoft\ScreenMagnifier" -Name "FollowMouse" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue

Write-Host "Accessibility settings applied." -ForegroundColor Green



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
# ---- Sound Settings ----
################################################################################

Write-Host "`n=== Applying Sound Settings ===" -ForegroundColor Cyan

# Disable Windows startup sound
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Authentication\LogonUI\BootAnimation" -Name "DisableStartupSound" -Type DWord -Value 1 -Force -ErrorAction SilentlyContinue

# Set sound scheme to "No Sounds"
Set-ItemProperty -Path "HKCU:\AppEvents\Schemes" -Name "(Default)" -Value ".None" -Force

Write-Host "Sound settings applied." -ForegroundColor Green



################################################################################

Write-Host "`nSetup complete! Log off or reboot for all changes to take effect." -ForegroundColor Cyan

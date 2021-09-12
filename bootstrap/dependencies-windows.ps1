## Getting Started and All-in-one setup Script
# ================================
# Create Powershell Script Profile
# ================================
New-Item $profile -Type File -Force
if (!(Test-Path $profile)) {
    New-Item -Path $profile -Type File -Force
    Write-Host "Profile created."
} else {
    Write-Host "Profile already exists at $profile"
}

# ================================
# update time server in windows
# ================================
$NtpServers = "time.cloudflare.com,0x8 time.google.com,0x8 time.windows.com,0x8"

# Configure Windows Time service
w32tm /config /manualpeerlist:"$NtpServers" /syncfromflags:manual /update

# Restart service and resync
Restart-Service w32time
w32tm /resync

# Update registry so Windows Settings UI reflects the same list
Set-ItemProperty `
  -Path "HKLM:\SYSTEM\CurrentControlSet\Services\W32Time\Parameters" `
  -Name NtpServer `
  -Value $NtpServers

Restart-Service w32time

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
    # ---- Original ----
    'Clipchamp.Clipchamp',                  # [safe] Microsoft video editor, rarely used
    'Microsoft.3DViewer',                   # [safe] 3D model viewer, niche use
    'Microsoft.549981C3F5F10',              # [safe] Cortana standalone app
    'Microsoft.BingFinance',                # [safe] Bing stock/finance tracker widget
    'Microsoft.BingNews',                   # [safe] Bing news aggregator widget
    'Microsoft.BingSports',                 # [safe] Bing sports scores widget
    'Microsoft.BingWeather',                # [safe] Bing weather widget
    'Microsoft.GamingApp',                  # [caution] Xbox app hub - WARNING: needed to manage Xbox Game Pass subscriptions and game installs
    'Microsoft.GetHelp',                    # [safe] Microsoft support/help wizard
    'Microsoft.Getstarted',                 # [safe] Windows tips and welcome experience
    'Microsoft.MicrosoftOfficeHub',         # [safe] Office hub launcher, not needed if Office is installed separately
    'Microsoft.MicrosoftSolitaireCollection', # [safe] Bundled solitaire games with ads
    'Microsoft.MicrosoftStickyNotes',       # [caution] Desktop sticky notes - WARNING: if you use sticky notes for quick reminders, removing this deletes them
    'Microsoft.Office.OneNote',             # [caution] OneNote UWP app - WARNING: removes UWP version; desktop OneNote (Office) is unaffected
    'Microsoft.People',                     # [safe] Contact manager, mostly unused standalone
    'Microsoft.PowerAutomateDesktop',       # [safe] RPA/automation tool, unused by most consumers
    'Microsoft.SkypeApp',                   # [safe] Skype UWP, replaced by Teams
    'Microsoft.Todos',                      # [caution] Microsoft To Do task manager - WARNING: if you use To Do for task lists, removing this loses local access
    'Microsoft.WindowsAlarms',              # [caution] Clock, alarms and timers - WARNING: removes built-in alarm/timer/stopwatch/world clock
    'Microsoft.WindowsFeedbackHub',         # [safe] Sends feedback to Microsoft
    'Microsoft.WindowsMaps',                # [safe] Built-in Maps app, most use browser maps
    'Microsoft.WindowsSoundRecorder',       # [safe] Basic audio recorder
    'Microsoft.Xbox.TCUI',                  # [safe] Xbox text/chat UI overlay
    'Microsoft.XboxGameOverlay',            # [safe] Xbox Game Bar overlay popup
    'Microsoft.XboxGamingOverlay',          # [safe] Xbox Game Bar (Win+G) overlay
    'Microsoft.XboxIdentityProvider',       # [caution] Xbox sign-in provider - WARNING: breaks Xbox Live authentication for any Xbox/MS Store game
    'Microsoft.XboxSpeechToTextOverlay',    # [safe] Xbox voice-to-text chat overlay
    'Microsoft.YourPhone',                  # [safe] Phone Link companion app
    'Microsoft.ZuneMusic',                  # [caution] Groove Music / modern media player - WARNING: removes default music player; use VLC or other alternative first
    'Microsoft.ZuneVideo',                  # [caution] Movies & TV player - WARNING: removes default video player for purchased MS Store content
    'MicrosoftTeams',                       # [safe] Teams personal/consumer pre-install
    #### Merged from .build/windows-registry.ps1 ####
    'ACGMediaPlayer',                       # [safe] Pre-installed third-party media player
    'ActiproSoftwareLLC',                   # [safe] OEM demo UI control library
    'AdobeSystemsIncorporated.AdobePhotoshopExpress', # [safe] Adobe Photoshop Express freemium app
    'Amazon.com.Amazon',                    # [safe] Amazon Shopping app
    'AmazonVideo.PrimeVideo',               # [safe] Prime Video streaming app
    'Asphalt8Airborne',                     # [safe] Pre-installed racing game
    'AutodeskSketchBook',                   # [safe] Autodesk drawing app
    'CaesarsSlotsFreeCasino',               # [safe] Pre-installed casino game ad
    'COOKINGFEVER',                         # [safe] Pre-installed cooking game ad
    'CyberLinkMediaSuiteEssentials',        # [safe] OEM CyberLink media suite trial
    'Disney',                               # [safe] Disney+ streaming app
    'DisneyMagicKingdoms',                  # [safe] Pre-installed Disney game ad
    'DrawboardPDF',                         # [safe] PDF annotation app trial
    'Duolingo-LearnLanguagesforFree',       # [safe] Duolingo language learning app
    'EclipseManager',                       # [safe] OEM Eclipse IDE manager
    'Facebook',                             # [safe] Facebook app
    'FarmVille2CountryEscape',              # [safe] Pre-installed Zynga game ad
    'fitbit',                               # [safe] Fitbit companion app
    'Flipboard',                            # [safe] News aggregator app
    'HiddenCity',                           # [safe] Pre-installed hidden object game ad
    'HULULLC.HULUPLUS',                     # [safe] Hulu streaming app
    'iHeartRadio',                          # [safe] iHeartRadio streaming app
    'Instagram',                            # [safe] Instagram app
    'king.com.BubbleWitch3Saga',            # [safe] Pre-installed King game ad
    'king.com.CandyCrushSaga',              # [safe] Pre-installed King game ad
    'king.com.CandyCrushSodaSaga',          # [safe] Pre-installed King game ad
    'LinkedInforWindows',                   # [safe] LinkedIn app
    'MarchofEmpires',                       # [safe] Pre-installed strategy game ad
    'Microsoft.3DBuilder',                  # [safe] 3D model creation tool, discontinued
    'Microsoft.BingFoodAndDrink',           # [safe] Bing recipes/food widget
    'Microsoft.BingHealthAndFitness',       # [safe] Bing health tracker widget
    'Microsoft.BingTranslator',             # [safe] Bing translator widget
    'Microsoft.BingTravel',                 # [safe] Bing travel planner widget
    'Microsoft.Copilot',                    # [safe] Microsoft Copilot AI assistant app
    'Microsoft.Messaging',                  # [safe] Legacy SMS messaging app, replaced by Phone Link
    'Microsoft.Microsoft3DViewer',          # [safe] Alternate 3D viewer package name
    'Microsoft.MicrosoftJournal',           # [safe] Microsoft Journal inking/note app
    'Microsoft.MicrosoftPowerBIForWindows', # [safe] Power BI report viewer, not needed for most consumers
    'Microsoft.MixedReality.Portal',        # [safe] VR/AR Mixed Reality portal, useless without headset
    'Microsoft.MSPaint',                    # [caution] Classic MS Paint - WARNING: removes Paint; use Paint 3D or install separately if needed
    'Microsoft.NetworkSpeedTest',           # [safe] Bing network speed test
    'Microsoft.News',                       # [safe] Microsoft News aggregator (Start menu feed)
    'Microsoft.Office.Sway',               # [safe] Sway presentation app, rarely used
    'Microsoft.OneConnect',                 # [safe] Paid Wi-Fi & cellular manager, rarely needed
    'Microsoft.OneDrive',                   # [caution] OneDrive cloud sync client - WARNING: if you sync files to OneDrive, removing this stops cloud backup and may lose unsynced files
    'Microsoft.OutlookForWindows',          # [caution] New Outlook app (replacing Mail & Calendar) - WARNING: if you rely on built-in Mail app, this removes it
    'Microsoft.Paint',                      # [caution] Modern Paint app - WARNING: same as MSPaint, removes the drawing tool
    'Microsoft.Print3D',                    # [safe] 3D printing slicer companion, niche use
    'Microsoft.WindowsCalculator',          # [caution] Built-in Calculator - WARNING: removes Calculator; install a replacement first (e.g. via winget)
    'Microsoft.WindowsCamera',              # [caution] Camera app - WARNING: removes camera/webcam capture app; needed if you use the built-in camera
    'Microsoft.windowscommunicationsapps',  # [caution] Mail & Calendar apps - WARNING: removes built-in Mail and Calendar; use Outlook or other client first
    'MicrosoftCorporationII.MicrosoftFamily', # [safe] Microsoft Family Safety parental controls
    'MicrosoftCorporationII.QuickAssist',   # [safe] Remote assistance tool
    'MSTeams',                              # [safe] Teams (new) pre-install, alternate package name
    'Netflix',                              # [safe] Netflix streaming app
    'NYTCrossword',                         # [safe] NY Times crossword game
    'OneCalendar',                          # [safe] Third-party calendar widget
    'PandoraMediaInc',                      # [safe] Pandora music streaming app
    'PhototasticCollage',                   # [safe] OEM photo collage maker
    'PicsArt-PhotoStudio',                  # [safe] PicsArt photo editor
    'Plex',                                 # [safe] Plex media player app
    'PolarrPhotoEditorAcademicEdition',     # [safe] Polarr photo editor trial
    'Royal Revolt',                         # [safe] Pre-installed strategy game ad
    'Shazam',                               # [safe] Shazam music identification app
    'Sidia.LiveWallpaper',                  # [safe] OEM live wallpaper app
    'SlingTV',                              # [safe] Sling TV streaming app
    'Spotify',                              # [safe] Spotify music app pre-install (can reinstall from Store)
    'TikTok',                               # [safe] TikTok short video app
    'TuneInRadio',                          # [safe] TuneIn radio streaming app
    'Twitter',                              # [safe] Twitter/X app
    'Viber',                                # [safe] Viber messaging app
    'WinZipUniversal',                      # [safe] WinZip trial, use 7-Zip instead
    'Wunderlist',                           # [safe] Deprecated to-do app (replaced by Microsoft To Do)
    'XING'                                  # [safe] XING professional network app
) | Sort-Object -Unique

foreach ($app in $appsToRemove) {
    Write-Host "Uninstalling: $app"
    Get-AppxPackage -Name $app -ErrorAction SilentlyContinue |
        Remove-AppxPackage -ErrorAction SilentlyContinue
}

Write-Host "App cleanup complete." -ForegroundColor Green

# Remove Windows Widget, OneDrive, Cortana packages
Get-AppxPackage *WebExperience* | Remove-AppxPackage -ErrorAction SilentlyContinue
Get-AppxPackage *Cortana* | Remove-AppxPackage -ErrorAction SilentlyContinue

try {
    Get-AppxPackage *OneDrive* | Remove-AppxPackage -ErrorAction SilentlyContinue
    Remove-Item -Path "$env:UserProfile\OneDrive" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "C:\Users\$env:UserName\AppData\Local\Microsoft\OneDrive" -Recurse -Force -ErrorAction SilentlyContinue
    Stop-Process -Name "OneDrive" -Force -ErrorAction SilentlyContinue
} catch {
    Write-Output "OneDrive removal error: $_"
}



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

# Disable Cortana for current user
Set-ItemProperty -Path "HKCU:\Software\Policies\Microsoft\Windows\Explorer" -Name "AllowCortana" -Type DWord -Value 0 -Force
# Stop Bing web results from appearing in Start Menu search
Set-ItemProperty -Path "HKCU:\Software\Policies\Microsoft\Windows\Explorer" -Name "DisableSearchBoxSuggestions" -Type DWord -Value 1 -Force
# Disable Cortana system-wide via group policy
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Search" -Name "AllowCortana" -Type DWord -Value 0 -Force

# Hide the Widgets button (news/weather feed) from taskbar
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarDa" -Type DWord -Value 0 -Force

Write-Host "Cortana + Search hardened." -ForegroundColor Green

# --------------------------------
# Explorer Tweaks
# --------------------------------

Write-Host "`nApplying Explorer tweaks..." -ForegroundColor Yellow

# Show file extensions (.txt, .exe, .jpg, etc.) in Explorer
Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "HideFileExt" -Type DWord -Value 0 -Force
# Show drives even when they have no media inserted (e.g. empty card readers)
Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "HideDrivesWithNoMedia" -Type DWord -Value 0 -Force
# Hide the Task View button (virtual desktops timeline) from taskbar
Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "ShowTaskViewButton" -Type DWord -Value 0 -Force

# Stop Bing web results in Start Menu search (machine-wide policy, complements HKCU above)
$hklmExplorer = "HKLM:\Software\Policies\Microsoft\Windows\Explorer"
if (-not (Test-Path $hklmExplorer)) {
    New-Item -Path $hklmExplorer -Force | Out-Null
}
Set-ItemProperty -Path $hklmExplorer -Name "DisableSearchBoxSuggestions" -Type DWord -Value 1 -Force

Write-Host "Explorer tweaks applied." -ForegroundColor Green

# --------------------------------
# Privacy Hardening
# --------------------------------

Write-Host "`nApplying privacy settings..." -ForegroundColor Yellow

# Stop sending typing/writing data to Microsoft for improving suggestions
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

# Stop scanning contacts and sending them to Microsoft for speech recognition
$trainKey = "HKCU:\SOFTWARE\Microsoft\InputPersonalization\TrainedDataStore"
if (-not (Test-Path $trainKey)) { New-Item -Path $trainKey -Force | Out-Null }
Set-ItemProperty -Path $trainKey -Name "HarvestContacts" -Type DWord -Value 0 -Force

# Prevent websites from accessing your language list for locale-targeted content
Set-ItemProperty -Path "HKCU:\Control Panel\International\User Profile" -Name "HttpAcceptLanguageOptOut" -Type DWord -Value 1 -Force

# Disable network-based default printer switching (location-aware printing)
$printerKey = "HKCU:\Printers\Defaults"
if (-not (Test-Path $printerKey)) { New-Item -Path $printerKey -Force | Out-Null }
Set-ItemProperty -Path $printerKey -Name "NetID" -Value "{00000000-0000-0000-0000-000000000000}" -Force

# Block implicit ink and handwriting data collection for personalization
$inputKey = "HKCU:\SOFTWARE\Microsoft\InputPersonalization"
if (-not (Test-Path $inputKey)) { New-Item -Path $inputKey -Force | Out-Null }
Set-ItemProperty -Path $inputKey -Name "RestrictImplicitInkCollection" -Type DWord -Value 1 -Force
# Block implicit text input data collection for personalization
Set-ItemProperty -Path $inputKey -Name "RestrictImplicitTextCollection" -Type DWord -Value 1 -Force

# Never prompt user for Windows feedback (0 = never)
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "FeedbackFrequency" -Type DWord -Value 0 -Force

Write-Host "Privacy settings applied." -ForegroundColor Green

# --------------------------------
# Microsoft Edge (Legacy UWP) Privacy
# --------------------------------

Write-Host "`nApplying legacy Edge UWP settings..." -ForegroundColor Yellow

$edgeBase = "HKCU:\SOFTWARE\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppContainer\Storage\microsoft.microsoftedge_8wekyb3d8bbwe\MicrosoftEdge"

$edgePaths = @{
    "$edgeBase\Main"                        = @{ "DoNotTrack" = 1 }        # Send Do Not Track header to websites
    "$edgeBase\User\Default\SearchScopes"   = @{ "ShowSearchSuggestionsGlobal" = 0 } # Disable search suggestions sending keystrokes to Bing
    "$edgeBase\FlipAhead"                   = @{ "FPEnabled" = 0 }         # Disable page prediction/pre-fetching (sends browsing data to MS)
    "$edgeBase\PhishingFilter"              = @{ "EnabledV9" = 0 }         # Disable SmartScreen phishing filter (sends URLs to MS)
}

foreach ($path in $edgePaths.Keys) {
    if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
    foreach ($name in $edgePaths[$path].Keys) {
        Set-ItemProperty -Path $path -Name $name -Type DWord -Value $edgePaths[$path][$name] -Force
    }
}

Write-Host "Legacy Edge settings applied." -ForegroundColor Green

# --------------------------------
# Disable Game DVR / Game Bar Overlay
# --------------------------------

Write-Host "`nDisabling Game DVR..." -ForegroundColor Yellow

$gameDvrKey = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\GameDVR"
if (-not (Test-Path $gameDvrKey)) { New-Item -Path $gameDvrKey -Force | Out-Null }
# Disable background game clip recording and screenshots
Set-ItemProperty -Path $gameDvrKey -Name "AppCaptureEnabled" -Type DWord -Value 0 -Force
# Disable Game DVR (Win+G game bar recording feature) entirely
Set-ItemProperty -Path $gameDvrKey -Name "AllowGameDVR" -Type DWord -Value 0 -Force

Write-Host "Game DVR disabled." -ForegroundColor Green

# --------------------------------
# Disable Windows Telemetry / Tracking
# --------------------------------

Write-Host "`nDisabling telemetry services & tasks..." -ForegroundColor Yellow

$telemetryKey = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection"
if (-not (Test-Path $telemetryKey)) {
    New-Item -Path $telemetryKey -Force | Out-Null
}

# Set telemetry to Security-only (0 = no optional diagnostic data sent to MS)
Set-ItemProperty -Path $telemetryKey -Name "AllowTelemetry" -Type DWord -Value 0

$services = @(
    "DiagTrack",                                  # Connected User Experiences and Telemetry service
    "DmWappushService",                           # WAP Push Message Routing (telemetry relay)
    "diagnosticshub.standardcollector.service"     # Diagnostics Hub data collector
)

foreach ($svc in $services) {
    Write-Host "Stopping + disabling: $svc"
    Stop-Service $svc -Force -ErrorAction SilentlyContinue
    Set-Service $svc -StartupType Disabled -ErrorAction SilentlyContinue
}

$scheduledTasks = @(
    "\Microsoft\Windows\Customer Experience Improvement Program\", # CEIP data collection tasks
    "\Microsoft\Windows\Application Experience\",                  # App compatibility telemetry (ProgramDataUpdater, AitAgent)
    "\Microsoft\Windows\Autochk\",                                 # Disk check telemetry proxy
    "\Microsoft\Windows\Feedback\"                                 # Feedback Hub scheduled prompts
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

# Block Recall from analyzing screen content with AI
Set-ItemProperty -Path $recallKey -Name "DisableAIDataAnalysis" -Type DWord -Value 1
# Block Recall from taking periodic screenshots of your desktop
Set-ItemProperty -Path $recallKey -Name "DisableCapture" -Type DWord -Value 1

$recallServices = @(
    "Recall",                   # Main Recall screenshot history service
    "DesktopAIClientService",   # Desktop AI analysis client
    "RecallSnapshot"            # Periodic screenshot capture service
)

foreach ($svc in $recallServices) {
    Stop-Service $svc -Force -ErrorAction SilentlyContinue
    Set-Service $svc -StartupType Disabled -ErrorAction SilentlyContinue
}

# Disable Windows Copilot AI assistant via group policy
$copilotKey = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot"
if (-not (Test-Path $copilotKey)) {
    New-Item -Path $copilotKey -Force | Out-Null
}
Set-ItemProperty -Path $copilotKey -Name "TurnOffWindowsCopilot" -Type DWord -Value 1 -Force

# Remove Copilot button from taskbar
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "ShowCopilotButton" -Type DWord -Value 0 -Force

# Redundant Recall kill-switch via WindowsAI policy (belt-and-suspenders with above)
$recallKey = "HKLM:\Software\Policies\Microsoft\Windows\WindowsAI"
if (-not (Test-Path $recallKey)) {
    New-Item -Path $recallKey -Force | Out-Null
}
Set-ItemProperty -Path $recallKey -Name "DisableAIDataAnalysis" -Type DWord -Value 1 -Force

# Disable Timeline / Activity History - stops Windows from tracking app and browsing activity
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" -Name "EnableActivityFeed" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue
# Stop publishing user activities to Microsoft cloud (used by Timeline and cross-device sync)
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" -Name "PublishUserActivities" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue
# Stop uploading user activity history to Microsoft servers
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" -Name "UploadUserActivities" -Type DWord -Value 0 -Force -ErrorAction SilentlyContinue



Write-Host "Recall disabled successfully." -ForegroundColor Green


# ================================================================================================
#  PERFORMANCE OPTIMIZATIONS
# ================================================================================================

Write-Host "`nApplying performance optimizations..." -ForegroundColor Yellow

# Set visual effects to "Adjust for best performance" (2 = custom/performance, disables most eye candy)
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" -Name "VisualFXSetting" -Type DWord -Value 2 -Force

# Disable window minimize/maximize animations
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop\WindowMetrics" -Name "MinAnimate" -Type String -Value "0" -Force
# Disable taskbar button animations (fade, slide effects)
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarAnimations" -Type DWord -Value 0 -Force

# Disable Aero transparency/blur effects (reduces GPU compositing overhead)
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" -Name "EnableTransparency" -Type DWord -Value 0 -Force

# Prioritize foreground programs over background services (38 = short, variable, high fg boost)
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl" -Name "Win32PrioritySeparation" -Type DWord -Value 38 -Force

# Remove the 10-second startup delay Windows adds before launching startup programs
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
    "0.0.0.0 telemetry.microsoft.com",
    # ads
    "0.0.0.0 ads-api.twitter.com",
    "0.0.0.0 ads-dev.pinterest.com",
    "0.0.0.0 ads.facebook.com",
    "0.0.0.0 ads.google.com",
    "0.0.0.0 ads.pinterest.com",
    "0.0.0.0 ads.reddit.com",
    "0.0.0.0 ads.tiktok.com",
    "0.0.0.0 ads.youtube.com",
    "0.0.0.0 adservice.google.com",
    "0.0.0.0 adtago.s3.amazonaws.com",
    "0.0.0.0 adtechus.com",
    "0.0.0.0 advertising-api-eu.amazon.com",
    "0.0.0.0 advertising.twitter.com",
    "0.0.0.0 advice-ads.s3.amazonaws.com",
    "0.0.0.0 affiliationjs.s3.amazonaws.com",
    "0.0.0.0 amazonaax.com",
    "0.0.0.0 analyticsengine.s3.amazonaws.com",
    "0.0.0.0 api.bugsnag.com",
    "0.0.0.0 app.bugsnag.com",
    "0.0.0.0 app.getsentry.com",
    "0.0.0.0 browser.sentry-cdn.com",
    "0.0.0.0 business.samsungusa.com",
    "0.0.0.0 criteo.net",
    "0.0.0.0 marvelpixel.io",
    "0.0.0.0 notify.bugsnag.com",
    "0.0.0.0 rubiconproject.com",
    "0.0.0.0 sessions.bugsnag.com",
    "0.0.0.0 track-server.net",
    "0.0.0.0 widgets.pinterest.com",
    "0.0.0.0 youtube.cleverads.vn",
    "                                                    " # intentionally empty
) |
Where-Object { $_ -and $_.Trim() } |
Sort-Object -Unique

$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$tempPath  = "C:\temp-host.txt"

Write-Host "`nUpdating HOSTS file..." -ForegroundColor Cyan
# Copy current host file to temp location
if (Test-Path $hostsPath) {
    Copy-Item -Path $hostsPath -Destination $tempPath -Force
    $currentContent = Get-Content $tempPath
} else {
    Write-Error "Original hosts file not found!"
    return
}

# Extract just the hostnames from existing file for comparison
# This regex matches the end of the line, ignoring the IP part
$existingHostnames = $currentContent | Where-Object { $_ -match '^\s*[0-9\.]+\s+(?<host>\S+)' } | ForEach-Object { $Matches.host.ToLower().Trim() }

# Filter new entries to ensure uniqueness
$uniqueNewEntries = @()

foreach ($entry in $entriesToAdd) {
    # Clean the entry and extract the hostname (the part after the IP)
    $cleanEntry = $entry.Trim()
    if ($cleanEntry -match '\s+(?<host>\S+)$') {
        $hostName = $Matches.host.ToLower().Trim()

        if ($existingHostnames -notcontains $hostName) {
            $uniqueNewEntries += $cleanEntry
            # Add to list so we don't add the same host twice within the same run
            $existingHostnames += $hostName
        } else {
            Write-Host "Skipping duplicate: $hostName" -ForegroundColor Yellow
        }
    }
}

# Merge and Update
if ($uniqueNewEntries.Count -gt 0) {
    Add-Content -Path $tempPath -Value "`n# Added by Script $(Get-Date)"
    Add-Content -Path $tempPath -Value $uniqueNewEntries

    try {
        # Overwrite original host file (Requires Admin)
        Move-Item -Path $tempPath -Destination $hostsPath -Force
        Write-Host "Successfully updated HOSTS file with $($uniqueNewEntries.Count) new entries." -ForegroundColor Green
    } catch {
        Write-Error "Failed to write to $hostsPath. Please ensure you are running as Administrator."
    }
} else {
    Write-Host "No new unique entries to add." -ForegroundColor Gray
    Remove-Item -Path $tempPath -ErrorAction SilentlyContinue
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

# --- COPILOT (reg add fallback - ensures values persist even if PS cmdlets fail) ---
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot" /v TurnOffWindowsCopilot /t REG_DWORD /d 1 /f  # Disable Copilot via policy
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot" /v CopilotAllowed /t REG_DWORD /d 0 /f         # Block Copilot from being enabled
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v ShowCopilotButton /t REG_DWORD /d 0 /f  # Hide Copilot taskbar button

# --- RECALL (reg add fallback) ---
dism /online /disable-feature /featurename:Recall /norestart  # Remove Recall Windows feature entirely
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\System" /v DisableAIDataAnalysis /t REG_DWORD /d 1 /f  # Block AI-powered screen analysis

# --- TIMELINE (reg add fallback) ---
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\System" /v EnableActivityFeed /t REG_DWORD /d 0 /f       # Disable Timeline activity feed
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\System" /v PublishUserActivities /t REG_DWORD /d 0 /f    # Stop publishing activity to MS cloud
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\System" /v UploadUserActivities /t REG_DWORD /d 0 /f     # Stop uploading activity history

# --- EDGE (Chromium) POLICY ---
$edgeKey = "HKLM:\SOFTWARE\Policies\Microsoft\Edge"
if (-not (Test-Path $edgeKey)) {
    New-Item -Path $edgeKey -Force | Out-Null
}

# Disable Edge sidebar panel (Bing Chat, Discover, Shopping, etc.)
Set-ItemProperty -Path $edgeKey -Name "HubsSidebarEnabled" -Type DWord -Value 0 -Force
# Disable Copilot integration in Edge browser
Set-ItemProperty -Path $edgeKey -Name "EdgeCopilotEnabled" -Type DWord -Value 0 -Force
# Disable Edge diagnostic/telemetry data collection
Set-ItemProperty -Path $edgeKey -Name "DiagnosticData" -Type DWord -Value 0 -Force
# Disable Edge personalization data reporting to Microsoft
Set-ItemProperty -Path $edgeKey -Name "PersonalizationReportingEnabled" -Type DWord -Value 0 -Force
# Disable Edge user feedback prompts
Set-ItemProperty -Path $edgeKey -Name "UserFeedbackAllowed" -Type DWord -Value 0 -Force
# reg add fallbacks for the same Edge policies
reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge" /v HubsSidebarEnabled /t REG_DWORD /d 0 /f   # Sidebar off
reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge" /v EdgeCopilotEnabled /t REG_DWORD /d 0 /f    # Edge Copilot off
reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge" /v DiagnosticData /t REG_DWORD /d 0 /f        # Edge telemetry off

# --- PREVENT WINDOWS UPDATE FROM RE-ENABLING FEATURES ---
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate" /v DisableWUfBSafeguards /t REG_DWORD /d 1 /f  # Stop WU from rolling back privacy settings via safeguard holds

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
#  winget install & upgrade
# ================================

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

Write-Host "`nInstalling winget packages..." -ForegroundColor Cyan
foreach ($pkg in $wingetPackages) {
    Write-Host "Installing: $pkg"
    winget install --id $pkg -e --accept-source-agreements --accept-package-agreements 2>$null
}

Write-Host "`nUpgrading all winget packages..." -ForegroundColor Cyan
winget upgrade --all --include-unknown

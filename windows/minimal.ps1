function New-FolderForced {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param (
    [Parameter(Position = 0, Mandatory, ValueFromPipeline, ValueFromPipelineByPropertyName)]
    [string]
        $Path
    )

    process {
        if (-not (Test-Path $Path)) {
            Write-Verbose "-- Creating full path to:  $Path"
            New-Item -Path $Path -ItemType Directory -Force
        }
    }
}

# disable hibernate and fast startup
powercfg /h off

# remove windows widget
winget uninstall –id 9MSSGKG348SP

# important registry
function Do-Tune-Registry() {
    Write-Output "Disable Web Search for Start Menu Search"
    New-FolderForced -Path "HKLM:\Software\Policies\Microsoft\Windows\Explorer"
    Set-ItemProperty -Path "HKLM:\Software\Policies\Microsoft\Windows\Explorer" "DisableSearchBoxSuggestions" 1

    Write-Output "Showing hidden extensions and drive with no media"
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "HideFileExt" 0
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "HideDrivesWithNoMedia" 0

    #minor twekas
    Write-Output "Explorer Tweaks - Enabling file extensions for known file types"
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "HideFileExt" 0

    Write-Output "Other minor style tweaks"
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "ShowTaskViewButton" 0
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "HideDrivesWithNoMedia" 0

    #privacy
    Write-Output "Send Microsoft info about how I write to help us improve typing and writing in the future"
    New-FolderForced -Path "HKCU:\SOFTWARE\Microsoft\Input\TIPC"
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Input\TIPC" "Enabled" 0

    Write-Output "Let apps use my advertising ID for experiencess across apps"
    New-FolderForced -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\AdvertisingInfo"
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\AdvertisingInfo" "Enabled" 0

    Write-Output "Set privacy policy accepted state to 0 - Prevents sending speech, inking and typing samples to MS (so Cortana can learn to recognise you)"
    New-FolderForced -Path "HKCU:\SOFTWARE\Microsoft\Personalization\Settings"
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Personalization\Settings" "AcceptedPrivacyPolicy" 0

    Write-Output "Do not scan contact informations - Prevents sending contacts to MS (so Cortana can compare speech etc samples)"
    New-FolderForced -Path "HKCU:\SOFTWARE\Microsoft\InputPersonalization\TrainedDataStore"
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\InputPersonalization\TrainedDataStore" "HarvestContacts" 0


    Write-Output "Let websites provide locally relevant content by accessing my language list"
    Set-ItemProperty -Path "HKCU:\Control Panel\International\User Profile" "HttpAcceptLanguageOptOut" 1
    Write-Output "Locaton aware printing (changes default based on connected network)"
    New-FolderForced -Path "HKCU:\Printers\Defaults"
    Set-ItemProperty -Path "HKCU:\Printers\Defaults" "NetID" "{00000000-0000-0000-0000-000000000000}"

    Write-Output "Inking and typing settings - Handwriting recognition personalization"
    New-FolderForced -Path "HKCU:\SOFTWARE\Microsoft\InputPersonalization"
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\InputPersonalization" "RestrictImplicitInkCollection" 1
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\InputPersonalization" "RestrictImplicitTextCollection" 1

    Write-Output "Microsoft Edge settings"
    New-FolderForced -Path "HKCU:\SOFTWARE\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppContainer\Storage\microsoft.microsoftedge_8wekyb3d8bbwe\MicrosoftEdge\Main"
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppContainer\Storage\microsoft.microsoftedge_8wekyb3d8bbwe\MicrosoftEdge\Main" "DoNotTrack" 1
    New-FolderForced -Path "HKCU:\SOFTWARE\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppContainer\Storage\microsoft.microsoftedge_8wekyb3d8bbwe\MicrosoftEdge\User\Default\SearchScopes"
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppContainer\Storage\microsoft.microsoftedge_8wekyb3d8bbwe\MicrosoftEdge\User\Default\SearchScopes" "ShowSearchSuggestionsGlobal" 0
    New-FolderForced -Path "HKCU:\SOFTWARE\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppContainer\Storage\microsoft.microsoftedge_8wekyb3d8bbwe\MicrosoftEdge\FlipAhead"
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppContainer\Storage\microsoft.microsoftedge_8wekyb3d8bbwe\MicrosoftEdge\FlipAhead" "FPEnabled" 0
    New-FolderForced -Path "HKCU:\SOFTWARE\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppContainer\Storage\microsoft.microsoftedge_8wekyb3d8bbwe\MicrosoftEdge\PhishingFilter"
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppContainer\Storage\microsoft.microsoftedge_8wekyb3d8bbwe\MicrosoftEdge\PhishingFilter" "EnabledV9" 0

    # Disable telemetry and background tracking services
    Write-Host "Disabling telemetry and tracking..." -ForegroundColor Yellow
    Set-ItemProperty -Path "HKLM:\Software\Policies\Microsoft\Windows\DataCollection" -Name "AllowTelemetry" -Value 0 -Force
    Stop-Service -Name "DiagTrack" -ErrorAction SilentlyContinue
    Set-Service -Name "DiagTrack" -StartupType Disabled -ErrorAction SilentlyContinue

    # Disable Cortana
    Write-Host "Disabling Cortana..." -ForegroundColor Yellow
    Set-ItemProperty -Path "HKLM:\Software\Policies\Microsoft\Windows\Windows Search" -Name "AllowCortana" -Value 0 -Force

    # Disable transparency effects
    Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" -Name "EnableTransparency" -Value 0
}


# remove bloatware
function Do-Remove-Bloatwares {
    $bloatwareApps = @(
        "ACGMediaPlayer",
        "ActiproSoftwareLLC",
        "AdobeSystemsIncorporated.AdobePhotoshopExpress",
        "Amazon.com.Amazon",
        "AmazonVideo.PrimeVideo",
        "Asphalt8Airborne",
        "AutodeskSketchBook",
        "CaesarsSlotsFreeCasino",
        "Clipchamp.Clipchamp",
        "COOKINGFEVER",
        "CyberLinkMediaSuiteEssentials",
        "Disney",
        "DisneyMagicKingdoms",
        "DrawboardPDF",
        "Duolingo-LearnLanguagesforFree",
        "EclipseManager",
        "Facebook",
        "FarmVille2CountryEscape",
        "fitbit",
        "Flipboard",
        "HiddenCity",
        "HULULLC.HULUPLUS",
        "iHeartRadio",
        "Instagram",
        "king.com.BubbleWitch3Saga",
        "king.com.CandyCrushSaga",
        "king.com.CandyCrushSodaSaga",
        "LinkedInforWindows",
        "MarchofEmpires",
        "Microsoft.3DBuilder",
        "Microsoft.549981C3F5F10",
        "Microsoft.BingFinance",
        "Microsoft.BingFoodAndDrink",
        "Microsoft.BingHealthAndFitness",
        "Microsoft.BingNews",
        "Microsoft.BingSports",
        "Microsoft.BingTranslator",
        "Microsoft.BingTravel",
        "Microsoft.BingWeather",
        "Microsoft.Copilot",
        "Microsoft.GetHelp",
        "Microsoft.Getstarted",
        "Microsoft.Messaging",
        "Microsoft.Microsoft3DViewer",
        "Microsoft.MicrosoftJournal",
        "Microsoft.MicrosoftOfficeHub",
        "Microsoft.MicrosoftPowerBIForWindows",
        "Microsoft.MicrosoftSolitaireCollection",
        "Microsoft.MicrosoftStickyNotes",
        "Microsoft.MixedReality.Portal",
        "Microsoft.MSPaint",
        "Microsoft.NetworkSpeedTest",
        "Microsoft.News",
        "Microsoft.Office.OneNote",
        "Microsoft.Office.Sway",
        "Microsoft.OneConnect",
        "Microsoft.OneDrive",
        "Microsoft.OutlookForWindows",
        "Microsoft.Paint",
        "Microsoft.People",
        "Microsoft.People",
        "Microsoft.PowerAutomateDesktop",
        "Microsoft.Print3D",
        "Microsoft.SkypeApp",
        "Microsoft.Todos",
        "Microsoft.WindowsAlarms",
        "Microsoft.WindowsCalculator",
        "Microsoft.WindowsCamera",
        "Microsoft.windowscommunicationsapps",
        "Microsoft.WindowsFeedbackHub",
        "Microsoft.WindowsMaps",
        "Microsoft.WindowsSoundRecorder",
        "Microsoft.ZuneMusic",
        "Microsoft.ZuneMusic",
        "Microsoft.ZuneVideo",
        "MicrosoftCorporationII.MicrosoftFamily",
        "MicrosoftCorporationII.QuickAssist",
        "MicrosoftTeams",
        "MSTeams",
        "Netflix",
        "NYTCrossword",
        "OneCalendar",
        "PandoraMediaInc",
        "PhototasticCollage",
        "PicsArt-PhotoStudio",
        "Plex",
        "PolarrPhotoEditorAcademicEdition",
        "Royal Revolt",
        "Shazam",
        "Sidia.LiveWallpaper",
        "SlingTV",
        "Spotify",
        "TikTok",
        "TuneInRadio",
        "Twitter",
        "Viber",
        "WinZipUniversal",
        "Wunderlist",
        "XING",
        "___placeholder_for_last_app___"
    )

    foreach ($app in $bloatwareApps) {
        Write-Host "Removing $app..." -ForegroundColor Yellow
        Get-AppxPackage -Name $app -AllUsers | Remove-AppxPackage -ErrorAction SilentlyContinue
        Get-AppxProvisionedPackage -Online | Where-Object DisplayName -eq $app | Remove-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue
    }

    # remove windows widget
    Get-AppxPackage *WebExperience* | Remove-AppxPackage
}

# all the scripts to run
Do-Tune-Registry
Do-Remove-Bloatwares

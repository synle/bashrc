#!/usr/bin/env pwsh
################################################################################
# windows/windows.ps1 - Windows software installation and PATH configuration.
#
# Prerequisites: Run windows-bootstrap.ps1 first on a fresh install.
#
# Run as Administrator:
# ----  Set-Executionpolicy Unrestricted -Scope Currentuser ----
# ----  .\Software\Bootstrap\Dependencies/Windows.Ps1 ----
#
# Sections:
#   INITIAL SETUP
#     - Wsl Setup
#     - Add Known Paths To Path If They Exist
#   NETWORK BLOCKING
#     - Hosts File Blocking
#     - Firewall Blocking
#   SOFTWARE INSTALLATION (slow — runs last)
#     - Winget Install & Upgrade
#       - Essential packages (blocking)
#       - Background packages (parallel)
#     - Install Media Extensions (Microsoft Store)
#     - Install TranslucentTB (appinstaller, last - requires user interaction)
#     - Brave Browser Shortcut Flags
################################################################################

# Disable progress bars to speed up Invoke-WebRequest
$ProgressPreference = 'SilentlyContinue'



################################################################################
# ---- Wsl Setup ----
################################################################################

Write-Host "`n=== Setting up WSL ===" -ForegroundColor Cyan

wsl --update
wsl --set-default-version 2

# Auto-shutdown WSL when laptop enters sleep (Event ID 42 = entering sleep)
$taskName = "_Sy_WSL_Shutdown_On_Sleep"
schtasks /Delete /TN $taskName /F 2>$null
$taskXml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <EventTrigger>
      <Subscription>&lt;QueryList&gt;&lt;Query Id="0" Path="System"&gt;&lt;Select Path="System"&gt;*[System[Provider[@Name='Microsoft-Windows-Kernel-Power'] and EventID=42]]&lt;/Select&gt;&lt;/Query&gt;&lt;/QueryList&gt;</Subscription>
    </EventTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Actions>
    <Exec>
      <Command>wsl.exe</Command>
      <Arguments>--shutdown</Arguments>
    </Exec>
  </Actions>
  <Settings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <ExecutionTimeLimit>PT30S</ExecutionTimeLimit>
  </Settings>
</Task>
"@
$taskXmlPath = "$env:TEMP\_sy_wsl_sleep_task.xml"
$taskXml | Out-File -Encoding Unicode -FilePath $taskXmlPath
schtasks /Create /TN $taskName /XML $taskXmlPath /F | Out-Null
Remove-Item $taskXmlPath -ErrorAction SilentlyContinue
Write-Host "Registered task: $taskName" -ForegroundColor Green

Write-Host "WSL setup complete." -ForegroundColor Green



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
# ---- Hosts File Blocking ----
################################################################################

Write-Host "`n=== Updating HOSTS File ===" -ForegroundColor Cyan

# Fetch blocked hosts from the central config (single source of truth for all platforms)
$configUrl = "https://github.com/synle/bashrc/blob/HEAD/software/metadata/hosts-blocked-manual.consolidated.config?raw=1"
try {
    $rawConfig = (Invoke-WebRequest -Uri $configUrl -UseBasicParsing).Content
} catch {
    Write-Host "Skipped: Failed to fetch hosts config. Error: $_" -ForegroundColor Yellow
    $rawConfig = ""
}

if ($rawConfig) {
    # Parse config: strip // comments and blank lines, dedupe, prefix with 0.0.0.0
    $entriesToAdd = $rawConfig -split "`n" |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -and -not $_.StartsWith("//") } |
        ForEach-Object { $_.ToLower() } |
        Sort-Object -Unique |
        ForEach-Object { "0.0.0.0 $_" }

    $hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
    $tempPath  = "C:\temp-host.txt"

    if (Test-Path $hostsPath) {
        Copy-Item -Path $hostsPath -Destination $tempPath -Force
        $currentContent = Get-Content $tempPath
    } else {
        Write-Error "Original hosts file not found!"
        $currentContent = @()
    }

    $existingHostnames = $currentContent |
        Where-Object { $_ -match '^\s*[0-9\.]+\s+(?<host>\S+)' } |
        ForEach-Object { $Matches.host.ToLower().Trim() }
    $uniqueNewEntries = @()

    foreach ($entry in $entriesToAdd) {
        if ($entry -match '\s+(?<host>\S+)$') {
            $hostName = $Matches.host.ToLower().Trim()
            if ($existingHostnames -notcontains $hostName) {
                $uniqueNewEntries += $entry
                $existingHostnames += $hostName
            }
        }
    }

    if ($uniqueNewEntries.Count -gt 0) {
        Add-Content -Path $tempPath -Value "`n# Added by windows/windows.ps1 $(Get-Date)"
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
}



################################################################################
# ---- Firewall Blocking ----
################################################################################

Write-Host "`n=== Applying Firewall Rules ===" -ForegroundColor Cyan

# --- Block telemetry IPs (all network profiles) ---
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

# --- Block Office14 executables (all network profiles) ---
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

# --- Block all Adobe executables (all network profiles) ---
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

# --- Allow inbound ports for local dev, AI, and DB services (Private network only) ---
# To set a network as Private: Settings > Network & Internet > Wi-Fi/Ethernet > Private network
$allowRules = @(
    @{
        Name = "_Sy_ALLOW_DevStack"
        Desc = "Dev servers, databases, backends, and standard services"
        Ports = @(
            22,           # SSH
            80,           # HTTP (local nginx, Apache, Docker)
            443,          # HTTPS (mkcert, self-signed, Docker)
            1433,         # SQL Server
            "3000-9999",  # dev servers, MySQL, Postgres, Redis, backends, Jupyter, Portainer, Temporal (7233 gRPC, 8233 UI), etc.
            11434,        # Ollama REST API
            27017         # MongoDB
        )
    }
)
foreach ($rule in $allowRules) {
    Remove-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Protocol TCP `
        -LocalPort $rule.Ports -Action Allow -Profile Private -Description $rule.Desc | Out-Null
    Write-Host "Applied: $($rule.Name)" -ForegroundColor Green
}

Write-Host "Firewall rules applied." -ForegroundColor Green



################################################################################
# ---- Winget Install & Upgrade ----
# NOTE: Winget installs are slow (~1-2s per package check + download time).
# Keep this section last so faster steps (hosts, firewall, PATH) finish first.
################################################################################

Write-Host "`n=== Installing Winget Packages ===" -ForegroundColor Cyan

# Refresh winget source index so installs resolve latest versions
Write-Host "Updating winget source index..."
winget source update --disable-interactivity 2>$null | Out-Null

# Cache all installed packages once upfront — avoids spawning winget list per package (~1-2s each)
$installedPackages = winget list 2>$null | Out-String

# ---- Essential packages (installed first, blocking) ----
$wingetPackagesEssential = @(
    "7zip.7zip",
    "Brave.Brave",
    "Git.Git",
    "GitHub.cli",
    "Git.LFS",
    "Microsoft.VisualStudioCode",
    "Mozilla.FiraCode",
    "OpenJS.NodeJS",
    "Python.Python.3",
    "Starship.Starship",
    "SublimeHQ.SublimeMerge",
    "SublimeHQ.SublimeText.4",
    "ZedIndustries.Zed",
    "Microsoft.WindowsTerminal"
)

# ---- Non-essential packages (installed in background after essentials) ----
$wingetPackagesBackground = @(
    # ---- CLI Utilities (cross-platform parity with Unix _full-setup.sh) ----
    "BurntSushi.ripgrep.MSVC",
    "junegunn.fzf",
    "jqlang.jq",
    "MikeFarah.yq",
    "sharkdp.bat",
    "sharkdp.fd",
    "dandavison.delta",
    "ajeetdsouza.zoxide",
    "eza-community.eza",
    "dbrgn.tealdeer",
    "astral-sh.uv",
    "Cloudflare.cloudflared",
    "Google.PlatformTools",

    # ---- Dev Tools & Runtimes ----
    "Rustlang.Rustup",
    "GoLang.Go",
    "DenoLand.Deno",
    "Oven-sh.Bun",
    "Gradle.Gradle",
    "EclipseAdoptium.Temurin.21.JDK",
    "Kitware.CMake",
    "Kubernetes.kubectl",
    "LLVM.LLVM",
    "Microsoft.VisualStudio.2022.BuildTools",
    "Microsoft.DotNet.SDK.8",
    "Microsoft.DotNet.DesktopRuntime.6",
    "Microsoft.DotNet.DesktopRuntime.7",
    "Microsoft.DotNet.DesktopRuntime.8",

    # ---- GUI Applications ----
    "Audacity.Audacity",
    "Bambulab.Bambustudio",
    "BlenderFoundation.Blender",
    "CodeSector.TeraCopy",
    "Discord.Discord",
    "Docker.DockerDesktop",
    "dotPDN.PaintDotNet",
    "Postman.Postman",
    "Greenshot.Greenshot",
    "HandBrake.HandBrake",
    "Inkscape.Inkscape",
    "KDE.Krita",
    "PuTTY.PuTTY",
    "Rufus.Rufus",
    "Ultimaker.Cura",
    "Valve.Steam",
    "VideoLAN.VLC",
    "WinMerge.WinMerge",
    "WinSCP.WinSCP",
    "Zoom.Zoom",

    # ---- Multimedia ----
    "Gyan.FFmpeg",
    "ImageMagick.ImageMagick.Q16-HDRI",

    # ---- Windows-Specific Runtimes & Drivers ----
    "Microsoft.VCRedist.2005.x86",
    "Microsoft.VCRedist.2005.x64",
    "Microsoft.VCRedist.2008.x86",
    "Microsoft.VCRedist.2008.x64",
    "Microsoft.VCRedist.2010.x86",
    "Microsoft.VCRedist.2010.x64",
    "Microsoft.VCRedist.2012.x86",
    "Microsoft.VCRedist.2012.x64",
    "Microsoft.VCRedist.2013.x86",
    "Microsoft.VCRedist.2013.x64",
    "Microsoft.VCRedist.2015+.x86",
    "Microsoft.VCRedist.2015+.x64",
    "Microsoft.DirectX",
    "Microsoft.XNARedist",
    "OpenAL.OpenAL",
    "WinFSP.WinFSP",
    "WinFSP.SSHFS"
)

Write-Host "`n--- Installing essential packages ---" -ForegroundColor Cyan
foreach ($pkg in $wingetPackagesEssential) {
    if ($installedPackages -match [regex]::Escape($pkg)) {
        Write-Host "  Skipped: $pkg (already installed)" -ForegroundColor Yellow
    } else {
        Write-Host "  Installing: $pkg"
        winget install --id $pkg -e --source winget --accept-source-agreements --accept-package-agreements --disable-interactivity --silent 2>$null
    }
}

Write-Host "`n--- Installing background packages ---" -ForegroundColor Cyan
$backgroundJob = Start-Job -ScriptBlock {
    param($packages, $installed)
    foreach ($pkg in $packages) {
        if ($installed -match [regex]::Escape($pkg)) {
            Write-Host "  Skipped: $pkg (already installed)" -ForegroundColor Yellow
        } else {
            Write-Host "  Installing: $pkg"
            winget install --id $pkg -e --source winget --accept-source-agreements --accept-package-agreements --disable-interactivity --silent 2>$null
        }
    }
} -ArgumentList $wingetPackagesBackground, $installedPackages

Write-Host "`nUpgrading all winget packages..." -ForegroundColor Cyan
winget upgrade --all --include-unknown --source winget --accept-source-agreements --accept-package-agreements --disable-interactivity




################################################################################
# ---- Install Media Extensions (Microsoft Store) ----
################################################################################

Write-Host "`n=== Installing Media Extensions ===" -ForegroundColor Cyan

$mediaExtensions = @(
    @{ Name = "Raw Image Extension";                          Id = "9NCTDW2W1BH8" },
    @{ Name = "HEIF Image Extensions";                        Id = "9PMMSR1CGPWG" },
    @{ Name = "HEVC Video Extensions from Device Manufacturer"; Id = "9N4WGH0Z6VHQ" },
    @{ Name = "MPEG-2 Video Extension";                       Id = "9N95Q1ZZPMH4" },
    @{ Name = "AV1 Video Extension";                          Id = "9MVZQVXJBQ9V" }
)

foreach ($ext in $mediaExtensions) {
    if ($installedPackages -match [regex]::Escape($ext.Id)) {
        Write-Host "  Skipped: $($ext.Name) (already installed)" -ForegroundColor Yellow
    } else {
        Write-Host "  Installing: $($ext.Name) ($($ext.Id))"
        winget install --id $ext.Id --source msstore --accept-source-agreements --accept-package-agreements --disable-interactivity --silent 2>$null
    }
}

Write-Host "Media extensions installed." -ForegroundColor Green



################################################################################
# ---- Brave Browser Shortcut Flags ----
################################################################################

# Add --windows-native-window flag to all Brave shortcuts so it uses the native
# Windows frame (easier to grab and resize)

Write-Host "`n=== Updating Brave Browser Shortcuts ===" -ForegroundColor Cyan

$braveFlag = "--windows-native-window"
$braveShortcutPaths = @(
    "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar",
    "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch",
    "$env:PUBLIC\Desktop",
    "$env:USERPROFILE\Desktop",
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
)

$wshShell = New-Object -ComObject WScript.Shell
foreach ($searchPath in $braveShortcutPaths) {
    if (!(Test-Path $searchPath)) { continue }
    Get-ChildItem -Path $searchPath -Filter "*.lnk" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        $lnk = $wshShell.CreateShortcut($_.FullName)
        if ($lnk.TargetPath -like "*brave*") {
            if ($lnk.Arguments -like "*$braveFlag*") {
                Write-Host "  Already set: $($_.FullName)" -ForegroundColor Yellow
            } else {
                $lnk.Arguments = ("$($lnk.Arguments) $braveFlag").Trim()
                $lnk.Save()
                Write-Host "  Updated: $($_.FullName)" -ForegroundColor Green
            }
        }
    }
}



# Wait for background winget installs to finish
if ($backgroundJob) {
    Write-Host "`nWaiting for background package installs to finish..." -ForegroundColor Cyan
    $backgroundJob | Wait-Job | Receive-Job
    $backgroundJob | Remove-Job
    Write-Host "Background package installs complete." -ForegroundColor Green
}

################################################################################
# ---- Install TranslucentTB (appinstaller) ----
# Placed last because .appinstaller requires user interaction (accept/next).
# winget fails with 0x80073cf3 (Appx dependency resolution), and the GitHub
# release has no .msixbundle for silent Add-AppxPackage install.
################################################################################

Write-Host "`n=== Installing TranslucentTB ===" -ForegroundColor Cyan

$translucentTbUrl = "https://github.com/TranslucentTB/TranslucentTB/releases/download/2026.1/TranslucentTB.appinstaller"
$translucentTbInstaller = "$env:TEMP\TranslucentTB.appinstaller"

try {
  Invoke-WebRequest -Uri $translucentTbUrl -OutFile $translucentTbInstaller -UseBasicParsing
  Start-Process -FilePath $translucentTbInstaller -Wait
  Write-Host "TranslucentTB installed." -ForegroundColor Green
} catch {
  Write-Host "Skipped: TranslucentTB install failed. Error: $_" -ForegroundColor Yellow
} finally {
  Remove-Item -Path $translucentTbInstaller -ErrorAction SilentlyContinue
}



Write-Host "`nTo enable Windows Store on LTSC, run the following manually:" -ForegroundColor Yellow
Write-Host "  wsreset.exe -i" -ForegroundColor White

Write-Host "`nSetup complete! Log off or reboot for all changes to take effect." -ForegroundColor Cyan
pause

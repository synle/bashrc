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
#   FILE SHARING
#     - Smb Shares (expose data drives on LAN)
#   GPU TUNING
#     - NVIDIA RTX 5090 Desktop — Driver Tuning
#   SOFTWARE INSTALLATION (slow — runs last)
#     - Winget Install & Upgrade (single foreground list — winget background jobs are unreliable)
#     - Install Media Extensions (Microsoft Store)
#     - Brave Browser Shortcut Flags
#     - AI CLI Tools (opencode)
################################################################################

################################################################################
# ---- Config ----
#
# $forceInstall — controls the winget install loop further down:
#
#   $false (DEFAULT) — skip packages that already show up in the cached
#     `winget list` output, install everything else with
#     `--force --uninstall-previous`. Fast and idempotent — normal full-setup
#     behavior.
#
#   $true — bypass the skip check and reinstall EVERY package via
#     `--force --uninstall-previous`. Slow, but useful when a prior install is
#     broken / partially registered, when winget's "installed" detection is
#     stale (manual installs, Store apps, side-by-side versions), or when you
#     want to re-pull the latest installer for everything in one shot.
#
# What the install flags do:
#   --force                ignore winget's own "already installed",
#                          hash-mismatch, and applicability checks.
#   --uninstall-previous   remove the existing version before installing,
#                          so you get a clean install rather than an
#                          in-place repair.
################################################################################

# Flip to $true to force-reinstall every winget package on the next run.
$forceInstall = $false

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
    "$env:ProgramFiles\Microsoft VS Code"                         # vs code (system-wide install)
    "$env:ProgramFiles\Microsoft VS Code\bin"                     # vs code cli (system-wide install)
    "$env:LocalAppData\Programs\Microsoft VS Code"                # vs code (per-user install — winget Microsoft.VisualStudioCode default)
    "$env:LocalAppData\Programs\Microsoft VS Code\bin"            # vs code cli (per-user install)
    "$env:ProgramFiles\Sublime Text"                              # sublime text
    "$env:SystemRoot"                                             # windows root
    "$env:SystemRoot\System32"                                    # system32
    "$env:SystemRoot\System32\OpenSSH"                            # openssh
    "$env:SystemRoot\System32\Wbem"                               # wmi / wbem
    "$env:SystemRoot\System32\WindowsPowerShell\v1.0"             # powershell
    "$env:UserProfile\AppData\Local\Microsoft\WindowsApps"        # windows apps (profile)
    "$env:UserProfile\.local\bin"                                 # user-local bins (claude, npm globals, etc.)
    "$env:UserProfile\.opencode\bin"                              # opencode (curl|iex installer drops here)
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
# ---- Smb Shares (expose data drives on LAN) ----
#
# Iterates D .. W and exposes each existing drive root as an SMB share.
# Skips X / Y / Z (reserved for mapped network / removable / virtual drives).
#
# --------------------------------------------------------------------------
# STEP-BY-STEP — what runs and why
# --------------------------------------------------------------------------
#
# Step 1. Enable the SMB2 protocol on the server
#   Command:  Set-SmbServerConfiguration -EnableSMB2Protocol $true -Force
#   Why:      Windows ships with the SMB server service (LanmanServer)
#             installed, but SMB2 may be disabled on hardened images.
#             SMB1 is insecure and off by default — we explicitly turn SMB2
#             ON so modern clients (Linux cifs, macOS, Windows 10+) can
#             connect. -Force skips the confirmation prompt so this is safe
#             to re-run non-interactively.
#
# Step 2. Open the Windows firewall for SMB
#   Command:  Get-NetFirewallRule -DisplayGroup "File and Printer Sharing"
#             | Enable-NetFirewallRule
#   Why:      The firewall blocks inbound TCP/445 by default. Enabling the
#             built-in "File and Printer Sharing" rule group opens the
#             correct ports (137, 138, 139, 445) for the current network
#             profiles. We enable the whole group rather than crafting a
#             custom rule so Windows keeps it in sync on upgrades.
#
# Step 3. Build the list of drive letters to consider
#   Command:  $smbDriveLetters = [char[]](68..87) | ForEach-Object { [string]$_ }
#   Why:      ASCII 68 = 'D', 87 = 'W'. We deliberately skip A/B (floppy
#             legacy), C (system — never share the OS drive blindly), and
#             X/Y/Z (conventionally reserved for mapped network drives,
#             removable media, or virtual mounts — sharing them would
#             create loops or expose transient data).
#
# Step 4. Skip drives that do not exist
#   Command:  if (-not (Test-Path $root)) { continue }
#   Why:      Most machines only have a couple of data drives. We don't
#             want to error on missing letters, and we don't want to create
#             empty shares that point at nothing.
#
# Step 5. Remove any existing share with the same name
#   Command:  Remove-SmbShare -Name $name -Force
#   Why:      Makes the script idempotent. If a previous run created the
#             share with a different ACL or description, we replace it
#             cleanly instead of erroring with "share already exists".
#
# Step 6. Create the SMB share with a user-scoped ACL
#   Command:  New-SmbShare -Name $name -Path $root
#             -FullAccess "$env:USERNAME"
#   Why:      This is the SHARE-LEVEL permission. Only the current user can
#             mount the share — no Guest, no Everyone, no anonymous.
#             Password-gated by Windows auth. The $_Sy_drive_ prefix keeps
#             these shares easy to audit and clean up later.
#
# Step 7. Grant matching NTFS permissions on the drive root
#   Command:  icacls $root /grant "${env:USERNAME}:(OI)(CI)M" /T
#   Why:      Windows enforces the INTERSECTION of share ACL and NTFS ACL.
#             Step 6 alone is not enough — if the NTFS ACL denies the user,
#             the share is unusable. (OI)(CI)M = Object Inherit + Container
#             Inherit + Modify rights, applied recursively (/T).
#
# Step 8. Print the resulting share table
#   Command:  Get-SmbShare | Where-Object { $_.Name -like '_Sy_drive_*' }
#   Why:      Confirmation for the operator running setup — shows what
#             ended up exposed so you can sanity-check before walking away.
#
# --------------------------------------------------------------------------
# SECURITY MODEL — password-gated, NOT open:
# --------------------------------------------------------------------------
#   - Share ACL grants FullAccess only to $env:USERNAME (current Windows user).
#   - NTFS ACL grants Modify only to $env:USERNAME.
#   - No Guest / Everyone / anonymous access is configured.
#   - Everyone else hitting the share gets "Access Denied".
#
# TO CONNECT FROM ANOTHER MACHINE:
#   user:     <your Windows username>
#   password: <your Windows account password>
#
# CAVEATS:
#   1. Your Windows account MUST have a password. Blank-password accounts are
#      blocked from SMB auth by default (LimitBlankPasswordUse policy).
#   2. If you sign in with a Microsoft account, use the actual account
#      password — a Windows Hello PIN will NOT work for SMB.
#   3. Linux/macOS clients usually authenticate with the short local username
#      (e.g. "syle"). If auth fails, try "<hostname>\<user>" or
#      "MicrosoftAccount\<email>".
#   4. Network profile should be Private for clean discovery. SMB still works
#      on Public, but the host won't appear in browse lists.
#   5. Do NOT flip AllowInsecureGuestAuth or switch FullAccess to "Everyone"
#      unless you explicitly want wide-open shares on a trusted LAN.
################################################################################

Write-Host "`n=== Configuring SMB Shares ===" -ForegroundColor Cyan

# Enable SMB2 + allow File and Printer Sharing through firewall (idempotent)
Set-SmbServerConfiguration -EnableSMB2Protocol $true -Force -Confirm:$false
Get-NetFirewallRule -DisplayGroup "File and Printer Sharing" -ErrorAction SilentlyContinue |
    Enable-NetFirewallRule | Out-Null

# D .. W inclusive — skips X, Y, Z on purpose
$smbDriveLetters = [char[]](68..87) | ForEach-Object { [string]$_ }

foreach ($l in $smbDriveLetters) {
    $root = "${l}:\"
    if (-not (Test-Path $root)) { continue }

    $name = "_Sy_drive_$l"

    # Remove any existing share of the same name so re-runs are idempotent
    if (Get-SmbShare -Name $name -ErrorAction SilentlyContinue) {
        Remove-SmbShare -Name $name -Force -Confirm:$false
    }

    # Share ACL: only current user gets access (password-gated, not open to Everyone)
    New-SmbShare -Name $name -Path $root `
        -FullAccess "$env:USERNAME" `
        -Description "Auto-shared $root by _full-setup" | Out-Null

    # NTFS ACL: grant current user Modify on the drive root.
    # Share ACL alone is NOT enough — Windows enforces the intersection of
    # share permissions AND NTFS permissions, so both layers must allow the user.
    icacls $root /grant "${env:USERNAME}:(OI)(CI)M" /T 2>$null | Out-Null

    Write-Host "  Shared: \\$env:COMPUTERNAME\$name -> $root" -ForegroundColor Green
}

Write-Host "`nCurrent _Sy_drive_* shares:" -ForegroundColor Cyan
Get-SmbShare | Where-Object { $_.Name -like '_Sy_drive_*' } |
    Format-Table Name, Path, Description

# --------------------------------------------------------------------------
# Step 3 (CLIENT SIDE) — mount the share from Linux (Ubuntu)
# --------------------------------------------------------------------------
# TODO: TBD — not yet wired into the Ubuntu _full-setup.sh. Left here as a
# reference / paste-in starting point. Replace <WIN_HOST>, <DRIVE_LETTER>,
# and <WIN_USER> with the real values before running.
#
# Run on the Ubuntu client (NOT here on Windows):
#
#     # one-time deps
#     # sudo apt-get install -y cifs-utils
#     #
#     # # credentials file (keeps password out of /etc/fstab + process list)
#     # sudo install -m 600 /dev/null /etc/samba/creds-<WIN_HOST>
#     # sudo tee /etc/samba/creds-<WIN_HOST> >/dev/null <<EOF
#     # username=<WIN_USER>
#     # password=<WIN_PASSWORD>
#     # EOF
#     #
#     # # ad-hoc mount
#     # sudo mkdir -p /mnt/<WIN_HOST>/<DRIVE_LETTER>
#     # sudo mount -t cifs //<WIN_HOST>/_Sy_drive_<DRIVE_LETTER> \
#     #     /mnt/<WIN_HOST>/<DRIVE_LETTER> \
#     #     -o credentials=/etc/samba/creds-<WIN_HOST>,uid=$(id -u),gid=$(id -g),iocharset=utf8,vers=3.0
#     #
#     # # persistent mount via /etc/fstab (one line, no leading '#')
#     # //<WIN_HOST>/_Sy_drive_<DRIVE_LETTER>  /mnt/<WIN_HOST>/<DRIVE_LETTER>  cifs  credentials=/etc/samba/creds-<WIN_HOST>,uid=1000,gid=1000,iocharset=utf8,vers=3.0,nofail,_netdev  0  0
# --------------------------------------------------------------------------



################################################################################
# ---- NVIDIA RTX 5090 Desktop — Driver Tuning ----
# Only runs when an RTX 5090 is detected (desktop dGPU box).
#
# What each command does:
#   - nvidia-smi -pm 1
#       Enables persistence mode: keeps the NVIDIA kernel driver loaded even
#       when no CUDA/GPU process is active. Avoids the multi-second driver
#       re-init lag on each new process and lets clock/power settings stick
#       across runs instead of resetting to defaults between launches.
#
#   - nvidia-smi --auto-boost-default=0
#       Disables auto boost: stops the GPU from opportunistically jumping into
#       higher boost clocks based on thermal/power headroom. The card honors
#       the configured power management mode ("Prefer max performance" set in
#       NVIDIA Control Panel) instead of bouncing clocks, which gives more
#       deterministic frame times / latency. (Optional — flag is a no-op on
#       SKUs that don't expose auto-boost; the 2>$null swallows that warning.)
#
#   - powercfg /setacvalueindex SCHEME_CURRENT SUB_PCIEXPRESS ASPM 0
#   - powercfg /setdcvalueindex SCHEME_CURRENT SUB_PCIEXPRESS ASPM 0
#   - powercfg /setactive SCHEME_CURRENT
#       Turns OFF PCIe Link State Power Management (ASPM) on both AC (plugged
#       in) and DC (battery) for the currently active Windows power plan, then
#       re-applies the plan so the change takes effect.
#
#       ASPM lets the PCIe link drop into low-power L0s/L1 states when idle to
#       save power. The wake-up cost is small (microseconds) but real, and on
#       a high-bandwidth GPU like the 5090 the link bouncing in/out of those
#       states under bursty workloads (game frames, ML inference, decoder
#       work) shows up as latency jitter, microstutter, and the occasional
#       stall. Forcing ASPM=0 keeps the link permanently at L0, trading a few
#       watts of idle PCIe power for steady-state latency / throughput.
#
#       Values: 0 = Off, 1 = Moderate power savings, 2 = Maximum savings.
#
#       This is the scripted equivalent of the GUI sequence:
#         Win+R -> powercfg.cpl -> Change plan settings -> Change advanced
#         power settings -> PCI Express -> Link State Power Management ->
#         set both "On battery" and "Plugged in" to Off -> Apply.
#
#   - All other GPUs: block is skipped entirely (no-op on laptops, AMD, older
#     NVIDIA cards, headless boxes, etc.).
################################################################################

$gpuName = (Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty Name) -join " "
if ($gpuName -match "RTX\s*5090") {
    Write-Host "`n=== NVIDIA RTX 5090 — Driver Tuning ===" -ForegroundColor Cyan

    if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
        nvidia-smi -pm 1 | Out-Null                    # Enable persistence mode
        nvidia-smi --auto-boost-default=0 2>$null | Out-Null   # Disable auto boost (optional)
        Write-Host "  nvidia-smi: persistence ON, auto-boost OFF" -ForegroundColor Green
    } else {
        Write-Host "  nvidia-smi not on PATH — skipping" -ForegroundColor Yellow
    }

    # PCIe Link State Power Management = OFF on the active power plan (AC + DC)
    powercfg /setacvalueindex SCHEME_CURRENT SUB_PCIEXPRESS ASPM 0 | Out-Null   # Plugged in: ASPM off
    powercfg /setdcvalueindex SCHEME_CURRENT SUB_PCIEXPRESS ASPM 0 | Out-Null   # On battery:  ASPM off
    powercfg /setactive SCHEME_CURRENT | Out-Null                               # Re-apply so the change takes effect
    Write-Host "  PCIe ASPM: OFF (AC + DC) on active power plan" -ForegroundColor Green
}



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

# NOTE: Everything is installed in the FOREGROUND, sequentially. We used to
# split this into "essential" (foreground) + "background" (Start-Job) lists,
# but winget is funky in background jobs — UAC prompts get suppressed, the
# package store frequently reports "in use" when two installs race, and
# silent failures are common. One-at-a-time foreground installs are slower
# but reliable, and that trade is worth it for an unattended setup script.
$wingetPackages = @(
    # ---- Core: browser, terminal, fonts, editors ----
    "Brave.Brave",
    "Microsoft.WindowsTerminal",
    "Mozilla.FiraCode",
    "Microsoft.VisualStudioCode",
    "SublimeHQ.SublimeText.4",
    "SublimeHQ.SublimeMerge",
    "ZedIndustries.Zed",

    # ---- Git ----
    "Git.Git",
    "Git.LFS",
    "GitHub.cli",
    "NewRen.git-filter-repo",

    # ---- CLI Utilities (cross-platform parity with Unix _full-setup.sh) ----
    "7zip.7zip",
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
    "Starship.Starship",

    # ---- Dev Tools & Runtimes ----
    "OpenJS.NodeJS",
    "Python.Python.3",
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
    "Hashicorp.Terraform",
    "Helm.Helm",
    "Derailed.k9s",
    "JesseDuffield.lazydocker",
    "Microsoft.DotNet.SDK.8",
    "Microsoft.DotNet.DesktopRuntime.6",
    "Microsoft.DotNet.DesktopRuntime.7",
    "Microsoft.DotNet.DesktopRuntime.8",
    "Microsoft.PowerShell",

    # ---- Local LLM ----
    "Ollama.Ollama",

    # ---- Cloud CLIs ----
    "Amazon.AWSCLI",
    "Google.CloudSDK",
    "Microsoft.AzureCLI",

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

# See $forceInstall config at the top of this file.
#   - skip when:    not forcing AND package already installed
#   - install when: forcing OR package missing
# Every install uses --force --uninstall-previous so the install path is
# the same in both modes — the only difference is whether we skip or not.
Write-Host "`n--- Installing winget packages (foreground, sequential) ---" -ForegroundColor Cyan
foreach ($pkg in $wingetPackages) {
    if (-not $forceInstall -and ($installedPackages -match [regex]::Escape($pkg))) {
        Write-Host "  Skipped: $pkg (already installed)" -ForegroundColor Yellow
    } else {
        Write-Host "  Installing: $pkg"
        winget install --id $pkg -e --source winget --accept-source-agreements --accept-package-agreements --disable-interactivity --silent --force --uninstall-previous 2>$null
    }
}

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



################################################################################
# ---- AI CLI Tools (opencode) ----
# Tools that publish their own PowerShell installer scripts. Each one drops a
# binary into $env:UserProfile\.opencode\bin (or similar) — already covered by
# the user PATH stitched up earlier in this script.
################################################################################

Write-Host "`n=== Installing AI CLI Tools ===" -ForegroundColor Cyan

# opencode — terminal-based AI coding agent (https://opencode.ai)
# Installer drops opencode.exe into %USERPROFILE%\.opencode\bin
if (Get-Command opencode -ErrorAction SilentlyContinue) {
    Write-Host "  Skipped: opencode (already installed)" -ForegroundColor Yellow
} else {
    Write-Host "  Installing: opencode"
    try {
        Invoke-RestMethod -Uri "https://opencode.ai/install.ps1" -UseBasicParsing | Invoke-Expression
        Write-Host "  Installed: opencode" -ForegroundColor Green
    } catch {
        Write-Host "  Failed to install opencode: $_" -ForegroundColor Red
    }
}



Write-Host "`nTo enable Windows Store on LTSC, run the following manually:" -ForegroundColor Yellow
Write-Host "  wsreset.exe -i" -ForegroundColor White

Write-Host "`nSetup complete! Log off or reboot for all changes to take effect." -ForegroundColor Cyan
pause

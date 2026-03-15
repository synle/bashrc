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

Write-Host "`n=== Post-Bootstrap Notes ===" -ForegroundColor Cyan

Write-Host "`nTo enable Windows Store on LTSC, run the following manually:" -ForegroundColor Yellow
Write-Host "  wsreset.exe -i" -ForegroundColor White

Write-Host "`nActivating Windows (MAS)..." -ForegroundColor Yellow
irm https://get.activated.win | iex

Write-Host "`nBootstrap complete! You can now run windows.ps1 for the full setup." -ForegroundColor Cyan

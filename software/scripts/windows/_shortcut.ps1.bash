#!/usr/bin/env pwsh
################################################################################
# windows/_shortcut.ps1 - Update existing Brave shortcut launch settings.
################################################################################

# Update existing Brave .lnk files only; never create or pin shortcuts.
# Most changes update Arguments with launch options and flags.
# TargetPath and WorkingDirectory (Start In) also match the current user's Brave installation.
# Pinned taskbar .lnk path: $windowsAppDataRoamingPath\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar

Write-Host "`n=== Updating Brave Browser Shortcuts ===" -ForegroundColor Cyan

$braveExecutablePath = '<<BRAVE_EXECUTABLE_PATH>>'
$braveWorkingDirectory = '<<BRAVE_WORKING_DIRECTORY>>'
$windowsAppDataRoamingPath = '<<WINDOWS_APPDATA_ROAMING_PATH>>'
$windowsUserHomePath = '<<WINDOWS_USER_HOME_PATH>>'
$braveFlags = @(
    "--source-shortcut-location=desktop"
    "--windows-native-window"
    "--disable-features=IPH_GMCSaveVideoFrame"
)
$braveTaskbarShortcutFolder = "$windowsAppDataRoamingPath\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"
$braveShortcutPaths = @(
    $braveTaskbarShortcutFolder,
    "$windowsAppDataRoamingPath\Microsoft\Internet Explorer\Quick Launch",
    "$env:PUBLIC\Desktop",
    "$windowsUserHomePath\Desktop",
    "$windowsAppDataRoamingPath\Microsoft\Windows\Start Menu\Programs"
)

$wshShell = New-Object -ComObject WScript.Shell
foreach ($searchPath in $braveShortcutPaths) {
    if (!(Test-Path $searchPath)) { continue }
    Get-ChildItem -Path $searchPath -Filter "*.lnk" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        $lnk = $wshShell.CreateShortcut($_.FullName)
        if ($lnk.TargetPath -like "*brave*") {
            $shortcutChanged = $false
            if ($lnk.TargetPath -ne $braveExecutablePath) {
                $lnk.TargetPath = $braveExecutablePath
                $shortcutChanged = $true
            }
            if ($lnk.WorkingDirectory -ne $braveWorkingDirectory) {
                $lnk.WorkingDirectory = $braveWorkingDirectory
                $shortcutChanged = $true
            }
            foreach ($braveFlag in $braveFlags) {
                if ($lnk.Arguments -notlike "*$braveFlag*") {
                    $lnk.Arguments = ("$($lnk.Arguments) $braveFlag").Trim()
                    $shortcutChanged = $true
                }
            }
            if ($shortcutChanged) {
                $lnk.Save()
                Write-Host "  Updated: $($_.FullName)" -ForegroundColor Green
            } else {
                Write-Host "  Already set: $($_.FullName)" -ForegroundColor Yellow
            }
        }
    }
}

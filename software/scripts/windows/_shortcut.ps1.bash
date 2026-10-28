#!/usr/bin/env pwsh
################################################################################
# windows/_shortcut.ps1 - Update existing Chromium browser shortcut launch settings.
################################################################################

# Update existing Brave, Chrome, and Edge .lnk files only; never create or pin shortcuts.
# Infer each installed executable from the shortcut target, App Paths registry, or install roots.
# TargetPath and WorkingDirectory (Start In) follow the resolved executable.

Write-Host "`n=== Updating Chromium Browser Shortcuts ===" -ForegroundColor Cyan

$windowsAppDataRoamingPath = '<<WINDOWS_APPDATA_ROAMING_PATH>>'
$windowsUserHomePath = '<<WINDOWS_USER_HOME_PATH>>'
<<BROWSER_LAUNCH_OPTIONS>>

$browserExecutableNames = @{
    Brave = 'brave.exe'
    Chrome = 'chrome.exe'
    Edge = 'msedge.exe'
}
$browserInstallRelativePaths = @{
    Brave = 'BraveSoftware\Brave-Browser\Application\brave.exe'
    Chrome = 'Google\Chrome\Application\chrome.exe'
    Edge = 'Microsoft\Edge\Application\msedge.exe'
}

# Classify requested browsers without treating Chromium's chrome.exe as Google Chrome.
# TargetPath and ShortcutName identify the target; unrelated shortcuts return null.
function Get-BrowserNameFromTarget {
    param(
        [string]$TargetPath,
        [string]$ShortcutName
    )

    $targetFileName = ($TargetPath -split '[\\/]')[-1]
    switch ($targetFileName.ToLowerInvariant()) {
        'brave.exe' { return 'Brave' }
        'chrome.exe' {
            if ($TargetPath -match '(?i)[\\/]Google[\\/]Chrome[\\/]' -or $ShortcutName -match '(?i)Chrome') { return 'Chrome' }
            return $null
        }
        'msedge.exe' { return 'Edge' }
        default { return $null }
    }
}

# Resolve an installed browser executable, preferring the valid shortcut target.
# BrowserName and CurrentTargetPath identify the installed executable; missing installs return null.
function Resolve-BrowserExecutable {
    param(
        [string]$BrowserName,
        [string]$CurrentTargetPath
    )

    $executableName = $browserExecutableNames[$BrowserName]
    $currentFileName = ($CurrentTargetPath -split '[\\/]')[-1]
    if ($currentFileName -ieq $executableName -and (Test-Path -LiteralPath $CurrentTargetPath -PathType Leaf)) {
        return $CurrentTargetPath
    }

    $registryPaths = @(
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$executableName",
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$executableName",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\$executableName"
    )
    foreach ($registryPath in $registryPaths) {
        if (!(Test-Path -LiteralPath $registryPath)) { continue }
        $registryItem = Get-Item -LiteralPath $registryPath -ErrorAction SilentlyContinue
        if (!$registryItem) { continue }
        $registeredPath = [string]$registryItem.GetValue('')
        if ($registeredPath -and (Test-Path -LiteralPath $registeredPath -PathType Leaf)) {
            return $registeredPath
        }
    }

    $localAppData = Join-Path $windowsUserHomePath 'AppData\Local'
    $installRoots = @($localAppData, $env:ProgramFiles, ${env:ProgramFiles(x86)}) |
        Where-Object { $_ -and $_.Trim() } |
        Select-Object -Unique
    foreach ($installRoot in $installRoots) {
        $candidatePath = Join-Path $installRoot $browserInstallRelativePaths[$BrowserName]
        if (Test-Path -LiteralPath $candidatePath -PathType Leaf) { return $candidatePath }
    }

    return $null
}

# Merge the canonical feature list without deleting custom feature toggles already on the shortcut.
# CurrentArguments and RequestedOptions produce one idempotent merged argument string.
function Merge-BrowserLaunchOptions {
    param(
        [string]$CurrentArguments,
        [string[]]$RequestedOptions
    )

    $arguments = if ($null -eq $CurrentArguments) { '' } else { $CurrentArguments.Trim() }
    $featureNames = [System.Collections.Generic.List[string]]::new()
    $existingFeatureMatches = [regex]::Matches($arguments, '(?<!\S)--disable-features=(?:"([^"]*)"|(\S+))')
    foreach ($match in $existingFeatureMatches) {
        $featureValue = if ($match.Groups[1].Success) { $match.Groups[1].Value } else { $match.Groups[2].Value }
        foreach ($featureName in $featureValue.Split(',')) {
            if ($featureName -and $featureNames -notcontains $featureName) { $featureNames.Add($featureName) }
        }
    }

    $requestedFeatureArgument = $RequestedOptions |
        Where-Object { $_ -like '--disable-features=*' } |
        Select-Object -First 1
    if ($requestedFeatureArgument) {
        $requestedFeatureNames = $requestedFeatureArgument.Substring('--disable-features='.Length).Split(',')
        foreach ($featureName in $requestedFeatureNames) {
            if ($featureName -and $featureNames -notcontains $featureName) { $featureNames.Add($featureName) }
        }
    }

    $arguments = [regex]::Replace($arguments, '(?<!\S)--disable-features=(?:"[^"]*"|\S+)', '').Trim()
    foreach ($option in $RequestedOptions) {
        if ($option -like '--disable-features=*') { continue }
        $optionPattern = "(?<!\S)$([regex]::Escape($option))(?!\S)"
        if ($arguments -notmatch $optionPattern) { $arguments = ($arguments + ' ' + $option).Trim() }
    }

    if ($featureNames.Count -gt 0) {
        $arguments = ($arguments + ' --disable-features=' + ($featureNames -join ',')).Trim()
    }
    return $arguments
}

$braveTaskbarShortcutFolder = "$windowsAppDataRoamingPath\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"
$browserShortcutPaths = @(
    $braveTaskbarShortcutFolder,
    "$windowsAppDataRoamingPath\Microsoft\Internet Explorer\Quick Launch",
    "$env:PUBLIC\Desktop",
    "$windowsUserHomePath\Desktop",
    'D:\Desktop',
    "$windowsAppDataRoamingPath\Microsoft\Windows\Start Menu\Programs"
)

$wshShell = New-Object -ComObject WScript.Shell
foreach ($searchPath in $browserShortcutPaths) {
    if (!(Test-Path -LiteralPath $searchPath)) { continue }

    $shortcutFiles = Get-ChildItem -Path $searchPath -Filter '*.lnk' -Recurse -ErrorAction SilentlyContinue
    foreach ($shortcutFile in $shortcutFiles) {
        $shortcut = $wshShell.CreateShortcut($shortcutFile.FullName)
        $browserName = Get-BrowserNameFromTarget $shortcut.TargetPath $shortcutFile.Name
        if (!$browserName) { continue }

        $browserExecutablePath = Resolve-BrowserExecutable $browserName $shortcut.TargetPath
        if (!$browserExecutablePath) {
            Write-Host "  Skipped: $browserName executable not found for $($shortcutFile.FullName)" -ForegroundColor Yellow
            continue
        }

        $browserWorkingDirectory = $browserExecutablePath -replace '[\\/][^\\/]+$', ''
        $updatedArguments = Merge-BrowserLaunchOptions $shortcut.Arguments $browserLaunchOptions[$browserName]
        $shortcutChanged = $false
        if ($shortcut.TargetPath -ne $browserExecutablePath) {
            $shortcut.TargetPath = $browserExecutablePath
            $shortcutChanged = $true
        }
        if ($shortcut.WorkingDirectory -ne $browserWorkingDirectory) {
            $shortcut.WorkingDirectory = $browserWorkingDirectory
            $shortcutChanged = $true
        }
        if ($shortcut.Arguments -ne $updatedArguments) {
            $shortcut.Arguments = $updatedArguments
            $shortcutChanged = $true
        }

        if ($shortcutChanged) {
            $shortcut.Save()
            Write-Host "  Updated: $($shortcutFile.FullName)" -ForegroundColor Green
        } else {
            Write-Host "  Already set: $($shortcutFile.FullName)" -ForegroundColor Yellow
        }
    }
}

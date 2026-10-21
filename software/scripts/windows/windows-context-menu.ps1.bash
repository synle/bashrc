#Requires -Version 5.1
<#
.SYNOPSIS
Removes Git Explorer verbs and installs root-safe, per-user PowerShell and WSL verbs.
.DESCRIPTION
Run on Windows as the affected user. Elevation allows machine-level Git removal;
permission-denied deletion falls back to hiding the verb for the current user.
Exports existing keys before changes and throws if a backup or registry write fails.
Backups under LOCALAPPDATA\Sy\ContextMenuBackup are never overwritten.
#>
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Run this script on Windows.' }

$backupFolder = Join-Path $env:LOCALAPPDATA 'Sy\ContextMenuBackup'
New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null

function Save-ContextMenuKey {
    <#
    .SYNOPSIS
    Exports an existing registry key once, or records that no original key existed.
    .PARAMETER Key
    Full HKEY_CURRENT_USER or HKEY_LOCAL_MACHINE registry key name.
    .OUTPUTS
    None. Creates a .reg backup or .absent marker; throws on export failure.
    #>
    param([Parameter(Mandatory = $true)][string]$Key)
    $backup = Join-Path $backupFolder (($Key -replace '\\', '_') + '.reg')
    if ((Test-Path -LiteralPath $backup) -or (Test-Path -LiteralPath "$backup.absent")) { return }
    if (-not (Test-Path -LiteralPath "Registry::$Key")) {
        New-Item -ItemType File -Path "$backup.absent" | Out-Null
        return
    }
    # Unique pending files keep concurrent exports apart; only a successful export is reusable.
    $pendingBackup = "$backup.$([Guid]::NewGuid().ToString('N')).pending"
    & reg.exe export $Key $pendingBackup /y | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Registry backup failed for $Key; no change made to this key." }
    Move-Item -LiteralPath $pendingBackup -Destination $backup
}

# Git's installer owns only these verbs; leave Git itself and other verbs intact.
foreach ($scope in @('Directory', 'Directory\Background', 'LibraryFolder\Background')) {
    foreach ($verb in @('git_gui', 'git_shell')) {
        foreach ($hive in @('HKEY_CURRENT_USER', 'HKEY_LOCAL_MACHINE')) {
            $key = "$hive\Software\Classes\$scope\shell\$verb"
            if (-not (Test-Path -LiteralPath "Registry::$key")) { continue }
            Save-ContextMenuKey -Key $key
            try {
                Remove-Item -LiteralPath "Registry::$key" -Recurse -Force
                Write-Host "Removed: $key"
            } catch [System.UnauthorizedAccessException], [System.Security.SecurityException] {
                Write-Warning "Deletion denied for $key; hiding the verb for the current user. $($_.Exception)"
                $userKey = "HKEY_CURRENT_USER\Software\Classes\$scope\shell\$verb"
                Save-ContextMenuKey -Key $userKey
                New-Item -Path "Registry::$userKey" -Force | Out-Null
                New-ItemProperty -LiteralPath "Registry::$userKey" -Name 'LegacyDisable' -Value '' -PropertyType String -Force | Out-Null
            }
        }
    }
}

# Resolve real applications now, not aliases or the maintenance script's own engine.
$modernShell = Get-Command pwsh.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
$powerShellBinary = if ($null -ne $modernShell) { '"' + $modernShell.Source + '"' } else { 'powershell.exe' }
$menus = @(@{
    Verb = 'Powershell'
    Label = 'Open Powershell Here'
    Command = $powerShellBinary + ' -NoExit -WorkingDirectory "%V\."'
})
$wsl = Get-Command wsl.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -ne $wsl) {
    $menus += @{
        Verb = 'SyWSL'
        Label = 'Open WSL Linux Here'
        Command = '"' + $wsl.Source + '" --cd "%V\."'
    }
}

# Do not modify protected machine verbs. HKCU overrides apply only to this user.
# Append \. so a drive root never ends in a backslash immediately before a quote.
foreach ($scope in @('Directory', 'Directory\Background', 'Drive')) {
    foreach ($menu in $menus) {
        $key = "HKEY_CURRENT_USER\Software\Classes\$scope\shell\$($menu.Verb)"
        Save-ContextMenuKey -Key $key
        New-Item -Path "Registry::$key\command" -Force | Out-Null
        Set-Item -LiteralPath "Registry::$key" -Value $menu.Label
        # MUIVerb can be inherited from a machine key and overrides the default label.
        New-ItemProperty -LiteralPath "Registry::$key" -Name 'MUIVerb' -Value $menu.Label -PropertyType String -Force | Out-Null
        Set-Item -LiteralPath "Registry::$key\command" -Value $menu.Command
    }
}

Write-Host "Done. Registry backups: $backupFolder"
Write-Host 'Check folder, folder background, and drive-root menus in a new Explorer window.'

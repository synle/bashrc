<#
#######################################################
 power shell profile
# Microsoft.PowerShell_profile.ps1
# WindowsPowerShell/Microsoft.PowerShell_profile.ps1
# ~/Documents/WindowsPowerShell/Microsoft.PowerShell_profile.ps1
#


# Downloading the file
# set PWD to be Documents
mkdir WindowsPowerShell
cd WindowsPowerShell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build/windows-powershell-profile.ps1" -OutFile "Microsoft.PowerShell_profile.ps1"

# need to run this script at least once
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser


# Downloading Fonts
Start-BitsTransfer -Source https://github.com/synle/bashrc/raw/master/fonts/CascadiaCode.ttf
Start-BitsTransfer -Source https://github.com/synle/bashrc/raw/master/fonts/CascadiaCodePL.ttf
Start-BitsTransfer -Source https://github.com/synle/bashrc/raw/master/fonts/CascadiaMono.ttf
Start-BitsTransfer -Source https://github.com/synle/bashrc/raw/master/fonts/CascadiaMonoPL.ttf
Start-BitsTransfer -Source https://github.com/synle/bashrc/raw/master/fonts/FiraCode-Bold.ttf
Start-BitsTransfer -Source https://github.com/synle/bashrc/raw/master/fonts/FiraCode-Light.ttf
Start-BitsTransfer -Source https://github.com/synle/bashrc/raw/master/fonts/FiraCode-Medium.ttf
Start-BitsTransfer -Source https://github.com/synle/bashrc/raw/master/fonts/FiraCode-Regular.ttf
Start-BitsTransfer -Source https://github.com/synle/bashrc/raw/master/fonts/FiraCode-Retina.ttf
Start-BitsTransfer -Source https://github.com/synle/bashrc/raw/master/fonts/FiraCode-SemiBold.ttf
Start-BitsTransfer -Source https://github.com/synle/bashrc/raw/master/fonts/Trace.ttf

#######################################################
#>


# tab autocomplete
Set-PSReadlineKeyHandler -Key Tab -Function MenuComplete

# keybindings
# Import-Module PSReadLine
# Get-PSReadLineKeyHandler
# https://github.com/PowerShell/PSReadLine
Set-PSReadLineKeyHandler -Key Ctrl+a -Function BeginningOfLine
Set-PSReadLineKeyHandler -Key Ctrl+e -Function EndOfLine
Set-PSReadLineKeyHandler -Key Ctrl+. -Function YankLastArg

# Aliases
New-Alias g git
New-Alias open explorer
New-Alias d docker
New-Alias .. cdup

# functions
function ls() {
  Get-ChildItem -Force %args
}

function ll() {
  ls  $args
}

function grep() {
  Get-ChildItem -Recurse | Where-Object { $_.PSIsContainer -eq $false -and $_.FullName -notmatch '\node_modules\' }  | Select-String -Pattern "$args"
}

function vim() {
  code $args
}

function mkdir() {
  New-Item -ItemType Directory -Path $args -Force
}

function cdup() {
  cd ..
}

function br() {
  clear;
  Write-Host "====================="  -ForegroundColor Red -NoNewline;
}

function which() {
  (Get-Command $args).Path
}

function find() {
  Get-ChildItem -Recurse $args
}

function touch() {
  New-Item -ItemType File $args
}

### For the prompt
function parseGitBranch() {
  try {
    $branch = git rev-parse --abbrev-ref HEAD

    if ($branch -eq "HEAD") {
      # we're probably in detached HEAD state, so print the SHA
      $branch = git rev-parse --short HEAD
      Write-Host -NoNewline " [$branch]" -ForegroundColor "red"
    }
    else {
      # we're on an actual branch, so print it
      Write-Host -NoNewline " [$branch]" -ForegroundColor "red"
    }
  } catch {
    # we'll end up here if we're in a newly initiated git repo
    Write-Host -NoNewline " [no branches yet]" -ForegroundColor "yellow"
  }
}

function shorterPwdPath() {
  node -e """
    const path = require('path');
    const splits = process.cwd().split(path.sep);
    const shortPath = splits.map((s, idx) => idx === 0 || idx === splits.length - 1? s : s[0]).join('/');
    console.log(shortPath)
  """
}

function shorterTimestamp() {
  node -e """
    const date = new Date();
    const format = (v) => (v + '').padStart(2, '0');
    console.log(format(date.getHours()) + ':' + format(date.getMinutes()) + ':' + format(date.getSeconds()));
  """
}

function prompt() {
  # $path = "$($executionContext.SessionState.Path.CurrentLocation)"
  $path = "$(shorterPwdPath)"

  Write-Host "====" -NoNewline -ForegroundColor "red"
  Write-Host "
" -NoNewline

  Write-Host "$(shorterTimestamp)" -NoNewline -ForegroundColor "yellow"
  Write-Host " $(whoami)" -NoNewline -ForegroundColor "green"
  Write-Host "
" -NoNewline

  if (Test-Path .git) {
    Write-Host $path -NoNewline -ForegroundColor "yellow"
    parseGitBranch
  }
  else {
    # we're not in a repo so don't bother displaying branch name/sha
    Write-Host $path -NoNewline -ForegroundColor "yellow"
  }
  Write-Host "
" -NoNewline

  $userPrompt = "$('>' * ($nestedPromptLevel + 3)) "
  return $userPrompt
}

clear; # clean up the prompt
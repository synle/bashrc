# power shell profile
# Microsoft.PowerShell_profile.ps1
# WindowsPowerShell/Microsoft.PowerShell_profile.ps1
# ~/Documents/WindowsPowerShell/Microsoft.PowerShell_profile.ps1

Set-ExecutionPolicy RemoteSigned -Scope CurrentUser


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
  wsl ls $args
}

function ll() {
  wsl ls -la $args
}

function grep() {
  wsl grep $args
}

function vim() {
  wsl vim $args
}

function mkdir() {
  wsl mkdir $args
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
  wsl find $args
}

function gco() {
  param(
    [Parameter(Mandatory)]
    [ValidateNotNullOrEmpty()]
    [ArgumentCompleter({
      param($pCmd, $pParam, $pWord, $pAst, $pFakes)

      $branchList = (git branch --format='%(refname:short)')

      if ([string]::IsNullOrWhiteSpace($pWord)) {
        return $branchList;
      }

      $branchList | Select-String "$pWord"
    })]
    [string] $branch
  )

  git checkout $branch;
}

function touch() {
  wsl touch $args
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
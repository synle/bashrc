#!/usr/bin/env pwsh
#######################################################
# PowerShell profile
# Microsoft.PowerShell_profile.ps1
# WindowsPowerShell/Microsoft.PowerShell_profile.ps1
# ~/Documents/WindowsPowerShell/Microsoft.PowerShell_profile.ps1
#
# Downloading the file
# set PWD to be Documents
# mkdir WindowsPowerShell
# cd WindowsPowerShell
# Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# Invoke-WebRequest -Uri "https://github.com/synle/bashrc/blob/HEAD/.build/windows-powershell-profile.ps1.bash?raw=1" -OutFile "Microsoft.PowerShell_profile.ps1"
#
# need to run this script at least once
# Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
#######################################################

# tab autocomplete
Set-PSReadlineKeyHandler -Key Tab -Function MenuComplete

# PSReadLine keybindings and interactive behavior.
# Import-Module PSReadLine
# Get-PSReadLineKeyHandler
# https://github.com/PowerShell/PSReadLine
Set-PSReadLineKeyHandler -Key Ctrl+a -Function BeginningOfLine
Set-PSReadLineKeyHandler -Key Ctrl+e -Function EndOfLine
Set-PSReadLineKeyHandler -Key Ctrl+. -Function YankLastArg
Set-PSReadLineKeyHandler -Key Ctrl+w -Function BackwardKillWord
Set-PSReadLineKeyHandler -Key Alt+d -Function KillWord
Set-PSReadLineKeyHandler -Chord "Escape, Backspace" -Function BackwardDeleteWord

Set-PSReadLineOption -PredictionViewStyle ListView # Show history predictions in a selectable list.
# Set-PSReadLineOption -Colors @{ InlinePrediction = '#6c7086' } # Keep inline suggestions subtle. # Need to figure out why this failed
Set-PSReadLineOption -BellStyle None # Disable the terminal bell.

# Reject likely credentials before PSReadLine stores commands in history.
Set-PSReadLineOption -AddToHistoryHandler {
  param($line)
  return ($line -notmatch '(?i)(password|token|secret|api.?key)')
}

# history (matches bash profile-core.sh HISTSIZE/HISTCONTROL)
$MaximumHistoryCount = 32767                                          # max allowed in Windows PowerShell 5.x — matches HISTSIZE
Set-PSReadLineOption -MaximumHistoryCount 32767                       # max allowed in Windows PowerShell 5.x — matches HISTFILESIZE
Set-PSReadLineOption -HistoryNoDuplicates                             # no duplicates — matches erasedups
Set-PSReadLineOption -HistorySearchCursorMovesToEnd                   # cursor jumps to end after history search
try { Set-PSReadLineOption -PredictionSource History } catch {}       # inline suggestions as you type from history (PSReadLine 2.2+)
Set-PSReadLineKeyHandler -Key UpArrow -Function HistorySearchBackward   # up/down arrow search — like bash reverse-search
Set-PSReadLineKeyHandler -Key DownArrow -Function HistorySearchForward

# Put preferred tools first, retain other valid PATH entries, and remove duplicates.
# Full-path normalization handles casing and trailing separators without turning C:\ into C:.
$_pathCandidates = @(
  # ---- system ----
  "C:\Program Files\Eclipse Adoptium\jdk-21.0.10.7-hotspot\bin",
  "C:\WINDOWS\system32",
  "C:\WINDOWS",
  "C:\WINDOWS\System32\Wbem",
  "C:\WINDOWS\System32\WindowsPowerShell\v1.0",
  "C:\WINDOWS\System32\OpenSSH",
  # ---- dev tools ----
  "C:\Program Files\Git\cmd",
  "C:\Program Files\dotnet",
  "C:\Program Files\PuTTY",
  "C:\Program Files\starship\bin",
  "C:\Program Files\CMake\bin",
  "C:\Program Files\nodejs",
  "C:\Program Files\GitHub CLI",
  "C:\Program Files (x86)\cloudflared",
  "C:\Program Files\Go\bin",
  "C:\Program Files\Docker\Docker\resources\bin",
  # ---- user tools ----
  "$env:USERPROFILE\.cargo\bin",
  "$env:USERPROFILE\AppData\Local\Microsoft\WindowsApps",
  "$env:USERPROFILE\AppData\Local\Programs\Microsoft VS Code\bin",
  "$env:USERPROFILE\AppData\Local\Microsoft\WinGet\Links",
  "$env:USERPROFILE\AppData\Local\Programs\VSCodium\bin",
  "C:\Program Files\Sublime Text",
  "$env:USERPROFILE\AppData\Local\Programs\Zed\bin",
  "$env:USERPROFILE\AppData\Roaming\npm",
  "$env:USERPROFILE\AppData\Local\Microsoft\WinGet\Packages\Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe\platform-tools",
  "$env:USERPROFILE\go\bin",
  "$env:USERPROFILE\.dotnet\tools",
  # ---- cli tools (matches bash cli tools section) ----
  "$env:USERPROFILE\.claude\bin",
  "$env:USERPROFILE\.local\bin"
)
# Merge preferred candidates with existing entries; preserve first occurrence and priority.
$_seen = @{}
$_newPath = @()
foreach ($_p in ($_pathCandidates + ($env:Path -split ';'))) {
  if (-not $_p -or -not $_p.Trim()) { continue }
  try {
    $_fullPath = [System.IO.Path]::GetFullPath($_p.Trim())
  } catch {
    continue
  }
  $_root = [System.IO.Path]::GetPathRoot($_fullPath)
  $_norm = if ($_fullPath.Length -gt $_root.Length) { $_fullPath.TrimEnd('\', '/') } else { $_root }
  if (-not $_seen.ContainsKey($_norm) -and (Test-Path -LiteralPath $_norm)) {
    $_seen[$_norm] = $true
    $_newPath += $_norm
  }
}
$env:Path = $_newPath -join ';'

# Cache the active local IPv4 address so prompt rendering does not query adapters each time.
$script:_networkAddressCache = $null
$script:_networkAddressCacheTime = [DateTime]::MinValue
# Look up the first usable local IPv4 address at most once every five minutes.
function Get-CachedNetworkAddress {
  if ((Get-Date) - $script:_networkAddressCacheTime -ge [TimeSpan]::FromMinutes(5)) {
    $script:_networkAddressCache = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "169.254.*" -and $_.PrefixOrigin -in @("Dhcp", "Manual") } |
      Select-Object -First 1 -ExpandProperty IPAddress
    $script:_networkAddressCacheTime = Get-Date
  }
  return $script:_networkAddressCache
}

# Aliases
Set-Alias g git
Set-Alias s ssh
Set-Alias open explorer
Set-Alias d docker
Set-Alias .. cdup
Set-Alias v vim
Set-Alias n node
Set-Alias y yarn

# Editor path candidates (single source of truth)
$_sublPaths = @(
  "C:/Program Files/Sublime Text/subl.exe",
  "C:/Program Files/Sublime Text 4/subl.exe"
)
$_smergePaths = @(
  "C:/Program Files/Sublime Merge/smerge.exe",
  "C:/Program Files/Sublime Merge 2/smerge.exe"
)
$_codePaths = @(
  "$env:LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe",
  "C:/Program Files/Microsoft VS Code/Code.exe"
)
$_zedPaths = @(
  "$env:LOCALAPPDATA/Programs/Zed/zed.exe",
  "C:/Program Files/Zed/zed.exe"
)

# Launch an editor in the background from a list of candidate paths (matches bash run_editor)
function _Launch-Editor {
  param([string]$Name, [string[]]$Paths, [string[]]$EditorArgs)
  foreach ($p in $Paths) {
    if (Test-Path $p) {
      Start-Process $p -ArgumentList $EditorArgs
      $resolvedPath = if ($EditorArgs.Count -gt 0) { Resolve-Path $EditorArgs[-1] -ErrorAction SilentlyContinue } else { "" }
      $dir = if ($resolvedPath) { Split-Path $resolvedPath -Parent } else { "" }
      Write-Host ("=" * 80) -ForegroundColor Cyan
      Write-Host """$p"" $EditorArgs"
      Write-Host "PWD: $(Get-Location)"
      if ($dir) { Write-Host "Dir: $dir" }
      if ($resolvedPath) { Write-Host "Path: $resolvedPath" }
      Write-Host ("=" * 80) -ForegroundColor Cyan
      return
    }
  }
  Write-Host "$Name`: not found"
}

# Editor aliases
function subl()   { _Launch-Editor "subl"   $script:_sublPaths   $args }
function smerge() { _Launch-Editor "smerge" $script:_smergePaths $args }
function code()   { _Launch-Editor "code"   $script:_codePaths   $args }
function zed()    { _Launch-Editor "zed"    $script:_zedPaths    $args }

Set-Alias merge smerge

# code-server: serve VS Code in the browser (code serve-web) on 0.0.0.0, token-protected (matches bash code-server).
# Token from $env:CODE_SERVER_AUTH_TOKEN; missing/invalid -> generated and persisted as a User env var.
# $env:CODE_SERVER_ADDRESS overrides the shared base URL. Copies the LAN URL to the clipboard and opens the browser.
function code-server {
  param([string]$Folder = ".", [string]$Port = "9999", [switch]$AllowCd)
  if ($Folder -in @("-h", "--help", "help", "/?")) {
    Write-Host "code-server: serve VS Code in the browser (code serve-web) on the LAN, token-protected"
    Write-Host "  code-server                    serve ./ on port 9999"
    Write-Host "  code-server <path> [<port>]    serve <path> on <port>"
    Write-Host "  code-server ... -AllowCd       acknowledge other folders are reachable (silences the lock warning)"
    Write-Host "  `$env:CODE_SERVER_AUTH_TOKEN / `$env:CODE_SERVER_ADDRESS override token / shared URL"
    Write-Host "  Default lock is NOT enforced: serve-web has no path jail; Open Folder and the terminal reach the whole disk."
    Write-Host "  WARNING: binds 0.0.0.0. Anyone on the network with the token gets full VS Code, terminal included."
    return
  }
  if (-not (Test-Path $Folder -PathType Container)) { Write-Host "code-server: not a folder: $Folder"; return }
  $Folder = (Resolve-Path $Folder).Path
  $portNumber = 0
  if (-not [int]::TryParse($Port, [ref]$portNumber) -or $portNumber -lt 1 -or $portNumber -gt 65535) {
    Write-Host "code-server: port must be 1-65535: $Port"; return
  }

  # code serve-web lives in the CLI shim next to Code.exe, not in the GUI exe itself.
  $cli = $null
  foreach ($p in $script:_codePaths) {
    $candidate = Join-Path (Split-Path $p -Parent) "bin/code.cmd"
    if (Test-Path $candidate) { $cli = $candidate; break }
  }
  if (-not $cli) { Write-Host "code-server: VS Code CLI (bin/code.cmd) not found"; return }

  $token = $env:CODE_SERVER_AUTH_TOKEN
  if (-not $token -or $token -notmatch '^[A-Za-z0-9]{16,}$') {
    $bytes = New-Object byte[] 16
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $token = -join ($bytes | ForEach-Object { $_.ToString("x2") })
    [Environment]::SetEnvironmentVariable("CODE_SERVER_AUTH_TOKEN", $token, "User")
    $env:CODE_SERVER_AUTH_TOKEN = $token
    Write-Host ">> Generated new CODE_SERVER_AUTH_TOKEN, saved as a User environment variable"
  }

  # serve-web reads the token from a file so it never shows up in the process list.
  $tokenFolder = Join-Path $env:USERPROFILE ".config/code-serve-web"
  New-Item -ItemType Directory -Force -Path $tokenFolder | Out-Null
  $tokenFile = Join-Path $tokenFolder "token"
  Set-Content -Path $tokenFile -Value $token -NoNewline

  $address = $env:CODE_SERVER_ADDRESS
  if (-not $address) {
    $ip = Get-CachedNetworkAddress
    if (-not $ip) { $ip = "<your-host-ip>" }
    $address = "http://" + $ip + ":" + $portNumber
  }
  $address = $address.TrimEnd("/")
  $url = "$address/?tkn=$token"
  $localUrl = "http://localhost:$portNumber/?tkn=$token"

  Write-Host ("=" * 80) -ForegroundColor Cyan
  Write-Host "PWD: $Folder"
  Write-Host "LAN:   $url"
  Write-Host "Local: $localUrl"
  Write-Host "(LAN URL copied to clipboard; Ctrl+C to stop)"
  Write-Host ("=" * 80) -ForegroundColor Cyan
  if (-not $AllowCd) {
    Write-Host "WARNING: folder lock NOT enforced by serve-web; Open Folder and the terminal reach the whole disk. Pass -AllowCd to acknowledge."
  }
  Set-Clipboard -Value $url

  # Open the local URL once the server has had a moment to start.
  Start-Process powershell -WindowStyle Hidden -ArgumentList @("-NoProfile", "-Command", "Start-Sleep 3; Start-Process '$localUrl'")

  & $cli serve-web --host 0.0.0.0 --port $portNumber --connection-token-file $tokenFile --default-folder $Folder --accept-server-license-terms --disable-telemetry
}

# Claude aliases (matches bash profile-advanced.sh)
function cl()  { claude --dangerously-skip-permissions $args }
function cm()  { cl --model claude-opus-4-7[1m] $args }

# --- Ollama Performance ---
# Mirrors the tuning in software/scripts/advanced/llm/ollama.profile.bash. Windows is
# where the Ollama daemon actually runs for WSL users (winget Ollama.Ollama), so the
# same values have to be set on this side too.
#
# Why each one matters (defaults per ollama/envconfig/config.go):
#   OLLAMA_CONTEXT_LENGTH  default auto, which lands near 4k on modest VRAM. That is
#                          smaller than an agentic CLI's system prompt + tool schemas,
#                          so the request is truncated and the model stalls or answers
#                          nonsense mid-turn.
#   OLLAMA_NUM_PARALLEL    total server context = context_length x num_parallel, so a
#                          high value multiplies KV VRAM, trips the loader's OOM
#                          fallback, and silently shrinks the context back down.
#   OLLAMA_KEEP_ALIVE      default 5m; a model evicted between turns costs a full
#                          reload on the next prompt, which reads as a hang.
#   OLLAMA_KV_CACHE_TYPE   q8_0 halves KV memory at very small precision loss.
#   OLLAMA_LOAD_TIMEOUT    stall detector during load; 5m is tight on a cold start.
#
# Session scope only -- a daemon started by the Ollama service or tray app never sees
# these. software/scripts/windows/_full-setup.ps1 persists the same values at User
# scope, which is what the daemon actually reads.
if (<<IS_WORK_PROFILE>> -eq 0) {
  $env:OLLAMA_FLASH_ATTENTION = "1"
  $env:OLLAMA_KV_CACHE_TYPE = "q8_0"
  $env:OLLAMA_LOAD_TIMEOUT = "10m"
  # A physical battery means laptop; anything else is treated as a desktop (matches the
  # is_system_laptop / is_system_desktop split in software/bootstrap/common-env.sh).
  if ($null -ne (Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue)) {
    # Laptop -- conserve VRAM: single slot, smaller context, shorter residency.
    $env:OLLAMA_NUM_PARALLEL = "1"
    $env:OLLAMA_CONTEXT_LENGTH = "16384"
    $env:OLLAMA_KEEP_ALIVE = "15m"
    $env:OLLAMA_MAX_LOADED_MODELS = "1"
  } else {
    # Desktop -- more VRAM headroom: bigger context, one spare slot for a second agent.
    $env:OLLAMA_NUM_PARALLEL = "2"
    $env:OLLAMA_CONTEXT_LENGTH = "32768"
    $env:OLLAMA_KEEP_ALIVE = "30m"
    $env:OLLAMA_MAX_LOADED_MODELS = "2"
  }
}

# clear - preserve scrollback buffer (match iTerm2 behavior)
function Clear-Host { [System.Console]::Write("$([char]0x1B)[H$([char]0x1B)[2J") }

# copy and paste
# Set-Alias copy Set-Clipboard
Set-Alias copy Set-Clipboard -Force -Option AllScope
function paste {
    return (Get-Clipboard) -join "`n"
}
Set-Alias bashPS "Invoke-Expression" # bashPS (paste)

# Jump up two directory levels.
function ..2 { Set-Location ../.. }
# Jump up three directory levels.
function ..3 { Set-Location ../../.. }
# Reload the current PowerShell profile into this session.
function update { . $PROFILE }
# List listening TCP connections, ordered by local port.
function ports { Get-NetTCPConnection -State Listen | Sort-Object LocalPort }
# Stop every process that owns the specified local TCP port.
# Port: TCP port number from 1 through 65535. Side effect: terminates owning processes.
function killport {
  param([Parameter(Mandatory)][ValidateRange(1, 65535)][int]$Port)
  Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    Where-Object { $_ -gt 0 } |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}
# Return the public IP address reported by ipify.
function myip { Invoke-RestMethod https://api.ipify.org }
# Return the SHA-256 digest for each supplied file.
# Path: one or more file paths. Output: SHA-256 hash strings; missing files raise an error.
function sha {
  param([Parameter(Mandatory, ValueFromRemainingArguments)][string[]]$Path)
  (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}
# Extract an archive into the current working directory.
# Path: archive file path. Side effect: extracts archive entries into current directory.
function unzip {
  param([Parameter(Mandatory)][string]$Path)
  Expand-Archive -LiteralPath $Path -DestinationPath (Get-Location).Path
}

function gogit(){
  d:
  cd git
}

# List files including hidden entries, forwarding supported Get-ChildItem options by splatting.
function ls {
  param(
    [Parameter(Position = 0)][string[]]$Path,
    [string]$Filter,
    [string[]]$Include,
    [string[]]$Exclude,
    [int]$Depth,
    [switch]$Directory,
    [switch]$File,
    [switch]$Hidden,
    [switch]$Name,
    [switch]$Recurse
  )
  $getChildItemParameters = @{ Force = $true }
  foreach ($parameterName in @("Path", "Filter", "Include", "Exclude", "Depth", "Directory", "File", "Hidden", "Name", "Recurse")) {
    if ($PSBoundParameters.ContainsKey($parameterName)) {
      $getChildItemParameters[$parameterName] = $PSBoundParameters[$parameterName]
    }
  }
  Get-ChildItem @getChildItemParameters
}

# List all entries with the long-format view.
function ll() {
  ls @args
}

function grep {
  param([Parameter(Mandatory)][string]$Pattern, [string]$Path = ".")
  Get-ChildItem $Path -Recurse -File -Exclude *.exe,*.dll |
    Where-Object { $_.FullName -notmatch '\\(node_modules|\.git)\\' } |
    Select-String -Pattern $Pattern
}

function tail {
  param([string]$Path, [int]$n = 10, [switch]$f)
  Get-Content $Path -Tail $n -Wait:$f
}

function vim() {
  _Launch-Editor "vim" ($script:_codePaths + $script:_sublPaths + $script:_zedPaths) $args
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

# Create missing files or update existing files' modification times.
function touch {
  param([Parameter(Mandatory, ValueFromRemainingArguments)][string[]]$Path)
  foreach ($p in $Path) {
    if (Test-Path -LiteralPath $p) {
      $item = Get-Item -LiteralPath $p -ErrorAction Stop
      $item.LastWriteTime = Get-Date
    } else {
      New-Item -ItemType File -Path $p -Force -ErrorAction Stop | Out-Null
    }
  }
}

# Cache expensive completion results briefly, scoped by command and working directory.
$script:_completionCache = @{}
# Key: command and working-directory identity. GetValues: deferred producer. Output: cached values.
# Side effect: retains results for 30 seconds; producer errors propagate to the caller.
function Get-CachedCompletionValues {
  param([Parameter(Mandatory)][string]$Key, [Parameter(Mandatory)][scriptblock]$GetValues)
  $now = Get-Date
  foreach ($cachedKey in @($script:_completionCache.Keys)) {
    if ($script:_completionCache[$cachedKey].ExpiresAt -le $now) {
      $script:_completionCache.Remove($cachedKey)
    }
  }
  if ($script:_completionCache.ContainsKey($Key)) {
    return $script:_completionCache[$Key].Values
  }
  $values = @(& $GetValues)
  $script:_completionCache[$Key] = @{
    Values = $values
    ExpiresAt = $now.AddSeconds(30)
  }
  return $values
}

### For the prompt
# Return current repository root, including when called from nested folders or worktrees.
# Output: Git worktree root path, or no output when current folder is outside a repository.
function Get-GitRoot {
  git rev-parse --show-toplevel 2>$null
}

# Display current branch or detached commit in the fallback prompt.
function parseGitBranch {
  $branch = git rev-parse --abbrev-ref HEAD 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host -NoNewline " [no branches yet]" -ForegroundColor "yellow"
    return
  }
  if ($branch -eq "HEAD") {
    $branch = git rev-parse --short HEAD 2>$null
  }
  Write-Host -NoNewline " [$branch]" -ForegroundColor "red"
}

# truncates deep paths, keeping first and last parts full (matches bash shorter_pwd_path)
function shorterPwdPath() {
  $splits = (Get-Location).Path -split '[/\\]'
  $result = for ($i = 0; $i -lt $splits.Count; $i++) {
    if ($i -eq 0 -or $i -eq $splits.Count - 1) { $splits[$i] }
    else { $splits[$i][0] }
  }
  $result -join '/'
}

# returns HH:mm:ss (matches bash get_time without ANSI)
function shorterTimestamp() {
  (Get-Date).ToString("HH:mm:ss")
}

# --- Starship Prompt ---
# If starship is installed, use it for the prompt. Otherwise, use the custom prompt below.
if (Get-Command starship -ErrorAction SilentlyContinue) {
  Invoke-Expression (&starship init powershell)

  # Populate Starship environment modules without running custom Git commands;
  # Starship's native Git modules provide repository status and branch information.
  $global:_original_starship_prompt = $function:prompt
  function global:prompt {
    $now = Get-Date
    $utc = $now.ToUniversalTime()
    $env:STARSHIP_LOCAL_TIME = $now.ToString("hh:mm:sstt")
    $env:STARSHIP_UTC_TIME = $utc.ToString("hh:mm:sstt")
    $env:STARSHIP_SHORT_PWD = shorterPwdPath
    $env:STARSHIP_IP_ADDR = Get-CachedNetworkAddress
    $env:STARSHIP_BASH_VER = "PS"
    & $global:_original_starship_prompt
  }
} else {
  function prompt() {
    # $path = "$($executionContext.SessionState.Path.CurrentLocation)"
    $path = "$(shorterPwdPath)"

    Write-Host "====" -NoNewline -ForegroundColor "red"
    Write-Host "`n" -NoNewline

    Write-Host "$(shorterTimestamp)" -NoNewline -ForegroundColor "yellow"
    Write-Host " $(whoami)" -NoNewline -ForegroundColor "green"
    Write-Host "`n" -NoNewline

    if (Get-GitRoot) {
      Write-Host $path -NoNewline -ForegroundColor "yellow"
      parseGitBranch
    }
    else {
      # we're not in a repo so don't bother displaying branch name/sha
      Write-Host $path -NoNewline -ForegroundColor "yellow"
    }
    Write-Host "`n" -NoNewline

    $userPrompt = "$('>' * ($nestedPromptLevel + 3)) "
    return $userPrompt
  }
}

# --- Spec-based Autocomplete ---
# Registers PowerShell argument completers from inline spec data.
# Spec format: "command subcommand|opt1,opt2,--flag1,--flag2" (one line per command prefix)
# Spec data is injected by powershell.js at build time below.
function _Register-SpecCompleter {
  param([string]$Command, [string[]]$SpecData, [int]$MaxDepthOverride = 0)
  if ($SpecData.Count -eq 0) { return }
  $MaxNestedDepth = if ($env:BASHRC_AUTOCOMPLETE_MAX_DEPTH) { [int]$env:BASHRC_AUTOCOMPLETE_MAX_DEPTH - 1 } elseif ($MaxDepthOverride -gt 0) { $MaxDepthOverride - 1 } else { <<MAX_NESTED_DEPTH>> - 1 }  # 0-indexed, tunable via env var or per-command maxDepth
  Register-ArgumentCompleter -CommandName $Command -Native -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)
    $tokens = $commandAst.ToString() -split '\s+'
    # build subcommand prefix, skipping the command name (tokens[0])
    # try longest prefix first (e.g. "rollout status"), then shorter
    $matched = $false
    for ($i = $tokens.Count - 1; $i -ge 2; $i--) {
      $prefix = ($tokens[1..($i - 1)]) -join ' '
      foreach ($line in $SpecData) {
        $parts = $line -split '\|', 2
        if ($parts.Count -eq 2 -and $parts[0].Trim() -eq $prefix) {
          $matched = $true
          $opts = $parts[1] -split ','
          break
        }
      }
      if ($matched) { break }
    }

    # base command: infer subcommands from all left-of-| values, plus any |... base line for extra completions
    if (-not $matched) {
      $opts = @()
      $opts += $SpecData | ForEach-Object { ($_ -split '\|', 2)[0].Trim() -split ' ' | Select-Object -First 1 } | Where-Object { $_ } | Sort-Object -Unique
      $baseLine = $SpecData | Where-Object { $_ -match '^\|' } | Select-Object -First 1
      if ($baseLine) {
        $opts += ($baseLine -split '\|', 2)[1] -split ','
      }
    }

    # expand dynamic tokens: __git_branches__, __git_files__, __git_remotes__
    $expanded = @()
    foreach ($o in $opts) {
      $t = $o.Trim()
      if ($t -eq '__git_branches__') {
        $expanded += (git branch --no-color 2>$null | ForEach-Object { $_.Trim('* ', ' ') })
        $expanded += (git branch -r --no-color 2>$null | ForEach-Object { $_ -replace '^\s*origin/', '' } | Where-Object { $_ -notmatch 'HEAD' })
      } elseif ($t -eq '__git_files__') {
        $expanded += (git diff --name-only 2>$null)
        $expanded += (git ls-files --others --exclude-standard 2>$null)
      } elseif ($t -eq '__git_remotes__') {
        $expanded += (git remote 2>$null)
      } elseif ($t -eq '__npm_scripts__') {
        $expanded += (node -e "try{console.log(Object.keys(require('./package.json').scripts).join('\n'))}catch(e){}" 2>$null)
      } elseif ($t -eq '__makefile_targets__') {
        if (Test-Path Makefile) { $expanded += (Select-String -Path Makefile -Pattern '^[a-zA-Z0-9_-]+:' | ForEach-Object { $_.Matches[0].Value -replace ':$', '' }) }
      } elseif ($t -eq '__cargo_targets__') {
        if (Test-Path Cargo.toml) { $expanded += (Select-String -Path Cargo.toml -Pattern 'name\s*=\s*"([^"]+)"' | ForEach-Object { $_.Matches[0].Groups[1].Value }) }
      } elseif ($t -eq '__python_scripts__') {
        if (Test-Path pyproject.toml) {
          $inSection = $false; foreach ($line in Get-Content pyproject.toml) {
            if ($line -match '^\[(project\.scripts|tool\.poetry\.scripts)\]') { $inSection = $true; continue }
            if ($inSection -and $line -match '^\[') { $inSection = $false }
            if ($inSection -and $line -match '^([a-zA-Z0-9_-]+)\s*=') { $expanded += $Matches[1] }
          }
        }
      } elseif ($t -eq '__gradle_tasks__') {
        if ((Test-Path build.gradle) -or (Test-Path build.gradle.kts)) {
          $gradleCacheKey = "gradle:$((Get-Location).Path)"
          $gradleTasks = Get-CachedCompletionValues -Key $gradleCacheKey -GetValues {
            if (Test-Path .\gradlew.bat) { & .\gradlew.bat tasks --all --quiet 2>$null | ForEach-Object { if ($_ -match '^([a-zA-Z0-9:_-]+)') { $Matches[1] } } }
            elseif (Get-Command gradle -ErrorAction SilentlyContinue) { gradle tasks --all --quiet 2>$null | ForEach-Object { if ($_ -match '^([a-zA-Z0-9:_-]+)') { $Matches[1] } } }
          }.GetNewClosure()
          $expanded += $gradleTasks
        }
      } elseif ($t -eq '__composer_scripts__') {
        if (Test-Path composer.json) { $expanded += (node -e "try{console.log(Object.keys(require('./composer.json').scripts).join('\n'))}catch(e){}" 2>$null) }
      } elseif ($t -eq '__ssh_hosts__') {
        $sshConfig = Join-Path $env:USERPROFILE '.ssh\config'
        if (Test-Path $sshConfig) { $expanded += (Select-String -Path $sshConfig -Pattern '(?i)^Host\s+(.+)' | ForEach-Object { $_.Matches[0].Groups[1].Value -split '\s+' } | Where-Object { $_ -notmatch '[*?]' }) }
        $sshConfigD = Join-Path $env:USERPROFILE '.ssh\config.d'
        if (Test-Path $sshConfigD) { $expanded += (Get-ChildItem $sshConfigD -File | ForEach-Object { Select-String -Path $_.FullName -Pattern '(?i)^Host\s+(.+)' } | ForEach-Object { $_.Matches[0].Groups[1].Value -split '\s+' } | Where-Object { $_ -notmatch '[*?]' }) }
      } elseif ($t -eq '__tldr_commands__') {
        if (Get-Command tldr -ErrorAction SilentlyContinue) { $expanded += (tldr --list 2>$null) }
      } elseif ($t -eq '__git_head_refs__') {
        $expanded += 'HEAD'
        1..100 | ForEach-Object { $expanded += "HEAD~$_" }
        $carets = '^'; 1..10 | ForEach-Object { $expanded += "HEAD$carets"; $carets += '^' }
      } elseif ($t -eq '__git_commits__') {
        $expanded += (git log --format='%h' -500 2>$null)
      } elseif ($t -eq '__files__') {
        $expanded += (Get-ChildItem -File -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
      } elseif ($t -eq '__folders__') {
        $expanded += (Get-ChildItem -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
      } elseif ($t -eq '__nested_text_files__') {
        $binaryExts = @('.7z','.a','.aac','.apk','.avi','.bmp','.bz2','.class','.db','.dds','.deb','.dll','.dmg','.doc','.docx','.dylib','.eot','.exe','.flac','.flv','.gif','.gz','.heic','.ico','.idb','.jar','.jpeg','.jpg','.lib','.mkv','.mov','.mp3','.mp4','.msi','.ncb','.o','.obj','.ogg','.pdb','.pdf','.png','.ppt','.pptx','.psd','.rar','.rpm','.sdf','.so','.sqlite','.svg','.swf','.tar','.tga','.tiff','.ttf','.wasm','.wav','.webp','.wmv','.woff','.woff2','.xls','.xlsx','.xz','.zip')
        $cacheKey = "nested-text:$((Get-Location).Path):$MaxNestedDepth"
        $expanded += Get-CachedCompletionValues -Key $cacheKey -GetValues {
          Get-ChildItem -File -Recurse -Depth $MaxNestedDepth -ErrorAction SilentlyContinue | Where-Object { $binaryExts -notcontains $_.Extension } | ForEach-Object { $_.FullName | Resolve-Path -Relative }
        }.GetNewClosure()
      } elseif ($t -eq '__nested_files__') {
        $cacheKey = "nested-files:$((Get-Location).Path):$MaxNestedDepth"
        $expanded += Get-CachedCompletionValues -Key $cacheKey -GetValues {
          Get-ChildItem -File -Recurse -Depth $MaxNestedDepth -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName | Resolve-Path -Relative }
        }.GetNewClosure()
      } elseif ($t -eq '__nested_folders__') {
        $cacheKey = "nested-folders:$((Get-Location).Path):$MaxNestedDepth"
        $expanded += Get-CachedCompletionValues -Key $cacheKey -GetValues {
          Get-ChildItem -Directory -Recurse -Depth $MaxNestedDepth -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName | Resolve-Path -Relative }
        }.GetNewClosure()
      } elseif ($t -eq '__nested_paths__') {
        $cacheKey = "nested-paths:$((Get-Location).Path):$MaxNestedDepth"
        $expanded += Get-CachedCompletionValues -Key $cacheKey -GetValues {
          Get-ChildItem -Recurse -Depth $MaxNestedDepth -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName | Resolve-Path -Relative }
        }.GetNewClosure()
      } elseif ($t -eq '__paths__') {
        $expanded += (Get-ChildItem -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
      } else {
        $expanded += $t
      }
    }
    $expanded | ForEach-Object {
      $opt = $_.Trim()
      if ($opt -and $opt -like "$wordToComplete*") {
        [System.Management.Automation.CompletionResult]::new($opt, $opt, 'ParameterValue', $opt)
      }
    }
  }.GetNewClosure()
}

# --- profile blocks (filled by registerWithPowershellProfile) ---
# BEGIN/END - adb

# clear; # clean up the prompt

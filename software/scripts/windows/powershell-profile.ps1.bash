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

# keybindings
# Import-Module PSReadLine
# Get-PSReadLineKeyHandler
# https://github.com/PowerShell/PSReadLine
Set-PSReadLineKeyHandler -Key Ctrl+a -Function BeginningOfLine
Set-PSReadLineKeyHandler -Key Ctrl+e -Function EndOfLine
Set-PSReadLineKeyHandler -Key Ctrl+. -Function YankLastArg
Set-PSReadLineKeyHandler -Chord "Escape, Backspace" -Function BackwardDeleteWord

# history (matches bash profile-core.sh HISTSIZE/HISTCONTROL)
$MaximumHistoryCount = 32767                                          # max allowed in Windows PowerShell 5.x — matches HISTSIZE
Set-PSReadLineOption -MaximumHistoryCount 32767                       # max allowed in Windows PowerShell 5.x — matches HISTFILESIZE
Set-PSReadLineOption -HistoryNoDuplicates                             # no duplicates — matches erasedups
Set-PSReadLineOption -HistorySearchCursorMovesToEnd                   # cursor jumps to end after history search
try { Set-PSReadLineOption -PredictionSource History } catch {}       # inline suggestions as you type from history (PSReadLine 2.2+)
Set-PSReadLineKeyHandler -Key UpArrow -Function HistorySearchBackward   # up/down arrow search — like bash reverse-search
Set-PSReadLineKeyHandler -Key DownArrow -Function HistorySearchForward

# PATH reconstruction — desired order, merged with current PATH, existence-checked, deduped
# (matches bash-path-candidate.profile.bash approach)
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
# merge candidates (priority) + current PATH entries, filter existing, dedupe case-insensitively
$_seen = @{}
$_newPath = @()
foreach ($_p in ($_pathCandidates + ($env:Path -split ';'))) {
  $_norm = $_p.TrimEnd('\').ToLower()
  if ($_norm -and -not $_seen.ContainsKey($_norm) -and (Test-Path $_p)) {
    $_seen[$_norm] = $true
    $_newPath += $_p.TrimEnd('\')
  }
}
$env:Path = $_newPath -join ';'

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
      Write-Host "===================================="
      Write-Host """$p"" $EditorArgs"
      Write-Host "PWD: $(Get-Location)"
      if ($dir) { Write-Host "Dir: $dir" }
      if ($resolvedPath) { Write-Host "Path: $resolvedPath" }
      Write-Host "===================================="
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

# Claude aliases (matches bash profile-advanced.sh)
function cl()  { claude --dangerously-skip-permissions $args }
function cm()  { cl --model claude-opus-4-7[1m] $args }

# --- Ollama Performance ---
# Mirrors software/scripts/advanced/llm/ollama.profile.bash. Windows is where the
# daemon actually runs for WSL users (winget Ollama.Ollama), so the tuning and the
# recovery helpers have to exist on this side too.
#
# Why each var matters (defaults per ollama/envconfig/config.go):
#   OLLAMA_CONTEXT_LENGTH  default auto, which lands near 4k on modest VRAM. That
#                          is smaller than an agentic CLI's system prompt + tool
#                          schemas, so the request is truncated and the model
#                          stalls or answers nonsense mid-turn.
#   OLLAMA_NUM_PARALLEL    total server context = context_length x num_parallel, so
#                          a high value multiplies KV VRAM, trips the loader's OOM
#                          fallback, and silently shrinks context back down.
#   OLLAMA_KEEP_ALIVE      default 5m; a model evicted between turns costs a full
#                          reload on the next prompt, which reads as a hang.
#   OLLAMA_KV_CACHE_TYPE   q8_0 halves KV memory at very small precision loss.
#   OLLAMA_LOAD_TIMEOUT    stall detector during load; 5m is tight when cold.
#
# Session-scope only. Use Set-OllamaDaemonEnv (ollama_apply_daemon_env) to persist
# them for the background daemon, which starts with a clean environment.
$env:OLLAMA_FLASH_ATTENTION = "1"
$env:OLLAMA_KV_CACHE_TYPE = "q8_0"
$env:OLLAMA_LOAD_TIMEOUT = "10m"
# A physical battery means laptop; anything else is treated as a desktop (matches
# the is_system_laptop / is_system_desktop split in software/bootstrap/common-env.sh).
$script:_syIsLaptop = $null -ne (Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue)
if ($script:_syIsLaptop) {
  $env:OLLAMA_NUM_PARALLEL = "1"
  $env:OLLAMA_CONTEXT_LENGTH = "16384"
  $env:OLLAMA_KEEP_ALIVE = "15m"
  $env:OLLAMA_MAX_LOADED_MODELS = "1"
} else {
  $env:OLLAMA_NUM_PARALLEL = "2"
  $env:OLLAMA_CONTEXT_LENGTH = "32768"
  $env:OLLAMA_KEEP_ALIVE = "30m"
  $env:OLLAMA_MAX_LOADED_MODELS = "2"
}

# The OLLAMA_* names this profile manages — Set-OllamaDaemonEnv persists exactly this
# list, so adding a var above is enough for it to be picked up there too.
$script:_syOllamaManagedEnvVars = @(
  "OLLAMA_FLASH_ATTENTION",
  "OLLAMA_KV_CACHE_TYPE",
  "OLLAMA_LOAD_TIMEOUT",
  "OLLAMA_NUM_PARALLEL",
  "OLLAMA_CONTEXT_LENGTH",
  "OLLAMA_KEEP_ALIVE",
  "OLLAMA_MAX_LOADED_MODELS"
)
$script:_syOllamaPort = if ($env:SY_OMEN45L_OLLAMA_PORT) { $env:SY_OMEN45L_OLLAMA_PORT } else { "11434" }

# Normalize a bare host / host:port / full URL into a full Ollama base URL.
# Empty resolves to $env:SY_OMEN45L_IP when set, else loopback. No address is
# hardcoded — software/metadata/ip-address.config stays the single source of truth.
function _Get-OllamaUrl {
  param([string]$OllamaHost = "")
  $port = $script:_syOllamaPort
  if (-not $OllamaHost) {
    $OllamaHost = if ($env:SY_OMEN45L_IP) { "$($env:SY_OMEN45L_IP):$port" } else { "127.0.0.1:$port" }
  }
  if ($OllamaHost -match '^https?://') {
    if ($OllamaHost -match '^[a-zA-Z]+://[^:/]+$') { $OllamaHost = "$($OllamaHost):$port" }
    return $OllamaHost
  }
  if ($OllamaHost -notmatch ':') { $OllamaHost = "$($OllamaHost):$port" }
  return "http://$OllamaHost"
}

# List the models an Ollama endpoint exposes via GET /api/tags.
function Get-OllamaModels {
  param([string]$OllamaHost = "")
  $url = _Get-OllamaUrl $OllamaHost
  Write-Host "Fetching models from $url..." -ForegroundColor DarkGray
  try {
    (Invoke-RestMethod -Uri "$url/api/tags" -TimeoutSec 5).models | ForEach-Object { $_.name }
  } catch {
    Write-Host "Get-OllamaModels: no response from $url" -ForegroundColor Red
  }
}

# Show resident models: total size, how much sits in VRAM, and keep-alive expiry.
# A VRAM figure below the total size means the model spilled to CPU — inference
# drops several times slower and long turns start to look like a hang.
function Get-OllamaPs {
  param([string]$OllamaHost = "")
  $url = _Get-OllamaUrl $OllamaHost
  try {
    $models = (Invoke-RestMethod -Uri "$url/api/ps" -TimeoutSec 5).models
  } catch {
    Write-Host "Get-OllamaPs: no response from $url/api/ps" -ForegroundColor Red
    return
  }
  if (-not $models -or $models.Count -eq 0) { Write-Host "no models loaded"; return }
  $models | ForEach-Object {
    [PSCustomObject]@{
      Name    = $_.name
      SizeGB  = [math]::Round($_.size / 1GB, 1)
      VramGB  = [math]::Round($_.size_vram / 1GB, 1)
      Context = $_.context_length
      Expires = $_.expires_at
    }
  } | Format-Table -AutoSize
}

# Evict loaded models so a wedged or oversized load can be retried clean. Try this
# first when a local model stops responding mid-turn; escalate to Restart-Ollama only
# when unloading does not clear the stall.
function Remove-OllamaLoadedModel {
  param([string]$Model = "", [string]$OllamaHost = "")
  $url = _Get-OllamaUrl $OllamaHost
  if (-not $Model) {
    try { $loaded = (Invoke-RestMethod -Uri "$url/api/ps" -TimeoutSec 5).models } catch { $loaded = @() }
    if (-not $loaded -or $loaded.Count -eq 0) { Write-Host "nothing loaded on $url"; return }
    $loaded | ForEach-Object { Remove-OllamaLoadedModel -Model $_.name -OllamaHost $OllamaHost }
    return
  }
  Write-Host ">> unloading $Model from $url"
  $body = @{ model = $Model; messages = @(); keep_alive = 0 } | ConvertTo-Json -Depth 3
  try {
    Invoke-RestMethod -Uri "$url/api/chat" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 10 | Out-Null
  } catch {
    Write-Host "unload failed: $($_.Exception.Message)" -ForegroundColor Red
  }
}

# Preload a model so the first real prompt is not charged the multi-GB load time.
function Start-OllamaWarmup {
  param([string]$Model = "", [string]$OllamaHost = "")
  $url = _Get-OllamaUrl $OllamaHost
  if (-not $Model) {
    $Model = if ($env:SY_OMEN45L_OLLAMA_DEFAULT_MODEL) { $env:SY_OMEN45L_OLLAMA_DEFAULT_MODEL } else { (Get-OllamaModels $OllamaHost | Select-Object -First 1) }
  }
  if (-not $Model) { Write-Host "Start-OllamaWarmup: no model available on $url" -ForegroundColor Red; return }
  Write-Host ">> warming up $Model on $url (loads the weights; can take a minute)"
  $body = @{ model = $Model; messages = @() } | ConvertTo-Json -Depth 3
  try {
    Invoke-RestMethod -Uri "$url/api/chat" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 600 | Out-Null
    Write-Host ">> $Model is resident" -ForegroundColor Green
  } catch {
    Write-Host "warmup failed: $($_.Exception.Message)" -ForegroundColor Red
  }
}

# Restart the local Ollama daemon. Recent Windows builds ship a per-user
# "ollama app.exe" tray process rather than a service, so both are handled.
function Restart-Ollama {
  $svc = Get-Service -Name "Ollama" -ErrorAction SilentlyContinue
  if ($svc) {
    Write-Host ">> Restart-Service Ollama"
    try { Restart-Service -Name "Ollama" -Force -ErrorAction Stop; return } catch {
      Write-Host "Restart-Service failed (needs an elevated shell): $($_.Exception.Message)" -ForegroundColor Red
      return
    }
  }
  Write-Host ">> restarting the Ollama tray app"
  Get-Process -Name "ollama app", "ollama" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  $appPath = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama app.exe"
  if (Test-Path $appPath) { Start-Process $appPath }
  else { Write-Host "Ollama app not found at $appPath — start it from the Start menu" -ForegroundColor Yellow }
}

# Persist the managed OLLAMA_* vars for the background daemon. The session-scope
# assignments above never reach a service or tray process, which starts with a clean
# environment and silently falls back to a ~4k auto context. -Lan additionally binds
# the daemon to every interface so WSL and other machines on the home network can
# reach it (that also needs an inbound firewall rule for the port).
function Set-OllamaDaemonEnv {
  param([switch]$Lan)
  foreach ($name in $script:_syOllamaManagedEnvVars) {
    $value = [Environment]::GetEnvironmentVariable($name, "Process")
    if (-not $value) { continue }
    [Environment]::SetEnvironmentVariable($name, $value, "User")
    Write-Host "   $name=$value"
  }
  if ($Lan) {
    $bind = "0.0.0.0:$($script:_syOllamaPort)"
    [Environment]::SetEnvironmentVariable("OLLAMA_HOST", $bind, "User")
    Write-Host "   OLLAMA_HOST=$bind"
    Write-Host "   port $($script:_syOllamaPort) is already allowed inbound on private networks by _full-setup.ps1; open it manually only if that never ran" -ForegroundColor Yellow
  }
  Write-Host ">> user environment updated. Run Restart-Ollama for it to take effect." -ForegroundColor Green
}

# One-shot diagnosis for an endpoint that hangs or stops mid-answer. Checks
# reachability, installed models, residency/VRAM spill, the tuning this session
# exports, and a live one-token generation to separate a wedged daemon from a
# client that gave up.
function Test-OllamaHealth {
  param([string]$OllamaHost = "")
  $url = _Get-OllamaUrl $OllamaHost
  Write-Host "== ollama_doctor: $url =="
  try {
    $version = (Invoke-RestMethod -Uri "$url/api/version" -TimeoutSec 5).version
    Write-Host "[ok]   reachable - $version" -ForegroundColor Green
  } catch {
    Write-Host "[FAIL] unreachable - daemon down, wrong port, or firewalled" -ForegroundColor Red
    Write-Host "       Try: Restart-Ollama"
    return
  }

  $models = @(Get-OllamaModels $OllamaHost)
  Write-Host "[ok]   $($models.Count) model(s) installed" -ForegroundColor Green

  Write-Host "-- resident models --"
  Get-OllamaPs $OllamaHost

  Write-Host "-- this session's tuning (the daemon may differ - see Set-OllamaDaemonEnv) --"
  foreach ($name in $script:_syOllamaManagedEnvVars) {
    $value = [Environment]::GetEnvironmentVariable($name, "Process")
    if (-not $value) { $value = "<unset>" }
    Write-Host "   $name=$value"
  }

  if ($models.Count -eq 0) {
    Write-Host "[warn] no models installed - pull one, e.g. ollama pull qwen2.5-coder:7b" -ForegroundColor Yellow
    return
  }

  Write-Host "-- live generation probe ($($models[0])) --"
  $body = @{ model = $models[0]; prompt = "say ok"; stream = $false; options = @{ num_predict = 1 } } | ConvertTo-Json -Depth 3
  try {
    Invoke-RestMethod -Uri "$url/api/generate" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 120 | Out-Null
    Write-Host "[ok]   generation succeeded - the daemon is healthy" -ForegroundColor Green
  } catch {
    Write-Host "[FAIL] generation timed out or errored" -ForegroundColor Red
    Write-Host "       Try, in order: Remove-OllamaLoadedModel / Restart-Ollama / a smaller model"
  }
}

# bash-compatible names so the same muscle memory works in either shell
Set-Alias list_ollama_models Get-OllamaModels
Set-Alias ollama_ps Get-OllamaPs
Set-Alias ollama_unload Remove-OllamaLoadedModel
Set-Alias ollama_warmup Start-OllamaWarmup
Set-Alias ollama_restart Restart-Ollama
Set-Alias ollama_apply_daemon_env Set-OllamaDaemonEnv
Set-Alias ollama_doctor Test-OllamaHealth

# clear - preserve scrollback buffer (match iTerm2 behavior)
function Clear-Host { [System.Console]::Write("$([char]0x1B)[H$([char]0x1B)[2J") }

# copy and paste
# Set-Alias copy Set-Clipboard
Set-Alias copy Set-Clipboard -Force -Option AllScope
function paste {
    return (Get-Clipboard) -join "`n"
}
Set-Alias bashPS "Invoke-Expression" # bashPS (paste)

# functions
function gogit(){
  d:
  cd git
}

function ls() {
  Get-ChildItem -Force %args
}

function ll() {
  ls  $args
}

function grep() {
  Get-ChildItem -Recurse | Where-Object { $_.PSIsContainer -eq $false -and $_.FullName -notmatch '\\node_modules\\' }  | Select-String -Pattern "$args"
}

function tail {
  param (
      [string]$FilePath
  )

  if (-Not (Test-Path $FilePath)) {
    Write-Host "File does not exist: $FilePath"
    return
  }

  Get-Content $FilePath -Wait
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

  # wrap starship's prompt to populate env vars before each render
  # (matches bash _starship_preexec — starship reads these via env_var modules)
  $global:_original_starship_prompt = $function:prompt
  function global:prompt {
    $now = Get-Date
    $utc = $now.ToUniversalTime()
    $env:STARSHIP_LOCAL_TIME = $now.ToString("hh:mm:sstt")
    $env:STARSHIP_UTC_TIME = $utc.ToString("hh:mm:sstt")
    $env:STARSHIP_SHORT_PWD = shorterPwdPath
    # IP address: grab first IPv4 from active adapters
    $env:STARSHIP_IP_ADDR = (Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty IPAddress) -join ","
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

    if (Test-Path .git) {
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
  $MaxNestedDepth = if ($env:BASHRC_AUTOCOMPLETE_MAX_DEPTH) { [int]$env:BASHRC_AUTOCOMPLETE_MAX_DEPTH - 1 } elseif ($MaxDepthOverride -gt 0) { $MaxDepthOverride - 1 } else { {{MAX_NESTED_DEPTH}} - 1 }  # 0-indexed, tunable via env var or per-command maxDepth
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
          if (Test-Path .\gradlew.bat) { $expanded += (& .\gradlew.bat tasks --all --quiet 2>$null | ForEach-Object { if ($_ -match '^([a-zA-Z0-9:_-]+)') { $Matches[1] } }) }
          elseif (Get-Command gradle -ErrorAction SilentlyContinue) { $expanded += (gradle tasks --all --quiet 2>$null | ForEach-Object { if ($_ -match '^([a-zA-Z0-9:_-]+)') { $Matches[1] } }) }
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
        $expanded += (Get-ChildItem -File -Recurse -Depth $MaxNestedDepth -ErrorAction SilentlyContinue | Where-Object { $binaryExts -notcontains $_.Extension } | ForEach-Object { $_.FullName | Resolve-Path -Relative })
      } elseif ($t -eq '__nested_files__') {
        $expanded += (Get-ChildItem -File -Recurse -Depth $MaxNestedDepth -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName | Resolve-Path -Relative })
      } elseif ($t -eq '__nested_folders__') {
        $expanded += (Get-ChildItem -Directory -Recurse -Depth $MaxNestedDepth -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName | Resolve-Path -Relative })
      } elseif ($t -eq '__nested_paths__') {
        $expanded += (Get-ChildItem -Recurse -Depth $MaxNestedDepth -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName | Resolve-Path -Relative })
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

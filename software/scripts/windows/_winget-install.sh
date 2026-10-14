#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# Install winget packages from WSL bash. Canonical source of truth for the
# Windows-side package list — calls winget.exe through WSL interop, applying
# skip-if-installed / force-reinstall logic.
#
# Use case: install / refresh the Windows-side package set without leaving
# bash. _full-setup.ps1.bash no longer carries a duplicate package list; it
# only handles WSL bootstrap, firewall, GPU tuning, and msstore-only items
# (media extensions). Run this script from WSL after the PS1 finishes:
#   bash run.sh --files=_winget-install.sh
#
# Caveats:
#   - Many packages declare `Scope: machine` in their winget-pkgs manifest
#     (Zed, VS Code, Brave, Git, the VCRedist set, ...) and so install into
#     Program Files behind an elevated Windows token. Two facts drive the
#     handling below: `sudo` inside WSL does NOT elevate the Windows side, and
#     WSL interop hands the launching terminal's token to Windows children —
#     so the session has to be started from an elevated Windows Terminal.
#     Installers that self-elevate still raise their own UAC prompt; the rest
#     fail, which is why the install loop now reports failures per package
#     instead of swallowing them (see `_is_windows_elevated` and the summary).
#   - winget output is UTF-16 in some Windows locales. Package-list output is
#     normalized by removing NUL bytes before exact id matching; never pipe
#     unknown encoding through iconv, which accepts UTF-8 as malformed UTF-16
#     and returns successful mojibake.

# Skip on non-Windows hosts. winget.exe only exists on Windows / WSL.
if ! ((is_os_windows)); then
  echo ">>> Skipped winget-install: not a Windows / WSL host"
  exit 0
fi

if ! has_persistent_binary winget.exe > /dev/null 2>&1 && ! type -P winget.exe > /dev/null 2>&1; then
  echo ">>> Skipped winget-install: winget.exe not on PATH (run windows-bootstrap first)"
  exit 0
fi

################################################################################
# --- Elevation probe ---
#
# Reports whether the Windows side of this WSL session holds an elevated token,
# which is what machine-scope winget installers need. Probed through a Windows
# binary rather than `sudo` / `id`, because the Linux uid says nothing about the
# Windows token — root in WSL still runs Windows children unelevated.
#
# Tri-state on purpose: "could not tell" must never collapse into "not
# elevated", or a correctly-set-up machine gets told to relaunch for nothing.
#   0 — elevated
#   1 — not elevated
#   2 — probe could not run (no powershell.exe, interop disabled, ...)
################################################################################
function _is_windows_elevated() {
  # The answer is lowercased as well as stripped: a capitalized variant would
  # fall through to "unknown", which reports the session as not-elevated and
  # sends the user to relaunch for nothing. NUL stripping covers UTF-16LE —
  # `y\0e\0s\0` has to read as `yes`.
  local answer
  answer=$(powershell.exe -NoProfile -NonInteractive -Command "if (([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { 'yes' } else { 'no' }" < /dev/null 2> /dev/null | tr -d '\000\r[:space:]' | tr '[:upper:]' '[:lower:]')
  case "$answer" in
  yes) return 0 ;;
  no) return 1 ;;
  *) return 2 ;;
  esac
}

################################################################################
# --- winget message reader ---
#
# Reduces a captured winget message to its last non-empty line — where winget
# puts its summary once the progress bar is done, and where it names the actual
# reason for a failure (elevation, hash mismatch, no installer for this
# architecture, ...).
#
# Deliberately does NOT transcode UTF-16, even though winget emits it in some
# Windows locales. Two reasons, both verified:
#   - `iconv -f UTF-16LE` does not fail on UTF-8 ASCII input, it reinterprets
#     the bytes and returns mojibake ("boom" -> "\u6f66\u6d6f"). A "try it,
#     fall back on failure" test therefore mangles the common case rather than
#     rescuing the rare one.
#   - a bash string cannot hold a NUL byte and `$(...)` silently drops them, so
#     by the time output reaches this function genuinely-UTF-16 text has already
#     lost the information any transcode would need.
# A partly-garbled reason on an exotic host still beats silence: the package id
# and exact source-lookup result come from this script, so the actionable part
# survives either way.
#
# $1 — raw captured stdout+stderr. Prints nothing and returns 0 when there is
#      no non-empty line to report.
################################################################################
function _winget_last_line() {
  printf '%s' "$1" | tr -d '\r' | grep -v '^[[:space:]]*$' | tail -n 1
}

# _winget_package_is_installed <id> - Returns 0 when winget list contains the
# exact package id as a whitespace-delimited field. Exact matching prevents a
# retired id such as Python.Python.3 from matching Python.Python.3.12.
function _winget_package_is_installed() {
  printf '%s\n' "$_installed_packages" | command awk -v package_id="$1" '
    {
      for (field = 1; field <= NF; field++) {
        if ($field == package_id) found = 1
      }
    }
    END { exit !found }
  '
}

################################################################################
# --- Config ---
#
# FORCE_INSTALL — controls the winget install loop below:
#
#   0 (DEFAULT) — skip packages that already show up in the cached
#     `winget.exe list` output, install everything else with
#     `--force --uninstall-previous`. Fast and idempotent.
#
#   1 — bypass the skip check and reinstall EVERY package via
#     `--force --uninstall-previous`. Slow, but useful when a prior install
#     is broken / partially registered, when winget's "installed" detection
#     is stale, or when you want to re-pull the latest installer for
#     everything in one shot.
#
# What the install flags do:
#   --force                ignore winget's own "already installed",
#                          hash-mismatch, and applicability checks.
#   --uninstall-previous   remove the existing version before installing,
#                          so you get a clean install rather than an
#                          in-place repair.
################################################################################

# Flip to 1 to force-reinstall every winget package on the next run.
FORCE_INSTALL=0

# Canonical Windows package list — single source of truth.
#
# Every id below must be verified against the live winget source. `winget search
# --id X -e` is CASE-SENSITIVE even though winget's own docs imply otherwise:
# `JesseDuffield.Lazydocker` resolves and `jesseduffield.lazydocker` returns
# "No package found", which fails an install for a package that plainly exists.
# Three entries were broken that way alone.
#
# Re-verify after editing this list. Runtime exact-id matching prevents a stale
# id from hiding behind a longer installed id, and any failed install gets an
# exact source lookup before reporting the cause. Keep the manual sweep too: it
# catches a dead id before a user pays for a full setup.
#   sed -n '/^winget_packages=($/,/^)/p' software/scripts/windows/_winget-install.sh \
#     | sed -E 's/^[[:space:]]*"?([A-Za-z0-9._+-]+)"?[[:space:]]*(#.*)?$/\1/'
#   # then, per id: winget.exe search --id <ID> -e --source winget
#
winget_packages=(
  # ---- Core: browser, terminal, editors ----
  # Fira Code is installed by software/scripts/fonts.js (drops the TTFs into
  # the per-OS font folder), so we deliberately skip the winget package here
  # to avoid double-installing the same font.
  "Brave.Brave"
  "Microsoft.WindowsTerminal"
  "Microsoft.VisualStudioCode"
  "SublimeHQ.SublimeText.4"
  "SublimeHQ.SublimeMerge"

  # ---- Git ----
  "Git.Git"
  "GitHub.GitLFS"
  "GitHub.cli"
  # git-filter-repo is deliberately absent: winget publishes no package for it
  # (verified against a refreshed source index). Unix hosts get it from
  # _full-setup.sh, and it is a required CI binary in ci-binaries.json — only
  # the Windows winget path has no installer.

  # ---- CLI Utilities (cross-platform parity with Unix _full-setup.sh) ----
  "7zip.7zip"
  "BurntSushi.ripgrep.MSVC"
  "junegunn.fzf"
  "jqlang.jq"
  "MikeFarah.yq"
  "sharkdp.bat"
  "sharkdp.fd"
  "dandavison.delta"
  "ajeetdsouza.zoxide"
  "eza-community.eza"
  "dbrgn.tealdeer"
  "astral-sh.uv"
  "Cloudflare.cloudflared"
  "Google.PlatformTools"
  "Starship.Starship"

  # ---- Dev Tools & Runtimes ----
  "OpenJS.NodeJS"
  "Python.Python.3.12"
  "Rustlang.Rustup"
  "GoLang.Go"
  "DenoLand.Deno"
  "Oven-sh.Bun"
  # Gradle is deliberately absent: winget publishes no package for it. Windows
  # builds use the gradlew wrapper, which needs no Gradle install, and
  # `gradle` is already excluded from the Windows completion spec.
  "EclipseAdoptium.Temurin.21.JDK"
  "Kitware.CMake"
  "Kubernetes.kubectl"
  "LLVM.LLVM"
  "Microsoft.VisualStudio.2022.BuildTools"
  "Hashicorp.Terraform"
  "Helm.Helm"
  "Derailed.k9s"
  "JesseDuffield.Lazydocker"
  "Microsoft.DotNet.SDK.8"
  "Microsoft.DotNet.DesktopRuntime.6"
  "Microsoft.DotNet.DesktopRuntime.7"
  "Microsoft.DotNet.DesktopRuntime.8"
  "Microsoft.PowerShell"

  # ---- Local LLM ----
  "ElementLabs.LMStudio" # LM Studio GUI — local LLM runner (https://lmstudio.ai)

  # ---- AI / agentic CLIs ----
  "GitHub.Copilot" # `copilot` — GitHub Copilot CLI (https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli)

  # ---- Cloud CLIs ----
  "Amazon.AWSCLI"
  "Google.CloudSDK"
  "Microsoft.AzureCLI"

  # ---- GUI Applications ----
  "Audacity.Audacity"
  "Bambulab.Bambustudio"
  "BlenderFoundation.Blender"
  "CodeSector.TeraCopy"
  "Discord.Discord"
  "Docker.DockerDesktop"
  "dotPDN.PaintDotNet"
  "Postman.Postman"
  "Greenshot.Greenshot"
  "HandBrake.HandBrake"
  "Inkscape.Inkscape"
  "KDE.Krita"
  "PuTTY.PuTTY"
  "Rufus.Rufus"
  "Ultimaker.Cura"
  "Valve.Steam"
  "VideoLAN.VLC"
  "WinMerge.WinMerge"
  "WinSCP.WinSCP"
  "Zoom.Zoom"

  # ---- Multimedia ----
  "Gyan.FFmpeg"
  "ImageMagick.Q16-HDRI"

  # ---- Windows-Specific Runtimes & Drivers ----
  "Microsoft.VCRedist.2005.x86"
  "Microsoft.VCRedist.2005.x64"
  "Microsoft.VCRedist.2008.x86"
  "Microsoft.VCRedist.2008.x64"
  "Microsoft.VCRedist.2010.x86"
  "Microsoft.VCRedist.2010.x64"
  "Microsoft.VCRedist.2012.x86"
  "Microsoft.VCRedist.2012.x64"
  "Microsoft.VCRedist.2013.x86"
  "Microsoft.VCRedist.2013.x64"
  "Microsoft.VCRedist.2015+.x86"
  "Microsoft.VCRedist.2015+.x64"
  "Microsoft.DirectX"
  "Microsoft.XNARedist"
  "CreativeTechnology.OpenAL"
  "WinFsp.WinFsp"
  "SSHFS-Win.SSHFS-Win"
)

if ((!is_work_profile)); then
  winget_packages+=("Ollama.Ollama")
fi

# Packages that must be reinstalled on EVERY pass — the "already installed"
# check is never consulted for these, and the install always runs with
# `--force --uninstall-previous`.
#
# Why Zed lives here: its machine-scope install keeps half-failing in place.
# A previous Zed build is registered with winget, the skip check sees it, and
# the run reports success while the editor is stale, broken, or missing its
# per-user registration. Skipping is what kept the failure going; forcing the
# reinstall every pass is the reliable fix.
winget_required_packages=(
  "ZedIndustries.Zed"
)

# --- Install-loop gate ---
#
# Gated on THIS SCRIPT'S OWN STAMP plus the run's intent — never on
# `is_bash_syle_stale`.
#
# `is_bash_syle_stale` measures $BASH_SYLE_PATH, and software/scripts/_init.js
# wipes and rewrites that file at the very start of every run. By the time this
# script is reached (~85% through), the profile is seconds old, so the check was
# ALWAYS false and the install loop could never execute. Confirmed against
# $BASHRC_TEMP_DIR/../2026_09_27_05_22/run.log: a `--setup` run logged
# "Listing available winget upgrades (bash_syle is fresh; informational only)"
# and installed nothing, leaving Zed and every other package absent with no
# error anywhere. The gate was measuring a file the same run had just rewritten.
#
#   - full setup (IS_SETUP, exported by run.sh) -> always run the install loop.
#   - plain run  -> run it when this script's stamp is missing or 2+ weeks old.
#   - fresh stamp -> LIST pending upgrades only (no `--all`; bulk upgrade is too
#     slow for every run, and the listing is informational).
#
# The stamp lives beside the profile rather than inside it so that regenerating
# the profile can never reset the installer clock again.
WINGET_INSTALL_STAMP_PATH="$BASH_SYLE_PATH.winget-install"

if ((IS_SETUP)) || is_path_stale "$WINGET_INSTALL_STAMP_PATH"; then
  echo ">>> Installing winget packages (foreground, sequential)"

  # Refresh winget source index so installs resolve latest versions.
  # `< /dev/null` is mandatory: this script is bundled into a `bash <<'EOF'`
  # heredoc by _emitBundledShScripts, and winget.exe (via WSL interop) will
  # happily read from the heredoc's stdin, swallowing the rest of the script
  # and causing bash to exit silently after the first echo.
  winget.exe source update --disable-interactivity < /dev/null > /dev/null 2>&1 || true

  # Cache all installed packages once upfront — avoids spawning winget.exe list
  # per package (~1-2s each).
  #
  # Winget package ids use ASCII. Removing NUL bytes normalizes both UTF-8 and
  # UTF-16 output without guessing an encoding or risking iconv mojibake. A
  # failed list is fatal: treating it as an empty list would force-reinstall
  # every package, including Docker Desktop and Steam.
  _winget_list_file="$BASHRC_TEMP_DIR/winget-list.txt"
  if ! winget.exe list < /dev/null > "$_winget_list_file" 2> /dev/null; then
    echo ">>> FAILED: could not list installed winget packages; refusing to reinstall the full package set"
    exit 1
  fi
  _installed_packages=$(tr -d '\000\r' < "$_winget_list_file")

  # Probe elevation once, up front. Every machine-scope package below fails
  # without it, and a silent no-op install is the worst outcome: the user
  # cannot tell "not installed" from "installed and fine". The remedy is the
  # same for all of them, so it is stated once here and again in the summary.
  _elevated=0
  _is_windows_elevated || _elevated=$?
  if ((_elevated == 1)); then
    echo ">>> WARNING: this WSL session is NOT elevated — machine-scope packages may fail to install"
    echo "    Relaunch Windows Terminal as administrator, then re-run:"
    echo "      bash run.sh --refresh=_winget-install.sh"
  elif ((_elevated == 2)); then
    echo ">>> WARNING: could not determine Windows elevation (powershell.exe unavailable?)"
    echo "    Machine-scope packages may fail if this session is not elevated"
  fi

  # Install loop. See FORCE_INSTALL config above.
  #   - skip when:    not forcing AND package already in $_installed_packages
  #   - install when: forcing OR package missing
  # Every install uses --force --uninstall-previous so the install path is the
  # same in both modes — the only difference is whether we skip or not.
  #
  # $1 — "required" for an id from winget_required_packages (never skipped,
  #      always reinstalled) or "optional" for one from winget_packages
  #      (normal skip-if-installed behavior).
  #
  # Failures are collected instead of swallowed. The old `|| true` on every
  # install made a machine-scope miss look identical to a clean run, which is
  # how Zed and friends could go uninstalled with no trace in the log. A failed
  # install gets one exact source lookup: its exit status distinguishes a bad
  # or unavailable package id from an installer failure without guessing from
  # localized winget message text.
  _failed_packages=()
  _lookup_failed_packages=()

  # $1 — package id
  # $2 — "required" (never skip) or "optional" (skip when already installed)
  _winget_install_one() {
    local pkg="$1"
    local kind="$2"

    if [ "$kind" != "required" ] && ! ((FORCE_INSTALL)) && _winget_package_is_installed "$pkg"; then
      echo "  Skipped: $pkg (already installed)"
      return 0
    fi

    echo "  Installing: $pkg"
    # Output is captured rather than discarded so a failure can be explained;
    # success stays quiet because it is only the progress bar we already hid.
    # `< /dev/null` is mandatory for the same heredoc reason as the
    # `winget source update` call above.
    local _winget_output
    if _winget_output=$(winget.exe install --id "$pkg" -e --source winget --accept-source-agreements --accept-package-agreements --disable-interactivity --silent --force --uninstall-previous < /dev/null 2>&1); then
      return 0
    fi

    local _install_reason
    _install_reason=$(_winget_last_line "$_winget_output")
    _failed_packages+=("$pkg")
    if ! winget.exe search --id "$pkg" -e --source winget --accept-source-agreements --disable-interactivity < /dev/null > /dev/null 2>&1; then
      _lookup_failed_packages+=("$pkg")
      echo "  FAILED: $pkg — exact winget source lookup failed. ${_install_reason:-no install output from winget}"
    else
      echo "  FAILED: $pkg — ${_install_reason:-no output from winget}"
    fi
  }

  for pkg in "${winget_packages[@]}"; do
    _winget_install_one "$pkg" optional
  done

  # Required packages run last and are never skipped — a stale or half-broken
  # install must be replaced on every pass, not left standing because winget
  # still lists the id.
  for pkg in "${winget_required_packages[@]}"; do
    _winget_install_one "$pkg" required
  done

  if ((${#_failed_packages[@]} > 0)); then
    echo ""
    echo ">>> ${#_failed_packages[@]} package(s) failed to install:"
    for pkg in "${_failed_packages[@]}"; do
      echo "    - $pkg"
    done
    if ((${#_lookup_failed_packages[@]} > 0)); then
      echo "    ${#_lookup_failed_packages[@]} package id(s) were not found by an exact winget source lookup:"
      for pkg in "${_lookup_failed_packages[@]}"; do
        echo "      - $pkg"
      done
      echo "    Refresh the winget source or correct/remove these ids before retrying."
    fi
    if ((_elevated == 1)); then
      echo "    This WSL session is not elevated; machine-scope installers may require elevation."
      echo "    Relaunch Windows Terminal as administrator, then re-run:"
      echo "      bash run.sh --refresh=_winget-install.sh"
    fi
    exit 1
  fi

  # Refresh the stamp only after every package succeeds. Failed installs exit
  # above, run.sh propagates that exit through its logging pipeline, and no
  # stamp suppresses the next retry. safe_touch creates it with correct
  # ownership; the date write also advances an existing stamp.
  safe_touch "$WINGET_INSTALL_STAMP_PATH"
  date +%s > "$WINGET_INSTALL_STAMP_PATH"
else
  echo ">>> Listing available winget upgrades (winget install is recent; informational only)"
  echo "    To force a full install pass: bash run.sh --refresh=_winget-install.sh"
  winget.exe upgrade --include-unknown --source winget --accept-source-agreements --disable-interactivity < /dev/null || true
fi

echo ">>> winget-install complete"

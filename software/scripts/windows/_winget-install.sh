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
#   - Many packages need admin (machine-scope MSIs, services, drivers). UAC
#     prompts cannot be answered from a WSL TTY, so launch this from an
#     elevated WSL session (e.g. start Windows Terminal as administrator
#     before running) or expect silent failures on those packages.
#   - winget output is UTF-16 in some Windows locales — we normalize via
#     iconv so the substring match in bash works reliably.

# TODO: should address UAC privilege check — many winget targets are
# machine-scope MSIs / services / drivers and need the WSL session to be
# launched from an elevated Windows Terminal. For now we let those installs
# fail silently (`> /dev/null 2>&1 || true`) rather than gating the script.

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
# ---- Config ----
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
  "ZedIndustries.Zed"

  # ---- Git ----
  "Git.Git"
  "Git.LFS"
  "GitHub.cli"
  "NewRen.git-filter-repo"

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
  "Python.Python.3"
  "Rustlang.Rustup"
  "GoLang.Go"
  "DenoLand.Deno"
  "Oven-sh.Bun"
  "Gradle.Gradle"
  "EclipseAdoptium.Temurin.21.JDK"
  "Kitware.CMake"
  "Kubernetes.kubectl"
  "LLVM.LLVM"
  "Microsoft.VisualStudio.2022.BuildTools"
  "Hashicorp.Terraform"
  "Helm.Helm"
  "Derailed.k9s"
  "JesseDuffield.lazydocker"
  "Microsoft.DotNet.SDK.8"
  "Microsoft.DotNet.DesktopRuntime.6"
  "Microsoft.DotNet.DesktopRuntime.7"
  "Microsoft.DotNet.DesktopRuntime.8"
  "Microsoft.PowerShell"

  # ---- Local LLM ----
  "Ollama.Ollama"

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
  "ImageMagick.ImageMagick.Q16-HDRI"

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
  "OpenAL.OpenAL"
  "WinFSP.WinFSP"
  "WinFSP.SSHFS"
)

# Gate the install loop on bash_syle staleness:
#   - stale (first-time setup or 2+ weeks idle) -> run the full install loop.
#   - fresh (recent setup) -> skip the install loop and just LIST pending
#     upgrades via `winget upgrade` (no `--all` — bulk upgrade is too slow to
#     run on every iteration; the list is informational, the user can pick
#     and run `winget.exe upgrade --id <pkg>` manually).
if is_bash_syle_stale; then
  echo ">>> Installing winget packages (foreground, sequential)"

  # Refresh winget source index so installs resolve latest versions.
  # `< /dev/null` is mandatory: this script is bundled into a `bash <<'EOF'`
  # heredoc by _emitBundledShScripts, and winget.exe (via WSL interop) will
  # happily read from the heredoc's stdin, swallowing the rest of the script
  # and causing bash to exit silently after the first echo.
  winget.exe source update --disable-interactivity < /dev/null > /dev/null 2>&1 || true

  # Cache all installed packages once upfront — avoids spawning winget.exe list
  # per package (~1-2s each). winget output is UTF-16 in some locales; iconv
  # the bytes to UTF-8 so bash substring matching works. The `|| true` keeps
  # the script alive if iconv guesses the wrong source encoding.
  _installed_packages=$(winget.exe list < /dev/null 2> /dev/null | iconv -f UTF-16LE -t UTF-8 2> /dev/null || winget.exe list < /dev/null 2> /dev/null)

  # Install loop. See FORCE_INSTALL config above.
  #   - skip when:    not forcing AND package already in $_installed_packages
  #   - install when: forcing OR package missing
  # Every install uses --force --uninstall-previous so the install path is the
  # same in both modes — the only difference is whether we skip or not.
  for pkg in "${winget_packages[@]}"; do
    if ! ((FORCE_INSTALL)) && echo "$_installed_packages" | grep -qF "$pkg"; then
      echo "  Skipped: $pkg (already installed)"
    else
      echo "  Installing: $pkg"
      winget.exe install --id "$pkg" -e --source winget --accept-source-agreements --accept-package-agreements --disable-interactivity --silent --force --uninstall-previous < /dev/null > /dev/null 2>&1 || true
    fi
  done
else
  echo ">>> Listing available winget upgrades (bash_syle is fresh; informational only)"
  winget.exe upgrade --include-unknown --source winget --accept-source-agreements --disable-interactivity < /dev/null || true
fi

echo ">>> winget-install complete"

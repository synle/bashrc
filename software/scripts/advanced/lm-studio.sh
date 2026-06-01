#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install LM Studio (https://lmstudio.ai) — local LLM runner with a GUI.
#
# Mac:     handled by `installBrewPackageInBackground --cask lm-studio` in mac/_full-setup.sh.
# Windows: handled by `ElementLabs.LMStudio` in windows/_winget-install.sh.
# Linux:   AppImage drop-in below, backgrounded so the rest of the run isn't
#          blocked by the ~700 MB download. Writes a `.desktop` entry so the
#          app shows up in the launcher / app menu with an icon (the "layout"
#          mentioned in the original request).

# Bump when LM Studio cuts a new release. URL pattern observed on the
# installers CDN: installers.lmstudio.ai/linux/x64/<ver>/LM-Studio-<ver>-x64.AppImage
# Check https://lmstudio.ai/download for the current build.
LM_STUDIO_VERSION="0.3.5-2"

# Skip in CI — the AppImage is huge (~700 MB) and there's no display in the
# runner anyway; binary verification doesn't include lm-studio.
((IS_CI)) && {
  echo ">>> Skipped lm-studio: CI"
  exit 0
}

if ((is_os_mac)); then
  echo ">>> Skipped lm-studio: macOS uses Homebrew cask (mac/_full-setup.sh)"
  exit 0
fi

if ((is_os_windows)); then
  echo ">>> Skipped lm-studio: WSL/Windows uses winget (windows/_winget-install.sh)"
  exit 0
fi

if ((is_os_android_termux)); then
  echo ">>> Skipped lm-studio: not supported on Termux"
  exit 0
fi

LM_STUDIO_DIR="$HOME/_extra/lm-studio"
LM_STUDIO_BIN="$HOME/.local/bin/lm-studio"
LM_STUDIO_DESKTOP="$HOME/.local/share/applications/lm-studio.desktop"
LM_STUDIO_ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"
LM_STUDIO_ICON="$LM_STUDIO_ICON_DIR/lm-studio.png"
LM_STUDIO_APPIMAGE="$LM_STUDIO_DIR/LM-Studio-${LM_STUDIO_VERSION}-x64.AppImage"
LM_STUDIO_URL="https://installers.lmstudio.ai/linux/x64/${LM_STUDIO_VERSION}/LM-Studio-${LM_STUDIO_VERSION}-x64.AppImage"

# Force refresh: purge the cached AppImage so the bg downloader re-pulls.
if is_force_refresh_stale "$LM_STUDIO_APPIMAGE"; then
  echo ">> Force refresh: removing lm-studio AppImage"
  rm -f "$LM_STUDIO_APPIMAGE"
fi

if [ -x "$LM_STUDIO_APPIMAGE" ] && [ -f "$LM_STUDIO_DESKTOP" ]; then
  echo ">> Skipped lm-studio: already installed at $LM_STUDIO_APPIMAGE"
  exit 0
fi

safe_mkdir "$LM_STUDIO_DIR"
safe_mkdir "$(dirname "$LM_STUDIO_BIN")"
safe_mkdir "$(dirname "$LM_STUDIO_DESKTOP")"
safe_mkdir "$LM_STUDIO_ICON_DIR"

echo ">> Installing lm-studio in background (~700 MB download): $LM_STUDIO_URL"

# Backgrounded so the rest of the run keeps moving. `< /dev/null` detaches
# the subshell's stdin from the outer `bash <<'_BASHRC_INLINE_EOF_'` heredoc
# — without it the subshell would inherit the heredoc body and either hang
# or consume script lines meant for later commands.
(
  set +e

  # 1) Download the AppImage to a partial file, then atomically rename — so a
  #    half-finished download from a previous run can't masquerade as a valid
  #    install on the next iteration.
  if [ ! -s "$LM_STUDIO_APPIMAGE" ]; then
    if ! curl -fsSL "$LM_STUDIO_URL" -o "$LM_STUDIO_APPIMAGE.partial"; then
      echo ">> ERROR: lm-studio download failed — bump LM_STUDIO_VERSION in advanced/lm-studio.sh if the upstream URL has moved" >&2
      rm -f "$LM_STUDIO_APPIMAGE.partial"
      exit 1
    fi
    mv "$LM_STUDIO_APPIMAGE.partial" "$LM_STUDIO_APPIMAGE"
  fi
  chmod +x "$LM_STUDIO_APPIMAGE"

  # 2) PATH symlink so `lm-studio` works from a terminal too.
  ln -sf "$LM_STUDIO_APPIMAGE" "$LM_STUDIO_BIN"

  # 3) Extract the bundled icon for the .desktop entry. AppImages embed a
  #    top-level .DirIcon symlink (and usually a matching .png). We mktemp,
  #    cd in, run --appimage-extract on the icon names, copy whatever lands,
  #    and rm -rf the squashfs-root mess afterwards.
  _icon_tmp=$(mktemp -d -t lm-studio-icon-XXXXXX)
  (
    cd "$_icon_tmp" 2> /dev/null || exit 0
    "$LM_STUDIO_APPIMAGE" --appimage-extract '.DirIcon' &> /dev/null || true
    "$LM_STUDIO_APPIMAGE" --appimage-extract 'lm-studio.png' &> /dev/null || true
    "$LM_STUDIO_APPIMAGE" --appimage-extract 'lmstudio.png' &> /dev/null || true
  )
  for _cand in \
    "$_icon_tmp/squashfs-root/lm-studio.png" \
    "$_icon_tmp/squashfs-root/lmstudio.png" \
    "$_icon_tmp/squashfs-root/.DirIcon"; do
    if [ -s "$_cand" ]; then
      cp "$_cand" "$LM_STUDIO_ICON"
      break
    fi
  done
  rm -rf "$_icon_tmp"

  # 4) Desktop entry — this is the "layout" that puts LM Studio in the app
  #    launcher / menu. Unquoted heredoc so $LM_STUDIO_APPIMAGE / $LM_STUDIO_ICON
  #    expand at write time.
  command cat > "$LM_STUDIO_DESKTOP" << EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=LM Studio
GenericName=Local LLM Runner
Comment=Discover, download, and run local LLMs
Exec="$LM_STUDIO_APPIMAGE" %U
Icon=$LM_STUDIO_ICON
Terminal=false
Categories=Development;Utility;Network;Science;
StartupWMClass=LM Studio
Keywords=AI;LLM;GPT;ML;ChatGPT;Llama;
EOF
  chmod 644 "$LM_STUDIO_DESKTOP"

  # 5) Refresh the desktop database so the entry shows up in the app menu
  #    without a logout. Best-effort — not every distro ships it.
  if type -P update-desktop-database &> /dev/null; then
    update-desktop-database "$HOME/.local/share/applications" &> /dev/null || true
  fi

  echo ">> lm-studio install complete: $LM_STUDIO_APPIMAGE"
) < /dev/null &> "$BASHRC_TEMP_DIR/lm-studio-install.log" &

echo ">> lm-studio install dispatched (PID $!, log: $BASHRC_TEMP_DIR/lm-studio-install.log)"

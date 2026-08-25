#!/usr/bin/env bash
#
# Backs up the XFCE desktop configuration (keyboard shortcuts, theming, panel,
# window manager settings) into docs/linux/xfce-config.tar.gz.
#
# Layout inside the tarball:
#   xfce4/                        - copy of ~/.config/xfce4 (xfconf XML, panel, wm)
#   xfce4/xfconf-<channel>.txt    - flat xfconf-query dumps for easy diffing
#
# Restore: tar xzf docs/linux/xfce-config.tar.gz -C "$HOME/.config"
# then reload the panel: xfce4-panel -r

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_FILE="$REPO_ROOT/docs/linux/xfce-config.tar.gz"
XFCE_CONFIG_DIR="$HOME/.config/xfce4"

if [ ! -d "$XFCE_CONFIG_DIR" ]; then
	echo "backup-xfce: no XFCE config at $XFCE_CONFIG_DIR - skipping" >&2
	exit 1
fi

STAGING="$(mktemp -d /tmp/xfce-backup-XXXXXX)"
trap 'rm -rf "$STAGING"' EXIT

mkdir -p "$STAGING/xfce4"
cp -r "$XFCE_CONFIG_DIR/." "$STAGING/xfce4/"

for channel in xfce4-keyboard-shortcuts xfwm4 xsettings xfce4-panel xfce4-desktop; do
	# Flat key/value dump per channel; channel may be missing on some setups.
	xfconf-query -c "$channel" -lv >"$STAGING/xfce4/xfconf-$channel.txt" 2>/dev/null || rm -f "$STAGING/xfce4/xfconf-$channel.txt"
done

mkdir -p "$(dirname "$OUT_FILE")"
tar -czf "$OUT_FILE" -C "$STAGING" xfce4
echo "backup-xfce: wrote $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"

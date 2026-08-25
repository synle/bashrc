#!/usr/bin/env bash
#
# Backs up the XFCE desktop configuration (keyboard shortcuts, theming, panel,
# window manager settings) into .build/tar-xcfe-config.tar.gz.
# Safe to call anywhere: every guard below exits 0 with a skip message when
# this machine is not an Ubuntu-family box running an XFCE session.
#
# Layout inside the tarball:
#   xfce4/                        - copy of ~/.config/xfce4 (xfconf XML, panel, wm)
#   xfce4/xfconf-<channel>.txt    - flat xfconf-query dumps for easy diffing
#
# Restore: tar xzf .build/tar-xcfe-config.tar.gz -C "$HOME/.config"
# then reload the panel: xfce4-panel -r

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_FILE="$REPO_ROOT/.build/tar-xcfe-config.tar.gz"
XFCE_CONFIG_DIR="$HOME/.config/xfce4"

function skip() {
	echo "backup-xfce: $1 - skipping" >&2
	exit 0
}

# Guard: Ubuntu-family OS only (Ubuntu, Linux Mint, and other debian/ubuntu
# derivatives), mirroring the repo's is_os_ubuntu catch-all.
_os_id=""
_os_id_like=""
if [ -r /etc/os-release ]; then
	# shellcheck disable=SC1091
	. /etc/os-release
	_os_id="${ID:-}"
	_os_id_like="${ID_LIKE:-}"
fi
case "$_os_id $_os_id_like" in
*ubuntu* | *debian*) ;;
*) skip "not an Ubuntu-family OS ($_os_id)" ;;
esac

# Guard: an actual XFCE session is the current display. XDG_CURRENT_DESKTOP is
# authoritative when set; fall back to a live xfce4-session process (covers
# shells that don't inherit the desktop env var).
if [ "${XDG_CURRENT_DESKTOP:-}" != "XFCE" ] && ! pgrep -x xfce4-session >/dev/null 2>&1; then
	skip "no running XFCE session detected"
fi

# Guard: config dir and xfconf tooling must exist.
[ -d "$XFCE_CONFIG_DIR" ] || skip "no XFCE config at $XFCE_CONFIG_DIR"
command -v xfconf-query >/dev/null 2>&1 || skip "xfconf-query not installed"

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

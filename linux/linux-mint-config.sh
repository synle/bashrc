# === Variables ===
TIMESTAMP=$(date +"%Y-%m-%d-%H-%M-%S")
BACKUP_DIR="$HOME/xfce-backup-$TIMESTAMP"
CONFIG_DIR="$HOME/.config/xfce4"
TEMP_DIR=$(mktemp -d /tmp/xfce-restore-XXXXXX)

# === Step 1: Backup existing configuration ===
echo "Backing up current XFCE configuration..."
if [ -d "$CONFIG_DIR" ]; then
  mkdir -p "$BACKUP_DIR"
  cp -r "$CONFIG_DIR" "$BACKUP_DIR/"
  echo "Full XFCE config backed up to $BACKUP_DIR/xfce4"
else
  echo "No ~/.config/xfce4 directory found. Skipping backup."
fi

# === Step 2: Download new config files to temp dir ===
echo "Downloading new configuration files..."
pushd "$TEMP_DIR" >/dev/null
curl -fsSLO https://raw.githubusercontent.com/synle/bashrc/master/linux/xfce-config.tar.gz
echo "Downloads complete."

# === Step 3: Restore new settings ===
echo "Restoring new XFCE configuration..."
mkdir -p "$CONFIG_DIR"
tar -xzf xfce-config.tar.gz -C ~/.config

# === Step 4: Restart XFCE components ===
echo "Restarting XFCE components..."
xfce4-panel -r
xfwm4 --replace &
xfconf-query -c xfce4-keyboard-shortcuts -rR || true

# === Step 5: Cleanup ===
popd >/dev/null
rm -rf "$TEMP_DIR"
echo "Temporary files cleaned up."

echo "Restore complete."
echo "Backup stored in: $BACKUP_DIR"

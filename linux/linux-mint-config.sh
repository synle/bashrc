# === Variables ===
TIMESTAMP=$(date +"%Y-%m-%d-%H-%M-%S")
BACKUP_DIR="$HOME/xfce-backup-$TIMESTAMP"
CONFIG_DIR="$HOME/.config/xfce4"
KEYBOARD_FILE="$CONFIG_DIR/xfconf/xfce-perchannel-xml/xfce4-keyboard-shortcuts.xml"

# === Step 1: Backup existing configuration ===
echo "🧠 Backing up current XFCE configuration..."
mkdir -p "$BACKUP_DIR"

if [ -d "$CONFIG_DIR" ]; then
  cp -r "$CONFIG_DIR" "$BACKUP_DIR/"
  echo "✅ Full config backed up to $BACKUP_DIR/"
else
  echo "⚠️ No existing ~/.config/xfce4 directory found — skipping config backup."
fi

if [ -f "$KEYBOARD_FILE" ]; then
  cp -v "$KEYBOARD_FILE" "$BACKUP_DIR/"
  echo "✅ Keyboard shortcuts file backed up."
else
  echo "⚠️ No keyboard shortcut file found — skipping keyboard backup."
fi

# === Step 2: Download new config files ===
echo "🌐 Downloading new configuration files..."
cd ~
curl -fsSLO https://raw.githubusercontent.com/synle/bashrc/master/linux/linux-mint-xfce-keyboard.xml
curl -fsSLO https://raw.githubusercontent.com/synle/bashrc/master/linux/xfce-config.tar.gz
echo "✅ Downloads complete."

# === Step 3: Restore new settings ===
echo "📦 Restoring new XFCE configuration..."
mkdir -p "$CONFIG_DIR/xfconf/xfce-perchannel-xml"
cp -v linux-mint-xfce-keyboard.xml "$KEYBOARD_FILE"
tar -xzf xfce-config.tar.gz -C ~/.config

# === Step 4: Restart XFCE components ===
echo "🔁 Restarting XFCE components..."
xfce4-panel -r && xfwm4 --replace &
xfce4-panel -r
xfwm4 --replace &
xfconf-query -c xfce4-keyboard-shortcuts -rR
xfconf-query -c xfce4-keyboard-shortcuts -lv

echo "🎉 Restore complete!"
echo "🗂️ A backup of your old settings is stored in: $BACKUP_DIR"

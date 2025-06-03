### this is the folder where we should store xfce icons

```bash
~/.local/share/applications
```

### to revert xcfe, rename this file

~/.config/menus/xfce-applications.menu

```bash
mv ~/.config/menus/xfce-applications.menu ~/.config/menus/xfce-applications.menu.backup
```

### sample file for xcfe Desktop

```
[Desktop Entry]
Name=Arduino IDE
Comment=Arduino IDE
Exec=/home/syle/Apps/Arduino IDE/arduino-ide_2.3.2_Linux_64bit.AppImage
Icon=/home/syle/Apps/Arduino IDE/icon.png
Terminal=false
Type=Application
Categories=Development;
```

```bash
# Get current working directory
function setup_shortcut() {
  # Check if the file exists
  if [[ ! -f "_desktop.txt" ]]; then
    # Create the file with default content
    cat <<EOF > _desktop.txt
Type=Application
Categories=Development
EOF
  fi

  # Read the file content into the variable
  DESKTOP_SHORTCUT_EXTRA="$(< _desktop.txt)"

  # Get current working directory and folder name
  CURRENT_PWD="$(pwd)"
  CURRENT_FOLDER_NAME="$(basename "$CURRENT_PWD")"

  # Create .desktop file
  cat <<EOF > "${CURRENT_FOLDER_NAME}.desktop"
[Desktop Entry]
Name=${CURRENT_FOLDER_NAME}
Comment=${CURRENT_FOLDER_NAME}
Exec=${CURRENT_PWD}/app.AppImage
Icon=${CURRENT_PWD}/app.jpg
Terminal=false
${DESKTOP_SHORTCUT_EXTRA}
EOF
}

chmod +x */app.AppImage
cp */*.desktop ~/.local/share/applications/
```

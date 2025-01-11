### this is the folder where we should store xfce icons
```
~/.local/share/applications
```

### to revert xcfe, rename this file
~/.config/menus/xfce-applications.menu

```
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

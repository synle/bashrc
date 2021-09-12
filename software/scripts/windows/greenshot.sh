echo '>> Greenshot (disable auto-update, added hotkeys)'

sed -i -E '
s/^[[:space:]]*RegionHotkey=.*/RegionHotkey=Alt + Shift + D4/;
s/^[[:space:]]*WindowHotkey=.*/WindowHotkey=None/;
s/^[[:space:]]*FullscreenHotkey=.*/FullscreenHotkey=None/;
s/^[[:space:]]*LastregionHotkey=.*/LastregionHotkey=None/;
s/^[[:space:]]*IEHotkey=.*/IEHotkey=None/;
s/^[[:space:]]*Destinations=.*/Destinations=FileNoDialog,Clipboard/
s/^[[:space:]]*UpdateCheckInterval=.*/UpdateCheckInterval=0/
' /mnt/c/Users/*/AppData/Roaming/Greenshot/Greenshot.ini

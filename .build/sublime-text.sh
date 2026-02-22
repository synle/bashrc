export BASH_PROFILE_CODE_REPO_RAW_URL="https://raw.githubusercontent.com/synle/bashrc/master"
REPO_BUILD="$BASH_PROFILE_CODE_REPO_RAW_URL/.build"

# Resolve potential paths with wildcards
W_PATH=$(ls -d {/mnt/c,/c}/Users/*/AppData/Roaming/Sublime*Text*/Packages/User 2>/dev/null | head -n 1)
L_PATH=$(ls -d $HOME/.config/sublime-text*/Packages/User 2>/dev/null | head -n 1)
M_PATH=$(ls -d "$HOME/Library/Application Support/Sublime Text"*/Packages/User 2>/dev/null | head -n 1)

if [ -n "$W_PATH" ] && [ -d "$W_PATH" ]; then
    echo "Installing for Windows/WSL ($W_PATH)..."
    curl -fsSL "$REPO_BUILD/sublime-text-configurations" -o "$W_PATH/Preferences.sublime-settings"
    curl -fsSL "$REPO_BUILD/sublime-text-keybindings-windows" -o "$W_PATH/Default.sublime-keymap"
    curl -fsSL "$REPO_BUILD/sublime-text-plugins.refresh-on-focus.py" -o "$W_PATH/sublime-text-plugins.refresh-on-focus.py"
elif [ -n "$L_PATH" ] && [ -d "$L_PATH" ]; then
    echo "Installing for Linux ($L_PATH)..."
    curl -fsSL "$REPO_BUILD/sublime-text-configurations" -o "$L_PATH/Preferences.sublime-settings"
    curl -fsSL "$REPO_BUILD/sublime-text-keybindings-linux" -o "$L_PATH/Default.sublime-keymap"
    curl -fsSL "$REPO_BUILD/sublime-text-plugins.refresh-on-focus.py" -o "$L_PATH/sublime-text-plugins.refresh-on-focus.py"
elif [ -n "$M_PATH" ] && [ -d "$M_PATH" ]; then
    echo "Installing for Mac ($M_PATH)..."
    curl -fsSL "$REPO_BUILD/sublime-text-configurations-macosx" -o "$M_PATH/Preferences.sublime-settings"
    curl -fsSL "$REPO_BUILD/sublime-text-keybindings-macosx" -o "$M_PATH/Default.sublime-keymap"
    curl -fsSL "$REPO_BUILD/sublime-text-plugins.refresh-on-focus.py" -o "$M_PATH/sublime-text-plugins.refresh-on-focus.py"
else
    echo "Sublime Text User directory not found. Skipping installation."
fi

# for windows with powershell, last effort (final fallback)
$RepoBuild = "https://raw.githubusercontent.com/synle/bashrc/master/.build"
$W_Path = "$env:AppData/Sublime Text/Packages/User"
if (Test-Path $W_Path) {
    Write-Host "Installing for Windows with PowerShell..."
    Invoke-WebRequest -Uri "$RepoBuild/sublime-text-configurations" -OutFile "$W_Path/Preferences.sublime-settings"
    Invoke-WebRequest -Uri "$RepoBuild/sublime-text-keybindings-windows" -OutFile "$W_Path/Default.sublime-keymap"
    Invoke-WebRequest -Uri "$RepoBuild/sublime-text-plugins.refresh-on-focus.py" -OutFile "$W_Path/sublime-text-plugins.refresh-on-focus.py"
}

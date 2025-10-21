##################################################
# for Linux using bash
##################################################
REMOTE_BASE="https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build"
CONFIG_FILE="vs-code-configurations"
KEYBIND_LINUX="vs-code-keybindings-linux"
KEYBIND_MAC="vs-code-keybindings-macosx"

# Define all targets: path + keybinding file
targets=(
  "$HOME/.var/app/com.vscodium.codium/config/VSCodium/User|$KEYBIND_LINUX"
  "$HOME/.config/VSCodium/User|$KEYBIND_LINUX"
  "$HOME/.config/Code/User|$KEYBIND_LINUX"
  "$HOME/Library/Application Support/Code/User|$KEYBIND_MAC"
  "$HOME/Library/Application Support/VSCodium/User|$KEYBIND_MAC"
)

download_if_exists() {
  local dest_dir="$1"
  local key_file="$2"

  if [ -d "$dest_dir" ]; then
    echo "📦 Updating config in: $dest_dir"
    curl -fsSL "$REMOTE_BASE/$CONFIG_FILE" -o "$dest_dir/settings.json"
    curl -fsSL "$REMOTE_BASE/$key_file" -o "$dest_dir/keybindings.json"
  else
    echo "⚠️ Skipped: $dest_dir does not exist."
  fi
}

echo "🚀 Starting VSCode/VSCodium config sync..."

for target in "${targets[@]}"; do
  IFS="|" read -r dir key <<< "$target"
  download_if_exists "$dir" "$key"
done


##################################################
# for Windows using powershell
##################################################
$baseUrl     = "https://raw.githubusercontent.com/synle/bashrc/refs/heads/master/.build"
$configFile  = "vs-code-configurations"
$keybindings = "vs-code-keybindings-windows"

# Target directories
$targets = @(
    "$HOME\AppData\Roaming\VSCodium\User",
    "$HOME\AppData\Roaming\Code\User"
)

Write-Host "🚀 Starting VSCode/VSCodium config sync..." -ForegroundColor Cyan

foreach ($target in $targets) {
    if (Test-Path $target) {
        Write-Host "📦 Updating config in: $target" -ForegroundColor Green

        Invoke-WebRequest -Uri "$baseUrl/$configFile" -OutFile "$target\settings.json" -UseBasicParsing
        Invoke-WebRequest -Uri "$baseUrl/$keybindings" -OutFile "$target\keybindings.json" -UseBasicParsing
    } else {
        Write-Host "⚠️ Skipped: $target does not exist." -ForegroundColor Yellow
    }
}

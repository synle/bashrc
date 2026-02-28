const bashTargets = [
  { path: "$HOME/.var/app/com.vscodium.codium/config/VSCodium/User", keys: "vs-code-keys-windows" },
  { path: "$HOME/.config/VSCodium/User", keys: "vs-code-keys-windows" },
  { path: "$HOME/.config/Code/User", keys: "vs-code-keys-windows" },
  { path: "$HOME/Library/Application Support/Code/User", keys: "vs-code-keys-macosx" },
  { path: "$HOME/Library/Application Support/VSCodium/User", keys: "vs-code-keys-macosx" },
];

const powershellTargets = [
  { path: "$HOME\\AppData\\Roaming\\VSCodium\\User", keys: "vs-code-keys-windows" },
  { path: "$HOME\\AppData\\Roaming\\Code\\User", keys: "vs-code-keys-windows" },
];

const configFile = "vs-code-config";

/**
 * Formats bash target entries as pipe-delimited strings for the setup script.
 * @returns {string} Formatted bash target entries.
 */
function getBashTargetEntries() {
  return bashTargets.map((t) => `  "${t.path}|${t.keys}"`).join("\n");
}

/**
 * Formats PowerShell target entries as hashtable objects for the setup script.
 * @returns {string} Formatted PowerShell target block.
 */
function getPowershellTargetBlock() {
  return powershellTargets.map((t) => `    @{ Path = "${t.path}"; Keys = "${t.keys}" }`).join("\n");
}

/**
 * Generates the VS Code / VSCodium setup script for both bash and PowerShell environments.
 */
async function doWork() {
  exitIfUnsupportedOs("is_os_android_termux", "is_os_arch_linux", "is_os_chromeos");
  console.log(`  >> VS Code Setup Script:`);

  const script = `
${LINE_BREAK_HASH}
# for Linux using bash
${LINE_BREAK_HASH}
REMOTE_BASE="${BASH_PROFILE_CODE_REPO_RAW_URL}/.build"
CONFIG_FILE="${configFile}"

targets=(
${getBashTargetEntries()}
)

download_if_exists() {
  local dest_dir="$1"
  local key_file="$2"

  if [ -d "$dest_dir" ]; then
    echo "Updating config in: $dest_dir"
    curl -fsSL "$REMOTE_BASE/$CONFIG_FILE" -o "$dest_dir/settings.json"
    curl -fsSL "$REMOTE_BASE/$key_file" -o "$dest_dir/keybindings.json"
  else
    echo "Skipped: $dest_dir does not exist."
  fi
}

echo "Starting VSCode/VSCodium config sync..."

for target in "\${targets[@]}"; do
  IFS="|" read -r dir key <<< "$target"
  download_if_exists "$dir" "$key"
done


${LINE_BREAK_HASH}
# for Windows using powershell
${LINE_BREAK_HASH}
$baseUrl     = "${BASH_PROFILE_CODE_REPO_RAW_URL}/.build"
$configFile  = "${configFile}"
$keybindings = "vs-code-keys-windows"

$targets = @(
${getPowershellTargetBlock()}
)

Write-Host "Starting VSCode/VSCodium config sync..."

foreach ($target in $targets) {
    if (Test-Path $target.Path) {
        Write-Host "Updating config in: $($target.Path)"

        Invoke-WebRequest -Uri "$baseUrl/$configFile" -OutFile "$($target.Path)\\settings.json" -UseBasicParsing
        Invoke-WebRequest -Uri "$baseUrl/$($target.Keys)" -OutFile "$($target.Path)\\keybindings.json" -UseBasicParsing
    } else {
        Write-Host "Skipped: $($target.Path) does not exist."
    }
}
`;

  writeText("software/scripts/vs-code-setup", script, true, true);
}

/// <reference path="../base-node-script.js" />
const onlyVsCodeExtensions = trimLeftSpaces(`
  ms-vscode-remote.vscode-remote-extensionpack
  ms-dotnettools.csharp
  ms-vscode.cpptools
  visualstudioexptteam.vscodeintellicode
  andrejunges.handlebars
  dakara.transformer
`);

const onlyCodiumExtensions = trimLeftSpaces(`
  jeanp413.open-remote-ssh
  devcontainers.vscode-dev-containers
`);

const baseVsExtensions = trimLeftSpaces(`
  # --- UI & Theming ---
  dracula-theme.theme-dracula
  PKief.material-icon-theme
  oderwat.indent-rainbow
  aaron-bond.better-comments

  # --- Languages & Intelligence ---
  ms-python.python
  ms-python.isort
  golang.go
  redhat.java
  redhat.vscode-yaml
  wholroyd.jinja
  clinyong.vscode-css-modules

  # --- Productivity & Formatting ---
  esbenp.prettier-vscode
  dbaeumer.vscode-eslint
  streetsidesoftware.code-spell-checker
  wmaurer.change-case
  nicoespeon.abracadabra
  formulahendry.code-runner
  ms-azuretools.vscode-docker
  ms-toolsai.jupyter
`).trim();

const VS_CODE_EXTENSIONS_TO_INSTALL = convertTextToList(onlyVsCodeExtensions, baseVsExtensions);
const VS_CODIUM_EXTENSIONS_TO_INSTALL = convertTextToList(onlyCodiumExtensions, baseVsExtensions);

function generateInstallCommands(extensions) {
  return extensions.map((ext) => `  install_extension ${ext}`).join('\n');
}

async function doWork() {
  console.log(`  >> VS Code Extensions:`);

  const script = `#!/bin/bash
# Unified VS Code / VSCodium extension installer
# Uses runtime binary resolution (works on Windows/WSL, macOS, Linux)

_CODE_PATHS=(
  /mnt/c/Users/Sy*/AppData/Local/Programs/Microsoft*Code/Code.exe
  /mnt/c/Users/Le*/AppData/Local/Programs/Microsoft*Code/Code.exe
  /mnt/c/Program*Files/Microsoft*VS*Code/Code.exe
  "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
  /usr/local/bin/code
  /usr/bin/code
)

_CODIUM_PATHS=(
  /mnt/c/Program*Files/VSCodium/VSCodium.exe
  "/Applications/VSCodium.app/Contents/Resources/app/bin/codium"
  /usr/local/bin/codium
  /usr/bin/codium
)

find_editor() {
  local paths_ref="$1[@]"
  local paths=("\${!paths_ref}")

  shopt -s nullglob nocaseglob
  for binary in "\${paths[@]}"; do
    if [[ -x "$binary" ]]; then
      echo "$binary"
      shopt -u nullglob nocaseglob
      return 0
    fi
  done
  shopt -u nullglob nocaseglob

  # flatpak fallback for codium
  if [[ "$1" == "_CODIUM_PATHS" ]] && command -v flatpak &> /dev/null; then
    echo "flatpak run com.vscodium.codium"
    return 0
  fi

  return 1
}

install_extension() {
  echo "  $_CURRENT_BIN --install-extension $1 --force"
  eval "$_CURRENT_BIN" --install-extension "$1" --force
}

# --- VS Code ---
echo ">> Installing VS Code extensions..."
_CURRENT_BIN=$(find_editor _CODE_PATHS)
if [ -n "$_CURRENT_BIN" ]; then
  echo "  Using: $_CURRENT_BIN"
${generateInstallCommands(VS_CODE_EXTENSIONS_TO_INSTALL)}
  echo "Done installing VS Code extensions"
else
  echo "Skipping VS Code: no binary found"
fi

# --- VSCodium ---
echo ">> Installing VSCodium extensions..."
_CURRENT_BIN=$(find_editor _CODIUM_PATHS)
if [ -n "$_CURRENT_BIN" ]; then
  echo "  Using: $_CURRENT_BIN"
${generateInstallCommands(VS_CODIUM_EXTENSIONS_TO_INSTALL)}
  echo "Done installing VSCodium extensions"
else
  echo "Skipping VSCodium: no binary found"
fi
`;

  // write to build file
  writeToBuildFile([
    { file: 'vs-code-extensions', data: script },
  ]);
}

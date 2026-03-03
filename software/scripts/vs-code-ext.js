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

/**
 * Generates a bash snippet that uninstalls managed extensions when force refresh is enabled.
 * @param {string} codeBin - The editor binary path/command (e.g., "code", "./code", "/usr/bin/code").
 * @param {string[]} extensions - List of extension IDs to uninstall.
 * @returns {string} Bash script block.
 */
function _getExtUninstallScript(codeBin, extensions) {
  return extensions.map((ext) => `${codeBin} --uninstall-extension ${ext} &>/dev/null &`).join("\n");
}

/**
 * Generates a bash snippet that lists installed extensions once, then installs only missing ones.
 * @param {string} codeBin - The editor binary path/command (e.g., "code", "./code", "/usr/bin/code").
 * @param {string[]} extensions - List of extension IDs to install.
 * @returns {string} Bash script block.
 */
function _getExtInstallScript(codeBin, extensions) {
  const installedVar = `_installed_${codeBin.replace(/[^a-zA-Z0-9]/g, "_")}`;
  return [
    `${installedVar}=$(${codeBin} --list-extensions 2>/dev/null)`,
    ...extensions.map((ext) => `echo "$${installedVar}" | grep -qi "^${ext}$" || ${codeBin} --install-extension ${ext} &>/dev/null &`),
  ].join("\n");
}

/**
 * Generates platform-specific extension installation scripts for VS Code and VSCodium.
 */
async function doWork() {
  exitIfLimitedSupportOs();
  log(`>> VS Code Extensions:`);

  // force refresh: uninstall all managed extensions first, then reinstall
  const forceRefreshWindowsSnippet = !IS_FORCE_REFRESH
    ? ""
    : `
c:;  cd "C:/Program Files/Microsoft VS Code/bin"
${_getExtUninstallScript("code", VS_CODE_EXTENSIONS_TO_INSTALL)}
c:; cd "C:/Program Files/VSCodium/bin"
${_getExtUninstallScript("codium", VS_CODIUM_EXTENSIONS_TO_INSTALL)}
wait
`;

  const forceRefreshMacSnippet = !IS_FORCE_REFRESH
    ? ""
    : `
cd "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/"
${_getExtUninstallScript("./code", VS_CODE_EXTENSIONS_TO_INSTALL)}
cd "/Applications/VSCodium.app/Contents/Resources/app/bin/"
${_getExtUninstallScript("./codium", VS_CODIUM_EXTENSIONS_TO_INSTALL)}
wait
`;

  const forceRefreshLinuxSnippet = !IS_FORCE_REFRESH
    ? ""
    : `
${_getExtUninstallScript("/usr/bin/code", VS_CODE_EXTENSIONS_TO_INSTALL)}
${_getExtUninstallScript("/usr/bin/codium", VS_CODIUM_EXTENSIONS_TO_INSTALL)}
${_getExtUninstallScript("flatpak run com.vscodium.codium", VS_CODIUM_EXTENSIONS_TO_INSTALL)}
wait
`;

  // write to build file
  writeToBuildFile([
    // for vscode
    {
      file: "vs-code-ext-windows",
      data: `
${forceRefreshWindowsSnippet}
c:;  cd "C:/Program Files/Microsoft VS Code/bin"
${_getExtInstallScript("code", VS_CODE_EXTENSIONS_TO_INSTALL)}
echo 'Done installing VSCode Extensions'

c:; cd "C:/Program Files/VSCodium/bin"
${_getExtInstallScript("codium", VS_CODIUM_EXTENSIONS_TO_INSTALL)}
echo 'Done installing VSCodium Extensions'
    `,
    },
    {
      file: "vs-code-ext-macosx",
      data: `
${forceRefreshMacSnippet}
cd "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/"
${_getExtInstallScript("./code", VS_CODE_EXTENSIONS_TO_INSTALL)}
echo 'Done installing VSCode Extensions'

cd "/Applications/VSCodium.app/Contents/Resources/app/bin/"
${_getExtInstallScript("./codium", VS_CODIUM_EXTENSIONS_TO_INSTALL)}
echo 'Done installing VSCodium Extensions'
    `,
    },
    {
      file: "vs-code-ext-linux",
      data: `
${forceRefreshLinuxSnippet}
${_getExtInstallScript("/usr/bin/code", VS_CODE_EXTENSIONS_TO_INSTALL)}
echo 'Done installing VSCode Extensions'

${_getExtInstallScript("/usr/bin/codium", VS_CODIUM_EXTENSIONS_TO_INSTALL)}
echo 'Done installing VSCodium Extensions'

${_getExtInstallScript("flatpak run com.vscodium.codium", VS_CODIUM_EXTENSIONS_TO_INSTALL)}
echo 'Done installing VSCodium Extensions'
    `,
    },
  ]);
}

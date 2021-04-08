async function doWork() {
  const targetPath = _getPath();
  if (!fs.existsSync(targetPath)) {
    console.log("Not supported - Exit - targetPath not found: ", targetPath);
    process.exit();
  }

  const TO_PLUGINS = convertTextToList(`
    2gua.rainbow-brackets
    aaron-bond.better-comments
    abusaidm.html-snippets
    alefragnani.project-manager
    bibhasdn.unique-lines
    bierner.folder-source-actions
    christian-kohler.npm-intellisense
    christian-kohler.path-intellisense
    clinyong.vscode-css-modules
    dakara.transformer
    dbaeumer.vscode-eslint
    dracula-theme.theme-dracula
    eamodio.gitlens
    emmanuelbeziat.vscode-great-icons
    esbenp.prettier-vscode
    GitHub.codespaces
    Gruntfuggly.bettercomment
    ms-azuretools.vscode-docker
    ms-dotnettools.csharp
    ms-python.python
    ms-toolsai.jupyter
    ms-vscode-remote.remote-containers
    ms-vscode-remote.remote-ssh
    ms-vscode-remote.remote-ssh-edit
    ms-vscode-remote.remote-wsl
    ms-vscode-remote.vscode-remote-extensionpack
    ms-vscode.cpptools
    ms-vscode.sublime-keybindings
    msjsdiag.debugger-for-chrome
    nicoespeon.abracadabra
    NuclleaR.vscode-extension-auto-import
    oderwat.indent-rainbow
    Orta.vscode-jest
    PKief.material-icon-theme
    redhat.java
    redhat.vscode-yaml
    streetsidesoftware.code-spell-checker
    TabNine.tabnine-vscode
    VisualStudioExptTeam.vscodeintellicode
    wmaurer.change-case
  `);

  const vsCodeBinary = is_os_window
    ? `"c:\\Program Files\\Microsoft VS Code\\bin\\code"`
    : "code";

  const extensionInstallShell = TO_PLUGINS.map(
    (plugin) => `${vsCodeBinary} --install-extension ${plugin} --force`
  ).join("\n");

  const extensionInstallPath = path.join(
    BASE_SY_CUSTOM_TWEAKS_DIR,
    "install-vs-code.extensions.txt"
  );

  console.log(
    `  >> Installing VS Code extensions script: ${TO_PLUGINS.length.toLocaleString()}`
  );
  console.log(
    `    >> Need to manually install the plugins, the content is here`
  );
  console.log(`      cat ${extensionInstallPath}`);

  fs.writeFileSync(extensionInstallPath, extensionInstallShell);
}

function _getPath() {
  if (is_os_window) {
    return path.join(getWindowAppDataRoamingUserPath(), "Code/User");
  }
  if (is_os_darwin_mac) {
    return path.join(getOsxApplicationSupportCodeUserPath(), "Code/User");
  }
  return null;
}

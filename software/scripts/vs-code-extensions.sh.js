async function doWork() {
  const VS_CODE_EXTENSIONS_TO_INSTALL = convertTextToList(`
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

  console.log(
    echo(
      `  >> Setting up VS Code Extensions: ${VS_CODE_EXTENSIONS_TO_INSTALL.length}`
    )
  );

  for (const plugin of VS_CODE_EXTENSIONS_TO_INSTALL) {
    console.log(
      `echo  "    >> code --install-extension ${plugin} --force" && \\`
    );

    if (is_os_window) {
      // mac
      console.log(
        `cmd.exe /c "code --install-extension ${plugin} --force" &> /dev/null && \\`
      );
    } else {
      // mac
      console.log(
        `code --install-extension ${plugin} --force &> /dev/null && \\`
      );
    }
  }

  console.log(
    echo(
      `  >> Installed VS Code Extensions: ${VS_CODE_EXTENSIONS_TO_INSTALL.length}`
    )
  );
}

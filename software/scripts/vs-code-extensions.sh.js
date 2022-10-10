const toInstallExtensions = trimLeftSpaces(`
  aaron-bond.better-comments
  andrejunges.Handlebars
  bierner.folder-source-actions
  christian-kohler.npm-intellisense
  christian-kohler.path-intellisense
  clinyong.vscode-css-modules
  dakara.transformer
  dbaeumer.vscode-eslint
  dracula-theme.theme-dracula
  dsznajder.es7-react-js-snippets
  emmanuelbeziat.vscode-great-icons
  esbenp.prettier-vscode
  Hridoy.ember-snippets
  ms-azuretools.vscode-docker
  ms-dotnettools.csharp
  ms-python.python
  ms-python.vscode-pylance
  ms-vscode-remote.remote-containers
  ms-vscode-remote.remote-ssh
  ms-vscode-remote.remote-ssh-edit
  ms-vscode-remote.remote-wsl
  ms-vscode-remote.vscode-remote-extensionpack
  ms-vscode.cpptools
  nicoespeon.abracadabra
  NuclleaR.vscode-extension-auto-import
  oderwat.indent-rainbow
  scala-lang.scala
  streetsidesoftware.code-spell-checker
  vscjava.vscode-maven
  wmaurer.change-case
  formulahendry.auto-rename-tag
`).trim();

async function doWork() {
  // write to build file
  writeToBuildFile([['vs-code-extensions', toInstallExtensions, false]]);

  if (is_os_window) {
    const VS_CODE_EXTENSIONS_TO_INSTALL = convertTextToList(toInstallExtensions);

    console.log(echo(`  >> Setting up VS Code Extensions (code --install-extension --force): ${VS_CODE_EXTENSIONS_TO_INSTALL.length}`));

    for (const plugin of VS_CODE_EXTENSIONS_TO_INSTALL) {
      console.log(`echo  "    >> ${plugin} " && \\`);

      if (is_os_window) {
        // windows
        console.log(`cmd.exe /c "code.cmd --install-extension ${plugin} --force" &> /dev/null && \\`);
      } else {
        // mac
        console.log(`code --install-extension ${plugin} --force &> /dev/null && \\`);
      }
    }

    console.log(echo(`  >> Done Installed VS Code Extensions: ${VS_CODE_EXTENSIONS_TO_INSTALL.length}`));
  } else {
    console.log(consoleLogColor1('      >> Skipped : not supported'));
  }
}

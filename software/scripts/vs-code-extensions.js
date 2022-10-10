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

const VS_CODE_EXTENSIONS_TO_INSTALL = convertTextToList(toInstallExtensions);

async function doWork() {
  console.log(`  >> Setting up VS Code Extensions:`);

  if (DEBUG_WRITE_TO_DIR) {
    console.log('    >> Skipped - this is only used to build the main scripts');
  }

  // write to build file
  writeToBuildFile([
    [
      'vs-code-extensions-windows',
      `
c:; cd "C:/Program Files/Microsoft VS Code/bin"
${VS_CODE_EXTENSIONS_TO_INSTALL.map((ext) => `./code --install-extension ${ext} --force`).join('\n')}
    `,
      false,
    ],
    [
      'vs-code-extensions-macosx',
      `
${VS_CODE_EXTENSIONS_TO_INSTALL.map((ext) => `/usr/local/bin/code --install-extension ${ext} --force`).join('\n')}
    `,
      false,
    ],
  ]);
}

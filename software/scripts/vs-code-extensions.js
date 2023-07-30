const toInstallExtensions = trimLeftSpaces(`
  andrejunges.Handlebars
  christian-kohler.path-intellisense
  clinyong.vscode-css-modules
  dakara.transformer
  dbaeumer.vscode-eslint
  dracula-theme.theme-dracula
  dsznajder.es7-react-js-snippets
  emmanuelbeziat.vscode-great-icons
  esbenp.prettier-vscode
  formulahendry.auto-rename-tag
  Hridoy.ember-snippets
  ms-azuretools.vscode-docker
  ms-dotnettools.csharp
  ms-python.isort
  ms-python.python
  ms-python.vscode-pylance
  ms-vscode-remote.remote-ssh
  ms-vscode-remote.remote-ssh-edit
  ms-vscode-remote.remote-wsl
  ms-vscode.cpptools
  ms-vscode.remote-explorer
  nicoespeon.abracadabra
  oderwat.indent-rainbow
  PKief.material-icon-theme
  redhat.java
  redhat.vscode-yaml
  VisualStudioExptTeam.intellicode-api-usage-examples
  VisualStudioExptTeam.vscodeintellicode
  vscjava.vscode-java-debug
  vscjava.vscode-java-dependency
  vscjava.vscode-java-pack
  vscjava.vscode-java-test
  vscjava.vscode-maven
  vscode-icons-team.vscode-icons
  wholroyd.jinja
  wmaurer.change-case
  xabikos.JavaScriptSnippets
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
cd "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/"
${VS_CODE_EXTENSIONS_TO_INSTALL.map((ext) => `./code --install-extension ${ext} --force`).join('\n')}
    `,
      false,
    ],
  ]);
}

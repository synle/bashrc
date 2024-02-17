const onlyVsCodeExtensions = trimLeftSpaces(`
  andrejunges.handlebars
  dakara.transformer
  hridoy.ember-snippets
  ms-dotnettools.csharp
  ms-python.vscode-pylance
  ms-vscode-remote.remote-ssh
  ms-vscode-remote.remote-ssh-edit
  ms-vscode-remote.remote-wsl
  ms-vscode.cpptools
  ms-vscode.remote-explorer
  visualstudioexptteam.intellicode-api-usage-examples
  visualstudioexptteam.vscodeintellicode
`);

const baseVsExtensions = trimLeftSpaces(`
  aaron-bond.better-comments
  anyscalecompute.anyscale-workspaces
  christian-kohler.path-intellisense
  clinyong.vscode-css-modules
  dbaeumer.vscode-eslint
  dracula-theme.theme-dracula
  dsznajder.es7-react-js-snippets
  emmanuelbeziat.vscode-great-icons
  esbenp.prettier-vscode
  formulahendry.auto-rename-tag
  formulahendry.code-runner
  golang.go
  hashicorp.terraform
  jeanp413.open-remote-ssh
  ms-azuretools.vscode-docker
  ms-pyright.pyright
  ms-python.isort
  ms-python.python
  nicoespeon.abracadabra
  oderwat.indent-rainbow
  PKief.material-icon-theme
  redhat.java
  redhat.vscode-yaml
  scala-lang.scala
  streetsidesoftware.code-spell-checker
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

const VS_CODE_EXTENSIONS_TO_INSTALL = convertTextToList(onlyVsCodeExtensions, baseVsExtensions);
const VS_CODIUM_EXTENSIONS_TO_INSTALL = convertTextToList(baseVsExtensions);

async function doWork() {
  console.log(`  >> Setting up VS Code Extensions:`);

  if (DEBUG_WRITE_TO_DIR) {
    console.log('    >> Skipped - this is only used to build the main scripts');
  }

  // write to build file
  writeToBuildFile([
    // for vscode
    [
      'vs-code-extensions-windows',
      `
c:; cd "C:/Program Files/Microsoft VS Code/bin"
${VS_CODE_EXTENSIONS_TO_INSTALL.map((ext) => `./code --install-extension ${ext} --force`).join('\n')}
echo 'Done installing VSCode Extensions'
    `,
      false,
    ],
    [
      'vs-code-extensions-macosx',
      `
cd "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/"
${VS_CODE_EXTENSIONS_TO_INSTALL.map((ext) => `./code --install-extension ${ext} --force`).join('\n')}
echo 'Done installing VSCode Extensions'
    `,
      false,
    ],
    [
      'vs-code-extensions-linux',
      `
${VS_CODE_EXTENSIONS_TO_INSTALL.map((ext) => `code --install-extension ${ext} --force`).join('\n')}
    `,
      false,
    ],
    // for vscodium
    [
      'vs-codium-extensions-windows',
      `
c:;
cd "C:/Users/le*"
cd "C:/Users/sy*"
cd "AppData/Local/Programs/VSCodium/bin"
cd "C:/Program Files/VSCodium/bin"
${VS_CODIUM_EXTENSIONS_TO_INSTALL.map((ext) => `codium --install-extension ${ext} --force`).join('\n')}
echo 'Done installing VSCode Extensions'
    `,
      false,
    ],
    [
      'vs-codium-extensions-macosx',
      `
cd "/Applications/VSCodium.app/Contents/Resources/app/bin"
${VS_CODE_EXTENSIONS_TO_INSTALL.map((ext) => `./codium --install-extension ${ext} --force`).join('\n')}
echo 'Done installing VSCode Extensions'
    `,
      false,
    ],
  ]);
}

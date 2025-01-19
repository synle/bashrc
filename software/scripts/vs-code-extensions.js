// /usr/bin/codium --list-extensions | xargs -L 1 /usr/bin/codium --uninstall-extension

const onlyVsCodeExtensions = trimLeftSpaces(`
  ## andrejunges.handlebars
  ## dakara.transformer
  # hridoy.ember-snippets
  # ms-dotnettools.csharp
  # ms-python.vscode-pylance
  # ms-vscode.cpptools
  # visualstudioexptteam.intellicode-api-usage-examples
  # visualstudioexptteam.vscodeintellicode
  ms-vscode-remote.vscode-remote-extensionpack
`);

const onlyCodiumExtensions = trimLeftSpaces(`
  jeanp413.open-remote-ssh
`);

const baseVsExtensions = trimLeftSpaces(`
  aaron-bond.better-comments
  christian-kohler.path-intellisense
  clinyong.vscode-css-modules
  dbaeumer.vscode-eslint
  dracula-theme.theme-dracula
  dsznajder.es7-react-js-snippets
  esbenp.prettier-vscode
  formulahendry.auto-rename-tag
  formulahendry.code-runner
  golang.go
  # ms-azuretools.vscode-docker
  ms-pyright.pyright
  ms-python.isort
  ms-python.python
  nicoespeon.abracadabra
  oderwat.indent-rainbow
  PKief.material-icon-theme
  redhat.java
  redhat.vscode-yaml
  # scala-lang.scala
  streetsidesoftware.code-spell-checker
  wholroyd.jinja
  wmaurer.change-case
  tomoki1207.pdf
  # hashicorp.terraform
  # emmanuelbeziat.vscode-great-icons
`).trim();

const VS_CODE_EXTENSIONS_TO_INSTALL = convertTextToList(onlyVsCodeExtensions, baseVsExtensions);
const VS_CODIUM_EXTENSIONS_TO_INSTALL = convertTextToList(onlyCodiumExtensions, baseVsExtensions);

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
c:;  cd "C:/Program Files/Microsoft VS Code/bin"
${VS_CODE_EXTENSIONS_TO_INSTALL.map((ext) => `code --install-extension ${ext} --force`).join('\n')}
echo 'Done installing VSCode Extensions'

c:; cd "C:/Program Files/VSCodium/bin"
${VS_CODIUM_EXTENSIONS_TO_INSTALL.map((ext) => `codium --install-extension ${ext} --force`).join('\n')}
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

cd "/Applications/VSCodium.app/Contents/Resources/app/bin/"
${VS_CODIUM_EXTENSIONS_TO_INSTALL.map((ext) => `./codium --install-extension ${ext} --force`).join('\n')}
echo 'Done installing VSCodium Extensions'
    `,
      false,
    ],
    [
      'vs-code-extensions-linux',
      `
${VS_CODE_EXTENSIONS_TO_INSTALL.map((ext) => `code --install-extension ${ext} --force`).join('\n')}
echo 'Done installing VSCode Extensions'

${VS_CODIUM_EXTENSIONS_TO_INSTALL.map((ext) => `codium --install-extension ${ext} --force`).join('\n')}
echo 'Done installing VSCodium Extensions'
    `,
      false,
    ],
  ]);
}

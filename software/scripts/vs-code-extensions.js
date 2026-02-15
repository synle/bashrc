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
  aaron-bond.better-comments
  clinyong.vscode-css-modules
  dbaeumer.vscode-eslint
  dracula-theme.theme-dracula
  esbenp.prettier-vscode
  formulahendry.code-runner
  golang.go
  ms-azuretools.vscode-docker
  ms-python.isort
  ms-python.python
  ms-toolsai.jupyter
  nicoespeon.abracadabra
  oderwat.indent-rainbow
  PKief.material-icon-theme
  redhat.java
  redhat.vscode-yaml
  streetsidesoftware.code-spell-checker
  wholroyd.jinja
  wmaurer.change-case
`).trim();

const VS_CODE_EXTENSIONS_TO_INSTALL = convertTextToList(onlyVsCodeExtensions, baseVsExtensions);
const VS_CODIUM_EXTENSIONS_TO_INSTALL = convertTextToList(onlyCodiumExtensions, baseVsExtensions);

async function doWork() {
  console.log(`  >> VS Code Extensions:`);

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
# to delete all previous extensions
# /usr/bin/codium --list-extensions | xargs -L 1 /usr/bin/codium --uninstall-extension

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
# to delete all previous extensions
# /usr/bin/code --list-extensions | xargs -L 1 /usr/bin/code --uninstall-extension
# /usr/bin/codium --list-extensions | xargs -L 1 /usr/bin/codium --uninstall-extension

${VS_CODE_EXTENSIONS_TO_INSTALL.map((ext) => `/usr/bin/code --install-extension ${ext} --force`).join('\n')}
echo 'Done installing VSCode Extensions'

${VS_CODIUM_EXTENSIONS_TO_INSTALL.map((ext) => `/usr/bin/codium --install-extension ${ext} --force`).join('\n')}
echo 'Done installing VSCodium Extensions'

${VS_CODIUM_EXTENSIONS_TO_INSTALL.map((ext) => `flatpak run com.vscodium.codium --install-extension ${ext} --force`).join('\n')}
echo 'Done installing VSCodium Extensions'
    `,
      false,
    ],
  ]);
}

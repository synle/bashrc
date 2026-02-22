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

async function doWork() {
  console.log(`  >> VS Code Extensions:`);

  // write to build file
  writeToBuildFile([
    // for vscode
    {
      file: 'vs-code-extensions-windows',
      data: `
c:;  cd "C:/Program Files/Microsoft VS Code/bin"
${VS_CODE_EXTENSIONS_TO_INSTALL.map((ext) => `code --install-extension ${ext} --force`).join('\n')}
echo 'Done installing VSCode Extensions'

c:; cd "C:/Program Files/VSCodium/bin"
${VS_CODIUM_EXTENSIONS_TO_INSTALL.map((ext) => `codium --install-extension ${ext} --force`).join('\n')}
echo 'Done installing VSCode Extensions'
    `,
    },
    {
      file: 'vs-code-extensions-macosx',
      data: `
# to delete all previous extensions
# /usr/bin/codium --list-extensions | xargs -L 1 /usr/bin/codium --uninstall-extension

cd "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/"
${VS_CODE_EXTENSIONS_TO_INSTALL.map((ext) => `./code --install-extension ${ext} --force`).join('\n')}
echo 'Done installing VSCode Extensions'

cd "/Applications/VSCodium.app/Contents/Resources/app/bin/"
${VS_CODIUM_EXTENSIONS_TO_INSTALL.map((ext) => `./codium --install-extension ${ext} --force`).join('\n')}
echo 'Done installing VSCodium Extensions'
    `,
    },
    {
      file: 'vs-code-extensions-linux',
      data: `
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
    },
  ]);
}

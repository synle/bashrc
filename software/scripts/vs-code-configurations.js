async function doWork() {
  const targetPath = _getPath();
  let targetFile;

  if (!fs.existsSync(targetPath)) {
    console.log("Not supported - Exit - targetPath not found: ", targetPath);
    process.exit();
  }

  console.log(`  >> Setting up Microsoft VS Code Configurations:`, targetPath);

  // get os specific settings
  let fontFamilyToUse = CONFIGS.fontFamily;

  const osSpecificSettings = {
    "editor.fontFamily": fontFamilyToUse,
  };

  // settings.json
  const vsCodeMainConfigPath = path.join(targetPath, "User/settings.json");
  console.log(`    >> `, vsCodeMainConfigPath);
  writeJsonWithMerge(
    vsCodeMainConfigPath,
    Object.assign(
      {
        "[javascriptreact]": {
          "editor.defaultFormatter": "esbenp.prettier-vscode",
        },
        "[json]": {
          "editor.defaultFormatter": "esbenp.prettier-vscode",
        },
        "breadcrumbs.enabled": true,
        "editor.fontLigatures": true,
        "editor.fontSize": 14,
        "editor.fontWeight": "500",
        "editor.formatOnPaste": true,
        "editor.maxTokenizationLineLength": 10000,
        "editor.minimap.enabled": false,
        "editor.mouseWheelScrollSensitivity": 0,
        "editor.multiCursorModifier": "ctrlCmd",
        "editor.renderControlCharacters": true,
        "editor.renderWhitespace": "all",
        "editor.snippetSuggestions": "top",
        "editor.suggestSelection": "first",
        "editor.tabSize": 2,
        "editor.wordWrap": "wordWrapColumn",
        "editor.wordWrapColumn": 120,
        "files.eol": "\n", // LF Unix mode
        "files.exclude": {
          "**/*.class": true,
          "**/*.db": true,
          "**/*.dll": true,
          "**/*.doc": true,
          "**/*.docx": true,
          "**/*.dylib": true,
          "**/*.exe": true,
          "**/*.idb": true,
          "**/*.jar": true,
          "**/*.js.map": true,
          "**/*.lib": true,
          "**/*.min.js": true,
          "**/*.mp3": true,
          "**/*.ncb": true,
          "**/*.o": true,
          "**/*.obj": true,
          "**/*.ogg": true,
          "**/*.pdb": true,
          "**/*.pdf": true,
          "**/*.pid": true,
          "**/*.pid.lock": true,
          "**/*.psd": true,
          "**/*.pyc": true,
          "**/*.pyo": true,
          "**/*.sdf": true,
          "**/*.seed": true,
          "**/*.sln": true,
          "**/*.so": true,
          "**/*.sqlite": true,
          "**/*.suo": true,
          "**/*.swf": true,
          "**/*.swp": true,
          "**/*.woff": true,
          "**/*.woff2": true,
          "**/*.zip": true,
          "**/.cache": true,
          "**/.DS_Store": true,
          "**/.ebextensions": true,
          "**/.eslintcache": true,
          "**/.generated": true,
          "**/.git": true,
          "**/.hg": true,
          "**/.sass-cache": true,
          "**/.svn": true,
          "**/bin": true,
          "**/bower_components": true,
          "**/node_modules": true,
          "**/npm-debug.log": true,
          "**/obj": true,
        },
        "files.hotExit": "off",
        "files.insertFinalNewline": true,
        "files.trimTrailingWhitespace": true,
        "javascript.updateImportsOnFileMove.enabled": "always",
        "terminal.integrated.shell.windows": "C:\\Windows\\System32\\wsl.exe",
        "typescript.updateImportsOnFileMove.enabled": "always",
        "window.zoomLevel": 1,
        "workbench.colorTheme": "Dracula Soft",
        "workbench.editor.showTabs": true,
        "workbench.editor.tabCloseButton": "off",
        "workbench.iconTheme": "vscode-great-icons",
        "workbench.tree.indent": 4,
        "editor.codeActionsOnSave": {
          // "source.fixAll": true,
          "source.organizeImports": true,
        },
      },
      osSpecificSettings
    )
  );
}

function _getPath() {
  if (is_os_window) {
    return findDirSingle(getWindowAppDataRoamingUserPath(), /Code/);
  }
  if (is_os_darwin_mac) {
    return findDirSingle(getOsxApplicationSupportCodeUserPath(), /Code/);
  }
  return null;
}

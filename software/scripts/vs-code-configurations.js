async function doWork() {
  const targetPath = _getPath();
  let targetFile;

  if (!fs.existsSync(targetPath)) {
    console.log("Not supported - Exit - targetPath not found: ", targetPath);
    process.exit();
  }

  console.log(`  >> Setting up Microsoft VS Code:`, targetPath);

  // get os specific settings
  let fontFamilyToUse = "FiraCode-Retina";
  if (is_os_window === true) {
    fontFamilyToUse = CONFIGS.fontFamily;
  }
  const osSpecificSettings = {
    "editor.fontFamily": fontFamilyToUse,
  };

  // settings.json
  targetFile = path.join(targetPath, "settings.json");
  console.log(`    >> settings`, targetFile);
  writeJsonWithMerge(
    targetFile,
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
        "python.jediEnabled": false,
        "terminal.integrated.shell.windows": "C:\\Windows\\System32\\wsl.exe",
        "typescript.updateImportsOnFileMove.enabled": "always",
        "vsintellicode.modify.editor.suggestSelection":
          "automaticallyOverrodeDefaultValue",
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

  // Windows key binding
  const commonKeyBindings = [
    {
      key: "f5",
      command: "workbench.files.action.refreshFilesExplorer",
    },
  ];
  if (is_os_window) {
    // windows only key bindings
    targetFile = path.join(targetPath, "keybindings.json");
    console.log(`    >> keyboard shortcuts (Windows Only)`, targetFile);

    writeJson(targetFile, [
      ...commonKeyBindings,
      {
        key: "alt+\\",
        command: "workbench.action.toggleSidebarVisibility",
      },
      {
        key: "alt+;",
        command: "workbench.action.gotoLine",
      },
      {
        key: "alt+'",
        command: "workbench.action.gotoSymbol",
      },
      {
        key: "ctrl+alt+l",
        command: "editor.action.insertCursorAtEndOfEachLineSelected",
        when: "editorTextFocus",
      },
      {
        key: "shift+alt+l",
        command: "editor.action.insertCursorAtEndOfEachLineSelected",
        when: "editorTextFocus",
      },
      {
        key: "ctrl+alt+\\",
        command: "workbench.view.explorer",
      },
      {
        key: "ctrl+alt+'",
        command: "workbench.action.showAllSymbols",
      },
      {
        key: "ctrl+alt+g",
        command: "editor.action.selectHighlights",
      },
      {
        key: "shift+alt+p",
        command: "workbench.action.showCommands",
      },
      {
        key: "alt+p",
        command: "workbench.action.quickOpen",
      },
      {
        key: "alt+right",
        command: "cursorEnd",
        when: "textInputFocus",
      },
      {
        key: "alt+left",
        command: "cursorHome",
        when: "textInputFocus",
      },
      {
        key: "alt+f",
        command: "actions.find",
      },
      {
        key: "shift+alt+f",
        command: "workbench.action.findInFiles",
      },
      {
        key: "shift+alt+h",
        command: "workbench.action.replaceInFiles",
      },
      {
        key: "alt+a",
        command: "editor.action.selectAll",
      },
      {
        key: "alt+a",
        command: "editor.action.webvieweditor.selectAll",
        when: "!editorFocus && !inputFocus && activeEditor == 'WebviewEditor'",
      },
      {
        key: "alt+a",
        command: "list.selectAll",
        when: "listFocus && listSupportsMultiselect && !inputFocus",
      },
      {
        key: "alt+c",
        command: "editor.action.clipboardCopyAction",
      },
      {
        key: "alt+x",
        command: "editor.action.clipboardCutAction",
      },
      {
        key: "alt+v",
        command: "editor.action.clipboardPasteAction",
      },
      {
        key: "alt+s",
        command: "workbench.action.files.save",
      },
      {
        key: "alt+l",
        command: "expandLineSelection",
      },
      {
        key: "shift+alt+s",
        command: "workbench.action.files.saveAll",
      },
      {
        key: "alt+z",
        command: "undo",
        when: "textInputFocus && !editorReadonly",
      },
      {
        key: "shift+alt+z",
        command: "redo",
        when: "textInputFocus && !editorReadonly",
      },
      {
        key: "ctrl+alt+c",
        command: "workbench.files.action.compareWithSaved",
      },
      {
        key: "shift+alt+]",
        command: "workbench.action.nextEditor",
      },
      {
        key: "shift+alt+[",
        command: "workbench.action.previousEditor",
      },
      {
        key: "alt+w",
        command: "workbench.action.closeActiveEditor",
      },
      {
        key: "alt+d",
        command: "workbench.action.splitEditor",
      },
      {
        key: "shift+alt+d",
        command: "workbench.action.splitEditorDown",
      },
      {
        key: "alt+down",
        command: "cursorPageDown",
        when: "textInputFocus",
      },
      {
        key: "alt+up",
        command: "cursorPageUp",
        when: "textInputFocus",
      },
      {
        key: "shift+alt+up",
        command: "cursorPageUpSelect",
        when: "textInputFocus",
      },
      {
        key: "shift+alt+down",
        command: "cursorPageDownSelect",
        when: "textInputFocus",
      },
      {
        key: "shift+alt+left",
        command: "cursorHomeSelect",
        when: "textInputFocus",
      },
      {
        key: "shift+alt+right",
        command: "cursorEndSelect",
        when: "textInputFocus",
        args: {
          sticky: false,
        },
      },
      {
        key: "ctrl+alt+left",
        command: "cursorTop",
        when: "textInputFocus",
      },
      {
        key: "ctrl+alt+right",
        command: "cursorBottom",
        when: "textInputFocus",
      },
      {
        key: "ctrl+shift+alt+left",
        command: "cursorTopSelect",
        when: "textInputFocus",
      },
      {
        key: "ctrl+shift+alt+right",
        command: "cursorBottomSelect",
        when: "textInputFocus",
      },
      {
        key: "alt+n",
        command: "workbench.action.files.newUntitledFile",
      },
      {
        key: "alt+shift+n",
        command: "workbench.action.newWindow",
      },
      {
        key: "alt+d",
        command: "editor.action.addSelectionToNextFindMatch",
      },
      {
        key: "alt+d",
        command: "editor.action.addSelectionToNextFindMatch",
        when: "editorFocus",
      },
      {
        key: "alt+/",
        command: "editor.action.commentLine",
        when: "editorTextFocus && !editorReadonly",
      },
      {
        key: "alt+[",
        command: "editor.action.outdentLines",
        when: "editorTextFocus && !editorReadonly",
      },
      {
        key: "alt+]",
        command: "editor.action.indentLines",
        when: "editorTextFocus && !editorReadonly",
      },
      {
        key: "alt+=",
        command: "workbench.action.zoomIn",
      },
      {
        key: "alt+-",
        command: "workbench.action.zoomOut",
      },
    ]);
    // end of windows only key bindings
  } else if (is_os_darwin_mac) {
    // Mac OSX only key bindings
    targetFile = path.join(targetPath, "keybindings.json");
    console.log(`    >> keyboard shortcuts (Mac Only)`, targetFile);

    writeJson(targetFile, [
      ...commonKeyBindings,
      {
        key: "cmd+\\",
        command: "workbench.action.toggleSidebarVisibility",
      },
      {
        key: "shift+cmd+l",
        command: "editor.action.insertCursorAtEndOfEachLineSelected",
        when: "editorTextFocus",
      },
      {
        key: "shift+cmd+\\",
        command: "workbench.view.explorer",
      },
      {
        key: "cmd+;",
        command: "workbench.action.gotoLine",
      },
      {
        key: "cmd+'",
        command: "workbench.action.gotoSymbol",
      },
      {
        key: "shift+cmd+'",
        command: "workbench.action.showAllSymbols",
      },
      {
        key: "shift+cmd+g",
        command: "editor.action.selectHighlights",
      },
      {
        key: "ctrl+cmd+p",
        command: "workbench.action.openWorkspace",
      },
      {
        key: "ctrl+cmd+p",
        command: "projectManager.listProjects",
      },
      {
        key: "alt+cmd+p",
        command: "-projectManager.listProjects",
      },
      {
        key: "ctrl+cmd+c",
        command: "workbench.files.action.compareWithSaved",
      },
    ]);
    // end of Mac OSX only key bindings
  }
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

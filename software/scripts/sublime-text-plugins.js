// BEGIN software/scripts/editor.common.js

// END software/scripts/editor.common.js

/**
 * Copies Sublime Text plugin files to both the prebuilt build directory and the local Sublime Text installation.
 */
async function doWork() {
  exitIfLimitedSupportOs();
  log(`  >> Sublime Text Plugins:`);
  const allPlugins = [`sublime-text-plugins-refresh-on-focus.py`];

  // write to build file
  log(`    >> For prebuilt configs`);
  for (const pluginCodePath of allPlugins) {
    log(`      >> ${pluginCodePath}`);
    writeToBuildFile({ file: pluginCodePath, data: readText(path.join("software/scripts", pluginCodePath)) });
  }

  // for my own system
  let targetPath = await _getPathSublimeText();
  log("    >> For my own system", colorDim(targetPath));
  for (const pluginCodePath of allPlugins) {
    const fileDestPath = path.join(targetPath, path.join("Packages/User/", pluginCodePath));
    log("      >> fileDestPath", colorDim(fileDestPath));
    writeText(fileDestPath, readText(path.join("software/scripts", pluginCodePath)));
  }
}

/// <reference path="../index.js" />

includeSource('software/scripts/sublime-text.common.js');

/**
 * Copies Sublime Text plugin files to both the prebuilt build directory and the local Sublime Text installation.
 */
async function doWork() {
  console.log(`  >> Sublime Text Plugins:`);
  const allPlugins = [`sublime-text-plugins-refresh-on-focus.py`];

  // write to build file
  console.log(`    >> For prebuilt configs`);
  for (const pluginCodePath of allPlugins) {
    console.log(`      >> ${pluginCodePath}`);
    writeToBuildFile({ file: pluginCodePath, data: readText(path.join('software/scripts', pluginCodePath)) });
  }

  // for my own system
  let targetPath = await _getPathSublimeText();
  console.log('    >> For my own system', targetPath);
  for (const pluginCodePath of allPlugins) {
    const fileDestPath = path.join(targetPath, path.join('Packages/User/', pluginCodePath));
    console.log('      >> fileDestPath', fileDestPath);
    console.log(readText(path.join('software/scripts', pluginCodePath)));
    writeText(fileDestPath, readText(path.join('software/scripts', pluginCodePath)));
  }
}
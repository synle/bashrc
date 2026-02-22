includeSource('software/scripts/sublime-text.common.js');

async function doInit() {}

async function doWork() {
  console.log(`  >> Sublime Text Plugins:`);

  // write to build file
  console.log(`    >> For prebuilt configs`);
  for (const pluginCodePath of [`sublime-text-plugins.refresh-on-focus.py`]) {
    console.log(`      >> ${pluginCodePath}`);
    writeToBuildFile({ file: pluginCodePath, data: readText(path.join('software/scripts', pluginCodePath)) });
  }

  // for my own system
  let targetPath = await _getPathSublimeText();
  console.log('    >> For my own system', targetPath);
  exitIfPathNotFound(targetPath);
  for (const pluginCodePath of [`sublime-text-plugins.refresh-on-focus.py`]) {
    const fileDestPath = path.join(targetPath, path.join('Packages/User/', pluginCodePath));
    console.log('      >> fileDestPath', fileDestPath);
    writeJson(fileDestPath, readText(path.join('software/scripts', pluginCodePath)));
  }
}

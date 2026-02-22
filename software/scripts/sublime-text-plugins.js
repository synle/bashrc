includeSource('software/scripts/sublime-text.common.js');

async function doInit() {}

async function doWork() {
  console.log(`  >> Sublime Text Plugins:`);

  for (const pluginCodePath of [`sublime-text-plugins.refresh-on-focus.py`]) {
    console.log(`    >> ${pluginCodePath}`);

    // write to build file
    writeToBuildFile({ file: pluginCodePath, data: readText(path.join('software/scripts', pluginCodePath)) });
  }
}

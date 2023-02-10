async function doWork() {
  let targetPath = path.join(getWindowUserBaseDir(), '.wslconfig');
  console.log('  >> WSL Tweaks - Disable GUI', targetPath);
  writeText(
    targetPath,
    `
[wsl2]
guiApplications=false
  `.trim(),
  );
}

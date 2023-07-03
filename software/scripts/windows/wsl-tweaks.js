async function doWork() {
  let targetPath = path.join(getWindowUserBaseDir(), '.wslconfig');

  console.log('  >> WSL Tweaks - Disable GUI', targetPath);

  // https://learn.microsoft.com/en-us/windows/wsl/wsl-config

  writeText(
    targetPath,
    `
[wsl2]
guiApplications=false
memory=4GB # Limits VM memory in WSL 2
swap=12GB # Sets amount of swap storage space
processors=1 # Makes the WSL 2 VM use two virtual processors
  `.trim(),
  );
}

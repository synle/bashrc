async function doWork() {
  const targetPath = path.join(getWindowUserBaseDir(), '.wslconfig');
  console.log('  >> WSL Tweaks: Updating configuration', targetPath);
  console.log('  >> Note: Run "wsl --shutdown" for changes to take effect.');

  const desiredSettings = {
    guiApplications: 'false',
    memory: '8GB',
    swap: '24GB',
    processors: '2',
    networkingMode: 'mirrored',
  };

  let content = '';
  try {
    content = await readText(targetPath);
  } catch (e) {
    content = '[wsl2]';
  }
  content += `\n# .wslconfig`;

  let lines = content.split(/\r?\n/);
  const foundKeys = new Set();

  // 1. Update existing lines and track which keys we found
  let updatedLines = lines.map((line) => {
    const match = Object.keys(desiredSettings).find((key) => new RegExp(`^\\s*${key}\\s*=`, 'i').test(line));

    if (match) {
      foundKeys.add(match);
      return `${match}=${desiredSettings[match]}`;
    }
    return line;
  });

  // 2. Ensure [wsl2] header exists
  if (!updatedLines.some((line) => line.trim().toLowerCase() === '[wsl2]')) {
    updatedLines.unshift('[wsl2]');
  }

  // 3. Append missing settings
  for (const [key, value] of Object.entries(desiredSettings)) {
    if (!foundKeys.has(key)) {
      updatedLines.push(`${key}=${value}`);
    }
  }

  // 4. Clean up whitespace and save
  const finalOutput = updatedLines
    .filter((line, index, arr) => line.trim() !== '' || (arr[index + 1] && arr[index + 1].trim() !== ''))
    .join('\n')
    .trim();

  writeToBuildFile([['window_wsl2_config', finalOutput]]);
  writeText(targetPath, finalOutput);
}

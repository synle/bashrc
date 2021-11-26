async function doWork() {
  let targetPath = '/mnt/d';

  console.log('  >> mkdir for D Drive', targetPath);

  if (!fs.existsSync(targetPath)) {
    console.log('  >> Skipped - Path Not Found: ', consoleLogColor4(targetPath));
    return process.exit();
  }

  const pathsToCreate = convertTextToList(`
    /mnt/d/Applications
    /mnt/d/Desktop
    /mnt/d/Documents
    /mnt/d/Downloads
    /mnt/d/Games
    /mnt/d/Pictures
  `);

  for (const pathToCreate of pathsToCreate) {
    console.log('    >> ', pathToCreate);
    await mkdir(pathToCreate);
  }
}

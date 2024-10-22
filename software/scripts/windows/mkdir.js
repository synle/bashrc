async function doWork() {
  let targetPath = globalThis.BASE_D_DIR_WINDOW;

  console.log('  >> mkdir for D Drive', targetPath);

  if (!filePathExist(targetPath)) {
    console.log('  >> Skipped - Path Not Found: ', consoleLogColor4(targetPath));
    return process.exit();
  }

  const pathsToCreate = convertTextToList(`
    ${path.join(targetPath, 'Applications')}
    ${path.join(targetPath, 'Desktop')}
    ${path.join(targetPath, 'Documents')}
    ${path.join(targetPath, 'Downloads')}
    ${path.join(targetPath, 'Games')}
    ${path.join(targetPath, 'Pictures')}
  `);

  console.log(pathsToCreate);

  for (const pathToCreate of pathsToCreate) {
    console.log('    >> ', pathToCreate);
    await mkdir(pathToCreate);
  }
}

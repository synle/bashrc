async function doWork() {
  console.log('  >> Installing Windows Only - Classic Start Configs');
  const res = await fetchUrlAsString(`software/scripts/windows/classic_start.config.xml`);

  writeToBuildFile([{ file: 'windows-classic-start-menu.xml', data: res }]);

  const targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, 'windows', 'classic-start.xml');

  console.log('    >> Classic Start Configs', consoleLogColor4(targetPath));
  writeText(targetPath, res);
}

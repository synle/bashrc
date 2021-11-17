async function doWork() {
  console.log('  >> Installing Windows Only - Classic Start Configs');

  const targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, 'windows', 'classic-start.xml');
  const res = await fetchUrlAsString(`${SY_REPO_PREFIX}/software/scripts/windows/classic_start.config.xml`);

  console.log('    >> Classic Start Configs', consoleLogColor4(targetPath));
  writeText(targetPath, res);
}

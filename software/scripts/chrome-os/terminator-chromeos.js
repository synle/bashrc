async function doWork() {
  let targetPath = path.join(BASE_HOMEDIR_LINUX, '.config/terminator');
  await mkdir(targetPath);

  targetPath = path.join(targetPath, 'config');
  console.log('  >> Download Terminator Config - ChromeOS ', targetPath);

  const content = await fetchUrlAsString('software/scripts/chrome-os/terminator-chromeos.config');
  writeText(targetPath, content);
}

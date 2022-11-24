async function doWork() {
  let targetPath = path.join(BASE_HOMEDIR_LINUX, '.config/terminator/config');
  console.log('  >> Download Terminator Config - ChromeOS ', targetPath);

  const content = await readText('./software/scripts/chrome-os/terminator-chromeos.config');
  writeText(targetPath, content);
}

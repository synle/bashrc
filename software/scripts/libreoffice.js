async function doWork() {
  let targetPath = '/etc/libreoffice';

  console.log('  >> Install libreoffice configs:', consoleLogColor4(targetPath));

  if (!is_os_chromeos && !is_os_arch_linux) {
    console.log(consoleLogColor1('    >> Skipped : Not Applicable'));
    return process.exit();
  }

  if (!fs.existsSync(targetPath)) {
    console.log(consoleLogColor1('    >> Skipped : Not Found'));
    return process.exit();
  }

  targetPath = path.join(targetPath, 'sofficerc');
  console.log('    >> Update Configs:', consoleLogColor4(targetPath));

  let newContent = '';
  try {
    newContent = readText(targetPath);
  } catch (err) {}

  // disable splash screen
  // https://www.howtogeek.com/287367/how-to-disable-libreoffices-startup-splash-screen-on-windows-and-linux
  newContent = newContent.replace(/Logo=[0-9]/, '').trim();
  newContent += `\nLogo=0`;
  newContent = newContent.replace(/[\n][\n]+/, '\n');

  writeText(targetPath, newContent);
}

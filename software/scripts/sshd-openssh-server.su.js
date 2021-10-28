async function doWork() {
  const targetPath = '/etc/ssh/sshd_config';

  console.log('  >> Setting up SSH Server sshd_config', consoleLogColor4(targetPath));

  if (!fs.existsSync(targetPath)) {
    console.log('Not supported - Exit - targetPath not found: ', consoleLogColor4(targetPath));
    return process.exit();
  }

  let portToUse = '22';
  if (is_os_window) {
    portToUse = '2222';
  }

  console.log('   >> Needs Firewall Changes:', 'https://bit.ly/3pMqCIg');

  replaceTextLineByLine(targetPath, [
    [new RegExp(`[# ]*Port[ ]*[0-9]+`), `Port ${portToUse}`],
    [new RegExp(`[# ]*ListenAddress[ ]*[0-9]+.[0-9]+.[0-9]+.[0-9]+`), `ListenAddress 0.0.0.0`],
    [new RegExp(`[# ]*PasswordAuthentication[ ]*[a-zA-Z]+`), `PasswordAuthentication no`],
  ]);
}

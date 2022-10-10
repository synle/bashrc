const sshPortMap = {};

const portToIp = {
  2222: `
    192.168.1.24
    192.168.1.25
    192.168.1.26
  `,
};

const DEFAULT_SSH_PORT = '22';

async function doInit() {
  // setting up the ssh port map
  for (const port of Object.keys(portToIp)) {
    const ips = portToIp[port]
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s);
    for (const ip of ips) {
      sshPortMap[ip] = port;
    }
  }
}

async function doWork() {
  const baseSshPath = path.join(BASE_HOMEDIR_LINUX, '.ssh');
  const targetPath = path.join(baseSshPath, 'config');

  console.log('    >> Setting up SSH Client config', consoleLogColor4(targetPath));

  await mkdir(baseSshPath);

  await execBashSilent(`touch "${targetPath}" && chmod 611 "${targetPath}"`);

  console.log('    >> Updating SSH Client Config', consoleLogColor4(targetPath));

  let sshConfigTextContent = readText(targetPath);

  // add tweaks...
  sshConfigTextContent = appendTextBlock(
    sshConfigTextContent,
    'SY CUSTOM CONFIG - All Hosts', // key
    trimLeftSpaces(`
      Host *
        ### reuse connection
        ## ControlMaster auto
        ## ControlPath /tmp/%r@%h:%p
        ## ControlPersist 20m
        # forward agent
        ForwardAgent yes
        # identity
        User syle
        IdentityFile ~/.ssh/id_rsa
    `),
  );

  const sshConnections = HOME_HOST_NAMES.filter(([hostName, hostIp, { NO_SSH, OSX_REMOTE, WINDOWS_REMOTE }]) => NO_SSH !== true);

  sshConfigTextContent = appendTextBlock(
    sshConfigTextContent,
    'SY CUSTOM CONFIG - Home Network Hosts', // key
    sshConnections
      .map(([hostName, hostIp]) =>
        trimLeftSpaces(`
          Host ${hostName}
            HostName ${hostIp}
            Port ${sshPortMap[hostIp] || DEFAULT_SSH_PORT}
        `),
      )
      .join('\n'),
  );

  sshConfigTextContent = sshConfigTextContent.trim();

  // write if there are change
  console.log(sshConnections.map(([hostName, hostIp]) => `      >> ${hostIp} ${hostName}`).join('\n'));

  // write to build file
  writeToBuildFile([['ssh-config', sshConfigTextContent, false]]);

  // make a backup
  backupText(path.join(BASE_HOMEDIR_LINUX, `.ssh/bak.config`), sshConfigTextContent);

  writeText(targetPath, sshConfigTextContent);
}

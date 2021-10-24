let DYNAMIC_BLOCK_HOST_NAMES;
let STATIC_BLOCK_HOST_NAMES;
let WHITE_LIST_HOST_NAMES;
let ROUTED_BLOCKED_IP;

async function doInit() {
  // initiate the vars
  STATIC_BLOCK_HOST_NAMES = convertTextToList(
    await fetchUrlAsString('https://raw.githubusercontent.com/synle/bashrc/master/software/metadata/hosts-whitelisted.config'),
  );

  WHITE_LIST_HOST_NAMES = new Set(
    convertTextToList(
      await fetchUrlAsString('https://raw.githubusercontent.com/synle/bashrc/master/software/metadata/hosts-blocked-manual.config'),
    ),
  );

  ROUTED_BLOCKED_IP = '0.0.0.0';

  DYNAMIC_BLOCK_HOST_NAMES = [];
}

async function doWork() {
  console.log('  >> Setting up etc hosts');

  // do works
  await doWorkEtcHost();
}

async function doWorkSshConfig() {
  const baseSshPath = path.join(BASE_HOMEDIR_LINUX, '.ssh');
  const targetPath = path.join(baseSshPath, 'config');

  console.log('    >> Setting up SSH Client config', consoleLogColor4(targetPath));
  await execBashSilent(`
    touch "${targetPath}" && chmod 611 ${targetPath}
  `);

  console.log('    >> Updating SSH Client Config', consoleLogColor4(targetPath));

  let sshConfigTextContent = readText(targetPath);

  // make a backup
  writeText(path.join(BASE_HOMEDIR_LINUX, `.ssh/config.backup.${Date.now()}`), sshConfigTextContent);

  // add tweaks...
  sshConfigTextContent = appendTextBlock(
    sshConfigTextContent,
    'SY CUSTOM CONFIG - All Hosts', // key
    `
Host *
  # reuse connection
  ControlMaster auto
  ControlPath /tmp/%r@%h:%p
  ControlPersist 20m
  # forward agent
  ForwardAgent yes
  # identity
  User syle
  IdentityFile ~/.ssh/id_rsa
  `,
  );

  sshConfigTextContent = appendTextBlock(
    sshConfigTextContent,
    'SY CUSTOM CONFIG - Home Network Hosts', // key
    HOME_HOST_NAMES.map(([hostName, hostIp]) =>
      `
Host ${hostName}
  HostName ${hostIp}
      `.trim(),
    ).join('\n'),
  );

  // write if there are change
  console.log(HOME_HOST_NAMES.map(([hostName, hostIp]) => `      >> ${hostIp} ${hostName}`).join('\n'));

  writeText(targetPath, sshConfigTextContent.trim());
}

async function doWorkEtcHost() {
  const targetPath = _getEtcHosts();
  let etcHostTextContent = readText(targetPath);

  console.log('    >> Updating ETC Host', consoleLogColor4(targetPath));

  // make a backup
  writeText(path.join(BASE_HOMEDIR_LINUX, `.ssh/etc_host.backup.${Date.now()}`), etcHostTextContent);

  // add tweaks...
  etcHostTextContent = appendTextBlock(
    etcHostTextContent,
    'Sy Home Hosts', // key
    HOME_HOST_NAMES.map(([hostName, hostIp]) => `${hostIp} ${hostName}`).join('\n'),
  );

  // blocked hostname
  const BLOCK_HOST_NAMES = await _getBlockedHostNames();
  etcHostTextContent = appendTextBlock(
    etcHostTextContent,
    'Sy Blocked Hosts', // key
    [...new Set(BLOCK_HOST_NAMES)]
      .filter((hostName) => !WHITE_LIST_HOST_NAMES.has(hostName))
      .map((hostName) => `${ROUTED_BLOCKED_IP} ${hostName}`)
      .join('\n'),
  );

  // write if there are change
  try {
    console.log('      >> Update host mappings');
    console.log('        >> Total Home Hosts', HOME_HOST_NAMES.length);
    console.log('        >> Total Blocked Hosts', BLOCK_HOST_NAMES.length);

    writeText(targetPath, etcHostTextContent.trim());
    console.log('      >> Done updating etc hosts: ', consoleLogColor4(targetPath));

    if (is_os_window) {
      console.log('        >> Only Windows run command: ipconfig /flushdns');
    }
  } catch (err) {
    console.log('      >> Skipped : Permission denied (needs to Run as Admin for Windows WSL)');
  }
}

async function _getBlockedHostNames() {
  let mappingsToUse = [...STATIC_BLOCK_HOST_NAMES];
  if (!is_os_window) {
    // for non windows, we can more hosts from the blocked hosts...
    const url = 'https://raw.githubusercontent.com/synle/bashrc/master/software/metadata/hosts-blocked-ads.config';
    try {
      let h = await fetchUrlAsString(url);
      h = convertTextToHosts(h);
      console.log('      >> URL fetch for host success', url);
      console.log('        >> Total Hosts Found', h.length);
      DYNAMIC_BLOCK_HOST_NAMES = [...DYNAMIC_BLOCK_HOST_NAMES, ...h];
    } catch (err) {
      console.log('      >> URL fetch for host failed', url, err);
    }

    mappingsToUse = [...mappingsToUse, ...DYNAMIC_BLOCK_HOST_NAMES];
  }

  return [...new Set([...mappingsToUse])];
}

function _getEtcHosts() {
  const windowsEtcHostDir = '/mnt/c/Windows/System32/drivers/etc/hosts';

  if (fs.existsSync(windowsEtcHostDir) || is_os_window) {
    return windowsEtcHostDir;
  }

  return '/etc/hosts';
}

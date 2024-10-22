let DYNAMIC_BLOCK_HOST_NAMES = [];
let STATIC_BLOCK_HOST_NAMES = [];
let WHITE_LIST_HOST_NAMES = [];
let ROUTED_BLOCKED_IP = '0.0.0.0';

async function doInit() {
  // initiate the vars
  STATIC_BLOCK_HOST_NAMES = convertTextToList(await fetchUrlAsString(`software/metadata/hosts-blocked-manual.config`));

  WHITE_LIST_HOST_NAMES = convertTextToList(await fetchUrlAsString(`software/metadata/hosts-whitelisted.config`));

  STATIC_BLOCK_HOST_NAMES = _consolidateHosts(STATIC_BLOCK_HOST_NAMES);
  WHITE_LIST_HOST_NAMES = _consolidateHosts(WHITE_LIST_HOST_NAMES);

  DYNAMIC_BLOCK_HOST_NAMES = [];
}

async function doWork() {
  const targetPath = _getEtcHosts();
  let etcHostTextContent = readText(targetPath);

  console.log('  >> Updating ETC Host', consoleLogColor4(targetPath));

  // make a backup
  backupText(path.join(BASE_HOMEDIR_LINUX, `.ssh/bak.etc_host`), etcHostTextContent);

  // add tweaks...
  etcHostTextContent = appendTextBlock(
    etcHostTextContent,
    'Sy Home Hosts', // key
    HOME_HOST_NAMES.map(([hostName, hostIp]) => `${hostIp} ${hostName}`).join('\n'),
  );

  // blocked hostname
  const BLOCK_HOST_NAMES = (await _getBlockedHostNames()).filter((hostName) => !WHITE_LIST_HOST_NAMES.includes(hostName));

  etcHostTextContent = appendTextBlock(
    etcHostTextContent,
    'Sy Blocked Hosts', // key
    BLOCK_HOST_NAMES.map((hostName) => `${ROUTED_BLOCKED_IP} ${hostName}`).join('\n'),
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
    const url = `software/metadata/hosts-blocked-ads.config`;
    try {
      let h = await fetchUrlAsString(`software/metadata/hosts-blocked-ads.config`);
      h = convertTextToHosts(h);
      console.log('      >> URL fetch for host success', url);
      console.log('        >> Total Hosts Found', h.length);
      DYNAMIC_BLOCK_HOST_NAMES = [...DYNAMIC_BLOCK_HOST_NAMES, ...h];
    } catch (err) {
      console.log('      >> URL fetch for host failed', url, err);
    }

    mappingsToUse = [...mappingsToUse, ...DYNAMIC_BLOCK_HOST_NAMES];
  }

  mappingsToUse = mappingsToUse.map((s) => s.toLowerCase());

  return [...new Set([...mappingsToUse])];
}

function _getEtcHosts() {
  const windowsEtcHostDir = path.join(globalThis.BASE_C_DIR_WINDOW, '/Windows/System32/drivers/etc/hosts');

  if (filePathExist(windowsEtcHostDir) || is_os_window) {
    return windowsEtcHostDir;
  }

  return '/etc/hosts';
}

/**
consolidate hosts, remove duplicate and add extra hosts with www.
*/
function _consolidateHosts(hosts) {
  const newHosts = [...hosts];

  for (const host of hosts) {
    newHosts.push(host);
    if (!host.includes('www.')) {
      newHosts.push('www.' + host);
    }
  }

  newHosts = newHosts.map((s) => s.toLowerCase());

  return [...new Set([...newHosts])];
}

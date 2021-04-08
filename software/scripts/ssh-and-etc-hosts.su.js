let DYNAMIC_BLOCK_HOST_NAMES;
let STATIC_BLOCK_HOST_NAMES;
let WHITE_LIST_HOST_NAMES;
let ROUTED_BLOCKED_IP;

async function doInit() {
  // initiate the vars
  STATIC_BLOCK_HOST_NAMES = convertTextToList(`
    // Adobe
    lmlicenses.wip4.adobe.com
    lm.licenses.adobe.com
    na1r.services.adobe.com
    hlrcv.stage.adobe.com
    practivate.adobe.com
    activate.adobe.com

    // CCleaner
    license.piriform.com
    www.ccleaner.com

    // Sublime
    license.sublimehq.com
    www.sublimemerge.com
    www.sublimehq.com
    sublimemerge.com
    www.sublimetext.com
    sublimetext.com
    sublimehq.com
    telemetry.sublimehq.com
    download.sublimetext.com
    download.sublimemerge.com
    45.55.255.55
    45.55.41.223

    // Spotify
    adclick.g.doublecklick.net
    adeventtracker.spotify.com
    ads-fa.spotify.com
    analytics.spotify.com
    audio2.spotify.com
    b.scorecardresearch.com
    bounceexchange.com
    bs.serving-sys.com
    content.bitsontherun.com
    core.insightexpressai.com
    crashdump.spotify.com
    d2gi7ultltnc2u.cloudfront.net
    d3rt1990lpmkn.cloudfront.net
    doubleclick.net
    ds.serving-sys.com
    googleadservices.com
    googleads.g.doubleclick.net
    gtssl2-ocsp.geotrust.com
    js.moatads.com
    log.spotify.com
    media-match.com
    omaze.com
    pagead46.l.doubleclick.net
    pagead2.googlesyndication.com
    partner.googleadservices.com
    pubads.g.doubleclick.net
    redirector.gvt1.com
    s0.2mdn.net
    securepubads.g.doubleclick.net
    tpc.googlesyndication.com
    v.jwpcdn.com
    video-ad-stats.googlesyndication.com
    weblb-wg.gslb.spotify.com
    www.googleadservices.com
    googleadservices.com
    www.googletagservices.com
    googletagservices.com
  `);

  WHITE_LIST_HOST_NAMES = new Set(
    convertTextToList(`
      tkqlhce.com
      tradedoubler.com
      searchmarketing.com
      googleadservices.com
      marinsm.com
      webgains.com
      dotomi.com
      dpbolvw.net
      evyy.net
      doubleclick.net
      avantlink.com
      tkqlhce.com
      pjatr.com
      shareasale.com
      pntrack.com
      ojrq.net
      cc-dt.com
      jdoqocy.com
      pntrac.com
      affiliatefuture.com
      anrdoezrs.net
      emjcd.com
      commission-junction.com
      cj.com
      apmebf.com
      gopjn.com
      bfast.com
      redirect.at
      redirectingat.com
      7eer.net
      linksynergy.com
      kqzyfj.com
      mediaplex.com
      onenetworkdirect.net
      go2jump.org
      pntra.com
      pjtra.com
      qksrv.net
      gan.doubleclick.net
      redirect.viglink.com
      po.st
      clickserve.cc-dt.com
      pntrs.com
      ad.doubleclick.net
      cj.dotomi.com
      qksrv.ne
  `)
  );

  ROUTED_BLOCKED_IP = "0.0.0.0";

  DYNAMIC_BLOCK_HOST_NAMES = [];
}

async function doWork() {
  console.log("  >> Setting up etc hosts");

  // do works
  await doWorkEtcHost();
}

async function doWorkSshConfig() {
  const baseSshPath = path.join(BASE_HOMEDIR_LINUX, ".ssh");
  const targetPath = path.join(baseSshPath, "config");

  console.log("    >> Setting up SSH Client config", targetPath);
  await execBashSilent(`
    mkdir -p ${baseSshPath}
    touch ${targetPath} && chmod 611 ${targetPath}
  `);

  console.log("    >> Updating SSH Client Config", targetPath);

  let sshConfigTextContent = readText(targetPath);

  // make a backup
  writeText(
    path.join(BASE_HOMEDIR_LINUX, `.ssh/config.backup.${Date.now()}`),
    sshConfigTextContent
  );

  // add tweaks...
  sshConfigTextContent = appendTextBlock(
    sshConfigTextContent,
    "SY CUSTOM CONFIG - All Hosts", // key
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
  `
  );

  sshConfigTextContent = appendTextBlock(
    sshConfigTextContent,
    "SY CUSTOM CONFIG - Home Network Hosts", // key
    HOME_HOST_NAMES.map(([hostName, hostIp]) =>
      `
Host ${hostName}
  HostName ${hostIp}
      `.trim()
    ).join("\n")
  );

  // write if there are change
  console.log(
    HOME_HOST_NAMES.map(
      ([hostName, hostIp]) => `      >> ${hostIp} ${hostName}`
    ).join("\n")
  );

  writeText(targetPath, sshConfigTextContent.trim());
}

async function doWorkEtcHost() {
  const targetPath = _getEtcHosts();
  let etcHostTextContent = readText(targetPath);

  console.log("    >> Updating ETC Host", targetPath);

  // make a backup
  writeText(
    path.join(BASE_HOMEDIR_LINUX, `.ssh/etc_host.backup.${Date.now()}`),
    etcHostTextContent
  );

  // add tweaks...
  etcHostTextContent = appendTextBlock(
    etcHostTextContent,
    "Sy Home Hosts", // key
    HOME_HOST_NAMES.map(([hostName, hostIp]) => `${hostIp} ${hostName}`).join(
      "\n"
    )
  );

  // blocked hostname
  const BLOCK_HOST_NAMES = await _getBlockedHostNames();
  etcHostTextContent = appendTextBlock(
    etcHostTextContent,
    "Sy Blocked Hosts", // key
    [...new Set(BLOCK_HOST_NAMES)]
      .filter((hostName) => !WHITE_LIST_HOST_NAMES.has(hostName))
      .map((hostName) => `${ROUTED_BLOCKED_IP} ${hostName}`)
      .join("\n")
  );

  // write if there are change
  try {
    console.log("      >> Update host mappings");
    console.log("        >> Total Home Hosts", HOME_HOST_NAMES.length);
    console.log("        >> Total Blocked Hosts", BLOCK_HOST_NAMES.length);

    writeText(targetPath, etcHostTextContent.trim());
    console.log("      >> Done updating etc hosts: ", targetPath);

    if (is_os_window) {
      console.log("        >> Only Windows run command: ipconfig /flushdns");
    }
  } catch (err) {
    console.log(
      "      >> Skipped permission denied: (needs to run as Admin for Windows WSL)"
    );
  }
}

async function _getBlockedHostNames() {
  const url =
    "https://raw.githubusercontent.com/synle/bashrc/master/software/scripts/ssh-and-etc-hosts.blocked-hosts.config";
  try {
    let h = await fetchUrlAsString(url);
    h = convertTextToHosts(h);
    console.log("      >> URL fetch for host success", url);
    console.log("        >> Total Hosts Found", h.length);
    DYNAMIC_BLOCK_HOST_NAMES = [...DYNAMIC_BLOCK_HOST_NAMES, ...h];
  } catch (err) {
    console.log("      >> URL fetch for host failed", url, err);
  }

  return [
    ...new Set([...STATIC_BLOCK_HOST_NAMES, ...DYNAMIC_BLOCK_HOST_NAMES]),
  ];
}

function _getEtcHosts() {
  const windowsEtcHostDir = "/mnt/c/Windows/System32/drivers/etc/hosts";

  if (fs.existsSync(windowsEtcHostDir) || is_os_window) {
    return windowsEtcHostDir;
  }

  return "/etc/hosts";
}

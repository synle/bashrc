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

    // ad hosts to blocked
    // https://www.reddit.com/r/privacy/comments/3tz3ph/blocking_most_advertising_servers_via_factory/
    207.net
    247realmedia.com
    2mdn.net
    2o7.net
    33across.com
    abmr.net
    acoda.net
    adblade.com
    adbrite.com
    adbureau.net
    adchemy.com
    adclick.g.doublecklick.net
    addthis.com
    addthisedge.com
    adeventtracker.spotify.com
    admeld.com
    admob.com
    ads-fa.spotify.com
    adsense.com
    adsonar.com
    adthis.com
    advertising.com
    afy11.net
    analytics.spotify.com
    aquantive.com
    atdmt.com
    atwola.com
    audio2.spotify.com
    b.scorecardresearch.com
    bounceexchange.com
    bs.serving-sys.com
    channelintelligence.com
    cmcore.com
    content.bitsontherun.com
    core.insightexpressai.com
    coremetrics.com
    crashdump.spotify.com
    crowdscience.com
    d2gi7ultltnc2u.cloudfront.net
    d3rt1990lpmkn.cloudfront.net
    decdna.net
    decideinteractive.com
    doubleclick.com
    doubleclick.net
    ds.serving-sys.com
    esomniture.com
    fimserve.com
    flingwebads.com
    foxnetworks.com
    google-analytics.com
    googleads.g.doubleclick.net
    googleadservices.com
    googlesyndication.com
    googletagservices.com
    gravity.com
    gtssl2-ocsp.geotrust.com
    hitbox.com
    imiclk.com
    imrworldwide.com
    insightexpress.com
    insightexpressai.com
    intellitxt.com
    invitemedia.com
    js.moatads.com
    leadback.com
    lindwd.net
    log.spotify.com
    media-match.com
    mookie1.com
    myads.com
    netconversions.com
    nexac.com
    nextaction.net
    nielsen-online.com
    offermatica.com
    omaze.com
    omniture.com
    omtrdc.net
    pagead2.googlesyndication.com
    pagead46.l.doubleclick.net
    partner.googleadservices.com
    pm14.com
    pubads.g.doubleclick.net
    quantcast.com
    quantserve.com
    realmedia.com
    redirector.gvt1.com
    revsci.net
    rightmedia.com
    rmxads.com
    ru4.com
    rubiconproject.com
    s0.2mdn.net
    samsungadhub.com
    scorecardresearch.com
    securepubads.g.doubleclick.net
    sharethis.com
    shopthetv.com
    targetingmarketplace.com
    themig.com
    tpc.googlesyndication.com
    trendnetcloud.com
    v.jwpcdn.com
    video-ad-stats.googlesyndication.com
    weblb-wg.gslb.spotify.com
    www.googleadservices.com
    www.googletagservices.com
    yieldmanager.com
    yieldmanager.net
    yldmgrimg.net
    youknowbest.com
    yumenetworks.com
  `);

  WHITE_LIST_HOST_NAMES = new Set(
    convertTextToList(`
      7eer.net
      ad.doubleclick.net
      affiliatefuture.com
      anrdoezrs.net
      apmebf.com
      avantlink.com
      bfast.com
      cc-dt.com
      cj.com
      cj.dotomi.com
      clickserve.cc-dt.com
      commission-junction.com
      dotomi.com
      dpbolvw.net
      emjcd.com
      evyy.net
      gan.doubleclick.net
      go2jump.org
      gopjn.com
      jdoqocy.com
      kqzyfj.com
      linksynergy.com
      marinsm.com
      mediaplex.com
      ojrq.net
      onenetworkdirect.net
      pjatr.com
      pjtra.com
      pntra.com
      pntrac.com
      pntrack.com
      pntrs.com
      po.st
      qksrv.ne
      qksrv.net
      redirect.at
      redirect.viglink.com
      redirectingat.com
      searchmarketing.com
      shareasale.com
      tkqlhce.com
      tradedoubler.com
      webgains.com
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
      "      >> Skipped : Permission denied (needs to Run as Admin for Windows WSL)"
    );
  }
}

async function _getBlockedHostNames() {
  if (is_os_window) {
    return STATIC_BLOCK_HOST_NAMES;
  }

  const url =
    "https://raw.githubusercontent.com/synle/bashrc/master/software/metadata/blocked-hosts.config";
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

const ROUTED_BLOCKED_IP = "0.0.0.0";

/**
 * Returns the path to the system etc hosts file based on the current OS.
 * @returns {string} Path to the hosts file.
 */
function _getEtcHostsPath() {
  const windowsEtcHostPath = path.join(BASE_C_DIR_WINDOW, "/Windows/System32/drivers/etc/hosts");

  if (filePathExist(windowsEtcHostPath) || is_os_window) {
    return windowsEtcHostPath;
  }

  return "/etc/hosts";
}

/**
 * Deduplicates hosts, lowercases them, and adds www-prefixed variants.
 * @param {string[]} hosts - Array of hostnames to consolidate.
 * @returns {string[]} Deduplicated array with www variants included.
 */
function _consolidateHosts(hosts) {
  const expanded = [...hosts];

  for (const host of hosts) {
    if (!host.includes("www.")) {
      expanded.push("www." + host);
    }
  }

  return [...new Set(expanded.map((s) => s.toLowerCase()))];
}

/**
 * Fetches blocked hostnames from static and dynamic sources.
 * On non-Windows, also fetches the ad-blocking hosts list.
 * @param {string[]} staticBlockedHosts - Manually curated blocked hosts.
 * @returns {Promise<string[]>} Array of hostnames to block.
 */
async function _getBlockedHostNames(staticBlockedHosts) {
  const hosts = [...staticBlockedHosts];

  if (!is_os_window) {
    const url = `software/metadata/hosts-blocked-ads.config`;
    try {
      const dynamicHosts = convertTextToHosts(await fetchUrlAsString(url));
      log(">>> URL fetch for host success", url);
      log(">>>> Total Hosts Found", dynamicHosts.length);
      hosts.push(...dynamicHosts);
    } catch (err) {
      log(">>> URL fetch for host failed", url, err);
    }
  }

  return [...new Set(hosts.map((s) => s.toLowerCase()))];
}

/**
 * Loads blocked and whitelisted host configs, then updates the system etc hosts file
 * with home network mappings and blocked hosts.
 */
async function doWork() {
  exitIfLimitedSupportOs();

  const staticBlockedHosts = _consolidateHosts(
    convertTextToList(await fetchUrlAsString(`software/metadata/hosts-blocked-manual.config`)),
  );
  const whitelistedHosts = _consolidateHosts(
    convertTextToList(await fetchUrlAsString(`software/metadata/hosts-whitelisted.config`)),
  );

  const targetPath = _getEtcHostsPath();
  let etcHostTextContent = readText(targetPath);

  log(">> Updating ETC Host", targetPath);

  backupText(path.join(BASE_HOMEDIR_LINUX, `.ssh/bak.etc_host`), etcHostTextContent);

  etcHostTextContent = appendTextBlock(
    etcHostTextContent,
    "Sy Home Hosts",
    HOME_HOST_NAMES.map(([hostName, hostIp]) => `${hostIp} ${hostName}`).join("\n"),
  );

  const blockedHosts = (await _getBlockedHostNames(staticBlockedHosts)).filter(
    (hostName) => !whitelistedHosts.includes(hostName),
  );

  etcHostTextContent = appendTextBlock(
    etcHostTextContent,
    "Sy Blocked Hosts",
    blockedHosts.map((hostName) => `${ROUTED_BLOCKED_IP} ${hostName}`).join("\n"),
  );

  try {
    log(">> Update host mappings");
    log(">>> Total Home Hosts", HOME_HOST_NAMES.length);
    log(">>> Total Blocked Hosts", blockedHosts.length);

    writeText(targetPath, etcHostTextContent.trim());
    log(">> Done updating etc hosts: ", targetPath);

    if (is_os_window) {
      log(">>> Only Windows run command: ipconfig /flushdns");
    }
  } catch (err) {
    log(">>", "Error : Permission denied (needs to Run as Admin for Windows WSL)", err);
  }
}

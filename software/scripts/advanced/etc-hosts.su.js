// const ROUTED_BLOCKED_IP = "0.0.0.0";

// /**
//  * Fetches blocked hostnames from static and dynamic sources.
//  * On non-Windows, also fetches the ad-blocking hosts list.
//  * @param {string[]} staticBlockedHosts - Manually curated blocked hosts.
//  * @returns {Promise<string[]>} Array of hostnames to block.
//  */
// async function _getBlockedHostNames(staticBlockedHosts) {
//   const hosts = [...staticBlockedHosts];

//   if (!is_os_windows) {
//     const url = `software/metadata/hosts-blocked-ads.config`;
//     try {
//       const dynamicHosts = convertTextToHosts(await readText`${url}`);
//       log(">>> URL fetch for host success", url);
//       log(">>>> Total Hosts Found", dynamicHosts.length);
//       hosts.push(...dynamicHosts);
//     } catch (err) {
//       log(">>> URL fetch for host failed", url, err);
//     }
//   }

//   return [...new Set(hosts.map((s) => s.toLowerCase()))];
// }

// /**
//  * Loads blocked and whitelisted host configs, then updates the system etc hosts file
//  * with home network mappings and blocked hosts.
//  */
// async function doWork() {
//   exitIfNotSudo();

//   const targetPath = getEtcHostsPath();

//   if (!isForceRefreshStale(targetPath)) {
//     log(">> Skipping etc hosts update (not stale)");
//     return;
//   }

//   const staticBlockedHosts = consolidateHosts(await readSet`software/metadata/hosts-blocked-manual.config`);
//   const whitelistedHosts = consolidateHosts(await readSet`software/metadata/hosts-whitelisted.config`);
//   let etcHostTextContent = await readText`${targetPath}`;

//   log(">> Updating ETC Host", targetPath);

//   await backupText(path.join(BASE_HOMEDIR_LINUX, `.ssh/bak.etc_host`), etcHostTextContent);

//   etcHostTextContent = appendTextBlock(
//     etcHostTextContent,
//     "Sy Home Hosts",
//     HOME_HOST_NAMES.map(([hostName, hostIp]) => `${hostIp} ${hostName}`).join("\n"),
//   );

//   const blockedHosts = (await _getBlockedHostNames(staticBlockedHosts)).filter((hostName) => !whitelistedHosts.includes(hostName));

//   etcHostTextContent = appendTextBlock(
//     etcHostTextContent,
//     "Sy Blocked Hosts",
//     blockedHosts.map((hostName) => `${ROUTED_BLOCKED_IP} ${hostName}`).join("\n"),
//   );

//   try {
//     log(">> Update host mappings");
//     log(">>> Total Home Hosts", HOME_HOST_NAMES.length);
//     log(">>> Total Blocked Hosts", blockedHosts.length);

//     await writeText(targetPath, etcHostTextContent.trim());
//     log(">> Done updating etc hosts: ", targetPath);

//     if (is_os_windows) {
//       log(">>> Only Windows run command: ipconfig /flushdns");
//     }
//   } catch (err) {
//     log(">>", "Error : Permission denied (needs to Run as Admin for Windows WSL)", err);
//   }
// }

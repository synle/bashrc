const BLOCKED_HOST_SOURCE_URLS = set`
  https://adaway.org/hosts.txt
  http://winhelp2002.mvps.org/hosts.txt
  https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext
  https://api.github.com/repos/StevenBlack/hosts/contents/hosts
`;

/**
 * Fetches blocked ad hosts from multiple upstream sources, deduplicates and sorts them, then writes the result to a config file.
 */
async function doWork() {
  log(LINE_BREAK_HASH);
  log(">> BLOCKED_HOST_SOURCE_URLS");
  log(LINE_BREAK_HASH);
  for (const url of BLOCKED_HOST_SOURCE_URLS) {
    log(">>>", url);
  }
  log(LINE_BREAK_HASH);

  // Generate consolidated whitelist config for consumption
  const whitelistedHosts = consolidateHosts(await readSet`software/metadata/hosts-whitelisted.config`);
  const whitelistBanner = "// Auto-generated from hosts-whitelisted.config — do not edit manually";
  await writeText("./software/metadata/hosts-whitelisted.consolidated.config", whitelistBanner + "\n" + whitelistedHosts.sort().join("\n"));
  log(">> Whitelisted Hosts (consolidated)", whitelistedHosts.length);

  // Generate consolidated manual blocked hosts config for consumption
  const manualBlockedHosts = consolidateHosts(await readSet`software/metadata/hosts-blocked-manual.config`);
  const manualBlockedBanner = "// Auto-generated from hosts-blocked-manual.config — do not edit manually";
  await writeText(
    "./software/metadata/hosts-blocked-manual.consolidated.config",
    manualBlockedBanner + "\n" + manualBlockedHosts.sort().join("\n"),
  );
  log(">> Manual Blocked Hosts (consolidated)", manualBlockedHosts.length);

  const results = await Promise.allSettled(
    BLOCKED_HOST_SOURCE_URLS.map(async (url) => {
      url = url.toLowerCase();
      try {
        const raw = await readText`${url}`;
        const hosts = convertTextToHosts(raw);
        log(">> Fetched Success", url, hosts.length);
        return hosts;
      } catch (err) {
        log("<< Fetched Failed", url);
        return [];
      }
    }),
  );

  const allHosts = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  const dedupedHosts = [...new Set(allHosts)].sort((a, b) => {
    const ha = getRootDomainFrom(a);
    const hb = getRootDomainFrom(b);
    return ha.localeCompare(hb) || a.localeCompare(b);
  });

  log(">> Total Hosts", dedupedHosts.length);

  const targetPath = "./software/metadata/hosts-blocked-ads.config";
  writeTextIfSignificantChange(targetPath, dedupedHosts.join("\n"), 0.25);
}

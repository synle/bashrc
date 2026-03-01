const BLOCKED_HOST_SOURCE_URLS = convertTextToList(`
  https://adaway.org/hosts.txt
  http://winhelp2002.mvps.org/hosts.txt
  https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext
  https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts
`);

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

  const results = await Promise.allSettled(
    BLOCKED_HOST_SOURCE_URLS.map(async (url) => {
      url = url.toLowerCase();
      try {
        const raw = await fetchUrlAsString(url);
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

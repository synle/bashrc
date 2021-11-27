async function doWork() {
  const targetPath = process.env.HOST_CONFIG_FILE || './software/metadata/ip-address.config';

  const hostMappingApiResponse = await readText(targetPath);

  const HOST_SPLIT_REGEX = /[\:,|]/gi;
  const UNWANTED_KEYWORDS = ['NO_SSH', 'OSX_REMOTE', 'WINDOWS_REMOTE'];

  const HOSTNAMES_GROUPED_BY_ID = hostMappingApiResponse
    .split('\n')
    .filter((s) => !!s.trim() && s.indexOf('=') !== 0)
    .map((s) => {
      let [hostIp, ...hostNames] = s
        .split(HOST_SPLIT_REGEX)
        .map((s) => s.trim())
        .filter((s) => s);

      // filter out unwanted
      hostNames = hostNames.filter((s) => UNWANTED_KEYWORDS.indexOf(s) === -1);

      return `${hostIp}\n${hostNames.join('\n')}\n`;
    })
    .join('\n');

  const HOSTNAMES_MAPPINGS = hostMappingApiResponse
    .split('\n')
    .filter((s) => !!s.trim() && s.indexOf('=') !== 0)
    .map((s) => {
      let [hostIp, ...hostNames] = s
        .split(HOST_SPLIT_REGEX)
        .map((s) => s.trim())
        .filter((s) => s);

      // filter out unwanted
      hostNames = hostNames.filter((s) => UNWANTED_KEYWORDS.indexOf(s) === -1);

      return hostNames.map((hostName) => `${hostIp} ${hostName}`).join('\n');
    })
    .join('\n');

  const HOSTNAMES_FLATTENED = hostMappingApiResponse
    .split('\n')
    .filter((s) => !!s.trim() && s.indexOf('=') !== 0)
    .reduce((res, s) => {
      let [hostIp, ...hostNames] = s
        .split(HOST_SPLIT_REGEX)
        .map((s) => s.trim())
        .filter((s) => s);

      // filter out unwanted
      const NO_SSH = hostNames.some((s) => s === 'NO_SSH');
      const OSX_REMOTE = hostNames.some((s) => s === 'OSX_REMOTE');
      const WINDOWS_REMOTE = hostNames.some((s) => s === 'WINDOWS_REMOTE');
      hostNames = hostNames.filter((s) => UNWANTED_KEYWORDS.indexOf(s) === -1);

      hostNames.forEach((hostName) =>
        res.push([
          hostName,
          hostIp,
          {
            NO_SSH,
            OSX_REMOTE,
            WINDOWS_REMOTE,
          },
        ]),
      );
      return res;
    }, []);

  writeText(targetPath + '.hostnamesGroupedByID', HOSTNAMES_GROUPED_BY_ID);
  writeText(targetPath + '.hostnamesFlattened', JSON.stringify(HOSTNAMES_FLATTENED, null, 2));
  writeText(targetPath + '.etcHostnamesMappings', HOSTNAMES_MAPPINGS);
}

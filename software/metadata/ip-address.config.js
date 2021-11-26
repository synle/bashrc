async function doWork() {
  const targetPath = process.env.HOST_CONFIG_FILE || './software/metadata/ip-address.config';

  const hostMappingApiResponse = await readText(targetPath);

  const HOSTNAMES_GROUPED_BY_ID = hostMappingApiResponse
    .split('\n')
    .filter((s) => !!s.trim() && s.indexOf('=') !== 0)
    .map((s) => {
      const [hostIp, ...hostNames] = s
        .split(/[\:,]/gi)
        .map((s) => s.trim())
        .filter((s) => s);
      return `${hostIp}\n${hostNames.join('\n')}\n`;
    })
    .join('\n');

  const HOSTNAMES_MAPPINGS = hostMappingApiResponse
    .split('\n')
    .filter((s) => !!s.trim() && s.indexOf('=') !== 0)
    .map((s) => {
      const [hostIp, ...hostNames] = s
        .split(/[\:,]/gi)
        .map((s) => s.trim())
        .filter((s) => s);
      return hostNames.map((hostName) => `${hostIp} ${hostName}`).join('\n');
    })
    .join('\n');

  const HOSTNAMES_FLATTENED = hostMappingApiResponse
    .split('\n')
    .filter((s) => !!s.trim() && s.indexOf('=') !== 0)
    .reduce((res, s) => {
      const [hostIp, ...hostNames] = s
        .split(/[\:,]/gi)
        .map((s) => s.trim())
        .filter((s) => s);
      hostNames.forEach((hostName) => res.push([hostName, hostIp]));
      return res;
    }, []);

  writeText(targetPath + '.hostnamesGroupedByID', HOSTNAMES_GROUPED_BY_ID);
  writeText(targetPath + '.hostnamesFlattened', JSON.stringify(HOSTNAMES_FLATTENED, null, 2));
  writeText(targetPath + '.etcHostnamesMappings', HOSTNAMES_MAPPINGS);
}

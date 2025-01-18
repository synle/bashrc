let BLOCKED_HOST_SOURCE_URLS;

async function doInit() {
  BLOCKED_HOST_SOURCE_URLS = convertTextToList(`
    https://adaway.org/hosts.txt
    http://winhelp2002.mvps.org/hosts.txt
    https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext
    https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts
  `);

  BLOCKED_HOST_SOURCE_URLS = []; // TODO: this call is expensive, let's remove it
}

async function doWork() {
  let h;
  let res = [];

  console.log(
    `
${''.padStart(90, '=')}
>> BLOCKED_HOST_SOURCE_URLS
${''.padStart(90, '=')}
${BLOCKED_HOST_SOURCE_URLS.join('\n')}
${''.padStart(90, '=')}
`,
  );

  // don't block it
  const promises = [];

  for (let url of BLOCKED_HOST_SOURCE_URLS) {
    url = url.toLowerCase();

    promises.push(
      new Promise(async (resolve) => {
        try {
          h = await fetchUrlAsString(url);
          h = convertTextToHosts(h);
          console.log('Fetched Success', url, h.length);
          res = res.concat(h);
        } catch (err) {
          console.log('Fetched Failed', url);
        }
        resolve();
      }),
    );
  }

  await Promise.allSettled(promises);

  res = [...new Set(res)].sort((a, b) => {
    const ha = getRootDomainFrom(a);
    const hb = getRootDomainFrom(b);

    if (ha > hb) {
      return 1;
    }

    if (ha < hb) {
      return -1;
    }

    if (ha === hb) {
      if (a > b) {
        return 1;
      }

      if (a < b) {
        return -1;
      }

      if (a === b) {
        return 0;
      }
    }
  });

  console.log('Total Hosts', res.length);

  const targetPath = './software/metadata/hosts-blocked-ads.config';

  console.log('Update the hosts', targetPath);
  writeText(targetPath, res.join('\n'));
}

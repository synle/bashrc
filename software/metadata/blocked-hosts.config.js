async function doWork() {
  let h;
  let res = [];

  const urls = convertTextToList(`
    https://adaway.org/hosts.txt
    http://winhelp2002.mvps.org/hosts.txt
    https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext
  `);

  console.log(urls);

  // don't block it
  const promises = [];

  for (const url of urls) {
    promises.push(
      new Promise(async (resolve) => {
        try {
          h = await fetchUrlAsString(url);
          h = convertTextToHosts(h);
          console.log("Fetched Success", url, h.length);
          res = res.concat(h);
        } catch (err) {
          console.log("Fetched Failed", url);
        }
        resolve();
      })
    );
  }

  await Promise.allSettled(promises);

  res = [...new Set(res)].sort();

  console.log("Total Hosts", res.length);

  const targetPath = "./software/metadata/blocked-hosts.config";

  console.log("Update the hosts", targetPath);
  writeText(targetPath, res.join("\n"));
}

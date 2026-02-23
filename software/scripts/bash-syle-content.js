/// <reference path="../base-node-script.js" />


async function doWork() {
  console.log('  >> Setting up .bash_syle');

  let res = readText(BASE_BASH_SYLE);
  res += `\n\n\n`;

  let contentProfileCore = await fetchUrlAsString(`bootstrap/profile-core.sh`);
  let contentProfileAdvanced = await fetchUrlAsString(`bootstrap/profile-advanced.sh`);

  // add the header
  contentProfileCore = `
##########################################################
## begin core profile
##########################################################

${contentProfileCore}

##########################################################
## end core profile
##########################################################
  `.trim();

  contentProfileAdvanced = `
##########################################################
## begin advanced profile
##########################################################

${contentProfileAdvanced}

##########################################################
## end advanced profile
##########################################################
  `.trim();

  // core profile
  console.log('    >> Core profile');
  res += contentProfileCore.trim();

  // append advanced profile only for fancier OS
  console.log('    >> Advanced profile');

  if (is_os_window || is_os_darwin_mac || is_os_ubuntu) {
    console.log('      >> Installed only for more advanced OS');
    res += contentProfileAdvanced.trim();
  } else {
    console.log(consoleLogColor1('      >> Skipped : Only Mac or Windows'));
  }

  // remove double new lines
  res = cleanupExtraWhitespaces(res);

  writeText(BASE_BASH_SYLE, res);
}
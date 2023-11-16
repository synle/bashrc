async function doWork() {
  console.log('  >> Setting up .bash_syle');

  let res = readText(BASE_BASH_SYLE);
  res += `\n\n\n`;

  let contentBashProfileBarebone = await fetchUrlAsString(`bash-profile-barebone.sh`);
  let contentBashProfileAdvanced = await fetchUrlAsString(`bash-profile-more-advanced.sh`);

  // add the header
  contentBashProfileBarebone = `
##########################################################
## begin barebone profile
##########################################################

${contentBashProfileBarebone}

##########################################################
## end barebone profile
##########################################################
  `.trim();

  contentBashProfileAdvanced= `
##########################################################
## begin advanced profile
##########################################################

${contentBashProfileAdvanced}

##########################################################
## begin advanced profile
##########################################################
  `.trim()

  // barebone script
  console.log('    >> Barebone profile');
  res += contentBashProfileBarebone.trim();

  // append more advanced script only for fancier OS
  console.log('    >> More advanced profile');

  if (is_os_window || is_os_darwin_mac || is_os_ubuntu) {
    console.log('      >> Installed only for more advanced OS');
    res += contentBashProfileAdvanced.trim();
  } else {
    console.log(consoleLogColor1('      >> Skipped : Only Mac or Windows'));
  }

  // remove double new lines
  res = cleanupExtraWhitespaces(res);

  writeText(BASE_BASH_SYLE, res);
}

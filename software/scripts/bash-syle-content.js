async function doWork() {
  console.log("  >> Setting up .bash_syle");

  let res = readText(BASE_BASH_SYLE);

  const contentBaseBashScript = await fetchUrlAsString(
    "https://raw.githubusercontent.com/synle/bashrc/master/bash-profile-barebone.sh"
  );

  const contentCommonAliasScript = await fetchUrlAsString(
    "https://raw.githubusercontent.com/synle/bashrc/master/bash-profile-more-advanced.sh"
  );

  res += `\n\n\n`;

  // barebone script
  console.log("    >> Barebone profile");
  res += `
##########################################################
## barebone profile
##########################################################

${contentBaseBashScript}
  `.trim();

  // append more advanced script only for fancier OS
  console.log("    >> More advanced profile");
  if (is_os_window || is_os_darwin_mac) {
    console.log("      >> Installed only for more advanced OS");

    res += `
##########################################################
## more advanced profile
##########################################################

${contentCommonAliasScript}
  `.trim();
  } else {
    console.log(consoleLogColor1("      >> Skipped : Only Mac or Windows"));
  }

  // remove double new lines
  res = cleanupExtraWhitespaces(res);

  writeText(BASE_BASH_SYLE, res);
}

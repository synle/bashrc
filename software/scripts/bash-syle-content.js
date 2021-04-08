async function doWork() {
  console.log("  >> Setting up .bash_syle");

  let res = readText(BASE_BASH_SYLE);

  const contentBaseBashScript = await fetchUrlAsString(
    "https://raw.githubusercontent.com/synle/bashrc/master/base-bash-script.sh"
  );

  const contentCommonAliasScript = await fetchUrlAsString(
    "https://raw.githubusercontent.com/synle/bashrc/master/common-alias.sh"
  );

  res += `\n\n\n`;

  // barebone script
  console.log("    >> barebone profile");
  res += `
##########################################################
## barebone profile
##########################################################

${contentBaseBashScript}
  `.trim();

  // append more advanced script only for fancier OS
  console.log("    >> more advanced profile");
  if (is_os_window || is_os_darwin_mac) {
    console.log("      >> installed only for more advanced OS");

    res += `
##########################################################
## more advanced profile
##########################################################

${contentCommonAliasScript}
  `.trim();
  } else {
    console.log("      >> skipped");
  }

  // remove double new lines
  res = cleanupExtraWhitespaces(res);

  writeText(BASE_BASH_SYLE, res);
}

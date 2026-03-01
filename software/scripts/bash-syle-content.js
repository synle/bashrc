/** * Assembles the .bash_syle file by combining core and advanced shell profile content. */
async function doWork() {
  log(">> Setting up .bash_syle");

  let res = readText(BASH_SYLE_PATH);
  res += `\n\n\n`;

  let contentProfileCore = await fetchUrlAsString(`bootstrap/profile-core.sh`);
  let contentProfileAdvanced = await fetchUrlAsString(`bootstrap/profile-advanced.sh`);

  // add the header
  contentProfileCore = `
################################################################################
# ---- begin core profile ----
################################################################################

${contentProfileCore}

################################################################################
# ---- end core profile ----
################################################################################
  `.trim();

  contentProfileAdvanced = `
################################################################################
# ---- begin advanced profile ----
################################################################################

${contentProfileAdvanced}

################################################################################
# ---- end advanced profile ----
################################################################################
  `.trim();

  // core profile
  log(">>> Core profile");
  res += contentProfileCore.trim();

  // append advanced profile only for fancier OS
  log(">>> Advanced profile");

  if (IS_LIGHT_WEIGHT_MODE) {
    log(">>>> Skipped : Lightweight mode");
  } else if (is_os_window || is_os_mac || is_os_ubuntu) {
    log(">>>> Installed only for more advanced OS");
    res += contentProfileAdvanced.trim();
  } else {
    log(">>>> Skipped : Only Mac or Windows");
  }

  // remove double new lines
  res = cleanupExtraWhitespaces(res);

  writeText(BASH_SYLE_PATH, res);
}

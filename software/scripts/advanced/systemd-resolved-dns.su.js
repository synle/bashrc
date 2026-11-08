/** Bootstrap systemd-resolved once with default DNS or aggressive family filters on SteamOS/WSL, then restart the resolver service. */

/** Existing systemd-resolved configuration; absent files are never created. @type {string} */
const RESOLVED_DNS_CONFIG_PATH = "/etc/systemd/resolved.conf";
/** Stable marker shared with the original Cloudflare-only bootstrap. @type {string} */
const RESOLVED_DNS_BOOTSTRAP_MARKER = "# Sy Bootstrap DNS Cloudflare DNS with Family Filter";
/** Default resolvers; Quad9 provides threat blocking plus ECS, not family filtering. @type {string} */
const DNS_GROUP_DEFAULT = `[Resolve]
# Primary: Quad9 (Malware & Phishing Threat Blocking + ECS; no family content filter)
DNS=9.9.9.11 149.112.112.11 2620:fe::11

# Fallback: Cloudflare Family Filter (Malware Blocking + Family Safe)
FallbackDNS=1.1.1.3 1.0.0.3 2606:4700:4700::1113 2606:4700:4700::1003`;

/** Aggressive family-filtering resolvers for SteamOS and WSL; DoH names are informational only. @type {string} */
const DNS_GROUP_ADBLOCKING_AGGRESSIVE = `[Resolve]
# Primary: AdGuard Family Protection (Ad/Tracker Blocking + Malware + Family Safe) | DoH: family.adguard-dns.com
DNS=94.140.14.15 94.140.15.16 2a10:50c0::bad1:ff 2a10:50c0::bad2:ff

# Fallback: CleanBrowsing Family Filter (Strict Parental Control + SafeSearch + Malware) | DoH: family-filter-dns.cleanbrowsing.org
FallbackDNS=185.228.168.168 185.228.169.168 2a0d:2a00:1:: 2a0d:2a00:2::`;

/**
 * Select aggressive DNS on SteamOS or WSL without changing runtime state.
 * @returns {boolean} True when either platform flag is enabled.
 */
function _shouldUseAggressiveDNSHosts() {
  return is_os_steamos || is_os_wsl;
}

/**
 * Back up unmarked resolver configuration and apply aggressive DNS on SteamOS/WSL, or default DNS elsewhere.
 * @returns {Promise<void>} Resolves after a skip or successful configuration write and service restart.
 * @throws {ScriptSkipError} When execution lacks root privileges or targets an unsupported OS.
 * @throws {Error} When reading, backing up, writing, or restarting fails, or configuration changes during backup.
 * Side effects: config backups, config replacement, and a bounded systemd-resolved restart; none in dry-run mode.
 * A failed restart leaves the backed-up new config in place; marker-only reruns skip, so recovery requires a manual restart or backup restore.
 */
async function doWork() {
  exitIfNotSudo();
  exitIfUnsupportedOs("is_os_mac", "is_os_android_termux");
  // WSL also sets the Windows flag, but its resolver belongs to the Linux guest.
  if (!is_os_wsl) exitIfUnsupportedOs("is_os_windows");

  if (!pathExists(RESOLVED_DNS_CONFIG_PATH, undefined, "file")) {
    log(">> Skipping systemd-resolved DNS bootstrap: config file is absent", RESOLVED_DNS_CONFIG_PATH);
    return;
  }

  // Raw IO preserves comments and whitespace and fails closed; readText trims and expands SOURCE directives.
  const originalContent = fs.readFileSync(RESOLVED_DNS_CONFIG_PATH, "utf8");
  if (originalContent.includes(RESOLVED_DNS_BOOTSTRAP_MARKER)) {
    log(">> Skipping systemd-resolved DNS bootstrap: Sy marker already present");
    return;
  }
  if (IS_DRY_RUN) {
    log(">> [DryRun] Would back up resolved.conf, comment prior settings, apply DNS, and restart systemd-resolved");
    return;
  }
  if (!hasBinary("systemctl")) {
    throw new Error("systemctl is required to restart systemd-resolved");
  }

  await backupConfigFile(RESOLVED_DNS_CONFIG_PATH);
  if (fs.readFileSync(RESOLVED_DNS_CONFIG_PATH, "utf8") !== originalContent) {
    throw new Error("resolved.conf changed during backup; rerun after other writers finish");
  }

  const commentedContent = originalContent
    .split(/\r?\n/)
    .map((line) => (line.startsWith("#") ? line : `# ${line}`))
    .join("\n");
  /** Selected resolver group; existing marked configurations never reach this assignment. @type {string} */
  const dnsGroup = _shouldUseAggressiveDNSHosts() ? DNS_GROUP_ADBLOCKING_AGGRESSIVE : DNS_GROUP_DEFAULT;
  /** Stable marker plus the selected group, preserving the one-time bootstrap contract. @type {string} */
  const bootstrapBlock = `${RESOLVED_DNS_BOOTSTRAP_MARKER}\n${dnsGroup}`;
  const newContent = originalContent === "" ? bootstrapBlock : `${commentedContent}\n\n${bootstrapBlock}`;
  await writeText(RESOLVED_DNS_CONFIG_PATH, newContent);

  // execBash discards failures; the synchronous helper preserves restart errors and its bounded timeout.
  execBashSync("systemctl restart systemd-resolved");
  log(">> Bootstrapped systemd-resolved DNS and restarted the service", RESOLVED_DNS_CONFIG_PATH);
}

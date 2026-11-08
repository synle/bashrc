/** Bootstrap systemd-resolved with Cloudflare Family DNS and Quad9 fallback once, then restart the resolver service. */

/** Existing systemd-resolved configuration; absent files are never created. @type {string} */
const RESOLVED_DNS_CONFIG_PATH = "/etc/systemd/resolved.conf";
/** Stable marker shared with the original Cloudflare-only bootstrap. @type {string} */
const RESOLVED_DNS_BOOTSTRAP_MARKER = "# Sy Bootstrap DNS Cloudflare DNS with Family Filter";
/** Requested resolver addresses; Quad9 provides threat blocking plus ECS, not family filtering. @type {string} */
const RESOLVED_DNS_BOOTSTRAP_BLOCK = `${RESOLVED_DNS_BOOTSTRAP_MARKER}
[Resolve]
# Primary: Cloudflare Family (Malware + Family Content Filter)
DNS=1.1.1.3 1.0.0.3 2606:4700:4700::1113 2606:4700:4700::1003
# Fallback: Quad9 (Malware blocking + ECS; no family content filter)
FallbackDNS=9.9.9.11 149.112.112.11 2620:fe::11`;

/**
 * Back up unmarked resolver configuration, disable all prior settings, and apply the selected DNS block.
 * @returns {Promise<void>} Resolves after a skip or successful configuration write and service restart.
 * @throws {ScriptSkipError} When execution lacks root privileges or targets an unsupported OS.
 * @throws {Error} When reading, backing up, writing, or restarting fails, or configuration changes during backup.
 * Side effects: config backups, config replacement, and a bounded systemd-resolved restart; none in dry-run mode.
 * A failed restart leaves the backed-up new config in place; marker-only reruns skip, so recovery requires a manual restart or backup restore.
 */
async function doWork() {
  exitIfNotSudo();
  exitIfUnsupportedOs("is_os_mac", "is_os_windows", "is_os_android_termux");

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
  const newContent = originalContent === "" ? RESOLVED_DNS_BOOTSTRAP_BLOCK : `${commentedContent}\n\n${RESOLVED_DNS_BOOTSTRAP_BLOCK}`;
  await writeText(RESOLVED_DNS_CONFIG_PATH, newContent);

  // execBash discards failures; the synchronous helper preserves restart errors and its bounded timeout.
  execBashSync("systemctl restart systemd-resolved");
  log(">> Bootstrapped systemd-resolved DNS and restarted the service", RESOLVED_DNS_CONFIG_PATH);
}

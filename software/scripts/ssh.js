/** Maps IP addresses to non-standard SSH ports. IPs not listed here use DEFAULT_SSH_PORT. */
const sshPortMap = {
  "192.168.1.24": "2222",
  "192.168.1.25": "2222",
  "192.168.1.26": "2222",
};

const DEFAULT_SSH_PORT = "22";

/**
 * Writes the SSH client config file with home network hosts and connection settings.
 */
async function doWork() {
  exitIfLimitedSupportOs();

  const baseSshPath = path.join(BASE_HOMEDIR_LINUX, ".ssh");
  const targetPath = path.join(baseSshPath, "config");

  log("    >> Setting up SSH Client config", colorDim(targetPath));

  await mkdir(baseSshPath);

  await execBash(`touch "${targetPath}" && chmod 600 "${targetPath}"`);

  log("    >> Updating SSH Client Config", colorDim(targetPath));

  let sshConfigTextContent = readText(targetPath);

  // add tweaks...
  sshConfigTextContent = appendTextBlock(
    sshConfigTextContent,
    "SY CUSTOM CONFIG - All Hosts", // key
    trimLeftSpaces(`
      Host *
        # --- CONNECTION MULTIPLEXING (The Speed King) ---
        ControlMaster auto
        ControlPath ~/.ssh/sockets/%r@%h-%p
        ControlPersist 30m

        # --- PACKET & TIMEOUT MANAGEMENT ---
        ServerAliveInterval 60
        ServerAliveCountMax 3
        Compression no # Performance Tip: Disable compression on fast networks
        TCPKeepAlive no # Disable OS-level heartbeats to prevent accidental drops on Wi-Fi

        # --- IDENTITY & SECURITY ---
        User ${process.env.USER || "syle"}
        IdentityFile ~/.ssh/id_rsa
        ForwardAgent yes
        IdentitiesOnly yes # Prevent the client from trying every key in your agent

        # --- LATENCY REDUCTION ---
        CheckHostIP no # Skip DNS lookups on the client side
        AddressFamily inet # Faster connection for modern systems
    `),
  );

  const sshConnections = HOME_HOST_NAMES.filter(([hostName, hostIp, { NO_SSH, OSX_REMOTE, WINDOWS_REMOTE }]) => NO_SSH !== true);

  sshConfigTextContent = appendTextBlock(
    sshConfigTextContent,
    "SY CUSTOM CONFIG - Home Network Hosts", // key
    sshConnections
      .map(([hostName, hostIp]) =>
        trimLeftSpaces(`
          Host ${hostName}
            HostName ${hostIp}
            Port ${sshPortMap[hostIp] || DEFAULT_SSH_PORT}
        `),
      )
      .join("\n"),
  );

  sshConfigTextContent = sshConfigTextContent.trim();

  // write if there are change
  log(sshConnections.map(([hostName, hostIp]) => `      >> ${hostIp} ${hostName}`).join("\n"));

  // write to build file
  writeToBuildFile([{ file: "ssh-config", data: sshConfigTextContent }]);

  // make a backup
  backupText(path.join(BASE_HOMEDIR_LINUX, ".ssh", "bak.config"), sshConfigTextContent);

  writeText(targetPath, sshConfigTextContent);
}

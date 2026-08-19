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
  const baseSshPath = path.join(BASE_HOMEDIR_LINUX, ".ssh");
  const targetPath = path.join(baseSshPath, "config");

  log(">>> Setting up SSH Client config", targetPath);

  await execBash(`touch "${targetPath}"`);

  log(">>> Updating SSH Client Config", targetPath);

  let sshConfigTextContent = await readText`${targetPath}`;

  // add tweaks...
  sshConfigTextContent = appendTextBlock(
    sshConfigTextContent,
    "SY CUSTOM CONFIG - All Hosts", // key
    code`
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
        # Deliberately no "IdentitiesOnly yes" here: it makes ssh ignore every identity
        # the agent offers, which breaks any host authenticating with a short-lived
        # certificate, since those live only in the agent and never as a file on disk.
        User ${REPO_USER_NAME}
        IdentityFile ~/.ssh/id_rsa
        ForwardAgent yes

        # --- LATENCY REDUCTION ---
        CheckHostIP no # Skip DNS lookups on the client side
        AddressFamily inet # Faster connection for modern systems
    `,
  );

  const sshConnections = HOME_HOST_NAMES.filter(([hostName, hostIp, { NO_SSH, OSX_REMOTE, WINDOWS_REMOTE }]) => NO_SSH !== true);

  sshConfigTextContent = appendTextBlock(
    sshConfigTextContent,
    "SY CUSTOM CONFIG - Home Network Hosts", // key
    sshConnections
      .map(
        ([hostName, hostIp]) =>
          code`
          Host ${hostName}
            HostName ${hostIp}
            Port ${sshPortMap[hostIp] || DEFAULT_SSH_PORT}
        `,
      )
      .join("\n"),
  );

  sshConfigTextContent = sshConfigTextContent.trim();

  // write if there are change
  log(sshConnections.map(([hostName, hostIp]) => `>>>> ${hostIp} ${hostName}`).join("\n"));

  // write to build file
  await writeBuildArtifact([{ file: `${BUILD_DIR}/ssh-config`, data: sshConfigTextContent }]);

  // make a backup
  const backupPath = path.join(baseSshPath, "bak.config");
  await backupText(backupPath, sshConfigTextContent);

  await writeText(targetPath, sshConfigTextContent);

  // writeText writes to a tmp file and renames over the target, so the new inode
  // carries the umask default (0644) rather than the 0600 the config had before.
  // These files list every host reachable from this machine, so re-tighten them.
  await execBash(`chmod 600 "$targetPath" "$backupPath" 2>/dev/null || true`);
}

async function doWork() {
  console.log("  >> Setting up SSH Configs");

  const baseSshPath = path.join(BASE_HOMEDIR_LINUX, ".ssh");
  const targetPath = path.join(baseSshPath, "config");

  console.log("    >> Setting up SSH Client config", targetPath);

  await mkdir(baseSshPath);

  await execBashSilent(`touch ${targetPath} && chmod 611 ${targetPath}`);

  console.log("    >> Updating SSH Client Config", targetPath);

  let sshConfigTextContent = readText(targetPath);

  // make a backup
  writeText(
    path.join(BASE_HOMEDIR_LINUX, `.ssh/config.backup.${Date.now()}`),
    sshConfigTextContent
  );

  // add tweaks...
  sshConfigTextContent = appendTextBlock(
    sshConfigTextContent,
    "SY CUSTOM CONFIG - All Hosts", // key
    `
Host *
  # reuse connection
  ControlMaster auto
  ControlPath /tmp/%r@%h:%p
  ControlPersist 20m
  # forward agent
  ForwardAgent yes
  # identity
  User syle
  IdentityFile ~/.ssh/id_rsa
  `
  );

  sshConfigTextContent = appendTextBlock(
    sshConfigTextContent,
    "SY CUSTOM CONFIG - Home Network Hosts", // key
    HOME_HOST_NAMES.map(([hostName, hostIp]) =>
      `
Host ${hostName}
  HostName ${hostIp}
      `.trim()
    ).join("\n")
  );

  // write if there are change
  console.log(
    HOME_HOST_NAMES.map(
      ([hostName, hostIp]) => `      >> ${hostIp} ${hostName}`
    ).join("\n")
  );

  writeText(targetPath, sshConfigTextContent.trim());
}

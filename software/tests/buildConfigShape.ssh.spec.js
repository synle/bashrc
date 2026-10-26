import { describe, expect, it } from "vitest";

import { readBuildText, warnIfBuildArtifactMissing } from "./buildConfigShape.helpers.js";

/** Selects shared SSH directives while excluding generated private host blocks.
 * @type {RegExp}
 */
const SHARED_SSH_DIRECTIVE =
  /^\s*(?:ControlMaster|ControlPath|ControlPersist|ServerAliveInterval|ServerAliveCountMax|Compression|TCPKeepAlive|IdentityFile|ForwardAgent|StrictHostKeyChecking|UpdateHostKeys|AddKeysToAgent|IgnoreUnknown|UseKeychain|CheckHostIP|AddressFamily)\s/;

describe(".build/ssh-config", () => {
  it("keeps shared connection settings without snapshotting private hosts", () => {
    const filename = "ssh-config";
    if (warnIfBuildArtifactMissing(filename)) return;

    const config = readBuildText(filename);
    const sharedSettings = config
      .split(/\r?\n/)
      .filter((line) => SHARED_SSH_DIRECTIVE.test(line))
      .map((line) => line.trim());

    expect(config).toContain("Host *");
    expect(sharedSettings).toMatchInlineSnapshot(`
      [
        "ControlMaster auto",
        "ControlPath ~/.ssh/sockets/%C",
        "ControlPersist 30m",
        "ServerAliveInterval 60",
        "ServerAliveCountMax 3",
        "Compression no # Performance Tip: Disable compression on fast networks",
        "TCPKeepAlive no # Disable OS-level heartbeats to prevent accidental drops on Wi-Fi",
        "IdentityFile ~/.ssh/id_rsa",
        "ForwardAgent yes",
        "StrictHostKeyChecking accept-new",
        "UpdateHostKeys yes",
        "AddKeysToAgent yes",
        "IgnoreUnknown UseKeychain",
        "UseKeychain yes",
        "CheckHostIP no # Skip DNS lookups on the client side",
        "AddressFamily inet # Faster connection for modern systems",
      ]
    `);
  });
});

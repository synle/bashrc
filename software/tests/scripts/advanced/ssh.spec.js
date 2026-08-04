/** doWork tests for software/scripts/advanced/ssh.js. */
import { describe, it, expect } from "vitest";
import { fileSystem, runScript, getIndexConstant } from "../../setup.js";

const BASE_HOMEDIR_LINUX = getIndexConstant("BASE_HOMEDIR_LINUX");
const BUILD_DIR = getIndexConstant("BUILD_DIR");

describe("advanced/ssh.js doWork", () => {
  it("should write SSH config with connection multiplexing", async () => {
    await runScript("software/scripts/advanced/ssh.js");

    const sshConfig = fileSystem[`${BASE_HOMEDIR_LINUX}/.ssh/config`];
    expect(sshConfig).toBeDefined();
    expect(sshConfig).toContain("ControlMaster");
    expect(sshConfig).toContain("ServerAliveInterval");
  });

  it("should include All Hosts custom config block", async () => {
    await runScript("software/scripts/advanced/ssh.js");

    const sshConfig = fileSystem[`${BASE_HOMEDIR_LINUX}/.ssh/config`];
    expect(sshConfig).toContain("SY CUSTOM CONFIG - All Hosts");
  });

  it("should include Home Network Hosts block", async () => {
    await runScript("software/scripts/advanced/ssh.js");

    const sshConfig = fileSystem[`${BASE_HOMEDIR_LINUX}/.ssh/config`];
    expect(sshConfig).toContain("SY CUSTOM CONFIG - Home Network Hosts");
  });

  it("should preserve existing SSH config content", async () => {
    fileSystem[`${BASE_HOMEDIR_LINUX}/.ssh/config`] = "Host existing-server\n  HostName 10.0.0.1";

    await runScript("software/scripts/advanced/ssh.js");

    const sshConfig = fileSystem[`${BASE_HOMEDIR_LINUX}/.ssh/config`];
    expect(sshConfig).toContain("Host existing-server");
    expect(sshConfig).toContain("ControlMaster");
  });

  it("should include identity file references", async () => {
    await runScript("software/scripts/advanced/ssh.js");

    const sshConfig = fileSystem[`${BASE_HOMEDIR_LINUX}/.ssh/config`];
    expect(sshConfig).toContain("IdentityFile");
  });
});

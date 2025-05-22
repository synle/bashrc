/** doWork tests for software/scripts/terminator.js. */
import { describe, it, expect } from "vitest";
import { fileSystem, runScript, getIndexConstant, setSandboxGlobal } from "../setup.js";

const BASE_HOMEDIR_LINUX = getIndexConstant("BASE_HOMEDIR_LINUX");
const BUILD_DIR = getIndexConstant("BUILD_DIR");

describe("terminator.js doWork", () => {
  it("should write terminator config on non-mac, non-windows, non-arch linux", async () => {
    setSandboxGlobal("is_os_windows", false);
    setSandboxGlobal("is_os_mac", false);
    setSandboxGlobal("is_os_arch_linux", false);

    await runScript("software/scripts/terminator.js");

    const config = fileSystem[`${BASE_HOMEDIR_LINUX}/.config/terminator/config`];
    expect(config).toBeDefined();
    expect(config).toContain("[global_config]");
    expect(config).toContain("[keybindings]");
    expect(config).toContain("[profiles]");
  });

  it("should include Dracula color theme", async () => {
    setSandboxGlobal("is_os_windows", false);
    setSandboxGlobal("is_os_mac", false);
    setSandboxGlobal("is_os_arch_linux", false);

    await runScript("software/scripts/terminator.js");

    const config = fileSystem[`${BASE_HOMEDIR_LINUX}/.config/terminator/config`];
    expect(config).toContain("#282a36");
  });

  it("should include keybindings for zoom, tabs, and splits", async () => {
    setSandboxGlobal("is_os_windows", false);
    setSandboxGlobal("is_os_mac", false);
    setSandboxGlobal("is_os_arch_linux", false);

    await runScript("software/scripts/terminator.js");

    const config = fileSystem[`${BASE_HOMEDIR_LINUX}/.config/terminator/config`];
    expect(config).toContain("zoom_in");
    expect(config).toContain("new_tab");
    expect(config).toContain("split_horiz");
    expect(config).toContain("split_vert");
  });

  it("should include font configuration", async () => {
    setSandboxGlobal("is_os_windows", false);
    setSandboxGlobal("is_os_mac", false);
    setSandboxGlobal("is_os_arch_linux", false);

    await runScript("software/scripts/terminator.js");

    const config = fileSystem[`${BASE_HOMEDIR_LINUX}/.config/terminator/config`];
    expect(config).toContain("font =");
  });
});

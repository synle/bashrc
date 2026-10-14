/** Windows Terminal profile visibility and ordering tests. */
import { describe, it, expect } from "vitest";
import { getIndexFunction, loadScriptHelpers } from "./setup.js";

loadScriptHelpers("software/scripts/windows-terminal.js");
const prioritizeProfiles = getIndexFunction("_prioritizeWindowsTerminalProfiles");

describe("Windows Terminal profile ordering", () => {
  it("shows all WSL distributions and PowerShell before hiding other profiles", () => {
    const profiles = prioritizeProfiles([
      { name: "Command Prompt", guid: "cmd" },
      { name: "PowerShell", guid: "ps" },
      { name: "Kali Linux", guid: "kali", source: "Windows.Terminal.Wsl" },
      { name: "Debian", guid: "debian" },
      { name: "Ubuntu", guid: "ubuntu" },
    ]);

    expect(profiles.map(({ name, hidden }) => [name, hidden])).toEqual([
      ["Debian", false],
      ["Ubuntu", false],
      ["Kali Linux", false],
      ["PowerShell", false],
      ["Command Prompt", true],
    ]);
  });

  it("keeps every profile visible when no WSL distribution exists", () => {
    const profiles = prioritizeProfiles([{ name: "Command Prompt", guid: "cmd" }]);

    expect(profiles.map(({ name, hidden }) => [name, hidden])).toEqual([["Command Prompt", false]]);
  });
});

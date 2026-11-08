/** Snapshot every executable variant with its profile identity while preserving profile order. */
import { describe, expect, it } from "vitest";
import { configureTerminal, generateSettings } from "./windowsTerminal.helpers.js";

describe("Windows Terminal launch identities", () => {
  it("keeps names and commandlines together for every managed executable discovery path", async () => {
    const results = [];
    for (const [binaries, executable] of [
      [["pwsh"], null],
      [["pwsh.exe"], null],
      [[], "/mnt/c/Program Files/PowerShell/7/pwsh.exe"],
    ]) {
      const settings = await generateSettings(
        { profiles: { list: [{ name: "Windows PowerShell", guid: "ps", commandline: "pwsh" }] } },
        binaries,
        executable,
      );
      results.push(settings.profiles.list.map(({ name, commandline }) => ({ name, commandline })));
    }
    expect(results).toMatchInlineSnapshot(`
      [
        [
          {
            "commandline": "pwsh",
            "name": "Powershell v7",
          },
          {
            "commandline": "powershell.exe",
            "name": "Powershell v5",
          },
        ],
        [
          {
            "commandline": "pwsh.exe",
            "name": "Powershell v7",
          },
          {
            "commandline": "powershell.exe",
            "name": "Powershell v5",
          },
        ],
        [
          {
            "commandline": ""C:\\Program Files\\PowerShell\\7\\pwsh.exe" -NoLogo",
            "name": "Powershell v7",
          },
          {
            "commandline": "powershell.exe",
            "name": "Powershell v5",
          },
        ],
      ]
    `);
  });

  it("keeps names and commandlines together for both discovered PowerShell installation locations", async () => {
    const results = [];
    for (const executable of [
      "/mnt/c/Program Files/PowerShell/7/pwsh.exe",
      "/mnt/c/Users/Test User/AppData/Local/Microsoft/WindowsApps/pwsh.exe",
    ]) {
      const { settings } = await configureTerminal([{ guid: "legacy", name: "Windows PowerShell", commandline: "powershell.exe" }], {
        findPathFromList: () => executable,
      });
      results.push(settings.profiles.list.map(({ name, commandline }) => ({ name, commandline })));
    }
    expect(results).toMatchInlineSnapshot(`
      [
        [
          {
            "commandline": ""C:\\Program Files\\PowerShell\\7\\pwsh.exe" -NoLogo",
            "name": "Powershell v7",
          },
          {
            "commandline": "powershell.exe",
            "name": "Powershell v5",
          },
        ],
        [
          {
            "commandline": ""C:\\Users\\Test User\\AppData\\Local\\Microsoft\\WindowsApps\\pwsh.exe" -NoLogo",
            "name": "Powershell v7",
          },
          {
            "commandline": "powershell.exe",
            "name": "Powershell v5",
          },
        ],
      ]
    `);
  });
});

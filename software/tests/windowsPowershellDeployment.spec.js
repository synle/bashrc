/** Regression tests for modern Windows shell selection and profile/prompt deployment. */
import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import { WINDOWS_HOME, configureTerminal, loadInstaller } from "./windowsTerminal.helpers.js";

describe("PowerShell 7 Terminal launch", () => {
  it.each([
    ["/mnt/c/Program Files/PowerShell/7/pwsh.exe", '"C:\\Program Files\\PowerShell\\7\\pwsh.exe" -NoLogo'],
    [
      "/mnt/c/Users/Test User/AppData/Local/Microsoft/WindowsApps/pwsh.exe",
      '"C:\\Users\\Test User\\AppData\\Local\\Microsoft\\WindowsApps\\pwsh.exe" -NoLogo',
    ],
  ])("quotes discovered executable %s in a separate modern profile", async (executable, commandline) => {
    const { settings } = await configureTerminal([{ guid: "legacy", name: "Windows PowerShell", commandline: "powershell.exe" }], {
      findPathFromList: () => executable,
    });
    const modern = settings.profiles.list.find((profile) => profile.commandline?.includes("pwsh.exe"));
    expect(modern).toBeDefined();
    expect(modern.guid).toBe("{91c9f255-5190-4a5e-9ee5-d05d36dece87}");
    expect(modern.name).toBe("Powershell v7");
    expect(modern.colorScheme).toEqual({ dark: "Campbell", light: "One Half Light" });
    expect(modern.startingDirectory).toBe("%USERPROFILE%");
    expect(modern.commandline).toBe(commandline);
    expect(modern.commandline).not.toContain("Set-Location");
    expect(modern.hidden).toBe(false);
    expect(settings.defaultProfile).toBe(modern.guid);
    expect(settings.profiles.list).toHaveLength(2);
    expect(settings.profiles.list[1]).toMatchInlineSnapshot(`
      {
        "adjustIndistinguishableColors": "always",
        "antialiasingMode": "cleartype",
        "bellStyle": "all",
        "colorScheme": {
          "dark": "Campbell",
          "light": "One Half Light",
        },
        "commandline": "powershell.exe",
        "cursorShape": "underscore",
        "font": {
          "cellHeight": "1.1",
          "face": undefined,
          "size": 12,
          "weight": "semi-bold",
        },
        "guid": "legacy",
        "hidden": false,
        "historySize": undefined,
        "intenseTextStyle": "bright",
        "name": "Powershell v5",
        "padding": "10, 8, 10, 8",
        "scrollbarState": "visible",
        "showMarksOnScrollbar": true,
        "suppressApplicationTitle": false,
        "tabColor": "#012456",
      }
    `);
  });

  it("uses PATH pwsh when fixed locations are absent", async () => {
    const { settings } = await configureTerminal([{ guid: "legacy", name: "Windows PowerShell" }], {
      hasBinary: (name) => name === "pwsh.exe",
    });
    expect(settings.profiles.list[0].commandline).toBe("pwsh.exe");
  });

  it("retains WSL default and does not duplicate the managed profile on redeploy", async () => {
    const overrides = { findPathFromList: () => "/mnt/c/Program Files/PowerShell/7/pwsh.exe" };
    const first = await configureTerminal([{ guid: "wsl", name: "Ubuntu", source: "Windows.Terminal.Wsl" }], overrides);
    const second = await configureTerminal(first.settings.profiles.list, overrides);
    expect(second.settings.defaultProfile).toBe("wsl");
    expect(second.settings.profiles.list).toEqual(first.settings.profiles.list);
    expect(second.context.backupConfigFile).toHaveBeenCalledOnce();
  });

  it("prefers legacy PowerShell when discovery fails and preserves an unrelated dynamic Core profile", async () => {
    const profiles = [
      { guid: "legacy", name: "Windows PowerShell" },
      { guid: "core", name: "Custom shell", source: "Windows.Terminal.PowershellCore", commandline: "pwsh.exe -NoLogo" },
    ];
    const { settings } = await configureTerminal(profiles);
    expect(settings.defaultProfile).toBe("legacy");
    expect(settings.profiles.list).toHaveLength(2);
    // Managed appearance may add fields without changing this user's shell identity.
    expect(settings.profiles.list[1]).toMatchInlineSnapshot(`
      {
        "adjustIndistinguishableColors": "always",
        "colorScheme": {
          "dark": "Campbell",
          "light": "One Half Light",
        },
        "commandline": "pwsh.exe -NoLogo",
        "font": {
          "cellHeight": "1.1",
          "weight": "semi-bold",
        },
        "guid": "core",
        "hidden": true,
        "name": "Custom shell",
        "scrollbarState": "visible",
        "showMarksOnScrollbar": true,
        "source": "Windows.Terminal.PowershellCore",
        "suppressApplicationTitle": false,
      }
    `);
  });

  it("defaults a renamed quoted pwsh profile to hidden without deleting or duplicating it", async () => {
    const { settings } = await configureTerminal(
      [
        { guid: "legacy", name: "Windows PowerShell" },
        { guid: "core", name: "My shell", commandline: '"C:\\Program Files\\PowerShell\\7\\pwsh.exe" -NoLogo' },
        { guid: "wsl", name: "Kali Linux", source: "Windows.Terminal.Wsl" },
      ],
      { findPathFromList: () => "/mnt/c/Program Files/PowerShell/7/pwsh.exe" },
    );
    expect(settings.profiles.list.map(({ guid, hidden }) => [guid, hidden])).toEqual([
      ["wsl", false],
      ["{91c9f255-5190-4a5e-9ee5-d05d36dece87}", false],
      ["legacy", false],
      ["core", true],
    ]);
  });

  it.each(["powershell", "pwsh", undefined])(
    "uses inbox powershell.exe when modern discovery fails and legacy command was %s",
    async (commandline) => {
      const { settings } = await configureTerminal([{ guid: "legacy", name: "Windows PowerShell", commandline }]);
      expect(settings.profiles.list).toHaveLength(1);
      expect(settings.profiles.list[0].commandline).toBe("powershell.exe");
      expect(settings.defaultProfile).toBe("legacy");
    },
  );

  it("skips local non-Windows installs and emits portable CI artifacts without host shell discovery", async () => {
    const local = loadInstaller("software/scripts/windows-terminal.js", { is_os_windows: false });
    await local.doWork();
    expect(local.writeBuildArtifact).not.toHaveBeenCalled();
    const ci = loadInstaller("software/scripts/windows-terminal.js", { is_os_windows: false, IS_CI: true });
    await ci.doWork();
    expect(ci.writeBuildArtifact).toHaveBeenCalledOnce();
    expect(ci.writeJson).not.toHaveBeenCalled();
    expect(ci.writeBuildArtifact.mock.calls[0][0][0].data.profiles.list).toEqual([]);
  });
});

describe("PowerShell profile deployment", () => {
  it.each([
    [
      "E:\\Documents",
      [
        "/mnt/e/Documents/PowerShell/Microsoft.PowerShell_profile.ps1",
        "/mnt/e/Documents/WindowsPowerShell/Microsoft.PowerShell_profile.ps1",
      ],
    ],
    [
      "C:\\Users\\Test User\\OneDrive\\Documents",
      [
        "/mnt/c/Users/Test User/OneDrive/Documents/PowerShell/Microsoft.PowerShell_profile.ps1",
        "/mnt/c/Users/Test User/OneDrive/Documents/WindowsPowerShell/Microsoft.PowerShell_profile.ps1",
      ],
    ],
  ])("deploys both editions to actual Documents %s", async (documents, expected) => {
    const context = loadInstaller("software/scripts/windows/~cleanup.js", { execBash: vi.fn(async () => `${documents}\r\n`) });
    await context.doWork();
    expect(context.writeText.mock.calls.map(([file]) => file)).toEqual(expected);
    expect(context.backupConfigFile.mock.calls.map(([file]) => file)).toEqual(expected);
    expect(context.writeText.mock.calls[0][1]).toBe(context.writeText.mock.calls[1][1]);
    expect(context.deleteFile).toHaveBeenCalledWith("/working/profile.ps1");
    const command = context.execBash.mock.calls[0][0];
    expect(command).toContain("-NoProfile");
    const encoded = command.match(/-EncodedCommand\s+([A-Za-z0-9+/=]+)/)[1];
    expect(Buffer.from(encoded, "base64").toString("utf16le")).toContain("GetFolderPath('MyDocuments')");
  });

  it.each(["", "%USERPROFILE%\\Documents", "\\\\server\\share\\Documents"])(
    "rejects unresolvable Documents output %j without deleting the working copy",
    async (output) => {
      const context = loadInstaller("software/scripts/windows/~cleanup.js", { execBash: async () => output });
      await expect(context.doWork()).rejects.toThrow("Documents");
      expect(context.writeText).not.toHaveBeenCalled();
      expect(context.deleteFile).not.toHaveBeenCalled();
    },
  );

  it("does not write profiles or delete the working copy when Documents is not mounted", async () => {
    const context = loadInstaller("software/scripts/windows/~cleanup.js", { pathExists: () => false });
    await expect(context.doWork()).rejects.toThrow("Documents folder is not accessible");
    expect(context.writeText.mock.calls).toEqual([]);
    expect(context.mkdir.mock.calls).toEqual([]);
    expect(context.deleteFile.mock.calls).toEqual([]);
  });

  it("builds the profile artifact without Windows discovery during an offline dry-run", async () => {
    const context = loadInstaller("software/scripts/windows/~cleanup.js", { IS_DRY_RUN: true });
    await context.doWork();
    expect(context.writeBuildArtifact.mock.calls[0][0][0].data).toBe("# profile fixture\nWrite-Output 'ready'\n");
    expect(context.execBash.mock.calls).toEqual([]);
    expect(context.writeText.mock.calls).toEqual([]);
    expect(context.deleteFile.mock.calls).toEqual([]);
  });

  it("keeps the working copy when a deployment write fails", async () => {
    const context = loadInstaller("software/scripts/windows/~cleanup.js", {
      writeText: async () => {
        throw new Error("write denied");
      },
    });
    await expect(context.doWork()).rejects.toThrow("write denied");
    expect(context.deleteFile).not.toHaveBeenCalled();
  });
});

describe("Windows Starship configuration", () => {
  it("deploys the same TOML to Linux and Windows homes with backups", async () => {
    const context = loadInstaller("software/scripts/advanced/starship-config.js");
    await context.doWork();
    expect(context.writeText.mock.calls.map(([file]) => file)).toEqual([
      "/home/test/.config/starship.toml",
      `${WINDOWS_HOME}/.config/starship.toml`,
    ]);
    expect(context.backupConfigFile.mock.calls.map(([file]) => file)).toEqual(context.writeText.mock.calls.map(([file]) => file));
    expect(context.writeText.mock.calls[1][1]).toBe(fs.readFileSync("software/scripts/advanced/starship-config.toml", "utf8"));
  });

  it("leaves Windows untouched on non-Windows hosts", async () => {
    const context = loadInstaller("software/scripts/advanced/starship-config.js", { is_os_windows: false });
    await context.doWork();
    expect(context.writeText).toHaveBeenCalledTimes(1);
  });

  it("fails clearly rather than guessing Windows home", async () => {
    const context = loadInstaller("software/scripts/advanced/starship-config.js", { getWindowUserBaseDir: () => undefined });
    await expect(context.doWork()).rejects.toThrow("Windows user home");
    expect(context.writeText).toHaveBeenCalledTimes(1);
  });
});

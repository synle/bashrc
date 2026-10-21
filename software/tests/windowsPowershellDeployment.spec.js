/** Regression tests for modern Windows shell selection and profile/prompt deployment. */
import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";
import os from "os";
import { spawnSync } from "child_process";
import { createRequire } from "module";
import { getIndexFunction } from "./setup.js";

/** Windows home fixture deliberately includes a space. @type {string} */
const WINDOWS_HOME = "/mnt/c/Users/Test User";

/**
 * Load a real installer with isolated side effects and optional Istanbul instrumentation.
 * @param {string} file Repository-relative installer path.
 * @param {object} overrides Boundary replacements for this scenario.
 * @returns {object} VM context exposing the real doWork and recorded effects.
 */
function loadInstaller(file, overrides = {}) {
  const context = {
    path,
    Buffer,
    IS_CI: false,
    IS_DRY_RUN: false,
    is_os_windows: true,
    BASE_HOMEDIR_LINUX: "/home/test",
    BUILD_DIR: "/build",
    POWERSHELL_SYLE_PATH: "/working/profile.ps1",
    EDITOR_CONFIGS: { fontSize: 12 },
    log: vi.fn(),
    shouldInstallCustomTheme: () => false,
    getTheme: () => ({ dark: "Campbell", light: "One Half Light" }),
    json: getIndexFunction("json"),
    code: getIndexFunction("code"),
    getWindowUserBaseDir: () => WINDOWS_HOME,
    getWindowAppDataLocalUserPath: () => `${WINDOWS_HOME}/AppData/Local`,
    toWindowsPath: getIndexFunction("toWindowsPath"),
    findPath: () => `${WINDOWS_HOME}/AppData/Local/Packages/Microsoft.WindowsTerminal_test`,
    findPathFromList: () => null,
    hasBinary: () => false,
    pathExists: () => true,
    exitIfPathNotFound: vi.fn(),
    readJson: async () => [],
    readText: async (strings) =>
      strings[0].includes("starship-config.toml")
        ? fs.readFileSync("software/scripts/advanced/starship-config.toml", "utf8")
        : "# profile fixture\nWrite-Output 'ready'\n",
    execBash: vi.fn(async () => "E:\\Documents\r\n"),
    removeEmptyBlocks: (value) => value,
    cleanupExtraWhitespaces: (value) => value,
    mkdir: vi.fn(),
    backupConfigFile: vi.fn(),
    writeText: vi.fn(),
    writeJson: vi.fn(),
    writeBuildArtifact: vi.fn(),
    registerWithBashSyleProfile: vi.fn(),
    deleteFile: vi.fn(),
    ...overrides,
  };
  let source = fs.readFileSync(file, "utf8");
  if (process.env.BASHRC_TEST_COVERAGE === "1") {
    const { createInstrumenter } = createRequire(import.meta.url)("istanbul-lib-instrument");
    source = createInstrumenter({ coverageVariable: "__VITEST_COVERAGE__", coverageGlobalScope: "globalThis" }).instrumentSync(
      source,
      path.resolve(file),
    );
    context.__VITEST_COVERAGE__ = globalThis.__VITEST_COVERAGE__;
  }
  vm.createContext(context);
  vm.runInContext(source, context, { filename: file });
  return context;
}

/**
 * Run the Terminal installer against realistic existing settings.
 * @param {object[]} profiles Existing Terminal profiles.
 * @param {object} overrides Installer boundary replacements.
 * @returns {Promise<object>} Context and generated settings.
 */
async function configureTerminal(profiles, overrides = {}) {
  const context = loadInstaller("software/scripts/windows-terminal.js", {
    readJson: async (strings) => (strings[0].includes("keys.jsonc") ? [] : { profiles: { list: profiles } }),
    ...overrides,
  });
  await context.doWork();
  return { context, settings: context.writeJson.mock.calls[0]?.[1] };
}

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
    expect(modern.colorScheme).toBe("Campbell");
    expect(modern.startingDirectory).toBe("%USERPROFILE%");
    expect(modern.commandline).toBe(commandline);
    expect(modern.commandline).not.toContain("Set-Location");
    expect(modern.hidden).toBe(false);
    expect(settings.defaultProfile).toBe(modern.guid);
    expect(settings.profiles.list).toHaveLength(2);
    expect(settings.profiles.list[1]).toMatchObject({ guid: "legacy", name: "Powershell v5", commandline: "powershell.exe" });
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
    expect(settings.profiles.list[1]).toEqual({ ...profiles[1], hidden: true });
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

  it("does not invent a modern shell when it is absent", async () => {
    const { settings } = await configureTerminal([{ guid: "legacy", name: "Windows PowerShell" }]);
    expect(settings.profiles.list).toHaveLength(1);
    expect(settings.defaultProfile).toBe("legacy");
  });

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

/** Installed optional consumers; absent tools skip only their integration checks. @type {boolean} */
const hasPwsh = spawnSync("pwsh", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "exit 0"], { timeout: 10000 }).status === 0;
/** Whether the real Starship consumer is available. @type {boolean} */
const hasStarship = spawnSync("starship", ["--version"], { timeout: 10000 }).status === 0;

describe("generated Windows configuration consumers (integration)", () => {
  it.skipIf(!hasPwsh)("parses the finalized shared profile and Documents probe with PowerShell 7", async () => {
    const context = loadInstaller("software/scripts/windows/~cleanup.js", {
      readText: async () =>
        getIndexFunction("resolvePlaceholders")(fs.readFileSync("software/scripts/windows/powershell-profile.ps1.bash", "utf8"), {
          MAX_NESTED_DEPTH: 3,
          IS_WORK_PROFILE: 0,
        }),
    });
    await context.doWork();
    const encodedProbe = context.execBash.mock.calls[0][0].match(/-EncodedCommand\s+([A-Za-z0-9+/=]+)/)[1];
    const source = `${Buffer.from(encodedProbe, "base64").toString("utf16le")}\n${context.writeText.mock.calls[0][1]}`;
    const result = spawnSync(
      "pwsh",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        '$tokens = $null; $errors = $null; [System.Management.Automation.Language.Parser]::ParseInput([Console]::In.ReadToEnd(), [ref]$tokens, [ref]$errors) | Out-Null; if ($errors.Count) { $errors | Out-String | Write-Error; exit 1 }; Write-Output "profile parse OK"',
      ],
      { input: source, encoding: "utf8", timeout: 10000 },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe("profile parse OK");
  });

  it.skipIf(!hasStarship)("renders the Windows-deployed TOML through Starship without scan warnings in an empty folder", async () => {
    const context = loadInstaller("software/scripts/advanced/starship-config.js");
    await context.doWork();
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "windows-starship-test-"));
    try {
      const config = path.join(folder, "starship.toml");
      fs.writeFileSync(config, context.writeText.mock.calls[1][1]);
      const result = spawnSync("starship", ["prompt", "--path", folder], {
        env: {
          ...process.env,
          STARSHIP_CONFIG: config,
          STARSHIP_LOG: "warn",
          STARSHIP_SHORT_PWD: "fixture-folder",
          STARSHIP_BASH_VER: "PS",
        },
        encoding: "utf8",
        timeout: 10000,
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("fixture-folder");
      expect(result.stdout).toContain("PS");
      expect(result.stderr).toBe("");
    } finally {
      fs.rmSync(folder, { recursive: true });
    }
  });
});

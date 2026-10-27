/** Windows setup deployment and Brave shortcut target/flag regression checks. */
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import { fetchResponses, fileSystem, mockFsExistence, runScript, setMockExecSyncReturn, setSandboxGlobal } from "./setup.js";

/** WSL-visible home for the fake Windows user used by deployment tests. */
const WINDOWS_USER_WSL = "/mnt/c/Users/Test User";
/** Native Windows home for the fake Windows user used by deployment tests. */
const WINDOWS_USER = "C:\\Users\\Test User";
/** Whether PowerShell is available for exercising the generated shortcut updater. */
const HAS_POWERSHELL =
  spawnSync("pwsh", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "exit 0"], { timeout: 10000 }).status === 0;

/**
 * Deploys the Windows setup scripts through their real Windows-user path helpers.
 * @param {string} [windowsUser] - Native Windows home to resolve.
 * @param {string} [windowsUserWsl] - WSL path for the same home.
 * @returns {Promise<{ setupScript: string, shortcutScript: string }>} Rendered setup and shortcut scripts.
 */
async function deployWindowsSetup(windowsUser = WINDOWS_USER, windowsUserWsl = WINDOWS_USER_WSL) {
  setSandboxGlobal("_windowUserBaseDir", undefined);
  setMockExecSyncReturn(`${windowsUser}\r\n`);
  mockFsExistence[windowsUserWsl] = true;
  mockFsExistence[`${windowsUserWsl}/Desktop`] = true;
  fetchResponses["software/scripts/windows/powershell-profile.ps1.bash"] = fs.readFileSync(
    "software/scripts/windows/powershell-profile.ps1.bash",
    "utf8",
  );
  fetchResponses["software/scripts/windows/_full-setup-bootstrap.ps1.bash"] = fs.readFileSync(
    "software/scripts/windows/_full-setup-bootstrap.ps1.bash",
    "utf8",
  );
  fetchResponses["software/scripts/windows/_full-setup.ps1.bash"] = fs.readFileSync(
    "software/scripts/windows/_full-setup.ps1.bash",
    "utf8",
  );
  fetchResponses["software/scripts/windows/_shortcut.ps1.bash"] = fs.readFileSync("software/scripts/windows/_shortcut.ps1.bash", "utf8");
  fetchResponses["software/scripts/windows/windows-context-menu.ps1.bash"] = fs.readFileSync(
    "software/scripts/windows/windows-context-menu.ps1.bash",
    "utf8",
  );
  await runScript("software/scripts/windows/_init.js");
  return {
    setupScript: fileSystem[`${windowsUserWsl}/Desktop/_full-setup.ps1`],
    shortcutScript: fileSystem[`${windowsUserWsl}/Desktop/_shortcut.ps1`],
  };
}

describe("Windows setup deployment", () => {
  it("keeps the context-menu source unchanged on repeated initialization", async () => {
    const destination = `${WINDOWS_USER_WSL}/Desktop/windows-context-menu.ps1`;
    await deployWindowsSetup();
    const firstDeployment = fileSystem[destination];
    await deployWindowsSetup();
    const secondDeployment = fileSystem[destination];

    expect(firstDeployment).toBe(fs.readFileSync("software/scripts/windows/windows-context-menu.ps1.bash", "utf8").trim());
    expect(secondDeployment).toBe(firstDeployment);
  });
});

describe("Windows Brave shortcut setup", () => {
  it("deploys the updater with resolved user paths and calls it from full setup", async () => {
    const { setupScript, shortcutScript } = await deployWindowsSetup();
    const expectedExecutable = "C:\\Users\\Test User\\AppData\\Local\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";

    expect(setupScript).toContain('& "$PSScriptRoot\\_shortcut.ps1"');
    expect(shortcutScript).toContain(`$braveExecutablePath = '${expectedExecutable}'`);
    expect(shortcutScript).toContain(
      "$braveWorkingDirectory = 'C:\\Users\\Test User\\AppData\\Local\\BraveSoftware\\Brave-Browser\\Application'",
    );
    expect(shortcutScript).toContain("$windowsAppDataRoamingPath = 'C:\\Users\\Test User\\AppData\\Roaming'");
    expect(shortcutScript).toContain(
      '$braveTaskbarShortcutFolder = "$windowsAppDataRoamingPath\\Microsoft\\Internet Explorer\\Quick Launch\\User Pinned\\TaskBar"',
    );
    expect(shortcutScript).not.toContain("<<BRAVE_EXECUTABLE_PATH>>");
    expect(shortcutScript).toContain("--source-shortcut-location=desktop");
    expect(shortcutScript).toContain("--disable-features=IPH_GMCSaveVideoFrame");
  });

  it("escapes apostrophes in Windows account names for PowerShell", async () => {
    const { shortcutScript } = await deployWindowsSetup("C:\\Users\\O'Neil", "/mnt/c/Users/O'Neil");

    expect(shortcutScript).toContain(
      "$braveExecutablePath = 'C:\\Users\\O''Neil\\AppData\\Local\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'",
    );
    expect(shortcutScript).toContain(
      "$braveWorkingDirectory = 'C:\\Users\\O''Neil\\AppData\\Local\\BraveSoftware\\Brave-Browser\\Application'",
    );
    expect(shortcutScript).toContain("$windowsAppDataRoamingPath = 'C:\\Users\\O''Neil\\AppData\\Roaming'");
  });
});

describe.skipIf(!HAS_POWERSHELL)("Windows Brave shortcut updater (PowerShell integration)", () => {
  afterEach(() => {
    setSandboxGlobal("_windowUserBaseDir", undefined);
  });

  it("corrects target and Start In, adds launch flags, and saves once across reruns", async () => {
    const { shortcutScript } = await deployWindowsSetup();
    const fixture = String.raw`
$script:shortcut = [pscustomobject]@{
  TargetPath = 'C:\Users\Old User\AppData\Local\BraveSoftware\Brave-Browser\Application\brave.exe'
  Arguments = '--profile-directory=Default'
  WorkingDirectory = 'C:\Users\Old User\AppData\Local\BraveSoftware\Brave-Browser\Application'
  SaveCount = 0
}
$script:shell = [pscustomobject]@{}
$script:shell | Add-Member ScriptMethod CreateShortcut { param($Path) $script:shortcut } | Out-Null
$script:shortcut | Add-Member ScriptMethod Save { [void]($this.SaveCount++) } | Out-Null
function New-Object { param([string]$ComObject) $script:shell }
function Test-Path { [CmdletBinding()] param([string]$Path) return $true }
function Get-ChildItem {
  [CmdletBinding()]
  param([string]$Path, [string]$Filter, [switch]$Recurse)
  if ($Path -like '*User Pinned\TaskBar') {
    return [pscustomobject]@{ FullName = 'C:\fixture\Brave.lnk' }
  }
}
function Write-Host { param($Object, $ForegroundColor) }
$env:APPDATA = 'C:\Users\Test User\AppData\Roaming'
$env:PUBLIC = 'C:\Users\Public'
$env:USERPROFILE = 'C:\Users\Test User'
$shortcutSource = [Console]::In.ReadToEnd()
$update = [scriptblock]::Create($shortcutSource)
& $update
& $update
[pscustomobject]@{
  TargetPath = $script:shortcut.TargetPath
  Arguments = $script:shortcut.Arguments
  WorkingDirectory = $script:shortcut.WorkingDirectory
  SaveCount = $script:shortcut.SaveCount
} | ConvertTo-Json -Compress
`;
    const result = spawnSync("pwsh", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", fixture], {
      input: shortcutScript,
      encoding: "utf8",
      timeout: 10000,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout.trim())).toEqual({
      TargetPath: "C:\\Users\\Test User\\AppData\\Local\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
      Arguments:
        "--profile-directory=Default --source-shortcut-location=desktop --windows-native-window --disable-features=IPH_GMCSaveVideoFrame",
      WorkingDirectory: "C:\\Users\\Test User\\AppData\\Local\\BraveSoftware\\Brave-Browser\\Application",
      SaveCount: 1,
    });
  });
});

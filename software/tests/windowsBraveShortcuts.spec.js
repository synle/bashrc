/** Windows setup deployment and Chromium browser shortcut regression checks. */
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

describe("Windows browser shortcut setup", () => {
  it("deploys the shared updater with inferred paths and both Desktop folders", async () => {
    const { setupScript, shortcutScript } = await deployWindowsSetup();

    expect(setupScript).toContain('& "$PSScriptRoot\\_shortcut.ps1"');
    expect(setupScript).toContain("Chromium Browser Shortcut Flags");
    expect(shortcutScript).toContain("$windowsAppDataRoamingPath = 'C:\\Users\\Test User\\AppData\\Roaming'");
    expect(shortcutScript).toContain("$windowsUserHomePath = 'C:\\Users\\Test User'");
    expect(shortcutScript).toContain("'D:\\Desktop'");
    expect(shortcutScript).toContain("App Paths\\$executableName");
    expect(shortcutScript).toContain("$browserInstallRelativePaths[$BrowserName]");
    expect(shortcutScript).toContain("--source-shortcut-location=desktop");
    expect(shortcutScript).toContain(
      "--disable-features=Translate,InterestFeedContentSuggestions,OptimizationHints,GlobalMediaControls,IPH_GMCSaveVideoFrame,ChromeWhatsNewUI,MediaRouter,msUndersideButton,msEdgeSidebarV2",
    );
    expect(shortcutScript).toContain("# '--disable-web-security'");
    expect(shortcutScript).not.toMatch(/^\s*'--disable-web-security'/m);
    expect(shortcutScript).not.toContain("<<BROWSER_LAUNCH_OPTIONS>>");
    expect(shortcutScript).not.toContain("C:\\Users\\Test User\\AppData\\Local\\BraveSoftware\\Brave-Browser\\Application\\brave.exe");
  });

  it("escapes apostrophes in Windows account names for PowerShell", async () => {
    const { shortcutScript } = await deployWindowsSetup("C:\\Users\\O'Neil", "/mnt/c/Users/O'Neil");

    expect(shortcutScript).toContain("$windowsAppDataRoamingPath = 'C:\\Users\\O''Neil\\AppData\\Roaming'");
    expect(shortcutScript).toContain("$windowsUserHomePath = 'C:\\Users\\O''Neil'");
  });
});

describe.skipIf(!HAS_POWERSHELL)("Windows browser shortcut updater (PowerShell integration)", () => {
  afterEach(() => {
    setSandboxGlobal("_windowUserBaseDir", undefined);
  });

  it("updates Brave, Chrome, and Edge shortcuts but leaves Chromium unchanged", async () => {
    const { shortcutScript } = await deployWindowsSetup();
    const fixture = String.raw`
$script:installedExecutables = @(
  'C:\New Browser Location\Brave\brave.exe',
  'D:\Browser Installs\Chrome\chrome.exe',
  'D:\Browser Installs\Chromium\chrome.exe',
  'E:\Browser Installs\Edge\msedge.exe'
)
$script:registeredExecutables = @{
  'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\brave.exe' = 'C:\New Browser Location\Brave\brave.exe'
}
$script:shortcutFolders = @(
  'D:\Desktop',
  'C:\Users\Test User\Desktop',
  'C:\Users\Test User\AppData\Roaming\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'
)
$script:searchedFolders = @()
$script:shortcuts = @{
  'C:\fixtures\Brave.lnk' = [pscustomobject]@{
    TargetPath = 'C:\Old Browser Folder\brave.exe'
    Arguments = '--profile-directory=Default --disable-features=OldFeature'
    WorkingDirectory = 'C:\Old Browser Folder'
    SaveCount = 0
  }
  'D:\Desktop\Chrome.lnk' = [pscustomobject]@{
    TargetPath = 'D:\Browser Installs\Chrome\chrome.exe'
    Arguments = '--profile-directory=Default --disable-features=OldFeature'
    WorkingDirectory = 'D:\Old Browser Folder'
    SaveCount = 0
  }
  'D:\Desktop\Chromium.lnk' = [pscustomobject]@{
    TargetPath = 'D:\Browser Installs\Chromium\chrome.exe'
    Arguments = '--profile-directory=Default'
    WorkingDirectory = 'D:\Old Browser Folder'
    SaveCount = 0
  }
  'C:\Users\Test User\Desktop\Edge.lnk' = [pscustomobject]@{
    TargetPath = 'E:\Browser Installs\Edge\msedge.exe'
    Arguments = '--profile-directory=Default --disable-features=OldFeature'
    WorkingDirectory = 'E:\Old Browser Folder'
    SaveCount = 0
  }
}
foreach ($shortcut in $script:shortcuts.Values) {
  $shortcut | Add-Member ScriptMethod Save { [void]($this.SaveCount++) } | Out-Null
}
$script:shell = [pscustomobject]@{}
$script:shell | Add-Member ScriptMethod CreateShortcut {
  param([string]$Path)
  return $script:shortcuts[$Path]
} | Out-Null
function New-Object { param([string]$ComObject) $script:shell }
function Test-Path {
  [CmdletBinding()]
  param([string]$Path, [string]$LiteralPath, [string]$PathType)
  $candidate = if ($LiteralPath) { $LiteralPath } else { $Path }
  if ($candidate -like 'HK*') { return $script:registeredExecutables.ContainsKey($candidate) }
  if ($candidate -match '\.exe$') { return $script:installedExecutables -contains $candidate }
  return $true
}
function Get-Item {
  [CmdletBinding()]
  param([string]$Path, [string]$LiteralPath)
  $candidate = if ($LiteralPath) { $LiteralPath } else { $Path }
  if (!$script:registeredExecutables.ContainsKey($candidate)) { return $null }
  $registryItem = [pscustomobject]@{ ExecutablePath = $script:registeredExecutables[$candidate] }
  $registryItem | Add-Member ScriptMethod GetValue { param([string]$Name) return $this.ExecutablePath } | Out-Null
  return $registryItem
}
function Get-ChildItem {
  [CmdletBinding()]
  param([string]$Path, [string]$Filter, [switch]$Recurse)
  $script:searchedFolders += $Path
  if ($Path -like '*User Pinned\TaskBar') {
    return [pscustomobject]@{ FullName = 'C:\fixtures\Brave.lnk'; Name = 'Brave.lnk' }
  }
  if ($Path -eq 'D:\Desktop') {
    return @(
      [pscustomobject]@{ FullName = 'D:\Desktop\Chrome.lnk'; Name = 'Chrome.lnk' },
      [pscustomobject]@{ FullName = 'D:\Desktop\Chromium.lnk'; Name = 'Chromium.lnk' }
    )
  }
  if ($Path -eq 'C:\Users\Test User\Desktop') {
    return [pscustomobject]@{ FullName = 'C:\Users\Test User\Desktop\Edge.lnk'; Name = 'Edge.lnk' }
  }
}
function Write-Host { param($Object, $ForegroundColor) }
$env:PUBLIC = 'C:\Users\Public'
$env:ProgramFiles = 'C:\Program Files'
$env:LOCALAPPDATA = 'C:\Users\Test User\AppData\Local'
$shortcutSource = [Console]::In.ReadToEnd()
$update = [scriptblock]::Create($shortcutSource)
& $update
& $update
[pscustomobject]@{
  Brave = $script:shortcuts['C:\fixtures\Brave.lnk']
  Chrome = $script:shortcuts['D:\Desktop\Chrome.lnk']
  Chromium = $script:shortcuts['D:\Desktop\Chromium.lnk']
  Edge = $script:shortcuts['C:\Users\Test User\Desktop\Edge.lnk']
  ScannedDDesktop = $script:searchedFolders -contains 'D:\Desktop'
} | ConvertTo-Json -Compress -Depth 4
`;
    const result = spawnSync("pwsh", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", fixture], {
      input: shortcutScript,
      encoding: "utf8",
      timeout: 10000,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout.trim())).toEqual({
      Brave: {
        TargetPath: "C:\\New Browser Location\\Brave\\brave.exe",
        Arguments:
          "--profile-directory=Default --source-shortcut-location=desktop --disable-smooth-scrolling --disable-breakpad --enable-gpu-rasterization --enable-zero-copy --ignore-gpu-blocklist --disk-cache-size=1073741824 --no-pings --no-default-browser-check --no-first-run --disable-search-engine-choice-screen --disable-brave-rewards-extension --windows-native-window --disable-features=OldFeature,Translate,InterestFeedContentSuggestions,OptimizationHints,GlobalMediaControls,IPH_GMCSaveVideoFrame,ChromeWhatsNewUI,MediaRouter",
        WorkingDirectory: "C:\\New Browser Location\\Brave",
        SaveCount: 1,
      },
      Chrome: {
        TargetPath: "D:\\Browser Installs\\Chrome\\chrome.exe",
        Arguments:
          "--profile-directory=Default --source-shortcut-location=desktop --disable-smooth-scrolling --disable-breakpad --enable-gpu-rasterization --enable-zero-copy --ignore-gpu-blocklist --disk-cache-size=1073741824 --no-pings --no-default-browser-check --no-first-run --disable-search-engine-choice-screen --disable-features=OldFeature,Translate,InterestFeedContentSuggestions,OptimizationHints,GlobalMediaControls,IPH_GMCSaveVideoFrame,ChromeWhatsNewUI,MediaRouter",
        WorkingDirectory: "D:\\Browser Installs\\Chrome",
        SaveCount: 1,
      },
      Chromium: {
        TargetPath: "D:\\Browser Installs\\Chromium\\chrome.exe",
        Arguments: "--profile-directory=Default",
        WorkingDirectory: "D:\\Old Browser Folder",
        SaveCount: 0,
      },
      Edge: {
        TargetPath: "E:\\Browser Installs\\Edge\\msedge.exe",
        Arguments:
          "--profile-directory=Default --source-shortcut-location=desktop --disable-smooth-scrolling --disable-breakpad --enable-gpu-rasterization --enable-zero-copy --ignore-gpu-blocklist --disk-cache-size=1073741824 --no-pings --no-default-browser-check --no-first-run --disable-search-engine-choice-screen --disable-features=OldFeature,Translate,InterestFeedContentSuggestions,OptimizationHints,GlobalMediaControls,IPH_GMCSaveVideoFrame,ChromeWhatsNewUI,MediaRouter,msUndersideButton,msEdgeSidebarV2",
        WorkingDirectory: "E:\\Browser Installs\\Edge",
        SaveCount: 1,
      },
      ScannedDDesktop: true,
    });
  });
});

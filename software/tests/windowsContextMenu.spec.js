/** Windows Explorer maintenance and launch-folder regression checks. */
import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";
import { spawnSync } from "child_process";
import { createRequire } from "module";
import { getIndexFunction } from "./setup.js";

/**
 * Execute a real installer with isolated deployment boundaries and optional coverage.
 * @param {string} file Installer source path.
 * @param {object} overrides Boundary replacements.
 * @returns {object} VM context exposing installer entry points and recorded writes.
 */
function loadInstaller(file, overrides = {}) {
  const context = {
    path,
    POWERSHELL_SYLE_PATH: "/profile.ps1",
    MAX_NESTED_DEPTH: 3,
    is_work_profile: false,
    log: vi.fn(),
    pathExists: () => true,
    set: getIndexFunction("set"),
    code: getIndexFunction("code"),
    resolvePlaceholders: getIndexFunction("resolvePlaceholders"),
    getWindowUserBaseDir: () => "/mnt/c/Users/Test User",
    readText: async (strings) => fs.readFileSync(strings[0], "utf8"),
    writeText: vi.fn(),
    mkdir: vi.fn(),
    registerPlatformTweaks: vi.fn(),
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
  vm.runInContext(source, context);
  return context;
}

/**
 * Run maintenance through PowerShell with an isolated registry boundary fixture.
 * @param {string} scenario Registry behavior to exercise.
 * @returns {object} Process status, diagnostics, and recorded registry effects.
 */
function runMaintenance(scenario = "normal") {
  const source = fs.readFileSync("software/scripts/windows/windows-context-menu.ps1.bash", "utf8");
  const fixture = String.raw`
$scenario = '${scenario}'
$env:OS = if ($scenario -eq 'non-windows') { 'Other' } else { 'Windows_NT' }
$env:LOCALAPPDATA = '/fixture'
$script:removed = @()
$script:hidden = @()
$script:blocked = @()
$script:labels = @()
$script:commands = @()
function Get-Command {
  param($Name, $CommandType, $ErrorAction)
  if ($Name -eq 'wt.exe' -and $scenario -in @('terminal', 'terminal-modern')) {
    return @{ Source = 'C:\Users\Test User\AppData\Local\Microsoft\WindowsApps\wt.exe' }
  }
  if ($Name -eq 'pwsh.exe' -and $scenario -in @('modern', 'modern-wsl', 'terminal-modern')) {
    return @{ Source = 'C:\Program Files\PowerShell\7\pwsh.exe' }
  }
  if ($Name -eq 'wsl.exe' -and $scenario -in @('wsl', 'modern-wsl')) {
    return @{ Source = 'C:\Windows\System32\wsl.exe' }
  }
}
$script:exports = @()
$script:saved = @{}
function Test-Path {
  param($LiteralPath)
  if ($LiteralPath.StartsWith('Registry::')) { return $scenario -ne 'absent' }
  return $script:saved.ContainsKey($LiteralPath)
}
function New-Item {
  param($ItemType, $Path, [switch]$Force)
  $script:saved[$Path] = $true
}
function Move-Item {
  param($LiteralPath, $Destination)
  $script:saved[$Destination] = $true
}
function reg.exe {
  param($operation, $key, $backup, $overwrite)
  $script:exports += $key
  if ($scenario -eq 'backup-failure') { $global:LASTEXITCODE = 1; return }
  $script:saved[$backup] = $true
  $global:LASTEXITCODE = 0
}
function Remove-Item {
  param($LiteralPath, [switch]$Recurse, [switch]$Force)
  if ($scenario -eq 'denied' -and $LiteralPath.Contains('HKEY_LOCAL_MACHINE')) {
    throw [System.UnauthorizedAccessException]::new('fixture access denied')
  }
  if ($scenario -eq 'unexpected') { throw [System.IO.IOException]::new('fixture IO failure') }
  $script:removed += $LiteralPath
}
function New-ItemProperty {
  param($LiteralPath, $Name, $Value, $PropertyType, [switch]$Force)
  if ($Name -eq 'LegacyDisable') { $script:hidden += @{ Key = $LiteralPath; Name = $Name; Value = $Value } }
  if ($Name -eq 'MUIVerb') { $script:labels += @{ Key = $LiteralPath; Value = $Value } }
  if ($LiteralPath.EndsWith('\Shell Extensions\Blocked')) { $script:blocked += @{ Name = $Name; Value = $Value } }
}
function Set-Item {
  param($LiteralPath, $Value)
  if ($LiteralPath.EndsWith('\command')) { $script:commands += @{ Key = $LiteralPath; Value = $Value } }
}
function Write-Host { param($Object) }
function Write-Warning { param($Message) }
try {
  $source = [Console]::In.ReadToEnd()
  & ([scriptblock]::Create($source))
  if ($scenario -eq 'twice') { & ([scriptblock]::Create($source)) }
  @{ Removed = $script:removed; Hidden = $script:hidden; Blocked = $script:blocked; Commands = $script:commands; Labels = $script:labels; Exports = $script:exports } | ConvertTo-Json -Depth 5 -Compress
} catch {
  @{ Error = $_.Exception.Message; Removed = $script:removed; Commands = $script:commands; Hidden = $script:hidden } | ConvertTo-Json -Compress
  exit 1
}
`;
  const result = spawnSync("pwsh", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", fixture], {
    input: source,
    encoding: "utf8",
    timeout: 10000,
  });
  return { status: result.status, stderr: result.stderr, output: JSON.parse(result.stdout.trim()) };
}

describe("Windows startup folder", () => {
  it("does not call last_folder when loading Windows platform tweaks", async () => {
    const context = loadInstaller("software/scripts/windows/_only.js");
    await context.doWork();
    const profile = context.registerPlatformTweaks.mock.calls[0][1];
    const result = spawnSync("bash", ["--noprofile", "--norc", "-c", `function last_folder() { cd /; }\n${profile}\npwd`], {
      encoding: "utf8",
      timeout: 10000,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe(fs.realpathSync(process.cwd()));
  });
});

describe("Windows maintenance deployment", () => {
  it("copies the exact maintenance source to the Desktop on repeated deployment", async () => {
    const context = loadInstaller("software/scripts/windows/_init.js");
    await context.doWork();
    await context.doWork();
    const deployments = context.writeText.mock.calls.filter(([file]) => file.endsWith("windows-context-menu.ps1"));
    expect(deployments).toEqual([
      [
        "/mnt/c/Users/Test User/Desktop/windows-context-menu.ps1",
        fs.readFileSync("software/scripts/windows/windows-context-menu.ps1.bash", "utf8"),
      ],
      [
        "/mnt/c/Users/Test User/Desktop/windows-context-menu.ps1",
        fs.readFileSync("software/scripts/windows/windows-context-menu.ps1.bash", "utf8"),
      ],
    ]);
  });
});

/** PowerShell is optional outside Windows; registry integration runs when installed. @type {boolean} */
const hasPwsh = spawnSync("pwsh", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "exit 0"], { timeout: 10000 }).status === 0;

describe.skipIf(!hasPwsh)("Explorer maintenance consumer (PowerShell integration; registry fixture)", () => {
  it("exports and removes sixteen Git keys and writes three root-safe user commands", () => {
    const result = runMaintenance();
    expect(result.status, result.stderr).toBe(0);
    expect(result.output.Removed).toHaveLength(16);
    expect(result.output.Exports).toHaveLength(24);
    expect(result.output.Removed).toEqual(
      expect.arrayContaining([
        "Registry::HKEY_CURRENT_USER\\Software\\Classes\\Drive\\shell\\git_gui",
        "Registry::HKEY_CURRENT_USER\\Software\\Classes\\Drive\\shell\\git_shell",
        "Registry::HKEY_LOCAL_MACHINE\\Software\\Classes\\Drive\\shell\\git_gui",
        "Registry::HKEY_LOCAL_MACHINE\\Software\\Classes\\Drive\\shell\\git_shell",
      ]),
    );
    expect(result.output.Hidden.map(({ Key }) => Key)).toEqual([
      "Registry::HKEY_CURRENT_USER\\Software\\Classes\\Directory\\shell\\WSL",
      "Registry::HKEY_CURRENT_USER\\Software\\Classes\\Directory\\Background\\shell\\WSL",
      "Registry::HKEY_CURRENT_USER\\Software\\Classes\\LibraryFolder\\Background\\shell\\WSL",
      "Registry::HKEY_CURRENT_USER\\Software\\Classes\\Drive\\shell\\WSL",
    ]);
    expect(result.output.Blocked).toEqual([
      { Name: "{9f156763-7844-4dc4-b2b1-901f640f5155}", Value: "" },
      { Name: "{02db545a-3e20-46de-83a5-1329b1e88b6b}", Value: "" },
    ]);
    expect(result.output.Labels.map(({ Value }) => Value)).toEqual(Array(3).fill("Open PowerShell Here"));
    expect(result.output.Commands.map(({ Key }) => Key)).toEqual([
      "Registry::HKEY_CURRENT_USER\\Software\\Classes\\Directory\\shell\\Powershell\\command",
      "Registry::HKEY_CURRENT_USER\\Software\\Classes\\Directory\\Background\\shell\\Powershell\\command",
      "Registry::HKEY_CURRENT_USER\\Software\\Classes\\Drive\\shell\\Powershell\\command",
    ]);
    expect(result.output.Commands.map(({ Value }) => Value)).toEqual(Array(3).fill('powershell.exe -NoExit -WorkingDirectory "%V\\."'));
  });

  it.each(["modern", "modern-wsl"])("prefers the discovered pwsh executable with a quoted path (%s)", (scenario) => {
    const result = runMaintenance(scenario);
    expect(result.status, result.stderr).toBe(0);
    const commands = result.output.Commands.filter(({ Key }) => Key.includes("\\Powershell\\"));
    expect(commands).toHaveLength(3);
    expect(commands.every(({ Value }) => Value === '"C:\\Program Files\\PowerShell\\7\\pwsh.exe" -NoExit -WorkingDirectory "%V\\."')).toBe(
      true,
    );
  });

  it.each(["wsl", "modern-wsl"])("writes consistently labeled optional WSL entries (%s)", (scenario) => {
    const result = runMaintenance(scenario);
    expect(result.status, result.stderr).toBe(0);
    const commands = result.output.Commands.filter(({ Key }) => Key.includes("\\SyWSL\\"));
    expect(commands).toHaveLength(3);
    expect(commands.every(({ Value }) => Value === '"C:\\Windows\\System32\\wsl.exe" --cd "%V\\."')).toBe(true);
    expect(result.output.Labels.map(({ Value }) => Value)).toEqual([
      "Open PowerShell Here",
      "Open Linux Shell Here",
      "Open PowerShell Here",
      "Open Linux Shell Here",
      "Open PowerShell Here",
      "Open Linux Shell Here",
    ]);
    expect(result.output.Exports).toHaveLength(27);
  });

  it.each([
    ["terminal", "powershell.exe"],
    ["terminal-modern", '"C:\\Program Files\\PowerShell\\7\\pwsh.exe"'],
  ])("hosts the selected PowerShell in Terminal when available (%s)", (scenario, binary) => {
    const result = runMaintenance(scenario);
    expect(result.status, result.stderr).toBe(0);
    expect(result.output.Commands.map(({ Value }) => Value)).toEqual(
      Array(3).fill(
        '"C:\\Users\\Test User\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe" new-tab --startingDirectory "%V\\." ' + binary + " -NoExit",
      ),
    );
  });

  it("hides denied Git verbs and built-in WSL verbs for the current user", () => {
    const result = runMaintenance("denied");
    expect(result.status, result.stderr).toBe(0);
    expect(result.output.Removed).toHaveLength(8);
    expect(result.output.Hidden).toHaveLength(12);
    expect(result.output.Hidden[0]).toEqual({
      Key: "Registry::HKEY_CURRENT_USER\\Software\\Classes\\Directory\\shell\\git_gui",
      Name: "LegacyDisable",
      Value: "",
    });
  });

  it("creates PowerShell overrides without deleting or exporting absent keys", () => {
    const result = runMaintenance("absent");
    expect(result.status, result.stderr).toBe(0);
    expect(result.output.Removed).toEqual([]);
    expect(result.output.Exports).toEqual([]);
    expect(result.output.Commands).toHaveLength(3);
  });

  it("rejects non-Windows execution without registry changes", () => {
    const result = runMaintenance("non-windows");
    expect(result.status).toBe(1);
    expect(result.output.Error).toBe("Run this script on Windows.");
    expect(result.output.Removed).toEqual([]);
    expect(result.output.Commands).toEqual([]);
    expect(result.output.Hidden).toEqual([]);
  });

  it("makes no registry changes when the first export fails", () => {
    const result = runMaintenance("backup-failure");
    expect(result.status).toBe(1);
    expect(result.output.Error).toContain("Registry backup failed");
    expect(result.output.Removed).toEqual([]);
    expect(result.output.Commands).toEqual([]);
    expect(result.output.Hidden).toEqual([]);
  });

  it("preserves first-run backups when maintenance runs twice", () => {
    const result = runMaintenance("twice");
    expect(result.status, result.stderr).toBe(0);
    expect(result.output.Exports).toHaveLength(24);
    expect(result.output.Blocked).toHaveLength(4);
    expect(result.output.Hidden).toHaveLength(8);
    expect(result.output.Commands).toHaveLength(6);
    expect(result.output.Commands[3]).toEqual(result.output.Commands[0]);
  });

  it("does not disguise unexpected deletion failures as permission fallback", () => {
    const result = runMaintenance("unexpected");
    expect(result.status).toBe(1);
    expect(result.output.Error).toBe("fixture IO failure");
    expect(result.output.Hidden).toEqual([]);
    expect(result.output.Commands).toEqual([]);
  });
});

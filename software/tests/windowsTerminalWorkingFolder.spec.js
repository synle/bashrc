/** Execute shell folder-reporting hooks and verify Windows Terminal duplication bindings. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/** Owned filesystem sandbox; converters are external process boundaries. @type {string} */
let folder;

/** PowerShell is an optional native consumer on non-Windows test hosts. @type {boolean} */
const hasPwsh = spawnSync("pwsh", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "exit 0"], { timeout: 10000 }).status === 0;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "terminal-cwd-"));
});
afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

/**
 * Extract one real top-level Bash function without loading unrelated profile effects.
 * @param {string} file Repository-relative source.
 * @param {string} name Function name.
 * @returns {string} Executable function declaration.
 * @throws {Error} When the expected declaration is missing.
 */
function bashFunction(file, name) {
  const source = fs.readFileSync(file, "utf8");
  const declaration = source.match(new RegExp(`^function ${name}\\(\\) \\{[\\s\\S]*?^\\}`, "m"));
  if (!declaration) throw new Error(`Missing Bash function ${name}`);
  return declaration[0];
}

/**
 * Run the production reporter or registered hook under the oldest local Bash.
 * @param {object} options Environment, converter, and hook options.
 * @returns {import('child_process').SpawnSyncReturns<string>} Captured process result.
 */
function reportBash({
  terminal = "fixture",
  wsl = "1",
  mingw = "0",
  converted = "C:\\Project café",
  converter = "wslpath",
  failure = false,
  hook = false,
} = {}) {
  if (converter) {
    fs.writeFileSync(
      path.join(folder, converter),
      '#!/bin/sh\n[ "$1" = "-w" ] && [ "$2" = "$PWD" ] || exit 9\n[ "$CONVERTER_FAILURE" = "0" ] || { echo "conversion failed" >&2; exit 1; }\nprintf "%s\\n" "$CONVERTED_FOLDER"\n',
      { mode: 0o755 },
    );
  }
  const source = bashFunction("software/bootstrap/profile-advanced.sh", "_windows_terminal_report_folder");
  if (hook) fs.mkdirSync(path.join(folder, "Next Folder"));
  const hookSource = hook
    ? `${bashFunction("software/bootstrap/profile-core.sh", "_prompt_command_add")}
function _rewrite_last_history_entry() { :; }
function _track_folder() { :; }
function shorter_pwd_path() { printf '%s' fixture-title; }
${fs
  .readFileSync("software/bootstrap/profile-advanced.sh", "utf8")
  .split("\n")
  .find((line) => line.startsWith('_prompt_command_add "_rewrite_last_history_entry'))}
eval "$PROMPT_COMMAND"
cd "$HOME/Next Folder" || exit 1
CONVERTED_FOLDER='D:\\Next Folder'
eval "$PROMPT_COMMAND"`
    : "_windows_terminal_report_folder";
  return spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", `${source}\n${hookSource}`], {
    cwd: folder,
    env: {
      PATH: folder,
      HOME: folder,
      WT_SESSION: terminal,
      is_os_wsl: wsl,
      is_os_mingw64: mingw,
      CONVERTED_FOLDER: converted,
      CONVERTER_FAILURE: failure ? "1" : "0",
    },
    encoding: "utf8",
    timeout: 10000,
  });
}

/**
 * Execute both production PowerShell prompt definitions using its native AST parser.
 * Owned prompt dependencies are fixtures; no system profile is loaded or changed.
 * @param {string} terminal Windows Terminal session marker, or empty for another terminal.
 * @param {string} location Filesystem folder or a non-filesystem provider location.
 * @returns {import('child_process').SpawnSyncReturns<string>} Captured process result.
 */
function reportPowerShell(terminal, location) {
  return spawnSync(
    "pwsh",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `
$ErrorActionPreference = 'Stop'
$source = [IO.File]::ReadAllText($env:TEST_PROFILE)
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors)
$functions = $ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true)
$reporter = $functions | Where-Object Name -eq 'Write-WindowsTerminalWorkingFolder'
if (-not $reporter) { throw 'Missing PowerShell folder reporter' }
Invoke-Expression $reporter.Extent.Text
function shorterPwdPath { 'fixture-short-folder' }
function Get-CachedNetworkAddress { '127.0.0.1' }
function Get-GitRoot { $false }
function shorterTimestamp { '12:34:56' }
$global:_original_starship_prompt = { "STARSHIP:$global:LASTEXITCODE" }
foreach ($name in @('global:prompt', 'prompt')) {
  $definition = $functions | Where-Object Name -eq $name
  if (-not $definition) { throw "Missing prompt $name" }
  Invoke-Expression $definition.Extent.Text
  Set-Location -LiteralPath $env:TEST_FOLDER
  $global:LASTEXITCODE = 37
  prompt
  if ((Get-Location).Provider.Name -eq 'FileSystem') {
    Set-Location -LiteralPath $env:TEST_SECOND_FOLDER
    prompt
  }
}
`,
    ],
    {
      env: {
        ...process.env,
        WT_SESSION: terminal,
        TEST_PROFILE: path.resolve("software/scripts/windows/powershell-profile.ps1.bash"),
        TEST_FOLDER: location,
        TEST_SECOND_FOLDER: folder,
      },
      encoding: "utf8",
      timeout: 10000,
    },
  );
}

describe("Windows Terminal current-folder inheritance (native shell integration)", () => {
  it.each([
    ["alt+t", "duplicateTab"],
    ["alt+d", { action: "splitPane", split: "vertical", splitMode: "duplicate" }],
    ["alt+'", { action: "splitPane", split: "horizontal", splitMode: "duplicate" }],
  ])("%s duplicates the active profile and its reported folder", (key, expected) => {
    const bindings = JSON.parse(
      fs
        .readFileSync("software/scripts/windows-terminal-keys.jsonc", "utf8")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/,\s*([}\]])/g, "$1"),
    );
    const matches = bindings.filter((binding) => [binding.keys].flat().includes(key));
    expect(matches).toHaveLength(1);
    expect(matches[0].command).toEqual(expected);
  });

  it.each([
    ["1", "0", "wslpath", "C:\\Project café"],
    ["1", "0", "wslpath", "\\\\wsl.localhost\\Ubuntu\\home\\user\\Project café"],
    ["0", "1", "cygpath", "D:\\Project café"],
  ])("reports converted Windows folder for WSL=%s MinGW=%s", (wsl, mingw, converter, converted) => {
    const result = reportBash({ wsl, mingw, converter, converted });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(`\x1b]9;9;"${converted}"\x1b\\`);
  });

  it("refreshes the reported folder after cd through the actual prompt hook without losing title updates", () => {
    const result = reportBash({ hook: true });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('\x1b]9;9;"C:\\Project café"\x1b\\');
    expect(result.stdout).toContain('\x1b]9;9;"D:\\Next Folder"\x1b\\');
    expect(result.stdout.split("\x1b]0;fixture-title\x07\x1b[2 q")).toHaveLength(3);
  });

  it.each([
    { terminal: "" },
    { wsl: "0", mingw: "0" },
    { converter: null },
    { failure: true },
    { converted: "" },
    { converted: 'C:\\bad"folder' },
    ...["\x01", "\x07", "\x1b", "\n", "\r", "\x7f"].map((control) => ({ converted: `C:\\bad${control}folder` })),
  ])("does not report an unsupported or unsafe Bash folder: %j", (options) => {
    const result = reportBash(options);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("");
    if (options.failure) expect(result.stderr).toContain("conversion failed");
  });

  it.skipIf(!hasPwsh)("reports the current filesystem folder in both PowerShell prompt paths after each cd", () => {
    const first = path.join(folder, "Project café");
    fs.mkdirSync(first);
    const result = reportPowerShell("fixture", first);
    expect(result.status, result.stderr).toBe(0);
    for (const current of [first, folder]) {
      expect(result.stdout.split(`\x1b]9;9;"${current}"\x1b\\`)).toHaveLength(3);
    }
    expect(result.stdout.match(/STARSHIP:37/g)).toHaveLength(2);
    expect(result.stdout.match(/>>> /g)).toHaveLength(2);
  });

  it.skipIf(!hasPwsh).each(['bad"folder', "bad\x07folder", "bad\x1bfolder", "bad\nfolder"])(
    "PowerShell rejects terminal-control injection in folder %j",
    (name) => {
      const unsafe = path.join(folder, name);
      fs.mkdirSync(unsafe);
      const result = reportPowerShell("fixture", unsafe);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).not.toContain(`\x1b]9;9;"${unsafe}"`);
      expect(result.stdout.split(`\x1b]9;9;"${folder}"\x1b\\`)).toHaveLength(3);
    },
  );

  it.skipIf(!hasPwsh).each([
    ["", "filesystem"],
    ["fixture", "Env:"],
  ])("PowerShell stays silent for terminal=%j location=%s", (terminal, location) => {
    const result = reportPowerShell(terminal, location === "filesystem" ? folder : location);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toContain("\x1b]9;9;");
    expect(result.stdout).toContain("STARSHIP:37");
    expect(result.stdout).toContain(">>> ");
  });
});

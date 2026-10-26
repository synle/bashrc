/** Native PowerShell and Starship consumers parse and render deployed configuration offline. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { getIndexFunction } from "./setup.js";
import { loadInstaller } from "./windowsTerminal.helpers.js";

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

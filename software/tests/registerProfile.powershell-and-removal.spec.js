import { describe, it, expect } from "vitest";

import fs from "fs";

import path from "path";

import { fileSystem, fetchResponses, getIndexFunction, getIndexConstant, setMockExecSyncReturn } from "./setup.js";

const _validateBashSyntax = getIndexFunction("_validateBashSyntax");

const registerProfileBlock = getIndexFunction("registerProfileBlock");

const removeProfileBlock = getIndexFunction("removeProfileBlock");

const removeFromBashSyleProfile = getIndexFunction("removeFromBashSyleProfile");

const removeFromPowershellProfile = getIndexFunction("removeFromPowershellProfile");

const registerWithBashSyleProfile = getIndexFunction("registerWithBashSyleProfile");

const registerWithBashSyleAutocompleteWithRawContent = getIndexFunction("registerWithBashSyleAutocompleteWithRawContent");

const registerWithPowershellProfile = getIndexFunction("registerWithPowershellProfile");

const flushProfileBlocks = getIndexFunction("flushProfileBlocks");

const BASH_SYLE_PATH = getIndexConstant("BASH_SYLE_PATH");

const BASE_HOMEDIR_LINUX = getIndexConstant("BASE_HOMEDIR_LINUX");

const POWERSHELL_SYLE_PATH = getIndexConstant("POWERSHELL_SYLE_PATH");

const TEXT_BLOCK_START_MARKER = getIndexConstant("TEXT_BLOCK_START_MARKER");

const TEXT_BLOCK_END_MARKER = getIndexConstant("TEXT_BLOCK_END_MARKER");

describe("registerWithPowershellProfile", () => {
  const PS_TEMPLATE = "# header\n\n# footer";

  it("should append a block to the profile", async () => {
    fileSystem[POWERSHELL_SYLE_PATH] = PS_TEMPLATE;
    registerWithPowershellProfile("test-key", "Write-Host 'hello'");
    await flushProfileBlocks();
    const result = fileSystem[POWERSHELL_SYLE_PATH];
    expect(result).toContain("# BEGIN test-key");
    expect(result).toContain("Write-Host 'hello'");
    expect(result).toContain("# END test-key");
  });

  it("should append multiple blocks", async () => {
    fileSystem[POWERSHELL_SYLE_PATH] = PS_TEMPLATE;
    registerWithPowershellProfile("block-a", "content-a");
    registerWithPowershellProfile("block-b", "content-b");
    await flushProfileBlocks();
    const result = fileSystem[POWERSHELL_SYLE_PATH];
    expect(result).toContain("content-a");
    expect(result).toContain("content-b");
  });

  it("should update an existing in-file block in place across runs", async () => {
    // Simulate a prior run having already written the block to disk.
    fileSystem[POWERSHELL_SYLE_PATH] = `# header\n\n# BEGIN adb\nSet-Alias adb old-path\n# END adb\n\n# footer`;
    registerWithPowershellProfile("adb", "Set-Alias adb new-path");
    await flushProfileBlocks();
    const result = fileSystem[POWERSHELL_SYLE_PATH];
    expect(result).toContain("Set-Alias adb new-path");
    expect(result).not.toContain("Set-Alias adb old-path");
    const beginCount = (result.match(/# BEGIN adb/g) || []).length;
    expect(beginCount).toBe(1);
  });

  it("should throw if the same key is registered twice within a single flush window", () => {
    fileSystem[POWERSHELL_SYLE_PATH] = PS_TEMPLATE;
    registerWithPowershellProfile("adb", "Set-Alias adb old-path");
    expect(() => registerWithPowershellProfile("adb", "Set-Alias adb new-path")).toThrow(/Duplicate profile block key/);
  });

  it("should not add code folding braces to powershell profile", async () => {
    fileSystem[POWERSHELL_SYLE_PATH] = PS_TEMPLATE;
    registerWithPowershellProfile("ps-key", "some-content");
    await flushProfileBlocks();
    const result = fileSystem[POWERSHELL_SYLE_PATH];
    expect(result).not.toContain("{\nsome-content\n}");
    expect(result).toContain("some-content");
  });

  it("should preserve surrounding content", async () => {
    fileSystem[POWERSHELL_SYLE_PATH] = PS_TEMPLATE;
    registerWithPowershellProfile("my-block", "my-content");
    await flushProfileBlocks();
    const result = fileSystem[POWERSHELL_SYLE_PATH];
    expect(result).toContain("# header");
    expect(result).toContain("# footer");
  });
});

describe("profile marker validation", () => {
  const profileCore = fs.readFileSync("software/bootstrap/profile-core.sh", "utf8");
  const profileAdvanced = fs.readFileSync("software/bootstrap/profile-advanced.sh", "utf8");
  const allTemplateContent = profileCore + "\n" + profileAdvanced;

  // extract all BEGIN keys from templates (long-form "# BEGIN key" and short-form "# BEGIN/END key", "# BEGIN/END - key", "# BLOCK key", "# BLOCK - key")
  const longFormBeginKeys = [...allTemplateContent.matchAll(/^# BEGIN (?!.*END)(.+)$/gm)].map((m) => m[1].trim());
  const shortFormKeys = [...allTemplateContent.matchAll(/^# (?:BEGIN\/END|BLOCK)\s+[^a-zA-Z0-9]*(.+)$/gm)].map((m) => m[1].trim());
  const sourceKeys = [...allTemplateContent.matchAll(/^# SOURCE\s+.*?(\S+\/\S+?)\s*$/gm)].map((m) => m[1].trim());
  const beginKeys = [...longFormBeginKeys, ...shortFormKeys, ...sourceKeys];
  const endKeys = [...allTemplateContent.matchAll(/^# END (.+)$/gm)].map((m) => m[1].trim());

  it("should have matching BEGIN/END pairs or short-form markers in profile templates", () => {
    expect(beginKeys.sort()).toEqual([...endKeys, ...shortFormKeys, ...sourceKeys].sort());
  });

  it("should not have duplicate BEGIN markers", () => {
    const seen = new Set();
    for (const key of beginKeys) {
      expect(seen.has(key), `duplicate BEGIN marker: "${key}"`).toBe(false);
      seen.add(key);
    }
  });

  // scan script files for registerWithBashSyleProfile calls and extract config keys
  const scriptDir = "software/scripts";
  const scriptFiles = fs.readdirSync(scriptDir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isFile() && entry.name.endsWith(".js")) return [path.join(scriptDir, entry.name)];
    if (entry.isDirectory()) {
      try {
        return fs
          .readdirSync(path.join(scriptDir, entry.name))
          .filter((f) => f.endsWith(".js"))
          .map((f) => path.join(scriptDir, entry.name, f));
      } catch {
        return [];
      }
    }
    return [];
  });

  const allScriptContent = scriptFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");

  // extract registerWithBashSyleProfile("key", ...) calls
  const bashProfileKeys = [...allScriptContent.matchAll(/registerWithBashSyleProfile\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);

  // extract registerPlatformTweaks("name", ...) — key becomes "name OS-specific Tweaks"
  const platformTweakNames = [...allScriptContent.matchAll(/registerPlatformTweaks\(\s*["'`]([^"'`]+)["'`]/g)].map(
    (m) => `${m[1]} OS-specific Tweaks`,
  );

  // post-profile blocks that use appendTextBlock directly on BASH_SYLE_PATH
  const postProfileKeys = ["starship prompt", "zoxide init"];

  it("should have a pre-placed marker for every registerWithBashSyleProfile call", () => {
    for (const key of bashProfileKeys) {
      expect(beginKeys, `missing marker for registerWithBashSyleProfile("${key}")`).toContain(key);
    }
  });

  it("should have a pre-placed marker for every registerPlatformTweaks call", () => {
    for (const key of platformTweakNames) {
      expect(beginKeys, `missing marker for registerPlatformTweaks key "${key}"`).toContain(key);
    }
  });

  it("should have a pre-placed marker for every post-profile block", () => {
    for (const key of postProfileKeys) {
      expect(beginKeys, `missing marker for post-profile block "${key}"`).toContain(key);
    }
  });
});

describe("PowerShell profile marker validation", () => {
  const psTemplate = fs.readFileSync("software/scripts/windows/powershell-profile.ps1.bash", "utf8");

  const psLongFormBeginKeys = [...psTemplate.matchAll(/^# BEGIN (?!.*END)(.+)$/gm)].map((m) => m[1].trim());
  const psShortFormKeys = [...psTemplate.matchAll(/^# (?:BEGIN\/END|BLOCK)\s+(?:-\s+)?(.+)$/gm)].map((m) => m[1].trim());
  const psBeginKeys = [...psLongFormBeginKeys, ...psShortFormKeys];
  const psEndKeys = [...psTemplate.matchAll(/^# END (.+)$/gm)].map((m) => m[1].trim());

  it("should have matching BEGIN/END pairs or short-form markers in PowerShell template", () => {
    expect(psBeginKeys.sort()).toEqual([...psEndKeys, ...psShortFormKeys].sort());
  });

  it("should not have duplicate BEGIN markers", () => {
    const seen = new Set();
    for (const key of psBeginKeys) {
      expect(seen.has(key), `duplicate BEGIN marker: "${key}"`).toBe(false);
      seen.add(key);
    }
  });

  // scan windows script files for static registerWithPowershellProfile calls (exclude powershell.js dynamic spec calls)
  const winScriptDir = "software/scripts/windows";
  const winScriptFiles = fs
    .readdirSync(winScriptDir)
    .filter((f) => f.endsWith(".js") && f !== "powershell.js")
    .map((f) => path.join(winScriptDir, f));

  const winScriptContent = winScriptFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");
  const psProfileKeys = [...winScriptContent.matchAll(/registerWithPowershellProfile\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);

  it("should have a pre-placed marker for every static registerWithPowershellProfile call", () => {
    for (const key of psProfileKeys) {
      expect(psBeginKeys, `missing marker in powershell-profile.ps1.bash for registerWithPowershellProfile("${key}")`).toContain(key);
    }
  });
});

describe("removeProfileBlock", () => {
  const TEST_PROFILE = "/mock/home/.test_profile";

  it("should clear block content between markers", async () => {
    fileSystem[TEST_PROFILE] =
      `before\n# ${TEXT_BLOCK_START_MARKER} fzf\n{\nexport FZF_DEFAULT_OPTS="--height 40%"\n}\n# ${TEXT_BLOCK_END_MARKER} fzf\nafter`;

    removeProfileBlock({ profilePath: TEST_PROFILE, configKey: "fzf" });
    await flushProfileBlocks();

    const written = fileSystem[TEST_PROFILE];
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} fzf`);
    expect(written).toContain(`# ${TEXT_BLOCK_END_MARKER} fzf`);
    expect(written).not.toContain("FZF_DEFAULT_OPTS");
    expect(written).toContain("before");
    expect(written).toContain("after");
  });

  it("should not modify file when block does not exist", async () => {
    fileSystem[TEST_PROFILE] = "untouched content";

    removeProfileBlock({ profilePath: TEST_PROFILE, configKey: "nonexistent" });
    await flushProfileBlocks();

    expect(fileSystem[TEST_PROFILE]).toBe("untouched content");
  });

  it("should leave other blocks intact", async () => {
    fileSystem[TEST_PROFILE] =
      `# ${TEXT_BLOCK_START_MARKER} keep\n{\nkeep this\n}\n# ${TEXT_BLOCK_END_MARKER} keep\n# ${TEXT_BLOCK_START_MARKER} remove\n{\nremove this\n}\n# ${TEXT_BLOCK_END_MARKER} remove`;

    removeProfileBlock({ profilePath: TEST_PROFILE, configKey: "remove" });
    await flushProfileBlocks();

    const written = fileSystem[TEST_PROFILE];
    expect(written).toContain("keep this");
    expect(written).not.toContain("remove this");
  });
});

describe("removeFromBashSyleProfile", () => {
  it("should clear a block from BASH_SYLE_PATH", async () => {
    fileSystem[BASH_SYLE_PATH] = `# ${TEXT_BLOCK_START_MARKER} fzf\n{\nexport FZF_OPTS="test"\n}\n# ${TEXT_BLOCK_END_MARKER} fzf`;

    removeFromBashSyleProfile("fzf");
    await flushProfileBlocks();

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).not.toContain("FZF_OPTS");
  });
});

describe("removeFromPowershellProfile", () => {
  it("should clear a block from POWERSHELL_SYLE_PATH", async () => {
    fileSystem[POWERSHELL_SYLE_PATH] = `# ${TEXT_BLOCK_START_MARKER} posh\nSet-Alias test\n# ${TEXT_BLOCK_END_MARKER} posh`;

    removeFromPowershellProfile("posh");
    await flushProfileBlocks();

    const written = fileSystem[POWERSHELL_SYLE_PATH];
    expect(written).not.toContain("Set-Alias");
  });
});

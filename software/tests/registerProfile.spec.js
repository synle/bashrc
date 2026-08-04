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

// ---- tests ----

describe("_validateBashSyntax", () => {
  it("should return null for valid bash", () => {
    expect(_validateBashSyntax("echo hello", "test")).toBeNull();
  });

  it("should return null for valid if/fi block", () => {
    expect(_validateBashSyntax("if true; then\n  echo ok\nfi", "test")).toBeNull();
  });

  it("should return null for comments only", () => {
    expect(_validateBashSyntax("# just a comment", "test")).toBeNull();
  });

  it("should return null for empty content", () => {
    expect(_validateBashSyntax("", "test")).toBeNull();
  });

  it("should return error for unclosed if", () => {
    const result = _validateBashSyntax("if true; then\n  echo ok", "test");
    expect(result).toBeTruthy();
    expect(result).toContain("syntax error");
  });

  it("should return error for unexpected fi", () => {
    const result = _validateBashSyntax("fi", "test");
    expect(result).toBeTruthy();
  });

  it("should return error for unclosed parenthesis", () => {
    const result = _validateBashSyntax("echo $(echo hello", "test");
    expect(result).toBeTruthy();
  });

  it("should return null for valid function definition", () => {
    expect(_validateBashSyntax('function foo() {\n  echo "bar"\n}', "test")).toBeNull();
  });

  it("should return null for valid autocomplete function", () => {
    const content = `__spec_complete_bat()
{
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  COMPREPLY=(\$(compgen -W "opts" -- "\$cur"))
}
complete -F __spec_complete_bat bat`;
    expect(_validateBashSyntax(content, "test")).toBeNull();
  });
});

describe("registerProfileBlock", () => {
  const TEST_PROFILE = "/mock/home/.test_profile";

  it("should append a block", async () => {
    fileSystem[TEST_PROFILE] = "existing content";

    registerProfileBlock({ profilePath: TEST_PROFILE, configKey: "My Block", content: "echo hello" });
    await flushProfileBlocks();

    const written = fileSystem[TEST_PROFILE];
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} My Block`);
    expect(written).toContain("echo hello");
    expect(written).not.toContain("{\necho hello\n}");
    expect(written.indexOf("existing content")).toBeLessThan(written.indexOf(`# ${TEXT_BLOCK_START_MARKER} My Block`));
  });

  it("should prepend when isPrepend is true", async () => {
    fileSystem[TEST_PROFILE] = "existing content";

    registerProfileBlock({ profilePath: TEST_PROFILE, configKey: "My Block", content: "echo hello", isPrepend: true });
    await flushProfileBlocks();

    const written = fileSystem[TEST_PROFILE];
    expect(written.indexOf(`# ${TEXT_BLOCK_START_MARKER} My Block`)).toBeLessThan(written.indexOf("existing content"));
  });

  it("should work with any file path", async () => {
    const customPath = "/mock/home/.custom_rc";

    registerProfileBlock({ profilePath: customPath, configKey: "Custom", content: "custom content" });
    await flushProfileBlocks();

    expect(fileSystem[customPath]).toContain("custom content");
    expect(fileSystem[customPath]).toContain(`# ${TEXT_BLOCK_START_MARKER} Custom`);
  });

  it("should update an existing block in place", async () => {
    fileSystem[TEST_PROFILE] = `# ${TEXT_BLOCK_START_MARKER} My Block\nold\n# ${TEXT_BLOCK_END_MARKER} My Block`;

    registerProfileBlock({ profilePath: TEST_PROFILE, configKey: "My Block", content: "new stuff" });
    await flushProfileBlocks();

    const written = fileSystem[TEST_PROFILE];
    expect(written).toContain("new stuff");
    expect(written).not.toContain("\nold\n");
  });

  it("should replace invalid bash syntax with an echo warning", async () => {
    fileSystem[TEST_PROFILE] = "existing content";

    registerProfileBlock({ profilePath: TEST_PROFILE, configKey: "Bad Block", content: "if true; then\n  echo ok" });
    await flushProfileBlocks();

    const written = fileSystem[TEST_PROFILE];
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} Bad Block`);
    // invalid content replaced with echo warning (valid bash, won't break profile)
    expect(written).toContain("invalid bash syntax detected");
    expect(written).toContain("block skipped");
    expect(written).not.toContain("echo ok");
  });

  it("should accept valid bash content", async () => {
    fileSystem[TEST_PROFILE] = "existing content";

    registerProfileBlock({ profilePath: TEST_PROFILE, configKey: "Good Block", content: "if true; then\n  echo ok\nfi" });
    await flushProfileBlocks();

    const written = fileSystem[TEST_PROFILE];
    expect(written).toContain("echo ok");
    expect(written).not.toContain("# Invalid Content");
  });

  it("should accept comment-only content with no-op", async () => {
    fileSystem[TEST_PROFILE] = "existing content";

    registerProfileBlock({ profilePath: TEST_PROFILE, configKey: "Comment Block", content: "# just a comment\n:" });
    await flushProfileBlocks();

    const written = fileSystem[TEST_PROFILE];
    expect(written).toContain("# just a comment");
    expect(written).not.toContain("WARNING");
  });

  it("should accept comment-only content without code folding", async () => {
    fileSystem[TEST_PROFILE] = "existing content";

    registerProfileBlock({ profilePath: TEST_PROFILE, configKey: "Comment Block Only", content: "# just a comment" });
    await flushProfileBlocks();

    const written = fileSystem[TEST_PROFILE];
    expect(written).toContain("# just a comment");
    expect(written).not.toContain("WARNING");
  });

  it("should skip validation for powershell profiles", async () => {
    const psPath = "/mock/home/.powershell_syle";
    fileSystem[psPath] = "";

    registerProfileBlock({ profilePath: psPath, configKey: "PS Block", content: "if true; then\n  echo ok" });
    await flushProfileBlocks();

    const written = fileSystem[psPath];
    expect(written).toContain("echo ok");
    expect(written).not.toContain("# Invalid Content");
  });
});

describe("registerWithBashSyleProfile", () => {
  it("should write a prepended block to BASH_SYLE_PATH when file is empty", async () => {
    registerWithBashSyleProfile("Sy Git Config", "export GIT_EDITOR=vim");
    await flushProfileBlocks();

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} Sy Git Config`);
    expect(written).toContain("export GIT_EDITOR=vim");
    expect(written).toContain(`# ${TEXT_BLOCK_END_MARKER} Sy Git Config`);
  });

  it("should not wrap content with code folding braces", async () => {
    registerWithBashSyleProfile("Sy NoFolding", "alias foo=bar");
    await flushProfileBlocks();

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain("alias foo=bar");
    expect(written).not.toContain("{\nalias foo=bar\n}");
  });

  it("should append new block after existing content", async () => {
    fileSystem[BASH_SYLE_PATH] = "existing profile content";

    registerWithBashSyleProfile("Sy Aliases", "alias ll='ls -la'");
    await flushProfileBlocks();

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} Sy Aliases`);
    expect(written).toContain("alias ll='ls -la'");
    expect(written.indexOf("existing profile content")).toBeLessThan(written.indexOf(`# ${TEXT_BLOCK_START_MARKER} Sy Aliases`));
  });

  it("should update an existing block in place", async () => {
    fileSystem[BASH_SYLE_PATH] = `top content

# ${TEXT_BLOCK_START_MARKER} Sy Env
OLD_VAR=old
# ${TEXT_BLOCK_END_MARKER} Sy Env

bottom content`;

    registerWithBashSyleProfile("Sy Env", "NEW_VAR=new");
    await flushProfileBlocks();

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain("NEW_VAR=new");
    expect(written).not.toContain("OLD_VAR=old");
    expect(written).toContain("top content");
    expect(written).toContain("bottom content");
  });

  it("should register multiple independent blocks", async () => {
    registerWithBashSyleProfile("Sy Block A", "content_a");
    registerWithBashSyleProfile("Sy Block B", "content_b");
    await flushProfileBlocks();

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} Sy Block A`);
    expect(written).toContain("content_a");
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} Sy Block B`);
    expect(written).toContain("content_b");
  });
});

describe("registerWithBashSyleAutocompleteWithRawContent", () => {
  it("should write an appended block to BASH_SYLE_PATH when file is empty", async () => {
    registerWithBashSyleAutocompleteWithRawContent("git Autocomplete", "complete -o default -F _git git");
    await flushProfileBlocks();

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} git Autocomplete`);
    expect(written).toContain("complete -o default -F _git git");
    expect(written).toContain(`# ${TEXT_BLOCK_END_MARKER} git Autocomplete`);
  });

  it("should append new block after existing content", async () => {
    fileSystem[BASH_SYLE_PATH] = "existing autocomplete stuff";

    registerWithBashSyleAutocompleteWithRawContent("npm Autocomplete", "complete -F _npm npm");
    await flushProfileBlocks();

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written.indexOf("existing autocomplete stuff")).toBeLessThan(written.indexOf(`# ${TEXT_BLOCK_START_MARKER} npm Autocomplete`));
  });

  it("should update an existing autocomplete block in place", async () => {
    fileSystem[BASH_SYLE_PATH] = `# ${TEXT_BLOCK_START_MARKER} docker Autocomplete
old docker complete
# ${TEXT_BLOCK_END_MARKER} docker Autocomplete`;

    registerWithBashSyleAutocompleteWithRawContent("docker Autocomplete", "new docker complete");
    await flushProfileBlocks();

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain("new docker complete");
    expect(written).not.toContain("old docker complete");
  });

  it("should register multiple autocomplete blocks without clobbering", async () => {
    registerWithBashSyleAutocompleteWithRawContent("git Autocomplete", "git_complete_fn");
    registerWithBashSyleAutocompleteWithRawContent("npm Autocomplete", "npm_complete_fn");
    await flushProfileBlocks();

    const written = fileSystem[BASH_SYLE_PATH];
    expect(written).toContain("git_complete_fn");
    expect(written).toContain("npm_complete_fn");
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} git Autocomplete`);
    expect(written).toContain(`# ${TEXT_BLOCK_START_MARKER} npm Autocomplete`);
  });
});

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

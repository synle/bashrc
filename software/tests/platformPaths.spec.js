/** Tests for platform-specific path utilities and text block internals. */
import { describe, it, expect } from "vitest";
import {
  getIndexFunction,
  getIndexConstant,
  mockFsExistence,
  mockFsDirEntries,
  mockExecCommands,
  setSandboxGlobal,
  loadScriptHelpers,
} from "./setup.js";

const toWindowsPath = getIndexFunction("toWindowsPath");
const hidePaths = getIndexFunction("hidePaths");
const getCustomTweaksPath = getIndexFunction("getCustomTweaksPath");
const getEtcHostsPath = getIndexFunction("getEtcHostsPath");
const getOsxApplicationSupportCodeUserPath = getIndexFunction("getOsxApplicationSupportCodeUserPath");
const _expandShortFormMarkers = getIndexFunction("_expandShortFormMarkers");
const replaceBlocks = getIndexFunction("replaceBlocks");
const _replaceSourceBlocks = getIndexFunction("_replaceSourceBlocks");
const TEXT_BLOCK_START_MARKER = getIndexConstant("TEXT_BLOCK_START_MARKER");
const TEXT_BLOCK_END_MARKER = getIndexConstant("TEXT_BLOCK_END_MARKER");
const TEXT_BLOCK_SHORT_MARKER = getIndexConstant("TEXT_BLOCK_SHORT_MARKER");
const TEXT_BLOCK_ALIAS_MARKER = getIndexConstant("TEXT_BLOCK_ALIAS_MARKER");
const TEXT_BLOCK_SOURCE_START_MARKER = getIndexConstant("TEXT_BLOCK_SOURCE_START_MARKER");
const TEXT_BLOCK_SOURCE_END_MARKER = getIndexConstant("TEXT_BLOCK_SOURCE_END_MARKER");

// ---- toWindowsPath ----

describe("toWindowsPath", () => {
  it("should convert WSL path to Windows path", () => {
    expect(toWindowsPath("/mnt/c/Users/test")).toBe("C:\\Users\\test");
  });

  it("should handle lowercase drive letters", () => {
    expect(toWindowsPath("/mnt/d/Documents")).toBe("D:\\Documents");
  });

  it("should convert all forward slashes to backslashes", () => {
    expect(toWindowsPath("/mnt/c/Users/test/file.txt")).toBe("C:\\Users\\test\\file.txt");
  });

  it("should handle paths without /mnt/ prefix", () => {
    const result = toWindowsPath("/home/user/file.txt");
    expect(result).toBe("\\home\\user\\file.txt");
  });

  it("should handle deep nested paths", () => {
    expect(toWindowsPath("/mnt/c/Program Files/App/bin/tool.exe")).toBe("C:\\Program Files\\App\\bin\\tool.exe");
  });
});

// ---- hidePaths ----

describe("hidePaths", () => {
  it("uses PowerShell Hidden attributes for non-recursive Windows paths", async () => {
    setSandboxGlobal("is_os_windows", true);
    setSandboxGlobal("is_os_wsl", true);
    await hidePaths("/mnt/c/Users/Sy Le/.aws", true);

    expect(mockExecCommands).toHaveLength(1);
    expect(mockExecCommands[0]).toContain("powershell.exe -NoProfile -NonInteractive -EncodedCommand");
    const powershellScript = Buffer.from(mockExecCommands[0].split("-EncodedCommand ")[1], "base64").toString("utf16le");
    const encodedWindowsPath = Buffer.from("C:\\Users\\Sy Le\\.aws", "utf16le").toString("base64");
    expect(powershellScript).toContain(encodedWindowsPath);
    expect(powershellScript).toContain("$false");
  });

  it("makes Windows paths visible and includes descendants only when requested", async () => {
    setSandboxGlobal("is_os_windows", true);
    setSandboxGlobal("is_os_wsl", true);
    await hidePaths(["/mnt/c/Users/Sy Le/.aws"], false, true);

    const powershellScript = Buffer.from(mockExecCommands[0].split("-EncodedCommand ")[1], "base64").toString("utf16le");
    expect(powershellScript).toContain("$true");
    expect(powershellScript).toContain("-bnot [IO.FileAttributes]::Hidden");
    expect(powershellScript).toContain("Get-ChildItem -LiteralPath $item -Force -Recurse");
  });

  it("uses chflags on macOS and does nothing on Linux", async () => {
    setSandboxGlobal("is_os_windows", false);
    setSandboxGlobal("is_os_wsl", false);
    setSandboxGlobal("is_os_mac", true);
    await hidePaths("/Users/test/.aws", false);
    expect(mockExecCommands).toEqual(["chflags nohidden '/Users/test/.aws'"]);

    mockExecCommands.length = 0;
    setSandboxGlobal("is_os_mac", false);
    await hidePaths("/home/test/.aws");
    expect(mockExecCommands).toEqual([]);
  });

  it("does not invoke Windows PowerShell outside WSL", async () => {
    setSandboxGlobal("is_os_mac", false);
    setSandboxGlobal("is_os_windows", true);
    setSandboxGlobal("is_os_wsl", false);
    await hidePaths("/mnt/c/Users/Sy Le/.aws");
    expect(mockExecCommands).toEqual([]);
  });

  it("hides only matching top-level Windows home entries", async () => {
    const home = "/mnt/c/Users/Sy Le";
    const entry = (name, isDirectory) => ({ name, isDirectory: () => isDirectory, isFile: () => !isDirectory });
    mockFsDirEntries[home] = [
      entry(".aws", true),
      entry(".claude", true),
      entry("Links", true),
      entry("Saved Games", true),
      entry("Searches", true),
      entry("Documents", true),
      entry(".wslconfig.bak_original", false),
      entry(".gitconfig", false),
      entry(".bash_history", false),
      entry("visible.txt", false),
    ];
    setSandboxGlobal("is_os_wsl", true);
    let hidePathsCall;
    loadScriptHelpers("software/scripts/windows/hide-user-home-items.js");
    setSandboxGlobal("getWindowUserBaseDir", () => home);
    setSandboxGlobal("hidePaths", (...args) => (hidePathsCall = args));

    await getIndexFunction("doWork")();

    expect(hidePathsCall).toEqual([
      [
        `${home}/.aws`,
        `${home}/.claude`,
        `${home}/Links`,
        `${home}/Saved Games`,
        `${home}/Searches`,
        `${home}/.wslconfig.bak_original`,
        `${home}/.gitconfig`,
        `${home}/.bash_history`,
      ],
      true,
      false,
    ]);
  });
});

// ---- getCustomTweaksPath ----

describe("getCustomTweaksPath", () => {
  it("should return base _extra path when no subPath provided", () => {
    const result = getCustomTweaksPath();
    expect(result).toContain("_extra");
    expect(result).not.toContain("undefined");
  });

  it("should return path with subPath appended", () => {
    const result = getCustomTweaksPath("mac");
    expect(result).toContain("_extra");
    expect(result).toContain("mac");
  });

  it("should return a different subPath correctly", () => {
    const result = getCustomTweaksPath("windows");
    expect(result).toContain("_extra");
    expect(result).toContain("windows");
  });
});

// ---- getEtcHostsPath ----

describe("getEtcHostsPath", () => {
  it("should return /etc/hosts when Windows host file does not exist", () => {
    // default mock: nothing exists
    expect(getEtcHostsPath()).toBe("/etc/hosts");
  });

  it("should return Windows hosts path when it exists", () => {
    mockFsExistence["/mnt/c/Windows/System32/drivers/etc/hosts"] = true;
    expect(getEtcHostsPath()).toBe("/mnt/c/Windows/System32/drivers/etc/hosts");
  });
});

// ---- _expandShortFormMarkers ----

describe("_expandShortFormMarkers", () => {
  it("should expand BEGIN/END short-form marker", () => {
    const input = `# ${TEXT_BLOCK_SHORT_MARKER} mykey`;
    const result = _expandShortFormMarkers(input, "#");
    expect(result).toBe(`# ${TEXT_BLOCK_START_MARKER} mykey\n# ${TEXT_BLOCK_END_MARKER} mykey`);
  });

  it("should expand BLOCK alias marker", () => {
    const input = `# ${TEXT_BLOCK_ALIAS_MARKER} mykey`;
    const result = _expandShortFormMarkers(input, "#");
    expect(result).toBe(`# ${TEXT_BLOCK_START_MARKER} mykey\n# ${TEXT_BLOCK_END_MARKER} mykey`);
  });

  it("should expand with dash separator", () => {
    const input = `# ${TEXT_BLOCK_SHORT_MARKER} - mykey`;
    const result = _expandShortFormMarkers(input, "#");
    expect(result).toBe(`# ${TEXT_BLOCK_START_MARKER} mykey\n# ${TEXT_BLOCK_END_MARKER} mykey`);
  });

  it("should expand multiple markers in one pass", () => {
    const input = `# ${TEXT_BLOCK_SHORT_MARKER} key1\n# ${TEXT_BLOCK_SHORT_MARKER} key2`;
    const result = _expandShortFormMarkers(input, "#");
    expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} key1`);
    expect(result).toContain(`# ${TEXT_BLOCK_END_MARKER} key1`);
    expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} key2`);
    expect(result).toContain(`# ${TEXT_BLOCK_END_MARKER} key2`);
  });

  it("should work with // comment prefix", () => {
    const input = `// ${TEXT_BLOCK_SHORT_MARKER} mykey`;
    const result = _expandShortFormMarkers(input, "//");
    expect(result).toBe(`// ${TEXT_BLOCK_START_MARKER} mykey\n// ${TEXT_BLOCK_END_MARKER} mykey`);
  });

  it("should work with comment suffix", () => {
    const input = `<!-- ${TEXT_BLOCK_SHORT_MARKER} mykey -->`;
    const result = _expandShortFormMarkers(input, "<!--", " -->");
    expect(result).toBe(`<!-- ${TEXT_BLOCK_START_MARKER} mykey -->\n<!-- ${TEXT_BLOCK_END_MARKER} mykey -->`);
  });

  it("should not expand already-expanded long-form markers", () => {
    const input = `# ${TEXT_BLOCK_START_MARKER} mykey\ncontent\n# ${TEXT_BLOCK_END_MARKER} mykey`;
    const result = _expandShortFormMarkers(input, "#");
    expect(result).toBe(input);
  });

  it("should preserve surrounding text", () => {
    const input = `before\n# ${TEXT_BLOCK_SHORT_MARKER} mykey\nafter`;
    const result = _expandShortFormMarkers(input, "#");
    expect(result).toContain("before");
    expect(result).toContain("after");
    expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} mykey`);
  });
});

// ---- replaceBlocks (multi-block) ----

describe("replaceBlocks", () => {
  it("should replace multiple blocks in a single pass", () => {
    const input = [
      `# ${TEXT_BLOCK_START_MARKER} A`,
      `old a`,
      `# ${TEXT_BLOCK_END_MARKER} A`,
      "",
      `# ${TEXT_BLOCK_START_MARKER} B`,
      `old b`,
      `# ${TEXT_BLOCK_END_MARKER} B`,
    ].join("\n");

    const result = replaceBlocks(input, { A: "new a", B: "new b" }, "#");
    expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} A\nnew a\n# ${TEXT_BLOCK_END_MARKER} A`);
    expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} B\nnew b\n# ${TEXT_BLOCK_END_MARKER} B`);
    expect(result).not.toContain("old a");
    expect(result).not.toContain("old b");
  });

  it("should append missing blocks when insertMode is append", () => {
    const input = "existing content";
    const result = replaceBlocks(input, { NEW: "new content" }, "#", "", "append");
    expect(result).toContain("existing content");
    expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} NEW\nnew content\n# ${TEXT_BLOCK_END_MARKER} NEW`);
  });

  it("should prepend missing blocks when insertMode is prepend", () => {
    const input = "existing content";
    const result = replaceBlocks(input, { NEW: "new content" }, "#", "", "prepend");
    expect(result).toContain("existing content");
    expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} NEW`);
    const beginIdx = result.indexOf(`# ${TEXT_BLOCK_START_MARKER} NEW`);
    const existingIdx = result.indexOf("existing content");
    expect(beginIdx).toBeLessThan(existingIdx);
  });

  it("should not insert when insertMode is not specified and block is missing", () => {
    const input = "existing content";
    const result = replaceBlocks(input, { MISSING: "new" }, "#");
    expect(result).toBe("existing content");
    expect(result).not.toContain(TEXT_BLOCK_START_MARKER);
  });

  it("should expand short-form markers before replacing", () => {
    const input = `# ${TEXT_BLOCK_SHORT_MARKER} mykey`;
    const result = replaceBlocks(input, { mykey: "content" }, "#");
    expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} mykey\ncontent\n# ${TEXT_BLOCK_END_MARKER} mykey`);
  });

  it("should handle empty blockMap", () => {
    const input = "some content";
    const result = replaceBlocks(input, {}, "#");
    expect(result).toBe("some content");
  });
});

// ---- _replaceSourceBlocks ----

describe("_replaceSourceBlocks", () => {
  it("should replace content between SOURCE_BEGIN/SOURCE_END markers", () => {
    const input = [
      `# ${TEXT_BLOCK_SOURCE_START_MARKER} path/file.bash`,
      "old content",
      `# ${TEXT_BLOCK_SOURCE_END_MARKER} path/file.bash`,
    ].join("\n");

    const result = _replaceSourceBlocks(input, { "path/file.bash": "new content" }, "#");
    expect(result).toContain(`# ${TEXT_BLOCK_SOURCE_START_MARKER} path/file.bash`);
    expect(result).toContain("new content");
    expect(result).toContain(`# ${TEXT_BLOCK_SOURCE_END_MARKER} path/file.bash`);
    expect(result).not.toContain("old content");
  });

  it("should replace multiple source blocks", () => {
    const input = [
      `# ${TEXT_BLOCK_SOURCE_START_MARKER} a.bash`,
      "old a",
      `# ${TEXT_BLOCK_SOURCE_END_MARKER} a.bash`,
      "",
      `# ${TEXT_BLOCK_SOURCE_START_MARKER} b.bash`,
      "old b",
      `# ${TEXT_BLOCK_SOURCE_END_MARKER} b.bash`,
    ].join("\n");

    const result = _replaceSourceBlocks(input, { "a.bash": "new a", "b.bash": "new b" }, "#");
    expect(result).toContain("new a");
    expect(result).toContain("new b");
    expect(result).not.toContain("old a");
    expect(result).not.toContain("old b");
  });

  it("should leave content unchanged when markers are not found", () => {
    const input = "no markers here";
    const result = _replaceSourceBlocks(input, { "missing.bash": "content" }, "#");
    expect(result).toBe("no markers here");
  });

  it("should handle empty blockMap", () => {
    const input = `# ${TEXT_BLOCK_SOURCE_START_MARKER} file.bash\nold\n# ${TEXT_BLOCK_SOURCE_END_MARKER} file.bash`;
    const result = _replaceSourceBlocks(input, {}, "#");
    expect(result).toBe(input);
  });

  it("should work with // comment prefix", () => {
    const input = [`// ${TEXT_BLOCK_SOURCE_START_MARKER} file.js`, "old", `// ${TEXT_BLOCK_SOURCE_END_MARKER} file.js`].join("\n");

    const result = _replaceSourceBlocks(input, { "file.js": "new" }, "//");
    expect(result).toContain("new");
    expect(result).not.toContain("\nold\n");
  });
});

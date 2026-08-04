import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { getIndexFunction, getIndexConstant, mockExecCommands, mockFsExistence, fileSystem, setSandboxGlobal } from "./setup.js";
import fs from "fs";

const mkdir = getIndexFunction("mkdir");
const copyFile = getIndexFunction("copyFile");
const deleteFolder = getIndexFunction("deleteFolder");
const deleteFile = getIndexFunction("deleteFile");
const execBash = getIndexFunction("execBash");
const gitClone = getIndexFunction("gitClone");
const calculatePercentage = getIndexFunction("calculatePercentage");
const printSectionBlock = getIndexFunction("printSectionBlock");
const printScriptProcessingResults = getIndexFunction("printScriptProcessingResults");
const downloadAsset = getIndexFunction("downloadAsset");
const downloadAssets = getIndexFunction("downloadAssets");
const isBinaryFound = getIndexFunction("isBinaryFound");
const backupConfigFile = getIndexFunction("backupConfigFile");
const backupProfileSnapshot = getIndexFunction("backupProfileSnapshot");
const _readRunTiming = getIndexFunction("_readRunTiming");
const backupProfileFilesToTempDir = getIndexFunction("backupProfileFilesToTempDir");

describe("execBash", () => {
  it("should execute command asynchronously by default", async () => {
    await execBash("echo hello");
    expect(mockExecCommands).toContain("echo hello");
  });

  it("should execute command synchronously when sync=true", () => {
    execBash("echo sync", true);
    expect(mockExecCommands).toContain("echo sync");
  });
});

describe("mkdir", () => {
  it("should call mkdir -p with the target path", async () => {
    await mkdir("/some/new/dir");
    expect(mockExecCommands.some((cmd) => cmd.includes("mkdir -p") && cmd.includes("/some/new/dir"))).toBe(true);
  });
});

describe("deleteFolder", () => {
  it("should call rm -rf for valid paths", async () => {
    await deleteFolder("/some/deep/dir");
    expect(mockExecCommands.some((cmd) => cmd.includes("rm -rf") && cmd.includes("/some/deep/dir"))).toBe(true);
  });

  it("should refuse to delete /", async () => {
    await deleteFolder("/");
    expect(mockExecCommands.some((cmd) => cmd.includes("rm"))).toBe(false);
  });

  it("should refuse to delete system directories", async () => {
    for (const dir of ["/bin", "/etc", "/home", "/usr", "/var", "/tmp"]) {
      mockExecCommands.length = 0;
      await deleteFolder(dir);
      expect(mockExecCommands.some((cmd) => cmd.includes("rm"))).toBe(false);
    }
  });

  it("should refuse to delete home directory itself", async () => {
    await deleteFolder("/mock/home");
    expect(mockExecCommands.some((cmd) => cmd.includes("rm"))).toBe(false);
  });

  it("should refuse to delete shallow paths like /mnt/c", async () => {
    await deleteFolder("/mnt/c");
    expect(mockExecCommands.some((cmd) => cmd.includes("rm"))).toBe(false);
  });

  it("should refuse to delete empty or null paths", async () => {
    await deleteFolder("");
    expect(mockExecCommands.some((cmd) => cmd.includes("rm"))).toBe(false);
    mockExecCommands.length = 0;
    await deleteFolder(null);
    expect(mockExecCommands.some((cmd) => cmd.includes("rm"))).toBe(false);
  });

  it("should allow deleting subdirectories of home", async () => {
    await deleteFolder("/mock/home/.some-tool");
    expect(mockExecCommands.some((cmd) => cmd.includes("rm -rf") && cmd.includes("/mock/home/.some-tool"))).toBe(true);
  });
});

describe("deleteFile", () => {
  it("should call rm -f for valid paths", async () => {
    await deleteFile("/some/deep/file.txt");
    expect(mockExecCommands.some((cmd) => cmd.includes("rm -f") && cmd.includes("/some/deep/file.txt"))).toBe(true);
  });

  it("should refuse to delete dangerous paths", async () => {
    await deleteFile("/");
    expect(mockExecCommands.some((cmd) => cmd.includes("rm"))).toBe(false);
  });
});

describe("gitClone", () => {
  it("should call git clone with --single-branch by default", async () => {
    await gitClone("https://github.com/user/repo.git", "/target");
    const cmd = mockExecCommands.find((c) => c.includes("git clone"));
    expect(cmd).toContain("--single-branch");
    expect(cmd).toContain("--depth 1");
    expect(cmd).toContain("https://github.com/user/repo.git");
    expect(cmd).toContain("/target");
  });

  it("should omit --single-branch when cloneAll is true", async () => {
    await gitClone("https://github.com/user/repo.git", "/target", true);
    const cmd = mockExecCommands.find((c) => c.includes("git clone"));
    expect(cmd).not.toContain("--single-branch");
  });
});

describe("printScriptProcessingResults", () => {
  it("should not throw with empty results", () => {
    expect(() => printScriptProcessingResults([])).not.toThrow();
  });

  it("should not throw with mixed results", () => {
    const results = [
      { file: "a.js", status: "success", tempFile: "/tmp/a" },
      { file: "b.js", status: "error", tempFile: "/tmp/b" },
    ];
    expect(() => printScriptProcessingResults(results)).not.toThrow();
  });
});

describe("printSectionBlock", () => {
  it("should not throw with header only", () => {
    expect(() => printSectionBlock("Test Section")).not.toThrow();
  });

  it("should not throw with header and lines", () => {
    expect(() => printSectionBlock("Test Section", ["line1", "line2"])).not.toThrow();
  });

  it("should not throw with addBlock=false", () => {
    expect(() => printSectionBlock("Test Section", [], false)).not.toThrow();
  });
});

describe("downloadAsset", () => {
  it("should call curl with the correct URL and destination", async () => {
    await downloadAsset("https://example.com/file.zip", "/tmp/file.zip");
    const cmd = mockExecCommands.find((c) => c.includes("curl"));
    expect(cmd).toContain("curl --parallel");
    expect(cmd).toContain("https://example.com/file.zip");
    expect(cmd).toContain("/tmp/file.zip");
  });

  it("should derive filename from URL when destination is a directory", async () => {
    mockFsExistence["/tmp/downloads"] = "dir";
    await downloadAsset("https://example.com/app.tar.gz", "/tmp/downloads");
    const cmd = mockExecCommands.find((c) => c.includes("curl"));
    expect(cmd).toContain("app.tar.gz");
  });

  it("should skip download when destination already exists", async () => {
    mockFsExistence["/tmp/existing.txt"] = true;
    const result = await downloadAsset("some/file.txt", "/tmp/existing.txt");
    expect(result).toBe("/tmp/existing.txt");
  });
});

describe("downloadAssets", () => {
  it("should call curl with --parallel for multiple URLs", async () => {
    await downloadAssets(["https://example.com/a.zip", "https://example.com/b.zip"], "/tmp/dest");
    const cmd = mockExecCommands.find((c) => c.includes("curl"));
    expect(cmd).toContain("--parallel");
    expect(cmd).toContain("--parallel-max 10");
    expect(cmd).toContain("a.zip");
    expect(cmd).toContain("b.zip");
  });
});

describe("isBinaryFound", () => {
  it("should call type -P with the binary name", async () => {
    await isBinaryFound("git");
    const cmd = mockExecCommands.find((c) => c.includes("type -P"));
    expect(cmd).toContain("type -P git");
  });

  it("should call type without -P when includeAliases is true", async () => {
    await isBinaryFound("g", true);
    const cmd = mockExecCommands.find((c) => c.includes("type g"));
    expect(cmd).toContain("type g");
    expect(cmd).not.toContain("type -P");
  });
});

describe("copyFile", () => {
  it("should fall back to readFileSync when copyFileSync throws", () => {
    fileSystem["/src/fallback.txt"] = "fallback content";
    copyFile("/src/fallback.txt", "/dest/fallback.txt");
    expect(fileSystem["/dest/fallback.txt"]).toBe("fallback content");
  });
});

describe("backupConfigFile", () => {
  beforeEach(() => {
    Object.keys(mockFsExistence).forEach((k) => delete mockFsExistence[k]);
    Object.keys(fileSystem).forEach((k) => delete fileSystem[k]);
  });

  it("should return early if file does not exist", async () => {
    await backupConfigFile("/mock/nonexistent.txt");
    expect(fileSystem["/mock/nonexistent.txt.bak_original"]).toBeUndefined();
  });

  it("should create original backup when it does not exist", async () => {
    mockFsExistence["/mock/config.txt"] = true;
    fileSystem["/mock/config.txt"] = "config content";
    await backupConfigFile("/mock/config.txt");
    expect(fileSystem["/mock/config.txt.bak_original"]).toBe("config content");
  });

  it("should skip original backup when it already exists", async () => {
    mockFsExistence["/mock/config.txt"] = true;
    mockFsExistence["/mock/config.txt.bak_original"] = true;
    fileSystem["/mock/config.txt"] = "new content";
    fileSystem["/mock/config.txt.bak_original"] = "old original";
    await backupConfigFile("/mock/config.txt");
    expect(fileSystem["/mock/config.txt.bak_original"]).toBe("old original");
  });

  it("should create latest backup when content differs from original", async () => {
    mockFsExistence["/mock/config.txt"] = true;
    mockFsExistence["/mock/config.txt.bak_original"] = true;
    fileSystem["/mock/config.txt"] = "current content";
    fileSystem["/mock/config.txt.bak_original"] = "original content";
    await backupConfigFile("/mock/config.txt");
    expect(fileSystem["/mock/config.txt.bak_latest"]).toBe("current content");
  });

  it("should skip latest backup when content matches original", async () => {
    mockFsExistence["/mock/config.txt"] = true;
    mockFsExistence["/mock/config.txt.bak_original"] = true;
    fileSystem["/mock/config.txt"] = "same content";
    fileSystem["/mock/config.txt.bak_original"] = "same content";
    await backupConfigFile("/mock/config.txt");
    expect(fileSystem["/mock/config.txt.bak_latest"]).toBeUndefined();
  });
});

describe("backupProfileSnapshot", () => {
  beforeEach(() => {
    Object.keys(mockFsExistence).forEach((k) => delete mockFsExistence[k]);
    Object.keys(fileSystem).forEach((k) => delete fileSystem[k]);
  });

  it("should return early if BASHRC_TEMP_DIR is not set", async () => {
    setSandboxGlobal("BASHRC_TEMP_DIR", "");
    await backupProfileSnapshot("test-snapshot.txt");
    expect(fileSystem["/mock/home/.bash_syle"]).toBeUndefined();
  });

  it("should write snapshot when BASHRC_TEMP_DIR is set and content exists", async () => {
    setSandboxGlobal("BASHRC_TEMP_DIR", "/tmp/test-backup");
    fileSystem["/mock/home/.bash_syle"] = "profile content";
    mockFsExistence["/mock/home/.bash_syle"] = true;
    await backupProfileSnapshot("snapshot.txt");
    expect(fileSystem["/tmp/test-backup/snapshot.txt"]).toBe("profile content");
  });

  it("should not write snapshot when content is empty", async () => {
    setSandboxGlobal("BASHRC_TEMP_DIR", "/tmp/test-backup");
    fileSystem["/mock/home/.bash_syle"] = "";
    mockFsExistence["/mock/home/.bash_syle"] = true;
    await backupProfileSnapshot("snapshot.txt");
    expect(fileSystem["/tmp/test-backup/snapshot.txt"]).toBeUndefined();
  });
});

describe("_readRunTiming", () => {
  beforeEach(() => {
    Object.keys(mockFsExistence).forEach((k) => delete mockFsExistence[k]);
    Object.keys(fileSystem).forEach((k) => delete fileSystem[k]);
  });

  it("should return empty object when BASHRC_TEMP_DIR is not set", () => {
    setSandboxGlobal("BASHRC_TEMP_DIR", "");
    const result = _readRunTiming();
    expect(result).toEqual({});
  });

  it("should parse timing JSON when file exists", () => {
    setSandboxGlobal("BASHRC_TEMP_DIR", "/tmp/test-timing");
    fileSystem["/tmp/test-timing/run_timing.json"] = JSON.stringify({ start: "2026-01-01", end: "2026-01-02" });
    const result = _readRunTiming();
    expect(result.start).toBe("2026-01-01");
  });

  it("should return empty object when timing file does not exist", () => {
    setSandboxGlobal("BASHRC_TEMP_DIR", "/tmp/test-timing");
    const result = _readRunTiming();
    expect(result).toEqual({});
  });
});

describe("backupProfileFilesToTempDir", () => {
  beforeEach(() => {
    Object.keys(mockFsExistence).forEach((k) => delete mockFsExistence[k]);
    Object.keys(fileSystem).forEach((k) => delete fileSystem[k]);
  });

  it("should return early if BASHRC_TEMP_DIR is not set", async () => {
    setSandboxGlobal("BASHRC_TEMP_DIR", "");
    await backupProfileFilesToTempDir("before");
    expect(mockExecCommands.some((c) => c.includes("mkdir"))).toBe(false);
  });

  it("should back up existing profile files", async () => {
    setSandboxGlobal("BASHRC_TEMP_DIR", "/tmp/test-prof");
    fileSystem["/mock/home/.bashrc"] = "bashrc content";
    fileSystem["/mock/home/.bash_profile"] = "bash_profile content";
    fileSystem["/mock/home/.bash_syle"] = "bash_syle content";
    mockFsExistence["/mock/home/.bashrc"] = true;
    mockFsExistence["/mock/home/.bash_profile"] = true;
    mockFsExistence["/mock/home/.bash_syle"] = true;
    await backupProfileFilesToTempDir("before");
    expect(fileSystem["/tmp/test-prof/before/.bashrc"]).toBe("bashrc content");
  });
});

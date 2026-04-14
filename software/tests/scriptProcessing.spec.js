import { describe, it, expect, afterEach } from "vitest";
import { getIndexFunction, getIndexConstant, mockExecCommands, mockFsExistence } from "./setup.js";
import fs from "fs";

const mkdir = getIndexFunction("mkdir");
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

import { describe, it, expect } from "vitest";
import { getIndexFunction, getIndexConstant, mockExecCommands } from "./setup.js";

const processScriptFile = getIndexFunction("processScriptFile");
const mkdir = getIndexFunction("mkdir");
const deleteFolder = getIndexFunction("deleteFolder");
const execBash = getIndexFunction("execBash");
const gitClone = getIndexFunction("gitClone");
const calculatePercentage = getIndexFunction("calculatePercentage");
const printSectionBlock = getIndexFunction("printSectionBlock");
const printScriptProcessingResults = getIndexFunction("printScriptProcessingResults");

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
  it("should call rm -rf by default", async () => {
    await deleteFolder("/some/dir");
    expect(mockExecCommands.some((cmd) => cmd.includes("rm -rf") && cmd.includes("/some/dir"))).toBe(true);
  });

  it("should call rm -f when recursive is false", async () => {
    await deleteFolder("/some/file.txt", false);
    expect(mockExecCommands.some((cmd) => cmd.includes("rm -f") && cmd.includes("/some/file.txt"))).toBe(true);
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

describe("processScriptFile", () => {
  // processScriptFile emits bash commands via emitBash (mocked as no-op)
  // We just verify it doesn't throw for different file types
  it("should handle .js files without error", () => {
    expect(() => processScriptFile("software/scripts/git.js", "git.js", [])).not.toThrow();
  });

  it("should handle .sh files without error", () => {
    expect(() => processScriptFile("software/scripts/test.sh", "test.sh", [])).not.toThrow();
  });

  it("should handle .su.js files without error", () => {
    expect(() => processScriptFile("software/scripts/etc-hosts.su.js", "etc-hosts.su.js", [])).not.toThrow();
  });

  it("should handle .sh.js files without error", () => {
    expect(() => processScriptFile("software/scripts/install.sh.js", "install.sh.js", [])).not.toThrow();
  });

  it("should handle .su.sh.js files without error", () => {
    expect(() => processScriptFile("software/scripts/fonts.su.sh.js", "fonts.su.sh.js", [])).not.toThrow();
  });

  it("should handle .su.sh files without error", () => {
    expect(() => processScriptFile("software/scripts/elevated.su.sh", "elevated.su.sh", [])).not.toThrow();
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

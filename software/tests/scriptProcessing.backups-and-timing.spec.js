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

const dedupeConfigBackups = getIndexFunction("dedupeConfigBackups");

const _backedUpConfigFiles = getIndexConstant("_backedUpConfigFiles");

const backupProfileSnapshot = getIndexFunction("backupProfileSnapshot");

const _readRunTiming = getIndexFunction("_readRunTiming");

const backupProfileFilesToTempDir = getIndexFunction("backupProfileFilesToTempDir");

describe("dedupeConfigBackups", () => {
  beforeEach(() => {
    Object.keys(mockFsExistence).forEach((k) => delete mockFsExistence[k]);
    Object.keys(fileSystem).forEach((k) => delete fileSystem[k]);
    _backedUpConfigFiles.clear();
  });

  /** Seed a live/original/latest trio in the mock fs and register it for the sweep. */
  function seed(base, { live, original, latest }) {
    mockFsExistence[base] = true;
    fileSystem[base] = live;
    if (original !== undefined) {
      mockFsExistence[`${base}.bak_original`] = true;
      fileSystem[`${base}.bak_original`] = original;
    }
    if (latest !== undefined) {
      mockFsExistence[`${base}.bak_latest`] = true;
      fileSystem[`${base}.bak_latest`] = latest;
    }
    _backedUpConfigFiles.add(base);
  }

  it("removes a .bak_latest identical to the live file", async () => {
    seed("/mock/home/f", { live: "live", original: "pristine", latest: "live" });
    await dedupeConfigBackups();
    expect(fileSystem["/mock/home/f.bak_latest"]).toBeUndefined();
    expect(fileSystem["/mock/home/f.bak_original"]).toBe("pristine");
  });

  it("removes a .bak_latest identical to the original", async () => {
    seed("/mock/home/f", { live: "live", original: "pristine", latest: "pristine" });
    await dedupeConfigBackups();
    expect(fileSystem["/mock/home/f.bak_latest"]).toBeUndefined();
    expect(fileSystem["/mock/home/f.bak_original"]).toBe("pristine");
  });

  it("keeps a .bak_latest that differs from both live and original", async () => {
    seed("/mock/home/f", { live: "v2", original: "pristine", latest: "v1" });
    await dedupeConfigBackups();
    expect(fileSystem["/mock/home/f.bak_latest"]).toBe("v1");
  });

  it("only touches files backed up this run", async () => {
    // Redundant on disk but never registered — the sweep must leave it alone.
    mockFsExistence["/mock/home/f"] = true;
    mockFsExistence["/mock/home/f.bak_latest"] = true;
    fileSystem["/mock/home/f"] = "live";
    fileSystem["/mock/home/f.bak_latest"] = "live";
    await dedupeConfigBackups();
    expect(fileSystem["/mock/home/f.bak_latest"]).toBe("live");
  });

  it("clears the tracking set after sweeping", async () => {
    seed("/mock/home/f", { live: "live", original: "pristine", latest: "v1" });
    await dedupeConfigBackups();
    expect(_backedUpConfigFiles.size).toBe(0);
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

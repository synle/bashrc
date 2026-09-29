/**
 * Tests for the JS last-run timestamp cache helpers (cacheLastrunPath,
 * isCacheLastrunDue, markCacheLastrun) — the mirror of the bash cache_lastrun_*
 * trio in software/bootstrap/profile-core.sh. Asserts the shared path convention
 * (cache-lastrun-<name>.timestamp) and the never-run / interval / corrupted-file
 * gate semantics.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getIndexFunction, getIndexConstant, setSandboxGlobal, fileSystem, getSandboxProcess } from "./setup.js";

const cacheLastrunPath = getIndexFunction("cacheLastrunPath");
const isCacheLastrunDue = getIndexFunction("isCacheLastrunDue");
const markCacheLastrun = getIndexFunction("markCacheLastrun");

// Redirect the base dir away from the real /tmp. writeFileSync/readFileSync are
// mocked to an in-memory map, so the "file" lives in `fileSystem` keyed by path.
const DIR = "/mock/tmp/lastrun";
const NAME = "unit-test-gate";
const FILE = `${DIR}/cache-lastrun-${NAME}.timestamp`;

describe("cache_lastrun (JS mirror of profile-core.sh)", () => {
  let proc;

  beforeEach(() => {
    proc = getSandboxProcess();
    proc.env.BASHRC_CACHE_LASTRUN_DIR = DIR;
    for (const k of Object.keys(fileSystem)) delete fileSystem[k];
  });

  afterEach(() => {
    delete proc.env.BASHRC_CACHE_LASTRUN_DIR;
    for (const k of Object.keys(fileSystem)) delete fileSystem[k];
  });

  it("builds /<dir>/cache-lastrun-<name>.timestamp", () => {
    expect(cacheLastrunPath(NAME)).toBe(FILE);
  });

  it("is due when the gate has never run (no file)", () => {
    expect(isCacheLastrunDue(NAME, 3600)).toBe(true);
  });

  it("is not due immediately after a mark", () => {
    markCacheLastrun(NAME);
    expect(fileSystem[FILE]).toMatch(/^\d+$/);
    expect(isCacheLastrunDue(NAME, 3600)).toBe(false);
  });

  it("is due again once the interval has elapsed", () => {
    fileSystem[FILE] = String(Math.floor(Date.now() / 1000) - 7200); // 2h ago
    expect(isCacheLastrunDue(NAME, 3600)).toBe(true); // interval 1h
  });

  it("is due exactly at the interval boundary (age >= interval)", () => {
    fileSystem[FILE] = String(Math.floor(Date.now() / 1000) - 3600);
    expect(isCacheLastrunDue(NAME, 3600)).toBe(true);
  });

  it("treats empty or non-numeric contents as never-run", () => {
    fileSystem[FILE] = "";
    expect(isCacheLastrunDue(NAME, 3600)).toBe(true);
    fileSystem[FILE] = "garbage";
    expect(isCacheLastrunDue(NAME, 3600)).toBe(true);
  });

  describe("write failures are logged, not swallowed", () => {
    const sandboxFs = getIndexConstant("fs");
    let originalWrite;
    let originalMkdir;
    let originalLog;
    let logged;

    beforeEach(() => {
      originalWrite = sandboxFs.writeFileSync;
      originalMkdir = sandboxFs.mkdirSync;
      sandboxFs.mkdirSync = () => undefined; // real mkdir would hit the fake /mock root
      originalLog = getIndexFunction("log");
      logged = [];
      setSandboxGlobal("log", (...args) => logged.push(args.join(" ")));
    });

    afterEach(() => {
      sandboxFs.writeFileSync = originalWrite;
      sandboxFs.mkdirSync = originalMkdir;
      setSandboxGlobal("log", originalLog);
    });

    it("logs a warning naming the stamp file when the write fails with EACCES", () => {
      sandboxFs.writeFileSync = () => {
        throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
      };
      expect(() => markCacheLastrun(NAME)).not.toThrow();
      expect(logged).toEqual([`>> Warning: write last-run stamp ${FILE} failed: EACCES: permission denied`]);
    });

    it("stays silent on a successful write", () => {
      markCacheLastrun(NAME);
      expect(logged).toEqual([]);
    });
  });
});

describe("_warnUnlessErrorCode", () => {
  const warnUnlessErrorCode = getIndexFunction("_warnUnlessErrorCode");
  let originalLog;
  let logged;

  beforeEach(() => {
    originalLog = getIndexFunction("log");
    logged = [];
    setSandboxGlobal("log", (...args) => logged.push(args.join(" ")));
  });

  afterEach(() => setSandboxGlobal("log", originalLog));

  it("is silent when the error code is expected", () => {
    warnUnlessErrorCode(Object.assign(new Error("gone"), { code: "ENOENT" }), ["ENOENT"], "stat x");
    expect(logged).toEqual([]);
  });

  it("warns when the error code is not expected", () => {
    warnUnlessErrorCode(Object.assign(new Error("full"), { code: "ENOSPC" }), ["ENOENT"], "write x");
    expect(logged).toEqual([">> Warning: write x failed: full"]);
  });

  it("warns when the error has no code", () => {
    warnUnlessErrorCode("boom", ["ENOENT"], "op");
    expect(logged).toEqual([">> Warning: op failed: boom"]);
  });
});

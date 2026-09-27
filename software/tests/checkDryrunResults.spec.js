/** Tests for software/tools/check-dryrun-results.js — failure extraction from run_timing.json. */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
// Default ESM import (not require) so Vite's transform instruments it for coverage.
import checkDryrunResults from "../tools/check-dryrun-results.js";

const { findFailures, findTimingFile } = checkDryrunResults;

describe("findFailures", () => {
  it("returns no failures when every script succeeded or skipped", () => {
    const timing = {
      scripts: { "a.js": { status: "success" }, "b.js": { status: "skipped", error: "not mac" } },
      results: [{ file: "a.js", status: "success" }],
    };
    expect(findFailures(timing)).toEqual([]);
  });

  it("reports a script that threw, with its error text", () => {
    const timing = { scripts: { "a.js": { status: "error", error: "Error: boom" } } };
    expect(findFailures(timing)).toEqual([{ file: "a.js", detail: "Error: boom" }]);
  });

  it("reports a --files entry that failed to resolve", () => {
    const timing = { results: [{ file: "nope.js", status: "error", description: "does not exist" }] };
    expect(findFailures(timing)).toEqual([{ file: "nope.js", detail: "does not exist" }]);
  });

  it("lists a file failing in both sections only once, keeping the script error", () => {
    const timing = {
      scripts: { "a.js": { status: "error", error: "Error: boom" } },
      results: [{ file: "a.js", status: "error", description: "resolution" }],
    };
    expect(findFailures(timing)).toEqual([{ file: "a.js", detail: "Error: boom" }]);
  });

  it("returns no failures for an empty timing object", () => {
    expect(findFailures({})).toEqual([]);
  });
});

describe("findTimingFile", () => {
  let root = "";

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "check-dryrun-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  /**
   * Writes `<root>/<runFolder>/run_timing.json` with the given mtime.
   * @param {string} runFolder - Run folder name
   * @param {number} mtimeMs - Modification time to stamp
   * @returns {string} Path to the written file
   */
  function writeTiming(runFolder, mtimeMs) {
    fs.mkdirSync(path.join(root, runFolder));
    const file = path.join(root, runFolder, "run_timing.json");
    fs.writeFileSync(file, "{}");
    fs.utimesSync(file, mtimeMs / 1000, mtimeMs / 1000);
    return file;
  }

  it("picks the newest timing file written at or after the start time", () => {
    writeTiming("2026_01_01_00_00", 1_000_000);
    const newest = writeTiming("2026_01_01_00_02", 3_000_000);
    writeTiming("2026_01_01_00_01", 2_000_000);
    expect(findTimingFile([root], 1_500_000)).toBe(newest);
  });

  it("returns an empty string when every timing file predates the start time", () => {
    writeTiming("2026_01_01_00_00", 1_000_000);
    expect(findTimingFile([root], 2_000_000)).toBe("");
  });

  it("ignores a missing root and sibling log files that are not run folders", () => {
    fs.writeFileSync(path.join(root, "bashrc_bg_brew_1.log"), "log");
    const file = writeTiming("2026_01_01_00_00", 5_000_000);
    expect(findTimingFile([path.join(root, "does-not-exist"), root], 0)).toBe(file);
  });
});

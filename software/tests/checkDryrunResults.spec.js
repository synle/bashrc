/** Tests for software/tools/check-dryrun-results.js — failure extraction from run_timing.json. */
import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { findFailures } = require("../tools/check-dryrun-results.js");

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

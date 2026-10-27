/** Make targets keep routine checks quiet without changing verbose validation. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";

/** Expected npm command for each user-facing validation entry point. */
const TARGETS = [
  ["precommit", "npm test -- --reporter=dot --silent=passed-only"],
  ["test_unit", "npm test"],
  ["validate", "npm test"],
];

describe("Make test output", () => {
  it.each(TARGETS)("selects the intended reporter for %s", (target, command) => {
    const result = spawnSync("make", ["--no-print-directory", "--dry-run", target], {
      encoding: "utf8",
      timeout: 5000,
      env: { ...process.env, BASH_ENV: "/dev/null", MAKEFLAGS: "" },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.split("\n").filter((line) => /^npm test(?:\s|$)/.test(line))).toEqual([command]);
  });
});

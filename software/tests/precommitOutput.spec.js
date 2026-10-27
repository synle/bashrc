/** Make targets keep routine checks quiet without changing verbose validation or hiding failures. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import unitConfig from "../../vitest.config.js";
import integrationConfig from "../../vitest.integration.config.js";

/** Expected unit and integration commands for each user-facing validation entry point. */
const TARGETS = [
  ["precommit", "npm test -- --reporter=dot --silent=passed-only 2> >(command grep -v '^>>> Decky ' >&2)", []],
  ["test_unit", "npm test", []],
  ["validate", "npm test", ["npm run test:integration:local"]],
];

/**
 * Run the real Make target against owned npm/lint executables that emit deterministic diagnostics.
 * @param {string} target - Precommit or verbose unit target.
 * @param {number} npmStatus - Exit status produced by the owned npm executable.
 * @returns {import("child_process").SpawnSyncReturns<string>} Actual Make status, stdout, and stderr; fixture cleanup always runs.
 */
function makeWithDiagnostics(target, npmStatus) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "precommit-output-"));
  try {
    fs.writeFileSync(path.join(folder, "npx"), "#!/bin/bash\nexit 0\n", { mode: 0o755 });
    fs.writeFileSync(
      path.join(folder, "npm"),
      [
        "#!/bin/bash",
        "printf '%s\\n' 'RESULT:stub-tests'",
        "printf '%s\\n' '>>> Decky phase=complete' >&2",
        "printf '%s\\n' '>>> Other diagnostic' >&2",
        'exit "$FAKE_NPM_STATUS"',
        "",
      ].join("\n"),
      { mode: 0o755 },
    );
    return spawnSync("make", ["--no-print-directory", "-f", path.resolve("Makefile"), target], {
      cwd: folder,
      encoding: "utf8",
      timeout: 5000,
      env: {
        ...process.env,
        BASH_ENV: "/dev/null",
        MAKEFLAGS: "",
        PATH: `${folder}${path.delimiter}${process.env.PATH}`,
        FAKE_NPM_STATUS: String(npmStatus),
      },
    });
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

describe("Test suite boundaries", () => {
  it("excludes the integration tree from default unit discovery", () => {
    expect(unitConfig.test.exclude).toContain("software/tests/integration/**");
  });

  it("discovers all integration specs with the shared native-fixture setup", () => {
    expect(integrationConfig.test.include).toEqual(["software/tests/integration/**/*.spec.js"]);
    expect(integrationConfig.test.setupFiles).toEqual(["software/tests/setup.js"]);
    expect(integrationConfig.test.maxWorkers).toBe(2);
  });
});

describe("Make test output", () => {
  it.each(TARGETS)("selects the intended reporter and test suites for %s", (target, command, integrationCommands) => {
    const result = spawnSync("make", ["--no-print-directory", "--dry-run", target], {
      encoding: "utf8",
      timeout: 5000,
      env: { ...process.env, BASH_ENV: "/dev/null", MAKEFLAGS: "" },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.split("\n").filter((line) => /^npm test(?:\s|$)/.test(line))).toEqual([command]);
    expect(result.stdout.split("\n").filter((line) => /^npm run test:integration(?:\s|:|$)/.test(line))).toEqual(integrationCommands);
  });

  it.each([
    ["precommit", 0, 0, false],
    ["precommit", 7, 2, false],
    ["test_unit", 0, 0, true],
  ])("preserves diagnostics and status for %s with npm exit %i", (target, npmStatus, makeStatus, deckyVisible) => {
    const result = makeWithDiagnostics(target, npmStatus);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(makeStatus);
    expect(result.stdout).toContain("RESULT:stub-tests");
    expect(result.stderr).toContain(">>> Other diagnostic");
    expect(result.stderr.includes(">>> Decky phase=complete")).toBe(deckyVisible);
  });
});

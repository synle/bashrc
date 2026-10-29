/** Batch diagnostics for optional shell validation; input scripts never execute. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import validator from "../../tools/validate-shell-agnostic.js";

/** Real analyzers are required only for native syntax and policy fixtures. */
const analyzersAvailable = ["shellcheck", "shfmt"].every((binary) => spawnSync(binary, ["--version"], { timeout: 5000 }).status === 0);
/** Resolve the CLI before running fixtures with isolated startup settings. */
const cli = path.resolve("software/tools/validate-shell-agnostic.js");
/** Each case owns its temporary sources and environment. */
let folder;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "shell-agnostic-batch-"));
});
afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

/**
 * Write isolated shell source without executing it.
 * @param {string} name Literal filename.
 * @param {string} source Source bytes.
 * @returns {string} Absolute filename.
 */
function fixture(name, source) {
  const file = path.join(folder, name);
  fs.writeFileSync(file, source);
  return file;
}

/**
 * Run a validator entry point with personal startup loading disabled.
 * @param {string} binary Executable filename.
 * @param {string[]} args Literal arguments.
 * @param {object} env Per-test environment overrides.
 * @returns {import("child_process").SpawnSyncReturns<string>} Exit status and captured output.
 */
function run(binary, args, env = {}) {
  return spawnSync(binary, args, {
    env: { ...process.env, BASH_ENV: "", ENV: "", HOME: folder, ZDOTDIR: folder, ...env },
    encoding: "utf8",
    timeout: 15000,
  });
}

describe.skipIf(!analyzersAvailable)("batch analyzer failures", () => {
  it("retains findings before and after rejected files and deduplicates failures", () => {
    const before = fixture("before.sh", "#!/bin/sh\necho before\n");
    const first = fixture("first broken.sh", "#!/bin/sh\nif\n");
    const second = fixture("second.sh", "#!/bin/sh\nif\n");
    const after = fixture("after.sh", "#!/bin/sh\necho after\necho again\n");
    const result = validator.validateShellFiles([before, first, second, first, after], "printf");
    expect({
      ...result,
      findings: result.findings.map(({ file, code, line, column }) => ({ file: path.basename(file), code, line, column })),
      errors: result.errors?.map(({ file, code }) => ({ file: path.basename(file), code })),
    }).toMatchInlineSnapshot(`
      {
        "checkedFiles": 4,
        "errors": [
          {
            "code": "VALIDATION_UNAVAILABLE",
            "file": "first broken.sh",
          },
          {
            "code": "VALIDATION_UNAVAILABLE",
            "file": "second.sh",
          },
        ],
        "findings": [
          {
            "code": "AGNOSTIC_PRINTF",
            "column": 1,
            "file": "before.sh",
            "line": 2,
          },
          {
            "code": "AGNOSTIC_PRINTF",
            "column": 1,
            "file": "after.sh",
            "line": 3,
          },
          {
            "code": "AGNOSTIC_PRINTF",
            "column": 1,
            "file": "after.sh",
            "line": 2,
          },
        ],
        "ok": false,
        "rule": "printf",
      }
    `);
    expect(result.errors[0].message).toMatch(/^shfmt: 2:1:/);
    expect(result.errors[1].message).toMatch(/^shfmt: 2:1:/);
  });

  it("returns CLI status 2 and a complete report when every file fails to parse", () => {
    const first = fixture("first.sh", "#!/bin/sh\nif\n");
    const second = fixture("second.sh", "#!/bin/sh\nif\n");
    const result = run(process.execPath, [cli, "printf", first, second]);
    expect(result.status).toBe(2);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({
      ok: false,
      rule: "printf",
      checkedFiles: 2,
      findings: [],
      errors: [
        { file: first, code: "VALIDATION_UNAVAILABLE", message: expect.stringMatching(/^shfmt: 2:1:/) },
        { file: second, code: "VALIDATION_UNAVAILABLE", message: expect.stringMatching(/^shfmt: 2:1:/) },
      ],
    });
  });

  it("keeps Make's JSON-array scope and reports findings after a parser error", () => {
    const first = fixture("broken ; file.sh", "#!/bin/sh\nif\n");
    const second = fixture("later file.sh", "#!/bin/sh\necho later\n");
    const result = run("make", ["-s", "validate_shell_agnostic_printf", `files=${JSON.stringify([first, second])}`]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Error 2");
    const report = JSON.parse(result.stdout);
    expect(report.checkedFiles).toBe(2);
    expect(report.findings).toEqual([
      { file: second, code: "AGNOSTIC_PRINTF", line: 2, column: 1, message: expect.stringContaining("printf") },
    ]);
    expect(report.errors).toEqual([{ file: first, code: "VALIDATION_UNAVAILABLE", message: expect.stringMatching(/^shfmt: 2:1:/) }]);
  });
});

it("keeps invalid rules fatal instead of treating them as per-file analyzer errors", () => {
  const file = fixture("shared.sh", "");
  expect(() => validator.validateShellFiles([file], "unknown")).toThrow(/^rule:/);
});

it("reports unavailable analyzers for every selected file without a false pass", () => {
  const first = fixture("first.sh", "");
  const second = fixture("second.sh", "");
  const result = run(process.execPath, [cli, "options", first, second], { PATH: folder });
  expect(result.status).toBe(2);
  expect(result.stderr).toBe("");
  expect(JSON.parse(result.stdout)).toEqual({
    ok: false,
    rule: "options",
    checkedFiles: 2,
    findings: [],
    errors: [
      { file: first, code: "VALIDATION_UNAVAILABLE", message: expect.stringMatching(/^shfmt: ENOENT;/) },
      { file: second, code: "VALIDATION_UNAVAILABLE", message: expect.stringMatching(/^shfmt: ENOENT;/) },
    ],
  });
});

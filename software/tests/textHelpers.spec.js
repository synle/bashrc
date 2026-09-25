/** Behavior tests for shell text helpers in profile-advanced.sh. */
import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE_CORE = path.join(ROOT_DIR, "software/bootstrap/profile-core.sh");
const PROFILE_ADVANCED = path.join(ROOT_DIR, "software/bootstrap/profile-advanced.sh");

/**
 * Extract a shell function whose closing brace sits alone on a line.
 * @param {string} source Shell source text.
 * @param {string} name Function name.
 * @returns {string} Function definition.
 */
function extractSimpleFunction(source, name) {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line === `function ${name}() {`);
  if (start === -1) throw new Error(`could not locate function ${name}`);

  const end = lines.findIndex((line, index) => index > start && line === "}");
  if (end === -1) throw new Error(`could not locate closing brace for ${name}`);
  return lines.slice(start, end + 1).join("\n");
}

/**
 * Extract source between two stable line markers.
 * @param {string} source Shell source text.
 * @param {string} startMarker Inclusive start marker.
 * @param {string} endMarker Exclusive end marker.
 * @returns {string} Extracted shell source.
 */
function extractSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1) throw new Error(`could not locate section ${startMarker}`);
  return source.slice(start, end);
}

const coreSource = fs.readFileSync(PROFILE_CORE, "utf8");
const advancedSource = fs.readFileSync(PROFILE_ADVANCED, "utf8");
const helperSource = [
  extractSimpleFunction(coreSource, "is_help_arg"),
  extractSection(advancedSource, "function _truncate_at()", "function pwd2()"),
  extractSimpleFunction(advancedSource, "tldr"),
].join("\n");

/**
 * Execute one command with only the text helpers and their help dependencies loaded.
 * @param {string} command Shell command to execute.
 * @returns {import("child_process").SpawnSyncReturns<string>} Process result.
 */
function runShellResult(command) {
  return spawnSync("/bin/bash", [], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    input: `${helperSource}\n${command}\n`,
  });
}

/**
 * Execute one successful helper command and return stdout.
 * @param {string} command Shell command to execute.
 * @returns {string} Command stdout.
 */
function runShell(command) {
  const result = runShellResult(command);
  if (result.status !== 0) {
    throw new Error(`shell command failed with ${result.status}:\n${result.stderr}`);
  }
  return result.stdout;
}

describe("profile text helpers", () => {
  it("truncate_after keeps through the last literal target", () => {
    expect(runShell(String.raw`printf '%s\n' 'alpha.*beta.*gamma' | truncate_after '.*'`)).toBe("alpha.*beta.*\n");
  });

  it("truncate aliases truncate_after", () => {
    expect(
      runShell(String.raw`shopt -s expand_aliases
printf '%s\n' 'alpha/target/omega' | truncate '/target'`),
    ).toBe("alpha/target\n");
  });

  it("truncate drops lines without the target", () => {
    expect(
      runShell(String.raw`shopt -s expand_aliases
printf '%s\n' \
  'tde-tool-backend-worker ltx1 tde-tool-backend.stg extra' \
  'tde-tool-backend lva2 tde-tool-backend.prod extra' |
  truncate 'stg'`),
    ).toBe("tde-tool-backend-worker ltx1 tde-tool-backend.stg\n");
  });

  it("truncate_before keeps from the last literal target", () => {
    expect(runShell(String.raw`printf '%s\n' 'alpha.*beta.*gamma' | truncate_before '.*'`)).toBe(".*gamma\n");
  });

  it("trim removes only leading and trailing horizontal whitespace", () => {
    expect(runShell(String.raw`printf '  alpha beta  \n\tgamma\t\n' | trim`)).toBe("alpha beta\ngamma\n");
  });

  it("get_column treats runs of spaces and tabs as one delimiter", () => {
    expect(runShell(String.raw`printf 'alpha   beta\tgamma\n' | get_column 3`)).toBe("gamma\n");
  });

  it("get_columns prints selected columns in requested order", () => {
    expect(runShell(String.raw`printf '%s\n' 'alpha beta gamma delta' | get_columns 4 2 1`)).toBe("delta beta alpha\n");
  });

  it("get_columns passes input through when no columns are provided", () => {
    expect(runShell(String.raw`printf '%s\n' 'alpha beta' | get_columns`)).toBe("alpha beta\n");
  });

  it("get_column_by treats its delimiter as literal text", () => {
    expect(runShell(String.raw`printf '%s\n' 'alpha.*beta.*gamma' | get_column_by '.*' 2`)).toBe("beta\n");
  });

  it("get_columns rejects a non-numeric column", () => {
    const result = runShellResult(String.raw`printf '%s\n' 'alpha beta' | get_columns 1 nope`);
    expect(result.status).toBe(2);
    expect(result.stderr).toBe("get_columns: every column must be a positive integer\n");
  });

  for (const name of ["truncate_after", "truncate_before", "trim", "get_column", "get_columns", "get_column_by"]) {
    it(`${name} exposes /? help through tldr`, () => {
      const directHelp = runShell(`${name} /?`);
      expect(directHelp).toContain(`${name}:`);
      expect(directHelp).toContain("Usage:");
      expect(directHelp).toContain("Example:");
      expect(runShell(`tldr ${name}`)).toBe(directHelp);
    });
  }
});

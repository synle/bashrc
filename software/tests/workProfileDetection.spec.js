/** Work-profile detection tests for software/bootstrap/common-env.sh. */
import { afterAll, describe, expect, it } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const COMMON_ENV = path.join(ROOT_DIR, "software/bootstrap/common-env.sh");
const WINDOWS_INIT = path.join(ROOT_DIR, "software/scripts/windows/_init.js");
const WINDOWS_SETUP = path.join(ROOT_DIR, "software/scripts/windows/_full-setup.ps1.bash");
const POWERSHELL_PROFILE = path.join(ROOT_DIR, "software/scripts/windows/powershell-profile.ps1.bash");
const TEST_BIN = fs.mkdtempSync("/tmp/work_profile_detection_");
fs.writeFileSync(path.join(TEST_BIN, "hostname"), "#!/bin/bash\ncommand printf '%s\\n' \"$TEST_HOSTNAME\"\n", { mode: 0o755 });

afterAll(() => fs.rmSync(TEST_BIN, { recursive: true, force: true }));

/**
 * Extracts one top-level Bash function from common-env.sh.
 * @param {string} name - Function name.
 * @returns {string} Function definition.
 */
function extractFunction(name) {
  const lines = fs.readFileSync(COMMON_ENV, "utf-8").split("\n");
  const start = lines.findIndex((line) => line === `function ${name}() {`);
  if (start === -1) throw new Error(`could not locate function ${name}`);
  let depth = 0;
  for (let index = start; index < lines.length; index++) {
    depth += (lines[index].match(/{/g) || []).length;
    depth -= (lines[index].match(/}/g) || []).length;
    if (depth === 0) return lines.slice(start, index + 1).join("\n");
  }
  throw new Error(`could not locate closing brace for ${name}`);
}

const DETECTOR = extractFunction("_detect_work_profile");
const IS_TRUTHY = extractFunction("is_truthy");

/**
 * Runs the real detector with a controlled OS, hostname, and optional override.
 * @param {{ isMac?: boolean, hostname?: string, override?: string }} options - Detector inputs.
 * @returns {number} Resolved is_work_profile value.
 */
function detectWorkProfile({ isMac = false, hostname = "personal.local", override } = {}) {
  const script = [
    IS_TRUTHY,
    DETECTOR,
    "function is_help_arg() { return 1; }",
    `export TEST_HOSTNAME=${JSON.stringify(hostname)}`,
    `export PATH=${JSON.stringify(`${TEST_BIN}:/usr/bin:/bin`)}`,
    `export is_os_mac=${isMac ? 1 : 0}`,
    "unset _IS_WORK_PROFILE_OVERRIDE",
    ...(override === undefined ? [] : [`export _IS_WORK_PROFILE_OVERRIDE=${JSON.stringify(override)}`]),
    "_detect_work_profile",
    "command printf '%s\\n' \"$is_work_profile\"",
  ].join("\n");
  return Number(execFileSync("/bin/bash", ["-c", script], { encoding: "utf-8" }).trim());
}

describe("_detect_work_profile", () => {
  it("defaults to personal off macOS", () => {
    expect(detectWorkProfile({ hostname: "managed.example.com" })).toBe(0);
  });

  it("treats a macOS .local hostname as personal case-insensitively", () => {
    expect(detectWorkProfile({ isMac: true, hostname: "Personal-Mac.LOCAL" })).toBe(0);
  });

  it("treats a macOS hostname without .local as work", () => {
    expect(detectWorkProfile({ isMac: true, hostname: "managed.example.com" })).toBe(1);
  });

  it("lets an explicit false override beat macOS detection", () => {
    expect(detectWorkProfile({ isMac: true, hostname: "managed.example.com", override: "0" })).toBe(0);
  });

  it("lets a truthy override enable work profile off macOS", () => {
    expect(detectWorkProfile({ hostname: "personal.local", override: "yes" })).toBe(1);
  });
});

describe("Windows work-profile templates", () => {
  it("renders every work-profile placeholder through windows/_init.js", () => {
    const initSource = fs.readFileSync(WINDOWS_INIT, "utf-8");
    for (const template of [WINDOWS_SETUP, POWERSHELL_PROFILE]) {
      expect(fs.readFileSync(template, "utf-8")).toContain("<<IS_WORK_PROFILE>>");
    }
    expect(initSource.match(/IS_WORK_PROFILE: Number\(is_work_profile\)/g)).toHaveLength(2);
  });

  it("builds the firewall port list without a null-producing inline conditional", () => {
    const setupSource = fs.readFileSync(WINDOWS_SETUP, "utf-8");
    expect(setupSource).toContain("$devStackPorts += 11434 # Ollama REST API");
    expect(setupSource).toContain("Ports = $devStackPorts");
    expect(setupSource).not.toMatch(/\$\(if \(<<IS_WORK_PROFILE>>/);
  });
});

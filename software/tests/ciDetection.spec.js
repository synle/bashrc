/** Verifies run.sh and index.js interpret CI values identically. */
import { describe, expect, it } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getIndexFunction } from "./setup.js";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RUN_SH = path.join(ROOT_DIR, "run.sh");
const parseBoolean = getIndexFunction("parseBoolean");

/**
 * Extracts and evaluates run.sh's CI detection block.
 * @param {string|undefined} value - CI environment value.
 * @returns {boolean} Shell-side CI result.
 */
function detectShellCi(value) {
  const source = fs.readFileSync(RUN_SH, "utf-8");
  const match = source.match(/IS_CI=0\ncase .*?\n/s);
  if (!match) throw new Error("could not locate CI detection block in run.sh");

  const prior = process.env.CI;
  if (value === undefined) delete process.env.CI;
  else process.env.CI = value;
  try {
    const script = `${match[0]}command printf '%s' "$IS_CI"`;
    return execFileSync("/bin/bash", ["-c", script], { encoding: "utf-8", env: process.env }).trim() === "1";
  } finally {
    if (prior === undefined) delete process.env.CI;
    else process.env.CI = prior;
  }
}

describe("CI detection parity", () => {
  it.each([undefined, "", "false", "FALSE", "0", "true", "TRUE", "1", "yes", "random"])("matches parseBoolean for %s", (value) => {
    expect(detectShellCi(value)).toBe(parseBoolean(value));
  });
});

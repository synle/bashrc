import crypto from "crypto";
import fs from "fs";
import ts from "typescript";

/**
 * Parses a controlled JSONC file and raises when it contains invalid syntax.
 * @param {string} filePath - JSONC file path.
 * @returns {object} Parsed JSONC value.
 */
export function readNativeEvidence(filePath) {
  const parsed = ts.parseConfigFileTextToJson(filePath, fs.readFileSync(filePath, "utf8"));
  if (parsed.error) throw new Error(`Invalid native evidence input: ${filePath}`);
  return parsed.config;
}

/**
 * Hashes source bytes for evidence that binds measurements to exact theme inputs.
 * @param {string} filePath - Source file path.
 * @returns {string} Lowercase SHA-256 digest.
 */
export function digestNativeEvidence(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

/** @type {object} Native theme-consumption evidence parsed from the checked-in JSONC source. */
export const nativeConsumptionEvidence = readNativeEvidence("theme/native-consumption.jsonc");

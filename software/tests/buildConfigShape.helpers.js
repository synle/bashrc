import fs from "fs";
import path from "path";
import toml from "@iarna/toml";
import { XMLParser } from "fast-xml-parser";
import { parse as parseJsonc } from "jsonc-parser";
import YAML from "yaml";

/**
 * Warns and returns true when a generated artifact is unavailable locally.
 * @param {string} filename - Artifact filename inside `.build/`.
 * @returns {boolean} Whether the artifact is missing.
 */
export function warnIfBuildArtifactMissing(filename) {
  const filePath = path.resolve(".build", filename);
  if (fs.existsSync(filePath)) return false;

  console.warn(`[WARNING] .build/${filename} not found - skipping (not generated in this environment)`);
  return true;
}

/**
 * Reads a generated text artifact from `.build/`.
 * @param {string} filename - Artifact filename inside `.build/`.
 * @returns {string} Artifact contents.
 */
export function readBuildText(filename) {
  return fs.readFileSync(path.resolve(".build", filename), "utf-8");
}

/**
 * Reads and parses a generated JSON or JSONC artifact from `.build/`.
 * @param {string} filename - Artifact filename inside `.build/`.
 * @returns {object|Array} Parsed JSON value.
 */
export function readBuildJson(filename) {
  const errors = [];
  const value = parseJsonc(readBuildText(filename), errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    throw new SyntaxError(`Invalid JSONC in .build/${filename} (${errors.length} parse errors)`);
  }
  return value;
}

/**
 * Parses XML text into a JavaScript object while preserving attributes as string properties.
 * @param {string} content - XML source text.
 * @returns {object} Parsed XML document.
 */
export function parseBuildXml(content) {
  return new XMLParser({ ignoreAttributes: false, parseAttributeValue: false, parseTagValue: false }).parse(content);
}

/**
 * Reads and parses an XML artifact from `.build/`.
 * @param {string} filename - Artifact filename inside `.build/`.
 * @returns {object} Parsed XML document.
 */
export function readBuildXml(filename) {
  return parseBuildXml(readBuildText(filename));
}

/**
 * Parses YAML text into a JavaScript value for snapshot comparison.
 * @param {string} content - YAML source text.
 * @returns {any} Parsed YAML value.
 */
export function parseBuildYaml(content) {
  return YAML.parse(content);
}

/**
 * Parses TOML text into a JavaScript value for snapshot comparison.
 * @param {string} content - TOML source text.
 * @returns {object} Parsed TOML value.
 */
export function parseBuildToml(content) {
  return toml.parse(content);
}

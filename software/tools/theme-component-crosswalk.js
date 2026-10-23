/** Inventories active/captured theme component keys and named states without exporting baseline color values. */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

/** Supported source identities, including explicit capability records rather than invented native keys. */
const APPS = ["vscode", "sublime", "zed", "vim", "ghostty", "windows_terminal", "termux", "claude", "pi", "opencode", "gemini", "copilot"];
/** Metadata never represents a native component or renderer input. */
const METADATA = new Set(["$schema", "name", "author", "appearance", "type"]);

/**
 * Returns named states encoded in a native key; this labels keys, not all runtime state combinations.
 * @param {string} key - Native component identity.
 * @returns {string[]} Stable state labels; unqualified keys have the default state.
 */
function statesFor(key) {
  const lower = key.toLowerCase();
  const states = [];
  if (/inactive|unfocused|noncurrent/.test(lower)) states.push("unfocused");
  if (/active|focused/.test(lower.replace(/inactive|unfocused/g, ""))) states.push("active");
  if (/hover/.test(lower)) states.push("hover");
  if (/select|visual/.test(lower)) states.push("selection");
  if (/pressed/.test(lower)) states.push("pressed");
  if (/disabled|inactive/.test(lower)) states.push("dimmed");
  if (/error|warning|hint|success|diagnostic|spell/.test(lower)) states.push("diagnostic");
  if (/diff|added|removed|deleted|change/.test(lower)) states.push("diff");
  if (/cursor|caret/.test(lower)) states.push("cursor");
  return states.length ? states : ["default"];
}

/**
 * Flattens renderer data into stable key paths, omitting metadata and all values.
 * @param {object} source - Native object or renderer section.
 * @param {string} prefix - Section identity.
 * @returns {string[]} Component leaf identities; empty objects contribute no keys.
 */
function leaves(source, prefix = "") {
  if (source === null || typeof source !== "object") return prefix ? [prefix] : [];
  return Object.entries(source).flatMap(([key, value]) => (METADATA.has(key) ? [] : leaves(value, prefix ? `${prefix}/${key}` : key)));
}

/**
 * Returns exact TextMate selectors, preserving selector grammar except comma-separated alternatives.
 * @param {object[]} rules - Controlled native scope rules.
 * @returns {string[]} Component identities; non-scope rules contribute no entry.
 */
function scopes(rules) {
  return rules.flatMap((rule) =>
    (Array.isArray(rule.scope) ? rule.scope : [rule.scope])
      .filter((scope) => typeof scope === "string")
      .flatMap((scope) => scope.split(",").map((value) => `scope/${value.trim()}`)),
  );
}

/**
 * Normalizes one captured/native source into component identities without copying any third-party colors or source text.
 * @param {string} app - Canonical application identity.
 * @param {object} source - Active source or baseline definition.
 * @returns {string[]} Sorted unique native/renderer component identities.
 * @throws {Error} For unknown applications or malformed source roots.
 */
function componentKeys(app, source) {
  if (!APPS.includes(app)) throw new Error(`Unknown theme app: ${app}; retry with a supported app`);
  if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error(`Invalid ${app} source: expected an object`);
  if (source.captureStatus === "gap" || app === "copilot") return [];
  let keys;
  if (app === "vscode") {
    keys = [
      ...Object.keys(source.colors || source["workbench.colorCustomizations"] || {}).map((key) => `workbench/${key}`),
      ...scopes(source.tokenColors || source["editor.tokenColorCustomizations"]?.textMateRules || []),
      ...Object.keys(source.semanticTokenColors || source["editor.semanticTokenColorCustomizations"]?.rules || {}).map(
        (key) => `semantic/${key}`,
      ),
    ];
  } else if (app === "sublime") {
    keys = [...Object.keys(source.globals || {}).map((key) => `globals/${key}`), ...scopes(source.rules || [])];
  } else if (app === "zed") {
    keys = leaves(source.themes?.[0]?.style || {}, "style");
  } else if (app === "vim") {
    if (typeof source.sourceText === "string") {
      keys = source.sourceText
        .split("\n")
        .filter((line) => !line.trim().startsWith('"'))
        .flatMap((line) =>
          [...line.matchAll(/\b(?:hi|highlight)!?\s+(?:default\s+)?(?:link\s+)?([A-Za-z][A-Za-z0-9_]*)/g)]
            .filter((match) => !["clear", "default"].includes(match[1]))
            .map((match) => `highlights/${match[1]}`),
        );
      if (source.sourceText.includes("terminal_ansi_colors")) keys.push(...Array.from({ length: 16 }, (_, index) => `terminal/${index}`));
    } else {
      keys = [
        ...Object.keys(source.highlights || {}).map((key) => `highlights/${key}`),
        ...leaves(source.terminal || [], "terminal"),
        ...leaves(source.lightline || {}, "lightline"),
      ];
    }
  } else if (app === "ghostty" || app === "termux") {
    if (typeof source.sourceText === "string") {
      keys = source.sourceText.split("\n").flatMap((line) => {
        const match = line.match(/^([a-z-]+[0-9]*)\s*=\s*(.+)$/);
        if (!match) return [];
        if (match[1] === "palette") return [`palette/${match[2].split("=")[0]}`];
        if (/^color[0-9]+$/.test(match[1])) return [`palette/${match[1].slice(5)}`];
        return [match[1]];
      });
    } else keys = leaves(source);
  } else if (app === "pi") keys = Object.keys(source.colors || {}).map((key) => `colors/${key}`);
  else if (app === "opencode") keys = Object.keys(source.theme || {}).map((key) => `theme/${key}`);
  else if (app === "claude") keys = Object.keys(source.overrides || {}).map((key) => `overrides/${key}`);
  else if (app === "gemini" && source.format)
    keys = [...leaves(source.palette || {}, "reference_palette"), ...leaves(source.syntax || {}, "reference_syntax")];
  else keys = leaves(source);
  return [...new Set(keys)].sort();
}

/**
 * Parses one repository-owned JSONC source without treating malformed bytes as an empty inventory.
 * @param {string} file - Source filename.
 * @returns {object} Parsed source; performs read-only IO.
 * @throws {Error} For missing files or JSONC syntax errors.
 */
function readJsonc(file) {
  const parsed = ts.parseConfigFileTextToJson(file, fs.readFileSync(file, "utf8"));
  if (parsed.error) throw new Error(`Invalid theme JSONC: ${file}; repair syntax before retrying`);
  return parsed.config;
}

/**
 * Builds the complete active/captured-reference key union for each appearance, retaining inherited/unverified gaps explicitly.
 * @param {string} root - Repository root containing theme/sy and theme/baseline.
 * @returns {object} Value-free crosswalk; inventory does not certify native schema completeness or visual state reachability.
 * @throws {Error} For missing or malformed sources; performs no writes or network calls.
 */
function buildCrosswalk(root = path.resolve(__dirname, "../..")) {
  return {
    formatVersion: 1,
    boundary: "All active component keys and captured reference keys; not every native schema, plugin, or runtime state combination.",
    entries: APPS.flatMap((app) =>
      ["dark", "light"].map((mode) => {
        const source = readJsonc(path.join(root, `theme/sy/${app}_${mode}.jsonc`));
        const reference = readJsonc(path.join(root, `theme/baseline/${app}_${mode}.jsonc`));
        const active = new Set(componentKeys(app, source));
        const baseline = new Set(componentKeys(app, reference.definition));
        return {
          app,
          mode,
          capability: source.captureStatus === "gap" ? "capability_limit" : "configured",
          reference: reference.captureStatus === "gap" ? "unavailable" : "captured",
          components: [...new Set([...active, ...baseline])].sort().map((key) => ({
            key,
            states: statesFor(key),
            active: active.has(key),
            capturedReference: baseline.has(key),
            disposition: active.has(key) ? "configured_not_visually_verified" : "reference_only_requires_reachability_review",
          })),
        };
      }),
    ),
  };
}

module.exports = { buildCrosswalk, componentKeys, statesFor };

if (require.main === module) {
  try {
    process.stdout.write(`${JSON.stringify(buildCrosswalk(), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

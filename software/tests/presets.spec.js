/** Shape validation for software/metadata/presets.jsonc — the single source of truth for --preset=<name> bundles. */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { getIndexFunction } from "./setup.js";

const PRESETS_PATH = path.resolve("software/metadata/presets.jsonc");
const stripJsoncComments = getIndexFunction("stripJsoncComments");

/**
 * Reads and parses the checked-in presets.jsonc file using the same comment-stripping
 * pipeline the runtime uses, so tests exercise the actual parse path rather than a
 * separate JSONC implementation.
 * @returns {Record<string, { description?: string, files?: string[], presets?: string[] }>}
 */
function loadFile() {
  const raw = fs.readFileSync(PRESETS_PATH, "utf-8");
  return JSON.parse(stripJsoncComments(raw));
}

/**
 * Walks the preset graph from `name` and throws if a cycle is detected.
 * @param {string} name - preset name to start from
 * @param {Record<string, { files?: string[], presets?: string[] }>} presets - full preset map
 * @param {Set<string>} visited - names currently on the recursion stack
 * @param {string[]} chain - ordered path of preset names visited so far (for error reporting)
 */
function assertNoCycle(name, presets, visited = new Set(), chain = []) {
  const nextChain = [...chain, name];
  if (visited.has(name)) {
    throw new Error(`Cycle detected in presets.jsonc: ${nextChain.join(" -> ")}`);
  }
  const preset = presets[name];
  if (!preset || typeof preset !== "object") return;
  visited.add(name);
  if (Array.isArray(preset.presets)) {
    for (const ref of preset.presets) {
      if (typeof ref === "string" && ref) assertNoCycle(ref, presets, visited, nextChain);
    }
  }
  visited.delete(name);
}

describe("presets.jsonc", () => {
  let presets;

  it("should parse as JSONC (comments + trailing commas allowed)", () => {
    presets = loadFile();
    expect(presets).toBeTypeOf("object");
    expect(Array.isArray(presets)).toBe(false);
  });

  it("should define a lightweight preset", () => {
    presets = loadFile();
    expect(presets.lightweight).toBeDefined();
  });

  it("should give every preset a non-empty files[] or presets[] (composition allowed)", () => {
    presets = loadFile();
    for (const [name, preset] of Object.entries(presets)) {
      expect(preset, `preset "${name}" must be an object`).toBeTypeOf("object");
      const hasFiles = Array.isArray(preset.files) && preset.files.length > 0;
      const hasPresets = Array.isArray(preset.presets) && preset.presets.length > 0;
      expect(hasFiles || hasPresets, `preset "${name}" must declare at least one of files[] or presets[]`).toBe(true);
      if (Array.isArray(preset.files)) {
        for (const f of preset.files) {
          expect(typeof f, `preset "${name}".files entries must be strings`).toBe("string");
          expect(f.length, `preset "${name}".files entries must be non-empty`).toBeGreaterThan(0);
        }
      }
      if (Array.isArray(preset.presets)) {
        for (const ref of preset.presets) {
          expect(typeof ref, `preset "${name}".presets entries must be strings`).toBe("string");
          expect(ref.length, `preset "${name}".presets entries must be non-empty`).toBeGreaterThan(0);
          expect(presets[ref], `preset "${name}".presets references unknown preset "${ref}"`).toBeDefined();
          expect(ref, `preset "${name}".presets must not reference itself`).not.toBe(name);
        }
      }
    }
  });

  // Cycles in presets.jsonc would cause infinite recursion in expandPresetFiles and break
  // every --preset=<name> invocation. Catch them at build/test time, not at runtime.
  it("should not contain any preset cycles (no self-reference, no transitive loops)", () => {
    presets = loadFile();
    for (const name of Object.keys(presets)) {
      expect(() => assertNoCycle(name, presets)).not.toThrow();
    }
  });
});

describe("stripJsoncComments", () => {
  it("removes // line comments", () => {
    const out = stripJsoncComments('{\n  // a comment\n  "a": 1\n}');
    expect(JSON.parse(out)).toEqual({ a: 1 });
  });

  it("removes /* */ block comments", () => {
    const out = stripJsoncComments('{ /* hi */ "a": 1 /* bye */ }');
    expect(JSON.parse(out)).toEqual({ a: 1 });
  });

  it("removes trailing commas before } and ]", () => {
    const out = stripJsoncComments('{ "a": [1, 2,], "b": 3, }');
    expect(JSON.parse(out)).toEqual({ a: [1, 2], b: 3 });
  });

  it("preserves comment-looking sequences inside string literals", () => {
    const out = stripJsoncComments('{ "url": "http://example.com/path", "note": "/* not a comment */" }');
    expect(JSON.parse(out)).toEqual({
      url: "http://example.com/path",
      note: "/* not a comment */",
    });
  });

  it("honors backslash escapes in string literals", () => {
    const out = stripJsoncComments('{ "q": "he said \\"hi // there\\""}');
    expect(JSON.parse(out)).toEqual({ q: 'he said "hi // there"' });
  });
});

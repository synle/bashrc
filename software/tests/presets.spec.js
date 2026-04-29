/** Shape validation for software/metadata/presets.json — the single source of truth for --preset=<name> bundles. */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const PRESETS_PATH = path.resolve("software/metadata/presets.json");

describe("presets.json", () => {
  let presets;

  it("should be a valid JSON file", () => {
    const raw = fs.readFileSync(PRESETS_PATH, "utf-8");
    presets = JSON.parse(raw);
    expect(presets).toBeTypeOf("object");
    expect(Array.isArray(presets)).toBe(false);
  });

  it("should define a lightweight preset", () => {
    const raw = fs.readFileSync(PRESETS_PATH, "utf-8");
    presets = JSON.parse(raw);
    expect(presets.lightweight).toBeDefined();
  });

  it("should give every preset a non-empty files array", () => {
    const raw = fs.readFileSync(PRESETS_PATH, "utf-8");
    presets = JSON.parse(raw);
    for (const [name, preset] of Object.entries(presets)) {
      expect(preset, `preset "${name}" must be an object`).toBeTypeOf("object");
      expect(Array.isArray(preset.files), `preset "${name}".files must be an array`).toBe(true);
      expect(preset.files.length, `preset "${name}".files must be non-empty`).toBeGreaterThan(0);
      for (const f of preset.files) {
        expect(typeof f, `preset "${name}".files entries must be strings`).toBe("string");
        expect(f.length, `preset "${name}".files entries must be non-empty`).toBeGreaterThan(0);
      }
    }
  });
});

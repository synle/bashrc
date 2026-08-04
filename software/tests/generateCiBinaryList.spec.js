/** Tests for software/tools/generate-ci-binary-list.js. */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
// Default ESM import (not `require()`) so vitest's istanbul provider sees the file
// through Vite's transform pipeline and instruments it for coverage.
import generateCiBinaryListModule from "../tools/generate-ci-binary-list.js";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { renderBody, substitute, toLines } = generateCiBinaryListModule;

const JSON_PATH = path.join(ROOT_DIR, "software/metadata/ci-binaries.json");
const YAML_PATH = path.join(ROOT_DIR, ".github/actions/ci-build/action.yml");

describe("toLines", () => {
  it("emits `<fn> <name>` for string entries", () => {
    expect(toLines("check_binary_required", ["git", "curl"])).toEqual(["check_binary_required git", "check_binary_required curl"]);
  });
  it('emits `<fn> <name> "<version_cmd>"` when version_cmd present', () => {
    expect(toLines("check_binary_warn", [{ name: "pwsh", version_cmd: "pwsh --version" }])).toEqual([
      'check_binary_warn pwsh "pwsh --version"',
    ]);
  });
  it("omits version_cmd quoting when not provided in object form", () => {
    expect(toLines("check_binary_required", [{ name: "starship" }])).toEqual(["check_binary_required starship"]);
  });
});

describe("renderBody", () => {
  it("emits required lines first, then warn lines, joined by \\n", () => {
    const data = {
      required: ["git", { name: "kubectl", version_cmd: "kubectl version --client" }],
      warn: [{ name: "pwsh", version_cmd: "pwsh --version" }],
    };
    expect(renderBody(data)).toBe(
      [
        "check_binary_required git",
        'check_binary_required kubectl "kubectl version --client"',
        'check_binary_warn pwsh "pwsh --version"',
      ].join("\n"),
    );
  });
});

describe("substitute", () => {
  it("preserves the BEGIN line indentation on every body line and the END marker", () => {
    const yaml = [
      "job:",
      "  run: |",
      "    set -e",
      "    # BEGIN ci-binary-checks",
      "    OLD_LINE",
      "    # END ci-binary-checks",
      "    echo done",
    ].join("\n");
    const next = substitute(yaml, "check_binary_required git\ncheck_binary_required curl");
    expect(next).toBe(
      [
        "job:",
        "  run: |",
        "    set -e",
        "    # BEGIN ci-binary-checks",
        "    check_binary_required git",
        "    check_binary_required curl",
        "    # END ci-binary-checks",
        "    echo done",
      ].join("\n"),
    );
  });

  it("works with zero indent (no leading whitespace on markers)", () => {
    const yaml = "# BEGIN ci-binary-checks\nold\n# END ci-binary-checks\nafter\n";
    expect(substitute(yaml, "new")).toBe("# BEGIN ci-binary-checks\nnew\n# END ci-binary-checks\nafter\n");
  });

  it("throws when BEGIN marker is missing", () => {
    expect(() => substitute("nothing here", "x")).toThrow(/BEGIN marker/);
  });

  it("throws when END marker is missing", () => {
    expect(() => substitute("# BEGIN ci-binary-checks\nstuff\n", "x")).toThrow(/END marker/);
  });
});

describe("ci-binaries.json manifest invariants", () => {
  /** @type {{ required: any[], warn: any[] }} */
  const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));

  it("has both required and warn arrays", () => {
    expect(Array.isArray(data.required)).toBe(true);
    expect(Array.isArray(data.warn)).toBe(true);
  });

  it("no binary appears in both required and warn", () => {
    const nameOf = (e) => (typeof e === "string" ? e : e.name);
    const required = new Set(data.required.map(nameOf));
    const warn = new Set(data.warn.map(nameOf));
    const overlap = [...required].filter((n) => warn.has(n));
    expect(overlap, `binary in both tiers: ${overlap.join(", ")}`).toEqual([]);
  });

  it("every entry has a non-empty name", () => {
    const all = [...data.required, ...data.warn];
    for (const e of all) {
      const name = typeof e === "string" ? e : e.name;
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
      expect(name, `name should not contain spaces: ${JSON.stringify(e)}`).not.toMatch(/\s/);
      expect(name, `name should not contain a slash: ${JSON.stringify(e)}`).not.toMatch(/\//);
    }
  });

  it("object entries with version_cmd reference the binary by name", () => {
    const all = [...data.required, ...data.warn];
    for (const e of all) {
      if (typeof e !== "object" || !e.version_cmd) continue;
      // The version command's first token should be the binary name (sanity check).
      const firstToken = e.version_cmd.split(/\s+/)[0];
      expect(firstToken, `version_cmd should invoke '${e.name}': ${JSON.stringify(e)}`).toBe(e.name);
    }
  });
});

describe("action.yml is up to date with ci-binaries.json", () => {
  it("rendered body matches what's currently in the YAML block", () => {
    const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
    const yaml = fs.readFileSync(YAML_PATH, "utf-8");
    const next = substitute(yaml, renderBody(data));
    expect(next, "Run: node software/tools/generate-ci-binary-list.js").toBe(yaml);
  });
});

import { describe, it, expect } from "vitest";
import { getIndexFunction } from "./setup.js";

const filterRepoScripts = getIndexFunction("filterRepoScripts");

describe("filterRepoScripts", () => {
  it("should keep .js files under software/", () => {
    const result = filterRepoScripts(["software/scripts/git.js"]);
    expect(result).toContain("software/scripts/git.js");
  });

  it("should keep .sh files under software/", () => {
    const result = filterRepoScripts(["software/scripts/gradle.sh"]);
    expect(result).toContain("software/scripts/gradle.sh");
  });

  it("should strip ./ prefix", () => {
    const result = filterRepoScripts(["./software/scripts/git.js"]);
    expect(result).toContain("software/scripts/git.js");
  });

  it("should exclude .json files", () => {
    const result = filterRepoScripts(["software/metadata/config.json"]);
    expect(result).not.toContain("software/metadata/config.json");
  });

  it("should exclude .test.js files", () => {
    const result = filterRepoScripts(["software/tests/parsers.test.js"]);
    expect(result).not.toContain("software/tests/parsers.test.js");
  });

  it("should exclude software/index.js", () => {
    const result = filterRepoScripts(["software/index.js"]);
    expect(result).not.toContain("software/index.js");
  });

  it("should exclude files not under software/", () => {
    const result = filterRepoScripts(["README.md", "docs/something.js", "webapp/index.jsx"]);
    expect(result).toEqual([]);
  });

  it("should deduplicate entries", () => {
    const result = filterRepoScripts(["software/scripts/git.js", "software/scripts/git.js", "software/scripts/git.js"]);
    expect(result.filter((f) => f === "software/scripts/git.js").length).toBe(1);
  });

  it("should sort alphabetically (root and OS scripts intermixed)", () => {
    const result = filterRepoScripts(["software/scripts/mac/dock.js", "software/scripts/git.js", "software/scripts/vim.js"]);
    // alphabetical: git.js < mac/dock.js < vim.js
    expect(result.indexOf("software/scripts/git.js")).toBeLessThan(result.indexOf("software/scripts/mac/dock.js"));
    expect(result.indexOf("software/scripts/mac/dock.js")).toBeLessThan(result.indexOf("software/scripts/vim.js"));
  });

  it("should push lastFiles (bash-syle-content.js, vs-code-ext.sh) to end", () => {
    const result = filterRepoScripts([
      "software/scripts/bash-syle-content.js",
      "software/scripts/git.js",
      "software/scripts/advanced/vs-code-ext.sh",
      "software/scripts/vim.js",
    ]);
    const lastIdx1 = result.indexOf("software/scripts/bash-syle-content.js");
    const lastIdx2 = result.indexOf("software/scripts/advanced/vs-code-ext.sh");
    const gitIdx = result.indexOf("software/scripts/git.js");

    expect(lastIdx1).toBeGreaterThan(gitIdx);
    expect(lastIdx2).toBeGreaterThan(gitIdx);
  });

  it("should handle null input", () => {
    const result = filterRepoScripts(null);
    expect(result).toEqual([]);
  });

  it("should handle empty array", () => {
    const result = filterRepoScripts([]);
    expect(result).toEqual([]);
  });

  it("should trim whitespace from entries", () => {
    const result = filterRepoScripts(["  software/scripts/git.js  "]);
    expect(result).toContain("software/scripts/git.js");
  });

  it("should exclude files with unsupported extensions", () => {
    const result = filterRepoScripts(["software/scripts/config.yaml", "software/scripts/data.csv", "software/scripts/style.css"]);
    expect(result).toEqual([]);
  });

  it("should sort ~ prefixed scripts after all other scripts", () => {
    const result = filterRepoScripts([
      "software/scripts/~cleanup.js",
      "software/scripts/mac/_only.js",
      "software/scripts/mac/_init.js",
      "software/scripts/zoxide.js",
      "software/scripts/~wrapup.sh",
    ]);
    const cleanupIdx = result.indexOf("software/scripts/~cleanup.js");
    const wrapupIdx = result.indexOf("software/scripts/~wrapup.sh");
    const macOnlyIdx = result.indexOf("software/scripts/mac/_only.js");
    const macInitIdx = result.indexOf("software/scripts/mac/_init.js");
    const zoxideIdx = result.indexOf("software/scripts/zoxide.js");

    // all regular scripts come before ~ scripts
    expect(macOnlyIdx).toBeLessThan(cleanupIdx);
    expect(macInitIdx).toBeLessThan(cleanupIdx);
    expect(macOnlyIdx).toBeLessThan(wrapupIdx);
    expect(zoxideIdx).toBeLessThan(cleanupIdx);
  });

  it("should pin _init.js first via firstFiles", () => {
    const result = filterRepoScripts([
      "software/scripts/git.js",
      "software/scripts/_init.js",
      "software/scripts/mac/_full-setup.sh",
      "software/scripts/_full-setup.sh",
    ]);
    expect(result.indexOf("software/scripts/_init.js")).toBe(0);
  });

  it("should sort _init before _full-setup and _only within OS folders", () => {
    const result = filterRepoScripts([
      "software/scripts/mac/_only.js",
      "software/scripts/mac/_init.js",
      "software/scripts/mac/_full-setup.sh",
    ]);
    const fullSetupIdx = result.indexOf("software/scripts/mac/_full-setup.sh");
    const initIdx = result.indexOf("software/scripts/mac/_init.js");
    const onlyIdx = result.indexOf("software/scripts/mac/_only.js");

    expect(initIdx).toBeLessThan(fullSetupIdx);
    expect(fullSetupIdx).toBeLessThan(onlyIdx);
  });
});

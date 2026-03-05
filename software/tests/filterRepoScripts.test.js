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

  it("should include software/bootstrap/ files with valid extensions", () => {
    const result = filterRepoScripts(["software/bootstrap/dependencies/mac.sh"]);
    expect(result).toContain("software/bootstrap/dependencies/mac.sh");
  });

  it("should deduplicate entries", () => {
    const result = filterRepoScripts(["software/scripts/git.js", "software/scripts/git.js", "software/scripts/git.js"]);
    expect(result.filter((f) => f === "software/scripts/git.js").length).toBe(1);
  });

  it("should sort by slash depth first, then alphabetically", () => {
    const result = filterRepoScripts(["software/scripts/mac/dock.js", "software/scripts/git.js", "software/scripts/vim.js"]);
    // fewer slashes first
    expect(result.indexOf("software/scripts/git.js")).toBeLessThan(result.indexOf("software/scripts/mac/dock.js"));
  });

  it("should push lastFiles (bash-syle-content.js, vs-code-ext.sh) to end", () => {
    const result = filterRepoScripts([
      "software/scripts/bash-syle-content.js",
      "software/scripts/git.js",
      "software/scripts/vs-code-ext.sh",
      "software/scripts/vim.js",
    ]);
    const lastIdx1 = result.indexOf("software/scripts/bash-syle-content.js");
    const lastIdx2 = result.indexOf("software/scripts/vs-code-ext.sh");
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
});

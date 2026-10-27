/** Short native configuration checks for generated Git defaults and aliases. */
import { describe, expect, it } from "vitest";
import { git, shell } from "./gitDefaults.helpers.js";

describe("Git defaults", () => {
  it("renders editor links and portable diff styling in the generated config", () => {
    expect(git("config", "--get-regexp", "^delta\\.").split("\n")).toMatchInlineSnapshot(`
      [
        "delta.navigate true",
        "delta.side-by-side false",
        "delta.line-numbers true",
        "delta.hyperlinks true",
        "delta.hyperlinks-file-link-format vscode://file/{path}:{line}",
        "delta.true-color auto",
        "delta.features decorations",
        "delta.syntax-theme ansi",
        "delta.plus-style syntax auto",
        "delta.minus-style syntax auto",
        "delta.decorations.commit-decoration-style bold yellow box ul",
        "delta.decorations.file-style bold yellow ul",
        "delta.decorations.file-decoration-style none",
        "delta.decorations.hunk-header-decoration-style cyan box ul",
        "delta.line-numbers.line-numbers-left-style cyan",
        "delta.line-numbers.line-numbers-right-style cyan",
        "delta.line-numbers.line-numbers-minus-style red",
        "delta.line-numbers.line-numbers-plus-style green",
      ]
    `);
  });

  it("defaults to one column and preserves explicit one-column compatibility", () => {
    expect(git("config", "--get", "delta.side-by-side")).toBe("false");
    expect(git("config", "--get", "alias.show1")).toContain("delta.side-by-side=false");
  });

  it("preserves numbered rebase and patch aliases without duplicate keys", () => {
    const names = git("config", "--get-regexp", "^alias\\.")
      .split("\n")
      .map((line) => line.split(" ")[0]);
    expect(new Set(names).size).toBe(names.length);
    expect(git("config", "--get", "alias.r2")).toBe("!git rn 2");
    expect(git("config", "--get", "alias.patch-view2")).toBe("!git patch-view 2");
  });

  it("does not introduce a redundant aau alias", () => {
    const result = shell("config", "--get", "alias.aau");
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
  });
});

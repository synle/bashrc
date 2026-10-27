/** Native Git wrapper and aliases preserve whitespace filtering and exit status. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { folder, git, shell } from "./gitDefaults.helpers.js";

describe("Git defaults", () => {
  it.each([[[]], [["--no-pager"]], [["-c", "delta.side-by-side=true"]], [["-C", "."]]])(
    "ignores whitespace through the wrapper with global arguments %j",
    (prefix) => {
      fs.writeFileSync(path.join(folder, "note.txt"), "old    line\n");
      const result = shell(...prefix, "diff", "--exit-code", "--", "note.txt");
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toBe("");
    },
  );

  it("keeps substantive changes and diff exit status", () => {
    fs.writeFileSync(path.join(folder, "note.txt"), "new line\n");
    const result = shell("diff", "--exit-code");
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("+new line");
  });

  it.each(["d", "dh", "ds", "dhs", "s"])('ignores whitespace in the generated "%s" alias', (alias) => {
    fs.writeFileSync(path.join(folder, "note.txt"), "old   line\n");
    git("add", "note.txt");
    git("commit", "-qm", "Whitespace");
    expect(git(alias)).not.toContain("note.txt");
  });
});

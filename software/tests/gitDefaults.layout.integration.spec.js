/** Native Git aliases propagate two-column layout through independent repositories. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { folder, git, shell } from "./gitDefaults.helpers.js";

describe("Git defaults integration", () => {
  it.each(["d2", "dh2", "ds2", "show2", "ls2", "l2", "s2", "d12", "show12"])('propagates two-column layout through "%s"', (alias) => {
    fs.writeFileSync(path.join(folder, ".git/layout.sh"), "#!/bin/sh\ngit config --get delta.side-by-side\n", { mode: 0o755 });
    git("config", "diff.external", "./.git/layout.sh");
    git("config", "core.pager", "cat");
    fs.writeFileSync(path.join(folder, "note.txt"), "committed change\n");
    git("commit", "-qam", "Changed");
    fs.writeFileSync(path.join(folder, "note.txt"), "staged change\n");
    git("add", "note.txt");
    fs.writeFileSync(path.join(folder, "note.txt"), "unstaged change\n");
    const result = shell(alias, "-p", "--ext-diff");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("true\n");
    expect(result.stdout).not.toContain("false\n");
  });
});

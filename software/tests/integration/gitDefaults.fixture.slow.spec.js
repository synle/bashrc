/** Prepared Git fixtures keep worktree, history, hooks, and configuration mutations private. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { folder, git } from "./gitDefaults.helpers.js";

describe("Git fixture isolation", () => {
  it.each(["alpha", "beta"])("keeps %s mutations out of the next repository", (marker) => {
    expect(git("status", "--porcelain")).toBe("");
    expect(git("log", "-1", "--format=%s")).toBe("Base");
    expect(git("config", "--get", "core.hooksPath")).toBe(".git/hooks");
    expect(fs.existsSync(path.join(folder, ".git/hooks/private-marker"))).toBe(false);

    fs.writeFileSync(path.join(folder, "note.txt"), marker + "\n");
    fs.writeFileSync(path.join(folder, ".git/hooks/private-marker"), marker);
    git("config", "core.hooksPath", ".git/private-hooks");
    git("commit", "-qam", marker);
    expect(git("log", "-1", "--format=%s")).toBe(marker);
    expect(fs.readFileSync(path.join(folder, "note.txt"), "utf8")).toBe(marker + "\n");
  });
});

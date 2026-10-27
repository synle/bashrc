/** Real-Git stash and staging behavior with independent repositories per case. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { folder, git, shell } from "./gitDefaults.helpers.js";

describe("Git defaults integration", () => {
  it("stashes tracked and untracked files but leaves ignored files alone", () => {
    fs.writeFileSync(path.join(folder, "note.txt"), "changed\n");
    fs.writeFileSync(path.join(folder, "new file.txt"), "new\n");
    fs.writeFileSync(path.join(folder, "ignored.txt"), "ignored\n");
    const result = shell("stash");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Saved working directory");
    expect(git("status", "--porcelain")).toBe("");
    expect(fs.readFileSync(path.join(folder, "ignored.txt"), "utf8")).toBe("ignored\n");
    expect(git("show", "stash^3:new file.txt")).toBe("new");
    const restored = shell("stash", "pop");
    expect(restored.status, restored.stderr).toBe(0);
    expect(fs.readFileSync(path.join(folder, "new file.txt"), "utf8")).toBe("new\n");
  });

  it("leaves explicit stash push behavior unchanged", () => {
    fs.writeFileSync(path.join(folder, "note.txt"), "changed\n");
    fs.writeFileSync(path.join(folder, "new.txt"), "new\n");
    const result = shell("stash", "push", "-m", "explicit save");
    expect(result.status, result.stderr).toBe(0);
    expect(git("status", "--porcelain")).toBe("?? new.txt");
    expect(git("stash", "list")).toContain("explicit save");
  });

  it.each([
    ["aac", true],
    ["auc", false],
  ])("%s forwards commit arguments, skips hooks, and stages the intended files", (alias, includesNew) => {
    fs.writeFileSync(path.join(folder, "note.txt"), "changed\n");
    fs.writeFileSync(path.join(folder, "new file.txt"), "new\n");
    fs.writeFileSync(path.join(folder, ".git/hooks/pre-commit"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    const result = shell(alias, "-m", "Message with spaces");
    expect(result.status, result.stderr).toBe(0);
    expect(git("log", "-1", "--format=%s")).toBe("Message with spaces");
    expect(git("ls-tree", "--name-only", "HEAD").includes("new file.txt")).toBe(includesNew);
  });
});

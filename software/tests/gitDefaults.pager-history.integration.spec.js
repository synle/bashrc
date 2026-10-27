/** Real Delta terminal rendering for history commands and their generated aliases. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { folder, git, HAS_DELTA_PTY, runPager } from "./gitDefaults.helpers.js";

describe("Git defaults integration", () => {
  it.skipIf(!HAS_DELTA_PTY).each(["show", "log", "show1", "show2", "ls", "lls", "l", "ll"])(
    'renders "%s" through the real global Delta pager on a terminal',
    (alias) => {
      fs.writeFileSync(path.join(folder, "note.txt"), "committed line\n");
      git("commit", "-qam", "Changed");
      fs.writeFileSync(path.join(folder, "note.txt"), "staged line\n");
      git("add", "note.txt");
      fs.writeFileSync(path.join(folder, "note.txt"), "working line\n");
      const result = runPager(alias);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("note.txt");
      expect(result.stdout).toContain("\u2502");
      expect(result.stdout).not.toContain("[-");
      expect(result.stdout).not.toContain("{+");
    },
  );
});

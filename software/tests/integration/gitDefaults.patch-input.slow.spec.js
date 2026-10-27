/** Generated Git aliases feed unified patches to Delta without word-diff markup. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { folder, git } from "./gitDefaults.helpers.js";

describe("Git defaults", () => {
  it.each(["d", "dh", "ds", "d1", "dh1", "ds1", "d2", "dh2", "ds2", "d12", "dh12", "ds12"])(
    'feeds unified patch lines to Delta through "%s"',
    (alias) => {
      fs.writeFileSync(path.join(folder, "note.txt"), "committed line\n");
      git("commit", "-qam", "Changed");
      fs.writeFileSync(path.join(folder, "note.txt"), "new line\n");
      git("add", "note.txt");
      fs.writeFileSync(path.join(folder, "note.txt"), "working line\n");
      const output = git(alias);
      expect(output).toMatch(/^-.*line$/m);
      expect(output).toMatch(/^\+.*line$/m);
      expect(output).not.toContain("[-");
      expect(output).not.toContain("{+");
    },
  );
});

/** Contract tests for profile-qualified executable script suffixes. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getIndexFunction } from "./setup.js";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const INDEX_SOURCE = fs.readFileSync(path.join(ROOT_DIR, "software/index.js"), "utf-8");
const _getScriptProfile = getIndexFunction("_getScriptProfile");

describe("profile script suffix contract", () => {
  it("recognizes only exact executable suffixes", () => {
    expect(_getScriptProfile("abc.js")).toBe("common");
    expect(_getScriptProfile("abc.personal.js")).toBe("personal");
    expect(_getScriptProfile("abc.work.js")).toBe("work");
    expect(_getScriptProfile("abc.personal.sh")).toBe("personal");
    expect(_getScriptProfile("abc.work.sh")).toBe("work");
    expect(_getScriptProfile("personal-tools.js")).toBe("common");
    expect(_getScriptProfile("abc.personal.profile.bash")).toBe("common");
  });

  it("uses the same filter for full discovery and explicit targets", () => {
    expect(INDEX_SOURCE).toMatch(/return _filterFilesByProfile\(_filterByOsFolders\(softwareFiles, "software\/scripts"\)\);/);
    expect(INDEX_SOURCE).toContain("softwareFiles = _filterFilesByProfile(softwareFiles, is_work_profile, true);");
    expect(INDEX_SOURCE).toContain("_filterFilesByProfile([entry.file], is_work_profile, true)");
  });

  it("filters resolved fuzzy targets before calculating execution totals", () => {
    expect(INDEX_SOURCE.indexOf("entries = entries.filter")).toBeLessThan(INDEX_SOURCE.indexOf("const total = entries.length"));
  });
});

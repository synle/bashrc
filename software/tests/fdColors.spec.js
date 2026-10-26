/** Native fd output inherits terminal colors without overriding user preferences. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import { spawnSync } from "child_process";

/** Native output checks require the optional fd executable. */
const HAS_FD = spawnSync("fd", ["--version"]).status === 0;

/** Execute only the profile's color default, avoiding unrelated shell startup effects. */
function search(colors) {
  const profile = fs.readFileSync("software/bootstrap/profile-core.sh", "utf8");
  const defaults = profile.match(/^export LS_COLORS=.*$/m)?.[0] || "";
  const env = { ...process.env, BASH_ENV: "/dev/null" };
  delete env.LS_COLORS;
  if (colors !== undefined) env.LS_COLORS = colors;
  return spawnSync(
    "/bin/bash",
    ["--noprofile", "--norc", "-c", `${defaults}\ncommand fd --color=always '^gitDefaults[.]spec[.]js$' software/tests`],
    {
      env,
      encoding: "utf8",
      timeout: 5000,
    },
  );
}

describe.skipIf(!HAS_FD)("fd terminal palette", () => {
  it("uses terminal palette colors instead of fixed vivid colors", () => {
    const result = search();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("gitDefaults.spec.js");
    expect(result.stdout).not.toMatch(/\x1b\[[0-9;]*38;5;/);
  });

  it("preserves explicit custom extension colors", () => {
    const result = search("*.js=35");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("\x1b[35mgitDefaults.spec.js");
  });

  it("preserves an explicitly empty LS_COLORS value", () => {
    const result = search("");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("\x1b[1;34msoftware/tests/\x1b[0mgitDefaults.spec.js\n");
  });
});

/** Execute generated startup code against isolated work shell overlays. */
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileSystem, getIndexConstant, runScript, setSandboxGlobal } from "./setup.js";

/** Private home used only by generated-shell subprocess fixtures. */
let home;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "work-shell-"));
  setSandboxGlobal("backupProfileFilesToTempDir", async () => {});
  setSandboxGlobal("backupProfileSnapshot", async () => {});
  setSandboxGlobal("BASH_SYLE_CACHE_PATH", "/mock/home/.bash_syle_cache");
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

/**
 * Renders real initialization code and replaces only the fixture home prefix.
 * @returns {Promise<string>} Generated startup script ready for isolated execution.
 */
async function renderStartup() {
  await runScript("software/scripts/_init.js");
  const source = fileSystem["/mock/home/.bashrc"].split("/mock/home").join(home);
  fs.writeFileSync(path.join(home, "startup.bash"), source);
  fs.writeFileSync(path.join(home, ".bash_syle"), "");
  fs.writeFileSync(path.join(home, ".bash_syle_common"), "");
  const cache = getIndexConstant("BASH_SYLE_CACHE_PATH").split("/mock/home").join(home);
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.writeFileSync(cache, "");
  return path.join(home, "startup.bash");
}

describe("work shell startup", () => {
  it("sources only matching work shell files in lexical order", async () => {
    fs.writeFileSync(path.join(home, ".work_zeta.bash"), "printf 'zeta\\n'\n");
    fs.writeFileSync(path.join(home, ".work_alpha team.bash"), "printf 'alpha\\n'\n");
    fs.writeFileSync(path.join(home, ".work_acme_instructions.md"), "invalid shell data");
    fs.writeFileSync(path.join(home, ".bash_work_old.bash"), "printf 'old\\n'\n");
    fs.mkdirSync(path.join(home, ".work_folder.bash"));
    const startup = await renderStartup();
    const result = spawnSync("/bin/bash", ["--noprofile", "--norc", startup], {
      env: { ...process.env, HOME: home, BASH_ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("alpha\nzeta\n");
    expect(result.stderr).toBe("");
  });

  it("is valid and silent when no overlay matches", async () => {
    const startup = await renderStartup();
    const syntax = spawnSync("/bin/bash", ["-n", startup], { encoding: "utf8", timeout: 5000 });
    expect(syntax.status).toBe(0);
    const result = spawnSync("/bin/bash", ["--noprofile", "--norc", startup], {
      env: { ...process.env, HOME: home, BASH_ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });
});

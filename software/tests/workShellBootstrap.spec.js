/** Execute generated startup code against isolated work shell overlays. */
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fetchResponses, fileSystem, getIndexConstant, runScript, setSandboxGlobal } from "./setup.js";

/** Private home used only by generated-shell subprocess fixtures. */
let home;

beforeEach(() => {
  home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "work-shell-")));
  setSandboxGlobal("backupProfileFilesToTempDir", async () => {});
  setSandboxGlobal("backupProfileSnapshot", async () => {});
  setSandboxGlobal("BASH_SYLE_CACHE_PATH", "/mock/home/.bash_syle_cache");
  fetchResponses["software/bootstrap/safe-source.bash"] = fs.readFileSync("software/bootstrap/safe-source.bash", "utf8");
  setSandboxGlobal("findPathList", (folder, pattern) =>
    fs
      .readdirSync(home, { withFileTypes: true })
      .filter((entry) => entry.isFile() && pattern.test(entry.name))
      .map((entry) => path.join(folder, entry.name)),
  );
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
  fs.writeFileSync(path.join(home, ".bashrc"), source);
  fs.writeFileSync(path.join(home, ".bash_profile"), fileSystem["/mock/home/.bash_profile"].split("/mock/home").join(home));
  fs.writeFileSync(path.join(home, ".bash_syle"), "");
  fs.writeFileSync(path.join(home, ".bash_syle_common"), "");
  const cache = getIndexConstant("BASH_SYLE_CACHE_PATH").split("/mock/home").join(home);
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.writeFileSync(cache, "");
  return path.join(home, ".bashrc");
}

describe("work shell startup", () => {
  it("sources only matching work shell files in lexical order", async () => {
    fs.writeFileSync(path.join(home, ".work_zeta.bash"), "printf 'zeta\\n'\n");
    fs.writeFileSync(path.join(home, ".work_alpha team.bash"), "printf 'alpha\\n'\n");
    fs.writeFileSync(path.join(home, ".work_acme_instructions.md"), "invalid shell data");
    fs.writeFileSync(path.join(home, ".bash_work_old.bash"), "printf 'old\\n'\n");
    fs.mkdirSync(path.join(home, ".work_folder.bash"));
    const startup = await renderStartup();
    expect(fs.readFileSync(startup, "utf8")).toContain(`safe_source '${home}/.work_alpha team.bash'`);
    expect(fs.readFileSync(startup, "utf8")).toContain(`safe_source '${home}/.work_zeta.bash'`);
    const result = spawnSync("/bin/bash", ["--noprofile", "--norc", startup], {
      env: { ...process.env, HOME: home, BASH_ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("alpha\nzeta\n");
    expect(result.stderr).toBe("");
  });

  it("discovers files added after generation and accepts names without an underscore", async () => {
    const startup = await renderStartup();
    fs.writeFileSync(path.join(home, ".worklater.bash"), "printf 'later\\n'\n");
    const result = spawnSync("/bin/bash", ["--noprofile", "--norc", startup], {
      env: { ...process.env, HOME: home, BASH_ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("later\n");
    expect(result.stderr).toBe("");
  });

  it("does not repeat overlay effects when the entry point is read twice", async () => {
    fs.writeFileSync(path.join(home, ".work_once.bash"), "printf 'once\\n'\n");
    const startup = await renderStartup();
    const result = spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", '. "$STARTUP"; . "$STARTUP"'], {
      env: { ...process.env, HOME: home, STARTUP: startup, BASH_ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("once\n");
    expect(result.stderr).toContain("skipped already loaded script:");
  });

  it("shares the same registry through login and non-login startup definitions", async () => {
    fs.writeFileSync(path.join(home, ".work_once.bash"), "printf 'once\\n'\n");
    await renderStartup();
    const result = spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", '. "$HOME/.bash_profile"; safe_source "$HOME/.bashrc"'], {
      env: { ...process.env, HOME: home, BASH_ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("once\n");
    expect(result.stderr).toBe(`[Warning] safe_source skipped already loaded script: ${home}/.bashrc\n`);
  });

  it("quotes shell metacharacters in discovered filenames without executing them", async () => {
    fs.writeFileSync(path.join(home, ".work_'$(touch injected).bash"), "printf 'quoted\\n'\n");
    const startup = await renderStartup();
    const result = spawnSync("/bin/bash", ["--noprofile", "--norc", startup], {
      env: { ...process.env, HOME: home, BASH_ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("quoted\n");
    expect(result.stderr).toBe("");
    expect(fs.existsSync(path.join(home, "injected"))).toBe(false);
  });

  it("skips protected overlay names and symlinks to protected targets", async () => {
    fs.writeFileSync(path.join(home, ".work_private.secret.bash"), "printf 'forbidden\\n'\n");
    fs.symlinkSync(".work_private.secret.bash", path.join(home, ".work_alias.bash"));
    const startup = await renderStartup();
    expect(fs.readFileSync(startup, "utf8")).not.toContain(`safe_source '${home}/.work_private.secret.bash'`);
    const result = spawnSync("/bin/bash", ["--noprofile", "--norc", startup], {
      env: { ...process.env, HOME: home, BASH_ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("fails before writing profiles when the shared helper is unavailable", async () => {
    fetchResponses["software/bootstrap/safe-source.bash"] = "";
    await expect(renderStartup()).rejects.toThrow("Missing shared safe_source bootstrap");
    expect(fileSystem["/mock/home/.bash_syle"]).toBeUndefined();
    expect(fileSystem["/mock/home/.bashrc"]).toBeUndefined();
    expect(fileSystem["/mock/home/.bash_profile"]).toBeUndefined();
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

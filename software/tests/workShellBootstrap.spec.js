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
  fetchResponses["software/bootstrap/profile-sources.bash"] = fs.readFileSync("software/bootstrap/profile-sources.bash", "utf8");
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
  const runner = fs.readFileSync("run.sh", "utf8");
  const start = runner.indexOf("# --- Write ~/.bash_syle_common ---");
  const end = runner.indexOf("\nunset os_flags ollama_default_server_ip code_server_remote_hosts", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const common = spawnSync(
    "/bin/bash",
    ["--noprofile", "--norc", "-c", `function _detect_gui_flags() { :; }\n${runner.slice(start, end)}`],
    {
      env: {
        ...process.env,
        HOME: home,
        BASH_ENV: "",
        BASH_SYLE_COMMON_PATH: path.join(home, ".bash_syle_common"),
        BASH_SYLE_PATH: path.join(home, ".bash_syle"),
        BASH_SYLE_CACHE_PATH: path.join(home, ".bash_syle_cache"),
        is_work_profile: "1",
        LINE_BREAK_HASH: "# fixture",
      },
      encoding: "utf8",
      timeout: 5000,
    },
  );
  expect(common.status).toBe(0);
  expect(common.stderr).toBe("");
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

  it("defers files added after generation until refresh and the next shell", async () => {
    const startup = await renderStartup();
    fs.writeFileSync(path.join(home, ".worklater.bash"), "printf 'later\\n'\n");
    const result = spawnSync("/bin/bash", ["--noprofile", "--norc", startup], {
      env: { ...process.env, HOME: home, BASH_ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    const refresh = spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", '. "$HOME/.bash_syle_common"; refresh_profiles'], {
      env: { ...process.env, HOME: home, BASH_ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(refresh.status).toBe(0);
    expect(refresh.stdout).toBe("");
    expect(refresh.stderr).toBe("");
    const next = spawnSync("/bin/bash", ["--noprofile", "--norc", startup], {
      env: { ...process.env, HOME: home, BASH_ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(next.status).toBe(0);
    expect(next.stdout).toBe("later\n");
    expect(next.stderr).toBe("");
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
    const result = spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", '. "$HOME/.bash_profile"; . "$HOME/.bashrc"'], {
      env: { ...process.env, HOME: home, BASH_ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("once\n");
    expect(result.stderr).toContain(`[Warning] safe_source skipped already loaded script: ${home}/.work_once.bash\n`);
  });

  it("delegates login startup with one direct source line and no loader definition", async () => {
    fs.writeFileSync(path.join(home, ".work_login.bash"), "printf 'login\\n'\n");
    await renderStartup();
    const profile = path.join(home, ".bash_profile");
    expect(fs.readFileSync(profile, "utf8").split(home).join("HOME")).toMatchInlineSnapshot(`
      "# BEGIN Sy bash_syle entry point
      . 'HOME/.bashrc'
      # END Sy bash_syle entry point"
    `);
    const result = spawnSync("/bin/bash", ["--noprofile", "--norc", profile], {
      env: { ...process.env, HOME: home, BASH_ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("login\n");
    expect(result.stderr).toBe("");
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
    fetchResponses["software/bootstrap/profile-sources.bash"] = "";
    await expect(renderStartup()).rejects.toThrow("Missing shared profile-source runtime");
    expect(fileSystem["/mock/home/.bash_syle"]).toBeUndefined();
    expect(fileSystem["/mock/home/.bashrc"]).toBeUndefined();
    expect(fileSystem["/mock/home/.bash_profile"]).toBeUndefined();
  });

  it("loads the common runtime directly before the ordered manifest", async () => {
    const startup = await renderStartup();
    const content = fs.readFileSync(startup, "utf8");
    const entry = content.match(/# BEGIN Sy bash_syle entry point\n([\s\S]*?)# END Sy bash_syle entry point/)[1];
    expect(entry).toBe(`. '${home}/.bash_syle_common'\n`);
    expect(content).toContain("# END Sy bash_syle entry point\n# BEGIN Sy autogenerated managed profile sources\n");
    expect(content).not.toContain("for _sy_work_file");
    expect(content).not.toContain("# Generated by refresh_profiles.");
    expect(content).toMatch(/# BEGIN Sy autogenerated managed profile sources\n# Refreshed at epoch: [0-9]+\n/);
    const common = fs.readFileSync(path.join(home, ".bash_syle_common"), "utf8");
    expect(common).toContain("safe_source ()");
    expect(common).toContain("refresh_profiles ()");
    expect(common).toContain("_PROFILE_REFRESH_INTERVAL_HOURS=8");
  });

  it.each([
    ["printf 'bootstrap\\n'\n", 0, "bootstrap\n", ""],
    [
      "if then\n",
      1,
      "",
      "HOME/.bash_syle_common: line 1: syntax error near unexpected token `then'\nHOME/.bash_syle_common: line 1: `if then'\n",
    ],
    ["return 7\n", 7, "", ""],
  ])("validates and sources %j without requiring full runtime helpers", async (common, status, stdout, stderr) => {
    const startup = await renderStartup();
    const entry = fs.readFileSync(startup, "utf8").match(/# BEGIN Sy bash_syle entry point\n([\s\S]*?)# END Sy bash_syle entry point/)[1];
    fs.writeFileSync(path.join(home, ".bash_syle_common"), common);
    const result = spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", entry], {
      env: { ...process.env, HOME: home, BASH_ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(result.status).toBe(status);
    expect(result.stdout).toBe(stdout);
    expect(result.stderr.split(home).join("HOME")).toBe(stderr);
  });

  it("rejects a protected bootstrap symlink before validating or executing it", async () => {
    const startup = await renderStartup();
    fs.renameSync(path.join(home, ".bash_syle_common"), path.join(home, "private.secret.bash"));
    fs.symlinkSync("private.secret.bash", path.join(home, ".bash_syle_common"));
    const result = spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", '. "$STARTUP"'], {
      env: { ...process.env, HOME: home, STARTUP: startup, BASH_ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("[Warning] safe_source bootstrap validation failed\n");
  });

  it("automatically refreshes stale discovery for the next shell, not the current snapshot", async () => {
    const startup = await renderStartup();
    fs.writeFileSync(startup, fs.readFileSync(startup, "utf8").replace(/# Refreshed at epoch: [0-9]+/, "# Refreshed at epoch: 0"));
    fs.writeFileSync(path.join(home, ".work_added.bash"), "printf 'added\\n'\n");
    const current = spawnSync("/bin/bash", ["--noprofile", "--norc", startup], {
      env: { ...process.env, HOME: home, BASH_ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(current.status).toBe(0);
    expect(current.stdout).toBe("");
    expect(current.stderr).toBe("");
    expect(fs.readFileSync(startup, "utf8")).toContain(".work_added.bash");
    const next = spawnSync("/bin/bash", ["--noprofile", "--norc", startup], {
      env: { ...process.env, HOME: home, BASH_ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(next.status).toBe(0);
    expect(next.stdout).toBe("added\n");
    expect(next.stderr).toBe("");
  });

  it("retains entry-point placement and unrelated user content on regeneration", async () => {
    fileSystem["/mock/home/.bashrc"] = "# user before\n# BEGIN Sy bash_syle entry point\n:\n# END Sy bash_syle entry point\n# user after\n";
    await renderStartup();
    const startup = await renderStartup();
    const content = fs.readFileSync(startup, "utf8");
    expect(content.startsWith("# user before\n# BEGIN Sy bash_syle entry point\n")).toBe(true);
    expect(content.endsWith("# user after")).toBe(true);
    expect(content.match(/^# BEGIN Sy autogenerated managed profile sources$/gm)).toMatchInlineSnapshot(`
      [
        "# BEGIN Sy autogenerated managed profile sources",
      ]
    `);
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

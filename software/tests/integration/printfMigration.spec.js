/** Regression coverage for the echo-to-printf shell migration. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const OLLAMA_PROFILE = path.resolve("software/scripts/advanced/llm/ollama.profile.bash");

describe("printf migration output", () => {
  it("returns the expanded Ollama URL from its helper", () => {
    const source = fs.readFileSync(OLLAMA_PROFILE, "utf8");
    const helper = source.match(/^function _ollama_url\(\) \{[\s\S]*?^\}/m);
    expect(helper).not.toBeNull();

    const result = spawnSync("bash", ["--noprofile", "--norc", "-c", `${helper[0]}\n_ollama_url 'ollama.example'`], {
      env: { ...process.env, BASH_ENV: "", ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("http://ollama.example:11434\n");
  });

  it("joins dynamic echo arguments with spaces", () => {
    const source = fs.readFileSync(path.resolve("run.sh"), "utf8");
    const helper = source.match(/^  function echo\(\) \{[\s\S]*?^  \}/m);
    expect(helper).not.toBeNull();

    const result = spawnSync("bash", ["--noprofile", "--norc", "-c", `${helper[0]}\necho "alpha beta" gamma`], {
      env: { ...process.env, BASH_ENV: "", ENV: "" },
      encoding: "utf8",
      timeout: 5000,
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("alpha beta gamma\n");
  });

  it("uses printf in the shell command embedded in the bookmark preview", () => {
    const source = fs.readFileSync(path.resolve("software/scripts/bash-fzf.profile.bash"), "utf8");
    const helper = source.match(/^function fuzzy_favorite_command\(\) \{[\s\S]*?^\}/m);
    expect(helper).not.toBeNull();
    const preview = helper[0].match(/--preview='([^']*)'/);
    expect(preview).not.toBeNull();
    expect(preview[1]).not.toMatch(/\becho\b/);
    expect(preview[1]).toContain('printf "%s\\\\n"');
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { spawnSync } from "child_process";

import fs from "fs";

import path from "path";

import { HELPER_SOURCE } from "./printActionSummary.helpers.js";

let sandbox = "";

const REQUIRED_TOOLS = ["realpath", "dirname", "stat", "id", "mkdir", "rm", "cat", "ln", "chmod", "tr"];

beforeEach(() => {
  sandbox = fs.mkdtempSync("/tmp/_print_action_summary_");
  fs.mkdirSync(path.join(sandbox, "bin"));
  fs.mkdirSync(path.join(sandbox, "home"));
  for (const tool of REQUIRED_TOOLS) {
    for (const dir of ["/usr/bin", "/bin", "/usr/local/bin", "/opt/homebrew/bin"]) {
      const src = path.join(dir, tool);
      if (fs.existsSync(src)) {
        fs.symlinkSync(src, path.join(sandbox, "bin", tool));
        break;
      }
    }
  }
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

function stubWslpath(transform) {
  const p = path.join(sandbox, "bin", "wslpath");
  // POSIX sh shebang (NOT `#!/usr/bin/env bash` — the sandbox PATH excludes /usr/bin
  // so `env` would fail to locate bash). /bin/sh is always present.
  const stub = `#!/bin/sh
if [ "$1" = "-m" ]; then
  case "$2" in
${Object.entries(transform.cases || {})
  .map(([k, v]) => `    ${JSON.stringify(k)}) echo ${JSON.stringify(v)} ;;`)
  .join("\n")}
    *) echo "$2" ;;
  esac
else
  echo "$2"
fi
`;
  fs.writeFileSync(p, stub);
  fs.chmodSync(p, 0o755);
}

/**
 * Execute the native summary in a bounded Bash process and require clean stderr.
 * @param {{args: string[], cwd?: string, wslpath?: {cases: Record<string, string>}}} options Fixture command and optional overrides.
 * @returns {string} Captured summary or help text.
 * @throws {Error} If fixture IO fails or subprocess output violates its contract.
 * @description Writes the test-owned shell script and asserts its exit status and diagnostics.
 */
function callSummary({ args, cwd, wslpath }) {
  if (wslpath) stubWslpath(wslpath);
  const home = path.join(sandbox, "home");
  const workdir = cwd ?? home;
  const script = [
    `set -euo pipefail`,
    `unset LINE_BREAK_EQUAL`,
    `HOME=${JSON.stringify(home)}`,
    `PATH=${JSON.stringify(path.join(sandbox, "bin"))}`,
    `cd ${JSON.stringify(workdir)}`,
    HELPER_SOURCE,
    `print_action_summary ${args.map((a) => JSON.stringify(a)).join(" ")}`,
  ].join("\n");
  const scriptPath = path.join(sandbox, "run.sh");
  fs.writeFileSync(scriptPath, script);
  const result = spawnSync("/bin/bash", [scriptPath], { encoding: "utf-8", timeout: 5000 });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe("");
  return result.stdout;
}

function rp(p) {
  return fs.realpathSync(p);
}

describe("print_action_summary", () => {
  it("prints native help without missing helper diagnostics", () => {
    expect(callSummary({ args: ["--help"] })).toBe(
      "print_action_summary: show copy-paste-runnable action summary\n" +
        "  Usage: print_action_summary [--run-folder=<folder>] <target_path> [<binary> [<extra_args>...]]\n" +
        "  Prints PWD, cd command, and optional binary invocation.\n" +
        "  --run-folder overrides the cd target for commands that must run somewhere\n" +
        "  other than where the file lives (e.g. applying a patch from inside the repo).\n",
    );
  });

  describe("--run-folder override", () => {
    it("cds to the override instead of the folder holding the file", () => {
      // The patch-transfer bug: `git_patch_apply` runs `git apply`, whose paths are
      // repo-relative, but the patch itself lives in a throwaway /tmp/patch-XXXXXX.
      // The default block cd'd there — outside any git repo — so every hunk failed
      // with "No such file or directory" and the patch read as corrupt.
      const repo = path.join(sandbox, "home", "myrepo");
      const patchDir = path.join(sandbox, "home", "patch-abc123");
      fs.mkdirSync(repo);
      fs.mkdirSync(patchDir);
      const patch = path.join(patchDir, "myrepo.patch");
      fs.writeFileSync(patch, "");

      const out = callSummary({ args: [`--run-folder=${repo}`, patch, "git_patch_apply"] });
      expect(out).toBe(
        [
          "=".repeat(80),
          `PWD: "${path.join(sandbox, "home")}"`,
          `cd "${rp(repo)}"`,
          `git_patch_apply "${rp(patch)}"`,
          "=".repeat(80),
          "",
        ].join("\n"),
      );

      // The target keeps pointing at the patch — only the cd moved.
      expect(out).not.toContain(`cd "${rp(patchDir)}"`);
    });

    it("leaves the default cd behavior untouched when the flag is absent", () => {
      const dir = path.join(sandbox, "home", "proj");
      fs.mkdirSync(dir);
      const file = path.join(dir, "notes.md");
      fs.writeFileSync(file, "");

      const out = callSummary({ args: [file, "vim"] });
      expect(out).toContain(`cd "${rp(dir)}"`);
    });

    it("still prints the block when the override folder does not exist", () => {
      // A non-existent cd target must degrade to a visibly wrong path rather than
      // silently falling back to the patch folder, which is the failure mode that
      // reads as correct.
      const dir = path.join(sandbox, "home", "proj2");
      fs.mkdirSync(dir);
      const file = path.join(dir, "x.patch");
      fs.writeFileSync(file, "");

      const out = callSummary({ args: [`--run-folder=/no/such/repo`, file, "git_patch_apply"] });
      expect(out).toContain(`cd "/no/such/repo"`);
      expect(out).not.toContain(`cd "${rp(dir)}"`);
    });
  });

  describe("symlinked target", () => {
    it("prints the command against the link and again against the file it points to", () => {
      const dir = path.join(sandbox, "home", "repo");
      fs.mkdirSync(dir);
      const real = path.join(dir, "AGENTS.md");
      fs.writeFileSync(real, "");
      fs.symlinkSync("AGENTS.md", path.join(dir, "CLAUDE.md"));

      const out = callSummary({ args: [path.join(dir, "CLAUDE.md"), "cat"] });
      expect(out).toBe(
        [
          "=".repeat(80),
          `PWD: "${path.join(sandbox, "home")}"`,
          `cd "${rp(dir)}"`,
          `cat "${rp(dir)}/CLAUDE.md"`,
          `cat "${rp(real)}"`,
          "=".repeat(80),
          "",
        ].join("\n"),
      );
    });

    it("prints a single command line for a regular file", () => {
      const dir = path.join(sandbox, "home", "plain");
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, "README.md"), "");

      const out = callSummary({ args: [path.join(dir, "README.md"), "cat"] });
      expect(out.split("\n").filter((l) => l.startsWith("cat "))).toEqual([`cat "${rp(dir)}/README.md"`]);
    });
  });

  it("prints PWD + cd <parent> + binary <file> for a file selection with binary", () => {
    const dir = path.join(sandbox, "home", "proj");
    fs.mkdirSync(dir);
    const file = path.join(dir, "script.js");
    fs.writeFileSync(file, "");

    const out = callSummary({ args: [file, "vim"] });
    expect(out).toBe(
      ["=".repeat(80), `PWD: "${path.join(sandbox, "home")}"`, `cd "${rp(dir)}"`, `vim "${rp(file)}"`, "=".repeat(80), ""].join("\n"),
    );
  });

  it("prints PWD + cd <self> + binary <self> for a folder selection with binary", () => {
    const dir = path.join(sandbox, "home", "proj");
    fs.mkdirSync(dir);
    const out = callSummary({ args: [dir, "subl"] });
    expect(out).toBe(
      ["=".repeat(80), `PWD: "${path.join(sandbox, "home")}"`, `cd "${rp(dir)}"`, `subl "${rp(dir)}"`, "=".repeat(80), ""].join("\n"),
    );
  });

  it("omits the binary line when no binary is passed (folder navigation)", () => {
    const dir = path.join(sandbox, "home", "proj");
    fs.mkdirSync(dir);
    const out = callSummary({ args: [dir] });
    expect(out).toBe(["=".repeat(80), `PWD: "${path.join(sandbox, "home")}"`, `cd "${rp(dir)}"`, "=".repeat(80), ""].join("\n"));
  });

  it("inserts extra args between binary and target", () => {
    const dir = path.join(sandbox, "home", "proj");
    fs.mkdirSync(dir);
    const out = callSummary({ args: [dir, "subl", "-n", "-w"] });
    expect(out.split("\n")).toContain(`subl "-n" "-w" "${rp(dir)}"`);
  });

  it("quotes paths with spaces so the rendered command is shell-safe", () => {
    const dir = path.join(sandbox, "home", "gha workflow");
    fs.mkdirSync(dir);
    const file = path.join(dir, "main.yml");
    fs.writeFileSync(file, "");

    const out = callSummary({ args: [file, "vim"] });
    // Every path is wrapped in literal double quotes; spaces stay intact.
    expect(out).toContain(`cd "${rp(dir)}"`);
    expect(out).toContain(`vim "${rp(file)}"`);
  });

  it("prints a second `cd` line on WSL when the resolved path differs", () => {
    const dir = path.join(sandbox, "home", "proj");
    fs.mkdirSync(dir);
    const file = path.join(dir, "f.txt");
    fs.writeFileSync(file, "");

    const out = callSummary({
      args: [file, "vim"],
      wslpath: {
        // Case labels must use the realpath'd path — that's what the helper feeds wslpath.
        cases: {
          [rp(dir)]: "C:/proj",
          [rp(file)]: "C:/proj/f.txt",
        },
      },
    });
    expect(out).toBe(
      [
        "=".repeat(80),
        `PWD: "${path.join(sandbox, "home")}"`,
        `cd "${rp(dir)}"`,
        `cd "C:/proj"`, // resolved cd is the second hop, immediately after the unix cd
        `vim "${rp(file)}"`, // binary line is the unix path first…
        `vim "C:/proj/f.txt"`, // …then mirrored with the resolved (Windows-style) target
        "=".repeat(80),
        "",
      ].join("\n"),
    );
  });

  it("does NOT print the resolved cd line when wslpath returns the same path", () => {
    const dir = path.join(sandbox, "home", "proj");
    fs.mkdirSync(dir);
    // No `cases` overrides → default branch echoes the input unchanged.
    const out = callSummary({
      args: [dir],
      wslpath: { cases: {} },
    });
    // Only the PWD + cd block, no duplicate cd line.
    const cdLines = out.split("\n").filter((l) => l.startsWith("cd "));
    expect(cdLines).toHaveLength(1);
  });

  it("does NOT print the resolved cd line off-WSL (no wslpath stub installed)", () => {
    const dir = path.join(sandbox, "home", "proj");
    fs.mkdirSync(dir);
    const out = callSummary({ args: [dir] });
    const cdLines = out.split("\n").filter((l) => l.startsWith("cd "));
    expect(cdLines).toHaveLength(1);
  });
});

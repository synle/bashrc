/** Real-Git contracts for tracked-file revision comparisons and snapshot lifetime. */
import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

/** Checkout root containing canonical shell sources. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
/** Core predicates used by the shipped dispatcher. */
const CORE = readFileSync(path.join(ROOT, "software/bootstrap/profile-core.sh"), "utf8");
/** Exact shipped comparison section, including helpers and aliases. */
const DIFF = readFileSync(path.join(ROOT, "software/bootstrap/profile-advanced.sh"), "utf8")
  .split("# --- Diff (file diff or git hash compare) ---\n")[1]
  .split("# SOURCE | software/scripts/bash-git-helpers.profile.bash")[0];
/** Native tools resolved from this host before isolating PATH. */
const TOOLS = execFileSync("/bin/bash", ["-c", "type -P git tr mktemp rm rmdir cat"], { encoding: "utf8" }).trim().split("\n");
/** Actual Git executable used for isolated repository fixtures. */
const GIT = TOOLS[0];

/**
 * Run the twice-loaded shipped dispatcher against independent two-commit history.
 * @param {string[]} args - Operands; @file, @absolute, @sha1, @sha2, @short1, and @blob expand to fixture values.
 * @param {object} [options] - Path, repository, renderer, and fault-injection controls.
 * @param {string} [options.filename] - Exact repository-relative tracked filename.
 * @param {boolean} [options.repository] - Whether to initialize a Git working tree.
 * @param {string} [options.setup] - Fixed shell setup before invoking diff.
 * @param {string} [options.invocation] - Fixed invocation using positional operands.
 * @param {number} [options.editorStatus] - Recording editor's exit status.
 * @param {string} [options.oldContent] - Initial committed bytes.
 * @param {string} [options.headContent] - HEAD committed bytes.
 * @param {Function} [options.prepare] - Additional fixture changes; receives root, file, and a Git runner.
 * @returns {object} Process output, launch marker, retained snapshots, and unchanged working bytes.
 * @throws {Error} On fixture failure; removes all owned repository and snapshot files.
 */
function runRevisionDiff(
  args,
  {
    filename = "nested/target file.txt",
    repository = true,
    setup = "",
    invocation = 'diff "$@"',
    editorStatus = 0,
    oldContent = "old line\n\n",
    headContent = "head line\n\n",
    prepare = () => {},
  } = {},
) {
  const root = mkdtempSync(path.join(os.tmpdir(), "diff-revisions-test-"));
  try {
    const bin = path.join(root, "bin");
    const temp = path.join(root, "snapshots");
    const file = path.join(root, filename);
    mkdirSync(bin);
    mkdirSync(temp);
    mkdirSync(path.dirname(file), { recursive: true });
    for (const tool of TOOLS) symlinkSync(tool, path.join(bin, path.basename(tool)));
    const env = {
      ...process.env,
      PATH: bin,
      TMPDIR: temp,
      BASH_ENV: "/dev/null",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_PAGER: "cat",
      LC_ALL: "C",
      LAUNCHED: path.join(root, "launched"),
      EDITOR_STATUS: String(editorStatus),
    };
    /** Execute actual Git with isolated configuration and bounded runtime. */
    const git = (operands) =>
      execFileSync(GIT, ["--literal-pathspecs", ...operands], { cwd: root, env, stdio: "pipe", timeout: 5000 })
        .toString()
        .trim();
    writeFileSync(file, oldContent);
    writeFileSync(path.join(root, "other.txt"), "other old line\n");
    let sha1 = "deadbeef";
    let sha2 = "cafebabe";
    let blob = "badblob";
    if (repository) {
      git(["init", "-q"]);
      git(["add", "--", filename, "other.txt"]);
      git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "Initial"]);
      sha1 = git(["rev-parse", "HEAD"]);
      blob = git(["rev-parse", `HEAD:${filename}`]);
      writeFileSync(file, headContent);
      writeFileSync(path.join(root, "other.txt"), "other head line\n");
      git(["add", "--", filename, "other.txt"]);
      git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "Changed"]);
      sha2 = git(["rev-parse", "HEAD"]);
      writeFileSync(file, "staged line\n");
      git(["add", "--", filename]);
      writeFileSync(file, "working tree line\n");
    }
    for (const editor of ["code", "zed", "winmergeu.exe", "smerge"]) {
      writeFileSync(path.join(bin, editor), '#!/bin/bash\n: > "$LAUNCHED"\nprintf "%s\\0" "$@"\nexit "$EDITOR_STATUS"\n', { mode: 0o755 });
    }
    const source = path.join(root, "profile.bash");
    writeFileSync(
      source,
      `${CORE.match(/function is_help_arg\(\) \{[\s\S]*?\n\}/)[0]}\n${CORE.match(/function is_runnable_command\(\) \{[\s\S]*?\n\}/)[0]}\n${DIFF}`,
    );
    prepare({ root, file, git });
    const replacements = { "@file": filename, "@absolute": file, "@sha1": sha1, "@sha2": sha2, "@short1": sha1.slice(0, 8), "@blob": blob };
    const result = spawnSync(
      "/bin/bash",
      [
        "--noprofile",
        "--norc",
        "-c",
        '. "$SOURCE"\n. "$SOURCE"\n' + setup + "\n" + invocation,
        "test",
        ...args.map((arg) => replacements[arg] ?? arg),
      ],
      { cwd: root, env: { ...env, SOURCE: source }, encoding: "utf8", timeout: 5000 },
    );
    const snapshots = readdirSync(temp).map((folder) => ({
      mode: statSync(path.join(temp, folder)).mode & 0o777,
      files: readdirSync(path.join(temp, folder)).map((name) => ({
        name,
        content: readFileSync(path.join(temp, folder, name), "utf8"),
        mode: statSync(path.join(temp, folder, name)).mode & 0o777,
      })),
    }));
    return { ...result, launched: existsSync(env.LAUNCHED), snapshots, working: existsSync(file) ? readFileSync(file, "utf8") : null };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("tracked-file revision diff", () => {
  it.each([[["@sha1"]], [["@sha1", "@sha2"]], [["@short1"]], [["HEAD~1", "HEAD"]]])(
    "compares historical bytes in order for %j, never staged or working bytes",
    (revisions) => {
      const result = runRevisionDiff(["@file", ...revisions]);
      expect(result.status, result.stderr).toBe(1);
      expect(result.stdout).toContain("-old line\n+head line");
      expect(result.stdout).not.toContain("working tree line");
      expect(result.stdout).not.toContain("staged line");
      expect(result.stdout).not.toContain("other head line");
      expect(result.stderr).toBe("");
      expect(result.working).toBe("working tree line\n");
      expect(result.snapshots).toEqual([]);
    },
  );

  it.each([
    [["-r"], ["@sha1"]],
    [["--reverse"], ["@sha1", "@sha2"]],
    [
      ["-delta2", "-r"],
      ["@sha1", "@sha2"],
    ],
    [["--reverse", "-delta1"], ["@sha1"]],
  ])("reverses historical comparisons with %j", (flags, revisions) => {
    const result = runRevisionDiff([...flags, "@file", ...revisions]);
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout).toContain("-head line\n+old line");
    expect(result.stderr).toBe("");
    expect(result.working).toBe("working tree line\n");
    expect(result.snapshots).toEqual([]);
  });

  it("reverses GUI snapshot paths without changing revision validation labels", () => {
    const result = runRevisionDiff(["-r", "-code", "@file", "@sha1", "@sha2"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.launched).toBe(true);
    expect(
      result.stdout
        .split("\0")
        .slice(1, 3)
        .map((file) => path.basename(file)),
    ).toEqual(["sha2", "sha1"]);
    expect(result.snapshots[0].files).toEqual([
      { name: "sha1", content: "old line\n\n", mode: 0o600 },
      { name: "sha2", content: "head line\n\n", mode: 0o600 },
    ]);
  });

  it("retains original sha1 error labels when reversed", () => {
    const result = runRevisionDiff(["--reverse", "-code", "@file", "invalid-revision", "HEAD"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toBe("diff: sha1=invalid-revision is not a valid Git commit.\n");
    expect(result.stdout).toBe("");
    expect(result.launched).toBe(false);
    expect(result.snapshots).toEqual([]);
  });

  it("returns equality and cleans both snapshots", () => {
    const result = runRevisionDiff(["@file", "@sha2", "@sha2"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(result.snapshots).toEqual([]);
  });

  it.each(["-delta1", "-delta2"])("reuses %s for revision snapshots", (mode) => {
    const result = runRevisionDiff([mode, "@file", "@sha1", "@sha2"]);
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout).toContain("-old line\n+head line");
    expect(result.stderr).toBe("");
    expect(result.snapshots).toEqual([]);
  });

  it.each(["-code", "-zed", "-z", "-winmerge", "-smerge", "-sublime_merge"])(
    "reuses %s and retains private historical bytes for asynchronous readers",
    (mode) => {
      const result = runRevisionDiff([mode, "@file", "@sha1", "@sha2"]);
      expect(result.status, result.stderr).toBe(0);
      expect(result.launched).toBe(true);
      expect(result.stderr).toContain("diff: revision snapshots retained:");
      expect(result.snapshots).toEqual([
        {
          mode: 0o700,
          files: [
            { name: "sha1", content: "old line\n\n", mode: 0o600 },
            { name: "sha2", content: "head line\n\n", mode: 0o600 },
          ],
        },
      ]);
    },
  );

  it.each(["", "no trailing newline", "two trailing newlines\n\n", "quote'\"\\\n\u2603\u0000\u202e\n"])(
    "preserves historical bytes %j without command-substitution trimming",
    (content) => {
      const result = runRevisionDiff(["-code", "@file", "@sha1"], { oldContent: content, headContent: content });
      expect(result.status, result.stderr).toBe(0);
      expect(result.snapshots[0].files).toEqual([
        { name: "sha1", content, mode: 0o600 },
        { name: "sha2", content, mode: 0o600 },
      ]);
    },
  );

  it.each(["-dash.txt", "nested/quote'\"\\\n\u2603.txt", "nested/[target]*.txt", ":(glob)*"])(
    "handles exact tracked filename %j",
    (filename) => {
      const result = runRevisionDiff(["--", "@file", "@sha1", "@sha2"], { filename });
      expect(result.status, result.stderr).toBe(1);
      expect(result.stdout).toContain("-old line\n+head line");
      expect(result.stderr).toBe("");
      expect(result.snapshots).toEqual([]);
    },
  );

  it("resolves absolute tracked paths", () => {
    const result = runRevisionDiff(["@absolute", "@sha1"]);
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout).toContain("-old line\n+head line");
    expect(result.stderr).toBe("");
  });

  it("resolves parent-relative tracked paths from a subfolder", () => {
    const result = runRevisionDiff(["../nested/target file.txt", "@sha1"], { setup: "cd nested" });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout).toContain("-old line\n+head line");
    expect(result.stderr).toBe("");
  });

  it("can compare a tracked file deleted only from the working tree", () => {
    const result = runRevisionDiff(["@file", "@sha1"], { prepare: ({ file }) => rmSync(file) });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout).toContain("-old line\n+head line");
    expect(result.stderr).toBe("");
    expect(result.working).toBeNull();
  });

  it.each([
    [["bad-sha", "HEAD"], "diff: sha1=bad-sha is not a valid Git commit.\n"],
    [["HEAD", "bad-sha"], "diff: sha2=bad-sha is not a valid Git commit.\n"],
    [["bad-first", "bad-second"], "diff: sha1=bad-first is not a valid Git commit.\ndiff: sha2=bad-second is not a valid Git commit.\n"],
    [[""], "diff: sha1= is not a valid Git commit.\n"],
    [["HEAD", ""], "diff: sha2= is not a valid Git commit.\n"],
    [["--output=unexpected"], "diff: sha1=--output=unexpected is not a valid Git commit.\n"],
  ])("rejects invalid revisions %j before creating snapshots or launching", (revisions, error) => {
    const result = runRevisionDiff(["-code", "@file", ...revisions]);
    expect(result.status).toBe(1);
    expect(result.stderr).toBe(error);
    expect(result.stdout).toBe("");
    expect(result.launched).toBe(false);
    expect(result.snapshots).toEqual([]);
    expect(result.working).toBe("working tree line\n");
  });

  it("rejects an existing Git blob as a commit", () => {
    const result = runRevisionDiff(["-code", "@file", "@blob"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/^diff: sha1=[0-9a-f]+ is not a valid Git commit\.\n$/);
    expect(result.stdout).toBe("");
    expect(result.launched).toBe(false);
    expect(result.snapshots).toEqual([]);
  });

  it.each([[["@file", "@sha1"]], [["@file", "@sha1", "@sha2"]]])("rejects revision mode outside Git for %j", (args) => {
    const result = runRevisionDiff(["-code", ...args], { repository: false });
    expect(result.status).toBe(1);
    expect(result.stderr).toBe("diff: revision mode requires a Git-tracked file; current folder is not in a Git working tree.\n");
    expect(result.stdout).toBe("");
    expect(result.launched).toBe(false);
    expect(result.snapshots).toEqual([]);
  });

  it.each(["missing.txt", "nested", "nested/*.txt", ""])("rejects untracked or non-file target %j", (target) => {
    const result = runRevisionDiff(["-code", target, "@sha1", "@sha2"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toBe(`diff: revision mode requires a Git-tracked file in the current repository: ${target}\n`);
    expect(result.stdout).toBe("");
    expect(result.launched).toBe(false);
    expect(result.snapshots).toEqual([]);
  });

  it("rejects an existing untracked target", () => {
    const result = runRevisionDiff(["-code", "untracked.txt", "@sha1"], {
      prepare: ({ root }) => writeFileSync(path.join(root, "untracked.txt"), "untracked line\n"),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toBe("diff: revision mode requires a Git-tracked file in the current repository: untracked.txt\n");
    expect(result.stdout).toBe("");
    expect(result.launched).toBe(false);
    expect(result.snapshots).toEqual([]);
  });

  it("rejects a tracked folder deleted from the working tree instead of comparing its first file", () => {
    const result = runRevisionDiff(["-code", "nested", "@sha1"], {
      prepare: ({ root }) => rmSync(path.join(root, "nested"), { recursive: true }),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toBe("diff: revision mode requires a Git-tracked file in the current repository: nested\n");
    expect(result.stdout).toBe("");
    expect(result.launched).toBe(false);
    expect(result.snapshots).toEqual([]);
  });

  it("rejects a file outside the current repository", () => {
    const result = runRevisionDiff(["-code", "@absolute", "@sha1"], {
      prepare: ({ root, git }) => {
        mkdirSync(path.join(root, "isolated"));
        git(["-C", "isolated", "init", "-q"]);
      },
      setup: "cd isolated",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("diff: revision mode requires a Git-tracked file in the current repository:");
    expect(result.stdout).toBe("");
    expect(result.launched).toBe(false);
    expect(result.snapshots).toEqual([]);
  });

  it("cleans historical snapshots when the selected editor is unavailable", () => {
    const result = runRevisionDiff(["-code", "@file", "@sha1"], {
      prepare: ({ root }) => rmSync(path.join(root, "bin", "code")),
    });
    expect(result.status).toBe(127);
    expect(result.stderr).toBe("diff: required command not found: code\n");
    expect(result.stdout).toBe("");
    expect(result.launched).toBe(false);
    expect(result.snapshots).toEqual([]);
  });

  it("does not fall back when the second operand is an existing hash-named file", () => {
    const result = runRevisionDiff(["@file", "HEAD"], {
      prepare: ({ root }) => writeFileSync(path.join(root, "HEAD"), "existing path line\n"),
    });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout).toContain("-working tree line\n+existing path line");
    expect(result.stderr).toBe("");
    expect(result.snapshots).toEqual([]);
  });

  it.each(["folder", "broken-link"])("does not reinterpret existing non-file operand %s as a revision", (operand) => {
    const result = runRevisionDiff(["@file", operand], {
      prepare: ({ root }) => {
        mkdirSync(path.join(root, "folder"));
        symlinkSync("missing-target", path.join(root, "broken-link"));
      },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toBe(`diff: file2=${operand} is not an existing regular file.\n`);
    expect(result.stdout).toBe("");
    expect(result.snapshots).toEqual([]);
  });

  it("reports a target absent from sha2 and cleans partial snapshots", () => {
    const result = runRevisionDiff(["-code", "other.txt", "HEAD~1", "HEAD"], {
      prepare: ({ git }) => {
        git(["rm", "-q", "other.txt"]);
        git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "Remove"]);
        git(["checkout", "HEAD~1", "--", "other.txt"]);
      },
    });
    // HEAD is now the deletion commit; HEAD~1 contains the target.
    expect(result.status).toBe(1);
    expect(result.stderr).toBe("diff: target_file=other.txt is not a file at sha2=HEAD.\n");
    expect(result.stdout).toBe("");
    expect(result.launched).toBe(false);
    expect(result.snapshots).toEqual([]);
  });

  it("reports a target absent from sha1 without invoking the renderer", () => {
    const result = runRevisionDiff(["-code", "later.txt", "HEAD~1", "HEAD"], {
      prepare: ({ root, git }) => {
        writeFileSync(path.join(root, "later.txt"), "later line\n");
        git(["add", "later.txt"]);
        git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "Add later"]);
      },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toBe("diff: target_file=later.txt is not a file at sha1=HEAD~1.\n");
    expect(result.stdout).toBe("");
    expect(result.launched).toBe(false);
    expect(result.snapshots).toEqual([]);
  });

  it("reports snapshot allocation failure without launching", () => {
    const result = runRevisionDiff(["-code", "@file", "@sha1"], { setup: "function mktemp() { return 17; }" });
    expect(result.status).toBe(1);
    expect(result.stderr).toBe("diff: could not create revision snapshots.\n");
    expect(result.stdout).toBe("");
    expect(result.launched).toBe(false);
    expect(result.snapshots).toEqual([]);
  });

  it("preserves renderer failure and cleans snapshots", () => {
    const result = runRevisionDiff(["-code", "@file", "@sha1"], { editorStatus: 42 });
    expect(result.status).toBe(42);
    expect(result.launched).toBe(true);
    expect(result.stderr).toBe("");
    expect(result.snapshots).toEqual([]);
  });
});

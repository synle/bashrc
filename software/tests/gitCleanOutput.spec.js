/** Execute Git cleanup aliases to verify compact, unindented status output. */
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

/** Source Git configuration, not an installed user file. */
const CONFIG_PATH = path.resolve(import.meta.dirname, "../scripts/git.gitconfig");
/** Disposable folders owned by this spec. */
const TEMP_FOLDERS = [];

afterEach(() => {
  for (const folder of TEMP_FOLDERS.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

/**
 * Run the native Git-config alias body through POSIX sh with deterministic Git responses.
 * @param {Record<string, string>} options - Merged branch and local/remote tag fixture values.
 * @returns {{stdout: string, stderr: string, status: number | null, deleted: string}} Output and deletion requests.
 * @throws {Error} When Git cannot parse the template or the subprocess exceeds its deadline.
 */
function runCleanupAlias(options = {}) {
  const alias = spawnSync("git", ["config", "--file", CONFIG_PATH, "--get", "alias.clean-merged-branches-and-tags"], {
    encoding: "utf8",
    timeout: 1000,
  });
  expect(alias.status).toBe(0);
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "clean-output-"));
  TEMP_FOLDERS.push(folder);
  const script = `
git() {
  case "$1 $2" in
  'symbolic-ref --short') echo origin/main ;;
  'branch --show-current') echo main ;;
  'branch --merged') printf '  main\n%s' "$MERGED" ;;
  'branch -d') printf 'branch:%s\n' "$3" >> deleted; return "$BRANCH_STATUS" ;;
  'ls-remote --tags') printf '%s' "$REMOTE_TAGS" ;;
  'tag -d') printf 'tag:%s\n' "$3" >> deleted ;;
  'tag ') printf '%s' "$LOCAL_TAGS" ;;
  *) echo "unexpected Git request: $*" >&2; return 99 ;;
  esac
}
${alias.stdout.trim().slice(1)}
`;
  const result = spawnSync("/bin/sh", ["-c", script], {
    cwd: folder,
    encoding: "utf8",
    env: { ...process.env, MERGED: "", REMOTE_TAGS: "abc\trefs/tags/kept\n", LOCAL_TAGS: "kept\n", BRANCH_STATUS: "0", ...options },
    timeout: 1000,
  });
  if (result.error) throw result.error;
  const deletedPath = path.join(folder, "deleted");
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
    deleted: fs.existsSync(deletedPath) ? fs.readFileSync(deletedPath, "utf8") : "",
  };
}

describe("Git cleanup output", () => {
  it.each([{ LOCAL_TAGS: "kept\n" }, { LOCAL_TAGS: "" }])("subprocess: reports empty results inline %j", (options) => {
    const result = runCleanupAlias(options);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.deleted).toBe("");
    expect(result.stdout).toBe("-> merged branches (target: main): none found\n-> tags pruned from origin: none found\n");
  });

  it("subprocess: keeps remote tag uncertainty on one line without deleting local tags", () => {
    const result = runCleanupAlias({ REMOTE_TAGS: "", LOCAL_TAGS: "local-only\n" });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.deleted).toBe("");
    expect(result.stdout).toContain("-> tags pruned from origin: origin has no tags (or unreachable); skipping tag prune");
    expect(result.stdout).not.toMatch(/^\s+->/m);
    expect(result.stdout.split("\n")).toHaveLength(3);
  });

  it("subprocess: keeps rejected branch deletion unindented and identifies the branch", () => {
    const result = runCleanupAlias({ MERGED: "  topic\n", BRANCH_STATUS: "1" });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.deleted).toBe("branch:topic\n");
    expect(result.stdout).toContain("-> merged branches (target: main): skip 'topic' (not fully merged)\n");
    expect(result.stdout).not.toMatch(/^\s+->/m);
  });

  it("subprocess: labels each deletion inline and preserves cleanup targets", () => {
    const result = runCleanupAlias({ MERGED: "  topic\n", LOCAL_TAGS: "kept\nstale\n" });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.deleted).toBe("branch:topic\ntag:stale\n");
    expect(result.stdout).toBe(
      "-> merged branches (target: main): deleting merged branch 'topic'\n-> tags pruned from origin: deleting stale tag 'stale'\n",
    );
  });
});

/** Tests the clone helper's destination validation and path reporting. */
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE_PATH = path.join(ROOT_DIR, "software/scripts/bash-git-helpers.profile.bash");

/**
 * Runs clone with a fake Git command and an optional destination.
 * @param {string[]} args - Arguments passed to clone.
 * @param {string} workspace - Temporary workspace used by the fake clone.
 * @returns {string} Clone command output.
 */
function runClone(args, workspace) {
  const script = String.raw`
function is_help_arg() { return 1; }
function git() {
  case "$1" in
  ls-remote) return 0 ;;
  clone1) mkdir -p "$3"; return 0 ;;
  cl1) printf '%s\n' 'legacy background clone'; return 0 ;;
  *) return 1 ;;
  esac
}
source "$1"
if [ -n "$3" ]; then
  clone "$2" "$3"
else
  clone "$2"
fi
`;
  return execFileSync("/bin/bash", ["-c", script, "clone-test", PROFILE_PATH, ...args], {
    cwd: workspace,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

describe("clone helper", () => {
  it("keeps the existing background behavior without a destination", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "bashrc-clone-test-"));
    try {
      expect(runClone(["owner/repo"], workspace)).toContain("legacy background clone");
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("clones to a new destination and prints its absolute path", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "bashrc-clone-test-"));
    const destination = path.join(workspace, "nested", "repo");
    fs.mkdirSync(path.dirname(destination));
    try {
      expect(runClone(["owner/repo", destination], workspace)).toContain(`Cloned repository: ${destination}`);
      expect(fs.existsSync(destination)).toBe(true);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("rejects an existing destination before cloning", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "bashrc-clone-test-"));
    const destination = path.join(workspace, "repo");
    fs.mkdirSync(destination);
    try {
      expect(() => runClone(["owner/repo", destination], workspace)).toThrow();
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});

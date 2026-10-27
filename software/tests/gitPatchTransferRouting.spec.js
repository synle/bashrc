/** Fast unit coverage for clipboard-patch routing and default choices. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import path from "path";

/** Git helper profile loaded without the user's interactive shell. */
const PROFILE = path.resolve("software/scripts/bash-git-helpers.profile.bash");

/** Run the public patch command with isolated clipboard, Git, and apply adapters. */
function runTransfer({ clipboardHasPatch, upstreamAhead, promptStatus = 0 }) {
  return spawnSync(
    "/bin/bash",
    [
      "--noprofile",
      "--norc",
      "-c",
      `
        source "$PROFILE"
        function is_help_arg() { return 1; }
        function git() {
          case "$*" in
          "rev-list --count @{upstream}..HEAD")
            if [ "$UPSTREAM_AHEAD" = "missing" ]; then return 1; fi
            printf '%s\\n' "$UPSTREAM_AHEAD"
            ;;
          *)
            printf 'unexpected git call: %s\\n' "$*" >&2
            return 90
            ;;
          esac
        }
        function _git_patch_clipboard_file() {
          if [ "$CLIPBOARD_HAS_PATCH" = "1" ]; then
            _GIT_PATCH_CLIPBOARD_FILE=/tmp/incoming.patch
            return 0
          fi
          return 2
        }
        function prompt_yes_no() {
          printf 'PROMPT:%s\\nDEFAULT:%s\\n' "$1" "$2"
          return "$PROMPT_STATUS"
        }
        function _git_patch_apply_file() {
          printf 'ACTION:apply\\n'
          _GIT_PATCH_APPLIED_PATCH_COUNT=1
        }
        function _git_patch_commit_applied() { printf 'ACTION:commit\\n'; }
        function _git_patch_create_unpushed() { printf 'ACTION:create\\n'; }
        function _git_patch_outcome_line() { printf 'OUTCOME:%s\\n' "$1"; }
        patch_plain_str
      `,
    ],
    {
      encoding: "utf8",
      timeout: 5000,
      env: {
        ...process.env,
        PROFILE,
        UPSTREAM_AHEAD: upstreamAhead,
        CLIPBOARD_HAS_PATCH: clipboardHasPatch ? "1" : "0",
        PROMPT_STATUS: String(promptStatus),
        BASH_ENV: "/dev/null",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
      },
    },
  );
}

describe("Git patch transfer routing", () => {
  it("defaults to creating when unpushed commits and a clipboard patch both exist", () => {
    const result = runTransfer({ clipboardHasPatch: true, upstreamAhead: "1", promptStatus: 1 });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("DEFAULT:N");
    expect(result.stdout).toContain("ACTION:create");
    expect(result.stdout).not.toContain("ACTION:apply");
    expect(result.stdout).toContain("\u001b[0;33mClipboard holds a patch");
  });

  it("creates a patch when unpushed commits exist without a clipboard patch", () => {
    const result = runTransfer({ clipboardHasPatch: false, upstreamAhead: "1" });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("ACTION:create");
    expect(result.stdout).not.toContain("PROMPT:");
  });

  it("defaults to applying a clipboard patch when the branch is synced", () => {
    const result = runTransfer({ clipboardHasPatch: true, upstreamAhead: "0" });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("DEFAULT:Y");
    expect(result.stdout).toContain("ACTION:apply");
    expect(result.stdout).toContain("ACTION:commit");
  });

  it("does nothing when the branch is synced and the clipboard has no patch", () => {
    const result = runTransfer({ clipboardHasPatch: false, upstreamAhead: "0" });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("no clipboard patch and no unpushed commits");
    expect(result.stdout).not.toContain("ACTION:create");
  });
});

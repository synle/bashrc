/** Guards `unwrap()` against corrupting unified diffs, and the raw copy path that feeds `git apply`. */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ADVANCED_PROFILE = path.join(ROOT_DIR, "software/bootstrap/profile-advanced.sh");
const CLIPBOARD_PROFILE = path.join(ROOT_DIR, "software/scripts/bash-clipboard.profile.bash");
const GIT_HELPERS_PROFILE = path.join(ROOT_DIR, "software/scripts/bash-git-helpers.profile.bash");
const DROPBOX_PROFILE = path.join(ROOT_DIR, "software/scripts/bash-file-dropbox-sync-utils.profile.bash");

/**
 * A unified diff is whitespace-significant in two ways `unwrap()` used to destroy:
 *
 *   1. A blank *context* line is a single space, not an empty line. `unwrap` tested
 *      `line.trim() === ''` and pushed `''`, dropping that space. git then counts
 *      the hunk short and aborts with "corrupt patch at line N".
 *   2. Diff body lines are near-uniform width, which is exactly the shape `unwrap`
 *      uses to detect terminal-wrapped prose. It joined them with `.trim().join(' ')`,
 *      welding a context line onto the following `@@` hunk header.
 *
 * Both fired on `git patch-view | copy`, so every patch copied to the clipboard came
 * back unappliable. The fix is a patch-shape guard in `unwrap` plus a `copy --raw`
 * path that skips the filter entirely.
 */

/** Extracts the JS body of the `node -e` heredoc inside `unwrap()`. */
function extractUnwrapJs() {
  const lines = fs.readFileSync(ADVANCED_PROFILE, "utf-8").split("\n");
  const start = lines.findIndex((line) => line.includes("<< 'JS_EOF'"));
  const end = lines.findIndex((line, index) => index > start && line === "JS_EOF");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return lines.slice(start + 1, end).join("\n");
}

/** Runs the extracted unwrap script over `input` and returns its stdout. */
function runUnwrap(input) {
  return execFileSync("node", ["-e", extractUnwrapJs()], { input, encoding: "utf-8" });
}

/** A minimal but realistic `git format-patch` payload, including a blank context line. */
const SAMPLE_PATCH = [
  "From daeaa006005810b2db00145b446eccf9622ee3b7 Mon Sep 17 00:00:00 2001",
  "From: A Dev <dev@example.com>",
  "Subject: [PATCH] tweak the docs",
  "",
  "---",
  " docs/example.md | 3 ++-",
  " 1 file changed, 2 insertions(+), 1 deletion(-)",
  "",
  "diff --git a/docs/example.md b/docs/example.md",
  "index 1111111..2222222 100644",
  "--- a/docs/example.md",
  "+++ b/docs/example.md",
  "@@ -1,5 +1,6 @@",
  " Blackwell has native FP4 tensor cores, so the -nvfp4 tags look like the",
  " obvious right answer on this particular card. They are however not usable",
  " in practice, because the runtime rejects every one of them on load today.",
  " ",
  "-*look* like the obvious right answer on this card. They are not usable:",
  "+_look_ like the obvious right answer on this card. They are not usable:",
  "+a second added line so the counts stay honest and the hunk stays valid.",
  " ",
  " All tags below were confirmed pullable by the daemon.",
  "",
].join("\n");

describe("unwrap() patch safety", () => {
  it("passes a format-patch payload through byte-for-byte", () => {
    expect(runUnwrap(SAMPLE_PATCH)).toBe(SAMPLE_PATCH);
  });

  it("preserves the single space on blank context lines", () => {
    // The regression that produced "corrupt patch at line 99".
    const output = runUnwrap(SAMPLE_PATCH).split("\n");
    expect(output.filter((line) => line === " ").length).toBe(SAMPLE_PATCH.split("\n").filter((line) => line === " ").length);
  });

  it("never joins diff body lines onto the following hunk header", () => {
    // The regression that produced "corrupt patch at line 828".
    for (const line of runUnwrap(SAMPLE_PATCH).split("\n")) {
      if (line.indexOf("@@ -") > 0) {
        expect.fail(`hunk header welded onto a preceding line: ${line}`);
      }
    }
  });

  it("detects a bare `diff -u` hunk header with no `diff --git` line", () => {
    const bare = ["@@ -1,4 +1,4 @@", " context line one", " ", "-old", "+new", ""].join("\n");
    expect(runUnwrap(bare)).toBe(bare);
  });

  it("still unwraps genuinely terminal-wrapped prose", () => {
    const wrapped = [
      "This is a long paragraph that the terminal wrapped at some fixed width",
      "and here is its continuation line sitting at very nearly that same width",
      "and a short tail.",
      "",
    ].join("\n");
    expect(runUnwrap(wrapped)).toBe(
      "This is a long paragraph that the terminal wrapped at some fixed width " +
        "and here is its continuation line sitting at very nearly that same width " +
        "and a short tail.\n",
    );
  });

  it("does not mistake a Markdown horizontal rule or front matter for a patch", () => {
    const markdown = [
      "---",
      "title: notes",
      "---",
      "",
      "This is a long paragraph that the terminal wrapped at some fixed width",
      "and here is its continuation line sitting at very nearly that same width",
      "and a short tail.",
      "",
    ].join("\n");
    expect(runUnwrap(markdown)).toContain("same width and a short tail.");
  });
});

describe("raw clipboard path", () => {
  const clipboardSource = fs.readFileSync(CLIPBOARD_PROFILE, "utf-8");

  it("copy() accepts --raw", () => {
    expect(clipboardSource).toMatch(/elif \[ "\$1" = "--raw" \]/);
  });

  it("_clipboard_save() bypasses unwrap when passed --raw", () => {
    expect(clipboardSource).toMatch(/\[ "\$\{1:-\}" = "--raw" \] && filter="command cat"/);
  });

  it("git_view_patch_latest_commit copies raw", () => {
    const source = fs.readFileSync(GIT_HELPERS_PROFILE, "utf-8");
    // The patch is rendered to a file once, then both the clipboard and stdout are
    // served from that file — but the clipboard hop is still the raw one.
    expect(source).toContain('git patch-view > "$patch_file"');
    expect(source).toContain('copy --raw "$patch_file"');
    expect(source).not.toMatch(/^\s*copy "\$patch_file"\s*$/m);
    expect(source).not.toMatch(/git patch-view \| copy$/m);
  });

  it("_patch_view_copy copies raw", () => {
    const source = fs.readFileSync(DROPBOX_PROFILE, "utf-8");
    expect(source).toContain("git patch-view | copy --raw");
    expect(source).not.toMatch(/git patch-view \| copy$/m);
  });

  it("git_apply_patch dry-runs before touching the working tree", () => {
    const source = fs.readFileSync(GIT_HELPERS_PROFILE, "utf-8");
    expect(source).toContain('git apply --check "$patch_file"');
  });
});

describe("saved patch files", () => {
  const source = fs.readFileSync(GIT_HELPERS_PROFILE, "utf-8");

  it("should write patches under the run temp root, never a hardcoded /tmp path", () => {
    // `$BASHRC_TEMP_ROOT_DIR` falls back to `$HOME/tmp` on hosts where /tmp is not
    // writable (Termux), so a hardcoded /tmp destination breaks the function there.
    expect(source).toContain('patch_folder="${BASHRC_TEMP_ROOT_DIR:-/tmp/synle/bashrc}/patches"');

    const hardcoded = source.split("\n").filter((line) => /^\s*patch_file=.*"\/tmp\//.test(line));
    expect(hardcoded, `hardcoded /tmp patch destination:\n${hardcoded.join("\n")}`).toEqual([]);
  });

  it("should announce every patch file it creates with the >>> marker", () => {
    const created = source.match(/echo ">>> patch file created \$patch_file"/g) || [];

    // one for git_view_patch_latest_commit, one for git_apply_patch's clipboard capture
    expect(created.length).toBe(2);
  });

  it("should print a copy-paste-runnable action summary for the saved patch", () => {
    expect(source).toContain('print_action_summary "$patch_file" git_apply_patch');
  });

  it("should quote every path expansion so temp roots with spaces survive", () => {
    // $HOME on Windows/macOS routinely contains a space, and BASHRC_TEMP_ROOT_DIR falls
    // back to $HOME/tmp, so a bare `$patch_file` in argument position word-splits. Strip
    // command substitutions and then quoted spans; anything still referencing the vars is
    // genuinely unquoted (uses inside `echo "..."` messages are removed by the strip).
    const unquoted = source.split("\n").filter((line) => {
      const bare = line
        .replace(/\$\([^()]*\)/g, "")
        .replace(/"[^"]*"/g, "")
        .replace(/'[^']*'/g, "");
      return /\$\{?patch_(file|folder)\b/.test(bare);
    });

    expect(unquoted, `unquoted patch path expansion:\n${unquoted.join("\n")}`).toEqual([]);
  });

  it("should not leave an empty patch file behind when format-patch produces nothing", () => {
    expect(source).toContain('[ ! -s "$patch_file" ]');
    expect(source).toContain('command rm -f "$patch_file"');
  });
});

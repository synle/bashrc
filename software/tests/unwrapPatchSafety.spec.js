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

  it("git_patch_create copies raw", () => {
    const source = fs.readFileSync(GIT_HELPERS_PROFILE, "utf-8");
    // The patch is rendered to a file once, then both the clipboard and stdout are
    // served from that file — but the clipboard hop is still the raw one.
    expect(source).toMatch(/git patch-view "\$\{2:-1\}" > "\$patch_file"/);
    expect(source).toContain('copy --raw "$patch_file"');
    expect(source).not.toMatch(/^\s*copy "\$patch_file"\s*$/m);
    expect(source).not.toMatch(/git patch-view \| copy$/m);
  });

  it("keeps patch transfer out of the dropbox profile entirely", () => {
    // The dropbox profile used to carry a second create/apply pair
    // (_patch_create_and_upload / _patch_view_copy / _patch_download_and_apply)
    // that rendered and applied patches its own way. Two generators is how the
    // clipboard corruption survived a fix in only one of them.
    const source = fs.readFileSync(DROPBOX_PROFILE, "utf-8");
    expect(source).not.toContain("git patch-view");
    expect(source).not.toContain("git apply");
    expect(source).not.toMatch(/_patch_(create_and_upload|view_copy|download_and_apply)/);
  });

  it("git_patch_apply dry-runs before touching the working tree", () => {
    const source = fs.readFileSync(GIT_HELPERS_PROFILE, "utf-8");
    expect(source).toContain('git apply --check "$patch_file"');
  });

  it("routes every apply through the one forgiving applier", () => {
    const source = fs.readFileSync(GIT_HELPERS_PROFILE, "utf-8");
    // A rejected hunk must still land the rest, otherwise a patch cut against a
    // slightly older tree is unusable on the receiving machine.
    expect(source).toContain('git apply --reject --whitespace=fix "$patch_file"');
    // Exactly one applier and one generator: every caller goes through them.
    expect(source.match(/^function _git_patch_apply_file\(\)/gm) || []).toHaveLength(1);
    expect(source.match(/^function _git_patch_write\(\)/gm) || []).toHaveLength(1);
    expect(source.match(/^\s*git patch-view /gm) || []).toHaveLength(1);
  });
});

describe("saved patch files", () => {
  const source = fs.readFileSync(GIT_HELPERS_PROFILE, "utf-8");

  it("should carve patch destinations out of mktemp, never a hand-built nested path", () => {
    // `mktemp -d` gives uniqueness for free. The bare `mktemp -d` retry is what
    // keeps this working on hosts where /tmp is not writable (Termux), since the
    // mktemp polyfill falls back to ~/tmp there.
    const mktempFolders = source.match(/patch_folder=\$\(mktemp -d "\/tmp\/patch-XXXXXX" 2> \/dev\/null \|\| mktemp -d\)/g) || [];

    // Exactly one: both git_patch_create and git_patch_apply's clipboard capture
    // go through _git_patch_temp_file.
    expect(mktempFolders.length).toBe(1);

    // No hand-rolled destination folder, and no timestamped file name — the
    // random mktemp folder is the only uniqueness mechanism.
    expect(source).not.toMatch(/patch_folder="\$\{BASHRC_TEMP_ROOT_DIR/);
    expect(source).not.toMatch(/patch_file=.*\$\(date /);

    const hardcoded = source.split("\n").filter((line) => /^\s*patch_file=.*"\/tmp\//.test(line));
    expect(hardcoded, `hardcoded /tmp patch destination:\n${hardcoded.join("\n")}`).toEqual([]);
  });

  it("should announce every patch file it creates with the >>> marker", () => {
    const created = source.match(/echo ">>> patch file created \$patch_file"/g) || [];

    // one for git_patch_create, one for git_patch_apply's clipboard capture
    expect(created.length).toBe(2);
  });

  it("should print a copy-paste-runnable action summary for the saved patch", () => {
    expect(source).toContain('print_action_summary "$patch_file" git_patch_apply');
  });

  it("should quote every path expansion so temp roots with spaces survive", () => {
    // $HOME on Windows/macOS routinely contains a space, and the mktemp fallback lands
    // under $HOME/tmp, so a bare `$patch_file` in argument position word-splits. Strip
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
    expect(source).toContain('[ -s "$patch_file" ]');
    expect(source).toContain('command rm -f "$patch_file"');
  });
});

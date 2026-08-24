/**
 * Tests for OSC 8 hyperlink support end to end.
 *
 * Two independent pieces must both hold for a CLI-emitted link to be clickable
 * inside tmux:
 *
 * 1. The producer must emit a real OSC 8 hyperlink, not just a styled plain URL.
 *    `pr_list` (software/scripts/git.pr_list.cjs, sourced by git-functions.js) wraps
 *    each PR URL in `ESC ]8;; <url> ST <text> ESC ]8;; ST` via formatLink(). A
 *    regression that dropped the OSC 8 escape would still look identical on screen
 *    (formatLink also applies blue+underline ANSI), so the eye can't catch it — only
 *    an assertion on the escape bytes can.
 *
 * 2. tmux must forward the OSC 8 sequence to the outer terminal. tmux only does this
 *    when the `hyperlinks` terminal-feature is enabled (tmux 3.4+); without the line
 *    in tmux.config, tmux strips the OSC 8 and the terminal falls back to its own
 *    plain-text URL detection, which cannot be handed through tmux's mouse capture.
 *
 * 3. The terminal must let the click reach it. With tmux `mouse on`, every click is
 *    forwarded to tmux, so Ghostty never detects or opens a link. Ghostty's
 *    `mouse-shift-capture = false` (the default) lets Shift bypass tmux and hand the
 *    event to Ghostty — Shift+hover highlights, Shift+Cmd+click opens. Setting it to
 *    true forwards Shift+click to the app and silently breaks link clicking in tmux.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TMUX_CONFIG = path.join(ROOT_DIR, "software/scripts/advanced/tmux.config");
const PR_LIST_CJS = path.join(ROOT_DIR, "software/scripts/git.pr_list.cjs");
const GHOSTTY_JS = path.join(ROOT_DIR, "software/scripts/advanced/ghostty.js");

/**
 * Read a file from the repo root.
 * @param {string} filePath Absolute path to the file.
 * @returns {string} File contents.
 */
function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

describe("tmux OSC 8 hyperlink passthrough", () => {
  it("enables the hyperlinks terminal-feature so tmux forwards OSC 8 to the terminal", () => {
    const config = read(TMUX_CONFIG);
    // Matches: set -as terminal-features ",*:hyperlinks"  (quoting/spacing tolerant).
    expect(config).toMatch(/set\s+-as\s+terminal-features\s+["']?,\*:hyperlinks["']?/);
  });

  it("keeps the hyperlinks feature append-style (-as) so it does not clobber extkeys", () => {
    const config = read(TMUX_CONFIG);
    // A bare `set -g terminal-features` would replace the list and drop extkeys; the
    // feature must be appended with `-as`.
    const hyperlinkLines = config
      .split("\n")
      .filter((line) => line.includes(":hyperlinks"));
    expect(hyperlinkLines.length).toBeGreaterThan(0);
    for (const line of hyperlinkLines) {
      expect(line).toMatch(/set\s+-as\s+terminal-features/);
    }
  });
});

describe("pr_list emits real OSC 8 hyperlinks", () => {
  it("wraps URLs in an OSC 8 open/close pair in formatLink", () => {
    const source = read(PR_LIST_CJS);
    // The OSC 8 open (ESC ]8;; <url> ST) and close (ESC ]8;; ST) must both be present
    // in the color branch of formatLink. \x1b]8;; is the OSC 8 introducer.
    expect(source).toMatch(/\\x1b\]8;;\$\{url\}\\x1b\\\\/); // open with the URL
    expect(source).toMatch(/\\x1b\]8;;\\x1b\\\\`/); // close with empty URI
  });

  it("returns the bare URL when color is disabled so piped output stays greppable", () => {
    const source = read(PR_LIST_CJS);
    // formatLink must short-circuit to the plain URL for non-TTY / --links output.
    expect(source).toMatch(/if\s*\(!color\)\s*return\s+url;/);
  });
});

describe("Ghostty lets Shift bypass tmux so links stay clickable", () => {
  it("keeps mouse-shift-capture = false so Shift+Cmd+click can open links in tmux", () => {
    const source = read(GHOSTTY_JS);
    // true would forward Shift+click to tmux and silently break link opening; the
    // config must emit false (the Ghostty default).
    expect(source).toMatch(/mouse-shift-capture\s*=\s*false/);
    expect(source).not.toMatch(/mouse-shift-capture\s*=\s*true/);
  });
});

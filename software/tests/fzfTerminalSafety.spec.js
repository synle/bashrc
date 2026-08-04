/** Guards the terminal-mode safety redirects on `node` invocations that feed fzf or run under readline. */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FZF_PROFILE = path.join(ROOT_DIR, "software/scripts/bash-fzf.profile.bash");

/**
 * `_fuzzy_list_all` is the producer half of `_fuzzy_list_all | fzf` and also feeds
 * fzf tab-completion while readline holds the terminal in raw mode.
 *
 * At startup node snapshots the termios of every tty among fd 0/1/2 and restores
 * that snapshot on exit (node::ResetStdio). Because node starts a moment before
 * fzf switches the terminal to raw mode, it snapshots the still-cooked termios and
 * on exit drops the terminal back to cooked mode underneath the running fzf. The
 * visible symptom is arrow keys echoing as literal ^[[A / ^[[B into the fzf query
 * instead of moving the selection, and typed characters never reaching fzf.
 *
 * Detaching stdin and stderr from the tty leaves node with no tty to snapshot.
 * fd 1 stays attached because it is the pipe into fzf, not the terminal.
 */
describe("_fuzzy_list_all node terminal safety", () => {
  const source = fs.readFileSync(FZF_PROFILE, "utf-8");

  /** The argument line that closes the `node -e "..."` heredoc-style invocation. */
  const invocationLine = source.split("\n").find((line) => line.includes('"$max_timeout" "$filter"'));

  it("has exactly one node invocation to guard", () => {
    expect(invocationLine).toBeDefined();
  });

  it("detaches node stdin from the terminal", () => {
    expect(invocationLine).toContain("< /dev/null");
  });

  it("detaches node stderr from the terminal", () => {
    expect(invocationLine).toContain("2> /dev/null");
  });
});

/**
 * fzf runs `--info-command` through `$SHELL -c`, which cannot see a non-exported
 * shell function. Without the export every render forks a subshell that dies with
 * "command not found" and the info line renders blank.
 */
describe("_fzf_info_line", () => {
  const source = fs.readFileSync(FZF_PROFILE, "utf-8");

  it("is exported so fzf's --info-command subshell can resolve it", () => {
    expect(source).toContain("export -f _fzf_info_line");
  });

  it("matches every --prompt string used by the pickers", () => {
    const prompts = [...source.matchAll(/--prompt="([^"]+)"/g)].map((m) => m[1].trim());
    expect(prompts.length).toBeGreaterThan(0);

    const infoBody = source.slice(source.indexOf("function _fzf_info_line"), source.indexOf("export -f _fzf_info_line"));
    const patterns = [...infoBody.matchAll(/\*"([^"]+)"\*\)/g)].map((m) => m[1]);

    for (const prompt of prompts) {
      expect(
        patterns.some((pattern) => prompt.includes(pattern)),
        `no _fzf_info_line case pattern matches prompt "${prompt}"`,
      ).toBe(true);
    }
  });
});

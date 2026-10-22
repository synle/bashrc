/** Exercises the shared Vim save hook through real writes and mapped save keys. */
import { describe, expect, it, onTestFinished } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

/** Absolute settings source; omit plugin bootstrap so tests need no network. */
const SETTINGS = path.resolve("software/scripts/vim-config-settings.vim");

/** Save routes requested by the user; :normal executes mappings, not normal! mode. */
const SAVE_ROUTES = [
  [":w", 'execute "normal! :w\\<CR>"'],
  [",s", "normal ,s"],
  ["\\s", "normal \\s"],
];

/** Exact expected bytes, including characterization of existing EOF normalization. */
const CASES = [
  ["leading empty lines", "\n\n\nabc\ndef\n\n\n", "abc\ndef\n\n"],
  ["leading spaces and tabs", " \t\n\t\n  \nzzz\nxxx\n\n", "zzz\nxxx\n\n"],
  ["content indentation and interior blanks", " \n\t  abc  \n \t\n  def\t\n\n\n", "\t  abc\n\n  def\n\n"],
  ["no leading blanks", "abc\ndef\n\n\n", "abc\ndef\n\n"],
  ["missing final newline", "abc", "abc\n\n"],
  ["one leading blank and one content line", "\nabc\n", "abc\n\n"],
  ["empty file", "", ""],
  ["one blank line", "\n", "\n"],
  ["blank-only file", " \n\t\n\n", "\n\n"],
];

/**
 * Quotes a trusted local filename for Vim's single-quoted expression syntax.
 * @param {string} value - Local filename to quote.
 * @returns {string} A single-quoted Vim expression with escaped apostrophes.
 */
function vimString(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

describe.each(SAVE_ROUTES)("Vim save cleanup through %s", (_label, saveCommand) => {
  it.each(CASES)("normalizes %s and stays idempotent", (_name, input, expected) => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "vim-save-whitespace-"));
    onTestFinished(() => fs.rmSync(folder, { recursive: true, force: true }));
    const file = path.join(folder, "input.txt");
    const snapshot = path.join(folder, "first-save.txt");
    const state = path.join(folder, "state.json");
    const script = path.join(folder, "save.vim");
    fs.writeFileSync(file, input);
    fs.writeFileSync(
      script,
      [
        `execute 'source ' . fnameescape(${vimString(SETTINGS)})`,
        `execute 'edit ' . fnameescape(${vimString(file)})`,
        "call cursor(max([1, nextnonblank(1)]), 2)",
        "let @/ = 'keep-search'",
        "let @\" = 'keep-register'",
        saveCommand,
        `call writefile(readfile(${vimString(file)}, 'b'), ${vimString(snapshot)}, 'b')`,
        saveCommand,
        `call writefile([json_encode({'cursor': getpos('.')[1:2], 'search': @/, 'register': @\"})], ${vimString(state)})`,
        "qall!",
      ].join("\n"),
    );
    const result = spawnSync("vim", ["-N", "-u", "NONE", "-i", "NONE", "-n", "-es", "-S", script], {
      env: { ...process.env, HOME: folder },
      encoding: "utf-8",
      timeout: 5000,
    });
    expect(result.error, result.stderr).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(snapshot, "utf-8")).toBe(expected);
    expect(fs.readFileSync(file, "utf-8")).toBe(expected);
    expect(JSON.parse(fs.readFileSync(state, "utf-8"))).toEqual({
      cursor: [1, expected.trim() ? 2 : 1],
      search: "keep-search",
      register: "keep-register",
    });
  });
});

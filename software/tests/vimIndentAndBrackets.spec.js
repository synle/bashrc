/** Integration tests for indentation, word deletion, and bracket navigation in the actual Vim settings. */
import { describe, expect, it, onTestFinished } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

/** Settings source without the plugin manager's network bootstrap. */
const SETTINGS = path.resolve("software/scripts/vim-config-settings.vim");

/**
 * Runs editing commands in isolated headless Vim and returns buffer state.
 * @param {string} input - Initial file contents.
 * @param {string[]} commands - Vimscript commands exercising real mappings.
 * @param {string} filename - Fixture basename, used for filetype detection.
 * @returns {object} Buffer text, cursor, indentation options, and captured observations.
 */
function editInVim(input, commands, filename = "input.txt") {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "vim-indent-brackets-"));
  onTestFinished(() => fs.rmSync(folder, { recursive: true, force: true }));
  const file = path.join(folder, filename);
  const output = path.join(folder, "result.json");
  const script = path.join(folder, "edit.vim");
  fs.writeFileSync(file, input);
  fs.writeFileSync(
    script,
    [
      `execute 'source ' . fnameescape(${JSON.stringify(SETTINGS)})`,
      `execute 'edit ' . fnameescape(${JSON.stringify(file)})`,
      "let g:observations = {}",
      ...commands,
      "let g:result = {'lines': getline(1, '$'), 'cursor': getpos('.')[1:2], 'indent': [&expandtab, &softtabstop, &shiftwidth, &tabstop], 'observations': g:observations}",
      `call writefile([json_encode(g:result)], ${JSON.stringify(output)})`,
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
  return JSON.parse(fs.readFileSync(output, "utf-8"));
}

describe("Vim indentation integration", () => {
  it.each([
    ["four-space file", "    alpha\n        beta\n", [1, 2, 2, 2]],
    ["two-space file", "  alpha\n    beta\n", [1, 2, 2, 2]],
    ["hard-tab file", "\talpha\n\t\tbeta\n", [0, 0, 2, 2]],
    ["blank-only tabs do not imply hard-tab content", "\t\n  alpha\n", [1, 2, 2, 2]],
    ["empty file", "", [1, 2, 2, 2]],
  ])("detects %s without rewriting existing indentation", (_name, input, expected) => {
    const result = editInVim(input, []);
    expect(result.indent).toEqual(expected);
    expect(result.lines).toEqual(input ? input.trimEnd().split("\n") : [""]);
  });

  it("overrides a filetype's four-space soft indentation with two spaces", () => {
    const result = editInVim("    alpha\n", ["setlocal expandtab softtabstop=4 shiftwidth=4 tabstop=4", "doautocmd FileType"]);
    expect(result.indent).toEqual([1, 2, 2, 2]);
  });

  it.each([
    ["input.py", "    alpha\n", [1, 2, 2, 2]],
    ["Makefile", "target:\n\tcommand\n", [0, 0, 2, 2]],
  ])("applies the policy after the real %s filetype plugin", (filename, input, indent) => {
    expect(editInVim(input, [], filename).indent).toEqual(indent);
  });

  it("chooses soft indentation for space-led content despite a hard-tab filetype default", () => {
    const result = editInVim("    alpha\n", ["setlocal noexpandtab tabstop=8 shiftwidth=8", "doautocmd FileType"]);
    expect(result.indent).toEqual([1, 2, 2, 2]);
  });

  it("normalizes inherited soft indentation when opening a new file", () => {
    const result = editInVim("", [
      "setglobal expandtab softtabstop=4 shiftwidth=4 tabstop=4",
      "execute 'edit ' . fnameescape(expand('%:p:h') . '/new-soft.txt')",
    ]);
    expect(result.indent).toEqual([1, 2, 2, 2]);
  });

  it.each([
    ["spaces", "    alpha\n", "  X"],
    ["hard tabs", "\talpha\n", "\tX"],
  ])("inserts %s with the actual insert-mode Tab key", (_name, input, expected) => {
    const result = editInVim(input, ["call setline(1, '')", 'call feedkeys("gg0i\\<Tab>X\\<Esc>", "xt")']);
    expect(result.lines).toEqual([expected]);
  });

  it("keeps a filetype's hard-tab width on an empty buffer", () => {
    const result = editInVim("", ["setlocal noexpandtab softtabstop=0 shiftwidth=4 tabstop=8", "doautocmd FileType"]);
    expect(result.indent).toEqual([0, 0, 8, 8]);
  });

  it.each([
    [
      "spaces",
      "    alpha\n        beta\n",
      [],
      ["      alpha", "          beta"],
      ["        alpha", "            beta"],
      ["    alpha", "        beta"],
    ],
    ["tabs", "\talpha\n\t\tbeta\n", [], ["\t\talpha", "\t\t\tbeta"], ["\t\t\talpha", "\t\t\t\tbeta"], ["\talpha", "\t\tbeta"]],
    [
      "eight-column tabs",
      "\talpha\n\t\tbeta\n",
      ["setlocal tabstop=8", "doautocmd FileType"],
      ["\t\talpha", "\t\t\tbeta"],
      ["\t\t\talpha", "\t\t\t\tbeta"],
      ["\talpha", "\t\tbeta"],
    ],
  ])("visual Tab/Shift+Tab follow %s and keep selection for repeated shifts", (_name, input, setup, once, twice, original) => {
    const result = editInVim(input, [
      ...setup,
      'execute "normal ggVj\\<Tab>"',
      "let g:observations.once = getline(1, '$')",
      'call feedkeys("\\<Tab>", "xt")',
      "let g:observations.twice = getline(1, '$')",
      'call feedkeys("\\<S-Tab>\\<S-Tab>", "xt")',
    ]);
    expect(result.observations.once).toEqual(once);
    expect(result.observations.twice).toEqual(twice);
    expect(result.lines).toEqual(original);
  });

  it("detects buffers independently without moving the cursor or changing search", () => {
    const result = editInVim("\talpha\n\t\tbeta\n", [
      "call cursor(2, 3)",
      "let @/ = 'keep-search'",
      "doautocmd FileType",
      "let g:observations.search = @/",
      "let g:observations.cursor = getpos('.')[1:2]",
      "let g:observations.hard = [&expandtab, &shiftwidth]",
      "new",
      "call setline(1, '    spaces')",
      "doautocmd BufReadPost",
    ]);
    expect(result.observations).toEqual({ search: "keep-search", cursor: [2, 3], hard: [0, 2] });
    expect(result.indent).toEqual([1, 2, 2, 2]);
    expect(result.lines).toEqual(["    spaces"]);
  });
});

describe("Vim Ctrl+Delete forward-word deletion integration", () => {
  it.each([
    ["word start", "alpha beta", "gg0i", "Xbeta"],
    ["inside a word", "alpha beta", "gg02li", "alXbeta"],
    ["before punctuation", "alpha.beta", "gg0i", "X.beta"],
    ["at whitespace", "alpha   beta", "gg05li", "alphaXbeta"],
    ["end of file", "alpha", "ggA", "alphaX"],
    ["empty buffer", "", "gg0i", "X"],
  ])("deletes forward from %s and resumes insertion without deleting backward", (_name, input, position, expected) => {
    const result = editInVim(input, [`call feedkeys("${position}\\<C-Del>X\\<Esc>", "xt")`]);
    expect(result.lines).toEqual([expected]);
  });

  it("joins the next line at a line boundary without deleting preceding text", () => {
    const result = editInVim("alpha\nbeta", ['call feedkeys("ggA\\<C-Del>X\\<Esc>", "xt")']);
    expect(result.lines).toEqual(["alphaXbeta"]);
  });

  it("supports repeated forward deletions in the same insert session", () => {
    const result = editInVim("alpha beta gamma", ['call feedkeys("gg0i\\<C-Del>\\<C-Del>X\\<Esc>", "xt")']);
    expect(result.lines).toEqual(["Xgamma"]);
  });

  it("keeps Ctrl+Backspace deleting the previous word", () => {
    const result = editInVim("alpha beta", ['call feedkeys("ggA\\<C-BS>X\\<Esc>", "xt")']);
    expect(result.lines).toEqual(["alpha X"]);
  });
});

describe("Vim Ctrl+Delete forward-word deletion integration", () => {
  it.each([
    ["word start", "alpha beta", "gg0i", "Xbeta"],
    ["inside a word", "alpha beta", "gg02li", "alXbeta"],
    ["before punctuation", "alpha.beta", "gg0i", "X.beta"],
    ["at whitespace", "alpha   beta", "gg05li", "alphaXbeta"],
    ["end of file", "alpha", "ggA", "alphaX"],
    ["empty buffer", "", "gg0i", "X"],
  ])("deletes forward from %s and resumes insertion without deleting backward", (_name, input, position, expected) => {
    const result = editInVim(input, [`call feedkeys("${position}\\<C-Del>X\\<Esc>", "xt")`]);
    expect(result.lines).toEqual([expected]);
  });

  it("joins the next line at a line boundary without deleting preceding text", () => {
    const result = editInVim("alpha\nbeta", ['call feedkeys("ggA\\<C-Del>X\\<Esc>", "xt")']);
    expect(result.lines).toEqual(["alphaXbeta"]);
  });

  it("supports repeated forward deletions in the same insert session", () => {
    const result = editInVim("alpha beta gamma", ['call feedkeys("gg0i\\<C-Del>\\<C-Del>X\\<Esc>", "xt")']);
    expect(result.lines).toEqual(["Xgamma"]);
  });

  it("keeps Ctrl+Backspace deleting the previous word", () => {
    const result = editInVim("alpha beta", ['call feedkeys("ggA\\<C-BS>X\\<Esc>", "xt")']);
    expect(result.lines).toEqual(["alpha X"]);
  });
});

describe("Vim Ctrl+M bracket navigation integration", () => {
  it.each([
    ["opening parenthesis", "(abc)", 1, 5],
    ["closing parenthesis", "(abc)", 5, 1],
    ["nested square bracket", "([x])", 2, 4],
    ["brace", "{x}", 1, 3],
    ["unmatched text", "word", 1, 1],
  ])("jumps from %s in normal mode without changing text", (_name, input, start, end) => {
    const result = editInVim(input, [`call cursor(1, ${start})`, 'execute "normal \\<C-m>"']);
    expect(result.cursor).toEqual([1, end]);
    expect(result.lines).toEqual([input]);
  });

  it("extends visual selection to the matching bracket", () => {
    const result = editInVim("(abc)", [
      'call feedkeys("gg0v\\<C-m>", "xt")',
      "let g:observations.anchor = getpos('v')[1:2]",
      "let g:observations.endpoint = getpos('.')[1:2]",
      'call feedkeys("d", "xt")',
    ]);
    expect(result.observations).toEqual({ anchor: [1, 1], endpoint: [1, 5] });
    expect(result.lines).toEqual([""]);
  });

  it("jumps in insert mode and resumes inserting at the matching bracket", () => {
    const result = editInVim("(abc)", ['call feedkeys("gg0i\\<C-m>X\\<Esc>", "xt")']);
    expect(result.lines).toEqual(["(abcX)"]);
  });

  it("treats editing-mode Enter as the same key but leaves command-line Enter usable", () => {
    const result = editInVim("(abc)", [
      'execute "normal gg0\\<CR>"',
      "let g:observations.jump = col('.')",
      'execute "normal :let g:observations.command = 1\\<CR>"',
    ]);
    expect(result.observations).toEqual({ jump: 5, command: 1 });
    expect(result.lines).toEqual(["(abc)"]);
  });
});

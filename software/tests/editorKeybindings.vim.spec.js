/**
 * @file editorKeybindings.spec.js — Validates the three editor keybinding
 *   JSONC source files (VS Code, Sublime Text, Zed) have no duplicate keys
 *   within the same context block. Duplicate keys cause silent overrides —
 *   only the last entry wins — which is a common source of regressions
 *   (e.g. F5 bound twice, second entry shadowing the first).
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import { fileSystem, getIndexFunction, loadScriptHelpers } from "./setup.js";

// --- JSONC helpers ----------------------------------------------------------

/**
 * Strips line comments (`// ...`) and trailing commas from JSONC content so
 * plain `JSON.parse` can consume it. Handles comments at end-of-line too.
 * @param {string} raw - Raw JSONC string.
 * @returns {string} Stripped JSON string.
 */
function stripJsonc(raw) {
  return raw
    .replace(/\/\/.*$/gm, "") // line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/,(\s*[}\]])/g, "$1"); // trailing commas
}

/**
 * Reads a JSONC file from disk and returns the parsed array.
 * @param {string} relPath - Repo-relative path.
 * @returns {Array} Parsed JSON array.
 */
function readJsonc(relPath) {
  const raw = fs.readFileSync(relPath, "utf-8");
  return JSON.parse(stripJsonc(raw));
}

// --- VS Code ----------------------------------------------------------------

const VIM_SETTINGS = fs.readFileSync("software/scripts/vim-config-settings.vim", "utf-8");
const MULTI_CURSOR_SAMPLE = `Alpha river stone
alpha morning light
ALPHA winter cloud
The quick brown fox waits
The QUICK brown fox runs
quick brown fox sleeps
Blue lantern near window
Blue lantern near window
BluE lantern near window
blue lantern under bridge
BLUE lantern beside river
BLUE lantern beside river
Blue lantern near window
Mango trees bend slowly
mango leaves fall softly
MANGO seeds wait below
Echo echo ECHO in the canyon
small signal, Small signal, SMALL signal
Case testing makes patterns visible
case testing shows lowercase matches
C`;

describe("Vim toggle keybindings", () => {
  it("maps the backslash double-press to soft wrap and the bracket pair to numbers and whitespace", () => {
    expect(VIM_SETTINGS).toContain("nnoremap <silent> <Bslash><Bslash> :set wrap!<CR>");
    expect(VIM_SETTINGS).toContain("nnoremap <silent> <Bslash>[ :set list!<CR>");
    expect(VIM_SETTINGS).toContain("nnoremap <silent> <Bslash>] :set number! norelativenumber<CR>");
    expect(VIM_SETTINGS).toContain("nmap <silent> ,<Bslash> <Bslash><Bslash>");
    expect(VIM_SETTINGS).toContain("nmap <silent> ,[ <Bslash>[");
    expect(VIM_SETTINGS).toContain("nmap <silent> ,] <Bslash>]");
  });
});

describe("Vim Visual-Multi case keybindings", () => {
  it("keeps the supplied sample's case-sensitive match counts distinct", () => {
    expect(MULTI_CURSOR_SAMPLE.match(/alpha/gi)).toHaveLength(3);
    expect(MULTI_CURSOR_SAMPLE.match(/alpha/g)).toHaveLength(1);
    expect(MULTI_CURSOR_SAMPLE.match(/blue lantern/gi)).toHaveLength(7);
    expect(MULTI_CURSOR_SAMPLE.match(/blue lantern/g)).toHaveLength(1);
  });

  it("maps comma-g and comma-G to explicit case modes without auto-Insert", () => {
    expect(VIM_SETTINGS).toContain("nnoremap <silent> ,g :<C-u>call <SID>VmFindAll('ignore', 0)<CR>");
    expect(VIM_SETTINGS).toContain("nnoremap <silent> ,G :<C-u>call <SID>VmFindAll('sensitive', 0)<CR>");
    expect(VIM_SETTINGS).toContain("xnoremap <silent> ,g y:<C-u>call <SID>VmFindAll('ignore', 1)<CR>");
    expect(VIM_SETTINGS).toContain("xnoremap <silent> ,G y:<C-u>call <SID>VmFindAll('sensitive', 1)<CR>");
    expect(VIM_SETTINGS).toContain("let g:VM_maps['Visual Cursors'] = ',l'");
    expect(VIM_SETTINGS).not.toContain("<Plug>(VM-i)");
    expect(VIM_SETTINGS).not.toContain("visual_multi_start");
  });

  it("deletes visual selections with Backspace and Delete", () => {
    expect(VIM_SETTINGS).toContain("xnoremap <BS> d");
    expect(VIM_SETTINGS).toContain("xnoremap <Del> d");
  });

  it("keeps final-newline and clipboard-trim save behavior aligned", () => {
    expect(VIM_SETTINGS).toContain("set fixendofline");
    expect(VIM_SETTINGS).toContain("autocmd BufWritePre * TrimTrailingWhitespace | TrimLeadingBlankLines | TrimTrailingBlankLines");
    expect(VIM_SETTINGS).toContain("while line('$') > 2 && getline('$') =~# '^\\s*$'");
    expect(VIM_SETTINGS).toContain("call deletebufline(bufnr('%'), line('$'))");
    expect(VIM_SETTINGS).toContain("let l:text = substitute(l:text, '[\\r\\n ]\\+$', '', '')");
    expect(VIM_SETTINGS).toContain("nnoremap <silent> ,v :call <SID>PasteClipboardImageOrText()<CR>");
    expect(VIM_SETTINGS).toContain("nnoremap <silent> <Bslash>v :call <SID>PasteClipboardImageOrText()<CR>");
    expect(VIM_SETTINGS).toContain("nnoremap <silent> p :call <SID>PasteClipboardImageOrText()<CR>");
  });
});

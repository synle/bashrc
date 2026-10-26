import { describe, expect, it } from "vitest";

import { readBuildText, warnIfBuildArtifactMissing } from "./buildConfigShape.helpers.js";

describe(".build/vim-theme-dark", () => {
  it("keeps the generated dark colorscheme", () => {
    const filename = "vim-theme-dark";
    if (warnIfBuildArtifactMissing(filename)) return;

    expect(readBuildText(filename)).toMatchInlineSnapshot(`
      "" Generated from theme/sy/vim_dark.jsonc. Do not edit.
      highlight clear
      if exists('syntax_on') | syntax reset | endif
      let g:colors_name = 'sy-dark'
      highlight Normal guifg=#e8e8e8 guibg=#0a0a0a gui=NONE cterm=NONE
      highlight NormalNC guifg=#8f8f8f guibg=#0a0a0a gui=NONE cterm=NONE
      highlight Comment guifg=#76a762 guibg=NONE gui=NONE cterm=NONE
      highlight String guifg=#ce9178 guibg=NONE gui=NONE cterm=NONE
      highlight Number guifg=#b5cea8 guibg=NONE gui=NONE cterm=NONE
      highlight Constant guifg=#4fc1ff guibg=NONE gui=NONE cterm=NONE
      highlight Identifier guifg=#9cdcfe guibg=NONE gui=NONE cterm=NONE
      highlight Function guifg=#dcdcaa guibg=NONE gui=NONE cterm=NONE
      highlight Statement guifg=#5ca0d7 guibg=NONE gui=NONE cterm=NONE
      highlight Keyword guifg=#5ca0d7 guibg=NONE gui=NONE cterm=NONE
      highlight PreProc guifg=#c586c0 guibg=NONE gui=NONE cterm=NONE
      highlight Type guifg=#4ec9b0 guibg=NONE gui=NONE cterm=NONE
      highlight Special guifg=#d7ba7d guibg=NONE gui=NONE cterm=NONE
      highlight Tag guifg=#5ca0d7 guibg=NONE gui=NONE cterm=NONE
      highlight Delimiter guifg=#e8e8e8 guibg=NONE gui=NONE cterm=NONE
      highlight Operator guifg=#e8e8e8 guibg=NONE gui=NONE cterm=NONE
      highlight LineNr guifg=#8f8f8f guibg=#0a0a0a gui=NONE cterm=NONE
      highlight CursorLineNr guifg=#5ca0d7 guibg=#1f2a38 gui=NONE cterm=NONE
      highlight CursorLine guifg=NONE guibg=#1f2a38 gui=NONE cterm=NONE
      highlight ColorColumn guifg=NONE guibg=#161616 gui=NONE cterm=NONE
      highlight SignColumn guifg=#e8e8e8 guibg=#0a0a0a gui=NONE cterm=NONE
      highlight VertSplit guifg=#6e6e6e guibg=#0a0a0a gui=NONE cterm=NONE
      highlight Visual guifg=#e8e8e8 guibg=#1b3c5e gui=NONE cterm=NONE
      highlight Search guifg=#e8e8e8 guibg=#5c4300 gui=NONE cterm=NONE
      highlight IncSearch guifg=#e8e8e8 guibg=#5c4300 gui=NONE cterm=NONE
      highlight MatchParen guifg=#e8e8e8 guibg=#1b3c5e gui=underline cterm=underline
      highlight Pmenu guifg=#e8e8e8 guibg=#161616 gui=NONE cterm=NONE
      highlight PmenuSel guifg=#e8e8e8 guibg=#1b3c5e gui=NONE cterm=NONE
      highlight Folded guifg=#8f8f8f guibg=#161616 gui=NONE cterm=NONE
      highlight NonText guifg=#6e6e6e guibg=NONE gui=NONE cterm=NONE
      highlight SpecialKey guifg=#6e6e6e guibg=NONE gui=NONE cterm=NONE
      highlight StatusLine guifg=#e8e8e8 guibg=#161616 gui=NONE cterm=NONE
      highlight StatusLineNC guifg=#8f8f8f guibg=#161616 gui=NONE cterm=NONE
      highlight TabLine guifg=#e8e8e8 guibg=#161616 gui=NONE cterm=NONE
      highlight TabLineSel guifg=#e8e8e8 guibg=#1b3c5e gui=NONE cterm=NONE
      highlight TabLineFill guifg=#8f8f8f guibg=#161616 gui=NONE cterm=NONE
      highlight ErrorMsg guifg=#f67070 guibg=#0a0a0a gui=NONE cterm=NONE
      highlight WarningMsg guifg=#dcdcaa guibg=#0a0a0a gui=NONE cterm=NONE
      highlight DiffAdd guifg=#76a762 guibg=#161616 gui=NONE cterm=NONE
      highlight DiffDelete guifg=#f67070 guibg=#161616 gui=NONE cterm=NONE
      highlight DiffChange guifg=#5ca0d7 guibg=#161616 gui=NONE cterm=NONE
      highlight DiffText guifg=#e8e8e8 guibg=#1b3c5e gui=NONE cterm=NONE
      highlight CursorColumn guifg=NONE guibg=#1f2a38 gui=NONE cterm=NONE
      highlight Directory guifg=#5ca0d7 guibg=NONE gui=NONE cterm=NONE
      highlight FoldColumn guifg=#b2b2b2 guibg=#0a0a0a gui=NONE cterm=NONE
      highlight ModeMsg guifg=#76a762 guibg=NONE gui=NONE cterm=NONE
      highlight MoreMsg guifg=#76a762 guibg=NONE gui=NONE cterm=NONE
      highlight Question guifg=#5ca0d7 guibg=NONE gui=NONE cterm=NONE
      highlight WildMenu guifg=#e8e8e8 guibg=#1b3c5e gui=NONE cterm=NONE
      highlight Title guifg=#5ca0d7 guibg=NONE gui=NONE cterm=NONE
      highlight Structure guifg=#4ec9b0 guibg=NONE gui=NONE cterm=NONE
      highlight Underlined guifg=#4fc1ff guibg=NONE gui=underline cterm=underline
      highlight Ignore guifg=#8f8f8f guibg=NONE gui=NONE cterm=NONE
      highlight Error guifg=#f67070 guibg=#221414 gui=NONE cterm=NONE
      highlight Todo guifg=#dcdcaa guibg=#1f1f1a gui=NONE cterm=NONE
      highlight qfLineNr guifg=#5ca0d7 guibg=NONE gui=NONE cterm=NONE
      highlight Conceal guifg=#464646 guibg=NONE gui=NONE cterm=NONE
      highlight PmenuSbar guifg=NONE guibg=#161616 gui=NONE cterm=NONE
      highlight PmenuThumb guifg=NONE guibg=#6e6e6e gui=NONE cterm=NONE
      highlight SpellBad guifg=NONE guibg=NONE guisp=#f67070 gui=undercurl cterm=underline
      highlight SpellCap guifg=NONE guibg=NONE guisp=#dcdcaa gui=undercurl cterm=underline
      highlight SpellLocal guifg=NONE guibg=NONE guisp=#4ec9b0 gui=undercurl cterm=underline
      highlight SpellRare guifg=NONE guibg=NONE guisp=#c586c0 gui=undercurl cterm=underline
      let g:terminal_ansi_colors = ["#6e6e6e","#f67070","#76a762","#dcdcaa","#5ca0d7","#c586c0","#4ec9b0","#cccccc","#a0a0a0","#ff6e6e","#69ff94","#ffffa5","#4fc1ff","#ff92df","#a4ffff","#ffffff"]
      let g:sy_lightline_palette = {"normal":{"left":[["#0a0a0a","#76a762"],["#e8e8e8","#161616"]],"right":[["#e8e8e8","#161616"]],"middle":[["#e8e8e8","#161616"]],"error":[["#f67070","#161616"]],"warning":[["#dcdcaa","#161616"]]},"insert":{"left":[["#0a0a0a","#5ca0d7"]]},"visual":{"left":[["#0a0a0a","#c586c0"]]},"replace":{"left":[["#0a0a0a","#f67070"]]},"inactive":{"left":[["#8f8f8f","#161616"]],"right":[["#8f8f8f","#161616"]],"middle":[["#8f8f8f","#161616"]]},"tabline":{"left":[["#e8e8e8","#161616"]],"tabsel":[["#e8e8e8","#1b3c5e"]],"middle":[["#e8e8e8","#161616"]],"right":[["#e8e8e8","#161616"]]}}"
    `);
  });
});

describe(".build/vim-theme-light", () => {
  it("keeps the generated light colorscheme", () => {
    const filename = "vim-theme-light";
    if (warnIfBuildArtifactMissing(filename)) return;

    expect(readBuildText(filename)).toMatchInlineSnapshot(`
      "" Generated from theme/sy/vim_light.jsonc. Do not edit.
      highlight clear
      if exists('syntax_on') | syntax reset | endif
      let g:colors_name = 'sy-light'
      highlight Normal guifg=#1e1e1e guibg=#f8f8f8 gui=NONE cterm=NONE
      highlight NormalNC guifg=#5a5a5a guibg=#f8f8f8 gui=NONE cterm=NONE
      highlight Comment guifg=#004a15 guibg=NONE gui=NONE cterm=NONE
      highlight String guifg=#a12626 guibg=NONE gui=NONE cterm=NONE
      highlight Number guifg=#03623a guibg=NONE gui=NONE cterm=NONE
      highlight Constant guifg=#00416f guibg=NONE gui=NONE cterm=NONE
      highlight Identifier guifg=#001080 guibg=NONE gui=NONE cterm=NONE
      highlight Function guifg=#6a5100 guibg=NONE gui=NONE cterm=NONE
      highlight Statement guifg=#0033b3 guibg=NONE gui=NONE cterm=NONE
      highlight Keyword guifg=#0033b3 guibg=NONE gui=NONE cterm=NONE
      highlight PreProc guifg=#8700c1 guibg=NONE gui=NONE cterm=NONE
      highlight Type guifg=#145e5e guibg=NONE gui=NONE cterm=NONE
      highlight Special guifg=#734e06 guibg=NONE gui=NONE cterm=NONE
      highlight Tag guifg=#9b2c2c guibg=NONE gui=NONE cterm=NONE
      highlight Delimiter guifg=#1e1e1e guibg=NONE gui=NONE cterm=NONE
      highlight Operator guifg=#1e1e1e guibg=NONE gui=NONE cterm=NONE
      highlight LineNr guifg=#5a5a5a guibg=#f8f8f8 gui=NONE cterm=NONE
      highlight CursorLineNr guifg=#0252ad guibg=#cfe0f7 gui=NONE cterm=NONE
      highlight CursorLine guifg=NONE guibg=#cfe0f7 gui=NONE cterm=NONE
      highlight ColorColumn guifg=NONE guibg=#ececec gui=NONE cterm=NONE
      highlight SignColumn guifg=#1e1e1e guibg=#f8f8f8 gui=NONE cterm=NONE
      highlight VertSplit guifg=#262626 guibg=#f8f8f8 gui=NONE cterm=NONE
      highlight Visual guifg=#1e1e1e guibg=#96c6fa gui=NONE cterm=NONE
      highlight Search guifg=#1e1e1e guibg=#ffbe3d gui=NONE cterm=NONE
      highlight IncSearch guifg=#1e1e1e guibg=#ffbe3d gui=NONE cterm=NONE
      highlight MatchParen guifg=#1e1e1e guibg=#96c6fa gui=underline cterm=underline
      highlight Pmenu guifg=#1e1e1e guibg=#ececec gui=NONE cterm=NONE
      highlight PmenuSel guifg=#1e1e1e guibg=#96c6fa gui=NONE cterm=NONE
      highlight Folded guifg=#5a5a5a guibg=#ececec gui=NONE cterm=NONE
      highlight NonText guifg=#262626 guibg=NONE gui=NONE cterm=NONE
      highlight SpecialKey guifg=#262626 guibg=NONE gui=NONE cterm=NONE
      highlight StatusLine guifg=#1e1e1e guibg=#ececec gui=NONE cterm=NONE
      highlight StatusLineNC guifg=#5a5a5a guibg=#ececec gui=NONE cterm=NONE
      highlight TabLine guifg=#1e1e1e guibg=#ececec gui=NONE cterm=NONE
      highlight TabLineSel guifg=#1e1e1e guibg=#96c6fa gui=NONE cterm=NONE
      highlight TabLineFill guifg=#5a5a5a guibg=#ececec gui=NONE cterm=NONE
      highlight ErrorMsg guifg=#840000 guibg=#f8f8f8 gui=NONE cterm=NONE
      highlight WarningMsg guifg=#6a5100 guibg=#f8f8f8 gui=NONE cterm=NONE
      highlight DiffAdd guifg=#004a15 guibg=#ececec gui=NONE cterm=NONE
      highlight DiffDelete guifg=#840000 guibg=#ececec gui=NONE cterm=NONE
      highlight DiffChange guifg=#0252ad guibg=#ececec gui=NONE cterm=NONE
      highlight DiffText guifg=#1e1e1e guibg=#96c6fa gui=NONE cterm=NONE
      highlight CursorColumn guifg=NONE guibg=#cfe0f7 gui=NONE cterm=NONE
      highlight Directory guifg=#0033b3 guibg=NONE gui=NONE cterm=NONE
      highlight FoldColumn guifg=#3f3f3f guibg=#f8f8f8 gui=NONE cterm=NONE
      highlight ModeMsg guifg=#004a15 guibg=NONE gui=NONE cterm=NONE
      highlight MoreMsg guifg=#004a15 guibg=NONE gui=NONE cterm=NONE
      highlight Question guifg=#0033b3 guibg=NONE gui=NONE cterm=NONE
      highlight WildMenu guifg=#1e1e1e guibg=#96c6fa gui=NONE cterm=NONE
      highlight Title guifg=#0033b3 guibg=NONE gui=NONE cterm=NONE
      highlight Structure guifg=#145e5e guibg=NONE gui=NONE cterm=NONE
      highlight Underlined guifg=#0252ad guibg=NONE gui=underline cterm=underline
      highlight Ignore guifg=#5a5a5a guibg=NONE gui=NONE cterm=NONE
      highlight Error guifg=#840000 guibg=#ecdfdf gui=NONE cterm=NONE
      highlight Todo guifg=#775502 guibg=#ebe8df gui=NONE cterm=NONE
      highlight qfLineNr guifg=#0033b3 guibg=NONE gui=NONE cterm=NONE
      highlight Conceal guifg=#a4a4a4 guibg=NONE gui=NONE cterm=NONE
      highlight PmenuSbar guifg=NONE guibg=#ececec gui=NONE cterm=NONE
      highlight PmenuThumb guifg=NONE guibg=#262626 gui=NONE cterm=NONE
      highlight SpellBad guifg=NONE guibg=NONE guisp=#840000 gui=undercurl cterm=underline
      highlight SpellCap guifg=NONE guibg=NONE guisp=#775502 gui=undercurl cterm=underline
      highlight SpellLocal guifg=NONE guibg=NONE guisp=#00416f gui=undercurl cterm=underline
      highlight SpellRare guifg=NONE guibg=NONE guisp=#6c0099 gui=undercurl cterm=underline
      let g:terminal_ansi_colors = ["#000000","#840000","#004a15","#775502","#0033b3","#6c0099","#00416f","#6d6d6d","#4a4a4a","#a12626","#106145","#7f6000","#0051ae","#8700c1","#145e5e","#8b8b8b"]
      let g:sy_lightline_palette = {"normal":{"left":[["#f8f8f8","#004a15"],["#1e1e1e","#ececec"]],"right":[["#1e1e1e","#ececec"]],"middle":[["#1e1e1e","#ececec"]],"error":[["#840000","#ececec"]],"warning":[["#6a5100","#ececec"]]},"insert":{"left":[["#f8f8f8","#0252ad"]]},"visual":{"left":[["#f8f8f8","#8700c1"]]},"replace":{"left":[["#f8f8f8","#840000"]]},"inactive":{"left":[["#5a5a5a","#ececec"]],"right":[["#5a5a5a","#ececec"]],"middle":[["#5a5a5a","#ececec"]]},"tabline":{"left":[["#1e1e1e","#ececec"]],"tabsel":[["#1e1e1e","#96c6fa"]],"middle":[["#1e1e1e","#ececec"]],"right":[["#1e1e1e","#ececec"]]}}"
    `);
  });
});

describe(".build/vimrc", () => {
  it("keeps the core editing and large-file settings", () => {
    const filename = "vimrc";
    if (warnIfBuildArtifactMissing(filename)) return;

    const config = readBuildText(filename);
    const relevantSettings = config
      .split(/\r?\n/)
      .filter((line) =>
        /^set (?:redrawtime=|hlsearch|incsearch|ignorecase|smartcase|sts=|expandtab|autoindent|smartindent|number|norelativenumber)/.test(
          line,
        ),
      )
      .map((line) => line.replace(/\u2014/g, "--"));
    expect(relevantSettings).toMatchInlineSnapshot(`
      [
        "set redrawtime=8000           " Max time (ms) to wait for syntax highlighting redraw before giving up",
        "set hlsearch                  " Highlight all search matches",
        "set incsearch                 " Show matches as you type the search pattern",
        "set ignorecase                " Case-insensitive search by default",
        "set smartcase                 " Override ignorecase when search pattern has uppercase letters",
        "set sts=2 sw=2 ts=2           " Default to 2-space indentation for new soft-tab files",
        "set expandtab                 " Use spaces unless file contents or filetype require hard tabs",
        "set autoindent                " Copy indentation from the current line when starting a new line",
        "set smartindent               " Auto-indent after {, if, etc. -- smarter than autoindent alone",
        "set number                    " Show line numbers by default",
        "set norelativenumber          " Keep absolute numbers (no relative numbers)",
      ]
    `);
  });
});

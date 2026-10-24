"""""""""""""""""""""""""""""""""""""""""""""""""
" Filetype Associations
"""""""""""""""""""""""""""""""""""""""""""""""""
au BufNewFile,BufRead *.cmp set filetype=xml                        " Salesforce Lightning components as XML
au BufNewFile,BufRead *.app set filetype=xml                        " Salesforce app files as XML
au BufNewFile,BufRead *.scss set filetype=scss.css                  " SCSS files get both SCSS and CSS highlighting
au BufNewFile,BufRead *.ts,*.js,*.tsx,*.jsx set filetype=typescript.tsx " Treat all JS/TS variants as TSX for unified highlighting

"""""""""""""""""""""""""""""""""""""""""""""""""
" TSX / React Syntax Colors
"""""""""""""""""""""""""""""""""""""""""""""""""
" Link syntax roles to the selected palette after every colorscheme change; no independent hex colors.
" No arguments or return value. Updates TSX/React highlight links only.
function! s:ApplyCustomHighlights() abort
  highlight! link tsxTagName Tag
  highlight! link tsxCloseString Delimiter
  highlight! link tsxCloseTag Delimiter
  highlight! link tsxCloseTagName Tag
  highlight! link tsxAttributeBraces Delimiter
  highlight! link tsxEqual Operator
  highlight! link tsxAttrib Identifier
  highlight! link tsxTypeBraces Delimiter
  highlight! link tsxTypes Type
  highlight! link ReactState Identifier
  highlight! link ReactProps Identifier
  highlight! link ApolloGraphQL Statement
  highlight! link Events Function
  highlight! link ReduxKeywords Keyword
  highlight! link ReduxHooksKeywords Function
  highlight! link WebBrowser Type
  highlight! link ReactLifeCycleMethods Function
endfunction
augroup SyCustomHighlights
  autocmd!
  autocmd ColorScheme * call s:ApplyCustomHighlights()
augroup END
call s:ApplyCustomHighlights()

"""""""""""""""""""""""""""""""""""""""""""""""""
" Plugin Settings
"""""""""""""""""""""""""""""""""""""""""""""""""
filetype plugin indent on                                           " Re-enable filetype detection + ftplugins + indent rules after plugin manager init
" Lightline follows the selected editor palette; open buffers remain tabs via lightline-bufferline.
" Modified buffers use the selected theme's ErrorMsg foreground and an asterisk.
let g:lightline = {
  \ 'colorscheme': 'default',
  \ 'active': {
  \   'left': [ [ 'mode', 'paste' ], [ 'readonly', 'filename' ] ],
  \   'right': [ [ 'lineinfo' ], [ 'filetype' ] ],
  \ },
  \ 'component': {
  \   'filename': '%{%&modified ? "%#ErrorMsg#%t *%*" : "%t"%}',
  \ },
  \ 'component_function': { 'filetype': 'SyLightlineFiletype' },
  \ 'component_type': { 'filetype': 'warning', 'buffers': 'tabsel' },
  \ 'tabline': { 'left': [ [ 'buffers' ] ], 'right': [ [] ] },
  \ 'component_expand': { 'buffers': 'lightline#bufferline#buffers' },
  \ }

" Show filetype only when Vim detected one; empty filetypes stay hidden.
function! SyLightlineFiletype() abort
  return &filetype ==# '' ? '' : &filetype
endfunction

" Refresh Lightline from Sy's generated palette or Ayu's supplied dark/light palette.
" No arguments or return value. Reinitializes status highlights without changing their layout.
function! SyLightlineSetModeColors() abort
  if !exists('*lightline#init')
    return
  endif
  if get(g:, 'colors_name', '') =~# '^sy-'
    let g:lightline.colorscheme = 'sy'
    let g:lightline#colorscheme#sy#palette = lightline#colorscheme#fill(g:sy_lightline_palette)
  elseif get(g:, 'colors_name', '') ==# 'ayu'
    let g:lightline.colorscheme = 'ayu'
    runtime autoload/lightline/colorscheme/ayu.vim
  else
    let g:lightline.colorscheme = 'default'
  endif
  call lightline#init()
  call lightline#colorscheme()
  call lightline#update()
endfunction

augroup SyLightlineModeColors
  autocmd!
  autocmd VimEnter,ColorScheme * call SyLightlineSetModeColors()
augroup END
set showtabline=2                                                   " Always show the buffer tabline
let g:xml_syntax_folding = 1                                        " Enable syntax-based folding for XML files
let g:signify_sign_change = '~'                                     " gitgutter-style change marker (signify default is !)
set updatetime=300                                                  " Faster CursorHold — signify refreshes gutter markers sooner (default 4000ms)

"""""""""""""""""""""""""""""""""""""""""""""""""
" General Settings
"""""""""""""""""""""""""""""""""""""""""""""""""
if !has("win32")
  set shell=/bin/bash         " Use bash as the shell for :! commands (Windows keeps cmd.exe)
endif
set encoding=utf-8            " Use UTF-8 encoding for files and buffers
set noswapfile                " Disable swap files — prevents .swp clutter
set nobackup                  " Disable backup files — prevents ~ file clutter
set nowritebackup             " Don't create backup before overwriting a file
set hidden                    " Allow switching buffers without saving — keeps undo history intact
set autoread                  " Auto-reload files changed outside of vim (e.g. by git)
" autoread only fires on a check — trigger one when focus or buffer changes.
" Skip checktime for modified buffers so Vim doesn't raise W12 on focus switches.
augroup AutoReadCheck
  autocmd!
  autocmd FocusGained,BufEnter * if !&modified | silent! checktime | endif
augroup END
set backspace=indent,eol,start " Backspace over indent, line breaks, and insert start (defaults.vim is skipped when ~/.vimrc exists)
set ttimeout ttimeoutlen=50   " Short key-code timeout — <Esc>-prefixed Alt mappings no longer stall Esc for 1s
set nrformats-=octal          " Ctrl-A/Ctrl-X treat 007 as decimal, not octal
set splitright splitbelow     " New splits open right / below, like modern editors
set wildignore+=*/node_modules/*,*/.git/* " Skip vendor/VCS folders in file completion
set lazyredraw                " Don't redraw screen during macros — significant speed boost
set ttyfast                   " Assume a fast terminal connection — smoother scrolling
set history=1000              " Remember 1000 commands in history
set undolevels=1000           " Allow 1000 undo steps
" Persistent undo — history survives closing the file. vim won't create the
" folder itself, so make it (0700: undo files hold file contents).
if has("persistent_undo")
  if !isdirectory($HOME . "/.vim/undo")
    call mkdir($HOME . "/.vim/undo", "p", 0700)
  endif
  set undodir=$HOME/.vim/undo
  set undofile
endif
set mouse=i                   " Mouse only in insert mode — normal/visual use terminal-native selection
set re=0                      " Use old regexp engine (faster for complex patterns)
" Use system clipboard for yank/paste — matches Cmd+C/V behavior.
" unnamed = macOS/Windows clipboard; unnamedplus = X11/Wayland CLIPBOARD on Linux.
if has("clipboard")
  set clipboard=unnamed
  if has("unnamedplus")
    set clipboard+=unnamedplus
  endif
endif

"""""""""""""""""""""""""""""""""""""""""""""""""
" Search
"""""""""""""""""""""""""""""""""""""""""""""""""
set hlsearch                  " Highlight all search matches
set incsearch                 " Show matches as you type the search pattern
set ignorecase                " Case-insensitive search by default
set smartcase                 " Override ignorecase when search pattern has uppercase letters

"""""""""""""""""""""""""""""""""""""""""""""""""
" Indentation & Whitespace
"""""""""""""""""""""""""""""""""""""""""""""""""
set sts=2 sw=2 ts=2           " Default to 2-space indentation for new soft-tab files
set expandtab                 " Use spaces unless file contents or filetype require hard tabs
set autoindent                " Copy indentation from the current line when starting a new line
set smartindent               " Auto-indent after {, if, etc. — smarter than autoindent alone

" Set buffer-local indent options without rewriting text, moving the cursor, or
" changing search history. Any tab-led content selects hard tabs at the current
" tabstop width; otherwise use 2 spaces. Preserve a hard-tab filetype's default
" when no space-led content exists (including an empty Makefile).
function! s:DetectIndentStyle() abort
  if search('^\t\+\s*\S', 'nw') || (!&l:expandtab && !search('^ \+\S', 'nw'))
    setlocal noexpandtab softtabstop=0
    let &l:shiftwidth = &l:tabstop
  else
    setlocal expandtab softtabstop=2 shiftwidth=2 tabstop=2
  endif
endfunction
augroup SyIndentStyle
  autocmd!
  autocmd BufReadPost,BufNewFile,FileType * call s:DetectIndentStyle()
augroup END

" Strip leading blank lines and trailing whitespace on every save, and keep one blank line at EOF
" (cursor + search history preserved). This also removes Markdown hard-break spaces.
augroup TrimTrailingWhitespaceOnSave
  autocmd!
  autocmd BufWritePre * TrimTrailingWhitespace | TrimLeadingBlankLines | TrimTrailingBlankLines
augroup END

" Whitespace visualization (default ON; toggle with \[)
set listchars=tab:>-          " Show tabs as >---
set listchars+=space:␣        " Show spaces as ␣
set listchars+=trail:·        " Show trailing spaces as ·
set listchars+=eol:¬          " Show end-of-line as ¬
set list                     " Show whitespace markers by default

"""""""""""""""""""""""""""""""""""""""""""""""""
" Display & UI
"""""""""""""""""""""""""""""""""""""""""""""""""
syntax on                     " Enable syntax highlighting
" 24-bit color so the guifg= highlights above render in terminals too (tmux needs RGB enabled)
if has("termguicolors")
  set termguicolors
endif
set linebreak                 " Soft wrap breaks at word boundaries, not mid-word
set breakindent               " Wrapped continuation lines keep the line's indent
set wrap                      " Soft wrap on by default
set fileformat=unix           " Save files with Unix LF line endings by default
set fixendofline              " Always write one final newline, matching VS Code and Sublime Text
set showmatch                 " Briefly jump to matching bracket when inserting one
set wildmenu                  " Show autocomplete menu for commands (Tab in command mode)
set wildmode=longest:full,full " Complete to longest common string first, then cycle through matches
set scrolloff=5               " Keep 5 lines visible above and below the cursor when scrolling
set sidescrolloff=5           " Keep 5 columns visible to the left and right when scrolling horizontally
set laststatus=2              " Always show the status bar (needed for lightline)
set signcolumn=yes            " Always show the sign column — prevents layout shift from git/lint signs
set shortmess+=I              " Suppress the intro message when starting vim
set noshowmode                " Hide -- INSERT -- from the command line — lightline already shows it
" Enable setting the terminal title
set title

" Optional: Customize what gets displayed in the title bar 
" (e.g., relative file path, modified flag, and application name)
set titlestring=%t%(\ %M%)%(\ (%{expand(\"%:p:h\")})%)—Vim
set ruler                     " Show cursor position (line, column) in the status bar
set number                    " Show line numbers by default
set norelativenumber          " Keep absolute numbers (no relative numbers)

" Highlight the active cursor line only in the focused window
augroup CursorLineOnlyInActiveWindow
  autocmd!
  autocmd VimEnter,WinEnter,BufWinEnter * setlocal cursorline
  autocmd WinLeave * setlocal nocursorline
augroup END

"""""""""""""""""""""""""""""""""""""""""""""""""
" Keybindings — Read Mode (readline-style navigation for vim -R / less)
"""""""""""""""""""""""""""""""""""""""""""""""""
" Ctrl+A / Ctrl+E to jump to beginning / end of line (matches readline/bash)
nnoremap <silent> <C-a> ^
nnoremap <silent> <C-e> $
xnoremap <silent> <C-a> ^
xnoremap <silent> <C-e> $
" Ctrl+M follows Vim's % matching-pair motion in every editing mode.
" Traditional terminals also encode Enter as Ctrl+M, so editing-mode Enter
" jumps too. Command-line Enter is deliberately unchanged.
nnoremap <silent> <C-m> %
xnoremap <silent> <C-m> %
inoremap <silent> <C-m> <C-o>%
" Insert mode uses true line start/end, matching readline/bash editor behavior.
" This intentionally replaces Vim's stock Ctrl-A (insert previously inserted text)
" and Ctrl-E (scroll the window down one line) commands.
inoremap <silent> <C-a> <C-o>0
inoremap <silent> <C-e> <C-o>$
" Ctrl+W already deletes the previous word natively in insert mode; keep Vim's default.
" Ctrl+Backspace follows the same action when the terminal sends a distinct <C-BS> code.
inoremap <silent> <C-BS> <C-w>
" Ctrl+Delete deletes the next Vim word and stays in insert mode. Native Delete
" joins lines at a line boundary and does nothing at EOF; CTRL-\ CTRL-O
" avoids moving left before forward deletion, preserving preceding text.
inoremap <silent> <expr> <C-Del> col('.') > strlen(getline('.')) ? "\<Del>" : "\<C-\>\<C-o>dw"
" Ctrl+F pages forward natively; Ctrl+G pages backward (matches less/readline)
nnoremap <silent> <C-g> <C-b>

"""""""""""""""""""""""""""""""""""""""""""""""""
" Keybindings — Toggle
"""""""""""""""""""""""""""""""""""""""""""""""""
" Backslash-prefix toggles / actions:
"   \\       toggle absolute line numbers (relative numbers stay off)
"   \[       toggle whitespace visualization (invisibles)
"   \]       toggle soft wrap
"   \<Space> trim trailing whitespace (whole file)
"   \s       save file
"   \a       select whole file (`ggvG$`)
"   \z       undo
"   \y       redo
"   \<F5>    reload current file from disk (`:edit!`, discard unsaved changes)
" Keep plain '\' free as a prefix so these two-key mappings fire reliably.
nnoremap <silent> <Bslash><Bslash> :set number! norelativenumber<CR>
nnoremap <silent> <Bslash>[ :set list!<CR>
nnoremap <silent> <Bslash>] :set wrap!<CR>
nnoremap <silent> <Bslash><Space> :TrimTrailingWhitespace<CR>
nnoremap <silent> <Bslash>s :w<CR>
nnoremap <silent> <Bslash>a ggvG$
xnoremap <silent> <Bslash>a <Esc>ggvG$
nnoremap <silent> <Bslash>z u
xnoremap <silent> <Bslash>z <Esc>u
nnoremap <silent> <Bslash>y <C-r>
xnoremap <silent> <Bslash>y <Esc><C-r>

" ,<Space> also trims trailing whitespace (whole file).
nnoremap <silent> ,<Space> :TrimTrailingWhitespace<CR>
" ,a selects the whole file (`ggvG$`) in normal and visual mode.
nnoremap <silent> ,a ggvG$
xnoremap <silent> ,a <Esc>ggvG$
" ,z / ,y undo / redo in normal and visual mode.
nnoremap <silent> ,z u
xnoremap <silent> ,z <Esc>u
nnoremap <silent> ,y <C-r>
xnoremap <silent> ,y <Esc><C-r>

" ,<F5> / \<F5> reload current file from disk (`:edit!`, discard unsaved changes).
nnoremap <silent> ,<F5> :edit!<CR>
nnoremap <silent> <Bslash><F5> :edit!<CR>

" ,[ / ,] for previous / next buffer tab (pairs with ,1..,9).
nnoremap <silent> ,[ :bprevious<CR>
nnoremap <silent> ,] :bnext<CR>

" } (shift+]) to toggle soft wrap — matches VS Code/Sublime/Zed's
" ctrl+shift+OS_KEY+\ chord conceptually (one-key wrap toggle).
" Overrides vim's default `}` (jump to next paragraph end).
nnoremap } :set wrap!<CR>

" Backspace and Delete remove the visual selection like other editors. Keep
" both key names explicit because Windows Terminal does not infer visual-mode
" deletion from Vim's insert-mode defaults.
xnoremap <BS> d
xnoremap <Del> d

" Tab / Shift+Tab in visual mode indent / dedent and keep the selection, so
" repeated presses keep shifting — VS Code/Sublime parity. Buffer-local
" expandtab/shiftwidth/tabstop select 2 spaces or one hard tab, not a fixed width.
" Replaces the old visual-mode Tab wrap toggle; \] / } still toggle wrap.
xnoremap <Tab> >gv
xnoremap <S-Tab> <gv

" ctrl+shift+enter (all OSes) / cmd+shift+enter (MacVim) also toggle soft wrap,
" matching VS Code/Sublime/Zed/text-server. GUI vim and terminals that report
" modified keys (CSI u / modifyOtherKeys) deliver these; plain terminals send a bare CR.
nnoremap <C-S-CR> :set wrap!<CR>
inoremap <C-S-CR> <C-o>:set wrap!<CR>
if has("gui_macvim")
  nnoremap <D-S-CR> :set wrap!<CR>
  inoremap <D-S-CR> <C-o>:set wrap!<CR>
endif

" Trim trailing whitespace (whole file): ,<Space> or cmd/ctrl/alt + shift + backspace,
" matching VS Code/Sublime/text-server. Remove duplicate lines (keep first, order kept):
" cmd/ctrl/alt + shift + delete. Only GUI vim / CSI-u terminals deliver these chords.
command! -bar TrimTrailingWhitespace let s:view = winsaveview() | keeppatterns %s/\s\+$//e | call winrestview(s:view)
" Remove whole blank prefix lines before content, preserving registers, search,
" content indentation, and the cursor's position relative to surviving text.
" Blank-only buffers retain their existing trailing-normalization behavior.
function! s:TrimLeadingBlankLines() abort
  let l:count = nextnonblank(1) - 1
  if l:count <= 0
    return
  endif
  let l:view = winsaveview()
  call deletebufline(bufnr('%'), 1, l:count)
  let l:view.lnum = max([1, l:view.lnum - l:count])
  let l:view.topline = max([1, l:view.topline - l:count])
  call winrestview(l:view)
endfunction
command! -bar TrimLeadingBlankLines call <SID>TrimLeadingBlankLines()
" Normalize trailing blank lines without changing the saved cursor view.
function! s:TrimTrailingBlankLines() abort
  let l:view = winsaveview()
  while line('$') > 2 && getline('$') =~# '^\s*$'
    call deletebufline(bufnr('%'), line('$'))
  endwhile
  if line('$') > 1 && getline('$') =~# '^\s*$'
    call setline('$', '')
  elseif getline('$') !=# ''
    call append('$', '')
  endif
  call winrestview(l:view)
endfunction
command! -bar TrimTrailingBlankLines call <SID>TrimTrailingBlankLines()
command! -range=% UniqueLines <line1>,<line2>!awk '\!seen[$0]++'
let s:trim_lhs = ['<C-S-BS>', '<M-S-BS>'] + (has('gui_macvim') ? ['<D-S-BS>'] : [])
let s:uniq_lhs = ['<C-S-Del>', '<M-S-Del>'] + (has('gui_macvim') ? ['<D-S-Del>'] : [])
for s:lhs in s:trim_lhs
  execute 'nnoremap <silent> ' . s:lhs . ' :TrimTrailingWhitespace<CR>'
  execute 'inoremap <silent> ' . s:lhs . ' <C-o>:TrimTrailingWhitespace<CR>'
endfor
for s:lhs in s:uniq_lhs
  execute 'nnoremap <silent> ' . s:lhs . ' :UniqueLines<CR>'
  execute 'xnoremap <silent> ' . s:lhs . ' :UniqueLines<CR>'
  execute 'inoremap <silent> ' . s:lhs . ' <C-o>:UniqueLines<CR>'
endfor

"""""""""""""""""""""""""""""""""""""""""""""""""
" Keybindings — Splits
"""""""""""""""""""""""""""""""""""""""""""""""""
" Ctrl-x / Ctrl-q to close the current split
nnoremap <C-x> :q<CR>
nnoremap <C-q> :q<CR>

" Ctrl-d to open a vertical split
nnoremap <C-d> :vsplit<CR>

" Splits match tmux (tmux.config): ,d side-by-side (vertical), ,' stacked (horizontal).
" ,s saves the current buffer. ,5 is not a split here — ,1..,9 jump to buffer tabs (see below).
" ,v is clipboard image/text paste, not a split.
nnoremap <silent> ,d :vsplit<CR>
nnoremap <silent> ,' :split<CR>
nnoremap <silent> ,s :w<CR>

" ,1..,9 jump to the Nth buffer tab in the lightline-bufferline tabline (left to right).
for s:i in range(1, 9)
  execute printf('nmap <silent> ,%d <Plug>lightline#bufferline#go(%d)', s:i, s:i)
endfor

" ,w saves and quits; ,q quits all without saving; ,x closes the current split
nnoremap <silent> ,w :wq<CR>
nnoremap <silent> ,q :qa!<CR>
nnoremap <silent> ,x <c-w>q

" Ctrl+Arrow for editor-style text navigation; ,Arrow remains split navigation.
" Ctrl+Home/End move across the buffer; Shift starts or extends Visual selection.
" Insert-mode Ctrl-O preserves the insertion position when starting selection.
nnoremap <silent> <C-Home> gg0
nnoremap <silent> <C-End> G$
inoremap <silent> <C-Home> <C-o><C-Home>
inoremap <silent> <C-End> <C-o><C-End>
xnoremap <silent> <C-Home> <Esc>gg0
xnoremap <silent> <C-End> <Esc>G$
nnoremap <silent> <C-S-Home> v<C-Home>
nnoremap <silent> <C-S-End> v<C-End>
inoremap <silent> <C-S-Home> <C-o>v<C-Home>
inoremap <silent> <C-S-End> <C-o>v<C-End>
xnoremap <silent> <C-S-Home> <C-Home>
xnoremap <silent> <C-S-End> <C-End>
nnoremap <silent> <C-Right> w
nnoremap <silent> <C-Left> b
nnoremap <silent> <C-Up> <C-b>
nnoremap <silent> <C-Down> <C-f>
inoremap <silent> <C-Right> <C-o>w
inoremap <silent> <C-Left> <C-o>b
inoremap <silent> <C-Up> <C-o><C-b>
inoremap <silent> <C-Down> <C-o><C-f>
vnoremap <silent> <C-Up> <C-b>
vnoremap <silent> <C-Down> <C-f>
nnoremap <silent> ,<Right> <c-w>l
nnoremap <silent> ,<Left> <c-w>h
nnoremap <silent> ,<Up> <c-w>k
nnoremap <silent> ,<Down> <c-w>j

"""""""""""""""""""""""""""""""""""""""""""""""""
" Keybindings — FZF / Search
"""""""""""""""""""""""""""""""""""""""""""""""""
" Ctrl-t or ,t to open fuzzy file finder
nnoremap <silent> <C-t> :Files<CR>
nnoremap <silent> ,t :Files<CR>

" Ctrl-f / ,f to search file contents with ripgrep
nnoremap <silent> ,f :Rg<CR>

" ,b to list and switch between open buffers
nnoremap <silent> ,b :Buffers<CR>

" ,r to list recently opened files
nnoremap <silent> ,r :History<CR>

" Alt+Z / Alt+Shift+Z for undo/redo (Option on Mac, Alt on Windows)
" <A-z> form — works in terminals that natively support Alt key
nnoremap <silent> <A-z> u
nnoremap <silent> <A-S-z> <C-r>
nnoremap <silent> <A-y> <C-r>
vnoremap <silent> <A-z> <Esc>u
vnoremap <silent> <A-S-z> <Esc><C-r>
vnoremap <silent> <A-y> <Esc><C-r>
inoremap <silent> <A-z> <C-o>u
inoremap <silent> <A-S-z> <C-o><C-r>
inoremap <silent> <A-y> <C-o><C-r>
" <Esc> form — works in terminals that send Alt as Esc+key sequence
nnoremap <silent> <Esc>z u
nnoremap <silent> <Esc>Z <C-r>
vnoremap <silent> <Esc>z <Esc>u
vnoremap <silent> <Esc>Z <Esc><C-r>
inoremap <silent> <Esc>z <C-o>u
inoremap <silent> <Esc>Z <C-o><C-r>

" Alt+Arrow keys for navigation (Option on Mac, Alt on Windows)
nnoremap <silent> <A-Up> <C-b>
nnoremap <silent> <A-Down> <C-f>
vnoremap <silent> <A-Up> <C-b>
vnoremap <silent> <A-Down> <C-f>
inoremap <silent> <A-Up> <C-o><C-b>
inoremap <silent> <A-Down> <C-o><C-f>
nnoremap <silent> <A-Left> <Home>
nnoremap <silent> <A-Right> <End>
vnoremap <silent> <A-Left> <Home>
vnoremap <silent> <A-Right> <End>
inoremap <silent> <A-Left> <Home>
inoremap <silent> <A-Right> <End>

" Alt+Backspace to delete to beginning of line (matches VS Code/Sublime/Zed)
nnoremap <silent> <A-BS> d0
inoremap <silent> <A-BS> <C-u>

" Alt+S to save (matches VS Code/Sublime/Zed)
nnoremap <silent> <A-s> :w<CR>
inoremap <silent> <A-s> <C-o>:w<CR>
vnoremap <silent> <A-s> <Esc>:w<CR>
nnoremap <silent> <Esc>s :w<CR>
inoremap <silent> <Esc>s <C-o>:w<CR>
vnoremap <silent> <Esc>s <Esc>:w<CR>

" Alt+W to close buffer (matches VS Code/Sublime/Zed)
nnoremap <silent> <A-w> :bd<CR>
nnoremap <silent> <Esc>w :bd<CR>

" Alt+L to select current line (matches VS Code/Sublime/Zed)
nnoremap <silent> <A-l> V
nnoremap <silent> <Esc>l V

" Break undo into smaller chunks — makes undo more granular like modern editors
inoremap <space> <C-g>u<space>
inoremap , <C-g>u,
inoremap . <C-g>u.

"""""""""""""""""""""""""""""""""""""""""""""""""
" Keybindings — Misc
"""""""""""""""""""""""""""""""""""""""""""""""""
" ,n to clear search highlighting
nnoremap <silent> ,n :nohlsearch<CR>

" Tab is a second ',' prefix in normal mode: Tab g == ,g, Tab v == ,v, and so on.
" Recursive nmap so the inserted ',' joins the next typed key. Normal mode only —
" visual-mode Tab / Shift+Tab indent / dedent instead. Trade-off: terminals send Tab and
" Ctrl-I as the same byte, so Ctrl-I (jumplist forward) is gone; Ctrl-O still works.
nmap <Tab> ,

" Multi-cursor (vim-visual-multi) — Sublime parity:
"   ,g          select every match of the word under cursor (case-insensitive)
"   ,g (visual) select every match of the exact selected text (case-insensitive)
"   ,G          same as ,g, but case-sensitive
"   ,l (visual) one cursor per selected line
"   ctrl+n      plugin default: add the next match (Sublime OS_KEY+d)
" Esc leaves multi-cursor mode. Set before the plugin loads (vimrc runs first).
" VM_leader moves the plugin's own prefix off its default '\\' so the '\' line-number
" toggle fires instantly instead of entering (and exiting) Visual-Multi.
let g:VM_leader = ',m'
let g:VM_maps = {}
" Free Ctrl+Up/Down for page navigation; Visual-Multi defaults these to cursor creation.
let g:VM_maps['Add Cursor Up'] = ''
let g:VM_maps['Add Cursor Down'] = ''
" Keep ,l as Visual-Multi's normal visual-cursor command. Define ,g and ,G
" locally so each key chooses its own case behavior without entering Insert mode.
let g:VM_maps['Select All'] = ''
let g:VM_maps['Visual All'] = ''
let g:VM_maps['Visual Cursors'] = ',l'
let g:VM_case_setting = 'ignore'

function! s:VmFindAll(case_setting, visual) abort
  let g:VM_case_setting = a:case_setting
  call vm#commands#find_all(a:visual, a:visual ? 0 : 1)
endfunction

nnoremap <silent> ,g :<C-u>call <SID>VmFindAll('ignore', 0)<CR>
nnoremap <silent> ,G :<C-u>call <SID>VmFindAll('sensitive', 0)<CR>
xnoremap <silent> ,g y:<C-u>call <SID>VmFindAll('ignore', 1)<CR>
xnoremap <silent> ,G y:<C-u>call <SID>VmFindAll('sensitive', 1)<CR>

" Y to yank from cursor to end of line (consistent with D and C)
nnoremap Y y$

" Keep cursor centered when jumping through search results
nnoremap n nzzzv
nnoremap N Nzzzv

" Keep cursor centered when joining lines
nnoremap J mzJ`z

" Move selected lines up/down in visual mode
vnoremap J :m '>+1<CR>gv=gv
vnoremap K :m '<-2<CR>gv=gv

" ,c to copy to system clipboard (whole buffer, or the selection in visual mode)
" ,p to replace the entire buffer with the system clipboard.
" Uses vim's clipboard register; falls back to pbcopy/pbpaste on vim built without +clipboard.
" ,c also falls back to clip.exe (WSL) / wl-copy (Wayland) / xclip (X11) — ,p has no fallback there.
" ,c reports "Copied to clipboard (N lines) - <file>" instead of vim's 'N lines yanked into "+'.
if has("clipboard")
  let s:clipboard_copy_cmd = ''
elseif executable("pbcopy")
  let s:clipboard_copy_cmd = 'pbcopy'
elseif executable("clip.exe")
  let s:clipboard_copy_cmd = 'clip.exe'
elseif executable("wl-copy") && !empty($WAYLAND_DISPLAY)
  let s:clipboard_copy_cmd = 'wl-copy'
elseif executable("xclip")
  let s:clipboard_copy_cmd = 'xclip -selection clipboard'
endif

" Copy the whole buffer (a:visual = 0) or the last visual selection (a:visual = 1)
" to the system clipboard, then echo a friendly summary.
function! s:CopyToClipboard(visual) abort
  let l:first = a:visual ? line("'<") : 1
  let l:last = a:visual ? line("'>") : line('$')
  let l:count = l:last - l:first + 1
  if empty(s:clipboard_copy_cmd)
    if a:visual
      " gv"+y keeps a charwise / blockwise selection exact.
      silent normal! gv"+y
    else
      silent %yank +
    endif
  else
    " External tools get whole lines, same as the old ':w !pbcopy'.
    call system(s:clipboard_copy_cmd, getline(l:first, l:last))
    if v:shell_error
      echohl ErrorMsg | echo 'Copy to clipboard failed (' . s:clipboard_copy_cmd . ')' | echohl None
      return
    endif
  endif
  let l:name = expand('%:p:~')
  redraw
  echo 'Copied to clipboard (' . l:count . (l:count == 1 ? ' line' : ' lines') . ')' . (empty(l:name) ? '' : ' - ' . l:name)
endfunction

if exists('s:clipboard_copy_cmd')
  nnoremap <silent> ,c :call <SID>CopyToClipboard(0)<CR>
  vnoremap <silent> ,c :<C-u>call <SID>CopyToClipboard(1)<CR>
  nnoremap <silent> <Bslash>c :call <SID>CopyToClipboard(0)<CR>
  vnoremap <silent> <Bslash>c :<C-u>call <SID>CopyToClipboard(1)<CR>
endif
if has('clipboard')
  nnoremap <silent> <Bslash>x "+dd
  vnoremap <silent> <Bslash>x "+d
else
  nnoremap <silent> <Bslash>x dd
  vnoremap <silent> <Bslash>x d
endif
" Clipboard paste commands remove terminal newlines so pasted text does not add blank lines.

" Ctrl+V (insert mode) / ,v (normal mode) = paste clipboard image or text.
" Image -> saved by ~/.local/bin/save_clipboard_image (clipboard-image.js), "@<path>" inserted
" (opencode / copilot file-reference syntax, for prompts edited via Ctrl+G).
" No image -> normal text paste. Vim's literal-insert stays on Ctrl+Q.
" Absolute path: vim launched from an AI CLI may not have ~/.local/bin on PATH.
" Windows Terminal likely intercepts Ctrl+V before vim sees it.
let s:save_clipboard_image = expand('~/.local/bin/save_clipboard_image')
function! s:PasteClipboardImageOrText(...) abort
  let l:replace_buffer = get(a:, 1, 0)
  let l:line = line('.')
  let l:path = ''
  let l:status = 1
  if executable(s:save_clipboard_image)
    let l:path = trim(system(shellescape(s:save_clipboard_image)))
    let l:status = v:shell_error
  endif
  if l:status == 0 && !empty(l:path) && !l:replace_buffer
    execute "normal! a@" . l:path . " "
    redraw | echo 'Pasted image from clipboard on line ' . l:line . ' - ' . fnamemodify(l:path, ':~')
    return
  endif
  " 1 = no image, fall through to text. Anything else = tool broken, say so.
  if l:status != 1
    echohl ErrorMsg | echo 'save_clipboard_image failed (exit ' . l:status . '): ' . l:path | echohl None
    return
  endif
  if has('clipboard')
    let l:text = getreg('+')
  elseif executable('pbpaste')
    let l:text = system('pbpaste')
  elseif executable('powershell.exe')
    let l:text = system('powershell.exe -NoProfile -Command Get-Clipboard')
  else
    let l:text = ''
  endif
  let l:text = substitute(l:text, '[\r\n ]\+$', '', '')
  if empty(l:text)
    echohl WarningMsg | echo 'Clipboard is empty' | echohl None
    return
  endif
  if l:replace_buffer
    call setline(1, split(l:text, '\n', 1))
    silent! 2,$delete _
  else
    call setreg('"', l:text, 'c')
    normal! p
  endif
  let l:count = len(split(l:text, '\n', 1))
  redraw | echo 'Pasted from clipboard (' . l:count . (l:count == 1 ? ' line' : ' lines') . ') on line ' . l:line
endfunction
if executable(s:save_clipboard_image)
  inoremap <silent> <C-v> <C-o>:call <SID>PasteClipboardImageOrText()<CR>
endif
nnoremap <silent> ,v :call <SID>PasteClipboardImageOrText()<CR>
nnoremap <silent> <Bslash>v :call <SID>PasteClipboardImageOrText()<CR>
nnoremap <silent> p :call <SID>PasteClipboardImageOrText()<CR>

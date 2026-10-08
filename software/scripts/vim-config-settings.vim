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
" Wrapped in a function + ColorScheme autocmd so a later :colorscheme does not wipe them.
function! s:ApplyCustomHighlights() abort
hi tsxTagName guifg=#ee0000                                         " JSX tag names in red
hi tsxCloseString guifg=#f99575                                     " Closing tag slash
hi tsxCloseTag guifg=#f99575                                        " Closing tag bracket
hi tsxCloseTagName guifg=#f99575                                    " Closing tag name
hi tsxAttributeBraces guifg=#f99575                                 " Attribute value braces {…}
hi tsxEqual guifg=#f99575                                           " Attribute equals sign
hi tsxAttrib guifg=#f8bd7f cterm=italic                             " JSX attribute names in italic
hi tsxTypeBraces guifg=#999999                                      " TypeScript generic braces <T>
hi tsxTypes guifg=#666666                                           " TypeScript type annotations
hi ReactState guifg=#c176a7                                         " React state variables
hi ReactProps guifg=#d19a66                                         " React props
hi ApolloGraphQL guifg=#cb886b                                      " Apollo/GraphQL keywords
hi Events ctermfg=204 guifg=#56b6c2                                 " DOM event handlers
hi ReduxKeywords ctermfg=204 guifg=#c678dd                          " Redux action/dispatch keywords
hi ReduxHooksKeywords ctermfg=204 guifg=#c176a7                     " Redux hooks (useSelector, useDispatch)
hi WebBrowser ctermfg=204 guifg=#56b6c2                             " Browser API keywords
hi ReactLifeCycleMethods ctermfg=204 guifg=#d19a66                  " React lifecycle methods (componentDidMount, etc.)
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
" lightline: codedark theme (ships with vim-code-dark) + open buffers as tabs via lightline-bufferline
let g:lightline = {
  \ 'colorscheme': 'codedark',
  \ 'tabline': { 'left': [ [ 'buffers' ] ], 'right': [ [] ] },
  \ 'component_expand': { 'buffers': 'lightline#bufferline#buffers' },
  \ 'component_type': { 'buffers': 'tabsel' },
  \ }
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
" autoread only fires on a check — trigger one when focus or buffer changes
augroup AutoReadCheck
  autocmd!
  autocmd FocusGained,BufEnter * silent! checktime
augroup END
set backspace=indent,eol,start " Backspace over indent, line breaks, and insert start (defaults.vim is skipped when ~/.vimrc exists)
set ttimeout ttimeoutlen=50   " Short key-code timeout — <Esc>-prefixed Alt mappings no longer stall Esc for 1s
set nrformats-=octal          " Ctrl-A/Ctrl-X treat 007 as decimal, not octal
set splitright splitbelow     " New splits open right / below, like modern editors
set wildignore+=*/node_modules/*,*/.git/* " Skip vendor/VCS folders in file completion
set lazyredraw                " Don't redraw screen during macros — significant speed boost
set ttyfast                   " Assume a fast terminal connection — smoother scrolling
set history=500               " Remember 500 commands in history
set undolevels=500            " Allow 500 undo steps
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
set sts=2 sw=2 ts=2           " Soft tab stop, shift width, and tab stop all set to 2 spaces
set expandtab                 " Insert spaces when pressing Tab — never use actual tab characters
set autoindent                " Copy indentation from the current line when starting a new line
set smartindent               " Auto-indent after {, if, etc. — smarter than autoindent alone

" Strip trailing whitespace on every save (cursor + search history preserved).
" Markdown skipped — two trailing spaces there are a hard line break.
augroup TrimTrailingWhitespaceOnSave
  autocmd!
  autocmd BufWritePre * if &filetype !=# 'markdown' | TrimTrailingWhitespace | endif
augroup END

" Whitespace visualization (toggled with ,i)
set listchars=tab:>-          " Show tabs as >---
set listchars+=space:␣        " Show spaces as ␣
set listchars+=trail:·        " Show trailing spaces as ·
set listchars+=eol:¬          " Show end-of-line as ¬

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
" Ctrl+F pages forward natively; Ctrl+G pages backward (matches less/readline)
nnoremap <silent> <C-g> <C-b>

"""""""""""""""""""""""""""""""""""""""""""""""""
" Keybindings — Toggle
"""""""""""""""""""""""""""""""""""""""""""""""""
" \ to toggle absolute line numbers (relative numbers stay off). Binding \ shadows vim's default <Leader>;
" no <Leader> mappings exist here — set mapleader elsewhere before adding any.
nnoremap <Bslash> :set number! norelativenumber<CR>

" ,z to toggle soft wrap (same as } and visual-mode Tab). [ / ] stay vim's
" bracket prefixes so ]c / [c (signify hunk jumps) and [[ / ]] keep working.
nnoremap <silent> ,z :set wrap!<CR>

" ,i to toggle whitespace visualization (invisibles)
nnoremap <silent> ,i :set list!<CR>

" } (shift+]) to toggle soft wrap — matches VS Code/Sublime/Zed's
" ctrl+shift+OS_KEY+\ chord conceptually (one-key wrap toggle).
" Overrides vim's default `}` (jump to next paragraph end).
nnoremap } :set wrap!<CR>

" Tab in visual mode toggles soft wrap and keeps the selection.
xnoremap <Tab> <Esc>:set wrap!<CR>gv

" ctrl+shift+enter (all OSes) / cmd+shift+enter (MacVim) also toggle soft wrap,
" matching VS Code/Sublime/Zed/text-server. GUI vim and terminals that report
" modified keys (CSI u / modifyOtherKeys) deliver these; plain terminals send a bare CR.
nnoremap <C-S-CR> :set wrap!<CR>
inoremap <C-S-CR> <C-o>:set wrap!<CR>
if has("gui_macvim")
  nnoremap <D-S-CR> :set wrap!<CR>
  inoremap <D-S-CR> <C-o>:set wrap!<CR>
endif

" Trim trailing whitespace (whole file): cmd/ctrl/alt + shift + backspace, matching
" VS Code/Sublime/text-server. Remove duplicate lines (keep first, order kept):
" cmd/ctrl/alt + shift + delete. Only GUI vim / CSI-u terminals deliver these chords.
command! -bar TrimTrailingWhitespace let s:view = winsaveview() | keeppatterns %s/\s\+$//e | call winrestview(s:view)
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

" Splits match tmux (tmux.config): ,d / ,5 side-by-side (vertical), ,' / ,s stacked (horizontal).
" ,v is clipboard image/text paste, not a split.
nnoremap <silent> ,d :vsplit<CR>
nnoremap <silent> ,5 :vsplit<CR>
nnoremap <silent> ,' :split<CR>
nnoremap <silent> ,s :split<CR>

" ,w / ,x to close the current split
nnoremap <silent> ,w <c-w>q
nnoremap <silent> ,x <c-w>q

" Ctrl+Arrow or ,Arrow to navigate between splits
nnoremap <silent> <C-Right> <c-w>l
nnoremap <silent> <C-Left> <c-w>h
nnoremap <silent> <C-Up> <c-w>k
nnoremap <silent> <C-Down> <c-w>j
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
inoremap <CR> <C-g>u<CR>
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
"   ,g          select every match of the word under cursor (Sublime OS_KEY+ctrl+g)
"   ,g (visual) select every match of the exact selected text (partial words OK)
"   ,l (visual) one cursor per selected line (Sublime cmd+shift+l)
"   ctrl+n      plugin default: add the next match (Sublime OS_KEY+d)
" Esc leaves multi-cursor mode. Set before the plugin loads (vimrc runs first).
" VM_leader moves the plugin's own prefix off its default '\\' so the '\' line-number
" toggle fires instantly instead of entering (and exiting) Visual-Multi.
let g:VM_leader = ',m'
let g:VM_maps = {}
let g:VM_maps['Select All'] = ',g'
let g:VM_maps['Visual All'] = ',g'
let g:VM_maps['Visual Cursors'] = ',l'

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
endif
if has("clipboard")
  nnoremap <silent> ,p :%d _ \| put + \| 1d _<CR>
elseif executable("pbcopy")
  nnoremap <silent> ,p :%d \| r !pbpaste \| 1d<CR>
endif

" Ctrl+V (insert mode) / ,v (normal mode) = paste clipboard image or text.
" Image -> saved by ~/.local/bin/save_clipboard_image (clipboard-image.js), "@<path>" inserted
" (opencode / copilot file-reference syntax, for prompts edited via Ctrl+G).
" No image -> normal text paste. Vim's literal-insert stays on Ctrl+Q.
" Absolute path: vim launched from an AI CLI may not have ~/.local/bin on PATH.
" Mapped only when the tool exists, so native Windows vim keeps stock Ctrl+V.
" Windows Terminal likely intercepts Ctrl+V before vim sees it.
let s:save_clipboard_image = expand('~/.local/bin/save_clipboard_image')
function! s:PasteClipboardImageOrText() abort
  let l:line = line('.')
  let l:path = trim(system(shellescape(s:save_clipboard_image)))
  let l:status = v:shell_error
  if l:status == 0 && !empty(l:path)
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
    let l:text = substitute(system('powershell.exe -NoProfile -Command Get-Clipboard'), '\r', '', 'g')
  else
    let l:text = ''
  endif
  if empty(l:text)
    echohl WarningMsg | echo 'Clipboard is empty' | echohl None
    return
  endif
  if has('clipboard')
    normal! "+p
  else
    execute "normal! a" . l:text
  endif
  " A trailing newline ends the last line; it does not start a new one.
  let l:count = len(split(substitute(l:text, '\n$', '', ''), '\n', 1))
  redraw | echo 'Pasted from clipboard (' . l:count . (l:count == 1 ? ' line' : ' lines') . ') on line ' . l:line
endfunction
if executable(s:save_clipboard_image)
  inoremap <silent> <C-v> <C-o>:call <SID>PasteClipboardImageOrText()<CR>
  nnoremap <silent> ,v :call <SID>PasteClipboardImageOrText()<CR>
endif

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
hi tsxTagName guifg=#EE0000                                         " JSX tag names in red
hi tsxCloseString guifg=#F99575                                     " Closing tag slash
hi tsxCloseTag guifg=#F99575                                        " Closing tag bracket
hi tsxCloseTagName guifg=#F99575                                    " Closing tag name
hi tsxAttributeBraces guifg=#F99575                                 " Attribute value braces {…}
hi tsxEqual guifg=#F99575                                           " Attribute equals sign
hi tsxAttrib guifg=#F8BD7F cterm=italic                             " JSX attribute names in italic
hi tsxTypeBraces guifg=#999999                                      " TypeScript generic braces <T>
hi tsxTypes guifg=#666666                                           " TypeScript type annotations
hi ReactState guifg=#C176A7                                         " React state variables
hi ReactProps guifg=#D19A66                                         " React props
hi ApolloGraphQL guifg=#CB886B                                      " Apollo/GraphQL keywords
hi Events ctermfg=204 guifg=#56B6C2                                 " DOM event handlers
hi ReduxKeywords ctermfg=204 guifg=#C678DD                          " Redux action/dispatch keywords
hi ReduxHooksKeywords ctermfg=204 guifg=#C176A7                     " Redux hooks (useSelector, useDispatch)
hi WebBrowser ctermfg=204 guifg=#56B6C2                             " Browser API keywords
hi ReactLifeCycleMethods ctermfg=204 guifg=#D19A66                  " React lifecycle methods (componentDidMount, etc.)

"""""""""""""""""""""""""""""""""""""""""""""""""
" Plugin Settings
"""""""""""""""""""""""""""""""""""""""""""""""""
filetype on                                                         " Re-enable filetype detection after vim-plug init
let g:airline_theme = 'codedark'                                    " Match codedark colorscheme — ships with vim-code-dark
let g:airline#extensions#tabline#enabled = 1                        " Show open buffers as tabs in the top bar
let g:airline#extensions#tabline#formatter = 'default'              " Use default tab label format (filename only)
let g:airline#extensions#tabline#left_alt_sep = '|'                 " Alternate separator between inactive tabs
let g:airline#extensions#tabline#left_sep = ' '                     " Separator between active and inactive tabs
let g:xml_syntax_folding = 1                                        " Enable syntax-based folding for XML files
let g:gitgutter_enabled = 1                                         " Enable git gutter signs by default
let g:gitgutter_map_keys = 0                                        " Disable default gitgutter key mappings — use custom ones below

"""""""""""""""""""""""""""""""""""""""""""""""""
" General Settings
"""""""""""""""""""""""""""""""""""""""""""""""""
set shell=/bin/bash           " Use bash as the shell for :! commands
set encoding=utf-8            " Use UTF-8 encoding for files and buffers
set noswapfile                " Disable swap files — prevents .swp clutter
set nobackup                  " Disable backup files — prevents ~ file clutter
set nowritebackup             " Don't create backup before overwriting a file
set hidden                    " Allow switching buffers without saving — keeps undo history intact
set autoread                  " Auto-reload files changed outside of vim (e.g. by git)
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
set clipboard=unnamed         " Use system clipboard for yank/paste — matches Cmd+C/V behavior

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

" Strip trailing whitespace on every save
autocmd BufWritePre * %s/\s\+$//e

" Whitespace visualization (toggled with ] key)
set listchars=tab:>-          " Show tabs as >---
set listchars+=space:␣        " Show spaces as ␣
set listchars+=trail:·        " Show trailing spaces as ·
set listchars+=eol:¬          " Show end-of-line as ¬

"""""""""""""""""""""""""""""""""""""""""""""""""
" Paste Mode
"""""""""""""""""""""""""""""""""""""""""""""""""
set pastetoggle=<F2>              " Press F2 to toggle paste mode — disables autoindent for clean pasting

"""""""""""""""""""""""""""""""""""""""""""""""""
" Display & UI
"""""""""""""""""""""""""""""""""""""""""""""""""
syntax on                     " Enable syntax highlighting
set linebreak                 " Soft wrap breaks at word boundaries, not mid-word
set breakindent               " Wrapped continuation lines keep the line's indent
set showmatch                 " Briefly jump to matching bracket when inserting one
set wildmenu                  " Show autocomplete menu for commands (Tab in command mode)
set wildmode=longest:full,full " Complete to longest common string first, then cycle through matches
set scrolloff=5               " Keep 5 lines visible above and below the cursor when scrolling
set sidescrolloff=5           " Keep 5 columns visible to the left and right when scrolling horizontally
set laststatus=2              " Always show the status bar (needed for vim-airline)
set signcolumn=yes            " Always show the sign column — prevents layout shift from git/lint signs
set shortmess+=I              " Suppress the intro message when starting vim
set noshowmode                " Hide -- INSERT -- from the command line — airline already shows it
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
" Ctrl+F / Ctrl+G to page forward / backward (matches less/readline)
nnoremap <silent> <C-f> <C-f>
nnoremap <silent> <C-g> <C-b>

"""""""""""""""""""""""""""""""""""""""""""""""""
" Keybindings — Toggle
"""""""""""""""""""""""""""""""""""""""""""""""""
" \ to toggle line numbers. Binding \ shadows vim's default <Leader>;
" no <Leader> mappings exist here — set mapleader elsewhere before adding any.
nnoremap <Bslash> :set nonumber!<CR>

" [ to toggle soft wrap (same as } and visual-mode Tab).
nnoremap [ :set wrap!<CR>

" ] to toggle whitespace visualization
nnoremap ] :set list!<CR>

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
command! TrimTrailingWhitespace let s:view = winsaveview() | keeppatterns %s/\s\+$//e | call winrestview(s:view)
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

" ,v / ,5 for vertical split, ,s / ,d for horizontal split
nnoremap <silent> ,v :vsplit<CR>
nnoremap <silent> ,5 :vsplit<CR>
nnoremap <silent> ,s :split<CR>
nnoremap <silent> ,d :split<CR>

" ,w / ,x to close the current split
nnoremap <silent> ,w <c-w>q
nnoremap <silent> ,x <c-w>q

" Ctrl+Arrow keys to navigate between splits
nnoremap <silent> <C-Right> <c-w>l
nnoremap <silent> <C-Left> <c-w>h
nnoremap <silent> <C-Up> <c-w>k
nnoremap <silent> <C-Down> <c-w>j

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

" Multi-cursor (vim-visual-multi) — Sublime parity:
"   ,g          select every match of the word under cursor (Sublime OS_KEY+ctrl+g)
"   ,g (visual) select every match of the exact selected text (partial words OK)
"   ,l (visual) one cursor per selected line (Sublime cmd+shift+l)
"   ctrl+n      plugin default: add the next match (Sublime OS_KEY+d)
" Esc leaves multi-cursor mode. Set before the plugin loads (vimrc runs first).
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

" ,c to copy to system clipboard (pbcopy)
nnoremap <silent> ,c :%w !pbcopy<CR>
vnoremap <silent> ,c :w !pbcopy<CR>

" ,p to paste from system clipboard (pbpaste), replacing entire buffer
nnoremap <silent> ,p :%d \| r !pbpaste \| 1d<CR>

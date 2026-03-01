/** * Generates vimrc configuration with Vundle plugins, syntax highlighting, and keybindings for Linux, Mac, and Windows. */
async function doWork() {
  let targetPath;

  const contentOnlyFullVimrc = trimLeftSpaces(`
    " ~/.vimrc

    """""""""""""""""""""""""""""""""""""""""""""""""
    " Vundle Plugin Manager
    """""""""""""""""""""""""""""""""""""""""""""""""
    set nocompatible              " Disable vi compatibility — required for Vundle and modern vim features
    filetype off                  " Turn off filetype detection temporarily — Vundle requires this during init
    set rtp+=~/.vim/bundle/Vundle.vim
    call vundle#begin()

    " --- Syntax & Language Support ---
    Plugin 'pangloss/vim-javascript'                                    " Improved JavaScript syntax and indentation
    Plugin 'isRuslan/vim-es6'                                           " ES6+ syntax highlighting (arrow functions, template strings, etc.)
    Plugin 'maxmellon/vim-jsx-pretty'                                   " JSX/TSX syntax highlighting with pretty indentation
    Plugin 'mxw/vim-jsx'                                                " JSX syntax support for React components
    Plugin 'peitalin/vim-jsx-typescript'                                " TypeScript JSX (.tsx) syntax highlighting
    Plugin 'leafgarland/typescript-vim'                                 " TypeScript syntax highlighting and indentation
    Plugin 'styled-components/vim-styled-components', { 'branch': 'main' } " Syntax highlighting inside styled-components template literals
    Plugin 'jparise/vim-graphql'                                        " GraphQL schema and query syntax highlighting
    Plugin 'JulesWang/css.vim'                                          " Improved CSS syntax highlighting
    Plugin 'cakebaker/scss-syntax.vim'                                  " SCSS/Sass syntax highlighting

    " --- UI & Status ---
    Plugin 'vim-airline/vim-airline'                                     " Lightweight status bar with mode, branch, and file info
    Plugin 'vim-airline/vim-airline-themes'                              " Theme pack for vim-airline
    Plugin 'dracula/vim'                                                 " Dracula color scheme

    " --- Git ---
    Plugin 'airblade/vim-gitgutter'                                     " Show git diff markers (+/-/~) in the gutter

    " --- Autocomplete & Search ---
    Plugin 'AutoComplPop'                                               " Auto-trigger completion popup as you type
    Plugin 'junegunn/fzf'                                               " Fuzzy finder core (binary integration)
    Plugin 'junegunn/fzf.vim'                                           " Fuzzy finder vim commands (:Files, :Rg, :Buffers, etc.)

    call vundle#end()

    """""""""""""""""""""""""""""""""""""""""""""""""
    " Color Scheme
    """""""""""""""""""""""""""""""""""""""""""""""""
    try
        colorscheme dracula       " Primary color scheme — dark theme with good contrast
    catch
        colorscheme evening       " Fallback if Dracula is not installed
    endtry
  `);

  const contentVimrc = trimLeftSpaces(`
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
    filetype on                                                         " Re-enable filetype detection after Vundle init
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
    autocmd BufWritePre * %s/\\s\\+$//e

    " Whitespace visualization (toggled with ] key)
    set listchars=tab:>-          " Show tabs as >---
    set listchars+=space:␣        " Show spaces as ␣
    set listchars+=trail:·        " Show trailing spaces as ·
    set listchars+=eol:¬          " Show end-of-line as ¬

    """""""""""""""""""""""""""""""""""""""""""""""""
    " Display & UI
    """""""""""""""""""""""""""""""""""""""""""""""""
    syntax on                     " Enable syntax highlighting
    set showmatch                 " Briefly jump to matching bracket when inserting one
    set wildmenu                  " Show autocomplete menu for commands (Tab in command mode)
    set wildmode=longest:full,full " Complete to longest common string first, then cycle through matches
    set scrolloff=5               " Keep 5 lines visible above and below the cursor when scrolling
    set sidescrolloff=5           " Keep 5 columns visible to the left and right when scrolling horizontally
    set laststatus=2              " Always show the status bar (needed for vim-airline)
    set signcolumn=yes            " Always show the sign column — prevents layout shift from git/lint signs
    set shortmess+=I              " Suppress the intro message when starting vim
    set noshowmode                " Hide -- INSERT -- from the command line — airline already shows it
    set title                     " Set the terminal title to the current filename
    set ruler                     " Show cursor position (line, column) in the status bar

    " Highlight the active cursor line only in the focused window
    augroup CursorLineOnlyInActiveWindow
      autocmd!
      autocmd VimEnter,WinEnter,BufWinEnter * setlocal cursorline
      autocmd WinLeave * setlocal nocursorline
    augroup END

    """""""""""""""""""""""""""""""""""""""""""""""""
    " Keybindings — Toggle
    """""""""""""""""""""""""""""""""""""""""""""""""
    " \\ or [ to toggle line numbers
    nnoremap \\\\ :set nonumber!<CR>
    nnoremap [ :set nonumber!<CR>

    " ] to toggle whitespace visualization
    nnoremap ] :set list!<CR>

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

    " Ctrl-f to search file contents with ripgrep
    nnoremap <silent> <C-f> :Rg<CR>

    " ,b to list and switch between open buffers
    nnoremap <silent> ,b :Buffers<CR>

    " ,r to list recently opened files
    nnoremap <silent> ,r :History<CR>

    """""""""""""""""""""""""""""""""""""""""""""""""
    " Keybindings — Misc
    """""""""""""""""""""""""""""""""""""""""""""""""
    " ,n to clear search highlighting
    nnoremap <silent> ,n :nohlsearch<CR>

    " Y to yank from cursor to end of line (consistent with D and C)
    nnoremap Y y$

    " Keep cursor centered when jumping through search results
    nnoremap n nzzzv
    nnoremap N Nzzzv

    " Keep cursor centered when joining lines
    nnoremap J mzJ\`z

    " Move selected lines up/down in visual mode
    vnoremap J :m '>+1<CR>gv=gv
    vnoremap K :m '<-2<CR>gv=gv
  `);

  // write to build file
  writeToBuildFile([{ file: "vimrc", data: contentVimrc }]);

  targetPath = path.join(BASE_HOMEDIR_LINUX, ".vimrc");
  log(">> Setting up vimrc on Linux / Mac / WSL", targetPath);
  writeText(targetPath, contentOnlyFullVimrc + contentVimrc);

  if (is_os_window) {
    const windowsVimrcPath = path.join(getWindowUserBaseDir(), ".vimrc");
    if (filePathExist(windowsVimrcPath)) {
      log(">> Setting up vimrc on Windows", windowsVimrcPath);
      writeText(windowsVimrcPath, contentVimrc);
    } else {
      log(">> Skipped vimrc on Windows (file does not exist)", windowsVimrcPath);
    }
  }
}

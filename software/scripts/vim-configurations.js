async function doWork() {
  let targetPath;

  const contentOnlyFullVimrc = trimLeftSpaces(`
    " vundle stuffs
    set nocompatible
    filetype off
    set rtp+=~/.vim/bundle/Vundle.vim
    call vundle#begin()
    " =================================================

    Plugin 'airblade/vim-gitgutter'
    Plugin 'cakebaker/scss-syntax.vim'
    Plugin 'dracula/vim'
    Plugin 'isRuslan/vim-es6'
    Plugin 'jparise/vim-graphql'
    Plugin 'JulesWang/css.vim'
    Plugin 'leafgarland/typescript-vim'
    Plugin 'maxmellon/vim-jsx-pretty'
    Plugin 'mxw/vim-jsx'
    Plugin 'pangloss/vim-javascript'
    Plugin 'peitalin/vim-jsx-typescript'
    Plugin 'styled-components/vim-styled-components', { 'branch': 'main' }
    Plugin 'vim-airline/vim-airline'
    Plugin 'vim-airline/vim-airline-themes'
    Plugin 'VundleVim/Vundle.vim'
		Plugin 'AutoComplPop' " autocomplete pop
    " fzf vim
    Plugin 'junegunn/fzf'
    Plugin 'junegunn/fzf.vim'
    " =================================================
    call vundle#end()            " required

    " theme
    color dracula
  `);

  const contentVimrc = trimLeftSpaces(`
    " extension override
    au BufNewFile,BufRead *.cmp set filetype=xml
    au BufNewFile,BufRead *.app set filetype=xml
    au BufNewFile,BufRead *.scss set filetype=scss.css
    au BufNewFile,BufRead *.ts,*.js,*.tsx,*.jsx set filetype=typescript.tsx


    " tsx / react colors
    hi tsxTagName guifg=#EE0000
    hi tsxCloseString guifg=#F99575
    hi tsxCloseTag guifg=#F99575
    hi tsxCloseTagName guifg=#F99575
    hi tsxAttributeBraces guifg=#F99575
    hi tsxEqual guifg=#F99575
    hi tsxAttrib guifg=#F8BD7F cterm=italic
    hi tsxTypeBraces guifg=#999999
    hi tsxTypes guifg=#666666
    hi ReactState guifg=#C176A7
    hi ReactProps guifg=#D19A66
    hi ApolloGraphQL guifg=#CB886B
    hi Events ctermfg=204 guifg=#56B6C2
    hi ReduxKeywords ctermfg=204 guifg=#C678DD
    hi ReduxHooksKeywords ctermfg=204 guifg=#C176A7
    hi WebBrowser ctermfg=204 guifg=#56B6C2
    hi ReactLifeCycleMethods ctermfg=204 guifg=#D19A66



    """"""""""""""""""""""""""""""""""""""""""""""""
    " synax highlight options
    """"""""""""""""""""""""""""""""""""""""""""""""
    filetype on
    let g:airline#extensions#tabline#enabled = 1
    let g:airline#extensions#tabline#formatter = 'default'
    let g:airline#extensions#tabline#left_alt_sep = '|'
    let g:airline#extensions#tabline#left_sep = ' '
    let g:xml_syntax_folding = 1




    """"""""""""""""""""""""""""""""""""""""""""""""
    " editor options
    """"""""""""""""""""""""""""""""""""""""""""""""
    set shell=/bin/bash
    set hlsearch    " highlight all search results
    set ignorecase  " do case insensitive search
    set noswapfile  " disable swap file
    "set number      " display line number
    set showmatch

    " automatically remove whitespaces on save
    autocmd BufWritePre * %s/\s\+$//e

    " display tab as special char
    " For now - don't show special whitespace char in vim
    " instead toggle with ]
    "set list
    set listchars=tab:>-

    " display whitespace as a special char
    set listchars+=space:␣

    " tab stops
    set sts=2 sw=2 ts=2

    " always use spaces as indentation instead of tab
    set expandtab

    " set syntax highlight
    syntax on


    " highlight active vertical split with current row changes color
    " https://superuser.com/questions/385553/making-the-active-window-in-vim-more-obvious
    augroup CursorLineOnlyInActiveWindow
      autocmd!
      autocmd VimEnter,WinEnter,BufWinEnter * setlocal cursorline
      autocmd WinLeave * setlocal nocursorline
    augroup END




    """"""""""""""""""""""""""""""""""""""""""""""""
    " keyboard shortcuts
    """"""""""""""""""""""""""""""""""""""""""""""""
    " \ to toggle line number
    nnoremap \\ :set nonumber!<CR>
    nnoremap [ :set nonumber!<CR>

    " ] to show or hide special character
    nnoremap ] :set list!<CR>

    " to open a different file in split -
    " uses vim :e .
    " uses fzf :Files
    " ctrl x or ctrl q to close splits
    nnoremap <C-x> :q<CR>
    nnoremap <C-q> :q<CR>
    nnoremap <C-d> :vsplit<CR>
    "nnoremap <C-5> :split<CR>

    " comma s and v to do split
    nnoremap <silent> ,v :vsplit<CR>
    nnoremap <silent> ,5 :vsplit<CR>
    nnoremap <silent> ,s :split<CR>
    nnoremap <silent> ,d :split<CR>
    nnoremap <silent> ,w <c-w>q
    nnoremap <silent> ,x <c-w>q
    nnoremap <silent> ,t :Files<CR>

    " ctrl arrows to navigate split
    " https://stackoverflow.com/questions/7070889/remap-ctrl-arrowkeys-to-switch-between-split-buffers/7070942
    nnoremap <silent> <C-Right> <c-w>l
    nnoremap <silent> <C-Left> <c-w>h
    nnoremap <silent> <C-Up> <c-w>k
    nnoremap <silent> <C-Down> <c-w>j

    " fzf key bindings
    " https://dev.to/iggredible/how-to-search-faster-in-vim-with-fzf-vim-36ko
    nnoremap <silent> <C-t> :Files<CR>
  `);

  // write to build file
  writeToBuildFile([['vimrc', contentVimrc, false]]);

  targetPath = path.join(BASE_HOMEDIR_LINUX, '.vimrc');
  console.log('  >> Setting up vimrc on Linux / Mac / WSL', consoleLogColor4(targetPath));
  writeText(targetPath, contentOnlyFullVimrc + contentVimrc);

  if (is_os_window) {
    targetPath = path.join(getWindowUserBaseDir(), '.vimrc');
    if (fs.existsSync(targetPath)) {
      console.log('  >> Setting up vimrc on Windows', consoleLogColor4(targetPath));
      writeText(targetPath, contentVimrc);
    }
  }
}

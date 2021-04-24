async function doWork() {
  let targetPath;

  const contentOnlyFullVimrc = `
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
  `;

  const contentVimrc = `
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

    " options
    filetype on
    let g:airline#extensions#tabline#enabled = 1
    let g:airline#extensions#tabline#formatter = 'default'
    let g:airline#extensions#tabline#left_alt_sep = '|'
    let g:airline#extensions#tabline#left_sep = ' '
    let g:xml_syntax_folding = 1

    " editor options
    set shell=/bin/bash
    set hlsearch    " highlight all search results
    set ignorecase  " do case insensitive search
    set noswapfile  " disable swap file
    "set number      " display line number
    set showmatch


    " tab stops
    set sts=2 sw=2 ts=2
    syntax on

    " shortcut
    " \ to toggle line number
    nnoremap \\ :set nonumber!<CR>


		" to open a different file in split - 
			" uses vim :e . 
			" uses fzf :Files
    " ctrl v and ctrl h to create splits
    nnoremap <C-s> :split<enter>
    nnoremap <C-d> :vsplit<enter>

		" ctrl x or ctrl q to close splits
		nnoremap <silent> <C-x> <c-w>q
    nnoremap <silent> <C-q> <c-w>q

		" ctrl arrows to navigate split
		" https://stackoverflow.com/questions/7070889/remap-ctrl-arrowkeys-to-switch-between-split-buffers/7070942
    nnoremap <silent> <C-Right> <c-w>l
    nnoremap <silent> <C-Left> <c-w>h
    nnoremap <silent> <C-Up> <c-w>k
    nnoremap <silent> <C-Down> <c-w>j

    " fzf key bindings
    " https://dev.to/iggredible/how-to-search-faster-in-vim-with-fzf-vim-36ko
    nnoremap <silent> <C-t> :Files<CR>
	`;

  targetPath = path.join(BASE_HOMEDIR_LINUX, ".vimrc");
  console.log("  >> Setting up vimrc on Linux / Mac / WSL", targetPath);
  writeText(targetPath, contentOnlyFullVimrc + contentVimrc);

  if (is_os_window) {
    targetPath = path.join(getWindowUserBaseDir(), ".vimrc");
    if (fs.existsSync(targetPath)) {
      console.log("  >> Setting up vimrc on Windows", targetPath);
      writeText(targetPath, contentVimrc);
    }
  }
}

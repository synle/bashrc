/** Generates vimrc configuration with Vundle plugins, syntax highlighting, and keybindings for Linux, Mac, and Windows. */
async function doWork() {
  let targetPath;

  const contentOnlyFullVimrc = code`
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

    " --- LSP / Autocomplete ---
    Plugin 'neoclide/coc.nvim', { 'branch': 'release' }                 " LSP client with built-in autocomplete (replaces AutoComplPop); needs coc-settings.json (written by software/scripts/advanced/lsp/vim-coc.sh) and :CocInstall coc-tsserver coc-pyright ... for non-LSP-binary servers

    " --- Search ---
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

    """""""""""""""""""""""""""""""""""""""""""""""""
    " coc.nvim — LSP keymaps
    """""""""""""""""""""""""""""""""""""""""""""""""
    " Use tab to trigger completion and navigate suggestions
    inoremap <silent><expr> <Tab>
          \\ coc#pum#visible() ? coc#pum#next(1) :
          \\ "\\<Tab>"
    inoremap <expr><S-Tab> coc#pum#visible() ? coc#pum#prev(1) : "\\<C-h>"
    " <CR> to confirm completion
    inoremap <silent><expr> <CR> coc#pum#visible() ? coc#pum#confirm() : "\\<CR>"
    " Navigation
    nmap <silent> gd <Plug>(coc-definition)
    nmap <silent> gy <Plug>(coc-type-definition)
    nmap <silent> gi <Plug>(coc-implementation)
    nmap <silent> gr <Plug>(coc-references)
    " Hover documentation
    nnoremap <silent> K :call CocActionAsync('doHover')<CR>
    " Rename
    nmap <leader>rn <Plug>(coc-rename)
    " Code action
    nmap <leader>ca <Plug>(coc-codeaction)
    " Format selection
    xmap <leader>f  <Plug>(coc-format-selected)
  `;
  const contentVimrc = (await readText`software/scripts/vim-config-settings.vim`).trim();

  // write to build file
  await writeBuildArtifact([{ file: `${BUILD_DIR}/vimrc`, data: contentVimrc }]);

  targetPath = path.join(BASE_HOMEDIR_LINUX, ".vimrc");
  log(">> Setting up vimrc on Linux / Mac / WSL", targetPath);
  await backupConfigFile(targetPath);
  await writeText(targetPath, contentOnlyFullVimrc + contentVimrc);

  if (is_os_windows) {
    const windowsVimrcPath = path.join(getWindowUserBaseDir(), ".vimrc");
    if (pathExists(windowsVimrcPath)) {
      log(">> Setting up vimrc on Windows", windowsVimrcPath);
      await backupConfigFile(windowsVimrcPath);
      await writeText(windowsVimrcPath, contentVimrc);
    } else {
      log(">> Skipped vimrc on Windows (file does not exist)", windowsVimrcPath);
    }
  }
}

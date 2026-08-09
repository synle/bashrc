/** Generates vimrc configuration with vim-plug plugins, syntax highlighting, and keybindings for Linux, Mac, and Windows. */
// SOURCE software/scripts/advanced/editor.common.js

async function doWork() {
  let targetPath;

  // vim's no-install fallback scheme, sourced from the shared registry so the name is not
  // duplicated here. Used below when the vim-code-dark plugin is missing.
  const vimBuiltinColorScheme = getTheme("vim").dark;

  const contentOnlyFullVimrc = code`
    " ~/.vimrc

    """""""""""""""""""""""""""""""""""""""""""""""""
    " vim-plug Plugin Manager
    """""""""""""""""""""""""""""""""""""""""""""""""
    set nocompatible              " Disable vi compatibility — required for vim-plug and modern vim features
    filetype off                  " Turn off filetype detection temporarily — re-enabled after plug#end()
    call plug#begin('~/.vim/plugged')

    " --- Syntax & Language Support ---
    Plug 'pangloss/vim-javascript'                                    " Improved JavaScript syntax and indentation
    Plug 'isRuslan/vim-es6'                                           " ES6+ syntax highlighting (arrow functions, template strings, etc.)
    Plug 'maxmellon/vim-jsx-pretty'                                   " JSX/TSX syntax highlighting with pretty indentation
    Plug 'mxw/vim-jsx'                                                " JSX syntax support for React components
    Plug 'peitalin/vim-jsx-typescript'                                " TypeScript JSX (.tsx) syntax highlighting
    Plug 'leafgarland/typescript-vim'                                 " TypeScript syntax highlighting and indentation
    Plug 'styled-components/vim-styled-components', { 'branch': 'main' } " Syntax highlighting inside styled-components template literals
    Plug 'jparise/vim-graphql'                                        " GraphQL schema and query syntax highlighting
    Plug 'JulesWang/css.vim'                                          " Improved CSS syntax highlighting
    Plug 'cakebaker/scss-syntax.vim'                                  " SCSS/Sass syntax highlighting

    " --- UI & Status ---
    Plug 'vim-airline/vim-airline'                                     " Lightweight status bar with mode, branch, and file info
    Plug 'vim-airline/vim-airline-themes'                              " Theme pack for vim-airline
    Plug 'tomasiser/vim-code-dark'                                     " VS Code Default Dark+ palette — matches Sublime/Zed/VSCode 'Sy Dark' high-contrast palette

    " --- Git ---
    Plug 'airblade/vim-gitgutter'                                     " Show git diff markers (+/-/~) in the gutter

    " --- Search ---
    Plug 'junegunn/fzf'                                               " Fuzzy finder core (binary integration)
    Plug 'junegunn/fzf.vim'                                           " Fuzzy finder vim commands (:Files, :Rg, :Buffers, etc.)

    call plug#end()

    """""""""""""""""""""""""""""""""""""""""""""""""
    " Color Scheme
    """""""""""""""""""""""""""""""""""""""""""""""""
    try
        colorscheme codedark      " VS Code Default Dark+ palette — high contrast, matches Sy Dark in Sublime/Zed/VSCode
    catch /^Vim\\%((\\a\\+)\\)\\=:E185/
        " E185 = colorscheme not found. Loud warning so a missing vim-code-dark install
        " (e.g. vim-plug.sh never ran, or PlugInstall failed) is visible instead of
        " a silent fallback that looks like codedark "just doesn't work".
        echohl WarningMsg
        echom "codedark colorscheme not found — run: bash run.sh --files=vim-plug.sh"
        echohl None
        colorscheme ${vimBuiltinColorScheme}      " Fallback (vim built-in, high contrast) if vim-code-dark is not installed
    endtry
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

/** Generates vimrc configuration with vim-jetpack plugins, syntax highlighting, and keybindings for Linux, Mac, and Windows. */
// SOURCE software/scripts/advanced/editor.common.js

async function doWork() {
  let targetPath;

  // vim's no-install fallback scheme, sourced from the shared registry so the name is not
  // duplicated here. Used below when the vim-code-dark plugin is missing.
  const vimBuiltinColorScheme = getTheme("vim").dark;

  const contentOnlyFullVimrc = code`
    " ~/.vimrc

    """""""""""""""""""""""""""""""""""""""""""""""""
    " vim-jetpack Plugin Manager
    "
    " Install vim-jetpack + every plugin below (one line, from scratch; Windows: ~/vimfiles):
    "   mkdir -p ~/.vim && curl -fsSLo ~/.vim/pack/jetpack/opt/vim-jetpack/plugin/jetpack.vim --create-dirs https://raw.githubusercontent.com/tani/vim-jetpack/master/plugin/jetpack.vim && vim -E -s -u ~/.vimrc +JetpackSync +qall
    " Opening vim also self-bootstraps: it fetches jetpack.vim when missing (needs curl)
    " and runs :JetpackSync when a declared plugin is not installed yet.
    " Update / clean later: :JetpackSync
    """""""""""""""""""""""""""""""""""""""""""""""""
    set nocompatible              " Disable vi compatibility — required for plugin managers and modern vim features
    filetype off                  " Turn off filetype detection temporarily — re-enabled after jetpack#end()

    " First packpath entry is ~/.vim on mac/linux, ~/vimfiles on Windows — same place jetpack#begin() uses.
    let s:jetpack_home = split(&packpath, ',')[0]
    let s:jetpack_file = s:jetpack_home . '/pack/jetpack/opt/vim-jetpack/plugin/jetpack.vim'
    if !filereadable(s:jetpack_file) && executable('curl')
      call system('curl -fsSLo ' . shellescape(s:jetpack_file) . ' --create-dirs https://raw.githubusercontent.com/tani/vim-jetpack/master/plugin/jetpack.vim')
    endif
    " Minimal shells (browser terminals, iVim) often lack git — let jetpack fetch tarballs with curl instead.
    if !executable('git')
      let g:jetpack_download_method = 'curl'
    endif
    silent! packadd vim-jetpack

    if exists('*jetpack#begin')
      call jetpack#begin()
      Jetpack 'tani/vim-jetpack', { 'opt': 1 }                          " Self-manage so :JetpackSync keeps the manager updated

      " --- Syntax & Language Support ---
      Jetpack 'pangloss/vim-javascript'                                 " Improved JavaScript syntax and indentation
      Jetpack 'isRuslan/vim-es6'                                        " ES6+ syntax highlighting (arrow functions, template strings, etc.)
      Jetpack 'maxmellon/vim-jsx-pretty'                                " JSX/TSX syntax highlighting with pretty indentation
      Jetpack 'mxw/vim-jsx'                                             " JSX syntax support for React components
      Jetpack 'peitalin/vim-jsx-typescript'                             " TypeScript JSX (.tsx) syntax highlighting
      Jetpack 'leafgarland/typescript-vim'                              " TypeScript syntax highlighting and indentation
      Jetpack 'styled-components/vim-styled-components', { 'branch': 'main' } " Syntax highlighting inside styled-components template literals
      Jetpack 'jparise/vim-graphql'                                     " GraphQL schema and query syntax highlighting
      Jetpack 'JulesWang/css.vim'                                       " Improved CSS syntax highlighting
      Jetpack 'cakebaker/scss-syntax.vim'                               " SCSS/Sass syntax highlighting

      " --- UI & Status ---
      Jetpack 'itchyny/lightline.vim'                                   " Light, fast status line (replaces vim-airline)
      Jetpack 'mengelbrecht/lightline-bufferline'                       " Open buffers as tabs in the top line (airline tabline parity)
      Jetpack 'tomasiser/vim-code-dark'                                 " VS Code Default Dark+ palette (+ lightline theme) — matches Sublime/Zed/VSCode 'Sy Dark'

      " --- Git ---
      Jetpack 'mhinz/vim-signify'                                       " Diff markers (+/-/~) in the gutter; lighter than gitgutter, any VCS

      " --- Search ---
      Jetpack 'junegunn/fzf'                                            " Fuzzy finder core (binary integration)
      Jetpack 'junegunn/fzf.vim'                                        " Fuzzy finder vim commands (:Files, :Rg, :Buffers, etc.)

      " --- Editing ---
      Jetpack 'mg979/vim-visual-multi', { 'branch': 'master' }          " Sublime-style multi-cursor (select all matches, cursor per line)

      call jetpack#end()

      " Install anything declared but missing (first run, or after adding a Jetpack line).
      for s:name in jetpack#names()
        if !jetpack#tap(s:name)
          call jetpack#sync()
          break
        endif
      endfor
    else
      echohl WarningMsg
      echom "vim-jetpack not found (no curl?) — plugins disabled. See the install line at the top of ~/.vimrc"
      echohl None
    endif

    """""""""""""""""""""""""""""""""""""""""""""""""
    " Color Scheme
    """""""""""""""""""""""""""""""""""""""""""""""""
    try
        colorscheme codedark      " VS Code Default Dark+ palette — high contrast, matches Sy Dark in Sublime/Zed/VSCode
    catch /^Vim\\%((\\a\\+)\\)\\=:E185/
        " E185 = colorscheme not found. Loud warning so a missing vim-code-dark install
        " (e.g. vim-jetpack.sh never ran, or JetpackSync failed) is visible instead of
        " a silent fallback that looks like codedark "just doesn't work".
        echohl WarningMsg
        echom "codedark colorscheme not found — run: bash run.sh --files=vim-jetpack.sh"
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

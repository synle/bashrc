/** Generates vimrc configuration with vim-jetpack plugins, syntax highlighting, and keybindings for Linux, Mac, and Windows. */
// SOURCE software/scripts/advanced/editor.common.js

/** Maximum on-disk file size in KiB before disabling buffer-local syntax highlighting. */
const VIM_SYNTAX_MAX_FILE_SIZE_KB = 8192;
/** Maximum syntax redraw time per window, in milliseconds; this does not limit file loading or plugins. */
const VIM_REDRAW_TIME_MS = 6000;

/**
 * Renders canonical Vim highlight, terminal, and Lightline data without a second palette mapping.
 * @param {"dark"|"light"} mode - Target appearance.
 * @returns {Promise<string>} Native Vimscript; this renderer reads sources but writes no files.
 * @throws {Error} For invalid group names, colors, attributes, ANSI entries, or status-line pairs.
 */
async function _buildVimTheme(mode) {
  const theme = await readSyTheme("vim", mode);
  const isHex = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  const isColor = (value) => value === "NONE" || isHex(value);
  const groups = theme.highlights;
  if (!groups || typeof groups !== "object" || Array.isArray(groups) || Object.keys(groups).length === 0) {
    throw new Error(`Invalid Vim ${mode} theme: expected named highlight groups`);
  }
  const styles = ["NONE", "underline", "undercurl", "bold", "italic", "reverse"];
  const lines = [];
  for (const [name, group] of Object.entries(groups)) {
    if (
      !/^[A-Za-z][A-Za-z0-9_]*$/.test(name) ||
      !group ||
      typeof group !== "object" ||
      !isColor(group.foreground) ||
      !isColor(group.background) ||
      !styles.includes(group.style) ||
      (group.special !== undefined && !isColor(group.special))
    ) {
      throw new Error(`Invalid Vim ${mode} highlight: expected a safe group, color pair, and supported style`);
    }
    const special = group.special === undefined ? "" : ` guisp=${group.special}`;
    const cterm = group.style === "undercurl" ? "underline" : group.style;
    lines.push(`highlight ${name} guifg=${group.foreground} guibg=${group.background}${special} gui=${group.style} cterm=${cterm}`);
  }
  if (!Array.isArray(theme.terminal) || theme.terminal.length !== 16 || !theme.terminal.every(isHex)) {
    throw new Error(`Invalid Vim ${mode} theme: expected sixteen terminal colors`);
  }
  const lightline = theme.lightline;
  if (
    !lightline ||
    typeof lightline !== "object" ||
    Array.isArray(lightline) ||
    !lightline.normal ||
    !Object.values(lightline).every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        !Array.isArray(entry) &&
        Object.values(entry).every(
          (segments) => Array.isArray(segments) && segments.every((pair) => Array.isArray(pair) && pair.length === 2 && pair.every(isHex)),
        ),
    )
  ) {
    throw new Error(`Invalid Vim ${mode} theme: expected Lightline color pairs`);
  }
  return [
    '" Generated from theme/sy/vim_' + mode + ".jsonc. Do not edit.",
    "highlight clear",
    "if exists('syntax_on') | syntax reset | endif",
    `let g:colors_name = 'sy-${mode}'`,
    ...lines,
    `let g:terminal_ansi_colors = ${JSON.stringify(theme.terminal)}`,
    `let g:sy_lightline_palette = ${JSON.stringify(lightline)}`,
    "",
  ].join("\n");
}

/**
 * Deploys both Sy schemes and selects the matching family on manual changes and terminal background replies.
 * Refreshes terminal background detection on terminal, split, and tab focus; Ayu installation remains unconditional in the caller.
 * @param {string[]} vimFolders - Native Vim runtime folders to receive colors/*.vim.
 * @returns {Promise<string>} Vimscript selecting Sy or registry fallback; IO and palette errors propagate.
 */
async function _doVimTheme(vimFolders) {
  const useCustomTheme = shouldInstallCustomTheme("terminal");
  const fallback = getTheme("vim");
  if (useCustomTheme || IS_CI) {
    // Render both before writing either so malformed light data cannot leave a partial deployment.
    const dark = await _buildVimTheme("dark");
    const light = await _buildVimTheme("light");
    await writeBuildArtifact([
      { file: `${BUILD_DIR}/vim-theme-dark`, data: dark },
      { file: `${BUILD_DIR}/vim-theme-light`, data: light },
    ]);
    if (useCustomTheme) {
      for (const folder of vimFolders) {
        const colorsFolder = path.join(folder, "colors");
        await mkdir(colorsFolder);
        await backupConfigFile(path.join(colorsFolder, "sy-dark.vim"));
        await writeText(path.join(colorsFolder, "sy-dark.vim"), dark);
        await backupConfigFile(path.join(colorsFolder, "sy-light.vim"));
        await writeText(path.join(colorsFolder, "sy-light.vim"), light);
      }
    }
  }
  return code`
    " Select the configured family from the current background; Ayu stays installed in both modes.
    let s:use_custom_theme = ${useCustomTheme ? 1 : 0}
    let s:theme_fallbacks = {'dark': ${JSON.stringify(fallback.dark)}, 'light': ${JSON.stringify(fallback.light)}}
    let s:applying_theme = 0
    " Apply one appearance without recursively reacting to colorscheme background changes.
    function! s:ApplyColorScheme() abort
      if s:applying_theme | return | endif
      let s:applying_theme = 1
      let l:appearance = &background
      let g:ayucolor = l:appearance
      let l:scheme = s:use_custom_theme ? 'sy-' . l:appearance : s:theme_fallbacks[l:appearance]
      try
        try
          execute 'colorscheme ' . l:scheme
        catch /^Vim\\%((\\a\\+)\\)\\=:E185/
          echohl WarningMsg
          echom 'Theme missing: ' . l:scheme . '; using Ayu. Run bash run.sh --files=vim-jetpack.sh'
          echohl None
          try
            execute 'colorscheme ' . s:theme_fallbacks[l:appearance]
          catch /^Vim\\%((\\a\\+)\\)\\=:E185/
            echohl WarningMsg
            echom 'Ayu unavailable; using emergency built-in industry theme'
            echohl None
            colorscheme industry
          endtry
        endtry
        if exists('*SyLightlineSetModeColors') | call SyLightlineSetModeColors() | endif
      finally
        let s:applying_theme = 0
      endtry
    endfunction
    if has('termguicolors') | set termguicolors | endif
    augroup SyThemeAppearance
      autocmd!
      " Allow the selected colorscheme's syntax and Lightline hooks to run inside this event.
      autocmd OptionSet background ++nested call <SID>ApplyColorScheme()
      " colorresp changes background inside a non-nested event, which suppresses OptionSet.
      if exists('##TermResponseAll')
        autocmd TermResponseAll background ++nested call <SID>ApplyColorScheme()
      endif
      " Refresh on terminal focus and Vim split/tab entry; no continuous appearance subscription is required.
      if exists('*echoraw') && exists('+t_RB')
        autocmd FocusGained,WinEnter,TabEnter * if !has('gui_running') | call echoraw(&t_RB) | endif
      endif
    augroup END
    call s:ApplyColorScheme()
  `;
}

/**
 * Deploys Vim plugins, shared settings, syntax limits, generated palettes, and selection to each existing platform target.
 * @returns {Promise<void>} Resolves after backups and writes; theme/source IO errors propagate.
 */
async function doWork() {
  /** @type {{file: string, folder: string}[]} Native configuration and runtime folder pairs. */
  const targets = [{ file: path.join(BASE_HOMEDIR_LINUX, ".vimrc"), folder: path.join(BASE_HOMEDIR_LINUX, ".vim") }];
  if (is_os_windows) {
    const windowsHome = getWindowUserBaseDir();
    const windowsVimrc = path.join(windowsHome, ".vimrc");
    if (pathExists(windowsVimrc)) targets.push({ file: windowsVimrc, folder: path.join(windowsHome, "vimfiles") });
    else log(">> Skipped vimrc on Windows (file does not exist)", windowsVimrc);
  }
  const themeContent = await _doVimTheme(targets.map((target) => target.folder));

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

    " Vim (not Neovim) can hit E517 inside jetpack#execute's scratch-buffer path.
    " Force a temp-file execute path to avoid startup interruption prompts.
    if exists('*jetpack#execute') && !has('nvim')
      function! jetpack#execute(code) abort
        let s:jetpack_temp = tempname()
        call writefile(split(a:code, "\n"), s:jetpack_temp)
        execute 'source ' . fnameescape(s:jetpack_temp)
        call delete(s:jetpack_temp)
      endfunction
    endif

    if exists('*jetpack#begin')
      call jetpack#begin()
      Jetpack 'tani/vim-jetpack', { 'opt': 1 }                          " Self-manage so :JetpackSync keeps the manager updated

      " --- Syntax & Language Support ---
      Jetpack 'pangloss/vim-javascript'                                 " Improved JavaScript syntax and indentation
      Jetpack 'maxmellon/vim-jsx-pretty'                                " JSX/TSX syntax highlighting with pretty indentation
      Jetpack 'peitalin/vim-jsx-typescript'                             " TypeScript JSX (.tsx) syntax highlighting
      Jetpack 'leafgarland/typescript-vim'                              " TypeScript syntax highlighting and indentation
      Jetpack 'styled-components/vim-styled-components', { 'branch': 'main' } " Syntax highlighting inside styled-components template literals
      Jetpack 'jparise/vim-graphql'                                     " GraphQL schema and query syntax highlighting
      Jetpack 'JulesWang/css.vim'                                       " Improved CSS syntax highlighting
      Jetpack 'cakebaker/scss-syntax.vim'                               " SCSS/Sass syntax highlighting

      " --- UI & Status ---
      Jetpack 'itchyny/lightline.vim'                                   " Light, fast status line (replaces vim-airline)
      Jetpack 'mengelbrecht/lightline-bufferline'                       " Open buffers as tabs in the top line (airline tabline parity)
      Jetpack 'ayu-theme/ayu-vim'                                      " Always install Ayu dark/light, even when Sy themes are selected

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

  `;
  const contentVimrc = (await readText`software/scripts/vim-config-settings.vim`).trim();
  /** Vim-only limits; register after filetype and syntax setup so detection cannot override the size guard. */
  const performanceContent = code`
    " --- Syntax Performance ---
    " Limit syntax redraw per window; file loading and plugin execution have separate costs.
    set redrawtime=${VIM_REDRAW_TIME_MS}
    " Preserve filetype detection and small-buffer highlighting; only files above the KiB limit opt out.
    augroup SyLargeFiles
      autocmd!
      autocmd BufReadPost *
            \\ if getfsize(expand('<afile>')) > ${VIM_SYNTAX_MAX_FILE_SIZE_KB} * 1024 |
            \\   setlocal syntax=OFF |
            \\ endif
    augroup END
  `;

  /** Complete generated vimrc, including buffer-local syntax protection. */
  const content = [contentOnlyFullVimrc, contentVimrc, performanceContent, themeContent].join("\n");
  await writeBuildArtifact([{ file: `${BUILD_DIR}/vimrc`, data: content }]);
  for (const target of targets) {
    log(">> Setting up vimrc", target.file);
    await backupConfigFile(target.file);
    await writeText(target.file, content);
  }
}

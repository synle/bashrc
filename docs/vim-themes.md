# Vim themes

Vim always declares `ayu-theme/ayu-vim` through Jetpack, regardless of custom-theme selection.
One plugin provides dark and light appearances through `g:ayucolor` and the native `ayu` colorscheme.
`APP_TO_THEMES_MAP.vim` therefore contains one fallback name, reused for both appearances.

## Selection

The setup generator reuses `shouldInstallCustomTheme("terminal")` from `software/scripts/advanced/editor.common.js`, including SSH/headless terminal sessions.
When enabled, it deploys `sy-dark.vim` and `sy-light.vim` into each target's native colors folder.
When custom themes are disabled, it selects the installed Ayu theme instead.
The flag never removes Ayu's Jetpack declaration.

`theme/sy/vim_dark.jsonc` and `vim_light.jsonc` store native highlight groups, terminal ANSI colors, and Lightline data with shared `COLOR_MAP` markers.
For new highlight or status-line features, follow `theme/README.md` → Required workflow for new feature colors.
Reuse or add a role in both shared foundations, bind it in both Vim templates, and run `make format_build_include`.
The Vim renderer converts that data to native commands; do not add hex colors or another palette to the renderer.
Lightline uses the same generated Sy palette or Ayu's supplied palette.
TSX and React groups link to standard syntax roles rather than independent hex overrides.

Vim's current `background` selects the appearance. Change it with `:set background=dark` or `:set background=light`.
The configuration reapplies the selected family and Lightline after an appearance change.
This does not add terminal or operating-system appearance detection.
If the selected scheme is missing, Vim warns and attempts Ayu; if Ayu is also missing, it warns and uses built-in `industry`.

## Deployment

Run the narrow command:

```bash
bash run.sh --files="vim-config.js,vim-jetpack.sh"
```

The broad alternative is `bash run.sh --preset=editors`.
The generator backs up existing configurations and writes the same complete configuration to existing Windows targets.
Native runtime folders are `~/.vim` on Unix-like systems and `~/vimfiles` for the existing Windows target.

Use the existing opt-out to select Ayu while keeping it installed in both modes:

```bash
IS_CUSTOM_THEME_DISABLED=1 bash run.sh --files="vim-config.js,vim-jetpack.sh"
```

The installer waits for Jetpack synchronization in the foreground.
It does not manually delete old plugin folders; package-manager cleanup owns retired dependencies.

## Upstream caveat

The Ayu Vim README requests a maintainer. Verify the installed plugin against the supported Vim versions when changing it.
The implementation uses its native dark/light selection and bundled Lightline palette, not a separate Ayu color copy.

# Vim themes

Vim always declares `ayu-theme/ayu-vim` through Jetpack, regardless of custom-theme selection.
One plugin provides dark and light appearances through `g:ayucolor` and the native `ayu` colorscheme.
`APP_TO_THEMES_MAP.vim` therefore contains one fallback name, reused for both appearances.

## Selection

The setup generator reuses `shouldInstallCustomTheme()` from `software/scripts/advanced/editor.common.js`.
When enabled, it deploys `sy-dark.vim` and `sy-light.vim` into each target's native colors folder.
When disabled or headless, it selects the installed Ayu theme instead.
The flag never removes Ayu's Jetpack declaration.

`software/scripts/vim-color-dark.jsonc` and `vim-color-light.jsonc` bind Sy colors to shared `COLOR_MAP` placeholders.
Run `make format_build_include` after changing their marker mappings or shared colors.
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

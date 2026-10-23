# Shared Sy themes and baseline references

`sy/` contains active theme sources. `baseline/` contains immutable reference captures; it is not deployment configuration.

## Ownership

- `sy/_palette_dark.jsonc` and `sy/_palette_light.jsonc` are the only foundation palettes.
- `software/tools/build-include.js` resolves foundation recipes and renders application color markers.
- `sy/<app>_<dark|light>.jsonc` contains native-shaped configuration or the documented Vim/terminal renderer input.
- `baseline/` preserves the earlier reference captures, including inline non-JSON source and explicit unavailable exports.
- `manifest.jsonc` preserves reference provenance and checksums. Mutable Sy sources are validated by tests and generation, not snapshot hashes.
- `AUDIT.md`, `audit.jsonc`, and `mappings.jsonc` retain the historical audit evidence and original proposals. Current source and regression tests supersede proposal status.

Supported setup consumers read canonical active sources directly. Legacy app-specific Sy JSONC inputs are removed; existing generated/native output names remain stable.
Pi, OpenCode, and Gemini preserve explicit foreign selections. GUI defaults retain display gating; terminal consumers support SSH/headless use.
Termux defaults to dark; `TERMUX_THEME_MODE=light` selects its light source on Termux. Native automatic switching is not assumed.

## Foundation recipes

Foundation values are six-digit hex colors or validated references/compositing recipes:

```jsonc
{
  "themeName": "Example",
  "foreground": "#e8e8e8",
  "brightBlack": "#a0a0a0",
  "background": "#0a0a0a",
  "brightGray": "#6e6e6e",
  "textSecondary": { "from": "foreground", "over": "brightBlack", "alpha": 0.25 },
  "terminalBlack": { "ref": "brightGray" },
}
```

References can point forward. Unknown roles, cycles, malformed objects, invalid colors, mismatched appearance roles, and alpha outside `[0, 1]` fail generation.

The compiler derives `_R`, `_G`, `_B` channels, `_alpha0` through `_alpha100` in ten-percent steps, plus `_alpha5` and `_alpha15`.

It also derives `_tint10`, `_tint20`, `_shade10`, and `_shade20`. Variants are generated once from resolved colors, not recursively from other variants.

Normal foregrounds retain the existing contrast policies. Semantic backgrounds and terminal anchors have separate, tested roles; never treat a fill as a text color.

## Color markers

Change the role comment or foundation recipe, not an application's generated hex literal:

```jsonc
{
  "foreground": "#4fc1ff", // {{dark.brightBlue}}
  "placeholder": "#b2b2b2", // {{dark.textSecondary}}
  "border": "#5ca0d733", // {{dark.blue_alpha20}}
}
```

An empty string before a marker is also a valid seed. The compiler replaces it and preserves the comment for subsequent regeneration.

Display names use `// {{dark.themeName}}` or `// {{light.themeName}}`. Font-style and weight siblings are never interpreted as colors.

For strings containing several colors, preserve the original recipe in a string-template comment:

```jsonc
{
  "popup_css": "", // {{template: "html { color: {{dark.foreground}}; background-color: {{dark.surface}}; }"}}
}
```

The comment remains after rendering. Later foundation edits can therefore regenerate every embedded color without retaining stale CSS literals.

## Generate and check

From the repository root:

```bash
make format_build_include
npx vitest run --config vitest.config.js software/tests/themePalette.spec.js software/tests/themeMarkers.spec.js software/tests/themeTemplates.spec.js software/tests/themeCli.spec.js
```

For one template:

```bash
node software/tools/build-include.js theme/sy/vscode_dark.jsonc
```

Explicit targets work without a Git checkout. Automatic discovery combines tracked files and active Sy templates, including templates not yet staged.

Foundation inputs, reference captures, and historical audit/metadata files are excluded even when supplied explicitly. All active inputs are checked before any template is rewritten.

## Source-path migration

Legacy Sy color inputs outside this folder are removed. Update source consumers as follows; native and generated output filenames remain unchanged.

| Previous source                                                  | Canonical source                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| `software/scripts/advanced/vs-code-color-<mode>.jsonc`           | `theme/sy/vscode_<mode>.jsonc`                         |
| `software/scripts/advanced/sublime-text-color-<mode>.jsonc`      | `theme/sy/sublime_<mode>.jsonc`                        |
| `software/scripts/advanced/zed-color-<mode>.jsonc`               | `theme/sy/zed_<mode>.jsonc`                            |
| `software/scripts/advanced/ghostty-color-<mode>.jsonc`           | `theme/sy/ghostty_<mode>.jsonc`                        |
| `software/scripts/advanced/llm/claude/claude-color-<mode>.jsonc` | `theme/sy/claude_<mode>.jsonc`                         |
| `software/scripts/vim-color-<mode>.jsonc`                        | `theme/sy/vim_<mode>.jsonc`                            |
| `software/scripts/android_termux/termux-color-dark.jsonc`        | `theme/sy/termux_dark.jsonc` and the new light variant |

Claude sources now contain native `name/base/overrides` objects instead of a second intermediate palette.
Vim sources contain `highlights/terminal/lightline` renderer data instead of a flat palette.
Windows Terminal schemes formerly embedded in its setup script now come from `theme/sy/windows_terminal_<mode>.jsonc`.

The self-extracting installer bundles `theme/sy/` so these sources remain available offline. Baseline references and historical audit payloads are not bundled.

## Native shapes and capability limits

- VS Code, Sublime, Zed, Windows Terminal, Claude, Pi, OpenCode, and Gemini sources retain their application-specific shapes.
- Vim stores highlight groups, terminal ANSI colors, and Lightline data in JSONC; its setup script renders native Vimscript.
- Ghostty and Termux store terminal palette data in JSONC; their setup scripts render native config/properties syntax.
- Pi and OpenCode role sets are checked against the captured native reference definitions.
- Pi selector checks model the native session/tree renderer: accent, dim, muted, warning, and error foregrounds must stay readable after selected-row background wrapping.
- Pi uses syntax-preserving selection and readable secondary text; its light selection adds the generated tint required by the warning-text contrast check.
- Copilot custom theme import was not verified. Its Sy records remain explicit capability gaps, not invented native themes.
- A Termux light source exists, but native automatic light/dark switching is not assumed.

Static contrast checks do not prove native rendering under transparency, dimming, selection precedence, remote terminals, or unsupported app versions.

## Baseline licensing and integrity

Baseline files retain short, left-aligned license comments of at most four lines. Full-text source links and unresolved redistribution reviews remain in `manifest.jsonc`.

Sublime native references are local-only backups with unverified redistribution terms. Collection licensing does not automatically settle each Ghostty theme's individual rights.

Short attribution does not establish that all redistribution conditions are satisfied. No new license is inferred for Sy source that has no declared repository license.

The baseline reference bytes and their original source hashes remain unchanged. Active template literals are intentionally regenerated and are not immutable backups.

## Implementation plan

The canonical implementation plan follows the loaded external-placement rule:

`/Users/syle/_extra/ai_llm/plans/bashrc-theme_pipeline_integration.md`

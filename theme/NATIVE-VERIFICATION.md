# Native theme verification

Evidence below separates effective configuration, source-modeled composition, and native visual rendering. A parser pass never certifies a screenshot.

## Opacity and dimming

### Contracts inspected

- Ghostty 1.3.1: `+show-config --default --docs` describes inactive dimming as an overlay covering the split, not foreground-only alpha.
- Ghostty uses `1 - unfocused-split-opacity` as the fill overlay contribution. Background opacity also affects explicit cell backgrounds when `background-opacity-cells` is true.
- Ghostty's documented macOS blending default is native Display P3; Linux defaults to linear-corrected. The regression screen checks both sRGB-channel and linear-light composition.
- Zed 1.23.2: `crates/editor/src/display_map.rs` applies `unnecessary_code_fade` to unnecessary diagnostic chunks.
- Zed's `crates/gpui/src/style.rs` applies that fade to the text color; `crates/gpui/src/color.rs` multiplies alpha by `1 - factor`.

Sources: https://ghostty.org/docs/config/reference and the matching installed-version upstream source files. Source captures and probe logs live beside the external implementation plan.

### Reproduction and changes

Previous settings were background opacity 0.9, inactive opacity 0.65, cursor opacity 0.8, and Zed fade 0.4.
The sRGB byte-composition probe found minimum inactive ANSI text ratios of 3.04:1 dark and 2.79:1 light over adverse desktops.
Zed faded syntax over editor/active-line/search/selection fills reached 2.53:1 dark and 2.39:1 light.

Ghostty now uses background opacity **0.99**, inactive opacity **0.98**, and cursor opacity **1**.
This retains slight transparency and focus tint without the strong overlay that washed out text.
Zed fade is **0**; diagnostic underlines remain, while syntax colors retain their original alpha.
No foundation color or application color binding changed.

### Regression scope

`software/tests/themeComposition.spec.js` renders the real Ghostty configuration before measuring it.
It checks both appearances, black/gray/white desktop backdrops, active/inactive ANSI text, explicit selection fills, and block cursor text.
Zed checks every explicit syntax color over editor, active-line, search, active-search, and local selection fills.
The state-pair screening floor is 4.5:1; ANSI black retains its existing 3:1 anchor floor, and the existing white-anchor exceptions remain explicit.
Opaque normal-text palette policies remain unchanged; passing these screens does not claim composed AAA text.

All eight new tests fail with the original settings after fixture setup, and pass with the changes.
The initial Ghostty test attempt also exposed an absent keybinding fixture; that setup error was corrected before the both-directions run.

### Remaining visual verification

Actual split focus, cursor glyph antialiasing, macOS Display P3 conversion, and desktop compositor rendering remain unverified.
A real GUI/device capture must establish these before the opacity audit can be fully closed.

## Remaining component coverage

### Sublime 4200

A temporary plugin created scratch views using the deployed Sy schemes and four installed grammars.
Native `scope_name`, `style`, and `style_for_scope` returned 23 JavaScript, 21 Python, 12 HTML, and 14 CSS scope stacks per appearance.
Of those 70 stacks, 25 match the global foreground; 21 actually inherit it, confirmed by native `source_line = -1`.
Four explicit rules intentionally use the same foreground. Equal colors alone do not prove inheritance.
The captured find and selection foregrounds resolve to the configured Sy foreground, including native variable resolution.

Native `ui_info` reports Adaptive with the Sy Light scheme, and preferences resolve the default rounded tab style.
The installed Adaptive resource separately defines sidebar/tab/control colors, brightness attributes, hover/selected/disabled conditions, textures, and label opacity.
Those chrome rules are not controlled by the scheme's arbitrary variable names.
The snapshot records inspected classes and states without copying the proprietary Adaptive definition.

**Remaining:** native resolved element colors, texture alpha, hover/focus combinations, and visual captures.
The scope API does not expose those chrome pixels. An attempted newly generated color-resource probe was inconclusive and was excluded from accepted observations.
No speculative Adaptive override was added.

### Full Vim startup

Vim 9.1.1752 loaded the complete deployed vimrc with installed Jetpack, Signify, and Lightline.
After native Signify highlight setup, dark/light/dark switches preserve DiffAdd/DiffChange/DiffDelete links and the Sy Lightline palette.
The persistent integration spec runs both initial appearances and three switches each against the complete generated vimrc.
It requires an explicit installed plugin root and fails before launch if required plugin folders or manifest entries are absent.
Without that opt-in, the two native integration cases are explicitly skipped; standalone Vim tests remain separate.

Appearance refresh queries the terminal on `FocusGained`, `WinEnter`, and `TabEnter`.
`CursorHold` and `CursorHoldI` query again after navigation pauses, using the shared 300 ms `updatetime` without polling an untouched editor.
Native navigation checks execute actual split/tab switches and normal/insert input before observing the emitted background query.
The probe keeps stdin open, reports Vim exceptions, and checks both process status and persisted results.
Accepted startup observations were recaptured after the color-response opt-out was removed; only the settings hash changed.

The current settings fingerprint was revalidated after later indentation and picker changes, using the same installed Vim and plugins.
The opt-in probe now compares every recorded group's resolved foreground, background, and target after each appearance switch.
Both initial appearances preserve all eleven recorded groups, Signify startup, and Lightline startup; only the accepted settings fingerprint needed refreshing.
The static source-hash guard remains unchanged and continues to reject stale evidence.
These checks do not establish live Ghostty/macOS appearance notifications or desktop rendering.

The initial apparent Signify defect came from inspecting uninitialized groups, not a lost-link regression.
Native default links survive highlight clearing, so no production Vim fix was needed.
CursorLineConceal appears only in the installed Ayu definition; installed plugins and Vim runtime contain no other consumer.
It remains a reference-only group, not a reason to copy unused NERDTree/GitGutter mappings.

**Remaining:** actual asynchronous VCS hunk creation, terminal glyph rendering, and every plugin-specific interaction.

### Repeatable component/state crosswalk

```bash
node software/tools/theme-component-crosswalk.js
```

The command inventories active components and captured reference components for all twelve application identities in both appearances.
It emits native key/selector identities, named key states, active/reference presence, and explicit unverified/reference-only dispositions.
The accepted run contains **2,749 appearance-specific component entries**, including **2,228 active entries**.
These are inventory counts, not contrast tests, native-schema completeness, or defect counts.
Captured-only keys may inherit through broader selectors, belong to absent plugins, or require further investigation.
Gemini's reference palette/syntax representation remains distinct from its active native controls rather than receiving an invented mapping.
Copilot remains an empty capability-limit inventory, not fictional native components.

The report contains no baseline color values or source text, so it does not redistribute the local-only references.
Full native schema unions and reachable state combinations remain open; the crosswalk makes that boundary explicit.

## Native token consumption

### VS Code 1.138.0

A dedicated Electron profile exposed the actual installed ColorThemeData engine through a local debugger.
The probe used the installed constructor and canonical source settings under matching bracketed theme names.
All four configured semantic types resolve through settings: newOperator, stringLiteral, customLiteral, and numberLiteral.
Fifteen standard types resolve through configured TextMate fallbacks, including class, variable, parameter, property, function, method, string, number, operator, and keyword.
A foreign-theme selector negative control removes the custom newOperator value.
Native source confirms semantic settings take precedence over equal-specificity theme rules; missing properties can use registered TextMate fallback scopes.
This does not mean every semantic type needs a redundant explicit override.

**Remaining:** every language-provider legend, extension, older app version, and actual rendered state combination.

### Claude 2.1.302

The installed executable contains a native base selector, color validator, and override merger.
The inspected provider calls that merger before publishing resolved theme context.
Those pure native functions were evaluated in an IO-free VM against both canonical Sy objects.
All **63 overrides per appearance** survive native key allowlisting and color validation; no configured key is silently discarded by this version's merger.
Only token names and Sy observations are recorded, not the closed native baseline palettes.

**Remaining:** interactive TUI call-site coverage, older versions, terminal composition, and unsupported automatic switching.
Native merger acceptance does not prove every allowed role appears in every screen.

## Reproduce focused checks

```bash
BASHRC_VIM_PLUGIN_ROOT="$HOME/.vim" npx vitest run --config vitest.integration.config.js \
  software/tests/integration/vimThemes.plugins.spec.js software/tests/integration/vimThemes.spec.js software/tests/integration/vimThemes.navigation.spec.js
npx vitest run --config vitest.config.js \
  software/tests/themeComposition.spec.js software/tests/themeComponentCrosswalk.spec.js \
  software/tests/themeNativeConsumption.spec.js software/tests/themeAuditStatus.spec.js
```

The plugin root must contain an already-installed native .vim runtime; the integration test does not provision plugins.
`native-consumption.jsonc` pins accepted observations to source hashes. Re-run native probes before accepting a changed hash; never update it merely to green tests.
The external implementation plan retains probe programs and raw local captures for this session.
The original capture did not include full repository validation. Later validation results belong to their implementation plans.
Baseline licensing/distribution review remains open.

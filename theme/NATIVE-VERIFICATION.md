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

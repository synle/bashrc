# Theme mapping audit

## Historical evidence and current implementation

This report records the pre-integration snapshot identified below. Its measured counts and candidate literals are historical evidence, not current active-template results.

Active sources now live in `theme/sy/`, use foundation-derived recipes, and have marker/contrast regression checks in `software/tests/theme*.spec.js`.
Consumer migration is a separate commit. Native visual verification and unsupported Copilot import remain explicit limits.

## Scope and evidence

This report compares the captured native references with the captured Sy definitions. It recommends changes; it does not deploy them.

- Source snapshot: `f628baa5af88c5684725c94a1ac85cc59f2f4476`.
- `baseline/`: 20 captured app/appearance references and four explicit capability gaps.
- `sy/`: 15 captured app/appearance definitions, nine explicit capability gaps, and two shared palette files.
- `audit.jsonc`: 436 static color-pair measurements and reference-coverage comparisons.
- `mappings.jsonc`: proposed per-app bindings, including all 56 captured Pi roles and all 50 captured OpenCode roles.
- No native GUI or AI session was started. Static risks are not confirmed rendering defects.

“Baseline” means the selected stock/reference pair from the planning inventory. It does not mean every application uses that pair as its factory default.

## Findings that change the approach

### Validate configuration consumption before adjusting colors

The captured VS Code settings builder places theme-name brackets at the settings root. Official customization examples place them inside each customization setting.

This structural mismatch is a stronger initial lead than another palette adjustment. Verify the emitted settings in an isolated native profile before relying on source-level contrast tests.

The native runtime effect remains unverified. Do not claim that every customization is ignored without a consumer-level reproduction.

### Component coverage is not the only problem

The selected Zed Ayu themes contain no style keys or syntax keys absent from Sy. The captured Mariana/Breakers schemes likewise contain no global keys absent from Sy.

Those comparisons do not establish full native-schema coverage. They do show that blindly copying more reference keys would miss important defects already present in mapped components.

### State-dependent foregrounds need a separate role

Sy currently reuses `textDisabled` for placeholders, inlay hints, predictions, and other readable secondary content.

| Actual source pair                            |   Dark |  Light |
| --------------------------------------------- | -----: | -----: |
| VS Code input placeholder on input background | 4.38:1 | 4.21:1 |
| VS Code inlay hint on its background          | 4.38:1 | 4.21:1 |
| Current disabled foreground on pressed fill   | 3.36:1 | 3.18:1 |
| Current disabled foreground on selection fill | 3.50:1 | 3.86:1 |

These are measured color pairs. Native visibility, focus, disabled-state exemptions, and foreground replacement still require application checks.

### Search and selection can retain syntax colors

The Zed source-pair screening identifies the following syntax colors below 4.5:1 on their associated fill:

| State               | Dark | Light |
| ------------------- | ---: | ----: |
| Local selection     |   21 |    25 |
| Active line         |    1 |     0 |
| Search match        |   21 |     5 |
| Active search match |   21 |    32 |

The counts include predictive text. They describe candidate foreground/fill combinations, not a count of confirmed UI defects.

The active search fill composites to `#2b465c` in dark and `#95a9dc` in light. Increasing tint opacity does not necessarily improve legibility.

### The Sublime test checks the wrong foreground

The dark source sets `find_highlight_foreground` to `#0a0a0a` on `#5c4300`: **2.13:1**.

The existing test checks `vars.fg` against the find fill instead. That does not exercise the configured native foreground override.

The light source pair measures **10.07:1**. The first repair should reuse the existing foreground role, not introduce another palette color.

### Terminal black has two conflicting meanings

Ghostty uses true black on its dark background: **1.06:1**. Zed and Windows Terminal instead lift their dark ANSI black to `brightGray`.

Shared `black` also serves shadows and inversion. Changing that shared literal globally is not an appropriate terminal-only repair.

Terminal colors act as both foregrounds and backgrounds. A better anchor cannot guarantee every arbitrary ANSI foreground/background combination will be readable.

### Vim needs effective-group checks

The native Ayu source explicitly defines 63 groups; the Sy renderer explicitly defines 42. Thirty Ayu explicit group names are absent from Sy.

Absence does not automatically mean a bug. Ten of those names belong to NERDTree or GitGutter, which the inspected configuration does not install.

The inspected configuration uses Signify. Its native highlight helper already links Signify groups to `DiffAdd`, `DiffDelete`, and `DiffChange`.

The generated `MatchParen` pair measures **4.02:1 dark** and **4.18:1 light**. The earlier plan's light estimate of 5.53:1 was wrong: it used shared blue instead of the actual Vim accent.

`VertSplit` is a boundary, not body text. Its 3.88:1 dark pair clears the 3:1 boundary screen and is not counted as a text failure.

## Recommended core additions and adjustments

These values are measured candidates, not approved changes. The backups remain unchanged.

### Add one foreground role: `textSecondary`

| Appearance | Candidate | On normal background | On pressed fill | On current selection |
| ---------- | --------- | -------------------: | --------------: | -------------------: |
| Dark       | `#b0b0b0` |               9.13:1 |          5.01:1 |               5.22:1 |
| Light      | `#404040` |               9.76:1 |          4.78:1 |               5.80:1 |

Use this role for readable active secondary content. Keep `textDisabled` for genuinely disabled content where that distinction is appropriate.

Initial consumers: input placeholders, inlay hints, selected list metadata, Zed muted/predictive text, AI thinking/tool output, and diff context text.

Do not mechanically replace every muted or disabled mapping. Pair each replacement with its real background and state.

### Add a terminal semantic alias: `terminalBlack`

- Dark candidate binding: existing `brightGray=#6e6e6e`.
- Light candidate binding: existing `black=#000000`.
- Initial consumers: Ghostty ANSI index 0 and Termux color0; reconcile with VS Code, Zed, and Windows Terminal.

This is a semantic separation, not a new hue. Preserve bright/base ordering and test explicit ANSI background cells, dimming, and inverse video.

### Define opaque semantic diff fills when the native API needs them

These values flatten existing alpha variants over the controlled theme background:

| Proposed role               | Existing derivation        | Dark      | Light     |
| --------------------------- | -------------------------- | --------- | --------- |
| `diffAddedBackground`       | Green at approximately 10% | `#151a13` | `#dfe6e1` |
| `diffRemovedBackground`     | Red at approximately 10%   | `#221414` | `#ecdfdf` |
| `diffAddedWordBackground`   | Green at 20%               | `#20291c` | `#c6d5cb` |
| `diffRemovedWordBackground` | Red at 20%                 | `#391e1e` | `#e1c6c6` |

The approximately 10% variants use alpha byte `1a`, matching the existing generator. Default foreground contrast on these candidates ranges from **10.40:1 to 14.55:1**.

Claude's documented diff tokens are backgrounds, not text. Pi tool panels and OpenCode diff backgrounds also need fill semantics distinct from success/error foreground colors.

Where native alpha already works, reuse existing alpha variants. Do not add duplicate literals solely to make every application use an opaque value.

For uncontrolled terminal backgrounds, verify the actual background before flattening. Do not assume that an application paints the Sy background itself.

### Evaluate syntax-preserving selection and search fills

| Existing role candidate | Dark      | Light     | Relevant proof                                                                            |
| ----------------------- | --------- | --------- | ----------------------------------------------------------------------------------------- |
| Selection               | `#18334f` | `#b3d7ff` | Main foreground exceeds 10:1; fill/background separation is 1.53:1 dark and 1.40:1 light. |
| Search match            | `#332600` | `#ffdf9a` | Worst current captured syntax pair is 4.58:1 dark and 5.34:1 light.                       |

The dark selection candidate alone is insufficient: unchanged predictive text remains **4.00:1**. Remapping predictive text to `textSecondary` raises the worst captured syntax ratio to **4.59:1 dark** and **4.99:1 light**.

Keep that dependency explicit. A change that tunes selection without fixing predictive text is incomplete.

First evaluate retuning the existing roles across all consumers. If forced-foreground adapters must retain their original fills, consider separate `selectionSyntax` and `matchHighlightSyntax` roles for syntax-preserving consumers.

Do not add both role families without that demonstrated need. Preserve distinguishable active search, other matches, selection, and active line states.

### Reuse existing colors for the remaining roles

No new hue is currently justified for focus rings, ordinary status colors, message surfaces, or thinking-mode accents.

Existing foreground/background colors can serve on-accent and selected-text roles. Existing accents plus gold provide candidates for eight collaborator identities.

A larger palette is not evidence of better component coverage. Correct semantic ownership and state pairing come first.

## Per-application mapping leads

Exact proposed bindings are in `mappings.jsonc`. Names beginning with `proposed.` refer to candidates, not existing core exports.

| App                     | Concrete additions or corrections                                                                                                                                                                                                                                             | What still needs proof                                                                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VS Code                 | Correct settings nesting; map `editor.findMatchForeground` and `editor.findMatchHighlightForeground`; review terminal selection/search colors; use `textSecondary` for placeholders and inlay hints. Add documented chat/inline-chat and warning-status pairs where relevant. | The report identifies 28 documented absent color keys. Confirm their availability and visible components in the installed version, not only current web docs.                                   |
| VS Code semantic tokens | Explicitly review native `newOperator`, `stringLiteral`, `customLiteral`, and `numberLiteral` rules against Sy.                                                                                                                                                               | Semantic token modifiers and TextMate inheritance require the native scope inspector. Missing explicit rules are not automatically unsafe.                                                      |
| Sublime                 | Rebind dark `find_highlight_foreground` to foreground. Keep popup/link/border checks tied to actual CSS surfaces.                                                                                                                                                             | Native baseline has 63/62 scope rules versus Sy's 31; compare selector reachability and inherited styles, not rule counts alone. Sidebar/buttons/tabs belong to the separate UI theme layer.    |
| Zed                     | Add readable secondary/predictive bindings; repair search and local selection fills; evaluate seven additional collaborator entries.                                                                                                                                          | Ayu has eight player entries, Sy one. Confirm collaboration usage and native fallback behavior before expanding. No Ayu style/syntax keys are currently missing.                                |
| Vim                     | Review spelling groups, `Directory`, `WildMenu`, completion scrollbar/thumb, `Conceal`, `Error`, `Todo`, `Underlined`, `Structure`, quickfix line numbers, and cursor column. Repair `MatchParen`. Add `g:terminal_ansi_colors` if embedded terminal usage requires it.       | Preserve correct links and plugin inheritance. Verify Signify and Lightline after full startup. Do not copy unused GitGutter/NERDTree mappings.                                                 |
| Windows Terminal        | Align ANSI black with terminal role semantics; verify selection, cursor, and active/inactive profiles.                                                                                                                                                                        | Color schemes do not define window/tab chrome. Existing indistinguishable-color adjustment can alter rendered colors.                                                                           |
| Ghostty                 | Map ANSI index 0 to the terminal-specific role. Preserve explicit selection foreground and cursor text mappings.                                                                                                                                                              | Generated config uses 0.9 background opacity, 0.65 unfocused-split opacity with gray fill, and 0.8 cursor opacity. Test actual composition and dim/inverse cells.                               |
| Termux                  | Align color0; evaluate a real Sy Light properties adapter.                                                                                                                                                                                                                    | Current Sy Light file is an explicit gap. Do not invent unsupported selection-foreground or auto-switch properties.                                                                             |
| Claude                  | Seventeen documented absent overrides are listed: suggestion/shell/IDE/fast-mode accents, shimmer, merged status, line/word/dimmed diff fills, usage meter, and speaker labels.                                                                                               | Full native built-in palettes remain unavailable. Unknown overrides may be ignored. Validate each token in the installed renderer and distinguish scrolling/fullscreen modes.                   |
| OpenCode                | The proposal covers all 50 captured CLI roles: surfaces, borders, text, diff foregrounds/backgrounds, Markdown, and syntax.                                                                                                                                                   | CLI 1.19.3 uses `defs/theme`. Do not substitute the separate newer UI schema. No Sy adapter was created.                                                                                        |
| Pi                      | The proposal covers all 56 captured UI roles plus three HTML export colors: messages, pending/success/error tool panels, Markdown, diffs, syntax, search, and thinking/bash borders.                                                                                          | Compare the terminal-derived `system` theme first. A fixed adapter must justify itself; preserve strict schema and version compatibility.                                                       |
| Gemini                  | Map semantic text/background/border/status/UI groups and preserve the captured syntax mappings.                                                                                                                                                                               | The constructor derives semantic colors. The custom loader recomputes input/message/focus fills, so documented-looking keys are not proof they override those fields. Verify loader precedence. |
| Copilot                 | Keep native palette selection separate from terminal palette integration.                                                                                                                                                                                                     | Neither a native color export nor a custom Sy theme-import contract was verified. No invented adapter or palette appears in this dataset.                                                       |

## Interpretation and acceptance boundaries

The static screen records **134 below-threshold pairs out of 436**. It is not a claim of 134 confirmed accessibility violations.

The 4.5:1 state-text screen does not silently replace existing project targets of 7:1 for normal text or the named 5.5:1 warm-hue exception.

Essential boundaries use their own 3:1 screen. Decorative guides, actual disabled controls, renderer contrast correction, and foreground replacement need separate treatment.

No native rendering, mode-switching, installation, screenshot, or full repository test gate was performed in this pass. Validate those surfaces before shipping palette changes.

## Capture gaps and redistribution

- Native Claude and Copilot dark/light definitions are unavailable: four baseline files are capability records, not exported palettes.
- Sy Pi, OpenCode, Gemini, Copilot, and Termux Light definitions are absent: nine Sy files explicitly record that status.
- Sublime native schemes are local-only backups. Their redistribution terms were not verified; do not publish them without resolving that review.
- License banners contain at most four left-aligned lines. Full-text source links and remaining license reviews are in `manifest.jsonc`.
- Short attribution is not a determination that all redistribution conditions have been satisfied.

## Planning artifact

The canonical implementation plan remains outside the checkout because the loaded plan-placement rule requires that location:

`/Users/syle/_extra/ai_llm/plans/bashrc-theme_mapping_audit.md`

This report and the dataset are consolidated under `theme/`. The plan is updated with the concrete core-role and application leads above.

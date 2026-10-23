# Theme audit: current closure status

This is the current issue ledger, synchronized with `audit.jsonc`. Original static measurements remain historical evidence, not a count of current defects.

## Status meaning

- **Resolved in code:** the stated implementation/configuration gap is addressed. Native rendering may still require separate verification.
- **Partial:** useful work landed, but the listed remaining scope is not closed.
- **Unverified:** evidence is missing; this is not automatically a confirmed defect.
- **Capability limit:** no verified native API/export exists; no fake adapter is supplied.

## Addressed

- [x] **One palette foundation and repeatable marker generation** (`palette_pipeline`) — Validated aliases/compositing recipes, alpha/RGB/tint/shade variants, stable name/CSS markers, and strict preflight are implemented.
- [x] **Canonical Sy input ownership and offline packaging** (`canonical_consumers`) — Supported consumers load theme/sy directly; thirteen legacy JSONC inputs were removed. Installer bundles active sources without baseline archives.
- [x] **Native VS Code settings nesting** (`vscode_settings_envelope`) — Theme selectors are nested inside workbench, TextMate, and semantic customization settings rather than at the settings root.
- [x] **Documented VS Code search/chat/status and semantic mappings** (`vscode_component_mappings`) — Earlier proposed color keys and four native semantic rules are present in both active sources.
- [x] **Readable active placeholders, inlay hints, predictions, and CLI secondary text** (`readable_secondary_text`) — textSecondary derives from existing neutral colors; active readable content no longer depends on disabled-text assignments in the audited states.
- [x] **Actual Sublime find-match foreground** (`sublime_find_foreground`) — Both native foreground overrides use the readable foreground role; regression checks measure that configured field rather than an unrelated variable.
- [x] **Zed retained syntax over selection, search, and active-line fills** (`zed_retained_syntax_states`) — Syntax-preserving derived fills and readable predictive text cover the measured local editor-state pairs without lowering the 4.5 screening floor.
- [x] **Eight Zed collaborator entries** (`zed_collaboration_entries`) — The active pair supplies eight distinct cursor/background identities with derived selection tints.
- [x] **Terminal black separated from shadow/inversion black** (`terminal_anchor_semantics`) — Standalone and integrated terminal inputs use the terminalBlack semantic role; shared true black remains unchanged for non-terminal uses.
- [x] **Data-driven Vim groups, terminal colors, and Lightline** (`vim_mappings`) — Native renderer input owns spelling/menu/conceal/quickfix and other audited mappings, ANSI colors, and Lightline data; MatchParen uses a readable foreground.
- [x] **Full Vim plugin startup and inherited highlight behavior** (`vim_full_plugin_inheritance`) — Real installed Jetpack/Signify/Lightline load through the complete generated vimrc. Native default links and status palettes survive both starting appearances and repeated switches. CursorLineConceal has no installed consumer beyond its Ayu definition; no runtime fix was needed.
- [x] **Native Pi/OpenCode/Gemini deployment** (`supported_cli_adapters`) — Pi covers 56 captured roles, OpenCode covers 50 paired CLI roles, and Gemini uses supported custom controls. New client deployments preserve explicit foreign selections.
- [x] **Documented Claude override gaps** (`claude_documented_overrides`) — Active native overrides include the earlier proposed mode/diff/usage/label roles plus documented additional accents; setup deploys the canonical objects directly.
- [x] **Pi selected-row retained foregrounds** (`pi_selector_contrast`) — Accent/dim/muted/warning/error pairs use readable derived backgrounds and secondary text, including the required light tint.
- [x] **Termux light source and manual selection** (`termux_light_source`) — Both canonical appearances render through TERMUX_THEME_MODE; automatic native switching is not asserted.
- [x] **Uniform Windows Terminal content without uniform tab/title-bar colors** (`windows_all_profile_content`) — Every profile and explicit unfocused appearance uses the shared selected content pair. Four direct content-color overrides no longer defeat it. Saved tab colors, null tab colors, tab titles, window theme selection, and custom theme definitions are preserved.
- [x] **Termux respects the shared custom-theme opt-out** (`termux_shared_optout`) — The first action checks the terminal-aware shared gate. Disabled runs do not validate mode, load sources, create folders/backups, or write colors; existing files remain unchanged.
- [x] **Single source-of-truth workflow for future feature colors** (`central_theme_workflow`) — Theme README owns the dark/light foundation-to-placeholder-to-product workflow. Repo/theme context, development/architecture/client/Vim docs and inline compiler/loader/renderer comments point to that flow; feature code must not create another palette.
- [x] **Current closure status separated from historical measurements** (`current_audit_ledger`) — This current issue ledger and the Markdown checklist mark code fixes closed while preserving original measurements and explicit remaining limits.

## Current remaining issues and limits

- [ ] **P1: Actual opacity/dimming contrast** — **partial** (`opacity_and_dimming`)
      Composed failures reproduced and settings fixed; dark/light stack screens now pass. Ghostty native parser/readback and Zed renderer source establish semantics. Native Display P3/compositor/focus screenshots remain unverified; see `NATIVE-VERIFICATION.md`.

- [ ] **P1: Native token consumption, semantic overrides, and inheritance** — **partial** (`native_token_consumption`)
      VS Code 1.138.0 native engine applies four semantic overrides and fifteen standard TextMate fallbacks. Claude 2.1.302 merger accepts all 63 overrides per appearance. Older renderers, all language providers, interactive call sites, and full visual states remain unverified.

- [ ] **P2: Sublime Adaptive UI and grammar reachability** — **partial** (`sublime_ui_and_scopes`)
      Native APIs resolve 70 grammar scope stacks per appearance across four languages, including 21 inherited foregrounds. Adaptive rules and native UI selection were inspected. Texture/opacity composition, complete grammar coverage, and interactive state pixels remain unverified.

- [ ] **P2: Complete native schema/component/state crosswalk** — **partial** (`complete_component_state_crosswalk`)
      Repeatable crosswalk now inventories every active/captured-reference key and named key state, including reference-only reachability gaps. Complete native schemas and runtime state combinations remain unverified; inventory totals are not defect counts.

- [ ] **P1: Final green whole-repository release gate** — **unverified** (`main_release_gate`)
      Focused theme checks are available; the previous full gate was not green and was not rerun after all fixes at user request. Do not infer current whole-build success from this ledger.

- [ ] **P3: Copilot custom theme import** — **capability_limit** (`copilot_custom_import`)
      No verified native custom import/export contract was established. Preserve the user's native palette choice; do not invent an adapter.

- [ ] **P3: Closed native Claude/Copilot baseline palettes** — **capability_limit** (`native_baseline_exports`)
      Four baseline records describe unavailable exports rather than fabricated color definitions.

- [ ] **P3: Unverified native custom-theme auto-switching contracts** — **capability_limit** (`custom_theme_auto_switching`)
      Termux manual light selection exists; automatic switching is not verified. Custom Gemini/Claude automatic pairing is not assumed; Pi and paired OpenCode use their supported contracts.

- [ ] **P2: Baseline redistribution terms** — **partial** (`baseline_redistribution`)
      Sublime references remain local-only. Individual Ghostty theme rights and undeclared Sy repository licensing still require review before distribution; short attribution is not a compliance determination.

## Requested follow-up policy

Windows Terminal profiles share the selected dark/light **content** palette, including explicit unfocused appearances. Saved foreground/background/cursor/selection overrides no longer defeat that policy.

Saved `tabColor`, null tab colors, tab titles, application `theme`, and custom `themes` definitions stay preserved. Existing role-based tab defaults remain for profiles without a saved tab color.

Windows Terminal fonts, opacity, images, icons, visibility, shell commands, and other non-color policy are not newly changed. Native appearance under transparency/images remains a separate verification item.

Termux returns before mode validation or source/backup/folder/write operations when the shared custom-theme flag is disabled. Existing color files are not removed or restored.

## Historical evidence

- Original snapshot: `f628baa5af88c5684725c94a1ac85cc59f2f4476`.
- Original static source-pair analysis: **436 pairs**, **134 below-threshold pairs**. Those values are historical, not current issue totals.
- Original `coverage`, `measurements`, `candidates`, `settingsEvidence`, and `referenceGaps` fields remain in `audit.jsonc` for compatibility, with explicit historical labeling and a semantic checksum.
- `mappings.jsonc` retains original proposals; active `theme/sy/` sources and focused tests define current implementation.

Native style/engine probes are recorded in `native-consumption.jsonc` and explained in `NATIVE-VERIFICATION.md`. No complete visual-rendering or green whole-build claim is made. Full validation was not rerun at the user's request.

## Evidence and source ownership

Each JSON issue includes source/test/document paths. Code-level tests cover emitted settings, no-effects opt-out, preserved chrome, repeat deployment, and selected contrast pairs.

Foundations stay in `sy/_palette_{dark,light}.jsonc`; application values remain marker-generated by `software/tools/build-include.js`.

- `resolved_in_code`: 19
- `partial`: 5
- `unverified`: 1
- `capability_limit`: 3

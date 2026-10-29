# TODO: interactive zsh migration

## TLDR

Migrate the interactive terminal experience to zsh, starting with an isolated, opt-in macOS trial. Keep Bash for provisioning, standalone Bash scripts, existing platforms, and rollback.

This is not a shell-name replacement: completion, editing widgets, hooks, history, callbacks, and generated wrappers need explicit native adapters. Preserve daily behavior first; remove redundant zsh-path glue only after acceptance.

## Impact

- **Benefit:** native contextual completion, lifecycle hooks, editing widgets, history controls, and PATH uniqueness can simplify interactive integration.
- **Audience:** macOS terminal users first; other supported environments retain their existing behavior.
- **Effort:** a small trial covers roughly 6–10 source/test groups; full parity reaches the wider component inventory below. This is a planning estimate.
- **Tradeoff:** coexistence initially adds maintenance. No startup or prompt-speed improvement has been measured.
- **Cost of waiting:** no urgent migration requirement; staying on Bash remains a valid choice.

## How to track progress

This is a work checklist, not new standing agent guidance.
Work one component or phase item at a time; check it only after implementation and its acceptance evidence exist.
Record changed paths, the exact check command, quoted results, remaining exceptions, and rollback beside completed items.
Phase items coordinate the component checks; completing a phase means its required component and behavior checks also pass.

Shared-code lint setup and the prioritized optional Make commands live in [the shell-agnostic checklist](TODO_AGNOSITC_SHELL.md).
Use those checks before declaring shared code portable; native zsh runtime acceptance remains part of this checklist.

## Status and recovered context

**Status: planning only.** This document does not implement or authorize shell switching, package installation, personal-file migration, or deployment.

The earlier local research is `~/_extra/ai_llm/plans/bashrc-zsh_migration.md`.
Two project-session requests from 2026-10-28 confirm the original goals: compatibility, practical benefits, tooling cleanup, and continuation of that research.
This document consolidates the implementation roadmap without reproducing the research transcript.

The original source review used HEAD `9deb7a0c6a429f8c5e2357250778bb6a37525876` plus the working-tree sources inspected during documentation.
That original review preserved unrelated navigation and documentation edits; the recorded source evidence is not a new runtime validation.

Evidence has three distinct levels:

| Level                   | What it establishes                                                                                                                                          | Limit                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Current source reads    | Bash startup generation, Bash block validation, shell selectors, PATH policy, keybindings, prompt/history hooks, cache ownership, and callback dependencies. | Selected integration seams were read; this is not a function-by-function compatibility audit. |
| Recovered research      | Controlled semantic incompatibilities, native-feature probes, optional-tool evaluation, and the original staged recommendation.                              | Historical results are not newly executed tests or evidence of installed migration support.   |
| Proposed implementation | The architecture, work packages, decisions, and acceptance conditions below.                                                                                 | Every migration item remains open until implementation supplies its evidence.                 |

The inventory currently contains 32 `*.profile.bash` partials.
File presence and responsibility do not prove compatibility; each retained function still needs classification before adoption.
Personal startup files, live history, credentials, and local work overlays were not read or sourced for this document.

## Scope and compatibility boundaries

### Keep

- The Bash bootstrap and Node-to-Bash installation pipeline.
- Existing standalone scripts and their declared interpreters.
- The current Bash profile, startup entry points, history, and caches as supported fallback paths.
- Existing non-macOS shell behavior during the first trial.
- fzf, Starship, Git/Delta, fd, ripgrep, clipboard tools, editor tools, runtime managers, and standalone command executables.
- Existing registries, theme ownership, work-profile restrictions, and GUI detection ownership.

### Change

- Add a small native zsh interactive layer with separate startup and cache ownership.
- Extend the existing profile-registration seam to validate content with its intended interpreter.
- Adapt parent-shell behavior: navigation, exports, activation, prompt state, and editable command buffers.
- Replace Bash-specific interactive plumbing where native zsh features satisfy the accepted contract.
- Make account-shell and terminal selection respect explicit adoption rather than overriding it during setup.

### Do not assume

- zsh is not Bash 6 or a drop-in interpreter for the current profile.
- Running `./run` from zsh does not require converting `run.sh` to zsh.
- A successful zsh parse does not prove runtime compatibility.
- `bashcompinit` is a completion bridge, not an emulator for Readline or the full Bash profile.
- Native completion does not eliminate custom tokens, aliases, private commands, or PowerShell consumers.
- No command, package, public alias, or supported platform becomes removable merely because zsh is available.

Do not invoke `zsh run.sh`, source the complete Bash profile from zsh, or rename Bash sources and assume equivalent behavior.
The Bash 3.2 bootstrap compatibility requirement remains separate from the user's Bash 5 interactive workflow.

## Target architecture

```text
Provisioning remains:
  ./run -> run.sh -> Node engine -> emitted Bash -> tools and managed configuration

Existing interactive path remains:
  Bash startup -> managed Bash profile -> Bash cache and approved Bash overlays

New opt-in interactive path:
  zsh startup -> small native profile -> native hooks, completion, widgets, and adapters
                                      -> existing executable tools
                                      -> explicit Bash callbacks where still required
```

### Ownership and startup order

- [ ] **Profile assembly** — Extend the existing buffering, markers, SOURCE expansion, and write helpers; do not build a second provisioning engine.
- [ ] **Validation** — Select the actual interpreter explicitly; preserve existing Bash and PowerShell callers' behavior.
- [ ] **`.zshenv`** — Minimal, quiet state only when required by noninteractive zsh; no interactive prompt, picker, or completion initialization.
- [ ] **`.zprofile`** — Add only demonstrated login-specific needs; preserve system PATH initialization and avoid double loading.
- [ ] **`.zshrc`** — Load interactive configuration once, respecting an existing `ZDOTDIR` and preserving unrelated user content.
- [ ] **`.zlogin`** — Audit existing login behavior; do not add another interactive-profile loader.
- [ ] **Generated profile and caches** — Separate from Bash artifacts; validate and refresh them through the responsible generator.
- [ ] **Environment facts** — Reuse authoritative configuration; audit shell syntax before sharing executable initialization.
- [ ] **GUI flags** — Recompute session-sensitive flags through the established detector; do not create a second detector or bake session state into a snapshot.
- [ ] **Registries and themes** — Keep one authoritative inventory per concern; shell adapters consume it without creating independent lists or palettes.
- [ ] **Child callbacks** — Explicit executables or a small interpreter-specific loader, rather than inherited interactive functions.

Proposed names such as `software/bootstrap/profile-zsh.zsh`, `~/.zsh_syle`, and `~/.zsh_syle_cache` are design placeholders, not existing files or shipped APIs.
The opt-in setting and durable artifact names must be chosen during implementation.
Do not publish an executable command using an invented migration flag.
An isolated `ZDOTDIR` does not suppress global startup files; record any system initialization that affects the trial.

Recommended initialization order:

- [ ] Establish required environment facts and ordered PATH candidates.
- [ ] Initialize selected runtime managers using their verified zsh interfaces.
- [ ] Register native completion and approved command definitions.
- [ ] Install required picker adapters and editing widgets.
- [ ] Initialize Starship and register prompt/folder hooks without duplicate ownership.
- [ ] Apply accepted custom keybindings after any integration that changes them.
- [ ] Load optional suggestion/highlighting plugins only after their separate acceptance checks.

Use native `precmd`/`preexec` hooks for lifecycle work and `chpwd` for folder tracking where their contracts fit.
Seed initial prompt and folder state explicitly; do not wait for the first folder change.

## Component inventory and required work

Sources below are existing unless explicitly marked proposed.
A retained command must be classified as **unchanged executable**, **native adapter**, **explicit Bash callback**, **accepted replacement**, or **deferred**.
Deferred means unavailable in the trial, not removed from Bash or silently accepted as full parity.

### Bootstrap, assembly, and generated configuration

- [ ] [Installer entry point](run.sh) and [shared environment](software/bootstrap/common-env.sh) — Keep Bash execution and `BASH_ENV`; separate reusable facts from Bash initialization. Audit cache-build and final profile-source steps.
  - Acceptance: Running the installer from zsh still executes Bash correctly; no zsh startup code enters Bash subprocesses.
- [ ] [Profile engine](software/index.js) — Extend `registerProfileBlock` and its validation seam with explicit interpreter ownership; preserve buffering, duplicate-key checks, and existing defaults.
  - Acceptance: Native zsh blocks reach zsh validation; existing Bash/PowerShell output remains unchanged.
- [ ] [Startup generator](software/scripts/_init.js) — Add opt-in zsh startup generation without replacing `.bashrc`, `.bash_profile`, or unrelated zsh configuration.
  - Acceptance: Login and non-login interactive entry points load the intended profile once.
- [ ] [Core template](software/bootstrap/profile-core.sh) and [advanced template](software/bootstrap/profile-advanced.sh) — Classify embedded functions, aliases, exports, traps, SOURCE partials, and registered blocks. Build a minimal native layer instead of sourcing both templates wholesale.
  - Acceptance: Every essential embedded feature has an owner; intentional trial omissions are listed.
- [ ] [Cleanup](software/scripts/~cleanup.js) and [SOURCE refresh](software/scripts/~refresh-source.standalone.js) — Finalize and refresh only intended shell artifacts; keep Bash snapshots and output intact. Audit refresh behavior before extending it.
  - Acceptance: Partial reruns update the right profile; repeated generation adds no duplicate blocks.
- [ ] [Include generator](software/tools/build-include.js), [installer bundler](software/tools/build-installer.js), and [build workflow](.github/workflows/build-main.yml) — Audit new source inclusion, discovery, validation, and artifact publication. Add zsh artifacts only when an actual consumer requires them.
  - Acceptance: The trial works from its supported distribution path; existing Bash release contracts remain intact.
- [ ] Other profile-registering installers — Enumerate `registerWithBashSyleProfile`, `registerPlatformTweaks`, raw completion registrations, and direct profile consumers. Classify generated content, not only `.profile.bash` files.
  - Acceptance: No required platform alias or tool hook disappears because its generator was missed.

The current generic registrar treats every non-PowerShell destination as Bash and validates it using `bash -n`.
The current startup generator sources the Bash common state, profile, cache, and matching `~/.work_*.bash` overlays.
Neither path is already shell-neutral.

### Interactive essentials

- [ ] [PATH candidates](software/scripts/bash-path-candidate.profile.bash) — Preserve the ordered inventory, inherited entries, missing-folder pruning, and first-seen precedence. Use native uniqueness only for deduplication.
  - Acceptance: One candidate inventory serves existing consumers; login startup and repeated sourcing preserve the accepted PATH.
- [ ] [Readline setup](software/scripts/bash-inputrc.js) and [keybindings](software/scripts/bash-keys.profile.bash) — Replace zsh-path `bind`, `bind -x`, and `READLINE_LINE` handling with ZLE widgets and native bindings.
  - Acceptance: Every essential chord preserves its action, cancellation, and insertion/execution boundary.
- [ ] Completion: [parser](software/scripts/advanced/bash-autocomplete-complete-spec.common.bash), [shared macros](software/metadata/autocomplete.common.js), and `software/metadata/autocomplete-complete-spec/` — Start with native zsh definitions; implement only verified gaps. Keep the shared registry for Bash and PowerShell.
  - Acceptance: Daily commands, aliases, nested paths, and custom tokens complete correctly without insecure completion initialization.
- [ ] [fzf installer](software/scripts/fzf.js) and [custom pickers](software/scripts/bash-fzf.profile.bash) — Keep fzf; adapt candidate generation, preview, info, reload, and result handling. Try native Tab menus before adding another integration.
  - Acceptance: File/folder/favorites/Git pickers, previews, and F5 reload work under the actual child interpreter.
- [ ] [History helpers](software/scripts/bash-history.profile.bash) and history sections in the advanced template — Define native storage and policy separately; port canonicalization, backups, cleanup, and search only where accepted.
  - Acceptance: Concurrent sessions preserve privacy and navigation semantics; Bash history remains untouched.
- [ ] [Starship setup](software/scripts/advanced/starship-config.js) and [shared prompt configuration](software/scripts/advanced/starship-config.toml) — Use native zsh initialization; adapt prompt environment producers, shell identity, and hook ordering without duplicating prompt design.
  - Acceptance: First and later prompts show the correct state and preceding command status.
- [ ] [Legacy prompt helpers](software/scripts/bash-prompt-legacy.profile.bash) — Do not load a second renderer. Identify helpers still used by Starship, titles, navigation, or Git wrappers before omitting them.
  - Acceptance: Required helpers remain available without competing prompt rendering.
- [ ] Navigation, recents, Git, diff, and clipboard-diff sections in the advanced template — Port parent-shell state changes and array-sensitive wrappers. Preserve native navigation first, bounded fuzzy fallback, and current diff contracts.
  - Acceptance: Folder state, argv, status, cancellation, recents, and Git defaults match the accepted baseline.
- [ ] [Dynamic alias cache](software/scripts/bash-dynamic-aliases.profile.bash) — Never load Bash serialization into zsh. Omit unneeded variants during the trial; port accepted generators with independent cache ownership.
  - Acceptance: No stale Bash definitions are sourced; retained public variants work after regeneration and repeated startup.

The current Git wrapper uses zero-based arrays, adds `-w` to direct diffs, and turns only a bare stash into `stash push -u`.
Preserve global-option handling, explicit stash behavior, cache invalidation, and exit status in the native adapter.

### Launchers, developer tools, and LLM dispatch

- [ ] [fnm activation](software/scripts/fnm-binary.js) — Replace Bash binary lookup and verify explicit zsh activation with the installed tool's help. Preserve version-selection policy.
  - Acceptance: Activation updates the parent shell; no unrequested automatic version switching appears.
- [ ] [Git executable deployment](software/scripts/git-functions.js) and [shell Git helpers](software/scripts/bash-git-helpers.profile.bash) — Reuse deployed `.cjs` tools; classify shell wrappers, patch operations, and navigation separately.
  - Acceptance: Existing worktree and Git commands preserve output, arguments, status, and parent-shell effects where applicable.
- [ ] [Editor launchers](software/scripts/advanced/editor-launchers-common.profile.bash) and [browser launchers](software/scripts/advanced/browser-launchers-common.profile.bash) — Keep generated registries and browser flags; adapt binary lookup, array access, editor selection, and recent-file tracking.
  - Acceptance: Launch targets and argv remain correct for spaced paths; terminal use does not acquire GUI-only side effects.
- [ ] [LLM dispatcher](software/scripts/advanced/llm/_common/sy-commands.profile.bash) — Preserve the single registry and interactive/run routes; adapt indexing, argument parsing, dynamic scope, and generated wrappers.
  - Acceptance: Default CLI selection, explicit overrides, inline transport, noninteractive execution, and failures preserve their contracts.
- [ ] [Prompt helpers](software/scripts/advanced/llm/_common/llm-prompts.profile.bash) and [Ollama helpers](software/scripts/advanced/llm/ollama.profile.bash) — Classify shell-dependent helpers and callback boundaries; retain existing deployment ownership and work-profile restrictions.
  - Acceptance: Required commands work without enabling personal-network routing or automatic local-provider bootstrap in work mode.
- [ ] CLI partials: [Claude](software/scripts/advanced/llm/claude/claude.profile.bash), [Copilot](software/scripts/advanced/llm/copilot/copilot.profile.bash), [Gemini](software/scripts/advanced/llm/gemini/gemini.profile.bash), [OpenCode](software/scripts/advanced/llm/opencode/opencode.profile.bash), [Pi](software/scripts/advanced/llm/pi/pi.profile.bash) — Audit each partial independently; keep shared skill and instruction deployment unchanged unless a concrete shell consumer requires adaptation.
  - Acceptance: Installing the binary is not treated as wrapper parity; accepted interactive and run paths are exercised.

### Remaining profile partials

These components remain part of the full-parity inventory even when the minimal trial excludes them.
The review identified their source responsibilities; their complete function bodies still require compatibility and consumer audits.

- [ ] **[Telemetry exports](software/scripts/bash-env-telemetry.profile.bash)** — Preserve opt-out values through a compatible environment layer; do not lose them by omitting the Bash template.
- [ ] **[Clipboard](software/scripts/bash-clipboard.profile.bash)** — Preserve copy/paste, backups, byte handling, and platform selection; adapt shell-specific helpers.
- [ ] **[File utilities](software/scripts/bash-file-utils.profile.bash)** — Classify argument-sensitive wrappers and subprocess operations; keep existing executables where sufficient.
- [ ] **[Command wrappers](software/scripts/bash-command-wrappers.profile.bash)** — Audit shell-launch behavior, binary lookup, privilege handling, terminal alerts, and output contracts; do not change security policy.
- [ ] **[Snip helpers](software/scripts/bash-snip.profile.bash)** — Adapt helper introspection and history consumers where required; preserve the underlying CLI.
- [ ] **[Snip command wrappers](software/scripts/bash-snip-command-wrappers.profile.bash)** — Preserve TTY-only filtering and exact piped/redirected output; coordinate generation with the separate native cache.
- [ ] **[SQLite utilities](software/scripts/bash-sqlite.profile.bash)** — Audit lookup, aliases, argv, and status; validate with disposable fixtures, not a live database.
- [ ] **[tmux workspaces](software/scripts/bash-tmux-workspace.profile.bash)** — Audit generated pane commands, selected interpreters, working folders, and snapshot/restore behavior.
- [ ] **[Base85](software/scripts/bash-base85.profile.bash)** — Preserve byte-exact encoding and decoding; audit binary lookup and explicit installation prompts.
- [ ] **[Window management](software/scripts/bash-window-manager.profile.bash)** — Preserve platform/GUI guards and launcher integration; do not provision another host to claim parity.
- [ ] **[Shared-folder resolution](software/scripts/bash-shared-folder.profile.bash)** — Adapt candidate arrays and lookup without changing storage ownership or automatically mounting unavailable shares.
- [ ] **[Shared-file and sync helpers](software/scripts/bash-file-dropbox-sync-utils.profile.bash)** — Preserve dependent patch, notes, sync, and backup workflows; test isolated files rather than shared personal data.
- [ ] **[Network helpers](software/scripts/bash-net-utils.profile.bash)** — Port Bash regex captures and argument expansion; use bounded local fixtures without changing access or firewall policy.
- [ ] **[Runner and local-execution helpers](software/scripts/github-runner.profile.bash)** — Audit execution boundaries and credentials separately; no runner registration or remote execution during shell acceptance.
- [ ] **[Docker sharing helpers](software/scripts/docker-shares.profile.bash)** — Audit argv and interpreter behavior without starting services or replacing existing containers during the trial.

### Account settings, terminals, and local overlays

- [ ] [macOS full setup](software/scripts/mac/_full-setup.sh) — Replace unconditional Bash preference with an explicitly selected, persistent interactive-shell policy. Keep existing defaults until opt-in.
  - Acceptance: A setup rerun does not switch an opted-in account back to Bash.
- [ ] [VS Code terminal template](software/scripts/advanced/vs-code-config.jsonc) and [Zed terminal template](software/scripts/advanced/zed-config.jsonc) — Update generated macOS selection only after opt-in; preserve Linux and unrelated editor settings.
  - Acceptance: New editor terminals launch the intended shell without changing other platforms.
- [ ] [Ghostty integration](software/scripts/advanced/ghostty.js) — Verify native zsh integration, title/cursor ownership, notifications, and folder inheritance with existing settings.
  - Acceptance: No competing hooks, incorrect cursor, or lost working-folder inheritance.
- [ ] [tmux configuration and shims](software/scripts/advanced/tmux.js) — Inspect the live server and generated Bash shims; account changes alone do not prove new panes use zsh.
  - Acceptance: New panes use the accepted shell; existing Bash shims still work without terminating unrelated sessions.
- [ ] Local `~/.work_*.bash` overlays — Obtain permission where sensitive, then audit separately. Choose native adapters, compatible exports, or documented trial exclusions.
  - Acceptance: Essential work commands remain available before permanent adoption; no blanket Bash-overlay sourcing in zsh.
- [ ] Other platforms and remote sessions — Keep current output; audit shell selectors separately before expanding beyond macOS.
  - Acceptance: No remote or non-macOS environment silently acquires an unsupported native profile.

## Behavior contracts that must survive

### Editing and picker keys

[The keybinding reference](docs/editor-keybindings.md) remains the source of truth.
This checklist captures migration parity, not a new independent binding registry.
Implementation must reread the current source and update the reference if behavior intentionally changes.

- [ ] **Ctrl+R** — Search history and place the selected command in the buffer for editing; do not execute the selection automatically.
- [ ] **Ctrl+T** — Pick a file and open it with the selected editor; standard fzf path insertion is not an equivalent replacement.
- [ ] **Ctrl+Y** — Pick a recently opened file and open it with the selected editor.
- [ ] **Ctrl+P** — Pick a folder and change the parent shell's current folder.
- [ ] **Ctrl+B** — Preserve the favorite-command picker's accepted action and cancellation behavior.
- [ ] **Ctrl+N** — Preserve the fuzzy Git browser.
- [ ] **Ctrl+G and Ctrl+X** — Preserve the accepted external-editor workflow, including its execution behavior; characterize it before selecting a native widget.
- [ ] **Ctrl+L** — Discard the input line and clear the visible screen without clearing terminal scrollback.
- [ ] **Up/Down** — Preserve prefix-history navigation with the accepted session-local policy.
- [ ] **Ctrl+A/E and Option-arrow variants** — Preserve line/word movement for the actual terminal escape sequences.
- [ ] **Tab and Shift+Tab** — Preserve accepted completion and reverse selection, including nested folder completion.

### History and persistent state

- [ ] Keep Bash and zsh history files separate; use disposable history fixtures during development.
- [ ] Preserve leading-space suppression for sensitive commands.
- [ ] Preserve the newest occurrence of repeated commands rather than losing a repeated run.
- [ ] Keep ordinary Up navigation local to the session; provide cross-session search through the accepted history picker.
- [ ] Do not enable `SHARE_HISTORY` by reflex; it changes that navigation contract.
- [ ] Evaluate native append/deduplication options against canonicalization, multiline entries, timestamps, and concurrent writers.
- [ ] Do not run zsh history through the Bash syntax-filtering cleaner.
- [ ] Treat import as a later, separately approved, one-way operation with a backup and explicit format handling.
- [ ] Preserve recent-file/folder state ownership, ordering, pruning, limits, and concurrent-write safety.
- [ ] Audit history-consuming tools such as Snip separately; changing the history format affects more than Ctrl+R.

### Shell and subprocess semantics

Historical controlled probes demonstrated these incompatibilities; they were not rerun for this document:

- [ ] **Zero-based arrays** — Review indexes and slices; do not globally enable compatibility options to mask unported wrappers.
- [ ] **Unquoted scalar word splitting** — Preserve argv explicitly with arrays and deliberate splitting.
- [ ] **`type -P`** — Use a verified zsh binary-lookup interface, preserving binary-versus-function distinctions.
- [ ] **`read -a` and `BASH_REMATCH`** — Port array reads and regex captures natively.
- [ ] **Ordinary locals named `status` or other special parameters** — Rename collisions in the native layer.
- [ ] **Unmatched globs remaining literal** — Handle missing matches explicitly; quote installer selectors containing wildcards.
- [ ] **`export -f` making callbacks available** — Use explicit executables or interpreter-owned callback loaders.
- [ ] **Bash function serialization and `BASH_ALIASES` introspection** — Generate native definitions or avoid unnecessary variants.

An explicit Bash callback interpreter can be transitional, but it cannot see functions defined only in the parent zsh process.
Do not globally falsify `SHELL`, or source the entire interactive profile for every preview, to hide callback failures.
Parent-shell changes such as `cd`, activation, exports, and buffer edits must remain in the native adapter.

## Cleanup and optional tooling decisions

- [ ] **Replace first — Standard-command completion plumbing, `PROMPT_COMMAND` composition, Readline glue, and PATH text deduplication.** — Only on the zsh path, after behavior passes; keep shared consumers and ordered PATH data.
- [ ] **Keep — fzf, custom picker functionality, Starship, existing executable tools, shared registries, and the managed theme system.** — Native facilities replace integration glue, not these tools' responsibilities.
- [ ] **Reuse if needed — The already-selected fzf Tab plugin's zsh implementation.** — Try native menus first; do not install a competing Tab framework by default.
- [ ] **Defer — Nonessential dynamic alias variants and legacy prompt rendering.** — Audit public commands and helper consumers before omission becomes permanent.
- [ ] **Optional later — `zsh-autosuggestions` and `zsh-syntax-highlighting`.** — Evaluate independently after baseline acceptance; review source, pin versions, check key conflicts, and reuse managed theme roles.
- [ ] **Separate experiment — Atuin or another history replacement.** — Not a migration prerequisite; history policy, import, storage, and any sync need independent decisions.
- [ ] **Avoid initially — Oh My Zsh or another broad plugin framework.** — Native facilities and existing tools already provide the baseline; no new framework without a concrete unmet need.

Recursive globbing and automatic folder entry are already enabled on the Bash path; do not count them as newly gained features.
Syntax coloring is visual assistance, not proof that a command is safe.
Package uninstallation and Bash support retirement require separate downstream audits and authorization.

## Implementation phases

Every phase remains unchecked. Suggested work packages describe dependency order, not a commitment to a specific PR count.

### Phase 0 — Establish the contract and inventory

- [ ] Enumerate embedded functions, all profile partials, generated platform blocks, executable tools, shell selectors, and direct Bash-profile consumers.
- [ ] Assign each public feature a classification and a trial/full-parity priority.
- [ ] Characterize essential commands, cancellation, failure status, key behavior, and startup output with isolated fixtures.
- [ ] Record existing shell/account/terminal selections without assuming inherited `SHELL` is the account record.
- [ ] Record baseline startup and prompt behavior before making performance claims.
- [ ] Choose the zsh version/platform support policy and opt-in configuration contract.

**Exit condition:** every essential daily feature has an owner, an accepted behavior, and an observable check.

### Phase 1 — Build the isolated native foundation

- [ ] Extend existing registration with explicit shell-aware validation and focused regression checks.
- [ ] Generate a small zsh profile and trial startup files outside active startup locations.
- [ ] Use isolated HOME, history, cache, and `ZDOTDIR` locations; do not load personal startup files.
- [ ] Implement shared PATH inventory consumption, required environment facts, native completion, Starship, selected aliases, and verified runtime activation.
- [ ] Preserve work-profile and GUI boundaries without blindly sourcing Bash common state.
- [ ] Keep all existing Bash outputs unchanged; add no optional plugins.

**Exit condition:** an isolated interactive trial starts without unexpected output and has correct PATH, prompt, completion, and runtime activation.

### Phase 2 — Reach essential behavior parity

- [ ] Port navigation, recent-state helpers, Git defaults, required launchers, and essential LLM dispatch.
- [ ] Implement the accepted native editing widgets and keybindings.
- [ ] Adapt fzf callbacks and test preview, info, F5 reload, cancellation, and result insertion.
- [ ] Implement separate history policy and fixtures, including concurrent sessions and recovery.
- [ ] Audit custom completion gaps; add narrowly scoped definitions or a separately tested temporary bridge.
- [ ] Port required dynamic wrappers only; list every deferred public feature.

**Exit condition:** every essential Phase 0 item passes its behavior check; the trial's omissions remain explicit.

### Phase 3 — Validate actual terminal entry points and reruns

- [ ] Make macOS full setup respect explicit shell selection without changing existing defaults.
- [ ] Add managed startup integration with backups and preservation of unrelated user content.
- [ ] Opt in editor-terminal selection; verify Ghostty, editor terminals, and tmux independently.
- [ ] Audit essential local work overlays before permanent adoption.
- [ ] Generate/deploy twice and compare managed blocks, hooks, bindings, PATH entries, caches, and shell preference.
- [ ] Exercise rollback before changing the account's default shell.

**Exit condition:** supported terminal entry points agree, reruns remain idempotent, and returning to Bash works without data loss.

### Phase 4 — Adopt, then simplify deliberately

- [ ] Obtain explicit adoption approval and change only the selected account/terminal settings.
- [ ] Complete remaining full-parity items or accept documented omissions before claiming full migration.
- [ ] Remove only redundant zsh-path glue with consumer evidence and passing replacement checks.
- [ ] Evaluate optional suggestions/highlighting separately; resolve any history-option or widget conflicts.
- [ ] Update architecture, development, support, and keybinding documentation for actual behavior changes.
- [ ] Consider other platforms or Bash retirement only under a separate support-policy decision.

**Exit condition:** all essential checks pass in normal use; each omission, replacement, and removal has an explicit verdict.

## Validation and definition of done

The checks below are future implementation acceptance, not results from writing this document.
Use observable output and state, not just successful process exit codes.

- [ ] **Actual generated output** — Parse and execute generated artifacts with their intended interpreters; template-string assertions alone are insufficient.
- [ ] **Startup matrix** — Cover login interactive, non-login interactive, and noninteractive shells with isolated state; ensure the trial startup files are actually loaded.
- [ ] **Startup ownership** — No unexpected stdout/stderr, duplicate hooks, repeated interactive initialization, or unrequested installs/network calls.
- [ ] **PATH and environment** — Assert exact candidate precedence, missing-folder handling, inherited entries, repeated sourcing, runtime activation, and session GUI flags.
- [ ] **Key widgets** — PTY checks establish buffer contents, cursor behavior, cancellation, and the absence of unintended command execution.
- [ ] **Completion** — Exercise daily tools, aliases, flags, nested paths, spaces, quotes, Unicode, leading-dash names, and missing matches.
- [ ] **Callback boundary** — Exercise real preview, info, and reload subprocesses with realistic quoted arguments and failure cases.
- [ ] **History/state** — Use concurrent fixture sessions; verify privacy, newest-repeat retention, session-local arrows, shared search, backups, and recovery.
- [ ] **Git/LLM/launchers** — Assert real argv, selected binaries, selected CLI, working-folder effects, exit status, and representative output.
- [ ] **Fallback** — Existing Bash profiles, standalone scripts, PowerShell consumers, and Bash-based tmux shims retain their current contracts.
- [ ] **Deployment** — Repeated generation preserves unrelated user content and produces no duplicate managed configuration or preference reset.
- [ ] **Real terminals** — Verify Ghostty, an editor terminal, and a new tmux pane; do not infer acceptance from isolated child-shell checks.
- [ ] **Rollback** — Restore only migration-owned selections and startup blocks; verify Bash and preexisting state still work.

Use the repository's [validation cadence](./AGENTS.md) and [testing map](./DEV.md):

- [ ] Run `/bin/bash -n` for changed Bash sources and the selected zsh interpreter's syntax check for native/generated zsh sources.
- [ ] Reserve zsh `-f` for syntax or intentionally startup-free probes; it is not proof that a managed `.zshrc` loaded successfully.
- [ ] Place slow PTY, native-terminal, and resource-sensitive subprocess fixtures under `software/tests/integration/`.
- [ ] Keep test source ASCII-only; represent Unicode cases with escapes or constructed bytes.
- [ ] Run focused checks, then `make precommit` once after the final implementation edit.
- [ ] Leave installer/idempotency and heavier integration checks to their documented CI or explicitly authorized local paths.
- [ ] Do not run `make validate` for routine agent work; it requires an explicit local request.
- [ ] Measure at least 80% changed-code line and branch coverage where available; report unavailable metrics rather than claiming shell coverage from JavaScript coverage.
- [ ] Investigate a failure with its focused reproducer; never refresh expectations merely to hide a regression.

Full migration is done only when the essential contract, deployment reruns, real-terminal checks, and rollback pass.
An isolated working prompt or successful syntax parse does not satisfy that definition.

## Risks and rollback

- [ ] **Later setup forces Bash back** — Make shell selection explicit and persistent before adoption; test a setup rerun.
- [ ] **Editor or tmux still launches Bash** — Verify each selector and the live tmux server independently.
- [ ] **Silent argv/indexing differences** — Characterize real wrapper output and failures; port native semantics instead of broad compatibility switches.
- [ ] **Pickers start but previews fail** — Exercise child-shell callbacks directly and through the real picker.
- [ ] **History cleanup loses valid commands** — Keep formats separate; use native validation and fixture-backed backup/recovery.
- [ ] **Completion loads unsafe files** — Retain `compinit` security checks; fix ownership/permissions rather than bypassing them.
- [ ] **Trial changes personal or shared state** — Isolate HOME/history/cache/state; do not mount, sync, register services, or import live data as a test shortcut.
- [ ] **Initial dual-shell maintenance grows** — Keep the trial small and native; retain only justified adapters and explicit omissions.

Rollback sequence:

- [ ] Launch the previously verified Bash executable; retain existing Bash startup files and generated profile throughout the trial.
- [ ] Restore only account/editor/tmux selectors changed by this migration, using their recorded prior values.
- [ ] Disable or remove only migration-owned zsh startup blocks after preserving any unrelated edits.
- [ ] Leave Bash and zsh histories, recent-state files, caches, and user data intact unless separately approved for cleanup.
- [ ] Verify a new Bash session and existing standalone tools; do not kill unrelated tmux sessions to refresh shell state.

Changing the account shell is an adoption step, not a prerequisite for the isolated trial.
Do not bulk-delete startup files or history as rollback.

## Decisions still required

- [ ] Which commands are essential for the first trial versus full parity?
- [ ] Which zsh versions and macOS entry points are supported initially?
- [ ] What is the explicit opt-in setting, and where does its persistent value live?
- [ ] Which final profile/cache names fit the existing ownership conventions?
- [ ] Which custom completion behaviors need native definitions rather than standard completion?
- [ ] Which dynamic aliases are genuinely used and must survive?
- [ ] What native history timing, deduplication, canonicalization, and recovery policy satisfies the current contract?
- [ ] How will required local work overlays be audited and adapted without exposing sensitive data?
- [ ] Are optional suggestion/highlighting plugins worth their additional maintenance after baseline acceptance?

Resolve these through Phase 0 evidence and explicit acceptance, not a blanket conversion or automatic plugin bundle.

## Sources and evidence limits

Local sources are linked beside their owning components.
The earlier local plan preserves historical probe output, original research links, and continuation details.
No historical shell version, completion inventory, performance result, or deployment result is presented here as a fresh runtime check.

Primary references rechecked while preparing this document:

- [zsh startup and shutdown files](https://zsh.sourceforge.io/Doc/Release/Files.html)
- [zsh completion initialization, security, and Bash completion bridge](https://zsh.sourceforge.io/Doc/Release/Completion-System.html)
- [fzf shell integration and default key behavior](https://junegunn.github.io/fzf/shell-integration/)
- [Starship installation and native zsh initialization](https://starship.rs/guide/)

Direct upstream retrieval succeeded after the documentation lookup service failed.
No runtime migration suite, personal-history import, account-shell change, deployment rerun, or real-terminal acceptance was performed for this documentation task.

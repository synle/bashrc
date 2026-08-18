# LLM CLI & Ollama Model Reference

Single source of truth for the four LLM CLIs we provision (Claude Code, GitHub
Copilot CLI, Google Gemini CLI, OpenCode) **and** for every Ollama model name
that appears in this repo. Keep this file in sync with the linked code any time
a CLI surface, managed setting, or model is added, renamed, or dropped. If this
file and the code disagree, the code wins — but file an edit so the next reader
doesn't have to chase references.

---

## Part 1 — LLM CLI setup (shared rules)

Claude Code is the **base / foundation**. Every other CLI (Copilot, Gemini,
OpenCode) derives its rules, slash commands, and ergonomics from the same
source files in `_common/`. Each per-CLI `setup.js` is responsible for mapping
the shared content onto whatever config surface that specific CLI exposes on
disk.

### Single sources of truth

| Shared file                                                        | Consumed by                                                                                                                                                                  |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_common/instructions.md`                                          | `~/.claude/CLAUDE.md`, `~/.copilot/copilot-instructions.md`, `~/.gemini/GEMINI.md`, `~/.config/opencode/AGENTS.md`                                                           |
| `_common/commands/*.md`                                            | `~/.claude/commands/sy-*.md` (deployed) + `~/.config/opencode/commands/sy-*.md` (symlinked from Claude)                                                                      |
| `_common/mcp-servers.jsonc`                                        | `~/.claude/settings.json::mcpServers`, `~/.copilot/mcp-config.json::mcpServers`, `~/.gemini/settings.json::mcpServers`, `~/.config/opencode/opencode.json::mcp` (translated) |
| `<cli>/<cli>-keys.common.jsonc` + `<cli>/<cli>-keys.windows.jsonc` | Per-CLI keybinding files, with `OS_KEY` substituted per platform                                                                                                             |

Run all four CLIs end-to-end with:

```bash
bash run.sh --preset=llm
```

Run a single one:

```bash
bash run.sh --files="claude/setup.js"     # or copilot/, gemini/, opencode/
```

### Surface parity matrix

|              | Instructions                                                                                        | Slash commands                                                  | Keybindings                                                      | Managed settings              | MCP servers                                               |
| ------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------- |
| **claude**   | ✅ `~/.claude/CLAUDE.md`                                                                            | ✅ `~/.claude/commands/sy-*.md`                                 | ✅ live `~/.claude/keybindings.json`                             | ✅ `~/.claude/settings.json`  | ✅ additive into `~/.claude/settings.json::mcpServers`    |
| **copilot**  | ✅ `~/.copilot/copilot-instructions.md` (+ symlink `AGENTS.md`)                                     | ❌ no `~/.<cli>/commands/` slot (would need plugin manifest)    | ⚠️ build artifact only — binary has no keymap surface in v1.0.48 | ✅ `~/.copilot/settings.json` | ✅ additive into `~/.copilot/mcp-config.json::mcpServers` |
| **gemini**   | ✅ `~/.gemini/GEMINI.md`                                                                            | ❌ no `~/.<cli>/commands/` slot (would need extension manifest) | ✅ live `~/.gemini/keybindings.json`                             | ✅ `~/.gemini/settings.json`  | ✅ additive into `~/.gemini/settings.json::mcpServers`    |
| **opencode** | ✅ `~/.config/opencode/AGENTS.md` (own copy; also falls through to `~/.claude/CLAUDE.md` if absent) | ✅ symlinks from `~/.claude/commands/`                          | ✅ inline `keybinds` in `~/.config/opencode/tui.json`            | ✅ inline in `opencode.json`  | ✅ inline `mcp` in `opencode.json` (translated shape)     |

Legend: ✅ wired, ⚠️ partial / awaiting upstream, ❌ unsupported by CLI today.

When upstream Copilot ships a keymap config or a `~/.copilot/commands/` slot,
see the deferred-deploy comment at the bottom of
`copilot/setup.js::_doCopilotKeysWork` — the merge already runs on every CI
build so the schema stays exercised.

### Settings-intent table

Each `setup.js` has its own `<CLI>_MANAGED_SETTINGS` map because the literal
key names differ (`banner` vs `hideBanner` vs `spinnerTipsEnabled`). The
_intent_ is supposed to stay aligned across the four. Use this table when
adding a new managed setting — implement it everywhere it has a meaning, and
call out anywhere it can't be expressed.

| Intent                                 | claude                                    | copilot                               | gemini                                                       | opencode                                          |
| -------------------------------------- | ----------------------------------------- | ------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| Hide splash / banner                   | `spinnerTipsEnabled: false`               | `banner: "never"`                     | `hideBanner: true`                                           | n/a                                               |
| Mute terminal bell                     | n/a                                       | `beep: false`                         | n/a                                                          | n/a                                               |
| Reduce UI animations                   | `prefersReducedMotion: true`              | n/a                                   | n/a                                                          | n/a                                               |
| Verbose transcript                     | `viewMode: "verbose"`                     | n/a                                   | n/a                                                          | n/a                                               |
| Default model                          | `model: "claude-opus-4-7[1m]"`            | user-owned                            | user-owned                                                   | provider entries from `getOllamaProviderInputs()` |
| Extended thinking                      | `alwaysThinkingEnabled: true`             | n/a                                   | n/a                                                          | n/a                                               |
| Auto-cleanup old sessions              | `cleanupPeriodDays: 30`                   | n/a                                   | `general.sessionRetention: { enabled: true, maxAge: "30d" }` | n/a                                               |
| Skip dangerous-mode prompt             | `skipDangerousModePermissionPrompt: true` | n/a                                   | n/a                                                          | n/a                                               |
| Compact paste in input                 | n/a                                       | `compactPaste: false`                 | n/a                                                          | n/a                                               |
| Render markdown in TUI                 | n/a                                       | `renderMarkdown: true`                | n/a                                                          | n/a                                               |
| Hide inline tips                       | `spinnerTipsEnabled: false`               | n/a                                   | `hideTips: true`                                             | n/a                                               |
| Show intent in tab title               | n/a                                       | `updateTerminalTitle: false`          | n/a                                                          | n/a                                               |
| Auto-copy on select                    | n/a                                       | `copyOnSelect: false`                 | n/a                                                          | n/a                                               |
| Auto-switch to auto mode on rate limit | n/a                                       | `continueOnAutoMode: true`            | n/a                                                          | n/a                                               |
| Reasoning effort                       | `alwaysThinkingEnabled: true`             | `effortLevel: "xhigh"`                | n/a                                                          | n/a                                               |
| Exclude gitignored from @ picker       | n/a                                       | `respectGitignore: true`              | `context.fileFiltering.respectGitIgnore: true`               | n/a                                               |
| Terminal progress indicator            | n/a                                       | `terminalProgress: true`              | n/a                                                          | n/a                                               |
| Tool output truncation                 | n/a                                       | n/a                                   | n/a                                                          | `tool_output.max_lines: 3000`                     |
| Context compaction                     | n/a                                       | n/a                                   | n/a                                                          | `compaction: { auto, prune, reserved }`           |
| PR conflict resolution                 | n/a                                       | `mergeStrategy: "merge"`              | n/a                                                          | n/a                                               |
| Parallel tool calls                    | native                                    | n/a                                   | n/a                                                          | `experimental.batch_tool: true`                   |
| Diff rendering style                   | n/a                                       | n/a                                   | n/a                                                          | `diff_style: "stacked"`                           |
| Mute attention chime                   | n/a                                       | `beep: false`                         | n/a                                                          | `attention.sound: false`                          |
| Disable in-session auto-update         | n/a                                       | `autoUpdate: false`                   | `general.enableAutoUpdate: false`                            | `autoupdate: false`                               |
| Telemetry / usage-stats opt-out        | n/a                                       | n/a                                   | `privacy.usageStatisticsEnabled: false`                      | n/a (consider `share: "disabled"`)                |
| Preserve Co-Authored-By trailer        | native (system prompt)                    | `includeCoAuthoredBy: true`           | native (no setting)                                          | native (no setting)                               |
| MCP servers (shared registry)          | `mcpServers` in `settings.json`           | `mcpServers` in `mcp-config.json`     | `mcpServers` in `settings.json`                              | `mcp` in `opencode.json` (translated)             |
| Desktop attention notification         | native (no setting)                       | `notifications: true`                 | n/a                                                          | `attention.notifications: true`                   |
| Per-tool duration in transcript        | n/a                                       | `showToolDurations: true`             | n/a                                                          | n/a                                               |
| Log verbosity                          | n/a                                       | `logLevel: "warning"`                 | n/a                                                          | n/a                                               |
| Adversarial planning agent             | n/a                                       | `builtInAgents.rubberDuck: true`      | n/a                                                          | `agent.review` (subagent, edit denied)            |
| Pre-approved fetch hosts               | n/a                                       | `allowedUrls` (union, additive)       | n/a                                                          | n/a (`permission: "allow"` covers webfetch)       |
| Per-role agent models                  | n/a                                       | n/a                                   | n/a                                                          | `agent` from `AGENT_TO_MODEL_MAP`                 |
| Language servers (diagnostics)         | native                                    | native                                | native                                                       | `lsp: true` (omitted = DISABLED)                  |
| Code formatters on edit                | native (hooks)                            | native                                | native                                                       | `formatter: true` (omitted = DISABLED)            |
| Load split PR-workflow rules           | native (`@` import budget)                | symlink in `~/.copilot/instructions/` | native                                                       | `instructions: [~/sy_llm_ai/instructions/…]`      |
| Terminal cursor style                  | n/a                                       | n/a                                   | n/a                                                          | `cursor: { style: "block" }`                      |
| Leader-chord timeout                   | n/a                                       | n/a                                   | n/a                                                          | `leader_timeout: 1500`                            |
| Prompt textarea height cap             | n/a                                       | n/a                                   | n/a                                                          | `prompt.max_height: 20`                           |

**n/a** here means _the CLI does not expose a settings key for that intent
today_. Don't silently drop an intent if upstream later ships one — add the
key and update this table in the same edit.

### Editing rules

- **Instructions / rules**: edit `_common/instructions.md`, then re-run all four setup scripts (or `bash run.sh --preset=llm`).
- **Slash commands**: edit a file under `_common/commands/<name>.md` — every deploy (Claude direct + Copilot skills + OpenCode symlink) picks it up on the next setup run. **Adding / renaming / retiring** one is a single edit to `LLM_COMMAND_DEPLOY_MAP` (or `LLM_COMMAND_RETIRED_NAMES`) in `llm-common.js` — that one map is the registry every CLI setup reads, so there is no per-CLI list to keep in sync.
- **Keybindings**: edit `<cli>/<cli>-keys.common.jsonc` for cross-platform chords, `<cli>/<cli>-keys.windows.jsonc` for Windows/Linux overrides. `OS_KEY` is substituted per-platform.
- **Settings**: extend the `<CLI>_MANAGED_SETTINGS` map in the matching `setup.js` AND update the intent table above so drift is visible at review time.
- **MCP servers**: edit `_common/mcp-servers.jsonc` (standard `mcpServers` shape). Each per-CLI `setup.js` deploys it additively — user-added entries with names not in the registry are preserved untouched. Removing a name from the registry does NOT auto-remove it from deployed configs; delete by hand if needed.
- **Adding a new CLI**: copy the structure of `gemini/` (live keybindings + instructions + settings) or `opencode/` (commands fallthrough via symlinks).

### Shell dispatchers (`sy-*` from the terminal)

Every `_common/commands/<name>.md` slash command also has a matching bash
function `sy-<name>` so the same workflow can run from the terminal without
opening a TUI. Source: `_common/sy-commands.profile.bash` (sourced via
`profile-advanced.sh`). Dispatcher auto-registers one wrapper per
`~/.claude/commands/sy-*.md` on shell load — no per-command edits needed when
you add a new command (the regular Claude deploy flow creates the body and
the next shell picks up the wrapper).

CLI selection mirrors the `EDITOR` convention:

```bash
sy-review-pr <pr-url>                # uses $LLM (default claude)
sy-review-pr opencode <pr-url>       # leading positional override
LLM=gemini sy-review-pr <pr-url>     # env-var override
```

Supported tags: `claude`, `copilot`, `gemini`, `opencode`. Unknown values for
`$LLM` fall back to the default. Resolved CLI is echoed to stderr so the
user can see which one fired. `sy-<name> --help` prints inline help without
invoking any CLI.

### Memory promotion bridge (Claude → other CLIs)

Claude Code auto-loads `~/.claude/projects/<encoded-cwd>/memory/MEMORY.md` and
every record it links on every turn. The other three CLIs have no equivalent
layer — every session starts cold. To bridge, snapshot Claude's per-project
memory into a single managed "Persistent Context" appendix and upsert into the
other three CLIs' user-level instructions files:

```bash
bash run.sh --files=memory-bridge.standalone.js
```

Standalone — runs on demand, NOT on every `bash run.sh --preset=llm` (a
snapshot freezes whatever Claude's memory looked like at run time). Writes to
`~/.copilot/copilot-instructions.md`, `~/.gemini/GEMINI.md`, `~/.config/opencode/AGENTS.md`
between BEGIN/END markers keyed by the source script path. Idempotent. Skips
Claude itself (already loads memory natively) and skips any target whose
instructions file isn't on disk yet (run the CLI's `setup.js` first).

### Per-repo `AGENTS.md` → `CLAUDE.md` symlink

Claude Code reads per-repo `CLAUDE.md`. The other three look for `AGENTS.md` at
the repo root (OpenCode falls through to the global `~/.claude/CLAUDE.md` only,
not per-repo). To get Copilot, Gemini, and per-repo OpenCode the same rules
without maintaining two copies, drop an `AGENTS.md` symlink next to every
`CLAUDE.md`:

```bash
bash run.sh --files=repo-agents-symlink.standalone.js
```

Standalone — runs on demand, NOT on every `bash run.sh --preset=llm`. Walks
`$HOME/git/*/` by default; override / extend with comma-separated paths via
`BASHRC_AGENTS_REPO_ROOTS=~/git,~/work`. Idempotent. Never clobbers an existing
regular file or a foreign symlink — those are reported and skipped.

---

## Part 2 — Migrating from Claude Code to another CLI

Most users adopt Claude Code first, accumulate a personal `~/.claude/`
hierarchy (global rules, slash commands, keybindings, skills, per-project
`CLAUDE.md` files), and then want a second CLI alongside it — usually OpenCode
(for local Ollama) or GitHub Copilot CLI (for org-issued seats). This section
is the cheat sheet for that move.

### What "Claude Code state" actually consists of

If you wiped your machine today, this is the full surface area you'd need to
recreate by hand before any other CLI feels comparable:

| Layer                      | Path                                                                     | Purpose                                                             |
| -------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Global instructions        | `~/.claude/CLAUDE.md`                                                    | System-prompt-level engineering rules applied to every conversation |
| Global slash commands      | `~/.claude/commands/*.md`                                                | User-invocable `/foo` prompts (PR review, release, babysit, etc.)   |
| Global skills              | `~/.claude/skills/<name>/SKILL.md`                                       | Loadable playbooks Claude pulls in on matching tasks                |
| Global keybindings         | `~/.claude/keybindings.json`                                             | Chord and single-key bindings inside the TUI                        |
| Global settings            | `~/.claude/settings.json`                                                | Model choice, banner, telemetry, auto-update, hooks, permissions    |
| Per-project instructions   | `<repo>/CLAUDE.md`                                                       | Codebase-specific rules merged on top of global instructions        |
| Per-project skills         | `<repo>/.claude/skills/<name>/SKILL.md`                                  | Repo-scoped playbooks (e.g. `/add-package`, `/run`, `/check`)       |
| Per-project hooks/settings | `<repo>/.claude/settings.json` and `settings.local.json`                 | PreToolUse / Stop / PostToolUse hooks, repo-specific permissions    |
| Memory                     | `~/.claude/projects/<encoded-cwd>/memory/MEMORY.md` + linked `.md` files | Per-project persistent facts that survive across conversations      |

### Claude Code → OpenCode

OpenCode is the closest drop-in target — same agent-loop UX, supports local
Ollama providers, and explicitly **falls through to `~/.claude/CLAUDE.md` if
its own `~/.config/opencode/AGENTS.md` is missing** (per
[opencode.ai/docs/rules](https://opencode.ai/docs/rules/), unless
`OPENCODE_DISABLE_CLAUDE_CODE=1` is set).

| From (Claude Code)                      | To (OpenCode)                                            | Notes                                                                                                                                     |
| --------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `~/.claude/CLAUDE.md`                   | `~/.config/opencode/AGENTS.md`                           | Copy verbatim — same Markdown-as-system-prompt model. OpenCode falls through to Claude's file if absent.                                  |
| `~/.claude/commands/*.md`               | `~/.config/opencode/commands/*.md`                       | Same file format. Symlinking is safe and is what this repo does.                                                                          |
| `~/.claude/skills/<name>/SKILL.md`      | ✅ read natively (same path)                             | OpenCode discovers `~/.claude/skills/*/SKILL.md` directly — no copy, no deploy. Model-invoked only; see "Skills" below for `/skill-name`. |
| `~/.claude/keybindings.json`            | `keybinds: { ... }` inside `~/.config/opencode/tui.json` | Schema differs — chord syntax is OpenCode-specific. Re-author rather than mechanically translate.                                         |
| `~/.claude/settings.json`               | top-level keys inside `~/.config/opencode/opencode.json` | Single file holds providers, models, autoupdate, share-mode, experimental flags.                                                          |
| `<repo>/CLAUDE.md`                      | `<repo>/AGENTS.md`                                       | OpenCode looks for `AGENTS.md` first. If you keep `CLAUDE.md` only, fallback works but is brittle.                                        |
| `<repo>/.claude/skills/<name>/SKILL.md` | ✅ read natively (same path)                             | Walks up from cwd to the git worktree root. Zero setup — this repo's seven skills already load in OpenCode as-is.                         |
| `<repo>/.claude/settings.json` hooks    | ❌ no hook system today                                  | OpenCode has no PreToolUse/Stop/PostToolUse equivalent. Skill-able as wrapper scripts but not config-driven.                              |
| `~/.claude/projects/.../memory/*.md`    | ❌ no auto-memory layer today                            | OpenCode has no persistent memory store. Anything load-bearing must move into `AGENTS.md`.                                                |

### Claude Code → GitHub Copilot CLI

Copilot CLI is more divergent — it has instructions, settings, and a native
skills loader, but **no slash-command slot and no live keymap surface**
(instructions/settings as of `v1.0.48`; skills behavior verified on `v1.0.76`).
You will lose ergonomics. Plan accordingly.

| From (Claude Code)                      | To (Copilot CLI)                          | Notes                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `~/.claude/CLAUDE.md`                   | `~/.copilot/copilot-instructions.md`      | Same Markdown-as-system-prompt model.                                                                                                                                                                                                                                                                                                                                                                              |
| `~/.claude/commands/*.md`               | ✅ `~/.copilot/skills/sy-<name>/SKILL.md` | No `~/.copilot/commands/` slot exists, so `copilot/setup.js` deploys the same shared `_common/commands/*.md` sources as personal **skills** (folder form + generated YAML frontmatter). Gives `/sy-*` in Copilot plus model-triggering off `description` — no plugin manifest needed.                                                                                                                              |
| `~/.claude/skills/<name>/SKILL.md`      | ⚠️ `~/.copilot/skills/<name>/SKILL.md`    | Copilot does NOT read `~/.claude/skills/` (verified `v1.0.76` — a probe skill there never appears in `available_skills`). Its own personal paths are `~/.copilot/skills/` and `~/.agents/skills/`; copy or symlink the folder across, or use `copilot skill add <dir>`. `~/.claude/skills/` is empty here, so no mirror runs — but the shared `/sy-*` commands ARE deployed into `~/.copilot/skills/` (row above). |
| `~/.claude/keybindings.json`            | ❌ no live keymap config in v1.0.48       | This repo still builds a `copilot-keys.*.jsonc` artifact so the schema stays exercised for the day upstream ships one.                                                                                                                                                                                                                                                                                             |
| `~/.claude/settings.json`               | `~/.copilot/settings.json`                | Different key names — see the settings-intent table above for the cross-CLI mapping.                                                                                                                                                                                                                                                                                                                               |
| `<repo>/CLAUDE.md`                      | `<repo>/AGENTS.md`                        | Copilot CLI also reads `AGENTS.md` at the repo root.                                                                                                                                                                                                                                                                                                                                                               |
| `<repo>/.claude/skills/<name>/SKILL.md` | ✅ read natively (same path)              | Verified `v1.0.76`: this repo's seven skills load as project skills with zero setup. Model-invoked only — no `/skill-name`.                                                                                                                                                                                                                                                                                        |
| `<repo>/.claude/settings.json` hooks    | ❌ no hook system today                   | Same gap as OpenCode.                                                                                                                                                                                                                                                                                                                                                                                              |
| `~/.claude/projects/.../memory/*.md`    | ❌ no auto-memory layer today             | Same gap as OpenCode — anything load-bearing must move into `AGENTS.md`.                                                                                                                                                                                                                                                                                                                                           |

### Starting from scratch — what a brand-new machine needs

If you've never set up _any_ of these CLIs and want all four in parity, you
need — at minimum — to author and place:

1. **One canonical instructions doc** (engineering rules, tone, persona, guardrails)
   that gets deployed to four different filenames in four different folders.
2. **A slash-command corpus** (PR review, release, babysit, etc.) deployed to
   the two CLIs that support a `commands/` slot (Claude, OpenCode) and inlined
   into instructions for the two that don't (Copilot, Gemini).
3. **Per-CLI keybinding files** with platform-specific overrides — each CLI
   uses a different schema and different OS-modifier conventions.
4. **Per-CLI settings files** mapping the same _intent_ (hide banner, disable
   auto-update, hide tips, etc.) onto each CLI's actual key names.
5. **A per-project `CLAUDE.md` / `AGENTS.md`** per repo, plus any `.claude/skills/<name>/SKILL.md`
   playbooks you want loaded on matching tasks.
6. **A way to keep all of the above in sync** when you change one rule — without
   that, you will silently drift apart within a week and find yourself debugging
   "why did Copilot do X when Claude wouldn't?".

### How this repo solves it

The whole point of `software/scripts/advanced/llm/` is so that none of the
above has to be hand-maintained per CLI. One edit, four deployments, every run.

- **One instructions file feeds four CLIs.**
  `_common/instructions.md` is the single source of truth. Each `setup.js`
  (`claude/`, `copilot/`, `gemini/`, `opencode/`) writes it out to the right
  filename in the right folder, in the right managed-block format for that CLI:
  - `~/.claude/CLAUDE.md`
  - `~/.copilot/copilot-instructions.md`
  - `~/.gemini/GEMINI.md`
  - `~/.config/opencode/AGENTS.md`
- **One command corpus feeds two CLIs without duplication.**
  `_common/commands/*.md` is deployed to `~/.claude/commands/sy-*.md` by
  `claude/setup.js`; `opencode/setup.js` then **symlinks** each one into
  `~/.config/opencode/commands/` — no copy, no second source. Copilot and
  Gemini have no command slot, so the corpus is currently unsymmetrical for
  those two; that gap is tracked in the surface-parity matrix above.
- **Settings intent stays aligned via the cross-CLI table above.**
  Each setup.js owns its own `<CLI>_MANAGED_SETTINGS` map (because the literal
  key names differ), but the _intent_ is documented in one place — the
  settings-intent table — so a reviewer can spot drift the moment a new key
  goes into one CLI without being mirrored to the others.
- **Keybindings have a per-CLI common+windows split with `OS_KEY` substitution.**
  `<cli>/<cli>-keys.common.jsonc` covers shared chords; `<cli>/<cli>-keys.windows.jsonc`
  layers Windows/Linux overrides; `OS_KEY` is substituted at deploy time. The
  Copilot artifact is built even though Copilot has no live keymap surface yet,
  so the schema stays exercised on every CI build and the file is ready to drop
  in the moment upstream ships a config slot.
- **One CLI invocation deploys all four.**

  ```bash
  bash run.sh --preset=llm
  ```

  Or refresh a single CLI in isolation:

  ```bash
  bash run.sh --files="claude/setup.js"     # or copilot/, gemini/, opencode/
  ```

- **Per-project `.claude/skills/<name>/SKILL.md` lives in the project's own
  repo**, not in this dotfiles tree. This repo's `.claude/skills/` (`add-os`,
  `add-package`, `check`, `plan-and-commit`, `remove-os`, `remove-package`,
  `run`) are an example of repo-scoped playbooks — they ride with the repo's
  source rather than the global LLM-CLI deploy. Both OpenCode and Copilot CLI
  read that path natively; see [Skills across CLIs](#skills-across-clis) below.

- **Auto-memory is Claude-Code-specific today.**
  `~/.claude/projects/<encoded-cwd>/memory/MEMORY.md` plus its linked files are
  read on every Claude Code turn but have no analogue in OpenCode/Copilot/Gemini.
  If you rely on memory for load-bearing context (preferences, project facts,
  feedback), promote it into `_common/instructions.md` before switching CLIs,
  or accept that the second CLI will start without it.

---

## Skills across CLIs

Agent skills (`SKILL.md` playbooks) need **no translation layer**. Three of the
four CLIs read Claude's `.claude/skills/` path directly. What differs is _where_
they look and _how_ a skill gets fired.

### Discovery — where each CLI looks

| CLI         | `<repo>/.claude/skills/<name>/SKILL.md` | `~/.claude/skills/<name>/SKILL.md` | Own native path                                                                                                     |
| ----------- | --------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Claude Code | ✅                                      | ✅                                 | — (this _is_ the native path)                                                                                       |
| OpenCode    | ✅                                      | ✅                                 | `.opencode/skills/`, `~/.config/opencode/skills/`                                                                   |
| Copilot CLI | ✅                                      | ❌ global path not read            | `.github/skills/`, `.agents/skills/`, `~/.copilot/skills/`, `~/.agents/skills/`, plugins, `copilot skill add <dir>` |
| Gemini CLI  | ❌                                      | ❌                                 | `gemini skills install/link`                                                                                        |

OpenCode also accepts `.agents/skills/` and `~/.agents/skills/`, and walks up
from the cwd to the git worktree root when resolving project skills
([docs](https://opencode.ai/docs/skills/)).

Copilot's own path list comes from `copilot skill --help` on `v1.0.76`. Note the
asymmetry: it reads `<repo>/.claude/skills/` but **not** `~/.claude/skills/` — so
a global Claude skill needs a copy or symlink into `~/.copilot/skills/` (or
`copilot skill add`) to reach Copilot. That mirror is not automated —
`~/.claude/skills/` is empty on this machine, so the sync would be speculative.
The shared `/sy-*` commands are a different story and ARE automated:
`copilot/setup.js` → `_doCopilotSkillsWork()` writes each
`_common/commands/<name>.md` to `~/.copilot/skills/sy-<name>/SKILL.md` with
generated frontmatter, keeping Claude Code, OpenCode, and Copilot at parity.

Practical consequence: **this repo's seven skills already work in OpenCode and
Copilot CLI with zero setup.** Nothing to copy, nothing to deploy.

### Layout — folder form only

One skill = one folder = one `SKILL.md`:

```
.claude/skills/<name>/SKILL.md      ✅  the only layout every CLI loads
.claude/skills/<name>.md            ❌  invisible to every loader
```

Every CLI above globs for `<dir>/*/SKILL.md`, so a flat sibling `.md` file is
never discovered — it silently does nothing. The folder name is kebab-case and
must equal the frontmatter `name`. Supporting material (reference docs, helper
scripts, templates) lives beside the `SKILL.md` in the same folder, which is the
other reason folder form is the standard: a flat file has nowhere to put them.

### Invocation — model-invoked vs `/skill-name`

Discovery is only half the story. By default a skill is **model-invoked**:
OpenCode lists every skill in the `skill` tool's `<available_skills>` block and
the model decides when a description matches, then calls
`skill({ name: "add-package" })`. There is **no `/skill` picker and no
`/skill-name` binding in OpenCode's TUI** — the keybind registry has no
`skill_list` entry, and `/skill` is an HTTP route, not a slash command.

To make a skill directly user-invocable, it also has to exist in a `commands/`
slot. Since OpenCode command frontmatter reads `description` and ignores
skill-only keys (`name`, `argument-hint`), and `$ARGUMENTS` works in both, one
file can serve both surfaces via a symlink:

```bash
# per-repo — checked into this repo under .opencode/commands/
ln -sfn ../../.claude/skills/add-package/SKILL.md .opencode/commands/add-package.md
```

That yields `/add-package fzf` as a direct command **and** keeps the skill
model-invocable. Verified against `GET /command` + `GET /skill` on opencode
`1.14.33` — the same file shows up in both listings.

| Scope    | Wired by                                                     | Result                                                                    |
| -------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Global   | `_syncOpencodeSkillCommandSymlinks()` in `opencode/setup.js` | `~/.claude/skills/<n>/SKILL.md` → `~/.config/opencode/commands/<n>.md`    |
| Per-repo | committed symlinks under `<repo>/.opencode/commands/`        | `<repo>/.claude/skills/<n>/SKILL.md` → `<repo>/.opencode/commands/<n>.md` |

Name collisions resolve first-writer-wins: `_syncOpencodeCommandSymlinks()`
(real `/sy-*` commands) runs first, so a command always beats a same-named
skill.

Copilot CLI has no `commands/` slot at all, so `/skill-name` is not reachable
there — its skills stay model-invoked only.

---

## Part 3 — Ollama model reference

Single source of truth for every Ollama model name that appears in this repo,
what uses it, how big it is, and whether it fits on a laptop or needs a
desktop-class GPU.

### Why two flavors of Qwen Coder show up

- **`-base` variants** are used for **inline autocomplete** (Zed `edit_predictions`).
  Only the base checkpoints carry the FIM tokens (`<|fim_prefix|>` / `<|fim_suffix|>`
  / `<|fim_middle|>`) that FIM clients inject for cursor-position completion.
  Instruct variants strip those tokens and produce chatty, suggestion-style replies
  that drift past the cursor. VS Code has no native inline-completion API surface
  that accepts custom endpoints, so `-base` models stay Zed-only.
- **instruct variants** (no `-base` suffix) are used for **agent / chat** traffic via
  opencode, the Zed agent panel, and VS Code Copilot Chat (BYOK). They follow chat
  templates and are appropriate for back-and-forth conversation, tool calls, and
  code-edit assistant flows.

### Model inventory

| Model tag                      | Size on disk | VRAM (approx) | Desktop-only         | Auto-pulled   | Used by                                                                                                                | Code reference                                                                                |
| ------------------------------ | ------------ | ------------- | -------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `qwen2.5-coder:1.5b-base`      | ~1 GB        | ~1.5 GB       | No (laptop default)  | Yes (laptop)  | Inline autocomplete (Zed `edit_predictions`)                                                                           | [`llm-common.js` AUTOCOMPLETE_MODELS](llm-common.js), [`ollama.sh` laptop branch](ollama.sh)  |
| `qwen2.5-coder:3b-base`        | ~2 GB        | ~3 GB         | No (desktop default) | Yes (desktop) | Inline autocomplete (Zed `edit_predictions`)                                                                           | [`llm-common.js` AUTOCOMPLETE_MODELS](llm-common.js), [`ollama.sh` desktop branch](ollama.sh) |
| `qwen2.5-coder:7b-base`        | ~4.7 GB      | ~5 GB         | No (opportunistic)   | No            | Inline autocomplete fallback — picked only if `1.5b-base` / `3b-base` aren't present on the chosen host                | [`llm-common.js` AUTOCOMPLETE_MODELS](llm-common.js)                                          |
| `qwen2.5-coder:3b` (instruct)  | ~2 GB        | ~3 GB         | No                   | No            | opencode agent / chat — recognized config (LIMIT_MEDIUM)                                                               | [`opencode/setup.js` OLLAMA_MODEL_CONFIGS](opencode/setup.js)                                 |
| `qwen2.5-coder:14b` (instruct) | ~9 GB        | ~12 GB        | Yes                  | No            | opencode agent / chat — recognized config (LIMIT_MEDIUM)                                                               | [`opencode/setup.js` OLLAMA_MODEL_CONFIGS](opencode/setup.js)                                 |
| `qwen3-coder:30b`              | ~18-19 GB    | ~24 GB        | Yes                  | No            | opencode agent / chat — recognized config (LIMIT_MEDIUM)                                                               | [`opencode/setup.js` OLLAMA_MODEL_CONFIGS](opencode/setup.js)                                 |
| `qwen3.6:latest`               | varies       | varies        | No                   | No            | opencode agent — recognized config (LIMIT_SMALL); custom / user-tagged model, not on the upstream registry             | [`opencode/setup.js` OLLAMA_MODEL_CONFIGS](opencode/setup.js)                                 |
| _any other tag_                | —            | —             | depends              | No            | opencode auto-discovers any model `/api/tags` advertises; unrecognized tags get `OLLAMA_DEFAULT_CONFIG` (LIMIT_MEDIUM) | [`opencode/setup.js` OLLAMA_DEFAULT_CONFIG](opencode/setup.js)                                |

Sizes are approximate from the upstream [Ollama registry](https://ollama.com/library);
quantization choice (Q4_0 vs Q8_0) shifts VRAM by 30-50%, see
[`ollama.profile.bash`](ollama.profile.bash) for the per-platform `OLLAMA_KV_CACHE_TYPE`
tuning.

### Auto-pull policy

Only the autocomplete `-base` model is pulled automatically by [`ollama.sh`](ollama.sh):

- **Laptop** (battery detected by `is_system_laptop` in `run.sh`): `qwen2.5-coder:1.5b-base`.
- **Desktop** (no battery): `qwen2.5-coder:3b-base`.

The agent / chat models (`qwen2.5-coder:14b`, `qwen3-coder:30b`, etc.) are NOT
auto-pulled — they're large and host-specific. Pull them by hand on whichever box
should serve them:

```bash
ollama pull qwen2.5-coder:14b
ollama pull qwen3-coder:30b
```

Once pulled, both `getOllamaProviderInputs()` (opencode + Zed agent panel) and
`getAutocompleteProvider()` (Zed `edit_predictions`) will discover them via `/api/tags`
on the next setup run and wire them into the relevant config without any further edits.

### Host priority

Two different discoverers, two different priorities — by design.

| Discoverer                  | Used by                                                                               | Host priority              | Rationale                                                                                                                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getOllamaProviderInputs()` | opencode providers, Zed agent panel, VS Code Copilot Chat (`chatLanguageModels.json`) | **sy-omen45l → 127.0.0.1** | Agent / chat traffic is user-initiated and infrequent. Prefer the beefier remote box so the big models actually get to serve. VS Code registers EVERY reachable host (not just the first); opencode and Zed do the same for their provider panels. |
| `getAutocompleteProvider()` | Zed `edit_predictions`                                                                | **127.0.0.1 → sy-omen45l** | Inline autocomplete fires on every keystroke. Localhost (~sub-ms) beats LAN (~5-20ms+) and dodges network round-trips on the typing hot path.                                                                                                      |

When a host doesn't have a matching model, the discoverer falls through to the next
host. When no host has any matching model, the caller omits the relevant config block
entirely so the editor keeps whatever its own base config declares, instead of
hammering a dead endpoint on every keystroke. For Zed that means
`zed-config.jsonc`'s `edit_predictions.disabled_globs: ["**/*"]` survives and inline
predictions stay fully off — deliberately not Zed's cloud Zeta.

`sy-omen45l` resolves via `getSyHPOmenHomeIpAddress()` in
[`software/index.js`](../../../index.js), which reads the address from
[`ip-address.config`](../../../metadata/ip-address.config) — the single source of truth
for every home-network address. No LAN IP is hardcoded in any script. When that lookup
returns nothing (hostname removed, or the config unreadable), the remote host is simply
dropped from the probe list and only `127.0.0.1` is tried.

VS Code Copilot Chat reads `~/Library/Application Support/Code/User/chatLanguageModels.json`
on macOS (Linux equivalent: `~/.config/Code/User/chatLanguageModels.json`). The file's
schema is observed from VS Code's runtime — Microsoft has not published a stable spec.
See [`vs-code.js` `_buildChatLanguageModels`](../vs-code.js) JSDoc for the full caveat
and the merge rules: we own all `vendor: "ollama"` rows and re-derive them from
discovery on every run; entries from other vendors (Anthropic, OpenAI, Azure, etc.,
added via the Manage Models... UI) pass through untouched.

### Adding a new model

1. Pull it on at least one host: `ollama pull <name>`.
2. If it's a recognized chat model that needs a non-default context/output limit
   (the default is `LIMIT_MEDIUM`, 32k/4k), add it to `OLLAMA_MODEL_CONFIGS` in
   [`opencode/setup.js`](opencode/setup.js).
3. If it's a FIM autocomplete candidate (must be a `-base` variant carrying FIM
   tokens), add it to `AUTOCOMPLETE_MODELS` in [`llm-common.js`](llm-common.js)
   AND to the `is_system_desktop` tier ladder in [`ollama.sh`](ollama.sh).
4. Add a row to the table above with size, desktop-only flag, and code reference.
5. `bash run.sh --files=opencode/setup.js` (or `--files=zed.js`) to redeploy the
   matching config.

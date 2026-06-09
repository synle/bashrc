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

| Shared file                                                        | Consumed by                                                                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `_common/instructions.md`                                          | `~/.claude/CLAUDE.md`, `~/.copilot/AGENTS.md`, `~/.gemini/GEMINI.md`, `~/.config/opencode/AGENTS.md`    |
| `_common/commands/*.md`                                            | `~/.claude/commands/sy-*.md` (deployed) + `~/.config/opencode/commands/sy-*.md` (symlinked from Claude) |
| `<cli>/<cli>-keys.common.jsonc` + `<cli>/<cli>-keys.windows.jsonc` | Per-CLI keybinding files, with `OS_KEY` substituted per platform                                        |

Run all four CLIs end-to-end with:

```bash
bash run.sh --preset=llm
```

Run a single one:

```bash
bash run.sh --files="claude/setup.js"     # or copilot/, gemini/, opencode/
```

### Surface parity matrix

|              | Instructions                                                                                        | Slash commands                                                  | Keybindings                                                      | Managed settings              |
| ------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------- |
| **claude**   | ✅ `~/.claude/CLAUDE.md`                                                                            | ✅ `~/.claude/commands/sy-*.md`                                 | ✅ live `~/.claude/keybindings.json`                             | ✅ `~/.claude/settings.json`  |
| **copilot**  | ✅ `~/.copilot/AGENTS.md`                                                                           | ❌ no `~/.<cli>/commands/` slot (would need plugin manifest)    | ⚠️ build artifact only — binary has no keymap surface in v1.0.48 | ✅ `~/.copilot/settings.json` |
| **gemini**   | ✅ `~/.gemini/GEMINI.md`                                                                            | ❌ no `~/.<cli>/commands/` slot (would need extension manifest) | ✅ live `~/.gemini/keybindings.json`                             | ✅ `~/.gemini/settings.json`  |
| **opencode** | ✅ `~/.config/opencode/AGENTS.md` (own copy; also falls through to `~/.claude/CLAUDE.md` if absent) | ✅ symlinks from `~/.claude/commands/`                          | ✅ inline `keybinds` in `~/.config/opencode/tui.json`            | ✅ inline in `opencode.json`  |

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

| Intent                                 | claude                                    | copilot                      | gemini                                                       | opencode                                          |
| -------------------------------------- | ----------------------------------------- | ---------------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| Hide splash / banner                   | `spinnerTipsEnabled: false`               | `banner: "never"`            | `hideBanner: true`                                           | n/a                                               |
| Mute terminal bell                     | n/a                                       | `beep: false`                | n/a                                                          | n/a                                               |
| Reduce UI animations                   | `prefersReducedMotion: true`              | n/a                          | n/a                                                          | n/a                                               |
| Verbose transcript                     | `viewMode: "verbose"`                     | n/a                          | n/a                                                          | n/a                                               |
| Default model                          | `model: "claude-opus-4-7[1m]"`            | user-owned                   | user-owned                                                   | provider entries from `getOllamaProviderInputs()` |
| Extended thinking                      | `alwaysThinkingEnabled: true`             | n/a                          | n/a                                                          | n/a                                               |
| Auto-cleanup old sessions              | `cleanupPeriodDays: 30`                   | n/a                          | `general.sessionRetention: { enabled: true, maxAge: "30d" }` | n/a                                               |
| Skip dangerous-mode prompt             | `skipDangerousModePermissionPrompt: true` | n/a                          | n/a                                                          | n/a                                               |
| Compact paste in input                 | n/a                                       | `compactPaste: false`        | n/a                                                          | n/a                                               |
| Render markdown in TUI                 | n/a                                       | `renderMarkdown: true`       | n/a                                                          | n/a                                               |
| Hide inline tips                       | `spinnerTipsEnabled: false`               | n/a                          | `hideTips: true`                                             | n/a                                               |
| Show intent in tab title               | n/a                                       | `updateTerminalTitle: false` | n/a                                                          | n/a                                               |
| Auto-copy on select                    | n/a                                       | `copyOnSelect: false`        | n/a                                                          | n/a                                               |
| Auto-switch to auto mode on rate limit | n/a                                       | `continueOnAutoMode: true`   | n/a                                                          | n/a                                               |
| Reasoning effort                       | `alwaysThinkingEnabled: true`             | `effortLevel: "xhigh"`       | n/a                                                          | n/a                                               |
| Exclude gitignored from @ picker       | n/a                                       | `respectGitignore: true`     | `context.fileFiltering.respectGitIgnore: true`               | n/a                                               |
| Terminal progress indicator            | n/a                                       | `terminalProgress: true`     | n/a                                                          | n/a                                               |
| Tool output truncation                 | n/a                                       | n/a                          | n/a                                                          | `tool_output.max_lines: 3000`                     |
| Context compaction                     | n/a                                       | n/a                          | n/a                                                          | `compaction: { auto: true, tail_turns: 4 }`       |
| PR conflict resolution                 | n/a                                       | `mergeStrategy: "merge"`     | n/a                                                          | n/a                                               |
| Parallel tool calls                    | native                                    | n/a                          | n/a                                                          | `experimental.batch_tool: true`                   |
| Diff rendering style                   | n/a                                       | n/a                          | n/a                                                          | `diff_style: "stacked"`                           |
| Mute attention chime                   | n/a                                       | `beep: false`                | n/a                                                          | `attention.sound: false`                          |
| Disable in-session auto-update         | n/a                                       | `autoUpdate: false`          | `general.enableAutoUpdate: false`                            | `autoupdate: false`                               |
| Telemetry / usage-stats opt-out        | n/a                                       | n/a                          | `privacy.usageStatisticsEnabled: false`                      | n/a (consider `share: "disabled"`)                |
| Preserve Co-Authored-By trailer        | native (system prompt)                    | `includeCoAuthoredBy: true`  | native (no setting)                                          | native (no setting)                               |

**n/a** here means _the CLI does not expose a settings key for that intent
today_. Don't silently drop an intent if upstream later ships one — add the
key and update this table in the same edit.

### Editing rules

- **Instructions / rules**: edit `_common/instructions.md`, then re-run all four setup scripts (or `bash run.sh --preset=llm`).
- **Slash commands**: edit a file under `_common/commands/<name>.md` — every deploy (Claude direct + OpenCode symlink) picks it up on the next setup run.
- **Keybindings**: edit `<cli>/<cli>-keys.common.jsonc` for cross-platform chords, `<cli>/<cli>-keys.windows.jsonc` for Windows/Linux overrides. `OS_KEY` is substituted per-platform.
- **Settings**: extend the `<CLI>_MANAGED_SETTINGS` map in the matching `setup.js` AND update the intent table above so drift is visible at review time.
- **Adding a new CLI**: copy the structure of `gemini/` (live keybindings + instructions + settings) or `opencode/` (commands fallthrough via symlinks).

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

| From (Claude Code)                      | To (OpenCode)                                            | Notes                                                                                                                  |
| --------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `~/.claude/CLAUDE.md`                   | `~/.config/opencode/AGENTS.md`                           | Copy verbatim — same Markdown-as-system-prompt model. OpenCode falls through to Claude's file if absent.               |
| `~/.claude/commands/*.md`               | `~/.config/opencode/commands/*.md`                       | Same file format. Symlinking is safe and is what this repo does.                                                       |
| `~/.claude/skills/<name>/SKILL.md`      | ❌ no equivalent today                                   | OpenCode has no skills loader yet. Inline the SKILL.md into the matching slash command or fold rules into `AGENTS.md`. |
| `~/.claude/keybindings.json`            | `keybinds: { ... }` inside `~/.config/opencode/tui.json` | Schema differs — chord syntax is OpenCode-specific. Re-author rather than mechanically translate.                      |
| `~/.claude/settings.json`               | top-level keys inside `~/.config/opencode/opencode.json` | Single file holds providers, models, autoupdate, share-mode, experimental flags.                                       |
| `<repo>/CLAUDE.md`                      | `<repo>/AGENTS.md`                                       | OpenCode looks for `AGENTS.md` first. If you keep `CLAUDE.md` only, fallback works but is brittle.                     |
| `<repo>/.claude/skills/<name>/SKILL.md` | ❌ no equivalent today                                   | Same gap as global skills — inline the steps or convert to a slash command under `_common/commands/`.                  |
| `<repo>/.claude/settings.json` hooks    | ❌ no hook system today                                  | OpenCode has no PreToolUse/Stop/PostToolUse equivalent. Skill-able as wrapper scripts but not config-driven.           |
| `~/.claude/projects/.../memory/*.md`    | ❌ no auto-memory layer today                            | OpenCode has no persistent memory store. Anything load-bearing must move into `AGENTS.md`.                             |

### Claude Code → GitHub Copilot CLI

Copilot CLI is more divergent — it has instructions and settings, but **no
slash-command slot, no skills loader, and no live keymap surface** (as of
`v1.0.48`). You will lose ergonomics. Plan accordingly.

| From (Claude Code)                      | To (Copilot CLI)                    | Notes                                                                                                                      |
| --------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `~/.claude/CLAUDE.md`                   | `~/.copilot/AGENTS.md`              | Same Markdown-as-system-prompt model.                                                                                      |
| `~/.claude/commands/*.md`               | ❌ no `~/.copilot/commands/` slot   | Plugin manifest (`plugin.json` + `skills/<name>/`) is the only way today — heavyweight, requires `copilot plugin install`. |
| `~/.claude/skills/<name>/SKILL.md`      | ⚠️ plugin manifest required         | Possible via the plugin system; not worth the ceremony for personal use.                                                   |
| `~/.claude/keybindings.json`            | ❌ no live keymap config in v1.0.48 | This repo still builds a `copilot-keys.*.jsonc` artifact so the schema stays exercised for the day upstream ships one.     |
| `~/.claude/settings.json`               | `~/.copilot/settings.json`          | Different key names — see the settings-intent table above for the cross-CLI mapping.                                       |
| `<repo>/CLAUDE.md`                      | `<repo>/AGENTS.md`                  | Copilot CLI also reads `AGENTS.md` at the repo root.                                                                       |
| `<repo>/.claude/skills/<name>/SKILL.md` | ❌ no per-project skill slot        | Inline into `<repo>/AGENTS.md` or move to a wrapper script.                                                                |
| `<repo>/.claude/settings.json` hooks    | ❌ no hook system today             | Same gap as OpenCode.                                                                                                      |
| `~/.claude/projects/.../memory/*.md`    | ❌ no auto-memory layer today       | Same gap as OpenCode — anything load-bearing must move into `AGENTS.md`.                                                   |

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
  - `~/.copilot/AGENTS.md`
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
  `add-package`, `check`, `remove-os`, `remove-package`, `run`) are an example
  of repo-scoped playbooks — they ride with the repo's source rather than the
  global LLM-CLI deploy. The migration story for skills _into_ OpenCode/Copilot
  is the open gap noted in the migration tables above.

- **Auto-memory is Claude-Code-specific today.**
  `~/.claude/projects/<encoded-cwd>/memory/MEMORY.md` plus its linked files are
  read on every Claude Code turn but have no analogue in OpenCode/Copilot/Gemini.
  If you rely on memory for load-bearing context (preferences, project facts,
  feedback), promote it into `_common/instructions.md` before switching CLIs,
  or accept that the second CLI will start without it.

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
entirely so the editor falls back to its own default (Zeta for Zed) instead of
hammering a dead endpoint on every keystroke.

`sy-omen45l` resolves via `getSyHPOmenHomeIpAddress()` in
[`software/index.js`](../../../index.js), with `192.168.1.45` as the documented LAN
fallback when [`ip-address.config`](../../../metadata/ip-address.config) hasn't been
built yet.

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

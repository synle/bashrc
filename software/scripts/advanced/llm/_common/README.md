# LLM CLI setup — shared rules

Claude Code is the **base / foundation**. Every other CLI (Copilot, Gemini, OpenCode) derives its rules, slash commands, and ergonomics from the same source files in this folder. Each per-CLI `setup.js` is responsible for mapping the shared content onto whatever config surface that specific CLI exposes on disk.

## Single sources of truth

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

## Surface parity matrix

|              | Instructions                                                                                        | Slash commands                                                  | Keybindings                                                      | Managed settings              |
| ------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------- |
| **claude**   | ✅ `~/.claude/CLAUDE.md`                                                                            | ✅ `~/.claude/commands/sy-*.md`                                 | ✅ live `~/.claude/keybindings.json`                             | ✅ `~/.claude/settings.json`  |
| **copilot**  | ✅ `~/.copilot/AGENTS.md`                                                                           | ❌ no `~/.<cli>/commands/` slot (would need plugin manifest)    | ⚠️ build artifact only — binary has no keymap surface in v1.0.48 | ✅ `~/.copilot/settings.json` |
| **gemini**   | ✅ `~/.gemini/GEMINI.md`                                                                            | ❌ no `~/.<cli>/commands/` slot (would need extension manifest) | ✅ live `~/.gemini/keybindings.json`                             | ✅ `~/.gemini/settings.json`  |
| **opencode** | ✅ `~/.config/opencode/AGENTS.md` (own copy; also falls through to `~/.claude/CLAUDE.md` if absent) | ✅ symlinks from `~/.claude/commands/`                          | ✅ inline `keybinds` in `~/.config/opencode/tui.json`            | ✅ inline in `opencode.json`  |

Legend: ✅ wired, ⚠️ partial / awaiting upstream, ❌ unsupported by CLI today.

When upstream Copilot ships a keymap config or a `~/.copilot/commands/` slot, see the deferred-deploy comment at the bottom of `copilot/setup.js::_doCopilotKeysWork` — the merge already runs on every CI build so the schema stays exercised.

## Settings-intent table

Each `setup.js` has its own `<CLI>_MANAGED_SETTINGS` map because the literal key names differ (`banner` vs `hideBanner` vs `spinnerTipsEnabled`). The _intent_ is supposed to stay aligned across the four. Use this table when adding a new managed setting — implement it everywhere it has a meaning, and call out anywhere it can't be expressed.

| Intent                                 | claude                                    | copilot                      | gemini             | opencode                                          |
| -------------------------------------- | ----------------------------------------- | ---------------------------- | ------------------ | ------------------------------------------------- |
| Hide splash / banner                   | `spinnerTipsEnabled: false`               | `banner: "never"`            | `hideBanner: true` | n/a                                               |
| Mute terminal bell                     | n/a                                       | `beep: false`                | n/a                | n/a                                               |
| Reduce UI animations                   | `prefersReducedMotion: true`              | n/a                          | n/a                | n/a                                               |
| Verbose transcript                     | `viewMode: "verbose"`                     | n/a                          | n/a                | n/a                                               |
| Default model                          | `model: "claude-opus-4-7[1m]"`            | user-owned                   | user-owned         | provider entries from `getOllamaProviderInputs()` |
| Extended thinking                      | `alwaysThinkingEnabled: true`             | n/a                          | n/a                | n/a                                               |
| Auto-cleanup old sessions              | `cleanupPeriodDays: 30`                   | n/a                          | `general.sessionRetention: { enabled: true, maxAge: "30d" }` | n/a                                               |
| Skip dangerous-mode prompt             | `skipDangerousModePermissionPrompt: true` | n/a                          | n/a                | n/a                                               |
| Compact paste in input                 | n/a                                       | `compactPaste: false`        | n/a                | n/a                                               |
| Render markdown in TUI                 | n/a                                       | `renderMarkdown: true`       | n/a                | n/a                                               |
| Hide inline tips                       | `spinnerTipsEnabled: false`               | n/a                          | `hideTips: true`   | n/a                                               |
| Show intent in tab title               | n/a                                       | `updateTerminalTitle: false` | n/a                | n/a                                               |
| Auto-copy on select                    | n/a                                       | `copyOnSelect: false`        | n/a                | n/a                                               |
| Auto-switch to auto mode on rate limit | n/a                                       | `continueOnAutoMode: true`   | n/a                | n/a                                               |
| Reasoning effort                       | `alwaysThinkingEnabled: true`             | `effortLevel: "xhigh"`       | n/a                | n/a                                               |
| Exclude gitignored from @ picker       | n/a                                       | `respectGitignore: true`     | `context.fileFiltering.respectGitIgnore: true` | n/a                                               |
| Terminal progress indicator            | n/a                                       | `terminalProgress: true`     | n/a                | n/a                                               |
| Tool output truncation                 | n/a                                       | n/a                          | n/a                | `tool_output.max_lines: 3000`                     |
| Context compaction                     | n/a                                       | n/a                          | n/a                | `compaction: { auto: true, tail_turns: 4 }`       |
| PR conflict resolution                 | n/a                                       | `mergeStrategy: "merge"`     | n/a                | n/a                                               |
| Parallel tool calls                    | native                                    | n/a                          | n/a                | `experimental.batch_tool: true`                   |
| Diff rendering style                   | n/a                                       | n/a                          | n/a                | `diff_style: "stacked"`                           |
| Mute attention chime                   | n/a                                       | `beep: false`                | n/a                | `attention.sound: false`                          |
| Disable in-session auto-update         | n/a                                       | `autoUpdate: false`          | `general.enableAutoUpdate: false` | `autoupdate: false`                               |
| Telemetry / usage-stats opt-out        | n/a                                       | n/a                          | `privacy.usageStatisticsEnabled: false` | n/a (consider `share: "disabled"`)              |
| Don't append Co-Authored-By trailer    | n/a                                       | `includeCoAuthoredBy: false` | n/a                | n/a                                               |

**n/a** here means _the CLI does not expose a settings key for that intent today_. Don't silently drop an intent if upstream later ships one — add the key and update this table in the same edit.

## Editing rules

- **Instructions / rules**: edit `_common/instructions.md`, then re-run all four setup scripts (or `bash run.sh --preset=llm`).
- **Slash commands**: edit a file under `_common/commands/<name>.md` — every deploy (Claude direct + OpenCode symlink) picks it up on the next setup run.
- **Keybindings**: edit `<cli>/<cli>-keys.common.jsonc` for cross-platform chords, `<cli>/<cli>-keys.windows.jsonc` for Windows/Linux overrides. `OS_KEY` is substituted per-platform.
- **Settings**: extend the `<CLI>_MANAGED_SETTINGS` map in the matching `setup.js` AND update the intent table above so drift is visible at review time.
- **Adding a new CLI**: copy the structure of `gemini/` (live keybindings + instructions + settings) or `opencode/` (commands fallthrough via symlinks).

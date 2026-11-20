# OpenCode 1.x Setup Review and 2.x Migration

Audit performed 2026-11-20. Target state is a big-bang cutover to OpenCode 2 only. No V1 and V2 coexistence, no isolated preview prefix, and no V1 fallback command are part of this plan. The audit itself was read-only. A separate one-time cleanup later removed stale command links and duplicate MCP registrations.

## Scope and evidence

Findings below come from direct reads of the installed binary, the files under `~/.config/opencode/`, and the repository generator at `software/scripts/advanced/llm/opencode/setup.js`. Git history for the earlier V2 preview and canonical-V2 work was reviewed separately. Migration requirements come from the official OpenCode pages "Migrate from V1", "Migrate plugins from V1", "CLI settings", "Keybinds", "Permissions", and the current install commands. Items not verified are marked as such.

## Current state

- Installed version: OpenCode 1.19.6. Binary: `~/.local/bin/opencode` -> `~/.local/lib/node_modules/opencode-ai/bin/opencode.exe`. The npm package `package.json` also reports 1.19.6.
- `opencode upgrade --major` exists in this binary. Help text: "upgrade to OpenCode 2 and remove OpenCode 1".
- Global config `~/.config/opencode/opencode.json`:
  - `$schema: https://opencode.ai/config.json`
  - `autoupdate: false`
  - `permission: "allow"`
  - `compaction`: `auto: true`, `prune: true`, `reserved: 12000`
  - `tool_output`: `max_lines: 3000`, `max_bytes: 262144`
  - `small_model: github-copilot/gpt-5.5`
  - `lsp: true`, `formatter: false`
  - `instructions`: 9 files under `~/_extra/ai_llm/instructions/`, with `~persona.md` last
  - `share: "disabled"`
  - `watcher.ignore`: 54 patterns
  - `experimental`: `batch_tool: true`, `disable_paste_summary: false`
  - `plugin`: `["opencode-auto-continue"]`
  - `provider: {}` (empty; credentials resolve through the auth-store symlink)
  - `agent`: `general`, `plan`, `review`
  - `mcp`: 5 entries; no duplicate commands after cleanup
  - `subagent_depth: 2`
- `~/.config/opencode/tui.json`: 19 custom keybinds, leader `ctrl+o` with a 1500 ms timeout, `diff_style: "stacked"`, non-blinking block cursor, `theme: "sy"`, `scroll_speed: 3`, `scroll_acceleration.enabled: true`, notifications on, sound off, `prompt.max_height: 20`, plugin `~/.config/opencode/sy-ui-preferences.mjs`.
- `~/.config/opencode/plugins/sy-persona-reminder.js`: auto-discovered V1 server plugin. Hooks: `chat.message`, `experimental.chat.system.transform`, `experimental.session.compacting`, `event`.
- `~/.config/opencode/sy-ui-preferences.mjs`: V1 TUI plugin. Entry point is `export default { async tui(api) }` using `api.kv` and `api.keymap.dispatchCommand`.
- `~/.config/opencode/package.json`: `@opencode-ai/plugin` version 1.15.11.
- `~/.config/opencode/skills/`: 21 symlinks into `~/_extra/ai_llm/skills`. All resolve.
- `~/.config/opencode/commands/`: 21 `.md` symlinks. All resolve.
- `~/.config/opencode/agent/`: empty.
- `~/.config/opencode/themes/sy.json`: present.

## Resolved setup issues

Both issues below were one-time cleanup items. They are fixed in the current setup.

- Stale command links: the 23 links pointing at the retired `/Users/syle/sy/ai_llm/skills/` folder were removed. A bootstrap rerun recreated 21 links into `~/_extra/ai_llm/skills/`. Recheck found 0 dangling links.
- Duplicate MCP registrations: all 10 entries were removed from `opencode.json`. A bootstrap rerun recreated 5 unique servers. Recheck found 0 duplicate command groups.
- `provider: {}` is intentional. Credentials resolve through the auth-store symlink, so no edit is needed.

## Prior v2 migration work in git history

- `6f392c12 Add isolated OpenCode 2 preview` installed `opencode-ai@beta` into `~/.local/opencode-2`, exposed `opencode_2` and `op_2`, kept unprefixed `opencode` and `op` on V1, and refreshed model catalogs only under explicit refresh. It did not convert V1 configuration. That coexistence model is explicitly rejected for the current migration.
- `1db1bb98 Add OpenCode 2 preview and refresh LLM CLI updates` refreshed script indexes and added self-update flows for Claude, Copilot, and Pi. It added no V2 configuration conversion.
- `abb9e37e Make OpenCode v2 canonical` installed `opencode-ai@beta` as canonical `opencode`, removed the preview aliases, added `software/scripts/advanced/llm/migrate-opencode-v2.standalone.js`, registered that script in `software/metadata/script-list.config`, added V2 assertions to `software/tests/opencodeOllamaMetadata.spec.js`, and changed `docs/editor-keybindings.md` to say V2 is canonical.
- `software/scripts/advanced/llm/migrate-opencode-v2.standalone.js` moves only `~/.local/opencode-2` into a timestamped `~/.local/opencode-migrations/opencode-2-<ISO timestamp>` backup after checking that `~/.local/bin/opencode` exists. It leaves `~/.config/opencode`, `~/.local/share/opencode`, and credentials untouched. It is reusable as a one-time legacy-prefix cleanup template, not as a full V2 migration.
- `a9256946 revert back to opencode 1x` changed the install target from `opencode-ai@beta` to `opencode-ai@latest`. It did not revert the docs, migration script, script-list entry, or V2-flavored tests. Later test changes updated the package expectation to `@latest` while keeping V2 names in some test titles.
- The historical `opencode-ai@beta` target is stale. Current official V2 install commands are `curl -fsSL https://opencode.ai/v2/install | bash`, `brew install anomalyco/tap/opencode-v2`, `npm install -g @opencode/cli`, and AUR `opencode-beta`. Repo convention for LLM CLIs still prefers `npm_install_global`; the reusable npm target is `npm_install_global @opencode/cli opencode`, subject to verifying that the helper allows the required postinstall script.
- This machine has no `~/.local/opencode-2` and no `~/.local/opencode-migrations`. The legacy-prefix migration script would be a no-op here today.

## Repo inconsistencies to resolve

- `software/scripts/advanced/llm/opencode/install.sh` installs `opencode-ai@latest` (V1). It has no major-upgrade path and no self-update path.
- `docs/editor-keybindings.md:906` still says OpenCode 2 is canonical and instructs users to run `migrate-opencode-v2.standalone.js`.
- `software/metadata/script-list.config:60` still registers `software/scripts/advanced/llm/migrate-opencode-v2.standalone.js`.
- `software/tests/opencodeOllamaMetadata.spec.js:116-141` still contains V2 canonical and migration scaffolding. Its package assertion now expects `opencode-ai@latest`, while nearby titles still say "v2".
- `software/scripts/advanced/llm/migrate-opencode-v2.standalone.js` remains tracked. Its legacy-prefix move logic is still valid for old preview installs, but its comments and docs assume the retired beta-package flow.
- `software/scripts/advanced/llm/opencode/opencode.profile.bash` no longer has `opencode_2` or `op_2`. Lines 20-28 still pin V1.19.x Code Mode and Bash-timeout flags; recheck those flags under V2.
- Target state is V2 only. Update the installer to the current V2 package, remove V1 from the active setup, rewrite or retire the legacy migration script, and update the docs, tests, script list, profile, and generator together. Do not restore `opencode_2`, `op_2`, `~/.local/opencode-2`, or any V1 compatibility path.

## Migration path to OpenCode 2

OpenCode 2 has three intentional breaking changes: plugins, the server API and clients, and terminal client configuration. Upstream can normalize supported V1 configuration in memory. This repo will not rely on that compatibility layer after cutover.

1. Back up `~/.config/opencode` first. V1 and V2 use the same configuration locations. The backup is a rollback snapshot, not an active V1 install.
2. Remove the package-managed V1 install. Do not keep V1 binaries, aliases, wrappers, or an isolated V2 prefix active.
3. Install V2 from the current official source. Use `@opencode/cli` for npm, `https://opencode.ai/v2/install` for curl, `anomalyco/tap/opencode-v2` for Homebrew, or `opencode-beta` for AUR. Do not reuse the historical `opencode-ai@beta` target.
4. Convert generated configuration to native V2 shape before the cutover. `setup.js` must write `cli.json`, not `tui.json`, and must write V2-native `opencode.json`.
5. Port or drop plugins. V1 plugin implementations do not run in V2. Renaming a file or a config key is not sufficient.
6. Update integrations that call the server API. Use the `@opencode/client` package for V2.
7. Start the V2 TUI and validate models, credentials, agents, permissions, MCP servers, plugins, themes, and keybinds.

No V1 and V2 coexistence step exists in this plan. Do not point V1 at V2-only files, and do not leave a V1 command path available.

## Plugin ports

### sy-persona-reminder.js

Port to `Plugin.define` from `@opencode/plugin` with a stable `id` and `setup(ctx)`. Hook mapping:

| V1                                   | V2                                                               |
| ------------------------------------ | ---------------------------------------------------------------- |
| `chat.message`                       | `ctx.session.hook("prompt", ...)`                                |
| `experimental.chat.system.transform` | `ctx.session.hook("context", ...)` and edit `event.system`       |
| `experimental.session.compacting`    | `ctx.session.hook("compaction", ...)`                            |
| `event`                              | `ctx.event.subscribe()` with an AbortController cleanup function |

V2 system entries use `{ type: "text", text: "..." }`. The current plugin pushes plain strings, so that shape must change too. Update `~/.config/opencode/package.json` from `@opencode-ai/plugin` to `@opencode/plugin`.

Whether V2 auto-discovers a single-file plugin in the global `~/.config/opencode/plugins/` folder was not verified. Confirm after upgrade. Explicitly configured local plugin paths must be directories, for example `./plugin/sy-persona-reminder/index.ts`.

### sy-ui-preferences.mjs

The V1 `async tui(api)` entry point with `api.kv` and `api.keymap.dispatchCommand` does not run in V2. Port to `Plugin.define` from `@opencode/plugin/tui` using `context.storage.store` and `context.keymap.dispatch`, or remove the plugin.

Most managed preferences now have native `cli.json` fields:

| Current key                    | Native V2 setting         |
| ------------------------------ | ------------------------- |
| `diff_wrap_mode: "word"`       | `diffs.wrap: "word"`      |
| `scrollbar_visible: true`      | `session.scrollbar: true` |
| `paste_summary_enabled: true`  | `prompt.paste: "compact"` |
| `terminal_title_enabled: true` | `terminal.title: true`    |
| `sidebar: "hide"`              | `session.sidebar: "hide"` |

`timestamps` and `tool_details_visibility` have no documented native `cli.json` field. Confirm their V2 behavior before removing the plugin.

### opencode-auto-continue

This third-party npm plugin is cached at `~/.cache/opencode/packages/opencode-auto-continue`. V2 compatibility was not verified. Check upstream for a V2-compatible release. Plan to remove it if none exists.

## opencode.json field changes

These changes produce the native V2 shape. Existing V1 fields remain supported unless marked otherwise.

| Current                                                                 | V2 action                                                                                                                                                                   |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permission: "allow"`                                                   | Optional. The V2 base policy already allows every action. Add `{ "action": "read", "resource": "*.env", "effect": "allow" }` rules to preserve exact V1 allow-all behavior. |
| `subagent_depth: 2`                                                     | Move to `experimental.subagent_depth: 2`. Top-level use is ignored with a warning.                                                                                          |
| `compaction.reserved: 12000`                                            | `compaction.buffer: 12000`                                                                                                                                                  |
| `compaction.prune: true`                                                | No V2 equivalent. Ignored with a warning.                                                                                                                                   |
| `experimental.batch_tool: true`                                         | No V2 equivalent. Ignored with a warning.                                                                                                                                   |
| `autoupdate: false`                                                     | `update: "disable"`                                                                                                                                                         |
| `small_model: github-copilot/gpt-5.5`                                   | `agents.title.model`                                                                                                                                                        |
| `agent: {...}`                                                          | `agents: {...}`                                                                                                                                                             |
| Agent `permission.edit`, `permission.bash`                              | `permissions` array with actions `edit` and `shell`                                                                                                                         |
| `plugin: [...]`                                                         | `plugins: [...]`                                                                                                                                                            |
| `mcp.<name>.enabled: true`                                              | `mcp.servers.<name>.disabled: false`                                                                                                                                        |
| `provider: {}`                                                          | `providers: {}`                                                                                                                                                             |
| `logLevel` (not set)                                                    | `OPENCODE_LOG_LEVEL` environment variable                                                                                                                                   |
| `lsp: true`                                                             | Accepted but inactive. V2 does not run language servers or produce LSP diagnostics. Replace that workflow with project lint, typecheck, or compiler commands.               |
| `instructions`, `tool_output`, `watcher`, `formatter`, `share`, `model` | No change required.                                                                                                                                                         |

## Keybind changes

All 19 custom keybinds move from `tui.json` to `cli.json`, and every command ID changes.

| tui.json ID                  | cli.json ID                  |
| ---------------------------- | ---------------------------- |
| `session_rename`             | `session.rename`             |
| `leader`                     | `keybinds.leader`            |
| `editor_open`                | `prompt.editor`              |
| `messages_first`             | `session.first`              |
| `messages_last`              | `session.last`               |
| `messages_copy`              | `messages.copy`              |
| `input_newline`              | `input.newline`              |
| `input_line_home`            | `input.line.home`            |
| `input_line_end`             | `input.line.end`             |
| `input_buffer_home`          | `input.buffer.home`          |
| `input_buffer_end`           | `input.buffer.end`           |
| `input_clear`                | `prompt.clear`               |
| `session_compact`            | `session.compact`            |
| `input_undo`                 | `input.undo`                 |
| `input_paste`                | `prompt.paste`               |
| `input_delete_word_backward` | `input.delete.word.backward` |
| `command_list`               | `command.palette.show`       |
| `sidebar_toggle`             | `session.sidebar.toggle`     |
| `history_previous`           | `prompt.history.previous`    |

`prompt.paste` already defaults to `ctrl+v` with `preventDefault: false`, so that override can be dropped.

Other TUI setting changes:

| tui.json                                                         | cli.json                                      |
| ---------------------------------------------------------------- | --------------------------------------------- |
| `mouse`                                                          | `mouse`                                       |
| `scroll_speed: 3`                                                | `scroll.speed: 3`                             |
| `scroll_acceleration.enabled: true`                              | `scroll.acceleration: true`                   |
| `attention.enabled`                                              | Removed                                       |
| `attention.notifications`, `attention.sound`, `attention.volume` | Same names under `attention`                  |
| `cursor`                                                         | `cursor`                                      |
| `leader_timeout: 1500`                                           | `leader.timeout: 1500`                        |
| `theme: "sy"`                                                    | `theme.name: "sy"`                            |
| `plugin`                                                         | `plugins`                                     |
| `diff_style: "stacked"`                                          | Nearest equivalent: `diffs.view: "unified"`   |
| `prompt.max_height: 20`                                          | No V2 equivalent found. Verify in the V2 TUI. |

## Repository generator changes

`software/scripts/advanced/llm/opencode/setup.js` writes the V1 shapes. Because the cutover is V2-only, the generator must become the source of truth for V2-native `opencode.json`, `cli.json`, plugins, and keybinds. Hand-converted files will be overwritten on the next setup run until the generator changes. Line numbers reflect the tree on 2026-11-20.

- Lines 83-276: `watcher.ignore` and `_buildOpencodeConfig`; global `opencode.json` is written at lines 844-867.
- Lines 324-435: `_writeOpencodeTuiConfig`, including `tui.json` defaults, keybinds, and the generated `sy-ui-preferences.mjs` source.
- Lines 445-459: `_loadOpencodeKeybinds`.
- Lines 791-836: `sy-persona-reminder.js` deployment.
- `software/scripts/advanced/llm/opencode/install.sh:12-16`: current V1 install target.
- `software/scripts/advanced/llm/opencode/opencode.profile.bash:20-28`: V1-specific wrapper flags.

Keybind sources also live in `software/scripts/advanced/llm/opencode/opencode-keys.common.jsonc` and `opencode-keys.windows.jsonc` through `_loadOpencodeKeybinds`.

## Verification checklist

- Back up `~/.config/opencode` before cutover.
- Target state is V2 only; reject any V1 fallback, dual-install, or coexistence path in docs, tests, scripts, or generated config.
- Verify that `npm_install_global @opencode/cli opencode` allows the required postinstall script and mirrors correctly under WSL.
- Remove the package-managed V1 install and confirm `opencode` resolves to V2, not `opencode-ai`.
- Install V2 from a current official source; do not use `opencode-ai@beta`.
- Check `~/.local/opencode-2`. Back it up if present; never activate it. The prefix is absent on this machine today.
- Confirm no `opencode_2` or `op_2` aliases remain.
- Confirm `setup.js` emits V2-native `opencode.json` and `cli.json`, and no longer emits `tui.json`.
- Start V2 and inspect the generated `~/.config/opencode/cli.json`.
- Confirm model, credential, agent, permission, and MCP behavior.
- Confirm which plugins load. Port or drop the three listed above.
- Confirm the 19 keybinds in the V2 TUI.
- Recheck the V1.19.x Code Mode and Bash-timeout flags in `opencode.profile.bash` under V2.
- Confirm whether the `sy` theme renders from the existing `themes/sy.json`.
- Confirm command links and MCP registrations stay clean after future setup runs.
- Update the generator before any full setup run.

## Sources

- <https://opencode.ai/docs/>
- <https://opencode.ai/v2/install>
- <https://opencode.ai/docs/migrate-v1/>
- <https://opencode.ai/docs/build/plugins/migrate-v1/>
- <https://opencode.ai/docs/build/plugins/cli/>
- <https://opencode.ai/docs/cli/config/>
- <https://opencode.ai/docs/cli/keybinds/>
- <https://opencode.ai/docs/permissions/>
- <https://opencode.ai/config.json>

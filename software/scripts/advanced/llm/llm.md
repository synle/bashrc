# LLM CLI & Ollama Model Reference

Single source of truth for the five LLM CLIs we provision (Claude Code, GitHub
Copilot CLI, Google Gemini CLI, OpenCode, Pi). Ollama model names live in
[`llm-models.jsonc`](llm-models.jsonc). Keep this file in sync with the linked code any time
a CLI surface, managed setting, or model is added, renamed, or dropped. If this
file and the code disagree, the code wins — but file an edit so the next reader
doesn't have to chase references.

---

## Part 1 — LLM CLI setup (shared rules)

Claude Code is the **base / foundation**. Every other CLI (Copilot, Gemini, OpenCode, Pi) derives its rules, slash commands, and ergonomics from the same active source files in `_common/v_current/`. Shared runtime helpers and MCP configuration remain in `_common/`. Each per-CLI `setup.js` is responsible for mapping the shared content onto whatever config surface that specific CLI exposes on disk.

### Single sources of truth

| Shared source                                                      | Consumed by                                                                                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `_common/v_current/instructions.md`                                | `~/.claude/CLAUDE.md`, `~/.copilot/copilot-instructions.md`, `~/.gemini/GEMINI.md`, `~/.config/opencode/AGENTS.md`, `~/.pi/agent/AGENTS.md`                  |
| `_common/v_current/skills/*.md`                                    | One copy under `~/_extra/ai_llm/skills/sy-*/SKILL.md`; client discovery links come from `LLM_SKILL_LINK_FOLDERS`. OpenCode also receives its command mirror. |
| Review and babysit PR memory                                       | `~/_extra/ai_llm/pr_reviews/` and `~/_extra/ai_llm/pr_babysits/`                                                                                             |
| `_common/mcp-servers.jsonc`                                        | Client destinations in the surface matrix below; shared selection and deployment preserve user-only entries.                                                 |
| `<cli>/<cli>-keys.common.jsonc` + `<cli>/<cli>-keys.windows.jsonc` | Per-client keybinding files, with `OS_KEY` substituted per platform.                                                                                         |

**Every deployed doc above is read through `readLLMDocSource()`, never `readText` directly.**
That reader resolves the `<<LLM_ROOT_FOLDER>>` / `<<SY_ROOT_FOLDER>>` path placeholders to this
machine's real folders on the way out. A repo source must not hardcode `~/_extra/ai_llm/...`
— that re-spells a folder `common-env.sh` already declares, and is wrong outright on a
machine with a different home layout — and must not carry `$LLM_ROOT_FOLDER` either, since
the agent reading the deployed file has no shell expanding anything and an unexpanded
variable inside a `mkdir -p` writes at the filesystem root. Repo-local docs (this file,
`AGENTS.md`, `docs/`, `.agents/skills/`) keep the literal path instead: nothing resolves
them, so a placeholder there would never expand. `llmInstructionsSplit.spec.js` fails the
build on a hardcoded path in a deployed source, on a placeholder that survives resolution,
and on a deployed doc read with bare `readText`.

Run the broad LLM preset with:

```bash
./run --preset=llm
```

Run a single one:

```bash
./run --files="claude/setup.js"     # or copilot/, gemini/, opencode/, pi/
```

### Surface parity matrix

| Client   | Instructions                         | Skills                                           | Keybindings                             | Managed settings                   | MCP servers                              |
| -------- | ------------------------------------ | ------------------------------------------------ | --------------------------------------- | ---------------------------------- | ---------------------------------------- |
| Claude   | `~/.claude/CLAUDE.md`                | `~/.claude/skills/`                              | `~/.claude/keybindings.json`            | `~/.claude/settings.json`          | `~/.claude.json::mcpServers`             |
| Copilot  | `~/.copilot/copilot-instructions.md` | `~/.copilot/skills/`                             | Build artifact only                     | `~/.copilot/settings.json`         | `~/.copilot/mcp-config.json::mcpServers` |
| Gemini   | `~/.gemini/GEMINI.md`                | `~/.agents/skills/`                              | `~/.gemini/keybindings.json`            | `~/.gemini/settings.json`          | `~/.gemini/settings.json::mcpServers`    |
| OpenCode | `~/.config/opencode/AGENTS.md`       | `~/.config/opencode/skills/` plus command mirror | `~/.config/opencode/tui.json::keybinds` | `~/.config/opencode/opencode.json` | `opencode.json::mcp`                     |
| Pi       | `~/.pi/agent/AGENTS.md`              | `~/.agents/skills/`                              | `~/.pi/agent/keybindings.json`          | `~/.pi/agent/settings.json`        | `~/.pi/agent/mcp.json::mcpServers`       |

Named PR workers are retired; client setup retains their cleanup pass.

### Per-turn persona reminders

- Claude Code, Gemini CLI, and Pi receive a short persona reminder before every user-driven agent turn through their documented prompt hooks.
- Copilot CLI receives reminder context at session start and resume. Its user-level command hooks cannot inject context on every prompt; `userPromptTransformed` mutation is supported only by SDK hooks.
- OpenCode setup deploys `plugins/sy-persona-reminder.js`, which refreshes reminder context before model calls and preserves it during compaction.
- All reminders point to the same rule: chat progress, status, and completion messages are user replies; only external deliverables are exempt.

Legend: ✅ wired, ⚠️ partial / awaiting upstream, ❌ unsupported by CLI today.

When upstream Copilot ships a keymap config or a `~/.copilot/commands/` slot,
see the deferred-deploy comment at the bottom of
`copilot/setup.js::_doCopilotKeysWork` — the merge already runs on every CI
build so the schema stays exercised.

### Shared Sy themes

Canonical sources live in `theme/sy/<app>_{dark,light}.jsonc`; foundations and recipes live in `theme/sy/_palette_{dark,light}.jsonc`.
Setup scripts use `readSyTheme(app, mode)` and the shared `shouldInstallCustomTheme("terminal")` gate.
Terminal interfaces remain themeable over SSH; `IS_CUSTOM_THEME_DISABLED=1` selects native/registry fallbacks without deleting existing theme files.

| Client   | Managed source and selection                                                                                             | Existing explicit selections                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Claude   | Native overrides deployed as `~/.claude/themes/sy-{dark,light}.json`; settings use `custom:sy-dark` / `custom:sy-light`. | Existing family migration behavior and light appearance are retained.                                                        |
| Pi       | Both native themes deployed under `~/.pi/agent/themes/`; default pair is light first, `Sy Light/Sy Dark`.                | Foreign selections remain unchanged; native `system` is the opt-out fallback.                                                |
| OpenCode | CLI native roles merged into paired `~/.config/opencode/themes/sy.json`; TUI selection is `sy`.                          | Foreign IDs remain unchanged; the registry owns the native fallback ID.                                                      |
| Gemini   | Both sources merged into `ui.customThemes`; a missing selection defaults to Sy Dark.                                     | Foreign themes and unrelated custom theme entries remain unchanged; native fallback preserves managed light/dark appearance. |
| Copilot  | No verified custom-theme import contract.                                                                                | Existing native palette choice is preserved; no fake Sy adapter is created.                                                  |

Claude uses native dark/light bases; unexposed native tokens can still inherit those defaults.
Its disabled GUI fallback remains the independent inline Ayu adapters. Opted-out headless sessions use native dark/light.
The terminal application still controls default terminal background and ANSI colors.

Gemini's captured custom-theme loader recomputes input/message/focus fills and couples border/UI-dark color through legacy `DarkGray`.
Gemini 0.64 settings reject `ui.active` and `ui.focus`. Sources use the supported `AccentGreen` focus fallback, preserving focus colors separately from `status.success`.
Automatic switching between custom Gemini themes is not assumed.

For new feature colors, follow `theme/README.md` → Required workflow for new feature colors.
Reuse semantic roles/variants or add them to both foundations, bind supported fields in both client templates, then run `make format_build_include`.
Client setup code only loads/renders/deploys those sources; it must not invent a second Sy palette or silently accept unsupported native fields.
Theme pairs are loaded and validated before managed selection is changed. Native output names remain stable for the existing integrations.

### Settings-intent table

Each `setup.js` has its own `<CLI>_MANAGED_SETTINGS` map because the literal key names differ (`banner` vs `hideBanner` vs `spinnerTipsEnabled`). The _intent_ is supposed to stay aligned across the four. Use this table when adding a new managed setting — implement it everywhere it has a meaning, and call out anywhere it can't be expressed.

| Intent                                 | claude                                                   | copilot                               | gemini                                                       | opencode                                          |
| -------------------------------------- | -------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| JSONC theme adapters                   | native Sy overrides / registry fallback                  | native palette only                   | `ui.customThemes`, preserve foreign selection                | paired native `sy` theme, preserve foreign ID     |
| Hide splash / banner                   | `spinnerTipsEnabled: false`                              | `banner: "never"`                     | `hideBanner: true`                                           | n/a                                               |
| Mute terminal bell                     | n/a                                                      | `beep: false`                         | n/a                                                          | n/a                                               |
| Reduce UI animations                   | `prefersReducedMotion: true`                             | n/a                                   | n/a                                                          | n/a                                               |
| Verbose transcript                     | `viewMode: "verbose"`                                    | n/a                                   | n/a                                                          | n/a                                               |
| Default model                          | `model: "claude-opus-4-7"` (native context)              | user-owned                            | user-owned                                                   | provider entries from `getOllamaProviderInputs()` |
| Extended thinking                      | `alwaysThinkingEnabled: true`                            | n/a                                   | n/a                                                          | n/a                                               |
| Auto-cleanup old sessions              | `cleanupPeriodDays: 30`                                  | n/a                                   | `general.sessionRetention: { enabled: true, maxAge: "30d" }` | n/a                                               |
| Skip dangerous-mode prompt             | `skipDangerousModePermissionPrompt: true`                | n/a                                   | n/a                                                          | n/a                                               |
| Compact paste in input                 | n/a                                                      | `compactPaste: false`                 | n/a                                                          | n/a                                               |
| Render markdown in TUI                 | n/a                                                      | `renderMarkdown: true`                | n/a                                                          | n/a                                               |
| Hide inline tips                       | `spinnerTipsEnabled: false`                              | n/a                                   | `hideTips: true`                                             | n/a                                               |
| Show intent in tab title               | n/a                                                      | `updateTerminalTitle: false`          | n/a                                                          | n/a                                               |
| Auto-copy on select                    | n/a                                                      | `copyOnSelect: false`                 | n/a                                                          | n/a                                               |
| Auto-switch to auto mode on rate limit | n/a                                                      | `continueOnAutoMode: true`            | n/a                                                          | n/a                                               |
| Reasoning effort                       | `alwaysThinkingEnabled: true`                            | `effortLevel: "xhigh"`                | n/a                                                          | n/a                                               |
| Exclude gitignored from @ picker       | n/a                                                      | `respectGitignore: true`              | `context.fileFiltering.respectGitIgnore: true`               | n/a                                               |
| Terminal progress indicator            | n/a                                                      | `terminalProgress: true`              | n/a                                                          | n/a                                               |
| Tool output truncation                 | n/a                                                      | n/a                                   | n/a                                                          | `tool_output.max_lines: 3000`                     |
| Context compaction                     | n/a                                                      | n/a                                   | n/a                                                          | `compaction: { auto, prune, reserved }`           |
| PR conflict resolution                 | n/a                                                      | `mergeStrategy: "merge"`              | n/a                                                          | n/a                                               |
| Parallel tool calls                    | native                                                   | n/a                                   | n/a                                                          | `experimental.batch_tool: true`                   |
| Diff rendering style                   | n/a                                                      | n/a                                   | n/a                                                          | `diff_style: "stacked"`                           |
| Mute attention chime                   | n/a                                                      | `beep: false`                         | n/a                                                          | `attention.sound: false`                          |
| Disable in-session auto-update         | n/a                                                      | `autoUpdate: false`                   | `general.enableAutoUpdate: false`                            | `autoupdate: false`                               |
| Telemetry / usage-stats opt-out        | n/a                                                      | n/a                                   | `privacy.usageStatisticsEnabled: false`                      | n/a (consider `share: "disabled"`)                |
| Preserve Co-Authored-By trailer        | native (system prompt)                                   | `includeCoAuthoredBy: true`           | native (no setting)                                          | native (no setting)                               |
| Commit/PR attribution opt-out          | `attribution: { commit: "", pr: "", sessionUrl: false }` | n/a                                   | n/a                                                          | n/a                                               |
| MCP servers (shared registry)          | `mcpServers` in `settings.json`                          | `mcpServers` in `mcp-config.json`     | `mcpServers` in `settings.json`                              | `mcp` in `opencode.json` (translated)             |
| Desktop attention notification         | native (no setting)                                      | `notifications: true`                 | n/a                                                          | `attention.notifications: true`                   |
| Per-tool duration in transcript        | n/a                                                      | `showToolDurations: true`             | n/a                                                          | n/a                                               |
| Log verbosity                          | n/a                                                      | `logLevel: "warning"`                 | n/a                                                          | n/a                                               |
| Concise tool transcript                | n/a                                                      | `transcriptView: "concise"`           | n/a                                                          | n/a                                               |
| Startup tips off                       | n/a                                                      | `showTipsOnStartup: false`            | n/a                                                          | n/a                                               |
| Adversarial planning agent             | n/a                                                      | `builtInAgents.rubberDuck: true`      | n/a                                                          | `agent.review` (subagent, edit denied)            |
| Pre-approved fetch hosts               | n/a                                                      | `allowedUrls` (union, additive)       | n/a                                                          | n/a (`permission: "allow"` covers webfetch)       |
| Per-role agent models                  | n/a                                                      | n/a                                   | n/a                                                          | `agent` from `AGENT_TO_MODEL_MAP`                 |
| Language servers (diagnostics)         | native                                                   | native                                | native                                                       | `lsp: true` (omitted = DISABLED)                  |
| Code formatters on edit                | native (hooks)                                           | native                                | native                                                       | `formatter: true` (omitted = DISABLED)            |
| Load split PR-workflow rules           | native (`@` import budget)                               | symlink in `~/.copilot/instructions/` | native                                                       | `instructions: [~/_extra/ai_llm/instructions/…]`  |
| Terminal cursor style                  | n/a                                                      | n/a                                   | n/a                                                          | `cursor: { style: "block" }`                      |
| Leader-chord timeout                   | n/a                                                      | n/a                                   | n/a                                                          | `leader_timeout: 1500`                            |
| Prompt textarea height cap             | n/a                                                      | n/a                                   | n/a                                                          | `prompt.max_height: 20`                           |

**n/a** here means _the CLI does not expose a settings key for that intent today_. Don't silently drop an intent if upstream later ships one — add the key and update this table in the same edit.

### Editing rules

- **Instructions / rules**: edit `_common/v_current/instructions.md`, then re-run all four setup scripts (or `./run --preset=llm`).
- **Slash commands**: edit a file under `_common/v_current/skills/<name>.md` — every deploy (Claude direct + Copilot skills + OpenCode symlink) picks it up on the next setup run. **Adding / renaming / retiring** one is a single edit to `LLM_COMMAND_DEPLOY_MAP` (or `LLM_COMMAND_RETIRED_NAMES`) in `llm-common.js` — that one map is the registry every CLI setup reads, so there is no per-CLI list to keep in sync.
- **Named agents**: PR worker personas are retired. Keep `LLM_AGENT_DEPLOY_MAP` empty and retain the shared retirement pass in every client setup.
- **Keybindings**: edit `<cli>/<cli>-keys.common.jsonc` for cross-platform chords, `<cli>/<cli>-keys.windows.jsonc` for Windows/Linux overrides. `OS_KEY` is substituted per-platform.- **Settings**: extend the `<CLI>_MANAGED_SETTINGS` map in the matching `setup.js` AND update the intent table above so drift is visible at review time.
- **MCP servers**: edit `_common/mcp-servers.jsonc` (standard `mcpServers` shape). Each per-CLI `setup.js` deploys eligible entries additively and preserves user-only entries. Registry-only `excludeClients` omits named clients and never reaches native configuration. Removing or excluding a name does not delete existing deployed entries.
- **Adding a new CLI**: copy the structure of `gemini/` (live keybindings + instructions + settings) or `opencode/` (commands fallthrough via symlinks).

### Experimental pi-lens MCP

**TODO: EXPERIMENTAL pi-lens MCP** — verify workspace selection and semantic diagnostics
in each interactive client and on Linux/WSL/Windows before treating this as a production integration.
Automatic per-edit and turn-end hooks remain deferred.

`pi-lens.sh` installs the standalone `pi-lens-mcp` executable without requiring Pi.
The installer and Pi plugin bootstrap share the reviewed package pin in
`_common/pi-lens.common.bash`. The standalone installer also provisions pinned TUI and
schema peers because the published MCP server imports them despite optional peer metadata.
Node >=22.19.0 is required. npm lifecycle scripts remain disabled; the installer forwards
that policy through WSLENV for mirrored Windows installs.
The shared registry enables MCP for Claude, Copilot, Gemini, and OpenCode.
Pi keeps its native extension; registry exclusions prevent adding duplicate MCP tools.
Existing user-created Pi MCP entries remain untouched.

Install and deploy narrowly:

```bash
./run --files="pi-lens.sh,claude/setup.js,copilot/setup.js,gemini/setup.js,opencode/setup.js,pi/setup.js"
```

The broad installation alternative is `./run --preset=llm`.
Run the narrow command twice to check repeatability, then restart the affected clients.

The server uses its launch working folder unless `--cwd=` or `PI_LENS_MCP_CWD` overrides it.
Do not put a fixed checkout in global configuration.
Verify the reported workspace before analysis; use an explicit absolute `cwd` in tools that accept it.
A connected server or successful tools/list response does not prove correct workspace selection.

For clients using MCP, request semantic navigation with `pilens_lsp_navigation`,
read symbols with `pilens_read_symbol`, and check edited files with `pilens_diagnostics`
using `source: "lsp"`.
Use `pilens_session_start` to initialize the project and keep the server warm.
MCP provides callable tools, not Pi's automatic edit-time findings injection.
Cold, timed-out, skipped, or unsupported analysis is not a clean result.
Keep ordinary tests and build checks; semantic diagnostics do not replace them.

Acceptance check: use a disposable typed project, find a known symbol, and report a seeded
type error from the same workspace.
Repeat in each client; record untested clients and platforms explicitly.
Do not invoke MCP rebuild or mutation tools merely to test connectivity.

### Pull-request watching after the rollback

The active guidance restores the pre-scheduler workflows. Use `sy-babysit-pr` for an owned PR and `sy-review-pr` for another author's PR.
Their plural workflows handle fan-out; each dispatcher owns its clock and passes `pass=single` to its workers.
Creating a PR does not start babysitting. Watch loops still require an explicit request.

The shared scheduler and execute-plan commands are retired. Their sources are no longer active, and deployment removes managed leftovers.
The restored workflows do not expose the removed readiness-goal or all-feedback modes.
Read the active single-PR skill for current repair, posting, approval, and automerge rules.
A quiet probe does not replace keepalive or final verification.

### Retired named workers

No named PR worker personas are deployed. Run the review or babysit skill directly; fan-out workflows select available workers by behavior.
The agent registry remains empty. Each client setup still calls the shared deployer to retire prior managed artifacts.
Cleanup preserves foreign files, folders, and links. Restart clients after deployment before checking their discovery inventories.
The chat-style persona and its reminder hooks remain separate and unchanged.

### OpenCode experimental Code Mode

The `opencode` wrapper (also exposed as `op`) defaults
`OPENCODE_EXPERIMENTAL_CODE_MODE` to `1` for the launched process. The installed
OpenCode 1.19.3 binary recognizes this experimental flag and conditionally loads
its native Code Mode tool; no additional plugin or JSON setting is required.
Direct `command opencode` invocations bypass the wrapper's default.

Disable it for one invocation with:

```bash
OPENCODE_EXPERIMENTAL_CODE_MODE=0 opencode
```

The wrapper preserves explicit overrides and does not export its default into the
calling shell. Restart OpenCode after refreshing the profile; existing processes
retain their startup environment.

Code Mode can reduce model round trips by composing tool calls in JavaScript.
Batch related calls, parallelize only independent work, and filter results before
returning them to the model. Await dependent calls in order and retain errors and
necessary evidence. Pi's `tools.read(...)` and `text(...)` examples are not a
verified OpenCode scripting API: use the runtime's exposed tool schema instead.
Neither individual-tool speedups nor Pi-equivalent UI rendering are guaranteed;
native interactive execution and performance parity remain unverified.

### OpenCode managed command-palette preferences

`opencode/setup.js` registers the local `sy-ui-preferences.mjs` plugin in `tui.json`.
The OpenCode 1.19.3 TUI schema has no direct fields for these persisted command-palette preferences:

| Preference     | Explicit startup value          |
| -------------- | ------------------------------- |
| Diff wrapping  | `diff_wrap_mode: "word"`        |
| Scrollbar      | `scrollbar_visible: true`       |
| Paste summary  | `paste_summary_enabled: true`   |
| Timestamps     | `timestamps: "show"`            |
| Terminal title | `terminal_title_enabled: true`  |
| Sidebar        | `sidebar: "hide"`               |
| Tool details   | `tool_details_visibility: true` |

The plugin uses native commands for paste-summary and terminal-title controls, then writes only managed values through the native KV API.
Deployment never edits a running session's `kv.json` directly.
Unrelated plugins and saved preferences, including animations, thinking mode, and theme selection, remain unchanged.
Command-palette changes remain available during a session; the plugin reapplies managed values on the next startup.

Refresh with `./run --files="advanced/llm/opencode/setup.js"` or the broader `./run --preset=llm`, then restart OpenCode.
Existing sessions keep their loaded plugins and local state.

### OpenCode nested dispatch

For OpenCode 1.19.3, bootstrap generates top-level `subagent_depth: 2` and
`agent.general.permission.task: "allow"`. This permits primary → general dispatcher
→ worker while blocking further nesting. The general agent inherits its model;
reviewer and local-agent permissions remain unchanged. Agent policy lives in
`AGENT_TO_MODEL_MAP` in `llm-common.js`; the depth limit lives in `opencode/setup.js`.

Native `task` is separate from Code Mode, whose discovery covers connected MCP
tools only. A missing Code Mode entry does not prove that native `task` is absent.
Refresh with `./run --files="advanced/llm/opencode/setup.js"` (or the broader
`./run --preset=llm`), then restart OpenCode. Existing child sessions may
retain persisted task-deny rules; configuration changes do not clear those rules.
Do not recreate existing workers to bypass that restriction. Before resuming an
existing handle, verify it exists: OpenCode 1.19.3 can create a new child when
`task_id` lookup fails. This configuration does not enable experimental background
subagents or resume a stopped watch.

### Using the MarkItDown CLI

Microsoft's [MarkItDown](https://github.com/microsoft/markitdown) converts documents
such as PDF, DOCX, XLSX, and PPTX into Markdown. The advanced Bash profile defines
`markitdown` only when a `uvx` executable is on PATH. It runs
`uvx --python 3.12 --from "markitdown[all]" markitdown` on demand, using an isolated
tool environment. Python 3.12 matches `advanced/uv.venv-python.sh`; uv caches the
dependencies after the first invocation.

```bash
markitdown "input.docx" -o "output.md"
markitdown "input.docx" "output.md"
markitdown "input.pdf" # Markdown on stdout
markitdown --help
```

Exactly two non-option arguments select the input/output shorthand. Other arguments
are forwarded unchanged to the CLI. Conversion reads the source and writes Markdown;
it does not edit Office files or create PDFs. Optional cloud conversion flags and
plugins retain their upstream behavior.

Agents whose shells do not load the advanced profile (including sessions with
`CLAUDECODE=1`) should invoke the underlying command directly:

```bash
uvx --python 3.12 --from "markitdown[all]" markitdown "input.docx" -o "output.md"
```

The shared MCP registry no longer includes MarkItDown. Existing installations use
additive config merges, so remove only the old `markitdown` entry from these maps
after checking it still launches `markitdown-mcp`:

- `~/.claude/settings.json`: `mcpServers.markitdown`
- `~/.copilot/mcp-config.json`: `mcpServers.markitdown`
- `~/.gemini/settings.json`: `mcpServers.markitdown`
- `~/.config/opencode/opencode.json`: `mcp.markitdown`

Preserve the remaining configuration and restart the affected CLI after cleanup.

### Using the Playwright MCP server

Microsoft's [`@playwright/mcp`](https://github.com/microsoft/playwright-mcp)
ships in the shared registry and deploys to all four CLIs. It gives the agent
**browser automation** over STDIO — navigate, click, type, fill forms,
screenshot, and capture accessibility snapshots — handy for debugging the repo's
own `webapp/` or any web task.

- **Runtime**: launched as `npx -y @playwright/mcp@latest --headless --isolated`
  on WSL/Linux/Windows, and as `npx -y @playwright/mcp@latest` (headed,
  persistent profile) on macOS.
  `node`/`npx` are installed cross-OS by the repo; the **first** call fetches the
  package, and the **first browser launch** downloads Chromium into
  ms-playwright's cache (`~/Library/Caches/ms-playwright` on mac,
  `~/.cache/ms-playwright` on linux). If a run reports a missing browser, run
  `npx playwright install chromium` once.
- **Flags per OS**: off macOS, `--headless` (works on WSL/Linux/servers with no
  display) and `--isolated` (in-memory profile — never reuses personal browser
  sessions). On macOS the registry's `argsOnMac` drops both: the window is
  visible so you can approve Okta / Touch ID SSO, and a Playwright-owned
  persistent profile (not your personal browser) keeps that login across
  sessions. `argsOnMac` is registry-only — `loadSharedMcpServers` swaps it in
  on macOS and strips it everywhere, so no CLI config ever contains it.
  To change either variant, edit the registry entry, not the deployed
  file (this name is registry-managed, so a hand edit to the deployed config is
  overwritten on the next setup run).
- **How to invoke** — ask the agent in plain language:
  - `"Open http://localhost:5173 and give me the accessibility snapshot"`
  - `"Click the Sign in button and screenshot the result"`
  - `"Fill the contact form and submit it, then report any console errors"`
- **Not a security boundary** (upstream's words). It never uses your personal
  browser profile — `--isolated` off macOS, a Playwright-owned profile on macOS
  (which does persist SSO cookies; log out of a site to end that session);
  `--allow-unrestricted-file-access` is deliberately NOT set,
  so file access stays within the workspace roots.
- **Verify it's wired up** (per CLI, after a setup run):
  - Claude / Gemini → `mcpServers.playwright` in `~/.claude/settings.json` /
    `~/.gemini/settings.json`
  - Copilot → `mcpServers.playwright` in `~/.copilot/mcp-config.json`
  - OpenCode → `mcp.playwright` in `~/.config/opencode/opencode.json`
    (translated `{ type: "local", command: ["npx", …], enabled: true }` shape)

### Shell dispatchers (`sy-*` and `<cli>_skill_*` from the terminal)

Every `_common/v_current/skills/<name>.md` slash command also has matching bash
functions so the same workflow can run interactively or print output and exit.
Source: `_common/sy-commands.profile.bash` (sourced via `profile-advanced.sh`).
Four families are registered per skill, from one loop, on shell load — no
per-command edits are ever needed (any CLI's setup.js creates the body and the
next shell picks up every wrapper):

| Family                   | Surface        | CLI chosen   | Example                                 |
| ------------------------ | -------------- | ------------ | --------------------------------------- |
| `sy-<name>`              | interactive    | at call time | `sy-review-pr opencode <pr-url>`        |
| `sy-run-<name>`          | print and exit | at call time | `sy-run-review-pr opencode <pr-url>`    |
| `<cli>_skill_<name>`     | interactive    | pinned       | `opencode_skill_review_pr <pr-url>`     |
| `<cli>_skill_run_<name>` | print and exit | pinned       | `opencode_skill_run_review_pr <pr-url>` |

CLI selection for the `sy-<name>` family mirrors the `EDITOR` convention:

```bash
sy-review-pr <pr-url>                # uses $LLM (default claude)
sy-review-pr opencode <pr-url>       # leading positional override
LLM=gemini sy-review-pr <pr-url>     # env-var override
```

Supported tags: `claude`, `copilot`, `gemini`, `opencode`, `pi`. Unknown values for
`$LLM` fall back to the default. Resolved CLI is echoed to stderr so the
user can see which one fired, which route runs, and both boolean controls.
`sy-<name> --help` prints inline help without invoking any CLI.

The pinned families ignore `$LLM`; every arg goes to the workflow. Hyphens in
the skill name flatten to underscores to match the prefix
(`sy-review-pr` → `opencode_skill_review_pr`), which also makes
`opencode_skill_<TAB>` complete every skill that CLI can run.

#### Raw prompts

`inline` is a reserved name in both families carrying no `SKILL.md` at all — the arguments **are** the prompt:

```bash
opencode_skill_inline "look at the failing migration and fix it"
opencode_skill_run_inline "summarize this repo"
sy-inline gemini "summarize this repo"           # CLI picked at call time
sy-run-inline gemini "summarize this repo"       # print output and exit
LLM=copilot sy-inline "summarize this repo"      # env-var override
```

Raw wrappers read no `SKILL.md`; arguments become the prompt. Interactive and run argv both come from the CLI registry. A deployed skill named `sy-inline` is skipped rather than allowed to shadow these reserved wrappers.

#### Boolean controls

Two independent booleans control transport and execution. Both use `is_truthy`,
so `1`, `true`, `y`, and `yes` enable them; unset and false values disable them.

| Variable                 | Default | `0`                                                    | `1`                                     |
| ------------------------ | ------- | ------------------------------------------------------ | --------------------------------------- |
| `SY_SKILL_INLINE`        | `0`     | native skill loading, with inline fallback when absent | send full `SKILL.md` as ordinary prompt |
| `SY_LLM_NON_INTERACTIVE` | `0`     | interactive session                                    | print output and exit                   |

```bash
sy-review-pr <pr-url>                              # native + interactive
SY_SKILL_INLINE=1 sy-review-pr <pr-url>            # inline + interactive
SY_LLM_NON_INTERACTIVE=1 sy-review-pr <pr-url>     # native + print output
opencode_skill_run_review_pr <pr-url>              # same print behavior, pinned
```

Native support and both execution argv live once in `_SY_LLM_SPECS`. Gemini and Pi have documented interactive native routes but no verified print-mode native route, so their run wrappers fall back to inline transport. OpenCode uses its dedicated `run --command` native route.

| CLI        | Interactive native route                | Non-interactive native route                 |
| ---------- | --------------------------------------- | -------------------------------------------- |
| `claude`   | `claude "/sy-<name> <args>"`            | `claude -p "/sy-<name> <args>"`              |
| `copilot`  | `copilot -i "/sy-<name> <args>"`        | `copilot -p "/sy-<name> <args>"`             |
| `gemini`   | `gemini -i "/sy-<name> <args>"`         | inline fallback through `gemini -p`          |
| `opencode` | `opencode --prompt "/sy-<name> <args>"` | `opencode run --command sy-<name> <args...>` |
| `pi`       | `pi "/skill:sy-<name> <args>"`          | inline fallback through `pi -p`              |

**Adding a CLI is ONE record in `_SY_LLM_SPECS` and nothing else.** No `case`
arm, no second array, no edit to any dispatch function — `_sy_exec_prompt` and
`_sy_exec_native` read both surfaces from the record. The invariant is
enforced by a test that fails on any CLI name appearing outside the registry
block (`software/tests/syCommandsDispatcher.spec.js`).

### Memory promotion bridge (Claude → other CLIs)

Claude Code auto-loads `~/.claude/projects/<encoded-cwd>/memory/MEMORY.md` and every record it links on every turn. The other three CLIs have no equivalent layer — every session starts cold. To bridge, snapshot Claude's per-project memory into a single managed "Persistent Context" appendix and upsert into the other three CLIs' user-level instructions files:

```bash
./run --files=memory-bridge.standalone.js
```

Standalone — runs on demand, NOT on every `./run --preset=llm` (a
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
./run --files=repo-agents-symlink.standalone.js
```

Standalone — runs on demand, NOT on every `./run --preset=llm`. Walks `$HOME/git/*/` by default; override / extend with comma-separated paths via `BASHRC_AGENTS_REPO_ROOTS=~/git,~/work`. Idempotent. Never clobbers an existing regular file or a foreign symlink — those are reported and skipped.

---

## Part 2 — Migrating from Claude Code to another CLI

Most users adopt Claude Code first, accumulate a personal `~/.claude/`
hierarchy (global rules, slash commands, keybindings, skills, per-project
`CLAUDE.md` files), and then want a second CLI alongside it — usually OpenCode
(for local Ollama) or GitHub Copilot CLI (for org-issued seats). This section
is the cheat sheet for that move.

### What "Claude Code state" actually consists of

If you wiped your machine today, this is the full surface area you'd need to recreate by hand before any other CLI feels comparable:

| Layer                      | Path                                                                     | Purpose                                                             |
| -------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Global instructions        | `~/.claude/CLAUDE.md`                                                    | System-prompt-level engineering rules applied to every conversation |
| Global slash commands      | `~/.claude/commands/*.md` (user-authored only)                           | User-invocable `/foo` prompts not managed by this repo              |
| Global skills              | `~/_extra/ai_llm/skills/<name>/SKILL.md` → symlinked into every CLI      | Loadable playbooks, incl. every `/sy-*` workflow                    |
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

| From (Claude Code)                       | To (OpenCode)                                            | Notes                                                                                                                                      |
| ---------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `~/.claude/CLAUDE.md`                    | `~/.config/opencode/AGENTS.md`                           | Copy verbatim — same Markdown-as-system-prompt model. OpenCode falls through to Claude's file if absent.                                   |
| `~/.claude/commands/*.md`                | `~/.config/opencode/commands/*.md`                       | Same file format. Symlinking is safe and is what this repo does.                                                                           |
| `~/_extra/ai_llm/skills/<name>/SKILL.md` | `~/.config/opencode/skills/<name>` (symlink)             | One physical skill, per-skill symlinks into every CLI. Model-invoked; `opencode/setup.js` also mirrors it as `/name` in the commands slot. |
| `~/.claude/keybindings.json`             | `keybinds: { ... }` inside `~/.config/opencode/tui.json` | Schema differs — chord syntax is OpenCode-specific. Re-author rather than mechanically translate.                                          |
| `~/.claude/settings.json`                | top-level keys inside `~/.config/opencode/opencode.json` | Single file holds providers, models, autoupdate, share-mode, experimental flags.                                                           |
| `<repo>/CLAUDE.md`                       | `<repo>/AGENTS.md`                                       | OpenCode looks for `AGENTS.md` first. If you keep `CLAUDE.md` only, fallback works but is brittle.                                         |
| `<repo>/.claude/skills/<name>/SKILL.md`  | ✅ read natively (same path)                             | Walks up from cwd to the git worktree root. Zero setup — this repo's seven skills already load in OpenCode as-is.                          |
| `<repo>/.claude/settings.json` hooks     | ❌ no hook system today                                  | OpenCode has no PreToolUse/Stop/PostToolUse equivalent. Skill-able as wrapper scripts but not config-driven.                               |
| `~/.claude/projects/.../memory/*.md`     | ❌ no auto-memory layer today                            | OpenCode has no persistent memory store. Anything load-bearing must move into `AGENTS.md`.                                                 |

### Claude Code → GitHub Copilot CLI

Copilot CLI is more divergent — it has instructions, settings, and a native
skills loader, but **no slash-command slot and no live keymap surface**
(instructions/settings as of `v1.0.48`; skills behavior verified on `v1.0.76`).
You will lose ergonomics. Plan accordingly.

| From (Claude Code)                      | To (Copilot CLI)                           | Notes                                                                                                                                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `~/.claude/CLAUDE.md`                   | `~/.copilot/copilot-instructions.md`       | Same Markdown-as-system-prompt model.                                                                                                                                                                                                                                                    |
| `~/_extra/ai_llm/skills/sy-<name>/`     | ✅ `~/.copilot/skills/sy-<name>` (symlink) | No `~/.copilot/commands/` slot exists, so the shared `_common/v_current/skills/*.md` corpus is deployed once as folder-form **skills** with generated YAML frontmatter and symlinked here. Gives `/sy-*` in Copilot plus model-triggering off `description` — no plugin manifest needed. |
| `~/.claude/skills/<name>/SKILL.md`      | ✅ `~/.copilot/skills/<name>` (symlink)    | Copilot does NOT read `~/.claude/skills/` (verified `v1.0.76` — a probe skill there never appears in `available_skills`). Irrelevant now: both folders hold per-skill symlinks into `~/_extra/ai_llm/skills/`, so neither CLI depends on the other's path.                               |
| `~/.claude/keybindings.json`            | ❌ no live keymap config in v1.0.48        | This repo still builds a `copilot-keys.*.jsonc` artifact so the schema stays exercised for the day upstream ships one.                                                                                                                                                                   |
| `~/.claude/settings.json`               | `~/.copilot/settings.json`                 | Different key names — see the settings-intent table above for the cross-CLI mapping.                                                                                                                                                                                                     |
| `<repo>/CLAUDE.md`                      | `<repo>/AGENTS.md`                         | Copilot CLI also reads `AGENTS.md` at the repo root.                                                                                                                                                                                                                                     |
| `<repo>/.claude/skills/<name>/SKILL.md` | ✅ read natively (same path)               | Verified `v1.0.76`: this repo's seven skills load as project skills with zero setup. Model-invoked only — no `/skill-name`.                                                                                                                                                              |
| `<repo>/.claude/settings.json` hooks    | ❌ no hook system today                    | Same gap as OpenCode.                                                                                                                                                                                                                                                                    |
| `~/.claude/projects/.../memory/*.md`    | ❌ no auto-memory layer today              | Same gap as OpenCode — anything load-bearing must move into `AGENTS.md`.                                                                                                                                                                                                                 |

### Starting from scratch — what a brand-new machine needs

If you've never set up _any_ of these CLIs and want all four in parity, you need — at minimum — to author and place:

1. **One canonical instructions doc** (engineering rules, tone, persona, guardrails)
   that gets deployed to four different filenames in four different folders.
2. **A slash-command corpus** (PR review, release, babysit, etc.) deployed to
   the two CLIs that support a `commands/` slot (Claude, OpenCode) and inlined
   into instructions for the two that don't (Copilot, Gemini).
3. **Per-CLI keybinding files** with platform-specific overrides — each CLI
   uses a different schema and different OS-modifier conventions.
4. **Per-CLI settings files** mapping the same _intent_ (hide banner, disable
   auto-update, hide tips, etc.) onto each CLI's actual key names.
5. **A per-project `CLAUDE.md` / `AGENTS.md`** per repo, plus any `.agents/skills/<name>/SKILL.md`
   playbooks you want loaded on matching tasks.
6. **A way to keep all of the above in sync** when you change one rule — without
   that, you will silently drift apart within a week and find yourself debugging
   "why did Copilot do X when Claude wouldn't?".

### How this repo solves it

The whole point of `software/scripts/advanced/llm/` is so that none of the
above has to be hand-maintained per CLI. One edit, four deployments, every run.

- **One instructions file feeds four CLIs.**
  `_common/v_current/instructions.md` is the single source of truth. Each `setup.js`
  (`claude/`, `copilot/`, `gemini/`, `opencode/`) writes it out to the right
  filename in the right folder, in the right managed-block format for that CLI:
  - `~/.claude/CLAUDE.md`
  - `~/.copilot/copilot-instructions.md`
  - `~/.gemini/GEMINI.md`
  - `~/.config/opencode/AGENTS.md`
- **One command corpus feeds all four CLIs without duplication.**
  `_common/v_current/skills/*.md` is deployed ONCE to `~/_extra/ai_llm/skills/sy-*/SKILL.md`
  by `deploySharedLLMSkills()` (llm-common.js), then **per-skill symlinked** into
  `~/.claude/skills/`, `~/.copilot/skills/`, `~/.config/opencode/skills/`,
  and `~/.agents/skills/` (Gemini discovers this root directly). Per-skill, never a folder
  symlink — a folder link would hijack the destination and destroy
  plugin-installed or hand-authored skills. `opencode/setup.js` additionally
  mirrors each one into `~/.config/opencode/commands/` so `/sy-*` stays
  user-invocable there.
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
  ./run --preset=llm
  ```

  Or refresh a single CLI in isolation:

  ```bash
  ./run --files="claude/setup.js"     # or copilot/, gemini/, opencode/
  ```

- **Per-project `.agents/skills/<name>/SKILL.md` lives in the project's own
  repo**, separate from the global LLM-CLI deploy. This repo keeps its skill
  bodies there and exposes `.claude/skills -> ../.agents/skills` for Claude
  compatibility. Pi, OpenCode, and Copilot CLI support the canonical location;
  see [Skills across CLIs](#skills-across-clis) below.

- **Auto-memory is Claude-Code-specific today.**
  `~/.claude/projects/<encoded-cwd>/memory/MEMORY.md` plus its linked files are
  read on every Claude Code turn but have no analogue in OpenCode/Copilot/Gemini.
  If you rely on memory for load-bearing context (preferences, project facts,
  feedback), promote it into `_common/v_current/instructions.md` before switching CLIs,
  or accept that the second CLI will start without it.

---

## Skills across CLIs

Agent skills (`SKILL.md` playbooks) share one format, but discovery paths and invocation differ. This repo's canonical project location is `.agents/skills/`; `.claude/skills` is a compatibility symlink, not a second copy. Pi does not scan `.claude/skills/` by default.

### Discovery — where each CLI looks

| CLI         | `<repo>/.claude/skills/<name>/SKILL.md` | `~/.claude/skills/<name>/SKILL.md` | Own native path                                                                                                     |
| ----------- | --------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Claude Code | ✅                                      | ✅                                 | — (this _is_ the native path)                                                                                       |
| OpenCode    | ✅                                      | ✅                                 | `.opencode/skills/`, `~/.config/opencode/skills/`                                                                   |
| Copilot CLI | ✅                                      | ❌ global path not read            | `.github/skills/`, `.agents/skills/`, `~/.copilot/skills/`, `~/.agents/skills/`, plugins, `copilot skill add <dir>` |
| Gemini CLI  | ❌                                      | ❌                                 | `.agents/skills/`, `~/.agents/skills/`, `gemini skills install/link` (project discovery requires trust)             |
| Pi          | ❌                                      | ❌                                 | `.agents/skills/`, `.pi/skills/`, `~/.agents/skills/`, `~/.pi/agent/skills/` (project discovery requires trust)     |

OpenCode also accepts `.agents/skills/` and `~/.agents/skills/`, and walks up
from the cwd to the git worktree root when resolving project skills
([docs](https://opencode.ai/docs/skills/)).

Copilot's own path list comes from `copilot skill --help` on `v1.0.76`. Note the asymmetry: it reads `<repo>/.claude/skills/` but **not** `~/.claude/skills/`. That asymmetry no longer costs anything, because no CLI reads another's folder here: `deploySharedLLMSkills()` (llm-common.js) writes each `_common/v_current/skills/<name>.md` once to `~/_extra/ai_llm/skills/sy-<name>/SKILL.md` with generated frontmatter, then symlinks that folder into Claude, Copilot, OpenCode, and the interoperable `~/.agents/skills/` root. Gemini reads the interoperable root directly.

Gemini setup compares skill folder names in `~/.gemini/skills` with valid skills in `~/.agents/skills`.
Matching symlinks are unlinked without touching targets; matching real entries move to unique `~/.gemini/skills-backup-*` folders.
Gemini-only skills remain untouched. Aliased roots or canonical skills stored inside the removed root are rejected to avoid data loss.
Project trust remains unchanged.

For this repo, Pi, OpenCode, and Copilot CLI can discover `.agents/skills/` directly; Claude Code retains the `.claude/skills` compatibility path. Pi requires project trust before loading project skills. Gemini's local discovery probe was blocked by its untrusted-folder gate; do not treat a skipped project scan as missing files.

### Layout — folder form only

One skill = one folder = one `SKILL.md`:

```
.agents/skills/<name>/SKILL.md     canonical repo-local skill
.claude/skills                    -> ../.agents/skills (compatibility)
```

Use folder-form `SKILL.md` for portability; standalone Markdown support varies
by loader. The folder name is kebab-case and must equal the frontmatter `name`.
Supporting material (reference docs, helper scripts, templates) lives beside the
`SKILL.md` in the same folder, which is the
other reason folder form is the standard: a flat file has nowhere to put them.

### Invocation — model-invoked vs `/skill-name`

Discovery is only half the story. By default a skill is **model-invoked**:
OpenCode lists every skill in the `skill` tool's `<available_skills>` block and
the model decides when a description matches, then calls
`skill({ name: "add-package" })`. There is **no `/skill` picker and no
`/skill-name` binding in OpenCode's TUI** — the keybind registry has no
`skill_list` entry, and `/skill` is an HTTP route, not a slash command.

Repo-local skills stay in `.agents/skills/<name>/SKILL.md`, with `.claude/skills` pointing to that folder for compatibility. Do not add a second repo-local copy or recreate `.pi/skills`. In Pi, run `/reload` after the move and invoke `/skill:<name>`; project trust must be granted. Moving the folder does not add OpenCode slash commands.

Global skills use a separate ergonomics layer: `_syncOpencodeSkillCommandSymlinks()` mirrors global skills into `~/.config/opencode/commands/<n>.md` so users can invoke `/sy-*`. That global mirror does not apply to repo-local skills.

Copilot CLI has no `commands/` slot, so repo-local skills stay model-invoked there.

---

## Part 3 — Ollama models

The model inventory is [`llm-models.jsonc`](llm-models.jsonc), inlined as `OLLAMA_MODELS_BY_VRAM` in [`llm-common.js`](llm-common.js) —
the single source of truth. Each VRAM tier lists one or more `{ tag, role }` entries per role (agent,
vision, autocomplete); `AUTOCOMPLETE_MODELS` and `LLM_LOCAL_AGENT_MODELS` are derived
from it. [`ollama.personal.sh`](ollama.personal.sh) installs the binary (native Linux only);
[`ollama-models.personal.js`](ollama-models.personal.js) pulls the tier matching `system_gpu_vram_mib`
(detected in `software/bootstrap/common-env.sh`) through the daemon's HTTP API, in the
background. This section covers only how the discoverers pick a host.

The 24 GB+ tier pulls these plain model tags:

```bash
ollama pull glm-4.7-flash          # 30B-A3B, default Q4_K_M, ~19 GB
ollama pull qwen2.5-coder:32b      # 32.8B, default Q4_K_M, ~20 GB
ollama pull qwen2.5-coder:3b-base  # 3.09B, default Q4_K_M, ~1.9 GB
ollama pull gemma4:26b             # 25.2B-A3.8B, default Q4_K_M, ~19 GB
```

Ollama selects the registry's default quantization when no quantization suffix is
specified; current defaults above are Q4_K_M. Sizes are approximate download sizes and
can change with upstream tags. The three large models exceed 32 GB together, so Ollama
loads them by workload rather than keeping them all resident at once.

### Host priority

Two different discoverers, two different priorities — by design.

| Discoverer                  | Used by                                                                               | Host priority           | Rationale                                                                                                                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getOllamaProviderInputs()` | opencode providers, Zed agent panel, VS Code Copilot Chat (`chatLanguageModels.json`) | **remotes → 127.0.0.1** | Agent / chat traffic is user-initiated and infrequent. Prefer the beefier remote box so the big models actually get to serve. VS Code registers EVERY reachable host (not just the first); opencode and Zed do the same for their provider panels. |
| `getAutocompleteProvider()` | Zed `edit_predictions`                                                                | **127.0.0.1 → remotes** | Inline autocomplete fires on every keystroke. Localhost (~sub-ms) beats LAN (~5-20ms+) and dodges network round-trips on the typing hot path.                                                                                                      |

When a host doesn't have a matching model, the discoverer falls through to the next
host. When no host has any matching model, the caller omits the relevant config block
entirely so the editor keeps whatever its own base config declares, instead of
hammering a dead endpoint on every keystroke. For Zed that means
`zed-config.jsonc`'s `edit_predictions.disabled_globs: ["**/*"]` survives and inline
predictions stay fully off — deliberately not Zed's cloud Zeta.

Hosts come from [`ip-address.config`](../../../metadata/ip-address.config) by tag, never by machine name: every host tagged `OLLAMA_REMOTE` is a server, and the one tagged `OLLAMA_DEFAULT_SERVER` (at most one) leads — else the first `OLLAMA_REMOTE`. `getOllamaHosts()` in [`software/index.js`](../../../index.js) returns that list with `127.0.0.1` appended; `getReachableOllamaHosts()` in [`llm-common.js`](llm-common.js) keeps only hosts whose `/api/tags` lists at least one model, so an unreachable or empty host (remote or local) is never registered. `run.sh` bakes the same pick into `OLLAMA_DEFAULT_SERVER_IP` for the shell helpers. Example line:

```
192.168.1.45: my-desktop | WINDOWS_REMOTE | OLLAMA_REMOTE | OLLAMA_DEFAULT_SERVER
```

VS Code Copilot Chat reads `~/Library/Application Support/Code/User/chatLanguageModels.json`
on macOS (Linux equivalent: `~/.config/Code/User/chatLanguageModels.json`). The file's
schema is observed from VS Code's runtime — Microsoft has not published a stable spec.
See [`vs-code.js` `_buildChatLanguageModels`](../vs-code.js) JSDoc for the full caveat
and the merge rules: we own all `vendor: "ollama"` rows and re-derive them from
discovery on every run; entries from other vendors (Anthropic, OpenAI, Azure, etc.,
added via the Manage Models... UI) pass through untouched.

### Adding a new model

1. Confirm the tag is upstream (200 = exists):
   `curl -s -o /dev/null -w '%{http_code}' -H 'Accept: application/vnd.docker.distribution.manifest.v2+json' https://registry.ollama.ai/v2/library/<name>/manifests/<tag>`.
2. Put it in the right tier of [`llm-models.jsonc`](llm-models.jsonc),
   replacing that tier's model for the same role. Autocomplete models must be `-base`
   (FIM tokens exist only in base checkpoints).
3. `./run --files=ollama-models.personal.js` to pull it, then
   `./run --files=opencode/setup.js` (or `--files=zed.js`) to redeploy the config.

# Keybinding Reference

`OS_KEY` = **Cmd** (meta) on macOS, **Alt** on Windows/Linux. Browsers are an exception: they use **Cmd** on macOS and **Ctrl** on Windows/Linux natively.

## Source Files

All repo source files under `software/scripts/` unless noted.

| App               | Repo source files                                                                                                                                                                                                                  | On-disk keybinding path                                                                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chromium browsers | `advanced/browser-config.js`                                                                                                                                                                                                       | `~/Library/.../Brave-Browser/Default/Preferences` (mac), `~/.config/BraveSoftware/.../Preferences` (linux)                                                                                                    |
| VS Code           | `advanced/vs-code-keys.common.jsonc`, `advanced/vs-code-keys.windows.jsonc`                                                                                                                                                        | `~/Library/.../Code/User/keybindings.json` (mac), `~/.config/Code/User/keybindings.json` (linux)                                                                                                              |
| Sublime Text      | `advanced/sublime-text-keys.common.jsonc`, `advanced/sublime-text-keys.windows.jsonc`                                                                                                                                              | `~/Library/.../Sublime Text/Packages/User/Default (OSX).sublime-keymap` (mac), `~/.config/sublime-text/Packages/User/Default.sublime-keymap` (linux)                                                          |
| Sublime Merge     | `advanced/sublime-merge-keys.common.jsonc`, `advanced/sublime-merge-keys.windows.jsonc`                                                                                                                                            | `~/Library/.../Sublime Merge/Packages/User/Default (OSX).sublime-keymap` (mac), `~/.config/sublime-merge/Packages/User/Default.sublime-keymap` (linux)                                                        |
| Zed               | `zed-keys.common.jsonc`                                                                                                                                                                                                            | `~/.config/zed/keymap.json`                                                                                                                                                                                   |
| Claude Code       | `advanced/llm/claude/claude-keys.common.jsonc`, `advanced/llm/claude/claude-keys.windows.jsonc`                                                                                                                                    | `~/.claude/keybindings.json`                                                                                                                                                                                  |
| OpenCode CLI      | `advanced/llm/opencode/opencode-keys.common.jsonc` (explicit-match policy — every chord mirrored from Claude is listed; no reliance on opencode defaults; chords use `super` directly — no OS-specific substitution)               | `~/.config/opencode/tui.json` (merged under `keybinds` key)                                                                                                                                                   |
| Copilot CLI       | `advanced/llm/copilot/copilot-keys.common.jsonc`, `advanced/llm/copilot/copilot-keys.windows.jsonc` (pre-staged — merged into `.build/copilot-keys{,-mac}` but NOT live-deployed; see [Copilot CLI](#ai-cli-assistants) gap below) | _no on-disk keymap yet; chords are hardcoded in the binary. When upstream ships a config knob, the deferred deploy block in `copilot/setup.js` writes the merged result to whatever path upstream documents._ |
| Gemini CLI        | `advanced/llm/gemini/gemini-keys.common.jsonc`, `advanced/llm/gemini/gemini-keys.windows.jsonc` (explicit-match policy — every chord mirrored from Claude is listed; no reliance on Gemini upstream defaults)                      | `~/.gemini/keybindings.json`                                                                                                                                                                                  |
| Vim               | `vim-config-settings.vim`                                                                                                                                                                                                          | `~/.vimrc`                                                                                                                                                                                                    |
| Bash readline     | `bash-keys.profile.bash`                                                                                                                                                                                                           | Sourced into `~/.bash_syle`                                                                                                                                                                                   |
| Windows Terminal  | `windows-terminal-keys.jsonc`                                                                                                                                                                                                      | `%LOCALAPPDATA%/Packages/Microsoft.WindowsTerminal_.../LocalState/settings.json`                                                                                                                              |
| tmux              | `advanced/tmux.config`                                                                                                                                                                                                             | `~/.tmux.conf`                                                                                                                                                                                                |
| Ghostty           | `advanced/ghostty-keys.common.jsonc`                                                                                                                                                                                               | `~/.config/ghostty/config` (mac + linux)                                                                                                                                                                      |
| Termux (Android)  | `android_termux/termux-config.sh`                                                                                                                                                                                                  | `~/.termux/termux.properties`                                                                                                                                                                                 |

## Editor-Specific Gotchas

### Zed normalises shifted glyph keys before keymap dispatch

Zed resolves a chord to the **shifted glyph** of the key, not to `shift-<unshifted>`. So a binding written as `shift-cmd-\` is never matched — Zed sees the keypress as `cmd-|` (because `shift+\` produces `|` on a US keyboard) and falls through to whatever default is bound to `cmd-|`. This bit us twice on the `\` family before we figured it out.

**Rule of thumb when binding a shifted-symbol chord in `software/scripts/advanced/zed-keys.common.jsonc`:** write the resulting glyph, not the base key + shift modifier. Same physical chord on the user's keyboard, but the keymap actually wins.

| Physical chord on US keyboard | ❌ Won't match in Zed | ✅ Matches in Zed |
| ----------------------------- | --------------------- | ----------------- |
| `cmd+shift+\`                 | `shift-cmd-\`         | `cmd-\|`          |
| `cmd+shift+ctrl+\`            | `ctrl-shift-cmd-\`    | `ctrl-cmd-\|`     |
| `cmd+shift+/`                 | `shift-cmd-/`         | `cmd-?`           |
| `cmd+shift+1`                 | `shift-cmd-1`         | `cmd-!`           |
| `cmd+shift+,`                 | `shift-cmd-,`         | `cmd-<`           |
| `cmd+shift+.`                 | `shift-cmd-,`         | `cmd->`           |
| `cmd+shift+;`                 | `shift-cmd-;`         | `cmd-:`           |

This only applies to **shifted-symbol** chords. Plain letters (e.g. `cmd+shift+s`) work fine with `shift-cmd-s` because `shift+s` doesn't change the resolved key on US layouts. VS Code, Sublime, and Claude Code do not have this normalisation — only Zed.

If a Zed binding silently does nothing or fires a Zed default instead of your action, the first thing to check is whether the chord includes shift over a non-letter key.

---

## Standard Convention

The target keybindings this repo aims for. Each section below shows the convention followed by an implementation matrix. **Empty cells are gaps / TODOs.**

Legend: **✅** = configured by this repo | **☑️** = native (works out of the box) | **⚠️** = blocker (can't be fixed) | **❌** = not applicable / gap

---

## Browsers

On macOS, all browsers use **Cmd** natively — no config needed. On Windows/Linux, Brave is configured to accept **both Ctrl AND Alt** for every accelerator — Ctrl keeps Brave's built-in defaults working (Ctrl+T, Ctrl+W, Ctrl+R, etc.) and Alt is layered on as an addition matching the OS_KEY convention. Chrome/Edge on Windows/Linux use native **Ctrl** shortcuts (no overrides).

Cut / Copy / Paste are intentionally **not** registered through `brave.accelerators`. Brave's textfield-level clipboard handler covers `Ctrl+X/C/V` natively (the universal convention), and binding `Alt+X/C/V` is non-standard. Skipping these IDs lets Brave fall back to its built-in Ctrl-only defaults; bonus: it avoids the omnibox-renderer crash that came from double-binding the same clipboard ID to both Ctrl and Alt.

Brave keyboard shortcuts settings: `brave://settings/system/shortcuts`

| Key                                  | Action                                                  | All browsers (MacOS) |         All browsers (Windows/Linux)          |
| ------------------------------------ | ------------------------------------------------------- | :------------------: | :-------------------------------------------: |
| `OS_KEY+t`                           | New tab                                                 |          ☑️          |                      ✅                       |
| `OS_KEY+shift+t`                     | Reopen closed tab                                       |          ☑️          |                      ✅                       |
| `OS_KEY+1-9`                         | Tab by index                                            |          ☑️          |                      ✅                       |
| `OS_KEY+shift+[/]`                   | Prev / next tab                                         |          ☑️          |                      ✅                       |
| `OS_KEY+w`                           | Close tab                                               |          ☑️          |                      ✅                       |
| `OS_KEY+q`                           | Quit                                                    |          ☑️          |                      ✅                       |
| `OS_KEY+n`                           | New window                                              |          ☑️          |                      ✅                       |
| `OS_KEY+shift+n`                     | New incognito window                                    |          ☑️          |                      ✅                       |
| `OS_KEY+=`                           | Zoom in                                                 |          ☑️          |                      ✅                       |
| `OS_KEY+-`                           | Zoom out                                                |          ☑️          |                      ✅                       |
| `OS_KEY+0`                           | Reset zoom (100%)                                       |          ☑️          |                      ✅                       |
| `OS_KEY+c`                           | Copy (Cmd on mac, Ctrl native on Win/Linux)             |          ☑️          |             ☑️ (textfield-level)              |
| `OS_KEY+x`                           | Cut (Cmd on mac, Ctrl native on Win/Linux)              |          ☑️          |             ☑️ (textfield-level)              |
| `OS_KEY+v`                           | Paste (Cmd on mac, Ctrl native on Win/Linux)            |          ☑️          |             ☑️ (textfield-level)              |
| `OS_KEY+a`                           | Select all                                              |          ☑️          | ⚠️ (content-level, not a browser accelerator) |
| `OS_KEY+z`                           | Undo                                                    |          ☑️          | ⚠️ (content-level, not a browser accelerator) |
| `OS_KEY+s`                           | Save (download page)                                    |          ☑️          |                      ✅                       |
| `OS_KEY+p`                           | Print                                                   |          ☑️          |                      ✅                       |
| `OS_KEY+f`                           | Find                                                    |          ☑️          |                      ✅                       |
| `OS_KEY+g`                           | Find next                                               |          ☑️          |                      ✅                       |
| `OS_KEY+shift+g`                     | Find prev                                               |          ☑️          |                      ✅                       |
| `OS_KEY+l`                           | Focus address bar                                       |          ☑️          |                      ✅                       |
| `F2`                                 | Focus address bar (alt)                                 |          ❌          |                      ✅                       |
| `OS_KEY+r` / `OS_KEY+shift+r` / `F5` | Hard refresh (all chords mapped to bypass-cache reload) |          ☑️          |                      ✅                       |
| `OS_KEY+o`                           | Open file                                               |          ☑️          |                      ✅                       |
| `OS_KEY+h`                           | History                                                 |          ☑️          |                      ✅                       |
| `OS_KEY+d`                           | Bookmark this page                                      |          ☑️          |                      ✅                       |
| `OS_KEY+shift+i`                     | DevTools                                                |          ☑️          |                      ✅                       |
| `OS_KEY+shift+b`                     | Bookmark bar toggle                                     |          ☑️          |                      ✅                       |
| `OS_KEY+left`                        | Back                                                    |          ☑️          |                      ✅                       |
| `OS_KEY+right`                       | Forward                                                 |          ☑️          |                      ✅                       |
| `OS_KEY+shift+backspace/delete`      | Clear browsing data                                     |          ☑️          |                      ✅                       |
| `Alt+Enter`                          | Fullscreen (was F11)                                    |          ❌          |                      ✅                       |
| `F11`                                | DevTools inspector (was F12)                            |          ❌          |                      ✅                       |

---

## Code Editors

### Tabs & Windows

| Key                | Action               |  VS Code  | Subl Text | Subl Merge |    Zed    |        Vim        |
| ------------------ | -------------------- | :-------: | :-------: | :--------: | :-------: | :---------------: |
| `OS_KEY+t`         | New tab              | ✅ (term) |    ❌     |     ❌     | ✅ (term) |        ❌         |
| `OS_KEY+n`         | New file             |    ✅     |    ✅     |     ❌     |    ✅     |        ❌         |
| `OS_KEY+o`         | Open file/folder     |    ❌     |    ❌     |     ❌     |    ✅     |        ❌         |
| `OS_KEY+ctrl+p`    | Recent projects      |    ✅     |    ✅     |     ❌     |    ✅     |        ❌         |
| `OS_KEY+1-9`       | Tab by index         |    ✅     |    ✅     |     ✅     |    ✅     |        ❌         |
| `OS_KEY+shift+[/]` | Prev / next tab      |    ✅     |    ✅     |     ✅     |    ✅     |        ❌         |
| `OS_KEY+w`         | Close tab            |    ✅     |    ✅     |     ✅     |    ✅     |        ✅         |
| `OS_KEY+q`         | Quit                 |    ✅     |    ✅     |     ✅     |    ✅     |        ❌         |
| `OS_KEY+shift+n`   | New window           |    ✅     |    ✅     |     ✅     |    ✅     |        ❌         |
| `F2`               | Rename (symbol/file) |    ✅     |    ❌     |     ❌     |    ✅     | ✅ (paste toggle) |

### Zoom

| Key              | Action             | VS Code | Subl Text | Subl Merge | Zed | Vim |
| ---------------- | ------------------ | :-----: | :-------: | :--------: | :-: | :-: |
| `OS_KEY+=`       | Font zoom in       |   ✅    |    ✅     |     ✅     | ✅  | ❌  |
| `OS_KEY+-`       | Font zoom out      |   ✅    |    ✅     |     ✅     | ✅  | ❌  |
| `OS_KEY+0`       | Reset font zoom    |   ✅    |    ✅     |     ✅     | ✅  | ❌  |
| `OS_KEY+shift+=` | Workspace zoom in  |   ✅    |    ❌     |     ❌     | ✅  | ❌  |
| `OS_KEY+shift+-` | Workspace zoom out |   ✅    |    ❌     |     ❌     | ✅  | ❌  |

### Text Editing

| Key                | Action                 | VS Code | Subl Text | Subl Merge | Zed | Vim |
| ------------------ | ---------------------- | :-----: | :-------: | :--------: | :-: | :-: |
| `OS_KEY+c`         | Copy                   |   ✅    |    ✅     |     ✅     | ✅  | ❌  |
| `OS_KEY+x`         | Cut                    |   ✅    |    ✅     |     ✅     | ✅  | ❌  |
| `OS_KEY+v`         | Paste                  |   ✅    |    ✅     |     ✅     | ✅  | ❌  |
| `OS_KEY+a`         | Select all             |   ✅    |    ✅     |     ✅     | ✅  | ❌  |
| `OS_KEY+z`         | Undo                   |   ✅    |    ✅     |     ✅     | ✅  | ✅  |
| `OS_KEY+y`         | Redo                   |   ✅    |    ✅     |     ✅     | ✅  | ✅  |
| `OS_KEY+shift+z`   | Redo (alt)             |   ✅    |    ✅     |     ✅     | ✅  | ✅  |
| `OS_KEY+s`         | Save                   |   ✅    |    ✅     |     ❌     | ✅  | ✅  |
| `OS_KEY+shift+s`   | Save all               |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+l`         | Select line            |   ✅    |    ❌     |     ❌     | ✅  | ✅  |
| `OS_KEY+shift+l`   | Multi-cursor line ends |   ✅    |    ❌     |     ❌     | ✅  | ❌  |
| `OS_KEY+backspace` | Delete to BOL          |   ✅    |    ✅     |     ✅     | ✅  | ✅  |

### Search

| Key              | Action                  | VS Code | Subl Text | Subl Merge | Zed | Vim |
| ---------------- | ----------------------- | :-----: | :-------: | :--------: | :-: | :-: |
| `OS_KEY+f`       | Find                    |   ✅    |    ✅     |     ✅     | ✅  | ❌  |
| `OS_KEY+shift+f` | Find in files           |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+h`       | Find and replace        |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+shift+h` | Replace in files        |   ✅    |    ❌     |     ❌     | ✅  | ❌  |
| `OS_KEY+g`       | Find next               |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+shift+g` | Find prev               |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+d`       | Select next match       |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+ctrl+g`  | Select all matches      |   ✅    |    ❌     |     ❌     | ✅  | ❌  |
| `OS_KEY+p`       | Quick open / file       |   ✅    |    ✅     |     ✅     | ✅  | ❌  |
| `OS_KEY+shift+p` | Command palette         |   ✅    |    ✅     |     ✅     | ✅  | ❌  |
| `OS_KEY+;`       | Goto line               |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+r`       | Goto symbol             |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+shift+'` | Goto symbol (workspace) |   ✅    |    ❌     |     ❌     | ✅  | ❌  |
| `OS_KEY+enter`   | Goto definition         |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `shift+enter`    | Find references         |   ✅    |    ❌     |     ❌     | ✅  | ❌  |
| `ctrl+m`         | Jump to bracket         |   ✅    |    ✅     |     ❌     | ✅  | ❌  |

### Navigation (cursor movement)

| Key                      | Action                  | VS Code | Subl Text | Subl Merge | Zed | Vim |
| ------------------------ | ----------------------- | :-----: | :-------: | :--------: | :-: | :-: |
| `OS_KEY+up`              | Page up                 |   ✅    |    ✅     |     ❌     | ✅  | ✅  |
| `OS_KEY+down`            | Page down               |   ✅    |    ✅     |     ❌     | ✅  | ✅  |
| `OS_KEY+left`            | Home (BOL)              |   ✅    |    ✅     |     ❌     | ✅  | ✅  |
| `OS_KEY+right`           | End (EOL)               |   ✅    |    ✅     |     ❌     | ✅  | ✅  |
| `OS_KEY+shift+up`        | Select page up          |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+shift+down`      | Select page down        |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+shift+left`      | Select to BOL           |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+shift+right`     | Select to EOL           |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+ctrl+up`         | Top of file             |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+ctrl+down`       | Bottom of file          |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+ctrl+shift+up`   | Top of file (select)    |   ✅    |    ❌     |     ❌     | ✅  | ❌  |
| `OS_KEY+ctrl+shift+down` | Bottom of file (select) |   ✅    |    ❌     |     ❌     | ✅  | ❌  |

### Code Editing

| Key                   | Action          | VS Code | Subl Text | Subl Merge | Zed | Vim |
| --------------------- | --------------- | :-----: | :-------: | :--------: | :-: | :-: |
| `OS_KEY+/`            | Toggle comment  |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+[`            | Outdent         |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+]`            | Indent          |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+,`            | Fold            |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+.`            | Unfold          |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `ctrl+shift+OS_KEY+f` | Format document |   ✅    |    ✅     |     ❌     | ✅  | ❌  |

### Editor UI

| Key                   | Action            | VS Code | Subl Text | Subl Merge | Zed | Vim |
| --------------------- | ----------------- | :-----: | :-------: | :--------: | :-: | :-: |
| `OS_KEY+\`            | Toggle left dock  |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+shift+\`      | Toggle right dock |   ✅    |    ❌     |     ❌     | ✅  | ❌  |
| `ctrl+shift+OS_KEY+\` | Toggle soft wrap  |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `` ctrl+` ``          | Toggle terminal   |   ✅    |    ❌     |     ❌     | ✅  | ❌  |
| `F5`                  | Refresh / revert  |   ✅    |    ✅     |     ✅     | ✅  | ❌  |
| `F11`                 | Fullscreen        |   ✅    |    ✅     |     ❌     | ❌  | ❌  |

### Splits (editors)

| Key              | Action                 | VS Code | Subl Text | Subl Merge | Zed | Vim |
| ---------------- | ---------------------- | :-----: | :-------: | :--------: | :-: | :-: |
| `ctrl+d`         | Split vertical         |   ✅    |    ✅     |     ❌     | ✅  | ✅  |
| `ctrl+'`         | Split horizontal       |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `OS_KEY+shift+d` | Split horizontal (alt) |   ✅    |    ❌     |     ❌     | ✅  | ❌  |
| `ctrl+w`         | Single column / close  |   ✅    |    ✅     |     ❌     | ✅  | ❌  |
| `ctrl+arrow`     | Navigate splits        |   ❌    |    ❌     |     ❌     | ❌  | ✅  |

### Debugging (VS Code only)

| Key                  | Action         |
| -------------------- | -------------- |
| `OS_KEY+'`           | Step over      |
| `OS_KEY+shift+'`     | Step into      |
| `OS_KEY+shift+1`     | Explorer panel |
| `OS_KEY+shift+2`     | Search panel   |
| `` OS_KEY+shift+` `` | Debug panel    |

### Integrated Terminal (VS Code only)

Bindings that fire only when the integrated terminal has focus (`when: "terminalFocus"`).

| Key          | Action                                                            |
| ------------ | ----------------------------------------------------------------- |
| `OS_KEY+t`   | New terminal as editor tab                                        |
| `OS_KEY+f`   | Find in terminal output                                           |
| `ctrl+enter` | Insert a newline in TUI prompts (Claude Code etc.) — sends ESC+CR |
| `` ctrl+` `` | Toggle terminal panel (also works outside terminal focus)         |

### Integrated Terminal (Zed)

`zed.js` auto-mirrors every `OS_KEY+X` editor binding into `context: "Terminal"` so those
chords still fire while the terminal panel has focus. The mirror is a no-op for chords
whose action is editor-only (`editor::*` does nothing in a terminal), and it used to
clobber Zed's real Terminal defaults. These are therefore declared explicitly in
`zed-keys.common.jsonc` — the mirror skips any chord already present in that context.

| Key              | Action                                      |
| ---------------- | ------------------------------------------- |
| `OS_KEY+left`    | Move to line start (sends `\x01`, readline) |
| `OS_KEY+right`   | Move to line end (sends `\x05`, readline)   |
| `OS_KEY+up`      | Scroll page up                              |
| `OS_KEY+down`    | Scroll page down                            |
| `OS_KEY+d`       | Split right                                 |
| `OS_KEY+shift+d` | Split down                                  |

---

## Terminal Emulators

### Tabs & Windows

| Key                | Action          | Windows Terminal | tmux | Ghostty |
| ------------------ | --------------- | :--------------: | :--: | :-----: |
| `OS_KEY+t`         | New tab         |        ✅        |  ✅  |   ✅    |
| `OS_KEY+1-9`       | Tab by index    |        ✅        |  ✅  |   ✅    |
| `OS_KEY+shift+[/]` | Prev / next tab |        ✅        |  ✅  |   ✅    |
| `OS_KEY+w`         | Close pane      |        ✅        |  ✅  |   ✅    |
| `OS_KEY+q`         | Close window    |        ✅        |  ✅  |   ✅    |
| `OS_KEY+n`         | New window      |        ✅        |  ✅  |   ✅    |
| `F2`               | Rename tab      |        ✅        |  ✅  |   ✅    |

### Splits & Panes

| Key                  | Action                      | Windows Terminal |       tmux        | Ghostty |
| -------------------- | --------------------------- | :--------------: | :---------------: | :-----: |
| `OS_KEY+d`           | Split vertical (left/right) |        ✅        |        ✅         |   ✅    |
| `OS_KEY+shift+d`     | Split horiz (top/bottom)    |        ✅        |        ✅         |   ✅    |
| `OS_KEY+'`           | Split horiz (alt)           |        ✅        |        ✅         |   ✅    |
| `OS_KEY+arrow`       | Navigate panes              |        ✅        |        ✅         |   ✅    |
| `OS_KEY+shift+arrow` | Resize panes                |        ✅        | ⚠️ (prefix+arrow) |   ✅    |
| `OS_KEY+\`           | Toggle UI (tab bar)         |        ✅        |        ❌         |   ✅    |
| `OS_KEY+shift+\`     | Toggle split zoom           |        ❌        |        ✅         |   ✅    |
| `F11`                | Fullscreen                  |        ✅        |        ✅         |   ✅    |

### Text & Search

| Key        | Action     | Windows Terminal | tmux | Ghostty |
| ---------- | ---------- | :--------------: | :--: | :-----: |
| `OS_KEY+c` | Copy       |        ✅        |  ❌  |   ✅    |
| `OS_KEY+v` | Paste      |        ✅        |  ❌  |   ✅    |
| `OS_KEY+f` | Find       |        ✅        |  ✅  |   ✅    |
| `OS_KEY+a` | Select all |        ✅        |  ❌  |   ✅    |

Ghostty's search chords (`OS_KEY+f` start, `OS_KEY+g` / `OS_KEY+shift+g` next / previous,
`OS_KEY+e` search selection) come from Ghostty's **own defaults** — search shipped in
Ghostty 1.3.0 — so they are deliberately absent from `ghostty-keys.common.jsonc`. Binding
them there would only restate a default we already agree with.

### Scrollback (Ghostty)

Prompt jumping needs shell integration, which `ghostty.js` enables via
`shell-integration = detect`. Ghostty's own defaults put these on `OS_KEY+arrow`; we
relocated them because `OS_KEY+arrow` is split navigation here.

| Key                 | Action              | Windows Terminal | tmux | Ghostty |
| ------------------- | ------------------- | :--------------: | :--: | :-----: |
| `OS_KEY+ctrl+up`    | Jump to prev prompt |        ❌        |  ❌  |   ✅    |
| `OS_KEY+ctrl+down`  | Jump to next prompt |        ❌        |  ❌  |   ✅    |
| `OS_KEY+home`/`end` | Scroll top / bottom |        ❌        |  ❌  |   ✅    |

### Zoom

| Key        | Action     | Windows Terminal | tmux | Ghostty |
| ---------- | ---------- | :--------------: | :--: | :-----: |
| `OS_KEY+=` | Zoom in    |        ✅        |  ❌  |   ✅    |
| `OS_KEY+-` | Zoom out   |        ✅        |  ❌  |   ✅    |
| `OS_KEY+0` | Reset zoom |        ✅        |  ❌  |   ✅    |

### tmux Prefix Chords (`ctrl+b`)

The `OS_KEY` tables above are the custom `alt+`-prefixed bindings from `advanced/tmux.config`.
These are the stock **prefix chords** — press `ctrl+b`, release, then the key. They are tmux
defaults (plus `c`, which we rebind only to inherit the current pane's path), so they keep
working in any tmux, including one running a config this repo did not write.

| Chord             | Action                                                                         |
| ----------------- | ------------------------------------------------------------------------------ |
| `ctrl+b` then `[` | Enter copy mode — vim scroll/search (`g`/`G` top/bottom, `/` search, `q` exit) |
| `ctrl+b` then `,` | Rename the current window (tab)                                                |
| `ctrl+b` then `c` | Create a new window (opens in the current pane's folder)                       |
| `ctrl+b` then `w` | Interactive window/session switcher (`choose-tree`)                            |
| `ctrl+b` then `x` | Close / kill the current pane (confirms first)                                 |
| `ctrl+b` then `n` | Next window                                                                    |
| `ctrl+b` then `p` | Previous window                                                                |

Copy mode is pinned to vi keys (`setw -g mode-keys vi`) so `g`/`G`/`/` behave as listed —
without it tmux picks emacs keys whenever `$EDITOR` is not vim-like.

These six chords cover most day-to-day tmux use and need no mouse. Prefer them over the
`alt+` chords when a terminal emulator or remote host swallows `alt`.

Workflow patterns built on top of these — scripted workspace sessions, detach/re-attach —
live in [`docs/tmux.md`](./tmux.md).

### Terminal-specific Gaps

| Gap                              | Reason                                                    |
| -------------------------------- | --------------------------------------------------------- |
| tmux `OS_KEY+shift+arrow` resize | Doesn't work reliably; uses `prefix+arrow` instead        |
| tmux copy/paste                  | Uses its own copy mode; `OS_KEY+c/v` not mapped           |
| tmux zoom                        | Not applicable; controlled by the outer terminal emulator |

### Termux (Android)

Termux is a soft-keyboard terminal, so it does not follow the `OS_KEY` convention at all. It is
listed separately rather than as a column above because none of the chords line up.

Session shortcuts are left at Termux's built-in hardware-keyboard defaults:

| Key                | Action              |
| ------------------ | ------------------- |
| `ctrl+alt+c`       | New session         |
| `ctrl+alt+n` / `p` | Next / prev session |
| `ctrl+alt+r`       | Rename session      |
| `ctrl+alt+1-9`     | Session by index    |

`termux.properties` supports `shortcut.create-session` and friends, but only in the form
`ctrl + <single char>` — no `alt`. That makes every remap a collision: `ctrl+[` **is** ESC, and
`ctrl+n` / `ctrl+p` are readline history. So `termux-config.sh` deliberately sets none of them.

The extra-keys row (two rows above the soft keyboard) is remapped instead. Long-press any key for
its popup value:

| Key        | Long-press     |
| ---------- | -------------- |
| `ESC`      | `^C` macro     |
| `/`        | `~`            |
| `-`        | `_`            |
| `HOME`     | `PGUP`         |
| `END`      | `PGDN`         |
| `          | `              | `&` |
| `TAB`      | shift+tab      |
| `KEYBOARD` | session drawer |

The Android **back button** is remapped to `ESC` (`back-key=escape`) so it exits vim insert mode
and dismisses fzf instead of closing the terminal.

---

## Vim

Vim uses its own conventions. `alt+key` for common shortcuts, `,key` for leader combos, `ctrl+key` for splits/search.

### Common Shortcuts (matching editors)

| Key              | Action        | Status |
| ---------------- | ------------- | :----: |
| `alt+up/down`    | Page up/down  |   ✅   |
| `alt+left/right` | Home / end    |   ✅   |
| `alt+z`          | Undo          |   ✅   |
| `alt+shift+z`    | Redo          |   ✅   |
| `alt+y`          | Redo          |   ✅   |
| `alt+s`          | Save          |   ✅   |
| `alt+w`          | Close buffer  |   ✅   |
| `alt+l`          | Select line   |   ✅   |
| `alt+backspace`  | Delete to BOL |   ✅   |

### Read Mode (vim -R / less)

| Key      | Action              | Status |
| -------- | ------------------- | :----: |
| `ctrl+a` | Beginning of line   |   ✅   |
| `ctrl+e` | End of line         |   ✅   |
| `ctrl+f` | Page forward (down) |   ✅   |
| `ctrl+g` | Page backward (up)  |   ✅   |

### Splits & Navigation

| Key                            | Action           |
| ------------------------------ | ---------------- |
| `ctrl+d`, `,v`, `,5`           | Vertical split   |
| `,s`, `,d`                     | Horizontal split |
| `ctrl+x`, `ctrl+q`, `,w`, `,x` | Close split      |
| `ctrl+arrow`                   | Navigate splits  |

### Toggles (normal mode)

Vim doesn't use the same `OS_KEY+\` chord family as the GUI editors — these single-key toggles fire in normal mode. They override vim's default `[`/`]`/`}` prefix motions.

| Key | Action                         |
| --- | ------------------------------ |
| `[` | Toggle line numbers            |
| `]` | Toggle whitespace markers      |
| `}` | Toggle soft wrap (`set wrap!`) |

### FZF / Search

| Key            | Action            |
| -------------- | ----------------- |
| `ctrl+t`, `,t` | Fuzzy file finder |
| `,f`           | Ripgrep search    |
| `,b`           | Buffer list       |
| `,r`           | Recent files      |

---

## AI CLI Assistants

Four terminal AI clients are deployed: **Claude Code**, **OpenCode**, **GitHub Copilot CLI** (the [official `gh.io/copilot-install` distribution](https://gh.io/copilot-install), not the deprecated `@github/copilot-cli` package), and **Google Gemini CLI**. Where possible the input-layer chords are aligned to Claude's conventions so muscle memory carries across tools.

**Shared engineering principles:** `software/scripts/advanced/llm/_common/instructions.md` is the single source of truth and gets deployed to `~/.claude/CLAUDE.md`, `~/.copilot/copilot-instructions.md`, and `~/.gemini/GEMINI.md` (one per `setup.js`). OpenCode reads `~/.claude/CLAUDE.md` directly via its global fallback, so it's automatically covered.

**OpenCode leader move:** OpenCode's upstream default leader is `ctrl+x`, which we move to `ctrl+o` (`tui.json` → `keybinds.leader`) so `ctrl+x` stays available as `editor_open`'s secondary alias alongside the primary `ctrl+g`. Every `<leader>X` chord still works — just typed as `ctrl+o <key>` (e.g. `ctrl+o e` for the leader-style editor open, `ctrl+o n` for new session, `ctrl+o t` for themes). `ctrl+o` was chosen because it's free in opencode, bash readline, vim, and tmux — no tmux-prefix or XON/XOFF flow-control collisions. All chords now use `super` directly as opencode's cross-platform modifier term (no OS-specific `OS_KEY` substitution).

**`ctrl+g` is the canonical "open `$EDITOR`" chord on all four CLIs.** Claude Code, Copilot CLI, and Gemini CLI all ship `ctrl+g` as their _upstream default_ for external-editor-open (Claude's in-TUI hint literally prints `ctrl+g edit in $EDITOR`; Gemini's bundled `docs/reference/keyboard-shortcuts.md` lists `Ctrl+G` / `Ctrl+Shift+G` for `input.openExternalEditor`). Under the explicit-match policy we bind it explicitly anyway, and keep `ctrl+x` as a second alias so the chord matches bash readline's own "open in `$EDITOR`" binding. OpenCode is the one tool whose default differs: `ctrl+g` is `messages_first` there, so `opencode-keys.common.jsonc` remaps `messages_first` to `ctrl+alt+shift+g,home` (mirroring the upstream `messages_last` = `ctrl+alt+g,end` shape) to free `ctrl+g` for `editor_open`.

**Copilot CLI configurability gap:** `copilot help config` (v1.0.48) exposes **no keymap configuration** — every in-app chord is hardcoded in the binary. Parity for Copilot is therefore limited to whatever its defaults happen to ship; any divergence from Claude's convention is a permanent ⚠️ until upstream changes. The only knobs we can set live in the wrapper (`software/scripts/advanced/llm/copilot/copilot.profile.bash`: `--autopilot --allow-all`) and `~/.copilot/settings.json` (model, theme, hooks, etc., all listed in `copilot help config`, seeded by `copilot/setup.js`).

**Explicit-match policy:** Every chord mirrored from Claude's convention is listed **explicitly** in each tool's `*-keys.common.jsonc` (and `.windows.jsonc` where applicable), even if the tool's upstream default already happens to bind it. Rationale: (a) an upstream default flip silently breaks parity — owning the binding in our jsonc means a re-run of `<tool>/setup.js` always converges to the Claude-aligned chord even if the tool changes defaults; (b) each file is auditable in isolation — no need to consult Gemini's bundled JS or opencode's schema docs to know which chords we "have"; (c) the comparison tables below only credit chords that are explicitly in our key files. The previous "happens to align with upstream default" ☑️ entries have been flipped to ✅ now that the chords are explicit.

**Regression coverage:** `software/tests/aiCliKeymapBuild.spec.js` snapshot-tests the build pipeline for all four tools — feeds the real `*-keys.{common,windows}.jsonc` files through each tool's actual `setup.js` merge/format helper (`_getKeyConfig`, `_getCopilotKeyConfig`, `_loadGeminiManagedKeybindings`, `_loadOpencodeKeybinds`) for both mac and Windows/Linux, asserts the merged JSON against an inline expected literal, and additionally enforces the HOME→BOL / END→EOL parity (HOME = Ctrl+A, END = Ctrl+E) across every tool. Any chord edit that changes the merged output (intentionally or otherwise) trips the snapshot.

**Gemini CLI keybindings:** Schema is a flat JSON array of `{ command, key }` objects; prefix `command` with `-` to remove a default binding. Discovered in Gemini bundle `chunk-MODIYMRW.js` (function `loadCustomKeybindings`, ~ line 64732). `gemini-keys.common.jsonc` lists every Claude chord explicitly (app.showFullTodos, input.newline×2, edit.undo, edit.clear on `OS_KEY+l` AND `ctrl+l`, input.openExternalEditor, input.paste, cursor.home×2, cursor.end×2). `gemini-keys.windows.jsonc` is the Windows/Linux-only companion (mirrors `claude-keys.windows.jsonc`) — removes the default `alt+v` paste so `OS_KEY=alt` on Windows/Linux doesn't double-bind paste. `ctrl+l` is forced to `edit.clear` by removing Gemini's default `app.clearScreen` first (via the `"-"` prefix) — TRADEOFF: Gemini loses screen-clear on `ctrl+l` (accepted).

### Input Editing

| Key                                                  | Action                    |     Claude     |    OpenCode    |  Copilot CLI   |   Gemini CLI    |
| ---------------------------------------------------- | ------------------------- | :------------: | :------------: | :------------: | :-------------: |
| `shift+enter`, `ctrl+enter`                          | Newline                   |       ✅       |       ✅       |       ⚠️       |       ✅        |
| `super+z`, `ctrl+-`                                  | Undo input                |       ✅       |       ✅       |       ⚠️       |       ✅        |
| `super+l`, `ctrl+l`                                  | Clear input               |       ✅       |       ✅       |       ⚠️       | ✅<sup>i</sup>  |
| `ctrl+r` (opencode only)                             | Recall previous prompt    |       ❌       | ✅<sup>k</sup> |       ❌       |       ❌        |
| `ctrl+v`                                             | Paste image / text        | ✅<sup>b</sup> | ✅<sup>j</sup> |       ⚠️       | ✅<sup>b2</sup> |
| `home` / `end`, `ctrl+a` / `ctrl+e`                  | Home / End (current line) | ✅<sup>c</sup> |       ✅       |       ⚠️       | ✅<sup>c2</sup> |
| `ctrl+home` / `super+home`, `ctrl+end` / `super+end` | Home / End (whole buffer) |       ❌       | ✅<sup>d</sup> |       ⚠️       |       ❌        |
| `ctrl+g`, `ctrl+x`                                   | Open `$EDITOR`            | ✅<sup>l</sup> | ✅<sup>e</sup> | ✅<sup>m</sup> | ✅<sup>l</sup>  |

<sup>a</sup> Deprecated — `ctrl+l` is now bound on all four tools. Kept for historical reference only.
<sup>b</sup> Bound on all platforms via `claude-keys.common.jsonc`; `claude-keys.windows.jsonc` additionally nulls `alt+v` so it doesn't double-fire when `OS_KEY` = `alt` on Windows.
<sup>b2</sup> Gemini's `input.paste` is text-paste (no image pipeline today). `gemini-keys.common.jsonc` binds `ctrl+v` explicitly; `gemini-keys.windows.jsonc` removes the default `alt+v` paste (mirroring `claude-keys.windows.jsonc`'s `alt+v: null`).
<sup>c</sup> Claude **null**s all four chords (`ctrl+a`, `ctrl+e`, `home`, `end`) so the underlying terminal readline gets HOME / END — HOME and END are listed explicitly (not just `ctrl+a`/`ctrl+e`) so a future upstream binding for the physical keys can't silently override the readline pass-through. OpenCode binds both the readline chords AND the physical `home`/`end` keys directly via `input_line_home` / `input_line_end`.
<sup>c2</sup> Gemini has no readline pass-through mode — `cursor.home`/`cursor.end` ARE the cursor-jump actions. `gemini-keys.common.jsonc` binds both `ctrl+a` + `home` to `cursor.home` and both `ctrl+e` + `end` to `cursor.end`, matching Claude's user-visible HOME/END behavior.
<sup>d</sup> OpenCode's `input_buffer_home` / `input_buffer_end` default to `home`/`end` (which would conflict with the line-home/end binding above); we remap them to `ctrl+home,super+home` / `ctrl+end,super+end` so the bare `home`/`end` keys do current-line navigation and `ctrl+home`/`super+home` jump to the start/end of multi-line buffers.
<sup>e</sup> `ctrl+g` is the primary chord (`editor_open`); `ctrl+x` is the secondary alias, free because of the leader move (`ctrl+x` → `ctrl+o`). OpenCode's upstream `ctrl+g` = `messages_first` is remapped to `ctrl+alt+shift+g,home` to free it.
<sup>i</sup> Gemini's `edit.clear` default is `ctrl+c` only (dual-purposes with quit-when-empty). `gemini-keys.common.jsonc` binds `OS_KEY+l` and `ctrl+l` explicitly so it matches Claude's `chat:clearInput`. `ctrl+l` forces over Gemini's default `app.clearScreen` via the `"-"` prefix removal — TRADEOFF: gemini loses screen-clear on `ctrl+l` (user-approved).
<sup>j</sup> OpenCode's `input_paste` is text-paste (no image pipeline today). `opencode-keys.common.jsonc` binds `ctrl+v` explicitly under the explicit-match policy.
<sup>k</sup> OpenCode's `history_previous` is `up,ctrl+r` — cycles back through prior prompts (opencode has no incremental reverse-search command; `history_previous` is the nearest analog). Upstream default `ctrl+r` = `session_rename` is reassigned to `f6` so `ctrl+r` is free for history recall.
<sup>l</sup> `ctrl+g` is the tool's own upstream default for external-editor-open (Claude prints `ctrl+g edit in $EDITOR` in its hint line; Gemini's bundled `docs/reference/keyboard-shortcuts.md` lists `Ctrl+G` / `Ctrl+Shift+G` for `input.openExternalEditor`). Both chords are bound explicitly in `<tool>-keys.common.jsonc` under the explicit-match policy — Claude and Gemini merge user bindings additively, so listing `ctrl+g` alongside `ctrl+x` gives two working chords rather than moving one.
<sup>m</sup> The one Claude-convention chord Copilot ships natively: `ctrl+g` opens `$EDITOR` in Copilot CLI by default. The `ctrl+x` alias is not reachable (no keymap surface; `ctrl+x` is Copilot's own two-step prefix), so only the `ctrl+g` half is ✅.

### Panels

| Key              | Action         |     Claude     |    OpenCode    |  Copilot CLI   |   Gemini CLI   |
| ---------------- | -------------- | :------------: | :------------: | :------------: | :------------: |
| `ctrl+t`         | Toggle todos   |       ✅       | ❌<sup>f</sup> | ❌<sup>f</sup> |       ✅       |
| `ctrl+\,super+\` | Toggle sidebar | ❌<sup>g</sup> | ✅<sup>g</sup> | ❌<sup>g</sup> | ❌<sup>g</sup> |

<sup>f</sup> No todos panel exists in OpenCode or Copilot CLI. OpenCode's default `ctrl+t` is `variant_cycle` and is kept intact.
<sup>g</sup> Only OpenCode has a sidebar (sessions / files / MCP pane); `ctrl+\` matches the cross-app sidebar-toggle convention used by Sublime / VS Code / Zed, and `super+\` is the OS-modifier alternate.

### Copilot Wrapper-Layer Parity

Because Copilot's in-app keymap is unreachable, the equivalents of Claude's chords live at the wrapper / settings layer (`software/scripts/advanced/llm/copilot/copilot.profile.bash` + `~/.copilot/settings.json`):

| Surface        | Claude                                                                                              | Copilot CLI                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Autonomous run | `claude --allow-dangerously-skip-permissions --dangerously-skip-permissions --permission-mode auto` | `command copilot --autopilot --allow-all` (equivalent to `--allow-all-tools --allow-all-paths --allow-all-urls`)         |
| Resume         | `claude resume` / `cl r` (wrapper translates to `--resume`)                                         | `copilot --resume` / `copilot --continue` (no wrapper alias yet)                                                         |
| Default model  | `~/.claude/settings.json` → `model: "claude-opus-4-7[1m]"` (set by `claude/setup.js`)               | `~/.copilot/settings.json` → `model: "<choice>"` (user-managed; not auto-deployed)                                       |
| Launch alias   | `cl`                                                                                                | `co`                                                                                                                     |
| In-app chords  | Configurable via `~/.claude/keybindings.json`                                                       | Hardcoded — `shift+tab` for mode cycle (interactive / plan / autopilot), standard readline-ish chords in the input field |

`software/scripts/advanced/llm/copilot/copilot-keys.common.jsonc` and `copilot-keys.windows.jsonc` are pre-staged in the **same** schema as Claude's (array of `{ context, bindings }`, `OS_KEY` placeholders, Windows-only addendum nulls `alt+v`). `copilot/setup.js`'s `_doCopilotKeysWork()` runs the same merge pipeline as `claude/setup.js`'s `_doKeysWork()` — `_mergeCopilotContextGroups` + `_formatCopilotKeybindings` + per-platform `writeBuildArtifact` — and writes `.build/copilot-keys{,-mac}` every CI run, so the merge stays exercised and the chord intent is reviewable. The **live deploy** (`writeJson` to a real config path) is commented out at the bottom of `_doCopilotKeysWork()` and gated behind upstream shipping a keymap surface; when that lands, uncomment that block and point `targetPath` at whatever path upstream documents.

### AI CLI-Specific Gaps

| Gap | Reason |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Copilot CLI — `ctrl+enter` newline | Copilot v1.0.48 has no keymap config. Chord is hardcoded in the binary; cannot be added at the Copilot layer. Workaround inside VS Code's integrated terminal: `ctrl+enter` → `workbench.action.terminal.sendSequence` with `\u001b\r` (ESC+CR) — see `software/scripts/advanced/vs-code-keys.common.jsonc:180-190`. Most Ink-based TUI input libs interpret ESC+CR as `meta+CR` → newline, but Copilot's input library is bundled into a Mach-O binary with no exposed chord vocabulary (verified with `strings | grep -iE "shift\+enter\|ctrl\+enter"` returning zero hits), so even the ESC+CR workaround is unverified for Copilot specifically. |
| Copilot CLI — `home` / `end` line navigation | Same reason: input-layer chords are hardcoded. Falls back to whatever the binary ships. |
| Copilot CLI — `ctrl+l` / `OS_KEY+l` clear input | Same reason: input-layer chords are hardcoded. |
| Copilot CLI — `ctrl+x` open `$EDITOR` alias | Not a functional gap: `ctrl+g` (the canonical open-`$EDITOR` chord across all four CLIs) is already Copilot's hardcoded default, so editor-open works. Only the secondary `ctrl+x` alias is unreachable — `ctrl+x` is Copilot's own two-step prefix (`ctrl+x` → `b` / `o`) and there is no keymap surface to re-home it. |
| Copilot CLI — user-level slash commands | Copilot's "skills" require a plugin manifest (`copilot plugin install`) — there's no `~/.copilot/commands/*.md` fallthrough like Claude's. Out of scope for `setup.js`; use the Captain `install-plugin-to-copilot` skill or manage plugins manually. |
| Gemini CLI — user-level slash commands | Gemini's equivalent is the extension system (`gemini extensions install/link`) which requires an extension manifest. No `~/.gemini/commands/*.md` fallthrough. Out of scope for `setup.js`. |
| OpenCode — sidebar hidden by default | The TUI schema (`https://opencode.ai/tui.json`) has no field for sidebar default state; the SQLite db (`~/.local/share/opencode/opencode.db`) has no settings table for view state. Only runtime toggles exist: `ctrl+\` / `super+\` keybind or `ctrl+p` command palette. |
| OpenCode / Copilot — `ctrl+t` toggle todos | Neither tool has a todos panel. OpenCode's default `ctrl+t` is `variant_cycle`, left intact. (Gemini's `app.showFullTodos` is native on `ctrl+t`.) |

---

## Bash Readline

| Key                    | Action                      | Linux |       macOS       |
| ---------------------- | --------------------------- | :---: | :---------------: |
| `Tab`                  | fzf-tab complete            |  ✅   |        ✅         |
| `shift+tab`            | Reverse complete            |  ✅   |        ✅         |
| `ctrl+a` / `ctrl+up`   | Beginning of line           |  ✅   |  ✅ (option+up)   |
| `ctrl+e` / `ctrl+down` | End of line                 |  ✅   | ✅ (option+down)  |
| `ctrl+left`            | Word backward               |  ✅   | ✅ (option+left)  |
| `ctrl+right`           | Word forward                |  ✅   | ✅ (option+right) |
| `up` / `down`          | History search (prefix)     |  ✅   |        ✅         |
| `ctrl+r`               | Fzf history search          |  ✅   |        ✅         |
| `ctrl+t`               | Fuzzy edit (default editor) |  ✅   |        ✅         |
| `ctrl+y`               | Fuzzy recent files          |  ✅   |        ✅         |
| `ctrl+p`               | Fuzzy cd                    |  ✅   |        ✅         |
| `ctrl+b`               | Favorite command picker     |  ✅   |        ✅         |
| `ctrl+n`               | Git log browser             |  ✅   |        ✅         |
| `ctrl+g` / `ctrl+x`    | Open in $EDITOR             |  ✅   |        ✅         |
| `ctrl+l`               | Clear screen + kill input   |  ✅   |        ✅         |

**`ctrl+g` open-in-`$EDITOR` parity:** `ctrl+g` and `ctrl+x` both run readline's
`edit-and-execute-command`, matching the AI CLI chord pair in the table above — `ctrl+g` is
the canonical open-`$EDITOR` chord on Claude Code, Copilot CLI, Gemini CLI, and opencode, so
the same keystroke works whether you're at a bash prompt or inside a TUI. The git log browser
that previously owned `ctrl+g` moved to `ctrl+n`, whose readline default (`next-history`) was
already orphaned because `ctrl+p` (`previous-history`) is bound to fuzzy cd. TRADEOFF:
readline's default `ctrl+g` (`abort`) is given up — low impact, since its main job is
cancelling an incremental search and `ctrl+r` is bound to fzf, which aborts on `esc` /
`ctrl+c`. The `glog` alias also still opens the git log browser.

# Keybinding Reference

`OS_KEY` = **Cmd** (meta) on macOS, **Alt** on Windows/Linux. Browsers are an exception: they use **Cmd** on macOS and **Ctrl** on Windows/Linux natively.

## Source Files

All repo source files under `software/scripts/` unless noted.

| App               | Repo source files                                                                       | On-disk keybinding path                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chromium browsers | `chromium-browser-config.js`                                                            | `~/Library/.../Brave-Browser/Default/Preferences` (mac), `~/.config/BraveSoftware/.../Preferences` (linux)                                             |
| VS Code           | `advanced/vs-code-keys.common.jsonc`, `advanced/vs-code-keys.windows.jsonc`             | `~/Library/.../Code/User/keybindings.json` (mac), `~/.config/Code/User/keybindings.json` (linux)                                                       |
| Sublime Text      | `advanced/sublime-text-keys.common.jsonc`, `advanced/sublime-text-keys.windows.jsonc`   | `~/Library/.../Sublime Text/Packages/User/Default (OSX).sublime-keymap` (mac), `~/.config/sublime-text/Packages/User/Default.sublime-keymap` (linux)   |
| Sublime Merge     | `advanced/sublime-merge-keys.common.jsonc`, `advanced/sublime-merge-keys.windows.jsonc` | `~/Library/.../Sublime Merge/Packages/User/Default (OSX).sublime-keymap` (mac), `~/.config/sublime-merge/Packages/User/Default.sublime-keymap` (linux) |
| Zed               | `zed-editor-config.jsonc` (keybinding source files TBD)                                 | `~/.config/zed/keymap.json`                                                                                                                            |
| Claude Code       | `advanced/claude-keys.common.jsonc`, `advanced/claude-keys.windows.jsonc`               | `~/.claude/keybindings.json`                                                                                                                           |
| Vim               | `vim-config-settings.vim`                                                               | `~/.vimrc`                                                                                                                                             |
| Bash readline     | `bash-keys.profile.bash`                                                                | Sourced into `~/.bash_syle`                                                                                                                            |
| Windows Terminal  | `windows/windows-terminal-keys.jsonc`                                                   | `%LOCALAPPDATA%/Packages/Microsoft.WindowsTerminal_.../LocalState/settings.json`                                                                       |
| Terminator        | `terminator.js`                                                                         | `~/.config/terminator/config`                                                                                                                          |
| tmux              | `advanced/tmux.config`                                                                  | `~/.tmux.conf`                                                                                                                                         |
| iTerm2            | `mac/iterm-profile.jsonc`                                                               | `~/Library/.../com.googlecode.iterm2/DynamicProfiles/`                                                                                                 |

## Standard Convention

The target keybindings this repo aims for. Each section below shows the convention followed by an implementation matrix. **Empty cells are gaps / TODOs.**

Legend: **✅** = configured by this repo | **☑️** = native (works out of the box) | **⚠️** = blocker (can't be fixed) | **❌** = not applicable / gap

---

## Browsers

On macOS, all browsers use **Cmd** natively — no config needed. On Windows/Linux, Brave is configured to use **Alt** (matching the OS_KEY convention) via accelerator overrides in `chromium-browser-config.js`. Chrome/Edge on Windows/Linux use native **Ctrl** shortcuts (no Alt overrides).

Brave keyboard shortcuts settings: `brave://settings/system/shortcuts`

| Key                      | Action                     | All browsers (MacOS) |         All browsers (Windows/Linux)          |
| ------------------------ | -------------------------- | :------------------: | :-------------------------------------------: |
| `OS_KEY+t`               | New tab                    |          ☑️          |                      ✅                       |
| `OS_KEY+1-9`             | Tab by index               |          ☑️          |                      ✅                       |
| `OS_KEY+shift+[/]`       | Prev / next tab            |          ☑️          |                      ✅                       |
| `OS_KEY+w`               | Close tab                  |          ☑️          |                      ✅                       |
| `OS_KEY+q`               | Quit                       |          ☑️          |                      ✅                       |
| `OS_KEY+n`               | New window                 |          ☑️          |                      ✅                       |
| `OS_KEY+shift+n`         | New incognito window       |          ☑️          |                      ✅                       |
| `OS_KEY+=`               | Zoom in                    |          ☑️          |                      ✅                       |
| `OS_KEY+-`               | Zoom out                   |          ☑️          |                      ✅                       |
| `OS_KEY+0`               | Reset zoom (100%)          |          ☑️          |                      ✅                       |
| `OS_KEY+c`               | Copy                       |          ☑️          |                      ✅                       |
| `OS_KEY+x`               | Cut                        |          ☑️          |                      ✅                       |
| `OS_KEY+v`               | Paste                      |          ☑️          |                      ✅                       |
| `OS_KEY+a`               | Select all                 |          ☑️          | ⚠️ (content-level, not a browser accelerator) |
| `OS_KEY+z`               | Undo                       |          ☑️          | ⚠️ (content-level, not a browser accelerator) |
| `OS_KEY+s`               | Save (download page)       |          ☑️          |                      ✅                       |
| `OS_KEY+p`               | Print                      |          ☑️          |                      ✅                       |
| `OS_KEY+f`               | Find                       |          ☑️          |                      ✅                       |
| `OS_KEY+g`               | Find next                  |          ☑️          |                      ✅                       |
| `OS_KEY+shift+g`         | Find prev                  |          ☑️          |                      ✅                       |
| `OS_KEY+l`               | Focus address bar          |          ☑️          |                      ✅                       |
| `OS_KEY+r`               | Reload                     |          ☑️          |                      ✅                       |
| `OS_KEY+shift+r`         | Hard reload                |          ☑️          |                      ✅                       |
| `OS_KEY+o`               | Open file                  |          ☑️          |                      ✅                       |
| `OS_KEY+h`               | History                    |          ☑️          |                      ✅                       |
| `OS_KEY+d`               | Bookmark this page         |          ☑️          |                      ✅                       |
| `OS_KEY+shift+i`         | DevTools                   |          ☑️          |                      ✅                       |
| `OS_KEY+shift+b`         | Bookmark bar toggle        |          ☑️          |                      ✅                       |
| `OS_KEY+left`            | Back                       |          ☑️          |                      ✅                       |
| `OS_KEY+right`           | Forward                    |          ☑️          |                      ✅                       |
| `OS_KEY+shift+backspace` | Clear browsing data        |          ☑️          |                      ✅                       |
| `F5`                     | Hard reload (bypass cache) |          ✅          |                      ✅                       |
| `F11`                    | Fullscreen                 |          ✅          |                      ✅                       |
| `F12`                    | DevTools inspector         |          ☑️          |                      ☑️                       |

---

## Code Editors

### Tabs & Windows

| Key                | Action               | VS Code | Subl Text | Subl Merge | Zed |        Vim        |
| ------------------ | -------------------- | :-----: | :-------: | :--------: | :-: | :---------------: |
| `OS_KEY+t`         | New tab              |   ❌    |    ❌     |     ❌     | ❌  |        ❌         |
| `OS_KEY+n`         | New file             |   ✅    |    ✅     |     ❌     | ❌  |        ❌         |
| `OS_KEY+1-9`       | Tab by index         |   ✅    |    ✅     |     ✅     | ❌  |        ❌         |
| `OS_KEY+shift+[/]` | Prev / next tab      |   ✅    |    ✅     |     ✅     | ❌  |        ❌         |
| `OS_KEY+w`         | Close tab            |   ✅    |    ✅     |     ✅     | ❌  |        ✅         |
| `OS_KEY+q`         | Quit                 |   ✅    |    ✅     |     ✅     | ❌  |        ❌         |
| `OS_KEY+shift+n`   | New window           |   ✅    |    ✅     |     ✅     | ❌  |        ❌         |
| `F2`               | Rename (symbol/file) |   ✅    |    ❌     |     ❌     | ❌  | ✅ (paste toggle) |

### Zoom

| Key              | Action             | VS Code | Subl Text | Subl Merge | Zed | Vim |
| ---------------- | ------------------ | :-----: | :-------: | :--------: | :-: | :-: |
| `OS_KEY+=`       | Font zoom in       |   ✅    |    ✅     |     ✅     | ❌  | ❌  |
| `OS_KEY+-`       | Font zoom out      |   ✅    |    ✅     |     ✅     | ❌  | ❌  |
| `OS_KEY+0`       | Reset font zoom    |   ✅    |    ✅     |     ✅     | ❌  | ❌  |
| `OS_KEY+shift+=` | Workspace zoom in  |   ✅    |    ❌     |     ❌     | ❌  | ❌  |
| `OS_KEY+shift+-` | Workspace zoom out |   ✅    |    ❌     |     ❌     | ❌  | ❌  |

### Text Editing

| Key                | Action        | VS Code | Subl Text | Subl Merge | Zed | Vim |
| ------------------ | ------------- | :-----: | :-------: | :--------: | :-: | :-: |
| `OS_KEY+c`         | Copy          |   ✅    |    ✅     |     ✅     | ❌  | ❌  |
| `OS_KEY+x`         | Cut           |   ✅    |    ✅     |     ✅     | ❌  | ❌  |
| `OS_KEY+v`         | Paste         |   ✅    |    ✅     |     ✅     | ❌  | ❌  |
| `OS_KEY+a`         | Select all    |   ✅    |    ✅     |     ✅     | ❌  | ❌  |
| `OS_KEY+z`         | Undo          |   ✅    |    ✅     |     ✅     | ❌  | ✅  |
| `OS_KEY+y`         | Redo          |   ✅    |    ✅     |     ✅     | ❌  | ✅  |
| `OS_KEY+shift+z`   | Redo (alt)    |   ✅    |    ✅     |     ✅     | ❌  | ✅  |
| `OS_KEY+s`         | Save          |   ✅    |    ✅     |     ❌     | ❌  | ✅  |
| `OS_KEY+shift+s`   | Save all      |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `OS_KEY+l`         | Select line   |   ✅    |    ❌     |     ❌     | ❌  | ✅  |
| `OS_KEY+backspace` | Delete to BOL |   ✅    |    ✅     |     ✅     | ❌  | ✅  |

### Search

| Key              | Action            | VS Code | Subl Text | Subl Merge | Zed | Vim |
| ---------------- | ----------------- | :-----: | :-------: | :--------: | :-: | :-: |
| `OS_KEY+f`       | Find              |   ✅    |    ✅     |     ✅     | ❌  | ❌  |
| `OS_KEY+shift+f` | Find in files     |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `OS_KEY+h`       | Find and replace  |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `OS_KEY+g`       | Find next         |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `OS_KEY+shift+g` | Find prev         |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `OS_KEY+d`       | Select next match |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `OS_KEY+p`       | Quick open / file |   ✅    |    ✅     |     ✅     | ❌  | ❌  |
| `OS_KEY+shift+p` | Command palette   |   ✅    |    ✅     |     ✅     | ❌  | ❌  |
| `OS_KEY+;`       | Goto line         |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `OS_KEY+r`       | Goto symbol       |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `OS_KEY+enter`   | Goto definition   |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `ctrl+m`         | Jump to bracket   |   ✅    |    ✅     |     ❌     | ❌  | ❌  |

### Navigation (cursor movement)

| Key                  | Action           | VS Code | Subl Text | Subl Merge | Zed | Vim |
| -------------------- | ---------------- | :-----: | :-------: | :--------: | :-: | :-: |
| `OS_KEY+up`          | Page up          |   ✅    |    ✅     |     ❌     | ❌  | ✅  |
| `OS_KEY+down`        | Page down        |   ✅    |    ✅     |     ❌     | ❌  | ✅  |
| `OS_KEY+left`        | Home (BOL)       |   ✅    |    ✅     |     ❌     | ❌  | ✅  |
| `OS_KEY+right`       | End (EOL)        |   ✅    |    ✅     |     ❌     | ❌  | ✅  |
| `OS_KEY+shift+up`    | Select page up   |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `OS_KEY+shift+down`  | Select page down |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `OS_KEY+shift+left`  | Select to BOL    |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `OS_KEY+shift+right` | Select to EOL    |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `OS_KEY+ctrl+up`     | Top of file      |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `OS_KEY+ctrl+down`   | Bottom of file   |   ✅    |    ✅     |     ❌     | ❌  | ❌  |

### Code Editing

| Key        | Action         | VS Code | Subl Text | Subl Merge | Zed | Vim |
| ---------- | -------------- | :-----: | :-------: | :--------: | :-: | :-: |
| `OS_KEY+/` | Toggle comment |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `OS_KEY+[` | Outdent        |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `OS_KEY+]` | Indent         |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `OS_KEY+,` | Fold           |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `OS_KEY+.` | Unfold         |   ✅    |    ✅     |     ❌     | ❌  | ❌  |

### Editor UI

| Key                   | Action               | VS Code | Subl Text | Subl Merge | Zed | Vim |
| --------------------- | -------------------- | :-----: | :-------: | :--------: | :-: | :-: |
| `OS_KEY+\`            | Toggle sidebar       |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `OS_KEY+shift+\`      | Toggle activity bar  |   ✅    |    ❌     |     ❌     | ❌  | ❌  |
| `ctrl+shift+OS_KEY+\` | Toggle right sidebar |   ✅    |    ❌     |     ❌     | ❌  | ❌  |
| `` OS_KEY+` ``        | Toggle terminal      |   ✅    |    ❌     |     ❌     | ❌  | ❌  |
| `F5`                  | Refresh / revert     |   ✅    |    ✅     |     ✅     | ❌  | ❌  |
| `F11`                 | Fullscreen           |   ✅    |    ✅     |     ❌     | ❌  | ❌  |

### Splits (editors)

| Key              | Action                 | VS Code | Subl Text | Subl Merge | Zed | Vim |
| ---------------- | ---------------------- | :-----: | :-------: | :--------: | :-: | :-: |
| `ctrl+d`         | Split vertical         |   ✅    |    ✅     |     ❌     | ❌  | ✅  |
| `ctrl+'`         | Split horizontal       |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `OS_KEY+shift+d` | Split horizontal (alt) |   ✅    |    ❌     |     ❌     | ❌  | ❌  |
| `ctrl+w`         | Single column / close  |   ✅    |    ✅     |     ❌     | ❌  | ❌  |
| `ctrl+arrow`     | Navigate splits        |   ❌    |    ❌     |     ❌     | ❌  | ✅  |

### Debugging (VS Code only)

| Key                  | Action         |
| -------------------- | -------------- |
| `OS_KEY+'`           | Step over      |
| `OS_KEY+shift+'`     | Step into      |
| `OS_KEY+shift+1`     | Explorer panel |
| `OS_KEY+shift+2`     | Search panel   |
| `` OS_KEY+shift+` `` | Debug panel    |

---

## Terminal Emulators

### Tabs & Windows

| Key                | Action          | Windows Terminal | Terminator | tmux | iTerm2 |
| ------------------ | --------------- | :--------------: | :--------: | :--: | :----: |
| `OS_KEY+t`         | New tab         |        ✅        |     ✅     |  ✅  |   ☑️   |
| `OS_KEY+1-9`       | Tab by index    |        ✅        |     ✅     |  ✅  |   ☑️   |
| `OS_KEY+shift+[/]` | Prev / next tab |        ✅        |     ✅     |  ✅  |   ☑️   |
| `OS_KEY+w`         | Close pane      |        ✅        |     ✅     |  ✅  |   ☑️   |
| `OS_KEY+q`         | Close window    |        ✅        |     ✅     |  ✅  |   ☑️   |
| `OS_KEY+n`         | New window      |        ✅        |     ✅     |  ✅  |   ☑️   |
| `F2`               | Rename tab      |        ✅        |     ✅     |  ✅  |   ❌   |

### Splits & Panes

| Key                  | Action                      | Windows Terminal |       Terminator        |       tmux        |   iTerm2    |
| -------------------- | --------------------------- | :--------------: | :---------------------: | :---------------: | :---------: |
| `OS_KEY+d`           | Split vertical (left/right) |        ✅        |           ✅            |        ✅         |     ✅      |
| `OS_KEY+shift+d`     | Split horiz (top/bottom)    |        ✅        |           ✅            |        ✅         |     ✅      |
| `OS_KEY+'`           | Split horiz (alt)           |        ✅        | ⚠️ (one key per action) |        ✅         |     ✅      |
| `OS_KEY+arrow`       | Navigate panes              |        ✅        |           ✅            |        ✅         | ☑️ (scroll) |
| `OS_KEY+shift+arrow` | Resize panes                |        ✅        |           ✅            | ⚠️ (prefix+arrow) |     ❌      |
| `OS_KEY+\`           | Toggle UI / fullscreen pane |        ✅        |     ✅ (scrollbar)      |        ✅         |     ❌      |
| `F11`                | Fullscreen                  |        ✅        |           ✅            |        ✅         |     ☑️      |

### Text & Search

| Key        | Action     | Windows Terminal | Terminator | tmux | iTerm2 |
| ---------- | ---------- | :--------------: | :--------: | :--: | :----: |
| `OS_KEY+c` | Copy       |        ✅        |     ✅     |  ❌  |   ☑️   |
| `OS_KEY+v` | Paste      |        ✅        |     ✅     |  ❌  |   ☑️   |
| `OS_KEY+f` | Find       |        ✅        |     ✅     |  ✅  |   ☑️   |
| `OS_KEY+a` | Select all |        ✅        |     ❌     |  ❌  |   ☑️   |

### Zoom

| Key        | Action     | Windows Terminal | Terminator | tmux | iTerm2 |
| ---------- | ---------- | :--------------: | :--------: | :--: | :----: |
| `OS_KEY+=` | Zoom in    |        ✅        |     ✅     |  ❌  |   ☑️   |
| `OS_KEY+-` | Zoom out   |        ✅        |     ✅     |  ❌  |   ☑️   |
| `OS_KEY+0` | Reset zoom |        ✅        |     ✅     |  ❌  |   ☑️   |

### Terminal-specific Gaps

| Gap                                  | Reason                                                            |
| ------------------------------------ | ----------------------------------------------------------------- |
| Terminator `OS_KEY+'`                | Only one key per action; `OS_KEY+shift+d` is the horizontal split |
| tmux `OS_KEY+shift+arrow` resize     | Doesn't work reliably; uses `prefix+arrow` instead                |
| tmux copy/paste                      | Uses its own copy mode; `OS_KEY+c/v` not mapped                   |
| tmux zoom                            | Not applicable; controlled by the outer terminal emulator         |
| iTerm2 pane focus via `OS_KEY+arrow` | `cmd+arrow` scrolls the buffer; pane nav uses different mechanism |

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
| `alt+s`          | Save          |   ✅   |
| `alt+w`          | Close buffer  |   ✅   |
| `alt+l`          | Select line   |   ✅   |
| `alt+backspace`  | Delete to BOL |   ✅   |

### Splits & Navigation

| Key                            | Action           |
| ------------------------------ | ---------------- |
| `ctrl+d`, `,v`, `,5`           | Vertical split   |
| `,s`, `,d`                     | Horizontal split |
| `ctrl+x`, `ctrl+q`, `,w`, `,x` | Close split      |
| `ctrl+arrow`                   | Navigate splits  |

### FZF / Search

| Key            | Action            |
| -------------- | ----------------- |
| `ctrl+t`, `,t` | Fuzzy file finder |
| `ctrl+f`       | Ripgrep search    |
| `,b`           | Buffer list       |
| `,r`           | Recent files      |

---

## Claude Code

| Key                                 | Action       | Notes                          |
| ----------------------------------- | ------------ | ------------------------------ |
| `shift+enter`, `ctrl+enter`         | Newline      |                                |
| `OS_KEY+z`                          | Undo         |                                |
| `OS_KEY+l`                          | Clear input  |                                |
| `ctrl+g`, `ctrl+e`, `ctrl+x ctrl+e` | Open $EDITOR | Opens vim                      |
| `ctrl+v`                            | Paste image  | Mac only; removed on Win/Linux |

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
| `ctrl+t`               | Fuzzy edit (vim)            |  ✅   |        ✅         |
| `ctrl+y`               | Fuzzy edit (default editor) |  ✅   |        ✅         |
| `ctrl+p`               | Fuzzy cd                    |  ✅   |        ✅         |
| `ctrl+b`               | Favorite command picker     |  ✅   |        ✅         |
| `ctrl+g`               | Git log browser             |  ✅   |        ✅         |
| `ctrl+n`               | Make-component scaffold     |  ✅   |        ✅         |
| `ctrl+x`               | Open in $EDITOR             |  ✅   |        ✅         |
| `ctrl+l`               | Clear screen                |  ✅   |        ✅         |

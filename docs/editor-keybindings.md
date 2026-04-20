# Keybinding Reference

`OS_KEY` = **Cmd** (meta) on macOS, **Alt** on Windows/Linux. Browsers are an exception: they use **Cmd** on macOS and **Ctrl** on Windows/Linux natively.

## Source Files

All files under `software/scripts/` unless noted.

| App              | Files                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| VS Code          | `advanced/vs-code-keys.common.jsonc`, `advanced/vs-code-keys.windows.jsonc`         |
| Sublime Text     | `advanced/sublime-text-keys.common.jsonc`, `advanced/sublime-text-keys.windows.jsonc`|
| Sublime Merge    | `advanced/sublime-merge-keys.common.jsonc`, `advanced/sublime-merge-keys.windows.jsonc`|
| Claude Code      | `advanced/claude-keys.common.jsonc`, `advanced/claude-keys.windows.jsonc`            |
| Vim              | `vim-config-settings.vim`                                                            |
| Bash readline    | `bash-keys.profile.bash`                                                             |
| Windows Terminal | `windows/windows-terminal-keys.jsonc`                                                |
| Terminator       | `terminator.js`                                                                      |
| tmux             | `advanced/tmux.config`                                                               |
| iTerm2           | `mac/iterm-profile.jsonc`                                                            |

## Standard Convention

The target keybindings this repo aims for. Each section below shows the convention followed by an implementation matrix. **Empty cells are gaps / TODOs.**

Legend: **✓** = configured by this repo | **native** = app/OS default | **--** = not applicable

---

## Browsers (Brave, Chrome, Edge)

All standard shortcuts are native. No config in this repo. Listed for reference.

| Key                | Action               | Status                             |
| ------------------ | -------------------- | :--------------------------------: |
| `OS_KEY+t`         | New tab              | native                             |
| `OS_KEY+1-9`       | Tab by index         | native                             |
| `OS_KEY+shift+[/]` | Prev / next tab      | native (ctrl+shift+tab / ctrl+tab) |
| `OS_KEY+w`         | Close tab            | native                             |
| `OS_KEY+q`         | Quit                 | native (cmd+q Mac, alt+f4 Win)     |
| `OS_KEY+n`         | New window           | native                             |
| `OS_KEY+shift+n`   | New incognito window | native                             |
| `OS_KEY+=`         | Zoom in              | native                             |
| `OS_KEY+-`         | Zoom out             | native                             |
| `OS_KEY+0`         | Reset zoom (100%)    | native                             |
| `OS_KEY+c`         | Copy                 | native                             |
| `OS_KEY+x`         | Cut                  | native                             |
| `OS_KEY+v`         | Paste                | native                             |
| `OS_KEY+a`         | Select all           | native                             |
| `OS_KEY+z`         | Undo                 | native                             |
| `OS_KEY+y`         | Redo                 | native (ctrl+y Win, cmd+shift+z Mac)|
| `OS_KEY+s`         | Save (download page) | native                             |
| `OS_KEY+f`         | Find                 | native                             |
| `OS_KEY+l`         | Focus address bar    | native                             |
| `F5`               | Refresh              | native                             |
| `F11`              | Fullscreen           | native                             |

---

## Code Editors

Columns: **VSC** = VS Code, **ST** = Sublime Text, **Vim**, **SM** = Sublime Merge, **CC** = Claude Code.

### Tabs & Windows

| Key                | Action               | VSC | ST  | Vim             | SM  | CC  |
| ------------------ | -------------------- | :-: | :-: | :-------------: | :-: | :-: |
| `OS_KEY+t`         | New tab              | --  | --  | --              | --  | --  |
| `OS_KEY+n`         | New file             | ✓   | ✓   | --              | --  | --  |
| `OS_KEY+1-9`       | Tab by index         | ✓   | ✓   | --              | ✓   | --  |
| `OS_KEY+shift+[/]` | Prev / next tab      | ✓   | ✓   | --              | --  | --  |
| `OS_KEY+w`         | Close tab            | ✓   | ✓   | ✓               | ✓   | --  |
| `OS_KEY+q`         | Quit                 | ✓   | ✓   | --              | ✓   | --  |
| `OS_KEY+shift+n`   | New window           | ✓   | ✓   | --              | ✓   | --  |
| `F2`               | Rename (symbol/file) | ✓   | --  | ✓ (paste toggle)| --  | --  |

### Zoom

| Key              | Action             | VSC | ST  | Vim | SM  | CC  |
| ---------------- | ------------------ | :-: | :-: | :-: | :-: | :-: |
| `OS_KEY+=`       | Font zoom in       | ✓   | ✓   | --  | ✓   | --  |
| `OS_KEY+-`       | Font zoom out      | ✓   | ✓   | --  | ✓   | --  |
| `OS_KEY+0`       | Reset font zoom    | ✓   | ✓   | --  | ✓   | --  |
| `OS_KEY+shift+=` | Workspace zoom in  | ✓   | --  | --  | --  | --  |
| `OS_KEY+shift+-` | Workspace zoom out | ✓   | --  | --  | --  | --  |

### Text Editing

| Key                | Action        | VSC | ST  | Vim | SM  | CC             |
| ------------------ | ------------- | :-: | :-: | :-: | :-: | :------------: |
| `OS_KEY+c`         | Copy          | ✓   | ✓   | --  | ✓   | --             |
| `OS_KEY+x`         | Cut           | ✓   | ✓   | --  | --  | --             |
| `OS_KEY+v`         | Paste         | ✓   | ✓   | --  | --  | --             |
| `OS_KEY+a`         | Select all    | ✓   | ✓   | --  | --  | --             |
| `OS_KEY+z`         | Undo          | ✓   | ✓   | ✓   | ✓   | ✓              |
| `OS_KEY+y`         | Redo          | ✓   | ✓   | --  | ✓   | --             |
| `OS_KEY+shift+z`   | Redo (alt)    | ✓   | ✓   | ✓   | ✓   | --             |
| `OS_KEY+s`         | Save          | ✓   | ✓   | ✓   | --  | --             |
| `OS_KEY+shift+s`   | Save all      | ✓   | ✓   | --  | --  | --             |
| `OS_KEY+l`         | Select line   | ✓   | --  | ✓   | --  | ✓ (clear input)|
| `OS_KEY+backspace` | Delete to BOL | ✓   | ✓   | ✓   | --  | --             |

### Search

| Key                | Action            | VSC | ST  | Vim | SM  | CC  |
| ------------------ | ----------------- | :-: | :-: | :-: | :-: | :-: |
| `OS_KEY+f`         | Find              | ✓   | ✓   | --  | ✓   | --  |
| `OS_KEY+shift+f`   | Find in files     | ✓   | ✓   | --  | --  | --  |
| `OS_KEY+h`         | Find and replace  | ✓   | ✓   | --  | --  | --  |
| `OS_KEY+g`         | Find next         | ✓   | ✓   | --  | --  | --  |
| `OS_KEY+shift+g`   | Find prev         | ✓   | ✓   | --  | --  | --  |
| `OS_KEY+d`         | Select next match | ✓   | ✓   | --  | --  | --  |
| `OS_KEY+p`         | Quick open / file | ✓   | ✓   | --  | ✓   | --  |
| `OS_KEY+shift+p`   | Command palette   | ✓   | ✓   | --  | ✓   | --  |
| `OS_KEY+;`         | Goto line         | ✓   | ✓   | --  | --  | --  |
| `OS_KEY+r`         | Goto symbol       | ✓   | ✓   | --  | --  | --  |
| `OS_KEY+enter`     | Goto definition   | ✓   | ✓   | --  | --  | --  |
| `ctrl+m`           | Jump to bracket   | ✓   | ✓   | --  | --  | --  |

### Navigation (cursor movement)

| Key                    | Action           | VSC | ST  | Vim |
| ---------------------- | ---------------- | :-: | :-: | :-: |
| `OS_KEY+up`            | Page up          | ✓   | ✓   | ✓   |
| `OS_KEY+down`          | Page down        | ✓   | ✓   | ✓   |
| `OS_KEY+left`          | Home (BOL)       | ✓   | ✓   | ✓   |
| `OS_KEY+right`         | End (EOL)        | ✓   | ✓   | ✓   |
| `OS_KEY+shift+up`      | Select page up   | ✓   | ✓   | --  |
| `OS_KEY+shift+down`    | Select page down | ✓   | ✓   | --  |
| `OS_KEY+shift+left`    | Select to BOL    | ✓   | ✓   | --  |
| `OS_KEY+shift+right`   | Select to EOL    | ✓   | ✓   | --  |
| `OS_KEY+ctrl+up`       | Top of file      | ✓   | ✓   | --  |
| `OS_KEY+ctrl+down`     | Bottom of file   | ✓   | ✓   | --  |

### Code Editing

| Key        | Action         | VSC | ST  | Vim |
| ---------- | -------------- | :-: | :-: | :-: |
| `OS_KEY+/` | Toggle comment | ✓   | ✓   | --  |
| `OS_KEY+[` | Outdent        | ✓   | --  | --  |
| `OS_KEY+]` | Indent         | ✓   | --  | --  |
| `OS_KEY+,` | Fold           | ✓   | ✓   | --  |
| `OS_KEY+.` | Unfold         | ✓   | ✓   | --  |

### Editor UI

| Key                    | Action               | VSC    | ST     |
| ---------------------- | -------------------- | :----: | :----: |
| `OS_KEY+\`             | Toggle sidebar       | ✓      | ✓      |
| `OS_KEY+shift+\`       | Toggle activity bar  | ✓      | --     |
| `ctrl+shift+OS_KEY+\`  | Toggle right sidebar | ✓      | --     |
| `` OS_KEY+` ``         | Toggle terminal      | ✓      | --     |
| `F5`                   | Refresh / revert     | ✓      | ✓      |
| `F11`                  | Fullscreen           | native | native |

### Splits (editors)

| Key              | Action                 | VSC | ST  | Vim |
| ---------------- | ---------------------- | :-: | :-: | :-: |
| `ctrl+d`         | Split vertical         | ✓   | ✓   | ✓   |
| `ctrl+'`         | Split horizontal       | ✓   | ✓   | --  |
| `OS_KEY+shift+d` | Split horizontal (alt) | ✓   | --  | --  |
| `ctrl+w`         | Single column / close  | ✓   | ✓   | --  |
| `ctrl+arrow`     | Navigate splits        | --  | --  | ✓   |

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

Columns: **WT** = Windows Terminal (Windows), **Term** = Terminator (Linux), **tmux** (Linux/macOS), **iT2** = iTerm2 (macOS).

### Tabs & Windows

| Key                | Action          | WT  | Term | tmux | iT2    |
| ------------------ | --------------- | :-: | :--: | :--: | :----: |
| `OS_KEY+t`         | New tab         | ✓   | ✓    | ✓    | native |
| `OS_KEY+1-9`       | Tab by index    | ✓   | ✓    | ✓    | native |
| `OS_KEY+shift+[/]` | Prev / next tab | ✓   | ✓    | ✓    | native |
| `OS_KEY+w`         | Close pane      | ✓   | ✓    | ✓    | native |
| `OS_KEY+q`         | Close window    | ✓   | ✓    | ✓    | native |
| `OS_KEY+n`         | New window      | ✓   | ✓    | ✓    | native |
| `F2`               | Rename tab      | ✓   | ✓    | ✓    | --     |

### Splits & Panes

| Key                  | Action                      | WT  | Term         | tmux             | iT2              |
| -------------------- | --------------------------- | :-: | :----------: | :--------------: | :--------------: |
| `OS_KEY+d`           | Split vertical (left/right) | ✓   | ✓            | ✓                | ✓                |
| `OS_KEY+shift+d`     | Split horiz (top/bottom)    | ✓   | ✓            | ✓                | ✓                |
| `OS_KEY+'`           | Split horiz (alt)           | ✓   | --           | ✓                | ✓                |
| `OS_KEY+arrow`       | Navigate panes              | ✓   | ✓            | ✓                | native (scroll)  |
| `OS_KEY+shift+arrow` | Resize panes                | ✓   | ✓            | -- (prefix+arrow)| --               |
| `OS_KEY+\`           | Toggle UI / fullscreen pane | ✓   | ✓ (scrollbar)| ✓                | --               |
| `F11`                | Fullscreen                  | ✓   | ✓            | ✓                | native           |

### Text & Search

| Key        | Action     | WT  | Term | tmux | iT2    |
| ---------- | ---------- | :-: | :--: | :--: | :----: |
| `OS_KEY+c` | Copy       | ✓   | ✓    | --   | native |
| `OS_KEY+v` | Paste      | ✓   | ✓    | --   | native |
| `OS_KEY+f` | Find       | ✓   | ✓    | ✓    | native |
| `OS_KEY+a` | Select all | ✓   | --   | --   | native |

### Zoom

| Key        | Action     | WT  | Term | tmux | iT2    |
| ---------- | ---------- | :-: | :--: | :--: | :----: |
| `OS_KEY+=` | Zoom in    | ✓   | ✓    | --   | native |
| `OS_KEY+-` | Zoom out   | ✓   | ✓    | --   | native |
| `OS_KEY+0` | Reset zoom | ✓   | ✓    | --   | native |

### Terminal-specific Gaps

| Gap                                  | Reason                                                            |
| ------------------------------------ | ----------------------------------------------------------------- |
| Terminator `OS_KEY+'`                | Only one key per action; `OS_KEY+shift+d` is the horizontal split |
| tmux `OS_KEY+shift+arrow` resize     | Doesn't work reliably; uses `prefix+arrow` instead                |
| tmux copy/paste                      | Uses its own copy mode; `OS_KEY+c/v` not mapped                  |
| tmux zoom                            | Not applicable; controlled by the outer terminal emulator         |
| iTerm2 pane focus via `OS_KEY+arrow` | `cmd+arrow` scrolls the buffer; pane nav uses different mechanism |

---

## Vim

Vim uses its own conventions. `alt+key` for common shortcuts, `,key` for leader combos, `ctrl+key` for splits/search.

### Common Shortcuts (matching editors)

| Key              | Action        | Status |
| ---------------- | ------------- | :----: |
| `alt+up/down`    | Page up/down  | ✓      |
| `alt+left/right` | Home / end    | ✓      |
| `alt+z`          | Undo          | ✓      |
| `alt+shift+z`    | Redo          | ✓      |
| `alt+s`          | Save          | ✓      |
| `alt+w`          | Close buffer  | ✓      |
| `alt+l`          | Select line   | ✓      |
| `alt+backspace`  | Delete to BOL | ✓      |

### Splits & Navigation

| Key                                 | Action           |
| ----------------------------------- | ---------------- |
| `ctrl+d`, `,v`, `,5`               | Vertical split   |
| `,s`, `,d`                          | Horizontal split |
| `ctrl+x`, `ctrl+q`, `,w`, `,x`     | Close split      |
| `ctrl+arrow`                        | Navigate splits  |

### FZF / Search

| Key              | Action            |
| ---------------- | ----------------- |
| `ctrl+t`, `,t`   | Fuzzy file finder |
| `ctrl+f`         | Ripgrep search    |
| `,b`             | Buffer list       |
| `,r`             | Recent files      |

---

## Claude Code

| Key                             | Action      | Notes                          |
| ------------------------------- | ----------- | ------------------------------ |
| `shift+enter`, `ctrl+enter`     | Newline     |                                |
| `OS_KEY+z`                      | Undo        |                                |
| `OS_KEY+l`                      | Clear input |                                |
| `ctrl+g`, `ctrl+e`, `ctrl+x ctrl+e` | Open $EDITOR | Opens vim                 |
| `ctrl+v`                        | Paste image | Mac only; removed on Win/Linux |

---

## Bash Readline

| Key                   | Action                     | Linux | macOS             |
| --------------------- | -------------------------- | :---: | :---------------: |
| `Tab`                 | fzf-tab complete           | ✓     | ✓                 |
| `shift+tab`           | Reverse complete           | ✓     | ✓                 |
| `ctrl+a` / `ctrl+up`  | Beginning of line         | ✓     | ✓ (option+up)     |
| `ctrl+e` / `ctrl+down`| End of line               | ✓     | ✓ (option+down)   |
| `ctrl+left`           | Word backward              | ✓     | ✓ (option+left)   |
| `ctrl+right`          | Word forward               | ✓     | ✓ (option+right)  |
| `up` / `down`         | History search (prefix)    | ✓     | ✓                 |
| `ctrl+r`              | Fzf history search         | ✓     | ✓                 |
| `ctrl+t`              | Fuzzy edit (vim)           | ✓     | ✓                 |
| `ctrl+y`              | Fuzzy edit (default editor)| ✓     | ✓                 |
| `ctrl+p`              | Fuzzy cd                   | ✓     | ✓                 |
| `ctrl+b`              | Favorite command picker    | ✓     | ✓                 |
| `ctrl+g`              | Git log browser            | ✓     | ✓                 |
| `ctrl+n`              | Make-component scaffold    | ✓     | ✓                 |
| `ctrl+x`              | Open in $EDITOR            | ✓     | ✓                 |
| `ctrl+l`              | Clear screen               | ✓     | ✓                 |

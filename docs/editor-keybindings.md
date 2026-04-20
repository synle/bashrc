# Keybinding Reference

Consolidated keybinding reference across all terminals, editors, and tools in this dotfiles repo. Mac uses **Cmd**, Windows/Linux uses **Alt** as the primary modifier (`OS_KEY`).

## Keybinding Source Files

| App              | Files                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| VS Code          | `vs-code-keys.common.jsonc`, `vs-code-keys.windows.jsonc`             |
| Sublime Text     | `sublime-text-keys.common.jsonc`, `sublime-text-keys.windows.jsonc`   |
| Sublime Merge    | `sublime-merge-keys.common.jsonc`, `sublime-merge-keys.windows.jsonc` |
| Claude Code      | `claude-keys.common.jsonc`, `claude-keys.windows.jsonc`               |
| Vim              | `vim-config-settings.vim`                                             |
| Bash readline    | `bash-keys.profile.bash`                                              |
| Windows Terminal | `windows/windows-terminal-keys.jsonc`                                 |
| Terminator       | `terminator.js`                                                       |
| tmux             | `tmux.config`                                                         |
| iTerm2           | `mac/iterm-profile.jsonc`                                             |

All files live under `software/scripts/` unless otherwise noted.

## Terminal Emulators

### Window and Tab Management

| Action         | Windows Terminal |  Terminator   |     tmux      |         iTerm2          |
| -------------- | :--------------: | :-----------: | :-----------: | :---------------------: |
| New tab        |     `alt+t`      |    `alt+t`    |    `alt+t`    |    `cmd+t` (default)    |
| Next tab       |  `alt+shift+]`   | `alt+shift+]` | `alt+shift+]` | `cmd+shift+]` (default) |
| Prev tab       |  `alt+shift+[`   | `alt+shift+[` | `alt+shift+[` | `cmd+shift+[` (default) |
| Tab 1-9        |    `alt+1-9`     |   `alt+1-9`   |   `alt+1-9`   |   `cmd+1-9` (default)   |
| Rename tab     |       `F2`       |     `F2`      |     `F2`      |           --            |
| Close tab/pane |     `alt+w`      |    `alt+w`    |    `alt+w`    |    `cmd+w` (default)    |
| Close window   |     `alt+q`      |    `alt+q`    |    `alt+q`    |    `cmd+q` (default)    |
| New window     |     `alt+n`      |    `alt+n`    |    `alt+n`    |    `cmd+n` (default)    |

### Splits and Panes

| Action                 | Windows Terminal  |         Terminator         |      tmux      |        iTerm2        |
| ---------------------- | :---------------: | :------------------------: | :------------: | :------------------: |
| Split vertical         |      `alt+d`      |          `alt+d`           |    `alt+d`     |       `cmd+d`        |
| Split horizontal       |   `alt+shift+d`   |       `alt+shift+d`        | `alt+shift+d`  |    `cmd+shift+d`     |
| Split horizontal (alt) |      `alt+'`      |             --             |    `alt+'`     |       `cmd+'`        |
| Focus pane             |    `alt+arrow`    |        `alt+arrow`         |  `alt+arrow`   | `cmd+arrow` (scroll) |
| Resize pane            | `alt+shift+arrow` |     `alt+shift+arrow`      | `prefix+arrow` |          --          |
| Fullscreen toggle      |  `alt+\`, `F11`   | `alt+\` (scrollbar), `F11` | `alt+\`, `F11` |          --          |

### Text and Search

| Action     | Windows Terminal | Terminator |  tmux   |      iTerm2       |
| ---------- | :--------------: | :--------: | :-----: | :---------------: |
| Copy       |     `alt+c`      |  `alt+c`   |   --    | `cmd+c` (default) |
| Paste      |     `alt+v`      |  `alt+v`   |   --    | `cmd+v` (default) |
| Find       |     `alt+f`      |  `alt+f`   | `alt+f` | `cmd+f` (default) |
| Select all |     `alt+a`      |     --     |   --    | `cmd+a` (default) |

### Font Zoom

| Action     | Windows Terminal | Terminator | tmux |      iTerm2       |
| ---------- | :--------------: | :--------: | :--: | :---------------: |
| Zoom in    |     `alt+=`      |  `alt+=`   | N/A  | `cmd+=` (default) |
| Zoom out   |     `alt+-`      |  `alt+-`   | N/A  | `cmd+-` (default) |
| Reset zoom |     `alt+0`      |  `alt+0`   | N/A  | `cmd+0` (default) |

### Known Gaps

- **Terminator `alt+'`**: Only one key per action; `alt+shift+d` covers horizontal split.
- **tmux resize**: `alt+shift+arrow` doesn't work reliably; uses `prefix+arrow` instead.
- **iTerm2 pane focus**: `cmd+arrow` scrolls; doesn't navigate panes like other terminals.
- **tmux copy/paste**: Uses its own copy mode; not mapped to `alt+c/v`.
- **tmux font zoom**: Not applicable; controlled by the outer terminal emulator.

## Code Editors

All editors use `OS_KEY` (Cmd on Mac, Alt on Windows/Linux) for the primary modifier. Common files define cross-platform bindings; Windows-only files add `alt+` equivalents for actions that Mac handles natively with `cmd+`.

### Tab and Window Management

| Action     | Key (common)  |   VS Code    | Sublime Text | Sublime Merge |
| ---------- | :-----------: | :----------: | :----------: | :-----------: |
| Tab 1-9    | `OS_KEY+1-9`  |  tab index   |  tab index   |   tab index   |
| Next tab   | `alt+shift+]` | next editor  |  next view   |      --       |
| Prev tab   | `alt+shift+[` | prev editor  |  prev view   |      --       |
| Close tab  |    `alt+w`    | close editor |    close     | close window  |
| Close app  |    `alt+q`    | close window |     exit     |     exit      |
| New window | `alt+shift+n` |  new window  |  new window  |  new window   |
| New file   |  `OS_KEY+n`   |   new file   |   new file   |      --       |

### Split/Layout

| Action            |      Key      |    VS Code    | Sublime Text |     Vim     |
| ----------------- | :-----------: | :-----------: | :----------: | :---------: |
| Split vertical    |   `ctrl+d`    |  split right  | 2-col layout |   vsplit    |
| Split horizontal  |   `ctrl+'`    |  split down   | 2-row layout |     --      |
| Split horiz (alt) | `alt+shift+d` |  split down   |      --      |     --      |
| Single column     |   `ctrl+w`    | single layout | 1-col layout | close split |

### Navigation

| Action            |       Key        |    VS Code    |  Sublime Text  | Vim |
| ----------------- | :--------------: | :-----------: | :------------: | :-: |
| Quick open        |     `alt+p`      |  quick open   |   goto file    | --  |
| Command palette   |  `alt+shift+p`   |   commands    |    commands    | --  |
| Goto line         |    `OS_KEY+;`    |   goto line   |   goto line    | --  |
| Goto symbol       |    `OS_KEY+r`    |  goto symbol  |  goto symbol   | --  |
| Goto definition   |  `OS_KEY+enter`  |  reveal def   |    goto def    | --  |
| Goto references   |  `shift+enter`   |  references   | quick goto var | --  |
| Jump to bracket   |     `ctrl+m`     | bracket jump  |  bracket jump  | --  |
| Find              |    `OS_KEY+f`    |     find      |      find      | --  |
| Find in files     | `OS_KEY+shift+f` | find in files | find in files  | --  |
| Find and replace  |    `OS_KEY+h`    |    replace    |    replace     | --  |
| Find next         |    `OS_KEY+g`    |  next match   |   find next    | --  |
| Find prev         | `OS_KEY+shift+g` |  prev match   |   find prev    | --  |
| Select next match |     `alt+d`      | add selection |   find under   | --  |

### Text Editing

| Action         |  Key (Windows/Linux)   |   VS Code    | Sublime Text  | Vim  |
| -------------- | :--------------------: | :----------: | :-----------: | :--: |
| Copy           |        `alt+c`         |     copy     |     copy      |  --  |
| Paste          |        `alt+v`         |    paste     |     paste     |  --  |
| Cut            |        `alt+x`         |     cut      |      cut      |  --  |
| Undo           |        `alt+z`         |     undo     |     undo      | undo |
| Redo           | `alt+y`, `alt+shift+z` |     redo     |     redo      | redo |
| Save           |        `alt+s`         |     save     |     save      | `:w` |
| Save all       |     `alt+shift+s`      |   save all   |    save as    |  --  |
| Select all     |        `alt+a`         |  select all  |  select all   |  --  |
| Select line    |        `alt+l`         | expand line  |      --       | `V`  |
| Delete to BOL  |    `alt+backspace`     | delete left  | delete to BOL | `d0` |
| Toggle comment |        `alt+/`         | comment line | comment line  |  --  |
| Indent         |        `alt+]`         |    indent    |      --       |  --  |
| Outdent        |        `alt+[`         |   outdent    |      --       |  --  |

### Cursor Movement (Windows/Linux `alt+` keys)

| Action           |        Key        |     VS Code      |   Sublime Text   |   Vim    |
| ---------------- | :---------------: | :--------------: | :--------------: | :------: |
| Page up          |     `alt+up`      |     page up      |     page up      | `ctrl+b` |
| Page down        |    `alt+down`     |    page down     |    page down     | `ctrl+f` |
| Home (BOL)       |    `alt+left`     |   cursor home    |   move to BOL    |  `Home`  |
| End (EOL)        |    `alt+right`    |    cursor end    |   move to EOL    |  `End`   |
| Select page up   |  `alt+shift+up`   |  page up select  |  page up select  |    --    |
| Select page down | `alt+shift+down`  | page down select | page down select |    --    |
| Select to home   | `alt+shift+left`  |   home select    |    BOL select    |    --    |
| Select to end    | `alt+shift+right` |    end select    |    EOL select    |    --    |
| Top of file      |   `alt+ctrl+up`   |    cursor top    |       BOF        |    --    |
| Bottom of file   |  `alt+ctrl+down`  |  cursor bottom   |       EOF        |    --    |

### Font Zoom

| Action             |       Key        |      VS Code       | Sublime Text  | Sublime Merge |
| ------------------ | :--------------: | :----------------: | :-----------: | :-----------: |
| Font zoom in       |    `OS_KEY+=`    |    font zoom in    | increase font | increase font |
| Font zoom out      |    `OS_KEY+-`    |   font zoom out    | decrease font | decrease font |
| Font zoom reset    |    `OS_KEY+0`    |  font zoom reset   |  reset font   |  reset font   |
| Workspace zoom in  | `OS_KEY+shift+=` | workspace zoom in  |      --       |      --       |
| Workspace zoom out | `OS_KEY+shift+-` | workspace zoom out |      --       |      --       |

### Editor UI

| Action               |          Key          |     VS Code     |  Sublime Text  |
| -------------------- | :-------------------: | :-------------: | :------------: |
| Toggle sidebar       |      `OS_KEY+\`       | toggle sidebar  | toggle sidebar |
| Toggle activity bar  |   `OS_KEY+shift+\`    | toggle activity |       --       |
| Toggle right sidebar | `shift+ctrl+OS_KEY+\` | toggle aux bar  |       --       |
| Toggle terminal      |      `` alt+` ``      | toggle terminal |       --       |
| Fold                 |      `OS_KEY+,`       |      fold       |      fold      |
| Unfold               |      `OS_KEY+.`       |     unfold      |     unfold     |
| Rename               |         `F2`          |  rename symbol  |       --       |
| Refresh              |         `F5`          | refresh/revert  | refresh/revert |

### Debugging (VS Code)

| Action         | Key                  |
| -------------- | -------------------- |
| Step over      | `OS_KEY+'`           |
| Step into      | `OS_KEY+shift+'`     |
| Explorer panel | `OS_KEY+shift+1`     |
| Search panel   | `OS_KEY+shift+2`     |
| Debug panel    | `` OS_KEY+shift+` `` |

## Vim

Vim uses its own modifier conventions. `<A-key>` = Alt/Option, `,key` = leader combos.

### Splits

| Action           | Key                            |
| ---------------- | ------------------------------ |
| Vertical split   | `ctrl+d`, `,v`, `,5`           |
| Horizontal split | `,s`, `,d`                     |
| Close split      | `ctrl+x`, `ctrl+q`, `,w`, `,x` |
| Navigate splits  | `ctrl+arrow`                   |

### FZF / Search

| Action            | Key            |
| ----------------- | -------------- |
| Fuzzy file finder | `ctrl+t`, `,t` |
| Ripgrep search    | `ctrl+f`       |
| Buffer list       | `,b`           |
| Recent files      | `,r`           |

### Navigation (Alt+Arrow)

| Action     | Key         |
| ---------- | ----------- |
| Page up    | `alt+up`    |
| Page down  | `alt+down`  |
| Home (BOL) | `alt+left`  |
| End (EOL)  | `alt+right` |

### Editing

| Action               | Key             |
| -------------------- | --------------- |
| Undo                 | `alt+z`         |
| Redo                 | `alt+shift+z`   |
| Save                 | `alt+s`         |
| Close buffer         | `alt+w`         |
| Select line          | `alt+l`         |
| Delete to BOL        | `alt+backspace` |
| Clear search         | `,n`            |
| Copy to clipboard    | `,c`            |
| Paste from clipboard | `,p`            |
| Toggle line numbers  | `\\`, `[`       |
| Toggle whitespace    | `]`             |
| Toggle paste mode    | `F2`            |

## Claude Code

| Action          |            Key (common)             | Notes                                                   |
| --------------- | :---------------------------------: | ------------------------------------------------------- |
| Newline         |     `shift+enter`, `ctrl+enter`     |                                                         |
| Undo            |             `OS_KEY+z`              |                                                         |
| Clear input     |             `OS_KEY+l`              |                                                         |
| External editor | `ctrl+g`, `ctrl+e`, `ctrl+x ctrl+e` | Opens `$EDITOR`                                         |
| Paste image     |              `ctrl+v`               | Removed on Windows/Linux (`alt+v` conflicts with paste) |

## Bash Readline

| Action               |      Key (Linux)      |       Key (macOS)       |
| -------------------- | :-------------------: | :---------------------: |
| Tab complete         |    `Tab` (fzf-tab)    |     `Tab` (fzf-tab)     |
| Reverse complete     |      `shift+tab`      |       `shift+tab`       |
| Beginning of line    |  `ctrl+a`, `ctrl+up`  |  `ctrl+a`, `option+up`  |
| End of line          | `ctrl+e`, `ctrl+down` | `ctrl+e`, `option+down` |
| Word backward        |      `ctrl+left`      |      `option+left`      |
| Word forward         |     `ctrl+right`      |     `option+right`      |
| History search up    |         `up`          |          `up`           |
| History search down  |        `down`         |         `down`          |
| Fzf history          |       `ctrl+r`        |        `ctrl+r`         |
| Fuzzy edit (vim)     |       `ctrl+t`        |        `ctrl+t`         |
| Fuzzy edit (default) |       `ctrl+y`        |        `ctrl+y`         |
| Fuzzy cd             |       `ctrl+p`        |        `ctrl+p`         |
| Favorite command     |       `ctrl+b`        |        `ctrl+b`         |
| Git log browser      |       `ctrl+g`        |        `ctrl+g`         |
| Scaffold             |       `ctrl+n`        |        `ctrl+n`         |
| Open in $EDITOR      |       `ctrl+x`        |        `ctrl+x`         |
| Clear screen         |       `ctrl+l`        |        `ctrl+l`         |

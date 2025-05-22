# Editor & Terminal Keybinding Conventions

Keybindings are split into **common** (cross-platform) and **platform-specific** files. Common files use `OS_KEY` which maps to `cmd` on Mac and `alt` on Windows/Linux. Platform-specific files use literal keys (`alt+`, `alt-`).

## Keybinding files by app

| App              | Common (OS_KEY)                       | Windows-only                                       |
| ---------------- | ------------------------------------- | -------------------------------------------------- |
| VS Code          | `vs-code-keys.common.jsonc`           | `vs-code-keys.windows.jsonc`                       |
| Sublime Text     | `sublime-text-keys.common.jsonc`      | `sublime-text-keys.windows.jsonc`                  |
| Zed              | `zed-editor-keys.js` (common section) | `zed-editor-keys.js` (`WINDOWS_ONLY_KEY_BINDINGS`) |
| Windows Terminal | —                                     | `windows/windows-terminal-keys.jsonc`              |
| Terminator       | —                                     | `terminator.js`                                    |

All keybinding files live under `software/scripts/`.

## Standard Windows `alt+` keybindings

These mirror Mac `cmd+` behavior. Before adding a new Windows-only binding, check if an `OS_KEY` equivalent already exists in the common file — it will already map to `alt` on Windows.

| Key               | Action                   | Where defined                                                          |
| ----------------- | ------------------------ | ---------------------------------------------------------------------- |
| `alt+q`           | Quit / close app         | Windows-only files (no Mac equivalent needed — Mac has native `cmd+q`) |
| `alt+w`           | Close tab / pane         | Windows-only files (same reason)                                       |
| `alt+1`–`alt+9`   | Switch to tab by index   | Common files via `OS_KEY+1`–`OS_KEY+9`                                 |
| `alt+0`           | Reset font size          | Common files via `OS_KEY+0`                                            |
| `alt+s`           | Save                     | Windows-only files                                                     |
| `alt+shift+s`     | Save all                 | Windows-only files                                                     |
| `alt+c/v/x`       | Copy / paste / cut       | Windows-only files                                                     |
| `alt+z/y`         | Undo / redo              | Windows-only files                                                     |
| `alt+shift+n`     | New window               | Windows-only files                                                     |
| `alt+p`           | Quick open / goto file   | Windows-only files                                                     |
| `alt+shift+p`     | Command palette          | Windows-only files                                                     |
| `alt+f`           | Find                     | Windows-only files                                                     |
| `alt+h`           | Find and replace         | Windows-only files                                                     |
| `alt+d`           | Select next match        | Windows-only files                                                     |
| `alt+/`           | Toggle comment           | Windows-only files                                                     |
| `alt+[` / `alt+]` | Outdent / indent         | Windows-only files                                                     |
| `alt+shift+[/]`   | Previous / next tab      | Windows-only files                                                     |
| `alt+backspace`   | Delete to BOL            | Windows-only files                                                     |
| `alt+=` / `alt+-` | Increase / decrease font | Windows-only files                                                     |
| `alt+o`           | Open file                | Windows-only files                                                     |
| `` alt+` ``       | Toggle terminal          | Windows-only files                                                     |

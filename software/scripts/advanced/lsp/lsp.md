# LSP Server Install Layer

## Purpose

Shared LSP server binaries on `$PATH` so vim, Sublime Text, Zed, and VS Code all hit the same brain. One `install.sh` installs every language server we use across editors; each editor's config layer only needs to point at the installed binary by name. Skipped entirely in CI.

## Server Table

| Language        | Server binary                     | Install via                                  |
| --------------- | --------------------------------- | -------------------------------------------- |
| TypeScript / JS | `typescript-language-server`      | npm `typescript-language-server`             |
| TypeScript SDK  | `tsc`                             | npm `typescript`                             |
| HTML            | `vscode-html-language-server`     | npm `vscode-langservers-extracted`           |
| CSS             | `vscode-css-language-server`      | npm `vscode-langservers-extracted`           |
| JSON            | `vscode-json-language-server`     | npm `vscode-langservers-extracted`           |
| ESLint          | `vscode-eslint-language-server`   | npm `vscode-langservers-extracted`           |
| Python          | `pyright-langserver`              | npm `pyright`                                |
| Bash            | `bash-language-server`            | npm `bash-language-server`                   |
| YAML            | `yaml-language-server`            | npm `yaml-language-server`                   |
| Dockerfile      | `docker-langserver`               | npm `dockerfile-language-server-nodejs`      |
| Markdown        | `vscode-markdown-language-server` | npm `vscode-markdown-languageserver`         |
| Vue             | `vue-language-server`             | npm `@vue/language-server`                   |
| Tailwind CSS    | `tailwindcss-language-server`     | npm `@tailwindcss/language-server`           |
| GraphQL         | `graphql-lsp`                     | npm `graphql-language-service-cli`           |
| Prisma          | `prisma-language-server`          | npm `@prisma/language-server`                |
| SQL             | `sql-language-server`             | npm `sql-language-server`                    |
| Rust            | `rust-analyzer`                   | GitHub release (gunzip)                      |
| TOML            | `taplo`                           | GitHub release (gunzip)                      |
| Java            | `jdtls`                           | GitHub release (tarball + launcher)          |
| Go              | `gopls`                           | `go install golang.org/x/tools/gopls@latest` |

## Editor Wiring

- **Zed**: `settings.json` `lsp.*.binary.path` overrides point at the installed binaries by absolute path.
- **VS Code**: extension IDs live in `vs-code.js` — the matching extensions discover the binaries on `$PATH`.
- **Sublime**: `LSP` package + per-language `LSP-*` packages (e.g. `LSP-pyright`, `LSP-typescript`) installed via Package Control; configured to use the shared binaries.
- **Vim**: `coc.nvim` with `coc-settings.json` pointing each language to the shared server binary.

## Adding a New Server

1. Pick an install mode by what the upstream ships:
   - npm package → add an `npm_install_global <pkg> [bin]` call in section 1 of `install.sh`. Pass the explicit binary name when it differs from the package name.
   - GitHub release standalone binary → add a curl + gunzip/tar block in section 2 with OS+arch detection, skip-if-present, and `safe_chmod +x`.
   - Go-toolchain-only (`go install`) → mirror the gopls block in section 3.
2. Add a row to the Server Table above.
3. Wire each editor: add the binary path to Zed `settings.json`, an extension to `vs-code.js`, the corresponding `LSP-*` package to Sublime, and a `languageserver` entry to `coc-settings.json` for Vim.

## Formatter Setup

Goal: one Prettier config (`.prettierrc` at repo root) drive all four editors uniformly for the file types Prettier supports; native LSP formatters cover everything else. Save and the unified format chord (`ctrl+shift+OS_KEY+f` — `Ctrl+Shift+Cmd+F` mac / `Ctrl+Shift+Alt+F` linux) route through the **same engine** per file type in every editor.

| Editor       | Prettier types (JS/TS/JSON/CSS/HTML/MD/YAML/GraphQL/Vue) | Native LSP types (Python/Rust/Go/Java) | Save trigger                                            | Chord trigger                                                                             |
| ------------ | -------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| VS Code      | `esbenp.prettier-vscode` extension                       | Per-language LSP extension             | `editor.formatOnSave: true`                             | `editor.action.formatDocument` → honors `editor.defaultFormatter` / `[lang]`              |
| Zed          | Built-in prettier integration (`prettier.allowed: true`) | Built-in LSP formatter                 | `format_on_save: "on"` + `languages.<X>.formatter`      | `editor::Format` → honors `formatter` setting                                             |
| Sublime Text | `JsPrettier` package (runs `prettier` CLI)               | `LSP` package + per-language `LSP-*`   | JsPrettier `auto_format_on_save` + `lsp_format_on_save` | Context-bound chord — `js_prettier` for prettier syntaxes, `lsp_format_document` fallback |
| Vim          | (deferred) `coc-prettier`                                | `coc.nvim` with `coc-settings.json`    | `autocmd BufWritePre` (manual)                          | `<Plug>(coc-format)` / `:CocAction format`                                                |

Repo source files:

- VS Code: `software/scripts/advanced/vs-code-config.jsonc` (`editor.formatOnSave`, `editor.defaultFormatter`, explicit `[lang]` overrides for every Prettier-supported syntax + native LSP overrides for Python/Rust/Go/Java).
- Zed: `software/scripts/advanced/zed-config.jsonc` (`languages.<X>.formatter: "prettier"` block + `prettier.allowed: true`; `format_on_save: "on"` set globally near the top).
- Sublime: `software/scripts/advanced/sublime-text.js` writes `Packages/User/JsPrettier.sublime-settings` (`auto_format_on_save: true`); `software/scripts/advanced/lsp/sublime.js` writes `Packages/User/LSP.sublime-settings` (`lsp_format_on_save: true`).
- Sublime chord: `software/scripts/advanced/sublime-text-keys.common.jsonc` — context-bound binding (selector match → `js_prettier`, fallback → `lsp_format_document`).

## Plugins & Extensions Reference

Every plugin/extension/package that participates in LSP + formatting, by editor. Each row lists what it does, where its settings live on disk, and where the repo declares/configures it. **Read this before debugging — most "why isn't X working" answers are "the plugin isn't installed yet" or "the setting is in a different file than you thought".**

### VS Code extensions

Installed via `software/scripts/advanced/vs-code-ext.sh` (which curls `.build/vs-code-ext-{mac,linux,windows}` generated from the `TO_INSTALL_EXTENSIONS` list in `software/scripts/advanced/vs-code.js`). The same list is mirrored into `.devcontainer/devcontainer.json` for codespaces.

| Extension ID                    | Role                                                                           | On-disk settings path                                                                                   | Repo source for config                           |
| ------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `esbenp.prettier-vscode`        | Prettier integration — owns format for JS/TS/JSON/CSS/HTML/MD/YAML/GraphQL/Vue | `~/Library/Application Support/Code/User/settings.json` → `editor.defaultFormatter`, `[lang]` overrides | `software/scripts/advanced/vs-code-config.jsonc` |
| `dbaeumer.vscode-eslint`        | ESLint diagnostics + autofix-on-save                                           | Same settings.json → `eslint.*`, `editor.codeActionsOnSave["source.fixAll"]`                            | `vs-code-config.jsonc`                           |
| `ms-pyright.pyright`            | Python LSP — diagnostics + autocomplete (no format)                            | Same settings.json → `python.analysis.*`; per-project `pyrightconfig.json`                              | `vs-code.js` `TO_INSTALL_EXTENSIONS`             |
| `charliermarsh.ruff`            | Python format + lint (replaces Black + Flake8 for us)                          | Same settings.json → `[python]: { "editor.defaultFormatter": "charliermarsh.ruff" }`                    | `vs-code-config.jsonc`                           |
| `rust-lang.rust-analyzer`       | Rust LSP — diagnostics + format (shells out to rustfmt)                        | Same settings.json → `rust-analyzer.*`                                                                  | `vs-code.js` `TO_INSTALL_EXTENSIONS`             |
| `golang.go`                     | Go LSP — diagnostics + format (gopls/gofmt)                                    | Same settings.json → `go.*`                                                                             | `vs-code.js` `TO_INSTALL_EXTENSIONS`             |
| `redhat.java`                   | Java LSP — JDTLS-backed                                                        | Same settings.json → `java.*`                                                                           | `vs-code.js` `TO_INSTALL_EXTENSIONS`             |
| `redhat.vscode-yaml`            | YAML LSP — diagnostics + format                                                | Same settings.json → `yaml.*`                                                                           | `vs-code.js` `TO_INSTALL_EXTENSIONS`             |
| `mads-hartmann.bash-ide-vscode` | Bash LSP — diagnostics + shellcheck                                            | Same settings.json → `bashIde.*`                                                                        | `vs-code.js` `TO_INSTALL_EXTENSIONS`             |
| `bradlc.vscode-tailwindcss`     | Tailwind LSP — class autocomplete + sort                                       | Same settings.json → `tailwindCSS.*`                                                                    | `vs-code.js` `TO_INSTALL_EXTENSIONS`             |
| `ms-azuretools.vscode-docker`   | Dockerfile + Compose LSP                                                       | Same settings.json → `docker.*`                                                                         | `vs-code.js` `TO_INSTALL_EXTENSIONS`             |
| `Vue.volar`                     | Vue 3 LSP                                                                      | Same settings.json → `vue.*`                                                                            | `vs-code.js` `TO_INSTALL_EXTENSIONS`             |
| `GraphQL.vscode-graphql`        | GraphQL LSP                                                                    | Same settings.json → `graphql.*`                                                                        | `vs-code.js` `TO_INSTALL_EXTENSIONS`             |
| `Prisma.prisma`                 | Prisma schema LSP                                                              | Same settings.json → `prisma.*`                                                                         | `vs-code.js` `TO_INSTALL_EXTENSIONS`             |
| `tamasfe.even-better-toml`      | TOML LSP — diagnostics + format (taplo)                                        | Same settings.json → `evenBetterToml.*`                                                                 | `vs-code.js` `TO_INSTALL_EXTENSIONS`             |

Where to inspect at runtime:

- `Cmd+Shift+P` → `Preferences: Open User Settings (JSON)` — opens the live settings file.
- `Cmd+Shift+P` → `Extensions: Show Installed Extensions` — confirms which extensions are loaded.
- `View → Output` → dropdown → pick `Prettier` / `ESLint` / `Pyright` / etc. — per-server logs.

### Sublime Text packages

Installed via Package Control. Repo declares the list in two places:

- `software/scripts/advanced/sublime-text.js` `toInstallExtensions` — non-LSP packages (JsPrettier, CodeFormatter, etc.) + themes.
- `software/scripts/advanced/lsp/lsp-common.js` `getSublimeLspPackages()` — the `LSP` core + every `LSP-*` helper derived from `LSP_SERVERS`.

Both lists get unioned into `~/Library/Application Support/Sublime Text/Packages/User/Package Control.sublime-settings` `installed_packages`. Package Control diffs this against `Installed Packages/` on the next Sublime startup and downloads missing entries.

| Package             | Role                                                                                                                                 | On-disk settings path                              | Repo source for config                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | -------------------------------------------------------------------------- |
| `JsPrettier`        | Wraps `prettier` CLI as a Sublime command. Owns format-on-save AND format chord (via context binding) for all prettier syntaxes.     | `Packages/User/JsPrettier.sublime-settings`        | Written by `sublime-text.js` `_doConfigWork` → `auto_format_on_save: true` |
| `LSP`               | Sublime LSP framework core. Talks LSP protocol to every `LSP-*` helper.                                                              | `Packages/User/LSP.sublime-settings`               | Written by `lsp/sublime.js` → `lsp_format_on_save: true`                   |
| `LSP-typescript`    | TypeScript / JS LSP helper (wraps `typescript-language-server`).                                                                     | `Packages/User/LSP-typescript.sublime-settings`    | Auto-config from `LSP_SERVERS.typescript`                                  |
| `LSP-pyright`       | Python LSP helper (wraps `pyright-langserver`). Diagnostics + autocomplete; does NOT format (use `ruff` for that).                   | `Packages/User/LSP-pyright.sublime-settings`       | Auto-config from `LSP_SERVERS.pyright`                                     |
| `LSP-rust-analyzer` | Rust LSP helper (wraps `rust-analyzer`). Includes format (rustfmt).                                                                  | `Packages/User/LSP-rust-analyzer.sublime-settings` | Auto-config from `LSP_SERVERS["rust-analyzer"]`                            |
| `LSP-gopls`         | Go LSP helper (wraps `gopls`). Includes format (gofmt/goimports).                                                                    | `Packages/User/LSP-gopls.sublime-settings`         | Auto-config from `LSP_SERVERS.gopls`                                       |
| `LSP-jdtls`         | Java LSP helper (wraps `jdtls`). Includes Eclipse formatter.                                                                         | `Packages/User/LSP-jdtls.sublime-settings`         | Auto-config from `LSP_SERVERS.jdtls`                                       |
| `LSP-bash`          | Bash LSP helper (wraps `bash-language-server`).                                                                                      | `Packages/User/LSP-bash.sublime-settings`          | Auto-config from `LSP_SERVERS.bash`                                        |
| `LSP-yaml`          | YAML LSP helper (wraps `yaml-language-server`).                                                                                      | `Packages/User/LSP-yaml.sublime-settings`          | Auto-config from `LSP_SERVERS.yaml`                                        |
| `LSP-html`          | HTML LSP helper (wraps `vscode-html-language-server`).                                                                               | `Packages/User/LSP-html.sublime-settings`          | Auto-config from `LSP_SERVERS.html`                                        |
| `LSP-css`           | CSS LSP helper (wraps `vscode-css-language-server`).                                                                                 | `Packages/User/LSP-css.sublime-settings`           | Auto-config from `LSP_SERVERS.css`                                         |
| `LSP-json`          | JSON LSP helper (wraps `vscode-json-language-server`).                                                                               | `Packages/User/LSP-json.sublime-settings`          | Auto-config from `LSP_SERVERS.json`                                        |
| `LSP-eslint`        | ESLint LSP helper (wraps `vscode-eslint-language-server`). Requires `eslint` in project `node_modules/` OR a global eslint install.  | `Packages/User/LSP-eslint.sublime-settings`        | Auto-config from `LSP_SERVERS.eslint`                                      |
| `LSP-dockerfile`    | Dockerfile LSP helper (wraps `docker-langserver`).                                                                                   | `Packages/User/LSP-dockerfile.sublime-settings`    | Auto-config from `LSP_SERVERS.docker`                                      |
| `LSP-marksman`      | Markdown LSP helper (wraps `marksman` binary — auto-downloaded by the package). Provides link refs / TOC / nav. **Does NOT format.** | `Packages/User/LSP-marksman.sublime-settings`      | Auto-config from `LSP_SERVERS.markdown`                                    |
| `LSP-volar`         | Vue 3 LSP helper (wraps `vue-language-server`).                                                                                      | `Packages/User/LSP-volar.sublime-settings`         | Auto-config from `LSP_SERVERS.vue`                                         |
| `LSP-tailwindcss`   | Tailwind LSP helper (wraps `tailwindcss-language-server`). Auto-runs `npm ci` for its own bundled server on first launch.            | `Packages/User/LSP-tailwindcss.sublime-settings`   | Auto-config from `LSP_SERVERS.tailwind`                                    |
| `LSP-graphql`       | GraphQL LSP helper (wraps `graphql-lsp`).                                                                                            | `Packages/User/LSP-graphql.sublime-settings`       | Auto-config from `LSP_SERVERS.graphql`                                     |
| `LSP-prisma`        | Prisma LSP helper (wraps `prisma-language-server`).                                                                                  | `Packages/User/LSP-prisma.sublime-settings`        | Auto-config from `LSP_SERVERS.prisma`                                      |
| `LSP-SQL`           | SQL LSP helper (wraps `sql-language-server`).                                                                                        | `Packages/User/LSP-SQL.sublime-settings`           | Auto-config from `LSP_SERVERS.sql`                                         |
| `CodeFormatter`     | Catch-all formatter for syntaxes not covered by Prettier or LSP (PHP, etc.). Legacy — keep for now, unused by current workflow.      | `Packages/User/CodeFormatter.sublime-settings`     | `sublime-text.js` `toInstallExtensions` list                               |

Where to inspect at runtime:

- `Cmd+Shift+P` → `Package Control: List Packages` — confirms which packages installed.
- `Cmd+Shift+P` → `Preferences: List Packages` — list of all loaded packages including dependencies.
- `Cmd+Shift+P` → `LSP: Toggle Log Panel` — every LSP JSON-RPC message in/out.
- `Cmd+Shift+P` → `LSP: Show LSP Servers` — what's attached to the current buffer.
- `View → Show Console` — Python REPL where Package Control logs installs/errors.
- `Tools → Developer → Show Scope Name` — current syntax scope under cursor (essential for chord-context debugging).

NOTES we hit while wiring Sublime:

- **`LSP-prettier` is NOT used.** We tried it and it didn't auto-install reliably from Package Control or didn't attach to buffers. JsPrettier is the working alternative.
- **`LSP-marksman` does not claim `documentFormattingProvider`** in its `initialize` response — so `lsp_format_document` on `.md` finds zero candidates and silently no-ops. JsPrettier owns markdown format via the context-bound chord.
- **`LSP-eslint` needs eslint installed** in either project `node_modules/` or globally on `$PATH`. Without either, you get `"Failed resolving eslint library"` warnings in the log — harmless if you don't use ESLint diagnostics in Sublime; disable the package or install eslint to silence.

### Zed extensions / built-ins

Zed has first-class LSP and formatter support built in — most servers download themselves the first time you open a matching file. Our config overrides where the binaries come from:

| Built-in / extension   | Role                                                                                          | On-disk settings path                         | Repo source for config                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Prettier (built-in)    | Owns format for JS/TS/JSON/CSS/HTML/MD/YAML/GraphQL/Vue when `prettier.allowed: true`         | `~/.config/zed/settings.json`                 | `software/scripts/advanced/zed-config.jsonc` → `prettier.allowed`, `languages.<X>.formatter: "prettier"` |
| LSP integration        | Spawns each server (rust-analyzer, gopls, pyright, etc.) and dispatches per-language requests | Same settings.json → `lsp.<name>.binary.path` | `software/scripts/advanced/lsp/zed.js` overlays `lsp` block built from `LSP_SERVERS`                     |
| Tree-sitter (built-in) | Syntax highlighting / scope resolution; powers `languages.<X>.*` matching                     | Settings via syntax detection                 | Auto-detected by file extension                                                                          |
| `material-icon-theme`  | File icon theme — purely cosmetic                                                             | Settings.json → `icon_theme`                  | `zed-config.jsonc` → `auto_install_extensions`                                                           |

Where to inspect at runtime:

- `Cmd+Shift+P` → `zed: open settings` — live settings.json.
- `Cmd+Shift+P` → `zed: open log` — Zed's process log including LSP startup.
- `Cmd+Shift+P` → `editor: open lsp logs` — per-server JSON-RPC trace.
- Status bar bottom-right — language mode (click to change for current buffer).

### Vim plugins (coc.nvim)

| Plugin                                 | Role                                                                                                                                                                                 | On-disk settings path                           | Repo source for config                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `neoclide/coc.nvim` (Vundle)           | LSP client + completion engine + extension host                                                                                                                                      | `~/.vim/coc-settings.json` + `~/.config/coc/`   | Plugin entry in `software/scripts/vim-config.js`; settings written by `software/scripts/advanced/lsp/vim-coc.sh` |
| coc extensions (`coc-tsserver` etc.)   | Per-language wrappers — auto-install via `:CocInstall coc-tsserver coc-pyright coc-html coc-css coc-json coc-eslint coc-volar coc-prisma coc-markdownlint` after first install       | `~/.config/coc/extensions/`                     | `vim-coc.sh` echoes the `:CocInstall` command for the user to run once                                           |
| LSP servers via `languageserver` block | rust-analyzer / gopls / jdtls / bash-language-server / yaml-language-server / docker-langserver / graphql-lsp / tailwindcss-language-server / taplo — pointed at the shared binaries | `~/.vim/coc-settings.json` `languageserver.<X>` | `vim-coc.sh` writes the JSON                                                                                     |

Where to inspect at runtime:

- `:CocList services` — what's attached to the current buffer.
- `:CocInfo` — health check (versions, paths, missing extensions).
- `:CocOpenLog` — full coc.nvim log.
- `:set filetype?` — Vim's detected filetype (essential for LSP attach).
- `:messages` — recent errors.

## Troubleshooting & Gotchas

Real issues we hit setting this up. Each entry: what went wrong, why, how we fixed it, how to debug.

### VS Code — "Configure Default Formatter" popup on first format

**Symptom.** Hit format chord on a `.json` (or `.md`, `.html`, etc.) → modal prompts "There are multiple formatters for 'JSON' files. One of them should be configured as default formatter." Picker offers e.g. `Prettier - Code formatter` vs `JSON Language Features`.

**Cause.** VS Code's per-file-type formatter resolver requires an **explicit** `[lang]` block when multiple extensions claim the type. The global `editor.defaultFormatter: "esbenp.prettier-vscode"` is **not enough** when another extension also advertises a formatter for the same language ID — VS Code refuses to pick on the user's behalf.

**Fix.** Pin every Prettier-supported file type explicitly:

```jsonc
"editor.defaultFormatter": "esbenp.prettier-vscode",
"[json]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
"[jsonc]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
"[markdown]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
// ... every prettier-supported type
"[python]": { "editor.defaultFormatter": "charliermarsh.ruff" },
"[rust]": { "editor.defaultFormatter": "rust-lang.rust-analyzer" },
```

`vs-code-config.jsonc` has the full list.

**Debug.**

- `View → Output` → pick `Prettier` from the dropdown — shows whether Prettier is even being asked to format.
- `Cmd+Shift+P` → `Format Document With...` — manual one-off picker that bypasses the resolver.
- Status bar bottom-right shows the language mode; click to confirm VS Code thinks it's the type you think it is.

### VS Code — chord fires but nothing changes

**Cause.** File is unsaved scratch buffer (`Untitled-1` etc.) → bottom-right shows `Plain Text` → no formatter resolves.

**Fix.** Save the file with a real extension OR click `Plain Text` in status bar → pick the language.

### Sublime Text — LSP-prettier doesn't reliably install/attach

**Symptom.** Wired `LSP-prettier` via Package Control on paper, but the LSP log shows no prettier server attaching. `lsp_format_document` chord on `.md` is silent.

**Cause.** `LSP-prettier` either isn't auto-installable from Package Control (varies by Sublime version / Package Control cache state) or doesn't attach to the buffer despite a permissive `selector`. We don't fully know why — `JsPrettier`, the standalone Sublime package that just calls the `prettier` CLI, works reliably.

**Fix.** Don't wire prettier as an LSP server in Sublime. Use `JsPrettier` for every Prettier-supported syntax; use `LSP` framework only for non-Prettier types (Python/Rust/Go/Java). Format chord is context-bound — `js_prettier` for Prettier syntaxes, `lsp_format_document` fallback for everything else.

**Debug.**

- `Cmd+Shift+P` → `Package Control: List Packages` — verify `JsPrettier`, `LSP`, and the `LSP-*` helpers you expect are present.
- `Cmd+Shift+P` → `LSP: Toggle Log Panel` — watch for `initialize` / `initialized` / `textDocument/didOpen` messages when you open a file.
- `Cmd+Shift+P` → `LSP: Show LSP Servers` — confirm which servers are attached to the current buffer.
- `Cmd+Shift+P` → `JsPrettier Format Code` — manual one-shot to confirm `JsPrettier` is wired and `prettier` is on `$PATH`.

### Sublime Text — markdown chord does nothing, only marksman attaches

**Symptom.** Chord on `.md` → LSP log shows only `marksman` is attached → nothing happens.

**Cause.** `marksman` provides markdown intelligence (link refs, TOC generation, header navigation) but its `initialize` capabilities response does **not** include `documentFormattingProvider`. So `lsp_format_document` finds zero candidates and silently returns. (Other markdown LSPs may differ — always check the `initialize` response.)

**Fix.** The context-bound chord routes `.md` through `js_prettier` instead of LSP. With `JsPrettier` installed and `prettier` on `$PATH`, `prettier --parser markdown` formats the buffer.

**Debug.**

- `Cmd+Shift+P` → `LSP: Toggle Log Panel` → search for the server's `initialize` response. Look for `documentFormattingProvider` in the `capabilities` object. If missing, that server cannot format — period.
- `prettier --parser markdown < /path/to/file.md` from a terminal — confirms the CLI itself can format your file before you blame the editor wiring.

### Sublime Text — package install requires full restart

**Symptom.** New `LSP-*` package added to repo wiring, ran `bash run.sh`, restarted Sublime via close-window, package still missing.

**Cause.** Package Control reads `Packages/User/Package Control.sublime-settings` `installed_packages` on **startup** to compute the diff vs what's on disk. Closing a window doesn't restart the Python host that drives Package Control.

**Fix.** Full quit (`Cmd+Q`) → reopen. Then `Cmd+Shift+P` → `Package Control: Satisfy Dependencies` if the diff still didn't run.

**Debug.**

- `View → Show Console` opens the Python REPL — Package Control logs install/uninstall events there.
- `Cmd+Shift+P` → `Package Control: List Packages` confirms what's actually installed.

### Sublime Text — chord fires the wrong formatter

**Symptom.** Chord on `.ts` formats with tsserver style (LSP-typescript), but save formats with Prettier style. Or vice versa.

**Cause.** Save vs chord were wired through different code paths. Save used `JsPrettier`'s `auto_format_on_save`; chord used `lsp_format_document`. Different engines → different output for the same file type.

**Fix.** Context-bound chord — `js_prettier` for Prettier syntaxes, `lsp_format_document` for everything else. Save and chord now share an engine per file type (mirrors VS Code / Zed behavior).

**Debug.** Open the same file in both editors, run a known-ugly snippet through each path, diff results. If they differ, the chord context selector probably doesn't match the syntax scope — see next gotcha.

### Sublime Text — context selector doesn't match a syntax package

**Symptom.** Chord works on stock `Markdown` syntax but not on a buffer using `MarkdownEditing` package.

**Cause.** `MarkdownEditing` reports its scope as `text.html.markdown.gfm`, not `text.html.markdown`. Selector match fails.

**Fix.** Add the variant to the chord's `selector` operand: `text.html.markdown.gfm` (and similar for other syntax-shadowing packages).

**Debug.** `Tools → Developer → Show Scope Name` (or `Ctrl+Alt+Shift+P`) — pops the current scope under the cursor. Confirm it's what you bound against.

### Zed — `UndefinedParserError` on Rust / Python / Go / Java

**Symptom.** Save a `.rs` / `.py` / `.go` / `.java` file in Zed → Zed log shows:

```
ERROR Formatting failed: prettier at "<project>" failed to format buffer:
UndefinedParserError: No parser could be inferred for file "<path>.rs"
```

**Cause.** Zed's default `formatter: "auto"` resolution. When `prettier.allowed: true` is set globally AND no per-language `formatter` is pinned, Zed tries prettier first — even for languages prettier doesn't support. The format request goes to prettier → "no parser" error → file isn't formatted.

**Fix.** Pin `formatter: "language_server"` **explicitly** for every non-Prettier language we care about. Don't rely on auto-fallback:

```jsonc
"languages": {
  "Rust":          { "formatter": "language_server" },
  "Python":        { "formatter": "language_server" },
  "Go":            { "formatter": "language_server" },
  "Java":          { "formatter": "language_server" },
  "TOML":          { "formatter": "language_server" },
  "Shell Script":  { "formatter": "language_server" },
  "C":             { "formatter": "language_server" },
  "C++":           { "formatter": "language_server" }
}
```

Symmetric pattern: every Prettier-handled language gets `formatter: "prettier"`; every native-LSP language gets `formatter: "language_server"`. No language relies on `auto` fall-through.

**Debug.**

- `Cmd+Shift+P` → `zed: open log` — search for `UndefinedParserError` or `Formatting failed: prettier at ...`. The log includes the file path and which prettier instance was invoked.
- Inspect the live settings: `python3 -c "import json; s=json.load(open('$HOME/.config/zed/settings.json')); print(s.get('languages', {}))"` — confirm the per-language `formatter` pins are deployed.

### Zed — LSP override not applied / Zed's bundled server runs instead of ours

**Symptom.** Zed log shows it's launching a built-in version of a language server (jdtls, rust-analyzer, etc.) — not our shared install. Errors look like "Server reset the connection" with no stderr that matches our wrapper's behavior. Manual `<binary> < /dev/null` from a terminal succeeds, but Zed still fails.

**Cause.** Zed has built-in language support for most major LSP servers and downloads/manages them itself. Our `lsp.<name>.binary.path` override in `software/scripts/advanced/lsp/zed.js` only takes effect once it's actually written to `~/.config/zed/settings.json`. If the deploy hasn't run, Zed continues to use its bundled copy.

**Fix.** Deploy the override:

```bash
bash run.sh --files=advanced/lsp/zed.js
```

Then full quit Zed (`Cmd+Q`) and reopen.

**Debug.**

```bash
# Confirm the lsp block exists with one entry per LSP_SERVERS entry (typescript, pyright, rust-analyzer, gopls, jdtls, bash, yaml, html, css, json, eslint, docker, markdown, vue, tailwind, graphql, prisma, sql, taplo)
python3 -c "import json; print(sorted(json.load(open('$HOME/.config/zed/settings.json')).get('lsp', {}).keys()))"

# Inspect a specific override
python3 -c "import json; print(json.dumps(json.load(open('$HOME/.config/zed/settings.json')).get('lsp', {}).get('jdtls'), indent=2))"
```

Empty list / `null` value → the deploy hasn't run on this machine. Same gotcha applies to ANY change in `lsp/zed.js` or `lsp-common.js` — the source JSONC + JS scripts are not live until you re-run the script.

### jdtls — "Server reset the connection" / OSGi bundle resolution fails

**Symptom.** Zed log shows `jdtls: Server reset the connection`. Manual `jdtls < /dev/null` prints `An error has occurred. See the log file <jdtls>/config_*/<ts>.log`. The log file contains:

```
java.lang.IllegalStateException: Unable to acquire application service.
Ensure that the org.eclipse.core.runtime bundle is resolved and started (see config.ini).
```

**Cause.** Our previous hand-rolled bash launcher mapped `uname -s` (`Darwin`) to `config_darwin`. Modern jdtls tarballs ship many per-arch config dirs (`config_mac`, `config_mac_arm`, `config_linux`, `config_linux_arm`, `config_win`, etc.) — `config_darwin` is a generic fallback that doesn't include the right plugins for Apple Silicon OSGi resolution. Also `-Xmx2G` is undersized for medium projects.

**Fix.** Delegate to the upstream-bundled `bin/jdtls.py` Python launcher. It handles arch-specific config dir selection, JVM args, and workspace `-data` automatically. Our launcher is now a one-liner:

```bash
#!/usr/bin/env bash
exec python3 "$HOME/.local/share/jdtls/bin/jdtls.py" "$@"
```

Source: `software/scripts/advanced/lsp/install.sh` (jdtls section). To re-deploy on an existing machine: `bash run.sh --files=advanced/lsp/install.sh --refresh=lsp/install.sh`.

**Debug.**

- Find the error log: `ls -t $HOME/.local/share/jdtls/config_*/.log | head -1` then `cat` the newest.
- Run upstream launcher manually: `python3 ~/.local/share/jdtls/bin/jdtls.py < /dev/null` — should hang waiting for stdin (LSP). If it errors immediately, the JVM or jdtls install itself is broken.
- `which jdtls` → confirm it's our wrapper, not some other binary.

### macOS — jdtls fails with "Unable to locate a Java Runtime"

**Symptom.** Open a `.java` file in Zed (or any editor wired to `jdtls`) → LSP log shows:

```
Language server jdtls: initializing server jdtls, id 3: Server reset the connection
-- stderr --
The operation couldn't be completed. Unable to locate a Java Runtime.
Please visit http://www.java.com for information on installing Java.
```

**Cause.** macOS ships a `/usr/bin/java` stub binary that delegates to `/usr/libexec/java_home` to find an installed JDK. Brew's `openjdk` formula installs the JDK at `/opt/homebrew/Cellar/openjdk/.../libexec/openjdk.jdk` but does **not** register it with `/Library/Java/JavaVirtualMachines/` — so `java_home` returns nothing, and the stub errors out. The jdtls launcher in `lsp/install.sh` does `exec java ...` which hits the stub first → fails before jdtls can start.

**Fix.** Symlink brew's openjdk into the macOS java_home registry:

```bash
sudo ln -sfn /opt/homebrew/opt/openjdk/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk.jdk
```

Wired into `software/scripts/mac/_full-setup.sh` right after the `brew install java` line — every fresh mac registers the JDK automatically.

**Debug.**

- `java -version` from a terminal → confirms whether the stub can find a JDK.
- `/usr/libexec/java_home` → prints the resolved JDK path (or errors if none registered).
- `ls -la /Library/Java/JavaVirtualMachines/` → confirms the symlink exists.
- `brew --prefix openjdk` → confirms the keg location for the symlink target.

### Multi-formatter conflicts (general)

When two formatters claim the same file type, the editor picks one and silently ignores the other. Always pick **one** owner per file type per editor:

- VS Code → `[lang]` block.
- Zed → `languages.<X>.formatter`.
- Sublime → JsPrettier auto-save selector AND chord context match must agree.

### Unsaved files don't format anywhere

LSP servers and JsPrettier both need to know the file's **language ID** to pick a parser. Unsaved buffers default to "Plain Text" in every editor we use → no formatter resolves.

**Fix.** Save with the right extension OR set the syntax manually:

- VS Code: click `Plain Text` in status bar.
- Sublime: `View → Syntax → ...`.
- Zed: click language mode in bottom status bar.

### Debug command cheat-sheet

| Editor       | Show servers attached            | Show server log            | Show file's language ID               | Manual format probe                       |
| ------------ | -------------------------------- | -------------------------- | ------------------------------------- | ----------------------------------------- |
| VS Code      | `Output` panel → server dropdown | Same `Output` panel        | Status bar bottom-right               | `Format Document With...` palette command |
| Zed          | `zed: open log` palette          | Same                       | Status bar bottom-right               | `editor: format` palette command          |
| Sublime Text | `LSP: Show LSP Servers` palette  | `LSP: Toggle Log Panel`    | `Tools → Developer → Show Scope Name` | `JsPrettier Format Code` palette command  |
| Vim (coc)    | `:CocList services`              | `:CocInfo` / `:CocOpenLog` | `:set filetype?`                      | `:call CocAction('format')`               |
| CLI          | n/a                              | n/a                        | n/a                                   | `prettier --parser <X> < file.<ext>`      |

The CLI probe is the most powerful first check: if `prettier --parser markdown < README.md` succeeds at the terminal, your editor wiring is the only thing that could be wrong. If it fails, fix `prettier`/`.prettierrc` first before touching the editor.

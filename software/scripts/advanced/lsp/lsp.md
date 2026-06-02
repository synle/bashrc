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

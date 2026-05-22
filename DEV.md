# bashrc

Personal dotfiles and shell-environment bootstrapper. The setup engine is Node.js scripts piped into bash (`cat index.js | node | bash`) orchestrated by `run.sh` and a GNU `Makefile`, covering macOS, Ubuntu/Debian, Arch, RHEL/Fedora, Windows/WSL/MinGW, ChromeOS, SteamOS, and Android Termux. A Vite + React webapp under `webapp/` renders the demo page at https://synle.github.io/bashrc/; tests run on Vitest.

## Quick Start

Install dependencies:

```bash
npm ci || npm install --no-fund --prefer-offline
```

Run the webapp dev server:

```bash
npm run dev
```

Run the bootstrapper locally (full profile setup):

```bash
make setup_local_full
```

Run unit tests:

```bash
npm test
```

Build the webapp:

```bash
npm run build
```

Build the self-extracting single-file installer:

```bash
make build_installer   # -> .build/install-bashrc.sh
```

Output is a single bash script (~1 MB) containing `run.sh` + `software/{index.js,common.js,bootstrap,scripts,metadata}` as a base64'd gzipped tarball after a sentinel marker. At runtime it extracts to a per-PID tmp dir (override with `BASHRC_INSTALLER_DIR`; preserve with `BASHRC_INSTALLER_KEEP=1`) and `exec`s `bash run.sh "$@"` — every `run.sh` flag (`--setup`, `--files=`, `--preset=`, `--dryrun`, ...) is forwarded. CI mirrors it to the `binary-cache` rolling release on `synle/bashrc` as `bashrc-installer__install-bashrc.sh`, so end-users can install with one HTTP request:

```bash
curl -fsSL https://github.com/synle/bashrc/releases/download/binary-cache/bashrc-installer__install-bashrc.sh | bash -s -- --setup
```

See `software/tools/build-installer.js`.

## Running a Subset

`run.sh` accepts narrow targets (`--files=`) and broad preset bundles (`--preset=`). Both support case-insensitive substring matching — one match auto-resolves, multiple matches print copy-paste suggestions.

```bash
bash run.sh --files=git.js                         # one script (exact)
bash run.sh --files=vim                            # fuzzy match (auto-resolves if unambiguous)
bash run.sh --preset=lightweight                   # named preset from software/metadata/presets.jsonc
bash run.sh --preset=terminal,prompt               # union of multiple presets
bash run.sh @llm                                   # bare @-marker → strict preset lookup
bash run.sh editors                                # bare arg → script-first, falls back to preset on miss
bash run.sh --refresh="fzf.js,fonts.js"            # force-refresh specific scripts
bash run.sh --dryrun --setup                       # preview a full setup, no writes
bash run.sh --remove --files=fzf.js                # undoWork for one script
```

End-user composites: `lightweight` and `heavyweight` (kitchen-sink — symmetric counterpart to `lightweight`). Building blocks: `editors`, `emulators`, `apps`, `browsers`, `terminal`, `prompt`, `llm`. See `software/metadata/presets.jsonc` for the authoritative list and per-preset descriptions; the file is JSONC, so `//`, `/* */`, and trailing commas are allowed (stripped by `stripJsoncComments` in `software/index.js` before `JSON.parse`). Each entry declares a `files[]` list and/or a `presets[]` list pointing at other presets (composed recursively); `heavyweight` is the canonical example, defined as `{ "presets": ["editors", "emulators", "apps", "browsers", "terminal", "prompt", "llm"] }`. Cycles (a preset referencing itself, directly or transitively) are rejected at parse time by `expandPresetFiles` in `software/index.js` and guarded by `software/tests/presets.spec.js`.

CLI resolution priority: `--files=<x>` is strict (script only); `--preset=<x>` (and `--preset=@<x>`, which strips the `@`) is strict preset with case-insensitive substring fuzzy fallback; bare `<x>` tries scripts first and falls back to a preset lookup (`_resolveBareArgPresetFallback` in `software/index.js`); bare `@<x>` skips the script search and goes straight to preset resolution. On script-vs-preset name collision the script wins (e.g. `bash run.sh llm` partial-matches `llm-common.js`; use `@llm` to force the `llm` preset).

## Testing

Suites are split across dedicated Vitest configs so each can run independently:

```bash
make test_unit             # Vitest sandbox tests for software/index.js + build-include
make test_coverage         # Unit tests + istanbul coverage report
make test_profile          # bash -n syntax checks for assembled profile scripts
make test_smoke            # Puppeteer smokes against the live deploy
make test_smoke_local      # Puppeteer smokes against ./dist (local build)
make test_buildconfig      # Inline-snapshot shape checks for generated configs
make test_dryrun           # Dry-runs every JS script; asserts no writes / clean stdout
make test_all              # Unit + profile + smoke + buildconfig + dryrun (skips coverage)
make validate              # format + test_unit + test_buildconfig + build_webapp + test_smoke_local + test_dryrun
```

Run a single spec or filter by test name:

```bash
npx vitest run --config vitest.config.js software/tests/parseRawArgs.spec.js
npx vitest run --config vitest.config.js -t "parses --files flag"
```

### Coverage

The unit suite uses the istanbul provider via `@vitest/coverage-istanbul`. **Thresholds, included / excluded globs, and the rationale for the current floor all live in `vitest.config.js` — that file is the source of truth.** Don't duplicate the numbers in other docs; if a threshold changes, edit `vitest.config.js` and let downstream readers chase the link. There is no Rust / `cargo-llvm-cov` in this repo; if a future Rust sibling project lands, document its coverage config path next to the vitest entry instead of hardcoding a percentage.

## Where to Go Next

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — Execution pipeline, directory map, CI phases, key files.
- **[CLAUDE.md](CLAUDE.md)** — Repo rules and conventions (shell, JS, profile-assembly, protected paths).
- **[README.md](README.md)** — User-facing install instructions and feature highlights.
- **[docs/editor-keybindings.md](docs/editor-keybindings.md)** — Canonical keybinding reference across editors / terminals / AI CLIs.

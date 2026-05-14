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

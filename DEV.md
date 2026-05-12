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

---
name: add-package
description: Add a new CLI tool or package to this dotfiles repo. Use when installing a new tool across platforms.
---

## Purpose

Add a new CLI tool or package to this dotfiles repo. The package is `$ARGUMENTS` — if that placeholder arrives unexpanded or empty, use the package named in the request instead.

## Steps

### 1. Determine install method

Follow AGENTS.md's installer priority: official `curl -fsSL` installer first, package-manager fallback, and the explicit LLM CLI exception. Read a current sibling before creating a script; install documented dependencies first. For platform packages, update the applicable `_full-setup.sh` files and Windows winget list:

- `software/scripts/mac/_full-setup.sh` -> `installBrewPackage <name>`
- `software/scripts/ubuntu/_full-setup.sh` -> `installAptPackage <name>`
- `software/scripts/redhat/_full-setup.sh` -> `installDnfPackage <name>`
- `software/scripts/arch_linux/_full-setup.sh` -> `installPacmanPackage <name>`
- `software/scripts/steamos/_full-setup.sh` -> `installPacmanPackage <name>`
- `software/scripts/chromeos/_full-setup.sh` -> `installAptPackage <name>` - `software/scripts/windows/_winget-install.sh` -> add the verified winget ID to `winget_packages` under the matching `# --- Category ---` section; do not duplicate that list elsewhere. - Place entries alphabetically within the relevant package group.
- **Resolve the real package name per ecosystem before writing the line** — names drift (`fd` vs `fd-find`, `ripgrep` vs `rg`):

  ```bash
  brew search --formula <name>                  # mac
  apt-cache search --names-only '^<name>'       # ubuntu / chromeos
  dnf search <name>                             # redhat
  pacman -Ss '^<name>$'                         # arch / steamos
  winget search <name>                          # windows (copy the exact ID column)
  ```

- **All platforms must stay in sync.** If a tool has a winget equivalent, it must be added to Windows too.

For Windows-only tools, use the winget list or a current Windows download helper verified in DEV.md and source.

### 2. Handle binary name mismatches

Use `ensure_binary_alias <canonical>` in `common-functions.bash`; extend its mapping and call it from the relevant Linux setup. Do not duplicate platform-name dispatch at each caller. Add an optional user alias only when requested or required by the tool's integration.

### 3. PATH entry (if the tool installs to a non-standard location)

If the tool installs its binary to a non-standard path (e.g. `~/.tool/bin`, `/opt/...`), add that path to the `path_candidates` array in `software/bootstrap/profile-core.sh` under the appropriate category section.

### 4. Profile registration (if the tool needs shell setup)

If the tool needs PATH exports, env vars, shell completions, or aliases beyond what `_full-setup.sh` provides:

1. Create a `.js` script in `software/scripts/` with a `doWork()` entry point.
2. Use `registerWithBashSyleProfile(configKey, content)` to register shell content.
3. Add a matching `# BEGIN/END - <configKey>` marker in `software/bootstrap/profile-core.sh` (in the pre-core section at the top, alphabetically).

### 5. Autocomplete (if applicable)

If the tool has subcommands worth completing:

1. Create a spec file in `software/metadata/autocomplete-complete-spec/<command>`
2. Add a `specFile` entry to `SPEC_COMMANDS` in `software/metadata/autocomplete.common.js`
3. Add a `# BEGIN/END - <command> Autocomplete` marker in `software/bootstrap/profile-advanced.sh`

For static flag lists that you want to reuse across multiple subcommands in the same spec file, declare a `>__name__|val,val,...` macro at the bottom of the spec file (separated by one blank line from the command lines) and reference `__name__` from any command line in that file. Macros are expanded at build time by `expandSpecMacros()`; the runtime shell never sees the `>` definitions. Use macros only for static lists — dynamic tokens (`__git_branches__`, `__npm_scripts__`, etc.) are runtime-expanded and must stay in `DYNAMIC_TOKENS`.

### 6. CI binary verification

Edit `software/metadata/ci-binaries.json`; `generate-ci-binary-list.js` generates the `action.yml` block via `make format_ci_binaries`.

Add the binary to the `required` array (build fails if missing) or the `warn` array (warning only). Plain string when `<name> --version` works; object form when the version probe differs:

```jsonc
// software/metadata/ci-binaries.json
"required": [
  "ripgrep",                                             // → check_binary_required ripgrep
  { "name": "kubectl", "version_cmd": "kubectl version --client" }
]
```

Then regenerate and verify the block:

```bash
make format_ci_binaries
git --no-pager diff .github/actions/ci-build/action.yml
npx vitest run --config vitest.config.js software/tests/generateCiBinaryList.spec.js
```

Placement rules:

- **`required`** only for non-GUI binaries present on _every_ platform. On mac they must install in the **foreground** (`installBrewPackage`), never `installBrewPackageInBackground` — mac's background queue is skipped in CI, and `requiredBinariesNotInBackground.spec.js` fails the build otherwise.
- **`warn`** for GitHub-release fallbacks, AUR-only packages, and anything mac installs in the background.
- Skip GUI apps and anything needing complex runtime setup entirely.

### 7. Preset membership (optional)

If the tool belongs to a named bundle (`editors`, `terminal`, `llm`, …), add its script filename to that preset's `files[]` in `software/metadata/presets.jsonc`, then confirm:

```bash
npx vitest run --config vitest.config.js software/tests/presets.spec.js
bash run.sh --preset=<preset> --dryrun
```

### 8. Register a new `.sh` script in the profile-syntax spec

If step 1 or 2 created a new `.sh` / `.bash` file, add it to the file list in `software/tests/profileSyntax.spec.js` — unregistered shell files are never `bash -n`'d.

### 9. Run it, then validate

Run the script you actually touched — twice, to prove idempotency (AGENTS.md §14):

```bash
bash run.sh --files="<name>.js"        # or "mac/<name>.sh", etc.
bash run.sh --files="<name>.js"        # second run must be a clean no-op
```

Package-manager-only changes (no new script) are exercised by the dry run instead:

```bash
bash run.sh --dryrun --setup
```

Then the full gate:

```bash
make validate        # includes formatting and regeneration; run once after final edits
```

If you created or modified files in `software/scripts/`, write or update unit tests in `software/tests/`.

## Safety

Never:

- add a binary to the `required` list in `ci-binaries.json` unless it is present on _every_ platform and installed in the foreground on macOS — a background-queued binary there fails CI. Use `warn` when unsure.
- hand-edit the generated `ci-binary-checks` block in `action.yml` — edit the JSON and run `make format_ci_binaries`
- `rm` an installed launcher to force a reinstall — the freshness gate already treats a missing binary as broken; use `--refresh` / `--force-refresh`
- introduce bash 4+ syntax in a new script — no `&>>`, no `mapfile`, no heredoc nested inside `$( ... )`
- register a duplicate `configKey` — pass a `subKey` when one platform needs several blocks
- edit a protected path per AGENTS.md section 3

Stop and ask if installer provenance, package identity, or supported-platform scope cannot be verified.

## Verification

Before declaring success, confirm and report:

- `bash run.sh --files="<the script>"` run twice, second run idempotent — or `bash run.sh --dryrun --setup` for a package-manager-only change
- `make format && make validate` run, with its result quoted, not paraphrased
- a fresh shell starts clean and the binary resolves via `type -P`
- which platforms actually got the package, and which were deliberately skipped and why

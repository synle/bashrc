---
name: add-package
description: Add a new CLI tool or package to this dotfiles repo. Use when installing a new tool across platforms.
---

Add a new CLI tool or package to this dotfiles repo. The package is `$ARGUMENTS` — if that placeholder arrives unexpanded or empty, use the package named in the request instead.

## Steps

### 1. Determine install method (priority order)

1. **OS package manager** (preferred) -- add `installXxxPackage <name>` to each platform's `_full-setup.sh` AND the Windows winget list:
   - `software/scripts/mac/_full-setup.sh` -> `installBrewPackage <name>`
   - `software/scripts/ubuntu/_full-setup.sh` -> `installAptPackage <name>`
   - `software/scripts/redhat/_full-setup.sh` -> `installDnfPackage <name>`
   - `software/scripts/arch_linux/_full-setup.sh` -> `installPacmanPackage <name>`
   - `software/scripts/steamos/_full-setup.sh` -> `installPacmanPackage <name>`
   - `software/scripts/chromeos/_full-setup.sh` -> `installAptPackage <name>`
   - `software/scripts/windows/_winget-install.sh` -> add the winget ID to the `winget_packages=( ... )` array under the matching `# ---- Category ----` comment. Look up the correct winget ID with `winget search <name>`. (Single canonical list — `_full-setup.ps1.bash` no longer carries a duplicate; it only handles WSL bootstrap and msstore-only items.)
   - Place the new line alphabetically within the existing package group under the appropriate `# ---- Category ----` sub-section header.
   - **Resolve the real package name per ecosystem before writing the line** — names drift (`fd` vs `fd-find`, `ripgrep` vs `rg`):

     ```bash
     brew search --formula <name>                  # mac
     apt-cache search --names-only '^<name>'       # ubuntu / chromeos
     dnf search <name>                             # redhat
     pacman -Ss '^<name>$'                         # arch / steamos
     winget search <name>                          # windows (copy the exact ID column)
     ```

   - **All platforms must stay in sync.** If a tool has a winget equivalent, it must be added to Windows too.

2. **curl/bash installer** (fallback) -- create a `.sh` script in `software/scripts/advanced/` following the pattern in `uv.sh` or `starship.sh`. Use `curl -fsSL <url> | bash`. Install any documented required dependencies first.

3. **Windows-only tools** -- if the tool only has a Windows binary (no Unix equivalent), create `software/scripts/windows/<name>-windows.js` using `downloadWindowsApp()` or add the winget ID to `winget_packages` in `software/scripts/windows/_winget-install.sh`.

### 2. Handle binary name mismatches

If the binary name differs across platforms (e.g. `bat` on mac/arch vs `batcat` on debian/ubuntu), create a **wrapper function** in `software/bootstrap/profile-core.sh` that normalizes the name. Follow the existing `batcat()` pattern:

```bash
################################################################################
# ---- <Tool> Setup ----
# <brief explanation of name differences>
################################################################################
function <wrapper_name>() {
  if type -P <name_variant_1> &> /dev/null; then
    command <name_variant_1> "$@"
  elif type -P <name_variant_2> &> /dev/null; then
    command <name_variant_2> "$@"
  else
    # fallback or error
    echo "<tool> is not installed" >&2
    return 1
  fi
}
```

Then optionally add an alias (e.g. `alias cat='batcat'`) in the aliases section of `profile-core.sh`.

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

**Edit `software/metadata/ci-binaries.json`, never `.github/actions/ci-build/action.yml`.** The `# BEGIN ci-binary-checks` block in `action.yml` is generated from that JSON by `software/tools/build-include.js` — hand-editing it gets overwritten on the next `make format`.

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
make format          # required if you touched BEGIN/END markers, ci-binaries.json, or JSDoc
make validate
```

If you created or modified files in `software/scripts/`, write or update unit tests in `software/tests/`.

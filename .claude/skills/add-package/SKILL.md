---
name: add-package
description: Add a new CLI tool or package to this dotfiles repo. Use when installing a new tool across platforms.
argument-hint: <package-name>
---

Add a new CLI tool or package to this dotfiles repo. The package is `$ARGUMENTS`.

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
   - Check if the package name differs per distro (e.g. `fd` vs `fd-find`, winget: `sharkdp.fd`) and use the correct name for each.
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

Add a `check_binary` call for the new tool in the "Binary verification" step of `.github/actions/ci-build/action.yml`. Place it in the appropriate category comment section, following the existing pattern:

```yaml
check_binary <binary-name> "<binary-name> --version"
```

Only add non-GUI command-line binaries. Skip GUI apps and tools that require complex runtime setup.

### 7. Validate

Run `make validate` after all changes. If you created or modified files in `software/scripts/`, write or update unit tests in `software/tests/`.

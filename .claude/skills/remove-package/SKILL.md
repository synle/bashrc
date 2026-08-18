---
name: remove-package
description: Remove a CLI tool or package from this dotfiles repo. Use when dropping a tool from the setup.
---

## Purpose

Remove a CLI tool or package from this dotfiles repo. The package to remove is `$ARGUMENTS` — if that placeholder arrives unexpanded or empty, use the package named in the request instead.

## Steps

### 1. Search for all references

Find every reference to the package, including the generated artifacts that will need regenerating:

```bash
rg -n --hidden -g '!node_modules' -g '!.git' -g '!.build' '<package-name>' .
```

Run it once more for a binary-name variant if the tool ships under a different name on some distro (`fd` / `fd-find`, `bat` / `batcat`).

### 2. Remove install entries from `_full-setup.sh` files

Remove `installXxxPackage <name>` lines from all platform `_full-setup.sh` files where it appears:

- `software/scripts/mac/_full-setup.sh`
- `software/scripts/ubuntu/_full-setup.sh`
- `software/scripts/redhat/_full-setup.sh`
- `software/scripts/arch_linux/_full-setup.sh`
- `software/scripts/steamos/_full-setup.sh`
- `software/scripts/chromeos/_full-setup.sh`
- `software/scripts/windows/_winget-install.sh` (winget packages in the `winget_packages=( ... )` array — single canonical list, called from WSL via winget.exe interop)

Check for distro-specific package name variants (e.g. `fd` vs `fd-find`, winget IDs like `sharkdp.fd`).

### 3. Remove script file (if exists)

Delete the script from `software/scripts/`:

- `.js` script (e.g. `software/scripts/<name>.js`)
- `.sh` script (e.g. `software/scripts/<name>.sh`)
- Windows variant (e.g. `software/scripts/windows/<name>-windows.js`)

### 4. Remove profile marker (if exists)

If the package registered a profile block via `registerWithBashSyleProfile()`, remove its `# BEGIN/END - <configKey>` marker from `software/bootstrap/profile-core.sh`.

### 5. Remove wrapper function (if exists)

If the package had a binary name mismatch wrapper in `software/bootstrap/profile-core.sh` (like the `batcat()` pattern), remove the wrapper function and any associated alias.

### 6. Remove autocomplete (if exists)

If the package had autocomplete:

1. Delete the spec file from `software/metadata/autocomplete-complete-spec/<command>`
2. Remove the `specFile` or `specCommand` entry from `SPEC_COMMANDS` in `software/metadata/autocomplete.common.js`
3. Remove the `# BEGIN/END - <command> Autocomplete` marker from `software/bootstrap/profile-advanced.sh`

### 7. Remove CI binary verification

**Edit `software/metadata/ci-binaries.json`, never `.github/actions/ci-build/action.yml`** — the `# BEGIN ci-binary-checks` block there is generated and would be regenerated right back.

Delete the tool's entry from the `required` and/or `warn` array, then regenerate and verify:

```bash
make format_ci_binaries
git --no-pager diff .github/actions/ci-build/action.yml
npx vitest run --config vitest.config.js software/tests/generateCiBinaryList.spec.js
```

### 8. Remove preset membership

Drop the script filename from any `files[]` in `software/metadata/presets.jsonc`. A preset whose `files[]` goes empty must be removed entirely — `presets.spec.js` fails on empty presets:

```bash
rg -n '<name>' software/metadata/presets.jsonc
npx vitest run --config vitest.config.js software/tests/presets.spec.js
```

### 9. Remove tests

Delete or update any tests in `software/tests/` that reference the removed script, including its entry in the `profileSyntax.spec.js` file list if it was a `.sh` / `.bash` file:

```bash
rg -n '<name>' software/tests/
```

### 10. Remove asset file (if exists)

Delete `assets/<name>.md` if one exists.

### 11. Uninstall locally, then validate

If the script had an `undoWork()`, run the removal path against your own machine before deleting the file (do this **before** step 3, or from a stash):

```bash
bash run.sh --remove --files="<name>.js"
```

Then the full gate:

```bash
make format
make validate
```

Confirm all tests pass — the script-list config and build artifacts regenerate automatically.

## Safety

Never:

- delete a file before the reference search in Step 1 has been read in full — a leftover profile block or autocomplete spec entry fails at shell startup, far from this change
- remove a binary from `ci-binaries.json` by hand-editing the generated `action.yml` block — edit the JSON and run `make format_ci_binaries`
- uninstall from the local machine before the repo change is complete, so a re-run cannot quietly reinstall it
- widen a delete past the package being removed — a shared helper, PATH entry, or preset that other tools also use stays
- edit a protected path per AGENTS.md section 3 (`.build/`, owner-managed `software/metadata/` files, `assets/`)

If a block, PATH entry, or preset is shared with another tool, stop and ask rather than removing it on this package's behalf.

## Verification

Before declaring success, confirm and report:

- the reference search from Step 1 re-run and now empty, or every remaining hit explained
- `make format && make validate` run, with its result quoted, not paraphrased
- a fresh shell starts clean — no missing-binary or missing-completion error from the removed tool
- what was deliberately left behind (generated files awaiting the next build, a shared helper) and why

## Notes

- `.build/` files are generated artifacts -- they will update on the next build. Do not edit them manually.
- `software/metadata/script-list.config` is auto-generated -- it will drop the removed script on the next `make format_script_indexes`.
- JSDoc examples in test setup files (e.g. `software/tests/setup.js`) may reference the removed script as an example path -- update to use another existing script name.

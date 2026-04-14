---
name: remove-package
description: Remove a CLI tool or package from this dotfiles repo. Use when dropping a tool from the setup.
argument-hint: <package-name>
---

Remove a CLI tool or package from this dotfiles repo. The package to remove is `$ARGUMENTS`.

## Steps

### 1. Search for all references

Search the entire repo for the package name to find every reference:

```
grep -r "<package-name>" --include="*.js" --include="*.sh" --include="*.md" --include="*.config"
```

### 2. Remove install entries from `_full-setup.sh` files

Remove `installXxxPackage <name>` lines from all platform `_full-setup.sh` files where it appears:

- `software/scripts/mac/_full-setup.sh`
- `software/scripts/ubuntu/_full-setup.sh`
- `software/scripts/redhat/_full-setup.sh`
- `software/scripts/arch_linux/_full-setup.sh`
- `software/scripts/steamos/_full-setup.sh`
- `software/scripts/chromeos/_full-setup.sh`
- `software/scripts/windows/_full-setup.ps1.bash` (winget packages in `$wingetPackagesEssential` or `$wingetPackagesBackground`)

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

Remove the `check_binary` call for the tool from the "Binary verification" step in `.github/actions/ci-build/action.yml`.

### 8. Remove tests

Delete or update any tests in `software/tests/` that reference the removed script.

### 9. Remove asset file (if exists)

Delete `assets/<name>.md` if one exists.

### 10. Validate

Run `make validate` after all changes. Confirm all tests pass -- the script-list config and build artifacts will be regenerated automatically.

## Notes

- `.build/` files are generated artifacts -- they will update on the next build. Do not edit them manually.
- `software/metadata/script-list.config` is auto-generated -- it will drop the removed script on the next `make format_script_indexes`.
- JSDoc examples in test setup files (e.g. `software/tests/setup.js`) may reference the removed script as an example path -- update to use another existing script name.

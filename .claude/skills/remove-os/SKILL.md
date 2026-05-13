---
name: remove-os
description: Remove an operating system from this dotfiles repo. Use when dropping support for a platform.
argument-hint: <os-name>
---

Remove an operating system from this dotfiles repo. The OS to remove is `$ARGUMENTS`.

## Steps

### 1. Search for all references

Search the entire repo for the OS name and its flag:

```
grep -r "is_os_<name>" --include="*.js" --include="*.sh" --include="*.yml" --include="*.config"
grep -r "<name>" software/scripts/ --include="*.js" --include="*.sh"
```

### 2. Remove OS detection flag from `software/bootstrap/common-env.sh`

Delete the `is_os_<name>=0 && ... && is_os_<name>=1` line from the OS detection section.

### 3. Delete the OS script folder

Remove the entire `software/scripts/<name>/` directory, which includes:

- `_init.js` — platform init
- `_only.js` — platform tweaks
- `_only.sh` — shell tweaks (if exists)
- `_full-setup.sh` — package dependencies (if exists)
- Any other OS-specific scripts in the folder

### 4. Remove platform tweaks marker from `software/bootstrap/profile-advanced.sh`

Delete the `# BEGIN/END - <Platform Name> OS-specific Tweaks` marker line.

### 5. Remove from `LIMITED_SUPPORT_OSES` (if applicable)

If the OS was listed in `LIMITED_SUPPORT_OSES` in `software/index.js`, remove it.

### 6. Remove CI build from `.github/workflows/build-main.yml`

Remove all references to the OS build job across all phases:

- **Phase 2:** Delete the `build-<name>` job
- **Phase 3 (publish):** Remove from `needs` list, remove artifact download/merge steps
- **Phase 5 (test):** Remove artifact download, remove snapshot copy commands
- **Summary job:** Remove from `needs` list, remove duration/status reporting

### 7. Remove guard clause references in other scripts

Search for `exitIfUnsupportedOs("is_os_<name>")` or `exitIfNotTargetOs(..."is_os_<name>"...)` in scripts across `software/scripts/` and remove or update those guards.

### 8. Remove from `install.sh` and `.devcontainer/` (if applicable)

If the OS had special handling in the codespace/devcontainer setup, remove those references.

### 9. Remove tests

Update or remove any test references in `software/tests/` that check for the OS flag or its scripts:

- `software/tests/filterRepoScripts.spec.js` — OS folder filtering
- `software/tests/runtimeAndConstants.spec.js` — OS constants
- Any integration tests for OS-specific scripts

### 10. Validate

Run `make validate` after all changes. Confirm all tests pass.

## Notes

- `.build/profile_bashrc_<name>.sh` files are generated artifacts (gitignored) -- they will stop being generated once the OS is removed. The corresponding `bashrc-profile__profile_bashrc_<name>.sh` asset on the `binary-cache` release on `synle/bashrc` will go stale; delete it manually via `gh release delete-asset binary-cache bashrc-profile__profile_bashrc_<name>.sh --repo synle/bashrc --yes` if you want a clean cache.
- `software/metadata/script-list.config` is auto-generated -- it will drop the OS scripts on the next `make format_script_indexes`.
- If other OSes depend on this one (e.g. `steamos` depends on `arch_linux` detection), update those detection rules accordingly.

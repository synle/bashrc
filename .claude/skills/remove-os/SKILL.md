---
name: remove-os
description: Remove an operating system from this dotfiles repo. Use when dropping support for a platform.
---

Remove an operating system from this dotfiles repo. The OS to remove is `$ARGUMENTS` — if that placeholder arrives unexpanded or empty, use the OS named in the request instead.

## Steps

### 1. Search for all references

Find every reference to the OS flag and its folder:

```bash
rg -n --hidden -g '!node_modules' -g '!.git' -g '!.build' 'is_os_<name>' .
rg -n '<name>' software/scripts/ software/tests/ .github/
```

### 2. Remove the OS detection flag from `run.sh`

**Detection lives in `run.sh`, not `common-env.sh`.** Delete the `is_os_<name>=0 && _detect_os ... && is_os_<name>=1` line from the `# --- OS Detection ---` section (around lines 310-330).

If the removed flag appeared in the `is_os_ubuntu` catch-all guard, drop it from that condition too:

```bash
grep -n 'is_os_<name>' run.sh    # must return nothing when you're done
```

### 3. Remove the flag from `ALL_OS_FLAGS`

Drop `is_os_<name>` from the `ALL_OS_FLAGS` CSV in `software/bootstrap/common-env.sh` (line ~11), then mirror it into `run.sh`'s BEGIN/END block:

```bash
make format_build_include
grep -n ALL_OS_FLAGS run.sh software/bootstrap/common-env.sh   # both lines must match
```

### 4. Delete the OS script folder

```bash
git rm -r software/scripts/<name>/
```

That folder holds:

- `_init.js` — platform init
- `_only.js` — platform tweaks
- `_only.sh` — shell tweaks (if exists)
- `_full-setup.sh` — package dependencies (if exists)
- Any other OS-specific scripts in the folder

### 5. Remove platform tweaks marker from `software/bootstrap/profile-advanced.sh`

Delete the `# BEGIN/END - <Platform Name> OS-specific Tweaks` marker line.

### 6. Remove from `LIMITED_SUPPORT_OSES` (if applicable)

`LIMITED_SUPPORT_OSES` is a CSV env var in **`software/bootstrap/common-env.sh`** (line ~10), not `software/index.js` — `index.js` only reads it from `process.env`, so editing `index.js` does nothing. Drop the flag from the CSV, then:

```bash
make format_build_include
grep -n LIMITED_SUPPORT_OSES run.sh software/bootstrap/common-env.sh   # both lines must match
```

### 7. Remove CI build from `.github/workflows/build-main.yml`

Remove all references to the OS build job across all phases:

- **Phase 2:** Delete the `build-<name>` job
- **Phase 3 (publish):** Remove from `needs` list, remove artifact download/merge steps
- **Phase 5 (test):** Remove artifact download, remove snapshot copy commands
- **Summary job:** Remove from `needs` list, remove duration/status reporting

### 8. Remove guard clause references in other scripts

```bash
rg -n 'exitIfUnsupportedOs|exitIfNotTargetOs|is_os_<name>' software/scripts/
```

Remove or update every guard that names the dropped flag.

### 9. Remove from `install.sh` and `.devcontainer/` (if applicable)

If the OS had special handling in the codespace/devcontainer setup, remove those references.

### 10. Remove tests

Update or remove any test references in `software/tests/` that check for the OS flag or its scripts:

- `software/tests/osDetection.spec.js` — drop `"is_os_<name>"` from the `ALL_FLAGS` array **and** delete its `it(...)` case
- `software/tests/filterRepoScripts.spec.js` — OS folder filtering
- `software/tests/runtimeAndConstants.spec.js` — OS constants
- `software/tests/setup.js` — the sandbox env mirrors `LIMITED_SUPPORT_OSES`; update if step 6 changed it
- Any integration tests for OS-specific scripts

```bash
rg -n 'is_os_<name>|<name>' software/tests/
npx vitest run --config vitest.config.js software/tests/osDetection.spec.js software/tests/runtimeAndConstants.spec.js
```

### 11. Validate

```bash
make format
make validate
```

Confirm all tests pass.

## Notes

- `.build/profile_bashrc_<name>.sh` files are generated artifacts (gitignored) -- they will stop being generated once the OS is removed. The corresponding `bashrc-profile__profile_bashrc_<name>.sh` asset on the `binary-cache` release on `synle/bashrc` will go stale; delete it manually via `gh release delete-asset binary-cache bashrc-profile__profile_bashrc_<name>.sh --repo synle/bashrc --yes` if you want a clean cache.
- `software/metadata/script-list.config` is auto-generated -- it will drop the OS scripts on the next `make format_script_indexes`.
- If other OSes depend on this one (e.g. `steamos` depends on `arch_linux` detection), update those detection rules accordingly.

---
name: add-os
description: Onboard a new operating system to this dotfiles repo. Use when adding support for a new Linux distro, macOS variant, or platform.
argument-hint: <os-name>
---

Onboard a new operating system to this dotfiles repo. The OS name is `$ARGUMENTS`.

## Steps

### 1. Add the OS detection flag in `run.sh`

**Detection lives in `run.sh`, not `common-env.sh`** — `common-env.sh` only carries the flag _list_. Add the flag to the `# --- OS Detection ---` section of `run.sh` (around lines 310-330), using the `_detect_os` helper. Never hand-roll a `command grep /etc/os-release` — `_detect_os` already does that, plus `$OSTYPE`, `/proc/version`, path, binary, and env probes.

```bash
is_os_<name>=0 && _detect_os --name "<distro-id>, <id_like>" --bin "<pkg-manager>" --path "/marker/path" && is_os_<name>=1
```

`_detect_os` signature — all flags take CSV, returns 0 on first hit, checked in this order:

| Flag     | Checks                                                                    |
| -------- | ------------------------------------------------------------------------- |
| `--name` | `ID`/`ID_LIKE` in `/etc/os-release`, then `$OSTYPE`, then `/proc/version` |
| `--path` | file or folder exists                                                     |
| `--bin`  | `type -P <bin>` succeeds                                                  |
| `--env`  | env var is non-empty                                                      |

**Ordering is load-bearing (see AGENTS.md §8):**

- New Linux distro flags go **above** the `is_os_ubuntu` block. `is_os_ubuntu` is the Debian-family catch-all and must stay last, inside the `if ! ((is_os_mac || is_os_chromeos || ...))` guard — add your new flag to that guard's condition too, or containerized runners will leak `is_os_ubuntu=1` onto your distro and run two `_full-setup.sh` files on one machine.
- `is_os_windows` / `is_os_wsl` stay **below** — they're independent overlays.
- The flag name determines the script folder name (`is_os_foo` → `software/scripts/foo/`).

### 2. Register the flag in `software/bootstrap/common-env.sh`

Append `is_os_<name>` to the `ALL_OS_FLAGS` CSV (line ~11). That constant is inlined into `run.sh` by a BEGIN/END block, so regenerate afterwards and confirm both copies agree:

```bash
make format_build_include
git --no-pager diff run.sh software/bootstrap/common-env.sh
grep -n ALL_OS_FLAGS run.sh software/bootstrap/common-env.sh   # both lines must match
```

### 3. Add an OS-detection test case

`software/tests/osDetection.spec.js` replays `run.sh`'s detection block against a fake `/etc/os-release` + `/proc/version` and asserts no other distro flag leaks. AGENTS.md requires a case whenever OS flags change:

1. Add `"is_os_<name>"` to the `ALL_FLAGS` array at the top.
2. Add an `it(...)` modeled on the existing `"Arch container on Ubuntu host kernel (regression)"` case, asserting your flag is `1` and every other distro flag — especially `is_os_ubuntu` — is `0`.

```bash
npx vitest run --config vitest.config.js software/tests/osDetection.spec.js
```

### 4. Create the OS script folder

Scaffold with the Makefile target rather than hand-writing boilerplate:

```bash
make new-script name=_init os=<name> type=js
make new-script name=_only os=<name> type=js
```

Then fill in `software/scripts/<name>/`:

#### `_init.js` (required)

Platform initialization -- create directories, touch files, detect environment. Runs before other scripts.

```javascript
/** Platform init for <Platform Name> - <what it does>. */
async function doWork() {
  const localBinPath = path.join(BASE_HOMEDIR_LINUX, ".local", "bin");
  log(">> Creating ~/.local/bin", localBinPath);
  await mkdir(localBinPath);

  const hushloginPath = path.join(BASE_HOMEDIR_LINUX, ".hushlogin");
  log(">> Creating ~/.hushlogin", hushloginPath);
  await touchFile(hushloginPath);
}
```

#### `_only.js` (required)

Register OS-specific shell aliases, functions, and tweaks via `registerPlatformTweaks()`.

```javascript
/** Platform tweaks for <Platform Name> - registers shell config. */
async function doWork() {
  registerPlatformTweaks(
    "<Platform Name>",
    code`
      # update: OS package manager update/upgrade only
      alias update='<package-manager-update-command>'
    `,
  );
}
```

**Rules:**

- The first argument to `registerPlatformTweaks` must match the marker name in `profile-advanced.sh` (e.g. `"Ubuntu"` matches `# BEGIN/END - Ubuntu OS-specific Tweaks`)
- Content must include at least one real command — comment-only content is invalid inside `{ }` code-folding blocks. Use `: # no-op` if needed.

#### `_full-setup.sh` (required if OS has a package manager)

Installs system packages. Only runs with `--setup` flag. Structure:

```bash
# software/scripts/<name>/_full-setup.sh
# <Platform Name> dependencies

echo ">> Begin setting up dependencies/<name>/deps.sh"
sudo -v

# ---- Speed Optimizations ----
# Cache installed packages upfront to avoid per-package lookups
_PKG_INSTALLED=$(<command to list installed packages>)

# ---- Package Manager Functions ----
function install<Manager>Package() {
  echo -n ">> $@ >> Installing with <Manager> >> "
  if echo "$_PKG_INSTALLED" | grep -qxF "$1"; then
    echo "Skipped"
  elif sudo <install-command> $@ &> /dev/null; then
    echo "Success"
  else
    echo "Error"
  fi
}

# ---- Update / Upgrade ----
function updatePackageIndex() {
  <package-index-refresh-command>
}

function upgradeAndCleanPackages() {
  <upgrade-and-cleanup-commands>
}

if is_bash_syle_stale; then
  echo '>> Updating package index'
  updatePackageIndex
  echo '>> Upgrading packages'
  upgradeAndCleanPackages
fi

# ---- Core: Build Tools ----
install<Manager>Package git
install<Manager>Package curl
install<Manager>Package make

# ---- Core: Shell Utilities ----
install<Manager>Package bat
install<Manager>Package fd-find
install<Manager>Package tree
install<Manager>Package tldr
install<Manager>Package jq
install<Manager>Package ripgrep
install<Manager>Package fzf
install<Manager>Package tmux
install<Manager>Package vim

# ---- Core: Network Tools ----
install<Manager>Package wget
install<Manager>Package openssh-client
```

**Conventions:**

- Use `function` keyword: `function installXxxPackage() {`
- 3-state messaging: "Skipped" / "Success" / "Error"
- Cache installed packages in a variable at the top (e.g. `_APT_INSTALLED`, `_PACMAN_INSTALLED`, `_RPM_INSTALLED`)
- Group packages under `# ---- Category ----` sub-section headers
- Check if package names differ on this distro (e.g. `fd` vs `fd-find`, `ripgrep` vs `rg`)
- Optionally add background install queue for non-essential packages (see ubuntu `_full-setup.sh` for pattern)

#### `_only.sh` (optional)

Raw bash commands for OS-level system settings (e.g. macOS `defaults write`). Only needed if the OS has system-level tweaks that aren't shell aliases.

### 5. Add platform tweaks marker in `software/bootstrap/profile-advanced.sh`

Add a `# BEGIN/END` marker in the OS-specific tweaks section (alphabetically among existing OS markers):

```bash
# BEGIN/END - <Platform Name> OS-specific Tweaks
```

### 6. Add CI build (optional but recommended)

Add a new parallel build job in `.github/workflows/build-main.yml` Phase 2. Follow the existing pattern:

```yaml
build-<name>:
  needs: [prep]
  if: ${{ !(github.event_name == 'workflow_dispatch' && inputs.test_only) }}
  runs-on: ubuntu-latest
  container: <docker-image>:latest
  continue-on-error: true
  outputs:
    duration: ${{ steps.ci-build.outputs.duration }}
  steps:
    - name: Install dependencies
      run: <install git, curl, make, node via package manager>
    - uses: actions/checkout@v4
    - uses: ./.github/actions/ci-setup
    - uses: ./.github/actions/ci-apply-patches
      with:
        patches: prep-patch
    - uses: ./.github/actions/ci-build
      id: ci-build
      with:
        artifact-name: build-<name>
```

Also wire the new build into Phase 3 (publish -- merge artifacts), Phase 5 (test -- download artifacts + copy snapshots), and the summary job.

### 7. Update `LIMITED_SUPPORT_OSES` if applicable

`LIMITED_SUPPORT_OSES` is a CSV env var in **`software/bootstrap/common-env.sh`** (line ~10), not in `software/index.js` — `index.js` only reads it back out of `process.env`, so editing `index.js` is a no-op.

If the new OS has limited support for advanced features (like Android Termux or MinGW64 — no `advanced/` scripts run there), append its flag to that CSV, then mirror it into `run.sh`:

```bash
make format_build_include
grep -n LIMITED_SUPPORT_OSES run.sh software/bootstrap/common-env.sh   # both lines must match
```

### 8. Run it, then validate

Prove the new folder actually executes before running the full gate:

```bash
bash run.sh --dryrun --setup              # confirms the new folder is discovered and guarded
bash run.sh --files="<name>/_init.js"     # run on real hardware for the platform
bash run.sh --files="<name>/_init.js"     # second run must be a clean no-op (idempotency)
```

Then:

```bash
make format
make validate
```

## Reference: Existing package manager patterns

| OS             | Package manager | Cache command                                           | Install function       |
| -------------- | --------------- | ------------------------------------------------------- | ---------------------- |
| Ubuntu/Debian  | apt             | `dpkg --get-selections \| grep -w 'install' \| cut -f1` | `installAptPackage`    |
| Arch/SteamOS   | pacman          | `pacman -Qq`                                            | `installPacmanPackage` |
| RedHat/Fedora  | dnf             | `rpm -qa --queryformat '%{NAME}\n'`                     | `installDnfPackage`    |
| macOS          | brew            | `brew list --formula -1`                                | `installBrewPackage`   |
| Android Termux | pkg             | `dpkg --get-selections \| grep -w 'install' \| cut -f1` | `installPkgPackage`    |
| ChromeOS       | apt             | `dpkg --get-selections \| grep -w 'install' \| cut -f1` | `installAptPackage`    |

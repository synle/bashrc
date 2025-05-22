---
name: add-os
description: Onboard a new operating system to this dotfiles repo. Use when adding support for a new Linux distro, macOS variant, or platform.
argument-hint: <os-name>
---

Onboard a new operating system to this dotfiles repo. The OS name is `$ARGUMENTS`.

## Steps

### 1. Add OS detection flag in `software/bootstrap/common-env.sh`

Add a new `is_os_<name>` flag following the existing one-liner pattern. Place it alphabetically among the other OS flags (around lines 35-54).

```bash
is_os_<name>=0 && <detection logic> && is_os_<name>=1
```

**Detection conventions:**

- Use `command grep` (not plain `grep`) to bypass aliases
- Check `/etc/os-release` for Linux distros: `command grep -Eiq "ID(_LIKE)?=(<distro>)" /etc/os-release 2> /dev/null`
- Use `||` to combine multiple detection methods for reliability
- The flag name determines the script folder name (`is_os_foo` -> `software/scripts/foo/`)

### 2. Create the OS script folder

Create `software/scripts/<name>/` with these files:

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

### 3. Add platform tweaks marker in `software/bootstrap/profile-advanced.sh`

Add a `# BEGIN/END` marker in the OS-specific tweaks section (alphabetically among existing OS markers):

```bash
# BEGIN/END - <Platform Name> OS-specific Tweaks
```

### 4. Add CI build (optional but recommended)

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

### 5. Update `LIMITED_SUPPORT_OSES` if applicable

In `software/index.js`, if the new OS has limited support for advanced features (like Android Termux or MinGW64), add its flag to `LIMITED_SUPPORT_OSES`.

### 6. Validate

Run `make validate` after all changes.

## Reference: Existing package manager patterns

| OS             | Package manager | Cache command                                           | Install function       |
| -------------- | --------------- | ------------------------------------------------------- | ---------------------- |
| Ubuntu/Debian  | apt             | `dpkg --get-selections \| grep -w 'install' \| cut -f1` | `installAptPackage`    |
| Arch/SteamOS   | pacman          | `pacman -Qq`                                            | `installPacmanPackage` |
| RedHat/Fedora  | dnf             | `rpm -qa --queryformat '%{NAME}\n'`                     | `installDnfPackage`    |
| macOS          | brew            | `brew list --formula -1`                                | `installBrewPackage`   |
| Android Termux | pkg             | `dpkg --get-selections \| grep -w 'install' \| cut -f1` | `installPkgPackage`    |
| ChromeOS       | apt             | `dpkg --get-selections \| grep -w 'install' \| cut -f1` | `installAptPackage`    |

# GitHub Actions Runner + Local Executor + Google Drive Vault

Three cooperating shell tools for turning this machine into a CI worker and a
file courier. All three are defined in
`software/scripts/github-runner.profile.bash` and sourced into `~/.bash_syle`
(advanced profile), so they are available as shell functions after a normal
`bash run.sh`.

| Function            | What it does                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `gh_runner_setup`   | Register this box as a self-hosted GitHub Actions runner (repo- or org-level), optionally as a svc. |
| `gh_run_script`     | Local executor — fetch a repo / gist / raw URL / local file and run a command here (no Actions).    |
| `gdrive_vault_push` | Copy a file into a Google Drive vault via `rclone` and print a shareable download link.             |

Every function has inline help — run it with no args or `--help`.

---

## Prerequisites

| Tool     | Needed by                          | Install / configure                                              |
| -------- | ---------------------------------- | --------------------------------------------------------------- |
| `gh`     | `gh_runner_setup`, gist fetches    | Already installed by this repo; then `gh auth login`.           |
| `git`    | `gh_run_script` repo clones        | Already installed by this repo.                                 |
| `curl`   | runner download, raw-URL fetches   | Present on macOS/Linux by default.                              |
| `rclone` | `gdrive_vault_push`                 | Install, then `rclone config` (remote type: `drive`).          |

The runner registration needs **admin** on the target repo or org (that is what
lets GitHub mint a registration token).

---

## 1–2. Register this machine as a self-hosted runner

`gh_runner_setup` mints a registration token with `gh`, downloads the matching
runner package for this OS/arch, runs the official `config.sh`, and offers to
install it as a background service.

### Repo-level runner

Attaches to a single repository. Least privilege — use this unless you truly
want the runner shared.

```bash
gh_runner_setup acme/widget-store
```

### Org-level runner

Shared across every repo in the org. Needs org-admin.

```bash
gh_runner_setup --org acme
```

### Overrides

```bash
RUNNER_NAME=mac-studio  RUNNER_LABELS=gpu,macos  gh_runner_setup acme/widget-store
```

| Env            | Default            | Meaning                                  |
| -------------- | ------------------ | ---------------------------------------- |
| `RUNNER_NAME`  | this hostname      | Name shown in GitHub's runner list.      |
| `RUNNER_LABELS`| _(none)_           | Extra labels appended to `self-hosted`.  |
| `RUNNER_DIR`   | `$HOME/actions-runner` | Where the runner is installed.       |

### Run it

If you accept the service prompt, the runner starts now and on every boot:

- **macOS** — `./svc.sh install && ./svc.sh start` (launchd, per-user).
- **Linux** — `sudo ./svc.sh install && sudo ./svc.sh start` (systemd).

To run in the foreground instead (declined the prompt):

```bash
cd "$HOME/actions-runner" && ./run.sh
```

### Use it in a workflow

Target the runner from any workflow in the repo/org you registered against:

```yaml
jobs:
  build:
    runs-on: [self-hosted, macos]   # match the labels you set
```

### Remove it

```bash
cd "$HOME/actions-runner"
./svc.sh stop && ./svc.sh uninstall    # sudo on Linux
./config.sh remove --token "$(gh api --method POST repos/acme/widget-store/actions/runners/remove-token --jq .token)"
```

---

## 3. Local executor — `gh_run_script`

Runs a script **here on this box**, outside GitHub Actions. It fetches the
source into a throwaway temp workspace, runs your command, and cleans up.

```bash
# A script inside a repo (shallow clone):
gh_run_script acme/widget-store ./ci/smoke.sh

# A full GitHub URL works too:
gh_run_script https://github.com/acme/widget-store ./ci/smoke.sh

# A gist (needs gh):
gh_run_script https://gist.github.com/me/abc123

# A single raw file:
gh_run_script https://raw.githubusercontent.com/me/repo/HEAD/tools/x.sh

# A file already on disk:
gh_run_script ~/scratch/build.sh
```

Source detection:

| Source shape                         | Fetch                        | Default run (no command given)      |
| ------------------------------------ | ---------------------------- | ----------------------------------- |
| `owner/repo` or a `github.com` URL   | `git clone --depth 1`        | `./run.sh` if present, else error   |
| `gist.github.com/...`                | `gh gist clone`              | `./run.sh` if present, else error   |
| a raw URL / `*.sh`/`*.py`/`*.js` URL | `curl` the single file       | `bash <file>`                       |
| an existing local file              | none                         | `bash <file>`                       |

Pass a trailing command to run something specific; it executes with the
workspace as the working directory.

---

## 4. Google Drive vault — `gdrive_vault_push`

Copies a file to a Google Drive folder via `rclone` and prints a **bare
shareable URL** on stdout (bare so it stays greppable and pipe-safe).

### One-time rclone setup

```bash
rclone config          # n) new remote; name it e.g. "gdrive"; storage: drive; follow OAuth
rclone listremotes     # confirm "gdrive:" is listed
```

### Push a file

```bash
gdrive_vault_push ~/report.pdf
# https://drive.google.com/open?id=...

gdrive_vault_push ./build.tar.gz releases   # into the "releases" subfolder
```

| Env                   | Default  | Meaning                             |
| --------------------- | -------- | ----------------------------------- |
| `GDRIVE_VAULT_REMOTE` | `gdrive` | rclone remote name.                 |
| `GDRIVE_VAULT_FOLDER` | `vault`  | Base folder inside the remote.      |

### Chain them

Run a build somewhere, then vault the artifact and get a link back:

```bash
gh_run_script acme/widget-store ./ci/build.sh
gdrive_vault_push ./dist/widget.tar.gz releases
```

---

## Security notes

- Registration tokens are short-lived and minted per call — they are never
  written to disk or echoed by `gh_runner_setup`.
- A self-hosted runner executes whatever a workflow tells it to. **Only register
  against repos/orgs you trust**, and prefer repo-level over org-level.
- `gh_run_script` runs fetched code on your machine with your permissions. Treat
  an untrusted source the same as `curl | bash` — read it first.
- `gdrive_vault_push` creates a **shareable** link; anyone with the URL can
  download. Do not vault secrets and hand the link out.

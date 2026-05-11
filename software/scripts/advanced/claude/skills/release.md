[Sy] Trigger a release. Defaults to OFFICIAL from the default branch; routes to BETA only on explicit signal (invocation name, `beta` keyword, validated SHA, or non-default branch).

## Aliases

All of these slash-command names route to this same skill body:

- `/sy-release` — official by default
- `/sy-release-stable` — official
- `/sy-release-official` — official
- `/sy-release-main` — official
- `/sy-release-master` — official
- `/sy-release-beta` — beta (invocation name forces beta intent)

Free-form phrasing such as "release", "release from main", "ship a release", "cut a release", "release official", "release stable", "release prod" — all map to the OFFICIAL path. Only an explicit "beta" keyword, a validated SHA, or a non-default branch name routes to BETA.

## Inputs

- `invocation_name` — the slash command the user typed (e.g. `/sy-release`, `/sy-release-beta`).
- `$ARGUMENTS` — optional free-form text after the command (may contain a SHA, a branch name, or keywords).

## Decision tree

Follow these steps in order. Do not skip validation.

### Step 1 — Pre-flight (always)

1. Determine repo: if `$ARGUMENTS` starts with an `owner/repo`-shaped token, use it; otherwise resolve from `git remote get-url origin`.
2. Identify the default branch: `gh repo view <owner/repo> --json defaultBranchRef --jq '.defaultBranchRef.name'`.
3. Refresh remote refs so branch lookups see fresh state: `git fetch origin --prune --quiet`.

### Step 2 — Classify intent

Initialize:

```
intent       = "official"
ref_sha      = null
source_label = null         # human-readable, used in confirmation prompt
```

If `invocation_name == "/sy-release-beta"`: set `intent = "beta"`.

For each whitespace-separated token in `$ARGUMENTS` (in left-to-right order):

**(a) Keyword tokens — no ref meaning, may flip intent:**

- If token (case-insensitive) is `"beta"` → set `intent = "beta"`.
- If token (case-insensitive) is one of `{"official", "stable", "main", "master", "release", "prod", "ship"}` → keyword only; no ref change. (These reinforce official intent but do not override an earlier-set beta intent — only an explicit `beta` keyword, a SHA, or a non-default branch can change intent to beta.)
- If token is the owner/repo identifier already consumed in Step 1 → skip.

**(b) SHA-shaped token** — matches the regex `^[0-9a-f]{7,40}$` (case-insensitive):

1. Validate: `git cat-file -e <token>^{commit}` (exits 0 if it resolves to a commit in this repo).
2. If valid:
   - `ref_sha = $(git rev-parse <token>)` (expand to full 40-char SHA).
   - `source_label = "SHA <token>"`.
   - `intent = "beta"`.
3. If invalid: **ABORT** with `"Looks like a SHA but does not resolve in this repo: <token>. Run `git fetch` and retry, or pass a valid SHA / branch name."`

**(c) Branch-shaped token** — anything else matching `^[A-Za-z0-9._/-]+$`:

Try in order:

1. `git rev-parse --verify refs/heads/<token>` — local branch.
2. `git rev-parse --verify refs/remotes/origin/<token>` — remote-tracking.
3. `git ls-remote --exit-code origin <token>` — remote-only fallback.

If any succeed:

- Let `resolved_branch = <token>` and `ref_sha = <SHA from the first successful lookup>`.
- If `resolved_branch == default_branch`:
  - **Do not** route to beta. `/sy-release main` and `/sy-release master` are official, no SHA pinning. (`intent` stays as previously set — `"official"` unless `/sy-release-beta` or `beta` keyword forced beta earlier.)
- Else:
  - `intent = "beta"`.
- `source_label = "branch <resolved_branch> @ <short_sha>"`.

If all three lookups fail: **ABORT** with `"Not a valid SHA or branch in this repo: <token>. Pass a SHA, an existing branch name, or 'beta'."`

**(d) Anything else** — no match for keyword, SHA, or branch shape: **ABORT** with `"Unrecognized argument: <token>. Pass a SHA, branch name, or 'beta'."`

### Step 3 — Route, confirm, trigger

#### If `intent == "beta"`:

1. If `ref_sha == null` (e.g. `/sy-release-beta` with no args): **prompt the user** — "Which SHA or branch should the beta build from?" — and re-run Step 2 with their response. Never auto-pin to `HEAD` of the default branch.
2. List workflows: `gh workflow list --repo <owner/repo>`.
3. **Select** the beta workflow — name contains `release-beta`, `release beta`, `beta`, `prerelease`, `pre-release`, `canary`, or `nightly`.
4. **Reject** any workflow whose name is the official/stable one (`release-official`, `release official`, `official-release`, `publish`, or bare `release` with no modifier). If the only matches are official, stop and report `"no beta release workflow found — aborting"`.
5. If multiple beta candidates remain, ask the user which to trigger.
6. Confirm: `"About to trigger BETA release '<workflow name>' at <source_label> in <owner/repo>. This is NOT an official release. Proceed? (yes/no)"`. If no: stop.
7. Trigger: `gh workflow run <workflow-id> --repo <owner/repo> --ref <ref_sha>`.

#### Else (`intent == "official"`):

1. List workflows: `gh workflow list --repo <owner/repo>`.
2. **Select** the official workflow — name contains `release-official`, `release official`, `official-release`, `publish`, or a bare `release` with no modifier.
3. **Reject** any workflow whose name contains `beta`, `prerelease`, `pre-release`, `canary`, `nightly`, `rc`, `alpha`, `dev`, `snapshot`, `draft`, or `unofficial`. If the only matches are these, stop and report `"no official release workflow found — aborting"`.
4. If multiple official candidates remain, ask the user which to trigger. Never guess.
5. **Tag-safety pre-flight (mandatory).** Branch dispatches (`--ref <default_branch>`) make `github.ref_name` resolve to the branch name (e.g. `main`), and any workflow expression like `inputs.tag || github.ref_name` will silently produce a `vmain` release that overwrites real versions. To prevent that:
   1. Fetch the workflow file: `gh api repos/<owner/repo>/actions/workflows/<workflow-id> --jq .path` → `gh api repos/<owner/repo>/contents/<path> --jq .content | base64 -d`.
   2. Determine whether the workflow accepts a `tag` (or equivalently named) `workflow_dispatch` input.
   3. **Sentinel grep** — if the file contains the literal substring `github.ref_name` anywhere in a `version:`, `tag:`, `release:`, or `name:` assignment, treat the workflow as unsafe to dispatch without an explicit tag.
   4. Derive the intended version from the repo, in this order of preference: `src-tauri/tauri.conf.json` (`.version`), `package.json` (`.version`), `Cargo.toml` (`[package] version =`), `pyproject.toml` (`[project] version =`). Prepend `v` if absent. Confirm it matches strict semver `^v\d+\.\d+\.\d+(-[\w.]+)?$`. If multiple files disagree, ask the user which is authoritative.
   5. Decision:
      - Workflow accepts a `tag` input → **always** pass `--field tag=v<version>` on dispatch, regardless of whether the sentinel matched.
      - Sentinel matched **and** workflow has no `tag` input → **ABORT** with: `"Workflow falls back to github.ref_name with no tag input — a branch dispatch will create a bogus tag (e.g. vmain). Either (a) push a v* tag and let tag-trigger handle it, (b) add a 'tag' input to the workflow, or (c) re-run after the workflow is fixed."`
      - Neither sentinel nor `tag` input → safe to dispatch with `--ref <default_branch>` and no `--field`.
   6. If the version cannot be read (no version files, or all malformed) and a `tag` input exists, **ABORT** with: `"Cannot derive version for --field tag=...; pass it explicitly as /sy-release-official tag=vX.Y.Z or fix the version source files."`
6. Confirm: `"About to trigger OFFICIAL release '<workflow name>' on '<default_branch>' in <owner/repo><, tag=v<version>>. This is NOT a beta. Proceed? (yes/no)"`. Include the `tag=` clause only if a tag was derived. If no: stop.
7. Trigger:
   - With derived tag: `gh workflow run <workflow-id> --repo <owner/repo> --ref <default_branch> --field tag=v<version>`.
   - Otherwise: `gh workflow run <workflow-id> --repo <owner/repo> --ref <default_branch>`.

### Step 4 — Report + post-dispatch tag verification

1. Wait a few seconds, then locate the new run: `gh run list --repo <owner/repo> --workflow=<workflow-id> --limit 1 --json databaseId,status,url`.
2. Print the run URL and status to the user.
3. **Tag-sanity poll (official path only).** Poll the run every 15s up to 5 minutes:
   - `gh run view <databaseId> --repo <owner/repo> --json jobs --jq '.jobs[].name'` to find the prepare/begin job.
   - When a release-creating job has produced output, fetch the resolved tag via `gh release list --repo <owner/repo> --limit 5` or the workflow logs.
   - Validate against strict semver `^v\d+\.\d+\.\d+(-[\w.]+)?$`. If the resolved tag is `vmain`, `vmaster`, the bare branch name, or anything failing the regex, **immediately** warn the user with:
     `"BAD TAG DETECTED: <tag>. The release will overwrite real versions. Run: gh release delete <tag> --repo <owner/repo> --yes --cleanup-tag, then cancel the run: gh run cancel <databaseId> --repo <owner/repo>."`
   - Stop polling once a valid tag is observed or the run completes.

## Examples

| Invocation                              | Routes to                      | Why                             |
| --------------------------------------- | ------------------------------ | ------------------------------- |
| `/sy-release`                           | official, default branch       | no args, no beta signal         |
| `/sy-release-stable`                    | official, default branch       | alias                           |
| `/sy-release main`                      | official, default branch       | `main` = default branch         |
| `/sy-release master`                    | official, default branch       | `master` = default branch       |
| `/sy-release prod` / `/sy-release ship` | official, default branch       | keyword tokens                  |
| `/sy-release-beta`                      | beta, prompts for SHA          | invocation forces beta          |
| `/sy-release beta`                      | beta, prompts for SHA          | keyword forces beta             |
| `/sy-release abc1234`                   | beta, full SHA                 | SHA validated + expanded        |
| `/sy-release deadbee`                   | **ABORT** if not a real SHA    | validation catches typos        |
| `/sy-release feature/foo`               | beta, SHA of `feature/foo` tip | branch resolved                 |
| `/sy-release nonexistent-branch`        | **ABORT**                      | neither SHA nor branch          |
| `/sy-release-official abc1234`          | beta, full SHA                 | SHA wins — contradiction signal |
| `/sy-release frobnicate`                | **ABORT**                      | unrecognized arg                |

## Safety rules

- Never silently fall through to official when an arg is unrecognized. The riskiest failure mode is "user thought they were doing beta, we shipped to prod" — abort instead.
- Never auto-pin a beta release to `HEAD` of the default branch — always prompt for a SHA / branch.
- Always require user confirmation before `gh workflow run`.
- SHA-shaped args must validate against the actual repo (`git cat-file -e`). A random hex string is not enough.
- **Never dispatch an official release on a branch ref without verifying the workflow's tag handling.** A `workflow_dispatch` with `--ref main` sets `github.ref_name = "main"`, and any expression like `inputs.tag || github.ref_name` will produce a `vmain` release that overwrites real versions (incident: 2026-05-10, `synle/display-dj`). Always run the tag-safety pre-flight in Step 3 official #5 and pass `--field tag=v<version>` when the workflow exposes a `tag` input.

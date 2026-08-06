[Sy] Upgrade dependencies safely — changelog first, local suite before push, exact pins on production deps, deprecations recorded. Runs the Risky Changes upgrade rule as a workflow.

Argument: $ARGUMENTS (optional — a package name, a list, `outdated` to survey everything, `security` for advisories only, or `patch` / `minor` / `major` to scope by bump size. If empty, survey and propose.)

## When to use

- A security advisory names a dependency you ship.
- Routine maintenance to stop the version gap from compounding.
- A dependency is blocking a feature or a runtime upgrade.
- Dependabot / Renovate opened a bump you need to actually verify rather than rubber-stamp.

## Hard rules

These restate the Risky Changes dependency rule; the workflow below just sequences them.

- **Read the changelog and link it in the PR body** for any major or minor bump on a runtime dependency. Not the diff — the changelog, where the authors say what they broke.
- **Run the full local test suite before pushing.** CI is a second opinion, not first signal; a dependency change can break things the touched-area suite never exercises.
- **Pin exact versions on production dependencies.** No `^`, `~`, or `>=` on anything you ship, unless the repo's committed lockfile already guarantees the resolution and the repo's convention is ranges.
- **Note every new deprecation warning in the PR body.** Today's warning is next major's breakage, and the moment it appears is the cheapest moment to record it.
- Patch bumps and dev-only dependencies may skip the changelog and local-suite steps. Lockfile-only refreshes skip entirely.

Two additions that make the above workable:

- **One dependency per commit** whenever a bump is major, or minor on a runtime dep. Batching six upgrades into one commit means the revert is all-or-nothing and the bisect is useless. Batch only patch-level and dev-only bumps.
- **Never upgrade to fix a bug you have not diagnosed.** "Maybe the new version fixes it" is a guess wearing a version number, and it swaps one unknown for a much larger one. Diagnose first (see the Debugging Discipline rules), then upgrade if the changelog says so.

## Steps

### 1. Survey

Resolve `owner/repo` first (see the Repo Identification rules). Then, whichever applies:

```bash
npm outdated || yarn outdated || pnpm outdated
pip list --outdated
go list -u -m all
cargo outdated
bundle outdated
```

And the advisory view, which changes priority:

```bash
npm audit --json | head -50
pip-audit
govulncheck ./...
cargo audit
gh api repos/<owner>/<repo>/dependabot/alerts --jq '.[] | {package: .dependency.package.name, severity: .security_advisory.severity, summary: .security_advisory.summary}'
```

Report a table before touching anything: package, current, latest, bump size, prod-or-dev, advisory-or-not. Then propose an order — advisories first, then majors one at a time, then batched patches — and say which ones you recommend **not** doing yet and why.

### 2. Classify each bump

| Class                      | Treatment                                                                  |
| -------------------------- | -------------------------------------------------------------------------- |
| Patch, dev-only            | Batch. Lockfile refresh, run the suite once for the batch.                 |
| Patch, production          | Batch. Changelog optional; full suite required.                            |
| Minor, dev-only            | Batch cautiously — a formatter or linter minor can churn every file.       |
| Minor, production          | Own commit. Changelog required. Full suite required.                       |
| Major, anything            | Own commit, own PR. Changelog + migration guide required. Assume breakage. |
| Advisory fix               | Highest priority. Take the smallest bump that clears the advisory.         |
| Runtime / language version | Its own change entirely — not a dependency bump. Expect CI matrix edits.   |

### 3. Read the changelog — actually read it

Find the real one: `CHANGELOG.md` in the repo, GitHub Releases, or the migration guide a major usually ships.

```bash
gh release view --repo <dep-owner>/<dep-repo> <version>
gh release list --repo <dep-owner>/<dep-repo> --limit 20
```

Crossing several versions at once means reading **every** intervening entry, not just the newest — the breaking change is usually in the middle. Extract, and carry into the PR body: breaking changes, new deprecations, changed defaults (the quietest source of production surprises), dropped runtime versions, and any required migration step.

If no changelog exists at all, that is itself a finding: say so, and diff the tags to see what moved.

### 4. Check your own usage

A breaking change only matters if you touch the part that broke. For each breaking item, grep the actual call sites:

```bash
git grep -n "<removed-api>"
git grep -n "from ['\"]<package>" | head -30
```

Report which breaking changes apply to this repo and which do not. This is the step that turns "major bump, scary" into "major bump, we use three functions, none changed".

### 5. Apply one change at a time

```bash
npm install --save-exact <pkg>@<version>
pip install '<pkg>==<version>'   # then update the manifest
go get <pkg>@<version> && go mod tidy
cargo update -p <pkg> --precise <version>
```

Commit the lockfile with the manifest, always, in the same commit. Apply the migration steps the changelog listed — do not defer them to "a follow-up"; a half-migrated dependency is a worse state than either version alone.

### 6. Verify locally, in this order

1. Install cleanly from scratch — delete `node_modules` / the venv / the module cache and reinstall, so a stale artifact cannot mask a resolution failure.
2. Build.
3. Type-check.
4. **Full test suite**, not the targeted one.
5. Start the app / run the binary and exercise the path that uses this dependency. A green suite with an unbootable app is a coverage gap, not a pass.
6. Capture new warnings — deprecations, peer-dependency complaints, resolution warnings. These go in the PR body verbatim.

If anything fails, do not paper over it. Either fix the usage per the migration guide, or report that this bump needs work and stop — an upgrade abandoned with an honest reason is a good outcome.

### 7. PR

Follow the standard PR rules. The body must carry:

- **What moved** — `<pkg> <old> → <new>`, prod or dev.
- **Why now** — advisory, blocker, or maintenance.
- **Changelog link**, plus the breaking-changes list and, for each, whether this repo is affected (with the grep evidence from Step 4).
- **Migration applied** — what you changed, or "none required".
- **New warnings** — verbatim, or "none".
- **Verification** — the exact commands run and their results, including the clean install and the app-boot check.
- **Rollback** — the revert commit, and any data or config change that would _not_ be undone by it.

Prefix the title `BREAKING:` when the upgrade changes behavior this repo's own consumers can observe. A dependency major that is invisible to consumers is not a breaking change for you.

Automerge is opt-in and may be offered once for a dependency-only diff — but never for a major bump, and never without an explicit yes.

### 8. Report

- Table of what was bumped, what was skipped, and why.
- Breaking changes that applied versus that did not.
- Deprecations recorded for next time.
- Anything left undone: bumps you recommend deferring, migrations that need a human decision, tests that were already failing before you started (say so explicitly — never let a pre-existing failure be mistaken for one your bump caused, or vice versa).

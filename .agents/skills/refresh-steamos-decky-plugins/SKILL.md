---
name: refresh-steamos-decky-plugins
description: Update all pinned Decky plugins and CSS Loader themes to the latest verified installable releases, or refresh named packages. Use when asked to update Decky packages, check latest versions, or refresh the generated bundle inventory.
---

## Purpose

Refresh the trusted package inventory used by the opt-in Node.js installer and bundle
builder. Keep installable upstream artifacts verified without committing package ZIPs.

## Quick start

A request such as “Refresh all pinned Decky plugins and CSS Loader themes to the latest
verified installable releases” refreshes the entire inventory. If `$ARGUMENTS` is empty,
unexpanded, or `all`, check every entry; otherwise scope to supplied comma- or
space-separated package names. Resolve names against the inventory and reject unknown
or ambiguous names before changing pins.

“Latest” means the newest verified installable stable release for each selected package,
not a source-code archive or an unchecked store version. Building the bundle alone
never discovers updates or changes pins. Preserve the selected package set, including
Centered Home, unless the user explicitly requests an addition or removal.

## Steps

1. Confirm repository root, branch, and worktree state. Read the canonical inventory,
   `docs/steamos-decky-installation.md`, and shared Decky runtime. Preserve unrelated edits.
2. For every selected plugin, query its recorded upstream's latest stable release and
   current approved store version. For every selected theme, query the DeckThemes record
   using its `theme_id` and inspect the approved current download blob. Compare actual
   versions rather than publication dates or lexicographic strings. Exclude drafts,
   prereleases, disabled themes, and unapproved submissions unless explicitly requested.
   Keep newer verified installed-artifact pins rather than downgrading to an older store
   listing. Store metadata alone does not establish an installable artifact.
3. Download candidates outside the checkout. For themes, inspect the current approved
   DeckThemes blob and its dependencies. Never execute plugin code.
4. Validate SHA-256, safe ZIP32 entries and CRC, one selected root, exact identity/version,
   nonempty compiled plugin `dist/index.js`, and theme ID where applicable. Use the shared
   Node validator against independently checked candidate pins; no Python tooling.
5. Update only verified entries in `software/metadata/decky-packages.json`. Record exact
   HTTPS download and attribution URLs, SHA-256, root, version, and theme ID. Filenames
   must be `<name>_v<version>.zip`, without author prefixes, UUIDs, or hashes. Preserve
   `decky_plugin/` and `decky_css_loader/` bundle paths. Never replace pins for an
   unavailable, unbuilt, or unverifiable candidate; report that package as blocked.
6. Build the full bundle outside the checkout using an explicit output path:

   ```bash
   make build_decky_bundle DECKY_BUNDLE_OUTPUT="$HOME/steamos-decky__bundle.zip"
   ```

   The builder downloads upstream-only in complete batches of three, validates all
   packages, and atomically replaces successful output. Check that the resulting
   `metadata.json` matches the updated inventory and contains every selected package.

7. Run the verification commands below, re-read the inventory and diff, and report every
   selected package in a table: package, previous version, latest discovered version,
   resulting pin, and outcome (`updated`, `already current`, or `blocked` with reason).
   Record exact verified URLs and old/new SHA-256 values for updates. Update documentation
   only where its contract changes. Never create a second package-selection list.
   Commit, push, release publication, and live installation require separate authorization.

## Safety

Never:

- commit generated ZIPs or restore the removed Decky archive folders
- infer an artifact URL, substitute source-code ZIPs, or accept an unverified store hash
- execute downloaded plugin code during validation
- delete installed themes/settings or drop a selected package during a version refresh
- replace an old output before the replacement passes complete validation
- publish a release, push, or use credentials without explicit authorization
- replace a pin with an unverifiable candidate; leave it unchanged and report it blocked
- proceed with ambiguous selection, archive identity, or authorization; preserve pins and stop to ask

## Verification

Run the following and quote exact result lines, distinguishing passed, failed, and skipped:

```bash
/bin/bash -n software/scripts/steamos/setup.bash
npx vitest run --config vitest.config.js software/tests/steamosSetup.cache.spec.js software/tests/steamosSetup.decky.spec.js software/tests/deckyZip.spec.js software/tests/deckyInstaller.spec.js
make build_decky_bundle DECKY_BUNDLE_OUTPUT="OUTPUT.zip"
git diff --check
```

Report old/new versions and SHA-256, verified source URLs, archive validation, unchanged
packages, and gaps. A macOS filesystem-boundary simulation is not live SteamOS proof.
Do not run interactive setup or privileged installation merely to validate a refresh.

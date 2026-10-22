---
name: refresh-steamos-decky-plugins
description: Verify and refresh pinned Decky plugins and CSS Loader themes for the generated release bundle. Use when checking package versions, provenance, hashes, or theme IDs in software/metadata/decky-packages.json.
---

## Purpose

Refresh the trusted package inventory used by the opt-in Node.js installer and bundle
builder. Keep installable upstream artifacts verified without committing package ZIPs.

If `$ARGUMENTS` is empty or unexpanded, check every inventory entry; otherwise scope
to the supplied comma- or space-separated package names.

## Steps

1. Confirm repository root, branch, and worktree state. Read the canonical inventory,
   `docs/steamos-decky-installation.md`, and shared Decky runtime. Preserve unrelated edits.
2. Query each selected upstream release or store record using its recorded source.
   Verify identity and version; keep newer verified releases rather than downgrading to
   older store listings. Store metadata alone does not establish an installable artifact.
3. Download candidates outside the checkout. For themes, inspect the current approved
   DeckThemes blob and its dependencies. Never execute plugin code.
4. Validate SHA-256, safe ZIP32 entries and CRC, one selected root, exact identity/version,
   nonempty compiled plugin `dist/index.js`, and theme ID where applicable. Use the shared
   Node validator against independently checked candidate pins; no Python tooling.
5. Update only verified entries in `software/metadata/decky-packages.json`. Record exact
   HTTPS download and attribution URLs, SHA-256, root, version, and theme ID. Filenames
   must be `<name>_v<version>.zip`, without author prefixes, UUIDs, or hashes. Preserve
   `decky_plugin/` and `decky_css_loader/` bundle paths. Keep Centered Home excluded.
6. Build the full bundle outside the checkout with `make build_decky_bundle
DECKY_BUNDLE_OUTPUT="OUTPUT.zip"`. The builder downloads upstream-only in complete
   batches of three, validates all packages, and atomically replaces successful output.
7. Re-read the inventory and diff. Update documentation only where the described contract
   changes. Do not create a second package-selection list in setup or runtime code.

## Safety

Never:

- commit generated ZIPs or restore the removed Decky archive folders
- infer an artifact URL, substitute source-code ZIPs, or accept an unverified store hash
- execute downloaded plugin code during validation
- delete installed themes/settings or remove existing Centered Home installations
- replace an old output before the replacement passes complete validation
- publish a release, push, or use credentials without explicit authorization
- continue with an unverifiable candidate; leave its pin unchanged and stop to ask

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

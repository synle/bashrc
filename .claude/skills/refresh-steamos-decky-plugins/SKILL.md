---
name: refresh-steamos-decky-plugins
description: Refresh the vendored SteamOS Decky plugin archives from their verified upstream release or Decky store sources. Use when checking or updating plugin versions in assets/steamos/decky_plugin.
---

## Purpose

Refresh the vendored Decky plugin archives used by `software/scripts/steamos/setup.bash`. Keep the archive files, installer list, and `assets/steamos/README.md` source table synchronized.

The user query is: `$ARGUMENTS` — if empty or unexpanded, refresh every plugin listed in `assets/steamos/README.md`; otherwise treat it as a comma- or space-separated plugin name or repository query.

## Steps

1. Confirm repository root, branch, and worktree state:
   ```bash
   git rev-parse --show-toplevel
   git status --short --branch
   ```
   Stop if unrelated uncommitted changes touch `assets/steamos/`, `software/scripts/steamos/setup.bash`, or `assets/steamos/README.md`.
2. Read the plugin table in `assets/steamos/README.md` and the `DECKY_PLUGINS` array in `software/scripts/steamos/setup.bash`. Treat those two lists as the requested scope.
3. For GitHub release plugins, query each repository's latest release:
   ```bash
   curl -fsSL "https://api.github.com/repos/OWNER/REPO/releases/latest" | jq .
   ```
   Select the release asset intended for Decky installation. Prefer a ZIP over a tarball when both exist. Do not infer a newer version from a branch, commit, or unrelated asset.
4. Download each candidate to a temporary folder outside the repository. Never download directly over a tracked archive. Compare SHA-256 checksums before replacing anything:
   ```bash
   shasum -a 256 CURRENT.zip CANDIDATE.zip
   ```
5. For Decky store plugins without a usable GitHub release, query the store metadata:
   ```bash
   curl -fsSL --get --data-urlencode "query=PLUGIN_NAME" \
     https://plugins.deckbrew.xyz/plugins | jq .
   ```
   Treat `versions[0]` as the store's latest listed version only after checking its `name`, `created`, and `hash`. Obtain the archive through a verified Decky store download flow or a documented CDN URL. Store metadata alone is not an archive.
6. Validate every candidate archive before replacing the tracked file:
   ```bash
   unzip -t CANDIDATE.zip
   unzip -Z1 CANDIDATE.zip | head -20
   unzip -p CANDIDATE.zip '*/package.json' | jq -e '.name and .version' || true
   unzip -p CANDIDATE.zip '*/plugin.json' | jq -e '.'
   ```
   Confirm one safe top-level plugin folder, `plugin.json`, a usable `dist/` or plugin entry point, and the expected plugin identity. If a plugin has no `package.json`, record that fact and validate its `plugin.json` instead.
7. Replace only archives whose verified upstream checksum or version changed. Retain the existing local naming convention. If a filename contains a version, update both the archive filename and matching entry in `software/scripts/steamos/setup.bash`.
8. Update the matching row in `assets/steamos/README.md` with the current filename, repository, store source when applicable, version, release tag, or store version, and verification date. Keep attribution URLs unchanged unless upstream moved the repository.
9. Check that every archive in `assets/steamos/decky_plugin/` appears once in `setup.bash` and the README table, and every listed archive exists:
   ```bash
   bash -eu -o pipefail -c '
     for file in assets/steamos/decky_plugin/*.zip; do
       name=${file##*/}
       grep -Fq "\"$name\"" software/scripts/steamos/setup.bash
       grep -Fq "decky_plugin/$name" assets/steamos/README.md
     done
   '
   ```
10. Re-read the changed files, inspect `git diff --stat` and `git diff --check`, then run the verification commands below.

## Safety

Never:

- overwrite a tracked archive before downloading and validating a temporary candidate
- claim a plugin is current from a failed request, missing release, branch head, or unverified store hash
- invent a Decky CDN URL or substitute a source archive that is not the installable Decky artifact
- remove a plugin because its repository has no GitHub release; mark it unresolved and stop for user input
- update only a README row while leaving `setup.bash` pointed at a different archive
- use credentials, GitHub tokens, or authenticated endpoints
- delete old archives until the replacement passes ZIP and plugin metadata checks

If a store artifact cannot be retrieved and verified, stop and report the plugin name, store version, hash, and exact missing artifact step. Ask before changing that plugin.

## Verification

Run and report exact output for:

```bash
bash -n software/scripts/steamos/setup.bash
npx vitest run --config vitest.config.js software/tests/steamosSetup.spec.js
git diff --check
```

For each refreshed plugin, report old version and SHA-256, new version and SHA-256, source URL, and archive validation result. Report unchanged plugins separately. A successful refresh requires zero failed commands, matching installer and README lists, and no unverified candidate archives.

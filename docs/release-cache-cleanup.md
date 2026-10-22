# Manual binary-cache release cleanup

Use **Actions → Clean Binary Cache Release → Run workflow**, select the default branch,
and check only the groups you intend to delete. All three checkboxes default to **off**;
with none selected, all cleanup jobs are skipped. There is no schedule or push trigger.
This workflow is separate from Actions artifact/run cleanup.

| Checkbox                            | Input                          | Deletes                                                                                                                                            |
| ----------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Precompiled Bash profiles           | `precompiled_profiles`         | `bashrc-profile__profile_bashrc_*.sh` assets with a valid profile name                                                                             |
| Tool binaries and installer bundles | `tool_binaries_and_installers` | Allowlisted non-Decky application assets, ZIPs, other package formats, installer scripts, standalone binaries, and associated `version.json` files |
| Decky plugin and theme bundles      | `decky_bundles`                | `steamos-decky__bundle.zip` and its numeric run/attempt `.candidate-*` / `.previous-*` ZIPs                                                        |

Multiple checkboxes combine the groups. Tool cleanup explicitly allows the current
`bashrc-installer`, `display-dj`, `proxie`, `skiff-files`, `skippy-ff`, `sqlui-native`,
`text-server`, and `url-porter` namespaces. New namespaces require an intentional
cleanup-policy update in `software/tools/cleanup-release-cache.js`; unknown assets
are preserved rather than treated as a catch-all non-Decky group.

## Preconditions and scope

**Deletion is permanent for those asset IDs.** Download any assets you need to retain
before running cleanup, and wait for cache-producing builds/publications to finish.
Do not start another publisher while cleanup runs. The workflow serializes manual
cleanups, but it does not lock existing build workflows. In particular, Decky cleanup
also removes recovery backups; do not select it during a failed/incomplete publication
unless you deliberately intend to discard those recovery assets.

The workflow only deletes selected assets from the repository's `binary-cache` release.
It never deletes the release, tag, other releases, Actions artifacts, installed tools,
or installed Decky plugins/themes/settings. Deleting the bootstrap installer cache
makes that release-download entry point unavailable until restored. Missing cache assets
can also remove fallback downloads or require an upstream request, depending on the
consumer; an offline installation may fail.

## Execution, failure, and recovery

Three dedicated matrix jobs run serially, one per asset group, so their own deletions
cannot shift another job's paginated listing. Unselected group jobs exit without API
requests. A failed group cancels the remaining matrix work. Each job has `contents: write`;
other workflow permissions remain read-only. Jobs run only from the default branch,
check out without persisted credentials, use Node and the runner's authenticated `gh`,
and install no dependencies.

The script enumerates release assets in pages of 100, stopping before any deletion if
more than 10 full pages would be needed or a malformed/duplicate record appears.
It prints a complete JSON-line `plan` containing asset IDs, names, and sizes before
mutation. Before each DELETE, it rechecks the release ID/tag and asset ID/name/size/
update timestamp. Changed records or API failures stop the job. Only successful DELETE
responses produce `deleted` events, and only a complete run prints `complete`.

These checks do not make GitHub reads and deletion atomic: another publisher can race
the final read. The precondition to stop concurrent publishers remains necessary.
Deletion failures can leave a partially cleaned cache; inspect `deleted` events and
current release assets before retrying. No automatic deletion retries or rollback run.
Cancelling a run stops subsequent work but cannot restore earlier deletions.

Restore missing assets through their normal successful default-branch build/publication
or re-upload a trusted saved copy. A rebuild restores current content, not deleted
historical bytes or original asset IDs. Confirm the expected asset names and validate
consumer downloads before relying on the cache again. For Decky, the trusted pins stay
in `software/metadata/decky-packages.json`; see [bundle building and validation](steamos-decky-installation.md).

## Local verification

```bash
node node_modules/vitest/vitest.mjs run --config vitest.config.js software/tests/releaseCacheCleanup.spec.js
```

Tests exercise the actual cleanup module through an owned local API simulation and
execute the workflow's CLI command against a local `gh` adapter. They cover disabled
inputs, each group, combined groups, unknown preservation, pagination, validation,
changed targets, and partial failures. They do not mutate or establish live GitHub
release deletion behavior. Do not run the cleanup CLI against a real repository merely
to test it.

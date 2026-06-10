#!/usr/bin/env bash
{
  ################################################################################
  # ---- ci-download-release-binaries.sh - Refresh the binary-cache release ----
  #
  # Downloads the latest release assets from each configured upstream repo and
  # mirrors them to a single rolling release on synle/bashrc (tag: binary-cache),
  # so downloadAssetWithFallback() in software/index.js has a stable URL to fall
  # back to when the upstream is unreachable.
  #
  # The cache is flat (one release, all apps) — assets are namespaced as
  # "<app>__<filename>" so multiple upstreams co-exist without collision.
  # This naming MUST stay in sync with getBinaryCacheUrl() in software/index.js.
  #
  # Flow per upstream repo:
  # 1. Fetch release metadata (version + asset list) from the GitHub API.
  # 2. Derive app name from the API URL path (e.g. url-porter, sqlui-native).
  # 3. Extract all assets with names, sizes, and download URLs.
  # 4. Skip any asset over the size threshold (50 MB) using the API-reported size.
  # 5. Download all eligible assets to a temp directory, validate each is non-empty.
  # 6. All-or-nothing: if any download fails or is 0 bytes, skip the entire app
  #    (existing release assets for this app are preserved on failure).
  # 7. If all valid → delete existing "<app>__*" assets on the binary-cache
  #    release, then upload the fresh ones (each as "<app>__<filename>"),
  #    plus a "<app>__version.json" for diagnostics.
  # 8. Print a ::group:: summary with per-app file counts and sizes.
  #
  # Requires: GITHUB_TOKEN with contents:write on the cache repo. Run under
  # `gh auth status` in CI (the workflow's default GITHUB_TOKEN is sufficient).
  #
  # Usage:
  #   bash software/tools/ci-download-release-binaries.sh
  #   make ci_download_release_binaries
  ################################################################################

  set -euo pipefail

  CACHE_REPO="synle/bashrc"
  CACHE_TAG="binary-cache"
  CACHE_TITLE="Binary cache (fallback for downloadAssetWithFallback)"
  TEMP_DIR="${TMPDIR:-/tmp}/ci-release-binaries-$$"
  # GitHub Releases accept assets up to 2 GB. 300 MB is generous for our
  # current upstreams (Tauri AppImages, Electron .dmg, etc.) and was bumped
  # from the old 50 MB cap once we stopped shipping these as a prep-patch
  # artifact and started mirroring them to a release directly.
  MAX_FILE_SIZE=$((300 * 1024 * 1024))

  trap 'rm -rf "$TEMP_DIR"' EXIT

  mkdir -p "$TEMP_DIR"

  # Report accumulator: lines of "app_name|file_name|file_size" for final summary
  REPORT_FILE="$TEMP_DIR/_report.txt"
  touch "$REPORT_FILE"

  ##############################################################################
  # ---- Helpers ----
  ##############################################################################

  # Formats a byte count as a human-readable string (B, KB, or MB).
  function format_size() {
    local bytes="$1"
    if [ "$bytes" -ge 1048576 ]; then
      awk "BEGIN{printf \"%.1f MB\", $bytes/1048576}"
    elif [ "$bytes" -ge 1024 ]; then
      awk "BEGIN{printf \"%.1f KB\", $bytes/1024}"
    else
      printf "%d B" "$bytes"
    fi
  }

  # Builds a GitHub Releases API URL from a repo identifier.
  # Accepts "owner/repo" (defaults to latest) or "owner/repo/version".
  # e.g. "synle/url-porter" → "https://api.github.com/repos/synle/url-porter/releases/latest"
  # e.g. "synle/url-porter/v1.2.0" → "https://api.github.com/repos/synle/url-porter/releases/tags/v1.2.0"
  # This must match getGitHubReleaseApiUrl() in index.js.
  function get_release_api_url() {
    local repo_id="$1"
    local owner repo version
    IFS='/' read -r owner repo version <<< "$repo_id"
    version="${version:-latest}"
    if [ "$version" = "latest" ]; then
      echo "https://api.github.com/repos/${owner}/${repo}/releases/latest"
    else
      echo "https://api.github.com/repos/${owner}/${repo}/releases/tags/${version}"
    fi
  }

  # Extracts the repo name from a repo identifier ("owner/repo" or "owner/repo/version").
  # This must match getRepoNameFromId() in index.js.
  function get_repo_name() {
    echo "$1" | cut -d'/' -f2
  }

  # Downloads a file and validates it has non-zero size. Returns 0 on success, 1 on failure.
  function download_and_validate() {
    local url="$1"
    local dest="$2"
    mkdir -p "$(dirname "$dest")"
    if ! curl -fsSL -o "$dest" "$url"; then
      echo "  [FAIL] Download failed: $url"
      return 1
    fi
    local fsize
    fsize=$(wc -c < "$dest" | tr -d ' ')
    if [ "$fsize" -eq 0 ]; then
      echo "  [FAIL] Downloaded file is empty (0 bytes): $(basename "$dest")"
      return 1
    fi
    echo "  [OK] $(basename "$dest") ($(format_size "$fsize"))"
    return 0
  }

  # Ensures the rolling cache release exists on $CACHE_REPO and is published.
  # Creates it on first use (prerelease, not "Latest"). Self-heals if the release
  # exists but is in draft state — draft assets are private (404 to anonymous
  # curl), which defeats the entire downloadAssetWithFallback() / installer
  # one-liner story. Idempotent: subsequent calls are a no-op on a healthy release.
  #
  # Retries `gh release view` up to 3 times on transient API/auth failures.
  # Why: GitHub-hosted runners occasionally see one-off 5xx or "no auth"
  # responses for a valid token, and the prior code swallowed any non-zero
  # exit via `> /dev/null 2>&1`, then fell through to the "first-time setup"
  # branch — which crashed with HTTP 401 when `gh release create` ran against
  # an already-existing release. The fix: only fall through to create when we
  # see a literal "release not found" body (genuine 404); any other failure is
  # retried with backoff and surfaced loudly if it survives all attempts.
  function ensure_cache_release() {
    local view_output view_rc attempt
    for attempt in 1 2 3; do
      view_rc=0
      view_output=$(gh release view "$CACHE_TAG" --repo "$CACHE_REPO" --json isDraft --jq .isDraft 2>&1) || view_rc=$?
      if [ "$view_rc" -eq 0 ]; then
        break
      fi
      # 404 from the API surfaces as "release not found" in gh CLI output.
      # Anything else (401, 5xx, network blips) gets retried.
      if echo "$view_output" | grep -qi "release not found"; then
        view_rc=404
        break
      fi
      if [ "$attempt" -lt 3 ]; then
        echo "::warning::gh release view $CACHE_TAG attempt $attempt/3 failed (rc=$view_rc): $view_output"
        sleep $((attempt * 2))
      fi
    done

    if [ "$view_rc" -eq 0 ]; then
      if [ "$view_output" = "true" ]; then
        echo ">> $CACHE_REPO release $CACHE_TAG is in draft state — publishing for anonymous access"
        if ! gh release edit "$CACHE_TAG" --repo "$CACHE_REPO" --draft=false > /dev/null 2>&1; then
          echo "::warning::Failed to publish draft release $CACHE_TAG — assets will remain private (404 to anonymous curl)"
        fi
      fi
      return 0
    fi

    if [ "$view_rc" != "404" ]; then
      echo "::error::gh release view $CACHE_TAG --repo $CACHE_REPO failed 3x (rc=$view_rc); last error: $view_output"
      return 1
    fi

    echo ">> Creating $CACHE_REPO release $CACHE_TAG (first-time setup)"
    gh release create "$CACHE_TAG" \
      --repo "$CACHE_REPO" \
      --title "$CACHE_TITLE" \
      --notes "Rolling fallback cache for downloadAssetWithFallback(). Auto-refreshed by software/tools/ci-download-release-binaries.sh on every CI prep run. Not for human consumption." \
      --prerelease
  }

  # Lists current "<app>__*" asset names on the cache release.
  # Returns one asset name per line (or empty output on no matches / first run).
  function list_cache_assets_for_app() {
    local app_name="$1"
    gh release view "$CACHE_TAG" --repo "$CACHE_REPO" \
      --json assets --jq ".assets[].name | select(startswith(\"${app_name}__\"))" 2>/dev/null || true
  }

  # Fetches the existing size (in bytes) of a single cached asset by name on the
  # cache release. Echoes a byte count or empty string when the asset is absent.
  function get_existing_cache_asset_size() {
    local asset_name="$1"
    gh release view "$CACHE_TAG" --repo "$CACHE_REPO" \
      --json assets --jq ".assets[] | select(.name == \"${asset_name}\") | .size" 2>/dev/null || true
  }

  # Returns the currently-cached version for an app by reading the top-level
  # "<app>__version.json" pointer on the cache release. Echoes the version
  # string or empty if no pointer exists yet (first run for this app).
  function get_cached_version() {
    local app_name="$1"
    curl -fsSL "https://github.com/${CACHE_REPO}/releases/download/${CACHE_TAG}/${app_name}__version.json" 2>/dev/null \
      | python3 -c "import sys,json; print(json.load(sys.stdin).get('version',''))" 2>/dev/null || true
  }

  # Minimum acceptable size for a freshly-downloaded asset before it can be
  # uploaded as a fallback. Catches obviously-bad responses (HTML error pages
  # returning 200, truncated transfers, etc.) that pass the non-zero check.
  MIN_ASSET_SIZE_BYTES=1024

  # Strips an embedded semver-shaped version (e.g. "_7.0.5_", "_0.2.268_") out
  # of an upstream filename so the cached asset always has a stable name
  # regardless of upstream version bumps. Pattern matched: a digit-only segment
  # delimited by underscores with at least one ".N" group (covers X.Y, X.Y.Z,
  # X.Y.Z.W). Files without a version stretch are returned unchanged
  # (e.g. url-porter.zip, sqlui-portal.tar.gz).
  #
  # Examples:
  #   Display.DJ_7.0.5_x64.dmg          → Display.DJ_x64.dmg
  #   sqlui-native_3.1.6_amd64.AppImage → sqlui-native_amd64.AppImage
  #   Skiff.Files_0.2.268_aarch64.dmg   → Skiff.Files_aarch64.dmg
  #   url-porter.zip                    → url-porter.zip          (unchanged)
  #
  # This MUST stay in sync with stripVersionFromFilename() in software/index.js
  # so the runtime fallback URL matches what we upload.
  function strip_version_from_filename() {
    echo "$1" | sed -E 's/_[0-9]+(\.[0-9]+)+_/_/g'
  }

  # Uploads a single file to the cache release as "<app>__<stripped-basename>".
  # Always overwrites via --clobber, since the stripped name is stable across
  # upstream version bumps and a new version is a legitimate full replacement.
  #
  # Guards: refuses to overwrite an existing same-named asset with one that's
  # <50% the size (catches truncated downloads / HTML error pages), and refuses
  # any local file <1 KB (version.json exempt — it's intentionally tiny).
  #
  # Returns 0 on success (uploaded), 2 on safe-skip (refused clobber for
  # sanity reasons), and 1 on hard failure (gh upload errored out).
  function safe_upload_cache_asset() {
    local app_name="$1"
    local src_file="$2"
    local fname
    fname=$(basename "$src_file")
    local stripped namespaced
    stripped=$(strip_version_from_filename "$fname")
    namespaced="${app_name}__${stripped}"
    local new_size
    new_size=$(wc -c < "$src_file" | tr -d ' ')

    # Guard 1: file must be at least MIN_ASSET_SIZE_BYTES. version.json is
    # ~120 bytes and is exempt — its content is metadata-only and validated
    # separately by callers that read it.
    if [ "$fname" != "version.json" ] && [ "$new_size" -lt "$MIN_ASSET_SIZE_BYTES" ]; then
      echo "  [SKIP-UPLOAD] $namespaced — local file is $(format_size "$new_size"), below minimum $(format_size "$MIN_ASSET_SIZE_BYTES") (refusing to clobber)"
      return 2
    fi

    # Guard 2: if a same-named asset already exists on the release, refuse to
    # overwrite it with one substantially smaller. 50% size drop is the
    # threshold — large enough to allow legitimate shrinks (compression
    # improvements, debug-symbol stripping) but small enough to catch a
    # truncated download or an HTML error page replacing a real binary.
    local existing_size
    existing_size=$(get_existing_cache_asset_size "$namespaced")
    if [ -n "$existing_size" ] && [ "$existing_size" -gt 0 ]; then
      local half_existing=$((existing_size / 2))
      if [ "$new_size" -lt "$half_existing" ]; then
        echo "  [SKIP-UPLOAD] $namespaced — new size $(format_size "$new_size") is <50% of existing $(format_size "$existing_size") (refusing to clobber known-good asset)"
        return 2
      fi
    fi

    # Stage under the namespaced filename and upload with --clobber.
    local staged="$TEMP_DIR/_upload/$namespaced"
    mkdir -p "$(dirname "$staged")"
    cp -f "$src_file" "$staged"
    if ! gh release upload "$CACHE_TAG" "$staged" --repo "$CACHE_REPO" --clobber > /dev/null; then
      echo "  [FAIL-UPLOAD] $namespaced"
      return 1
    fi
    return 0
  }

  # Deletes any "<app>__*" asset on the cache release whose name is NOT in the
  # whitespace-separated keep-list. Catches leftover renames between versions
  # (e.g. when an upstream removes/renames a flavor). Called AFTER successful
  # uploads so a mid-batch failure never empties the cache.
  function purge_stale_cache_assets_except() {
    local app_name="$1"
    local keep_list="$2"
    local existing
    existing=$(list_cache_assets_for_app "$app_name")
    if [ -z "$existing" ]; then
      return 0
    fi
    while IFS= read -r aname; do
      [ -z "$aname" ] && continue
      # Keep if the asset name appears as a whole word in the keep-list.
      if echo " $keep_list " | grep -q " $aname "; then
        continue
      fi
      gh release delete-asset "$CACHE_TAG" "$aname" --repo "$CACHE_REPO" --yes > /dev/null 2>&1 || true
      echo "  [PURGE] $aname"
    done <<< "$existing"
  }

  # Processes a single GitHub release: fetch metadata, download eligible assets,
  # validate, and mirror to the cache release if all pass. See file header for full flow.
  # Usage: backup_release_assets <repo_id>  (e.g. "synle/url-porter" or "synle/url-porter/v1.2.0")
  function backup_release_assets() {
    local repo_id="$1"

    # Step 1: build the API URL and fetch release metadata
    local api_url app_name
    api_url=$(get_release_api_url "$repo_id")
    app_name=$(get_repo_name "$repo_id")

    local release_json
    release_json=$(curl -fsSL "$api_url" 2>/dev/null) || true
    if [ -z "$release_json" ]; then
      echo ""
      echo ">> $app_name: could not fetch release metadata, skipping"
      return
    fi

    # Step 2: extract version from the release response
    # App name is derived from the repo identifier, not the response body.
    # This must match getRepoNameFromId() in index.js.
    local version
    version=$(echo "$release_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tag_name',''))" 2>/dev/null) || true

    if [ -z "$version" ] || [ -z "$app_name" ]; then
      echo ""
      echo ">> Could not parse release from: $api_url"
      return
    fi

    # Skip-if-unchanged: compare the upstream version against the cached
    # "<app>__version.json" pointer. If they match, the cache is already up
    # to date and we save both the download and upload bandwidth.
    # version.json is uploaded LAST in the mirror flow below, so if a previous
    # run failed mid-batch, the pointer still reflects the prior version and
    # this check correctly returns "mismatch" → triggers a full retry.
    local existing_version
    existing_version=$(get_cached_version "$app_name")
    if [ -n "$existing_version" ] && [ "$existing_version" = "$version" ]; then
      echo ""
      echo ">> $app_name $version: already cached (matches version.json pointer), skipping"
      return
    fi

    # Step 3: extract all assets with names, sizes, and download URLs
    local asset_data
    asset_data=$(echo "$release_json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
threshold = int(sys.argv[1])
for a in data.get('assets', []):
    name, size, url = a['name'], a['size'], a['browser_download_url']
    skip = '1' if size > threshold else '0'
    print(f'{name}\t{size}\t{url}\t{skip}')
" "$MAX_FILE_SIZE" 2>/dev/null) || true

    if [ -z "$asset_data" ]; then
      echo ""
      echo ">> $app_name $version: no release assets found, skipping"
      return
    fi

    local app_temp="$TEMP_DIR/$app_name"
    local total_count=0
    local download_count=0
    local skip_count=0
    local all_valid=1

    mkdir -p "$app_temp"

    echo ""
    echo ">> $app_name $version"

    # Step 4-5: download eligible assets to temp, skip any over size threshold
    while IFS=$'\t' read -r fname fsize url skip_flag; do
      [ -z "$fname" ] && continue
      total_count=$((total_count + 1))
      # Step 4: skip assets over the size threshold (pre-download, API-reported size)
      if [ "$skip_flag" = "1" ]; then
        echo "  [SKIP] $fname ($(format_size "$fsize") > $(format_size "$MAX_FILE_SIZE") threshold)"
        skip_count=$((skip_count + 1))
        continue
      fi
      # Step 5: download and validate non-empty
      download_count=$((download_count + 1))
      if ! download_and_validate "$url" "$app_temp/$fname"; then
        all_valid=0
      fi
    done <<< "$asset_data"

    if [ "$download_count" -eq 0 ]; then
      echo "  [SKIP] All $total_count assets exceed size threshold"
      return
    fi

    # Step 6: all-or-nothing — if any download failed, preserve prior cache for this app
    if [ "$all_valid" -eq 0 ]; then
      echo "  [SKIP] Keeping existing cache entries for $app_name — one or more new artifacts invalid"
      return
    fi

    # Step 7: all downloads valid — upload them with per-file safety checks,
    # then purge any stale "<app>__*" assets that aren't part of this batch.
    # Purge happens LAST so an upload failure mid-batch never empties the cache.
    local keep_list=""
    local upload_fail_count=0
    local upload_skip_count=0

    for f in "$app_temp"/*; do
      [ -f "$f" ] || continue
      local bname stripped_bname bsize rc
      bname=$(basename "$f")
      stripped_bname=$(strip_version_from_filename "$bname")
      bsize=$(wc -c < "$f" | tr -d ' ')
      rc=0
      # `|| rc=$?` is required: under `set -e` a bare non-zero return from
      # safe_upload_cache_asset would exit the script before we can inspect rc.
      safe_upload_cache_asset "$app_name" "$f" || rc=$?
      case "$rc" in
        0) keep_list+="${app_name}__${stripped_bname} "; echo "$app_name|$stripped_bname|$bsize" >> "$REPORT_FILE" ;;
        2) upload_skip_count=$((upload_skip_count + 1)); keep_list+="${app_name}__${stripped_bname} " ;;  # safe-skip: keep existing
        *) upload_fail_count=$((upload_fail_count + 1)) ;;
      esac
    done

    # Write + upload version.json LAST so a partial upload doesn't leave a
    # version.json that points to artifacts we haven't actually mirrored yet.
    local version_file="$app_temp/version.json"
    cat > "$version_file" <<VEOF
{
  "appName": "$app_name",
  "version": "$version",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
VEOF
    if [ "$upload_fail_count" -eq 0 ]; then
      local vrc=0
      safe_upload_cache_asset "$app_name" "$version_file" || vrc=$?
      if [ "$vrc" -eq 0 ]; then
        keep_list+="${app_name}__version.json "
        echo "$app_name|version.json|$(wc -c < "$version_file" | tr -d ' ')" >> "$REPORT_FILE"
      fi
      purge_stale_cache_assets_except "$app_name" "$keep_list"
      echo "  [OK] Mirrored $app_name $version to $CACHE_REPO release $CACHE_TAG ($download_count downloaded, $upload_skip_count safe-skipped, $skip_count over-size)"
    else
      echo "  [PARTIAL] $upload_fail_count upload(s) failed for $app_name — leaving existing cache intact (no purge, no version.json update)"
    fi
  }

  ##############################################################################
  # ---- Repos ----
  ##############################################################################
  RELEASE_REPOS=(
    "synle/url-porter"
    "synle/skippy-ff"
    "synle/sqlui-native"
    "synle/display-dj"
    "synle/skiff-files"
    "synle/proxie"
  )

  # Make sure the cache release exists before the first upload; this is a no-op
  # on every run after the very first.
  ensure_cache_release

  for repo_id in "${RELEASE_REPOS[@]}"; do
    backup_release_assets "$repo_id"
  done

  ##############################################################################
  # ---- Step 8: Summary ----
  ##############################################################################
  echo ""
  echo "::group::Release binary cache mirror summary"

  # Prints the final summary report grouped by app.
  function print_report() {
    if [ ! -s "$REPORT_FILE" ]; then
      echo "No assets mirrored."
      return
    fi
    local prev_app=""
    while IFS='|' read -r app fname fsize; do
      if [ "$app" != "$prev_app" ]; then
        if [ -n "$prev_app" ]; then
          echo ""
        fi
        # Compute totals for this app
        local count=0 total=0
        while IFS='|' read -r a2 f2 s2; do
          [ "$a2" = "$app" ] || continue
          count=$((count + 1))
          total=$((total + s2))
        done < <(sort "$REPORT_FILE")
        echo "$app: $count files, $(format_size "$total")"
        prev_app="$app"
      fi
      echo "  $fname ($(format_size "$fsize"))"
    done < <(sort "$REPORT_FILE")
  }

  print_report

  echo "::endgroup::"
  echo ""
  echo "Release binary cache mirror complete. Cache: https://github.com/$CACHE_REPO/releases/tag/$CACHE_TAG"
}

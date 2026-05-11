#!/usr/bin/env bash
{
  ################################################################################
  # ---- ci-download-release-binaries.sh - Download latest release binaries ----
  #
  # Downloads latest release assets from GitHub for configured repos.
  # The assets/binaries/<app>/ directories are committed via the CI prep patch,
  # making them available as fallbacks for downloadAssetWithFallback() at runtime.
  #
  # Flow per repo:
  # 1. Fetch release metadata (version + asset list) from the GitHub API.
  # 2. Derive app name from the API URL path (e.g. url-porter, sqlui-native).
  # 3. Extract all assets with names, sizes, and download URLs.
  # 4. Skip any asset over the size threshold (50 MB) using the API-reported size.
  # 5. Download all eligible assets to a temp directory, validate each is non-empty.
  # 6. All-or-nothing: if any download fails or is 0 bytes, skip the entire app:
  #    - Existing backup in assets/binaries/<app>/ → keep it (don't overwrite with bad data).
  #    - No existing backup → still OK (net new, nothing to protect).
  # 7. If all valid → copy everything to assets/binaries/<app>/ and write version.json.
  # 8. Print a ::group:: summary with per-app file counts and sizes.
  #
  # Usage:
  #   bash software/tools/ci-download-release-binaries.sh
  #   make ci_download_release_binaries
  ################################################################################

  set -euo pipefail

  ASSETS_DIR="assets/binaries"
  TEMP_DIR="${TMPDIR:-/tmp}/ci-release-binaries-$$"
  MAX_FILE_SIZE=$((50 * 1024 * 1024))

  trap 'rm -rf "$TEMP_DIR"' EXIT

  mkdir -p "$TEMP_DIR"
  # Ensure the backup root exists before per-app subfolders are written into it
  mkdir -p "$ASSETS_DIR"

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

  # Processes a single GitHub release: fetch metadata, download eligible assets,
  # validate, and copy to assets/<app>/ if all pass. See file header for full flow.
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
    local app_assets="$ASSETS_DIR/$app_name"
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

    # Step 6: all-or-nothing — if any download failed, skip the entire app
    if [ "$all_valid" -eq 0 ]; then
      if [ -f "$app_assets/version.json" ]; then
        # Existing backup present — preserve it, don't overwrite with bad data
        echo "  [SKIP] Keeping existing backup for $app_name — one or more new artifacts invalid"
      else
        # Net new — no existing backup to protect, skip is acceptable
        echo "  [SKIP] No existing backup for $app_name — skipping (net new, acceptable)"
      fi
      return
    fi

    # Step 7: all valid — copy to assets/<app>/ and write version.json
    mkdir -p "$app_assets"
    for f in "$app_temp"/*; do
      [ -f "$f" ] || continue
      local bname
      bname=$(basename "$f")
      local bsize
      bsize=$(wc -c < "$f" | tr -d ' ')
      cp -f "$f" "$app_assets/$bname"
      echo "$app_name|$bname|$bsize" >> "$REPORT_FILE"
    done

    cat > "$app_assets/version.json" <<VEOF
{
  "appName": "$app_name",
  "version": "$version",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
VEOF
    echo "$app_name|version.json|$(wc -c < "$app_assets/version.json" | tr -d ' ')" >> "$REPORT_FILE"
    echo "  [OK] Backed up $app_name $version to $app_assets/ ($download_count downloaded, $skip_count skipped)"
  }

  ##############################################################################
  # ---- Repos ----
  ##############################################################################
  RELEASE_REPOS=(
    "synle/url-porter"
    "synle/sqlui-native"
    "synle/display-dj"
    "synle/skiff-files"
  )

  for repo_id in "${RELEASE_REPOS[@]}"; do
    backup_release_assets "$repo_id"
  done

  ##############################################################################
  # ---- Step 8: Summary ----
  ##############################################################################
  echo ""
  echo "::group::Release binary backup summary"

  # Prints the final summary report grouped by app.
  function print_report() {
    if [ ! -s "$REPORT_FILE" ]; then
      echo "No assets backed up."
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
  echo "Release binary backup complete."
}

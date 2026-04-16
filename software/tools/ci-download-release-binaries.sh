#!/usr/bin/env bash
{
  ################################################################################
  # ---- ci-download-release-binaries.sh - Download latest release binaries ----
  #
  # Downloads latest release assets from GitHub for configured repos. Auto-discovers
  # all assets from each release, skips files over the size threshold (50 MB default),
  # validates downloads, then copies to assets/<app>/ with a version.json.
  #
  # Consistency rule: all downloadable artifacts for a given app must be valid — if
  # any single binary is corrupted or unreachable, the entire backup for that app is
  # skipped (preserving any existing backup).
  #
  # Usage:
  #   bash software/tools/ci-download-release-binaries.sh
  #   make ci_download_release_binaries
  ################################################################################

  set -euo pipefail

  ASSETS_DIR="assets"
  TEMP_DIR="${TMPDIR:-/tmp}/ci-release-binaries-$$"
  MAX_FILE_SIZE=$((50 * 1024 * 1024))

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

  # Fetches latest release metadata, downloads all assets under the size threshold,
  # validates them, then copies to assets/<app>/ with version.json.
  # Usage: backup_release_assets <github_api_releases_latest_url>
  function backup_release_assets() {
    local api_url="$1"

    # Fetch release metadata (version + asset list with sizes and URLs)
    local release_json
    release_json=$(curl -fsSL "$api_url" 2>/dev/null) || true
    if [ -z "$release_json" ]; then
      echo ""
      echo ">> $(basename "$(dirname "$api_url")"): could not fetch release metadata, skipping"
      return
    fi

    local version app_name
    version=$(echo "$release_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tag_name',''))" 2>/dev/null) || true
    app_name=$(echo "$release_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('html_url','').split('/')[4] if len(d.get('html_url','').split('/'))>4 else '')" 2>/dev/null) || true

    if [ -z "$version" ] || [ -z "$app_name" ]; then
      echo ""
      echo ">> Could not parse release from: $api_url"
      return
    fi

    # Extract assets: name, size, download URL — skip assets over threshold
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

    # Download eligible assets to temp
    while IFS=$'\t' read -r fname fsize url skip_flag; do
      [ -z "$fname" ] && continue
      total_count=$((total_count + 1))
      if [ "$skip_flag" = "1" ]; then
        echo "  [SKIP] $fname ($(format_size "$fsize") > $(format_size "$MAX_FILE_SIZE") threshold)"
        skip_count=$((skip_count + 1))
        continue
      fi
      download_count=$((download_count + 1))
      if ! download_and_validate "$url" "$app_temp/$fname"; then
        all_valid=0
      fi
    done <<< "$asset_data"

    if [ "$download_count" -eq 0 ]; then
      echo "  [SKIP] All $total_count assets exceed size threshold"
      return
    fi

    if [ "$all_valid" -eq 0 ]; then
      if [ -f "$app_assets/version.json" ]; then
        echo "  [SKIP] Keeping existing backup for $app_name — one or more new artifacts invalid"
      else
        echo "  [SKIP] No existing backup for $app_name — skipping (net new, acceptable)"
      fi
      return
    fi

    # All valid — copy to assets/
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

    # Write version.json metadata
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
  RELEASE_URLS=(
    "https://api.github.com/repos/synle/url-porter/releases/latest"
    "https://api.github.com/repos/synle/sqlui-native/releases/latest"
    "https://api.github.com/repos/synle/display-dj/releases/latest"
  )

  for url in "${RELEASE_URLS[@]}"; do
    backup_release_assets "$url"
  done

  ##############################################################################
  # ---- Summary ----
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

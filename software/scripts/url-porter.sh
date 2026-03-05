#!/usr/bin/env bash
# install url-porter - Chrome extension (https://github.com/synle/url-porter)

# Skip on lightweight mode
[ "$IS_LIGHT_WEIGHT_MODE" = "1" ] && { echo ">>> Skipped : Lightweight mode"; exit 0; }

# Skip on unsupported OS
[ "$is_os_android_termux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_android_termux"; exit 0; }
[ "$is_os_arch_linux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_arch_linux"; exit 0; }
[ "$is_os_chromeos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_chromeos"; exit 0; }
[ "$is_os_steamos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_steamos"; exit 0; }
[ "$is_os_mingw64" = "1" ] && { echo ">>> Skipped : Not supported on is_os_mingw64"; exit 0; }
[ "$is_os_redhat" = "1" ] && { echo ">>> Skipped : Not supported on is_os_redhat"; exit 0; }

target_dir="${HOME}/.sy_custom_tweaks/url-porter"
zip_url="https://github.com/synle/url-porter/raw/refs/heads/main/url-porter.zip"
tmp_zip="/tmp/url-porter.zip"

echo "> Installing url-porter"

# Force refresh: remove old install
if [ "$IS_FORCE_REFRESH" == "1" ] && [ -d "$target_dir" ]; then
    echo ">> Force refresh: deleting old url-porter files"
    rm -rf "$target_dir"
fi

# Skip if already installed
if [ -d "$target_dir" ]; then
    echo ">> Skipped url-porter: already installed at $target_dir"
    exit 0
fi

echo ">> Downloading: $zip_url"
mkdir -p "$target_dir"

# -s (silent), -L (follow redirects), -o (output file)
curl -sL "$zip_url" -o "$tmp_zip"
unzip -oq "$tmp_zip" -d "$target_dir"
rm -f "$tmp_zip"

echo "url-porter installed at $target_dir"

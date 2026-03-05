#!/usr/bin/env bash
# install sqlui-native - SQL client (https://github.com/synle/sqlui-native)

# Skip on lightweight mode
[ "$IS_LIGHT_WEIGHT_MODE" = "1" ] && { echo ">>> Skipped : Lightweight mode"; exit 0; }

# Skip on unsupported OS
[ "$is_os_android_termux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_android_termux"; exit 0; }
[ "$is_os_arch_linux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_arch_linux"; exit 0; }
[ "$is_os_chromeos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_chromeos"; exit 0; }
[ "$is_os_steamos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_steamos"; exit 0; }
[ "$is_os_mingw64" = "1" ] && { echo ">>> Skipped : Not supported on is_os_mingw64"; exit 0; }
[ "$is_os_redhat" = "1" ] && { echo ">>> Skipped : Not supported on is_os_redhat"; exit 0; }

# Fetch latest version from release manifest
version=$(curl -s "https://raw.githubusercontent.com/synle/sqlui-native/refs/heads/main/release.json" \
    | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>console.log(JSON.parse(b).version))")

echo "> Installing sqlui-native : $version"

# Determine platform-specific file name
base_url="https://github.com/synle/sqlui-native/releases/download/${version}"
target_dir="${HOME}/.sy_custom_tweaks/sqlui-native"

if [ "$is_os_windows" = "1" ]; then
    file="sqlui-native-${version}-x64.exe"
elif [ "$is_os_mac" = "1" ]; then
    file="sqlui-native-${version}-x64.dmg"
else
    file="sqlui-native-${version}.AppImage"
fi

url="${base_url}/${file}"

# Force refresh: remove old install
if [ "$IS_FORCE_REFRESH" == "1" ] && [ -d "$target_dir" ]; then
    echo ">> Force refresh: deleting old sqlui-native files"
    rm -rf "$target_dir"
fi

# Skip if already installed
if [ -d "$target_dir" ]; then
    echo ">> Skipped sqlui-native v${version}: already installed at $target_dir"
    exit 0
fi

echo ">> Downloading: $url"
mkdir -p "$target_dir"

pushd /tmp >/dev/null || exit
# -s (silent), -L (follow redirects), -O (save as remote name)
curl -sLO "$url"

# macOS Installation
if [ "$is_os_mac" = "1" ]; then
    # Mount the DMG and grab the full path to the volume
    mount_point=$(hdiutil attach "$file" -nobrowse | tail -1 | cut -f 3-)

    if [ -d "$mount_point" ]; then
        # Copy to Applications (Force overwrite if exists)
        cp -Rf "$mount_point/sqlui-native.app" /Applications/

        # Remove Apple's "Downloaded from Internet" quarantine bit
        xattr -cr /Applications/sqlui-native.app 2>/dev/null

        # Unmount and Cleanup
        hdiutil detach "$mount_point" -quiet
        rm "$file"
        echo "sqlui-native ${version} ($file) installed - macOS."
    else
        echo "Error: Failed to mount DMG."
    fi
else
    # Linux / Windows: move binary to target directory
    mv "$file" "$target_dir/"
    chmod +x "$target_dir/$file"
    echo "sqlui-native ${version} ($file) installed."
fi
popd >/dev/null || exit

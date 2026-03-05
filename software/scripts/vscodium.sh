#!/usr/bin/env bash

# Skip on lightweight mode
[ "$IS_LIGHT_WEIGHT_MODE" = "1" ] && { echo ">>> Skipped : Lightweight mode"; exit 0; }

# Skip on unsupported OS
[ "$is_os_android_termux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_android_termux"; exit 0; }
[ "$is_os_arch_linux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_arch_linux"; exit 0; }
[ "$is_os_chromeos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_chromeos"; exit 0; }
[ "$is_os_steamos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_steamos"; exit 0; }
[ "$is_os_mingw64" = "1" ] && { echo ">>> Skipped : Not supported on is_os_mingw64"; exit 0; }
[ "$is_os_redhat" = "1" ] && { echo ">>> Skipped : Not supported on is_os_redhat"; exit 0; }
[ "$is_os_ubuntu" = "1" ] && { echo ">>> Skipped : Installed via dependencies/ubuntu.sh"; exit 0; }
[ "$is_os_windows" = "1" ] && { echo ">>> Skipped : Not supported on is_os_windows"; exit 0; }

version=$(curl -s https://api.github.com/repos/VSCodium/vscodium/releases/latest \
    | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>console.log(JSON.parse(b).tag_name))")

echo "> Installing vscodium : $version"

# macOS Installation
if [ "${is_os_mac}" -eq 1 ]; then
    # Auto-detect architecture
    arch=$(uname -m)
    [ "$arch" == "x86_64" ] && arch="x64" || arch="arm64"

    file="VSCodium.${arch}.${version}.dmg"
    url="https://github.com/VSCodium/vscodium/releases/download/${version}/${file}"

    echo ">> osx: $url"

    pushd /tmp >/dev/null || exit
    # -s (silent), -L (follow redirects), -O (save as remote name)
    curl -sLO "$url"

    # Mount the DMG and grab the full path to the volume (handles spaces correctly)
    # The 'tail -1' ensures we get the actual mount point from the hdiutil output
    mount_point=$(hdiutil attach "$file" -nobrowse | tail -1 | cut -f 3-)

    if [ -d "$mount_point" ]; then
        # Copy to Applications (Force overwrite if exists)
        cp -Rf "$mount_point/VSCodium.app" /Applications/

        # Remove Apple's "Downloaded from Internet" quarantine bit
        xattr -dr com.apple.quarantine /Applications/VSCodium.app 2>/dev/null

        # Unmount and Cleanup
        hdiutil detach "$mount_point" -quiet
        rm "$file"
        echo "VSCodium ${version} ($file) installed - macOS."
    else
        echo "Error: Failed to mount DMG."
    fi
    popd >/dev/null || exit
fi

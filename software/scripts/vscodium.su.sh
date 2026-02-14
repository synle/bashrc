version="1.109.31074"

# Linux Installation
if [ "${is_os_ubuntu}" -eq 1 ] && [ "${is_os_window}" -eq 0 ]; then
    file="codium_${version}_amd64.deb"
    url="https://github.com/VSCodium/vscodium/releases/download/${version}/${file}"

    pushd /tmp >/dev/null || exit
    wget -q "$url" -O "$file"
    sudo dpkg -i "$file" >/dev/null 2>&1 || sudo apt -f install -y >/dev/null 2>&1
    popd >/dev/null || exit
    echo "VSCodium ${version} ($file) installed - Ubuntu."
fi

# macOS Installation
if [ "${is_os_darwin_mac}" -eq 1 ]; then
    # Auto-detect architecture
    arch=$(uname -m)
    [ "$arch" == "x86_64" ] && arch="x64" || arch="arm64"

    file="VSCodium.${arch}.${version}.dmg"
    url="https://github.com/VSCodium/vscodium/releases/download/${version}/${file}"

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

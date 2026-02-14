# Install VSCodium (only if running on Ubuntu and not Windows)
if [ "${is_os_ubuntu}" -eq 1 ] && [ "${is_os_window}" -eq 0 ]; then
  version="1.109.31074"
  file="codium_${version}_amd64.deb"
  url="https://github.com/VSCodium/vscodium/releases/download/${version}/${file}"

  pushd /tmp >/dev/null || exit
  echo "Installing VSCodium v${version}..."
  wget -q "$url" -O "$file"
  sudo dpkg -i "$file" >/dev/null 2>&1 || sudo apt -f install -y >/dev/null 2>&1
  popd >/dev/null || exit

  echo "VSCodium v${version} installed successfully."
fi

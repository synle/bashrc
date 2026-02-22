echo '>> Installing claude'
if ! command -v claude >/dev/null 2>&1; then
  echo '  >> Downloading and Installing'
  curl -fsSL https://claude.ai/install.sh | bash > /dev/null 2>&1

  sudo ln -sf $(which claude) /usr/local/bin/claude
fi

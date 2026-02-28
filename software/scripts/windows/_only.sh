touch ~/.hushlogin

# Clean up existing Zone.Identifier files from Windows mounts
find /mnt/c -name "*:Zone.Identifier" -delete 2>/dev/null

# Configure WSL to reduce Zone.Identifier file creation
WSL_CONF="/etc/wsl.conf"
if [ -f "$WSL_CONF" ]; then
  if ! grep -q "\[automount\]" "$WSL_CONF"; then
    sudo tee -a "$WSL_CONF" > /dev/null <<'EOF'

[automount]
options = "metadata,umask=022,fmask=011"
EOF
  fi
else
  sudo tee "$WSL_CONF" > /dev/null <<'EOF'
[automount]
options = "metadata,umask=022,fmask=011"
EOF
fi

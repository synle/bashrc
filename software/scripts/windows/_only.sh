echo '  >> Creating ~/.hushlogin'
touch ~/.hushlogin

echo '  >> Cleaning up junk files from Windows mounts (Zone.Identifier, .DS_Store, ._*) - background with 60s timeout'
(
  find /mnt/c -name "*:Zone.Identifier" -delete 2>/dev/null &
  find /mnt/c -name ".DS_Store" -delete 2>/dev/null &
  find /mnt/c -name "._*" -delete 2>/dev/null &
  wait
) &
_CLEANUP_PID=$!
( sleep 60 && kill $_CLEANUP_PID 2>/dev/null ) &

# Configure WSL to reduce Zone.Identifier file creation
WSL_CONF="/etc/wsl.conf"
echo "  >> Configuring WSL automount in $WSL_CONF"
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

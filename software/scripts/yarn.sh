#!/usr/bin/env bash

# Skip on unsupported OS
[ "$is_os_android_termux" = "1" ] && { echo "    >> Skipped : Not supported on is_os_android_termux"; exit 0; }
[ "$is_os_arch_linux" = "1" ] && { echo "    >> Skipped : Not supported on is_os_arch_linux"; exit 0; }
[ "$is_os_chromeos" = "1" ] && { echo "    >> Skipped : Not supported on is_os_chromeos"; exit 0; }

echo '    >> install yarn'
npm install --global yarn

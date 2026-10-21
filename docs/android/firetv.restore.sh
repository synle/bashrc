#!/usr/bin/env bash

# Fire TV Stick restore - restore all removed apps and settings.

echo "[1/2] Restoring removed apps..."
restore_all_apps

echo "[2/2] Restoring settings to defaults..."
restore_all_settings

echo ">>> Fire TV restore complete"

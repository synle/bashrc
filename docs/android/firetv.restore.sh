#!/usr/bin/env bash

# Fire TV Stick restore - restore all removed apps and reset settings.

echo "[1/2] Restoring removed apps..."
restore_all_apps

echo "[2/2] Resetting settings to defaults..."
restore_all_settings

echo ">>> Fire TV restore complete"

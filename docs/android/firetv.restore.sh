#!/usr/bin/env bash

# Fire TV Stick restore - restore all removed apps and reset settings.

echo "[1/2] Restoring removed apps..."
restore_all

echo "[2/2] Resetting settings to defaults..."
reset_all_settings

echo ">>> Fire TV restore complete"

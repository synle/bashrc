#!/usr/bin/env bash

# Fire TV Stick restore - restore all removed apps and settings.

printf '%s\n' "[1/2] Restoring removed apps..."
restore_all_apps

printf '%s\n' "[2/2] Restoring settings to defaults..."
restore_all_settings

printf '%s\n' ">>> Fire TV restore complete"

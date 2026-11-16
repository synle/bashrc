#!/usr/bin/env bash

# Samsung restore: reinstall all removed apps and restore settings to defaults.
printf '%s\n' "> Restoring all settings and apps to defaults..."
printf '%s\n' ">> debloat_settings..."
debloat_settings
printf '%s\n' ">> restore_all_settings..."
restore_all_settings
restore_app_collection "$DEBLOAT_SAFE" "DEBLOAT_SAFE"
restore_app_collection "$DEBLOAT_AGGRESSIVE" "DEBLOAT_AGGRESSIVE"

#!/usr/bin/env bash

# Samsung restore: reinstall all removed apps and reset settings to defaults.
echo "> Restoring all settings and apps to defaults..."
debloat_settings

echo "> Debloating..."
echo ">> reset_all_settings..."
reset_all_settings
echo ">> restore_app_collection > DEBLOAT_SAFE..."
restore_app_collection "$DEBLOAT_SAFE"
echo ">> restore_app_collection > DEBLOAT_AGGRESSIVE..."
restore_app_collection "$DEBLOAT_AGGRESSIVE"

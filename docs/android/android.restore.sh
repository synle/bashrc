#!/usr/bin/env bash

# Samsung restore: reinstall all removed apps and restore settings to defaults.
printf '%s\n' "> Restoring all settings and apps to defaults..."
debloat_settings

printf '%s\n' "> Debloating..."
printf '%s\n' ">> restore_all_settings..."
restore_all_settings
printf '%s\n' ">> restore_app_collection > DEBLOAT_SAFE..."
restore_app_collection "$DEBLOAT_SAFE"
printf '%s\n' ">> restore_app_collection > DEBLOAT_AGGRESSIVE..."
restore_app_collection "$DEBLOAT_AGGRESSIVE"

#!/usr/bin/env bash

# Samsung restore: reinstall all removed apps and restore settings to defaults.
_log_section "> Restoring all settings and apps to defaults..."
_log_section ">> debloat_settings..."
debloat_settings
_log_section ">> restore_all_settings..."
restore_all_settings
restore_app_collection "$DEBLOAT_SAFE" "DEBLOAT_SAFE"
restore_app_collection "$DEBLOAT_SEMI_AGGRESSIVE" "DEBLOAT_SEMI_AGGRESSIVE"
restore_app_collection "$DEBLOAT_AGGRESSIVE" "DEBLOAT_AGGRESSIVE"

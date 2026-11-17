#!/usr/bin/env bash

# Samsung debloat: remove bloatware apps and apply setting tweaks.
_log_section "> Debloating..."
_log_section ">> debloat_settings..."
debloat_settings
restore_app_collection "$DEBLOAT_IGNORED" "DEBLOAT_IGNORED"
remove_app_collection "$DEBLOAT_SAFE" "DEBLOAT_SAFE"
# remove_app_collection "$DEBLOAT_SEMI_AGGRESSIVE" "DEBLOAT_SEMI_AGGRESSIVE"
# remove_app_collection "$DEBLOAT_AGGRESSIVE" "DEBLOAT_AGGRESSIVE"

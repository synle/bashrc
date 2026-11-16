#!/usr/bin/env bash

# Samsung debloat: remove bloatware apps and apply setting tweaks.
printf '%s\n' "> Debloating..."
printf '%s\n' ">> debloat_settings..."
debloat_settings
restore_app_collection "$DEBLOAT_IGNORED" "DEBLOAT_IGNORED"
remove_app_collection "$DEBLOAT_SAFE" "DEBLOAT_SAFE"
# remove_app_collection "$DEBLOAT_AGGRESSIVE" "DEBLOAT_AGGRESSIVE"

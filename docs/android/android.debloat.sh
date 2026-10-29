#!/usr/bin/env bash

# Samsung debloat: remove bloatware apps and apply setting tweaks.
printf '%s\n' "> Debloating..."
printf '%s\n' ">> debloat_settings..."
debloat_settings
printf '%s\n' ">> restore_app_collection > DEBLOAT_IGNORED..."
restore_app_collection "$DEBLOAT_IGNORED"
printf '%s\n' ">> remove_app_collection > DEBLOAT_SAFE..."
remove_app_collection "$DEBLOAT_SAFE"
# echo ">> remove_app_collection > DEBLOAT_AGGRESSIVE..."
# remove_app_collection "$DEBLOAT_AGGRESSIVE"

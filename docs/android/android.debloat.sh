#!/usr/bin/env bash

# Samsung debloat: remove bloatware apps and apply setting tweaks.
echo "> Debloating..."
echo ">> debloat_settings..."
debloat_settings
echo ">> restore_app_collection > DEBLOAT_IGNORED..."
restore_app_collection "$DEBLOAT_IGNORED"
echo ">> remove_app_collection > DEBLOAT_SAFE..."
remove_app_collection "$DEBLOAT_SAFE"
# echo ">> remove_app_collection > DEBLOAT_AGGRESSIVE..."
# remove_app_collection "$DEBLOAT_AGGRESSIVE"

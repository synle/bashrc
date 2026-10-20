#!/usr/bin/env bash

# Fire TV Stick debloat - remove bloatware and apply settings.

echo ">> Stripping out pre-installed Amazon bloatware & telemetry..."
remove_app_collection "$FIRE_TV_DEBLOAT_SAFE"

echo ">> Applying Fire TV settings..."
debloat_settings

echo ">> Bootstrapping and Installing apps..."
install_apps

echo ">>> Fire TV debloat complete"

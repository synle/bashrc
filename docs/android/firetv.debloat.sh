#!/usr/bin/env bash

# Fire TV Stick debloat - remove bloatware and apply settings.
_log_section ">> Stripping out pre-installed Amazon bloatware & telemetry..."
remove_app_collection "$FIRE_TV_DEBLOAT_SAFE" "FIRE_TV_DEBLOAT_SAFE"
_log_section ">> Applying Fire TV settings..."
debloat_settings
_log_section ">> Bootstrapping and Installing apps..."
install_apps
_log_success ">>> Fire TV debloat complete"

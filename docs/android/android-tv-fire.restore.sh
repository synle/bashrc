#!/usr/bin/env bash

# Fire TV Stick restore - restore all removed apps and settings.
_log_section "[1/2] Restoring removed apps..."
restore_all_apps
_log_section "[2/2] Restoring settings to defaults..."
restore_all_settings
_log_success ">>> Fire TV restore complete"

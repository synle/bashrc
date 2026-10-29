#!/usr/bin/env bash

# Fire TV Stick debloat - remove bloatware and apply settings.

    printf '%s\n' \
      ' ">> Stripping out pre-installed Amazon b' \
      'loatware & telemetry...'

remove_app_collection "$FIRE_TV_DEBLOAT_SAFE"

    printf '%s\n' ' ">> Applying Fire TV settings...'

debloat_settings

    printf '%s\n' ' ">> Bootstrapping and Installing apps...'

install_apps

    printf '%s\n' ' ">>> Fire TV debloat complete'


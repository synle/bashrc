#!/usr/bin/env bash

# Fire TV Stick debloat - remove bloatware and apply settings.

echo "[1/4] Stripping out pre-installed Amazon bloatware & telemetry..."
remove_app_collection "$FIRE_TV_DEBLOAT_SAFE"

echo "[2/4] Disabling system telemetry and tracking flags..."
put_setting secure collection_info_enabled 0
put_setting secure privacy_metrics_collection_enabled 0
put_setting global device_provisioned 1
put_setting global analytics_enabled 0
put_setting global usage_reporting_enabled 0
put_setting global send_action_app_error 0
put_setting global ad_id_opt_out 1

echo "[3/4] Disabling system animations for instant UI responsiveness..."
put_setting global window_animation_scale 0.0
put_setting global transition_animation_scale 0.0
put_setting global animator_duration_scale 0.0

echo "[4/4] Disabling Wi-Fi and Bluetooth scanning..."
put_setting global wifi_scan_always_enabled 0
put_setting global ble_scan_always_enabled 0

echo ">>> Fire TV debloat complete"

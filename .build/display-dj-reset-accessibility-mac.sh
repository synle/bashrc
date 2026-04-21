# NOTE: STOP - do not edit by hand - this file is auto-generated [2026-04-21]
# 
# Reset macOS Accessibility permissions for Display DJ
# ################################################################################

#!/usr/bin/env bash
# Resets macOS accessibility permissions for Display DJ.
# After running, re-grant accessibility access in System Settings > Privacy & Security > Accessibility.

tccutil reset Accessibility com.synle.display-dj
echo "Accessibility permissions reset for com.synle.display-dj"
echo "Re-grant access in: System Settings > Privacy & Security > Accessibility"
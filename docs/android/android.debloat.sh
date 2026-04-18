#!/usr/bin/env bash

# Samsung debloat: remove bloatware apps and apply setting tweaks.
echo "> Debloating..."
echo ">> debloat_settings..."
debloat_settings
echo ">> remove_app_collection > DEBLOAT_SAFE..."
remove_app_collection "$DEBLOAT_SAFE"
# echo ">> remove_app_collection > DEBLOAT_AGGRESSIVE..."
# remove_app_collection "$DEBLOAT_AGGRESSIVE"

echo ">> Restoring previously debloated apps..."
restore_app com.samsung.android.app.sharelive  # Quick Share tile

echo ">> Disabling Samsung Dialer / Contacts to use Google Phone / Contacts..."
disable_app com.samsung.android.dialer              # Samsung Dialer - use Google Phone instead
disable_app com.samsung.android.contacts            # Samsung Contacts - use Google Contacts instead
disable_app com.samsung.android.incallui            # Samsung In-Call UI - use Google Phone in-call screen instead
disable_app com.samsung.android.service.peoplestripe # Samsung People / Smart Call - spam blocking service tied to Samsung Dialer

# echo ">> Restoring Samsung Dialer / Contacts..."
# restore_app com.samsung.android.dialer              # Samsung Dialer
# restore_app com.samsung.android.contacts            # Samsung Contacts
# restore_app com.samsung.android.incallui            # Samsung In-Call UI
# restore_app com.samsung.android.service.peoplestripe # Samsung People / Smart Call

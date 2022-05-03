curl -s https://raw.githubusercontent.com/synle/bashrc/master/android/core-android.sh | sh

function removeApp(){
  echo "> Remove: " $@
  pm uninstall -k --user 0 $@ || pm uninstall -k --user 10 $@
}

#
removeApp com.facebook.appmanager
removeApp com.facebook.services
removeApp com.facebook.system
removeApp com.google.android.apps.googleassistant
removeApp com.google.android.apps.magazines
removeApp com.google.android.apps.maps # Google Maps
removeApp com.google.android.apps.nbu.files
removeApp com.google.android.apps.photos # Google Photos
removeApp com.google.android.apps.podcasts
removeApp com.google.android.apps.subscriptions.red
removeApp com.google.android.apps.tachyon # Google Duo
removeApp com.google.android.apps.walletnfcrel # Google Wallet
removeApp com.google.android.apps.wellbeing # Digital Wellbeing
removeApp com.google.android.apps.youtube.music
removeApp com.google.android.calendar # Gooogle Calendar
removeApp com.google.android.documentsui # Files 9
removeApp com.google.android.feedback
removeApp com.google.android.gm # Gmail
removeApp com.google.android.googlequicksearchbox # Search Widget
removeApp com.google.android.marvin.talkback # Talkback
removeApp com.google.android.music # Google Play Music
removeApp com.google.android.onetimeinitializer
removeApp com.google.android.printservice.recommendation # Mobile printing service
removeApp com.google.android.projection.gearhead
removeApp com.google.android.videos # Google Play Movies & TV
removeApp com.google.android.youtube # YouTube
removeApp com.google.ar.core # AR Core
removeApp com.heytap.cloud
removeApp com.heytap.mcs
removeApp com.heytap.openid
removeApp com.instagram.android
removeApp com.netflix.mediaclient
removeApp com.netflix.partner.activation
removeApp com.oneplus.backuprestore
removeApp com.oneplus.calculator
removeApp com.oneplus.contacts # Oneplus Contact
removeApp com.oneplus.deskclock
removeApp com.oneplus.note
removeApp com.tmobile.m1
removeApp com.tmobile.pr.mytmobile # my tmobile
removeApp net.oneplus.forums

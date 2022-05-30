function removeApp(){
  echo "> Remove: " $@
  pm uninstall $@ || pm uninstall -k --user 0 $@ || pm uninstall -k --user 10 $@
}

removeApp air.com.vudu.air.DownloaderTablet
removeApp com.google.android.play.games
removeApp com.google.android.youtube.tv
removeApp com.google.android.youtube.tvkids
removeApp com.google.android.youtube.tvmusic
removeApp com.pandora.android.atv
removeApp com.seraphic.browser

function removeApp(){
  echo "> Remove: " $@
  pm uninstall $@ || pm uninstall $@ || pm uninstall -k --user 0 $@ || pm uninstall -k --user 10 $@
}

removeApp air.com.vudu.air.DownloaderTablet
removeApp air.ITVMobilePlayer
removeApp com.amazon.music.tv
removeApp com.google.android.play.games
removeApp com.google.android.videos
removeApp com.google.android.youtube.tv
removeApp com.google.android.youtube.tvkids
removeApp com.google.android.youtube.tvmusic
removeApp com.imdbtv.livingroom
removeApp com.nvidia.bbciplayer
removeApp com.nvidia.bbciplayer.launch
removeApp com.nvidia.bbciplayer.launchsport
removeApp com.nvidia.benchmarkblocker
removeApp com.pandora.android.atv
removeApp com.seraphic.browser
removeApp com.zattoo.player

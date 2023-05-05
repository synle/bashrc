function removeApp(){
  echo 'pm uninstall -k --user 0' $@
  pm uninstall -k --user 0 $@
}

function changeSetting(){
  echo 'settings put' $@
  settings put $@
}

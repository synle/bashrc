# use the one from s21 as the base and add more stuffs on top
curl -s "https://github.com/synle/bashrc/blob/master/android/Samsung S21 Ultra.sh" | sh

function removeApp(){
  echo "> Remove: " $@
  pm uninstall $@ || pm uninstall -k --user 0 $@ || pm uninstall -k --user 10 $@
}

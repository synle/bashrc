open(){
  echo "open $@"
  pwd
  explorer.exe "$@"
}

cmd(){
  cmd.exe '/C' "$@"
}

alias adb='adb.exe'
alias fastboot='fastboot.exe'
alias update='sudo apt-get update -y && sudo apt-get upgrade -y && sudo apt-get autoclean && sudo apt-get clean && sudo apt-get autoremove -y && refresh'
alias docker='docker.exe'

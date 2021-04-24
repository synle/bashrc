#! /bin/sh
export EDITOR='vim'

export BASH_PATH=~/.bashrc

# os flags
export is_os_android_termux=0 && [ -d /data/data/com.termux ] && export is_os_android_termux=1
export is_os_darwin_mac=0 && [ -d /Applications ] && export is_os_darwin_mac=1
export is_os_window=0 && [ -d /mnt/c/Users ] && export is_os_window=1
export is_os_mingw64=0 && [ -d /mingw64 ] && export is_os_mingw64=1
export is_os_wsl=0 && [ -d /lib ] && [ -d /mnt/c/Users ] && export is_os_wsl=1
export is_os_ubuntu=0 && apt-get -v &> /dev/null && export is_os_ubuntu=1
# export is_os_redhat=0 && yum -v &> /dev/null && export is_os_redhat=1 # not used anymore
# end os flag

##########################################################
#############  SECTION BREAK
##########################################################

#used to refresh
alias bashrcRefresh='. /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-full.sh?$(date +%s))"'
alias refreshBashrc='bashrcRefresh'

##########################################################
# common aliases
##########################################################
alias ..="cd .."
alias v="vim"
alias l="ls -a"
alias ls="ls -1"
alias ll="ls -la"
alias merge="git fetch --all --prune && git merge"
alias mergeMaster="merge origin/master"
alias g=git
alias s='ssh -4'
alias distroName='python -c "import platform; print platform.linux_distribution()';
alias mk='make'

br(){
  clear &&  echo $'\e[32m======================================================\e[m' && echo '''
  '''
}

isCommandExists(){
  type "$1" &> /dev/null ;
}

renpm(){
  rm -rf node_modules bower_components /tmp/*.cache;
  npm install
}

tree(){
  find . -type d | sed -e "s/[^-][^\/]*\//  |/g" -e "s/|\([^ ]\)/|-\1/"
}

# get current git branch name
getCurrentGitBranch(){
  git name-rev --name-only HEAD
}

getCurrentGitRepo(){
  basename `git rev-parse --show-toplevel`
}

# set current upstream ref
setGitUpstreamBranch(){
  git branch -u origin/$(git name-rev --name-only HEAD)
}

removeDuplicateLines(){
  perl -ne 'print unless $dup{$_}++;' $@
}

searchText(){
  echo """
Searching:  $@
######################################################
  """

  #universal option
  grep -r "$@" \
    --include=*.js \
    --include=*.jsx \
    --include=*.ts \
    --include=*.tsx \
    --include=*.json \
    --include=*.html \
    --include=*.scss \
    --include=*.css \
    --include=*.less \
    --include=*.java \
    --include=*.json \
    --include=*.xml \
    --include=*.yml \
  . | filterUnwanted
}

searchFile(){
  find . -type f -iname "*$@*" | filterUnwantedLight | grep --color -i "$@"
}

searchDirWithGit(){
  find ${1:-.} -path '*/\.*' -prune \
  -o -type d -print 2> /dev/null
  echo ".." # append parent folder
}

searchDir(){
  find . -type d -iname "*$@*" | filterUnwantedLight | grep --color -i "$@"
}

searchFileWithGit(){
  # use either ls tree or find
  git ls-tree -r --name-only HEAD 2> /dev/null || \
  find . -type f 2>/dev/null \
  | uniq
}

alias search='searchText'
alias searchFiles='searchFile'

filterUnwantedLight(){
  grep -v .DS_Store \
  | grep -v .dll \
  | grep -v .git \
  | grep -v node_modules \
  | grep -v .so \
  | grep -v npm-debug.log \
  | grep -v .pid \
  | grep -v .pid.lock \
  | uniq
}
alias filterUnwanted='filterUnwantedLight'

# calculate chmod
chmodCalculator(){
  node -e """
    console.log('Chmod Calculator - Enter permission for x w r:');
    var stdin = process.openStdin();
    stdin.addListener('data', (d) => {
      console.log('Value:', _getValue((d).toString().toLowerCase().trim()))
      process.exit();
    });
    const _getValue = (str) => {
      if(str.length === 0 || str.length > 3){
        return 'Invalid';
      }

      return [...str].reduce((val, c) => {
        if(c === 'x'){ val += 1; }
        if(c === 'w'){ val += 2; }
        if(c === 'r'){ val += 4; }
        return val;
      }, 0)
    };
  """
}
alias calcChmod='chmodCalculator'

##########################################################
# fzf lightweight aliases and function
##########################################################
# all the view file aliases
alias fv=fuzzyVim
alias fview=fuzzyViewFile

# other fzf aliases
alias fcd=fuzzyDirectory

# simple view file alias - will be overriden by advanced bash
viewFile(){
  vim "$@"
}

fuzzyVim(){
  local OUT=$( \
    searchFileWithGit | \
    filterUnwanted | \
    fzf \
  )

  if [ -n "$OUT" ]; then
    echo """
vim \"$OUT\"
    """
    vim "$OUT"
  fi
}

fuzzyViewFile(){
  local OUT=$( \
    searchFileWithGit | \
    filterUnwanted | \
    fzf \
  )

  if [ -n "$OUT" ]; then
    echo """
viewFile \"$OUT\"
    """
    viewFile "$OUT"
  fi
}

# cdf - cd into the directory of the selected file
fuzzyDirectory(){
  local OUT=$( \
    searchDirWithGit | \
    filterUnwanted | \
    fzf +m \
  );

  if [ -n "$OUT" ]; then
    echo """
PWD: $PWD
New_Dir: \"$OUT\"
    """
    cd "$OUT"
  fi
}


##########################################################
# prompt
##########################################################
#bash prompt
export PS1="
\[\e[31m\]====\[\e[m\]
\[\e[33m\]\`date\`\[\e[m\] \[\e[36m\]\u\[\e[m\] @ \[\e[32m\]\h\[\e[m\]
\[\e[33m\]\`pwd\`\[\e[m\]
\[\e[33m\]>\[\e[m\]\[\e[31m\]>\[\e[m\]\[\e[36m\]>\[\e[m\] "

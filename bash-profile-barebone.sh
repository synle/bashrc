#! /bin/sh
export EDITOR='vim'

export BASH_PATH=~/.bashrc

# os flags
if [ -f ~/.bash_syle_os ]; then
  . /dev/stdin <<< "$(cat ~/.bash_syle_os)"
else
  export is_os_darwin_mac=0 && [ -d /Applications ] && export is_os_darwin_mac=1
  export is_os_window=0 && [ -d /mnt/c/Users ] && export is_os_window=1
  export is_os_ubuntu=0 && apt-get -v &> /dev/null && export is_os_ubuntu=1
  export is_os_chromeos=0
  export is_os_wsl=0 && [ -d /lib ] && [ -d /mnt/c/Users ] && export is_os_wsl=1
  export is_os_mingw64=0 && [ -d /mingw64 ] && export is_os_mingw64=1
  export is_os_android_termux=0 && [ -d /data/data/com.termux ] && export is_os_android_termux=1
  export is_os_redhat=0 && yum -v &> /dev/null && export is_os_redhat=1 # not used anymore

  echo """
    export is_os_darwin_mac='$is_os_darwin_mac'
    export is_os_window='$is_os_window'
    export is_os_ubuntu='$is_os_ubuntu'
    export is_os_chromeos='$is_os_chromeos'
    export is_os_wsl='$is_os_wsl'
    export is_os_mingw64='$is_os_mingw64'
    export is_os_android_termux='$is_os_android_termux'
    export is_os_redhat='$is_os_redhat'
  """ > ~/.bash_syle_os
fi
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
alias vi="vim"
alias l="ls -a"
alias ls="ls -1"
alias ll="ls -la"
alias merge="git fetch --all --prune && git merge"
alias mergeMaster="merge origin/master"
alias g=git
alias s='ssh -4'
alias distroName='python -c "import platform; print platform.linux_distribution()"';
alias mk='make'
alias npm-run='npm run'
alias setWorkEmail='git config user.email $WORK_EMAIL_ADDRESS'
alias gulp="./node_modules/.bin/gulp"
alias grunt="./node_modules/.bin/grunt"

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
    --exclude-dir={node_modules,.git} \
  .
}

searchCode(){
  echo """
Searching:  $@
#############################################################
  """

  #universal option
  grep -r -o -n "$@" \
    --include=*.{*.hbs,*.jsx,*.js,*.tsx,*.ts,*.css,*.scss,*.less,*.scala,*.html,*.java,*.py} \
    --exclude=*.{png,jpg,.gitignore,.DS_Store} \
    --exclude-dir={node_modules,.git} \
  .
}

searchFile(){
  find . -type f -iname "*$@*" | filterUnwantedLight | grep --color -i "$@"
}

searchFileWithGit(){
  # use either ls tree or find
  git ls-tree -r --name-only HEAD 2> /dev/null || \
  find . -type f 2>/dev/null \
  | uniq
}

searchDirWithGit(){
  find ${1:-.} -path '*/\.*' -prune \
  -o -type d -print 2> /dev/null
  echo ".." # append parent folder
}

searchDir(){
  find . -type d -iname "*$@*" | filterUnwantedLight | grep --color -i "$@"
}

function cleanmaster(){
  git stash
  git fap
  git checkout test
  git checkout -b test
  git del master
  git checkout --track origin/master
  git checkout --track origin/main
}

alias search='searchText'

filterUnwantedLight(){
  grep -v "\.DS_Store" \
  | grep -v "\.git/" \
  | grep -v "node_modules" \
  | uniq
}
filterTextFilesOnly(){
  filterUnwantedLight \
  | grep -v "\.jpeg" \
  | grep -v "\.jpg" \
  | grep -v "\.png" \
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
alias fvim=fuzzyVim
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
    filterTextFilesOnly | \
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
    filterTextFilesOnly | \
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

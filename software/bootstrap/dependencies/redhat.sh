# software/bootstrap/dependencies/redhat.sh
# RedHat / Fedora / CentOS / Rocky / Alma dependencies - dnf/yum packages

if [ "$is_os_redhat" = "1" ]; then
  echo ">> Begin setting up dependencies/redhat.sh"
  sudo -v

  ################################################################################
  # ---- Install Packages ----
  ################################################################################
  echo '>> Installing packages with dnf/yum'
  function installDnfPackage() {
    echo -n ">> $@ >> Installing with dnf/yum >> "
    if rpm -q "$1" &>/dev/null; then
      echo "Skipped"
    elif sudo dnf install -y $@ &> /dev/null || sudo yum install -y $@ &> /dev/null; then
      echo "Success"
    else
      echo "Error"
    fi
  }

  # ---- Core tools ----
  installDnfPackage curl
  installDnfPackage git
  installDnfPackage make
  installDnfPackage python3
  installDnfPackage vim

  # ---- CLI utilities ----
  installDnfPackage bat
  installDnfPackage fzf
  installDnfPackage ripgrep
  installDnfPackage pv
  installDnfPackage entr
  installDnfPackage tmux
  installDnfPackage jq
  installDnfPackage yq
  installDnfPackage git-delta
  installDnfPackage zoxide
  installDnfPackage eza
  installDnfPackage fd-find
  installDnfPackage tree
  installDnfPackage prettyping

  # ---- Dev tools / Build ----
  installDnfPackage gradle
  installDnfPackage rust
  installDnfPackage golang
  installDnfPackage java-latest-openjdk
  installDnfPackage unzip
  installDnfPackage gnupg2

  # ---- Git extensions ----
  installDnfPackage gh
  installDnfPackage git-lfs

  # ---- OS-specific ----
  installDnfPackage openssh-server
  installDnfPackage xz

else
  echo ">> Skipped dependencies/redhat.sh"
fi

#! /bin/sh
# cat setup-hosts.sh | node
{ \
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/software/base-node-script.js && \
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/software/scripts/ssh-and-etc-hosts.su.js ;
} | node

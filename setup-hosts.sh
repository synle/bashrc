#! /bin/sh
# cat setup-hosts.sh | node
{ \
  curl -s $SY_REPO_PREFIX/software/base-node-script.js && \
  curl -s $SY_REPO_PREFIX/software/scripts/etc-hosts.su.js ;
} | node

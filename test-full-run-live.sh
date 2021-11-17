#! /bin/sh
{ \
  curl -s $SY_REPO_PREFIX/software/base-node-script.js && \
  curl -s $SY_REPO_PREFIX/software/index.sh.js ;
} | node | bash

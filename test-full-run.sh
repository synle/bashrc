#! /bin/sh
{ \
  cat software/base-node-script.js && \
  cat software/index.sh.js;
} | node | bash

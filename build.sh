#! /bin/sh
echo '>> Build Assets - Host Mappings'
{ \
  cat software/base-node-script.js && \
  cat software/metadata/blocked-hosts.config.js ;
} | node

echo '>> Generate Script List Indexes'
{ \
  cat software/base-node-script.js && \
  cat software/metadata/script-list.config.js ; \
} | node

echo '>> DONE Building'

#! /bin/sh
echo '>> Format code'
npx prettier --parser babel --write \
  **/*.js \
  **/**/*.js \
  **/**/**/*.js \
&& echo '>> DONE Formatting JS Scripts'

echo '>> Build Assets - Host Mappings'
{ \
  cat software/base-node-script.js && \
  cat software/scripts/etc-hosts.blocked-hosts.config.js ;
} | node

echo '>> DONE Building'

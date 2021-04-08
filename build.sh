#! /bin/sh
echo '>> Format code'
npx prettier --parser babel --write \
  **/*.js \
  **/**/*.js \
  **/**/**/*.js \
  **/*.node \
  **/**/*.node \
  **/**/**/*.node \
&& echo '>> DONE Formatting JS Scripts'

echo '>> Build Assets - Host Mappings'
cat software/scripts/etc-hosts.blocked-hosts.config.js | node


echo '>> DONE Building'

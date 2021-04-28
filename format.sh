#! /bin/sh
echo '>> Format code'
npx prettier --parser babel --write \
  **/*.js \
  **/**/*.js \
  **/**/**/*.js \
&& echo '>> DONE Formatting JS Scripts'















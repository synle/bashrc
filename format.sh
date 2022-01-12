#! /bin/sh
echo '>> Format code'
npx prettier --write \
  **/**/**/**/*.{css,js,html,md,json} \
&& echo '>> DONE Formatting JS Scripts'

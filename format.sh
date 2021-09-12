#! /bin/sh
echo '>> Format code'
npx prettier --write \
  **/**/**/**/*.{js,html,md,json} \
&& echo '>> DONE Formatting JS Scripts'















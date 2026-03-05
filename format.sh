#!/usr/bin/env bash
{
  echo '< format.sh'

  ##########################################################
  # step: build-include - Update files with BEGIN/END block inclusions
  ##########################################################
  echo '> Running build-include substitutions'
  node software/build-include.cjs

  ##########################################################
  # step: script-indexes - Generate Script List Indexes
  ##########################################################
  echo '> Generate Script List Indexes'
  SCRIPT_INDEX_CONFIG_FILE="software/metadata/script-list.config"
  find software -type f \( -name "*.js" -o -name "*.sh" \) \
    -not -path "*/node_modules/*" \
    -not -path "*/.build/*" \
    -not -name "*.cjs" \
    -not -name "*.d.ts" \
    | sort > "$SCRIPT_INDEX_CONFIG_FILE"
  echo ">> Written $(wc -l < "$SCRIPT_INDEX_CONFIG_FILE" | xargs) files to $SCRIPT_INDEX_CONFIG_FILE"

  ##########################################################
  # step: jsdocs - Build JSDocs for JS Code
  ##########################################################
  echo '> Build JSDocs for JS Code'
  # Generate .d.ts for index.js: preprocess to strip require() calls, then run tsc
  node -e '
  const fs = require("fs");
  let src = fs.readFileSync("software/index.js", "utf8");
  src = src.replace(/^const (\w+) = require\("(\w+)"\);$/gm, (_, n, m) =>
    `/** @type {typeof import("${m}")} */\nconst ${n} = /** @type {any} */ (null);`);
  src = src.replace(/^const (\w+) = require\("[^"]+"\)\.\w+\(\);?$/gm, (_, n) =>
    `const ${n} = "";`);
  src = src.replace(/require\("[^"]+"\)/g, "({})");
  fs.writeFileSync("/tmp/_index-for-tsc.js", src);
  '
  npx tsc /tmp/_index-for-tsc.js --declaration --allowJs --emitDeclarationOnly \
    --outDir /tmp/_dts-out --lib esnext --skipLibCheck --target esnext
  cp /tmp/_dts-out/_index-for-tsc.d.ts software/types/index.d.ts
  rm -rf /tmp/_index-for-tsc.js /tmp/_dts-out

  # Generate .d.ts for common.cjs: strip require() and module.exports, then run tsc
  node -e '
  const fs = require("fs");
  let src = fs.readFileSync("software/common.cjs", "utf8");
  src = src.replace(/^const (\w+) = require\("(\w+)"\);$/gm, (_, n, m) =>
    `/** @type {typeof import("${m}")} */\nconst ${n} = /** @type {any} */ (null);`);
  src = src.replace(/^module\.exports\s*=\s*\{[\s\S]*\};?\s*$/m, "");
  src = src.replace(/^if\s*\(typeof module\b[\s\S]*$/m, "");
  fs.writeFileSync("/tmp/_common-for-tsc.js", src);
  '
  npx tsc /tmp/_common-for-tsc.js --declaration --allowJs --emitDeclarationOnly \
    --outDir /tmp/_dts-out --lib esnext --skipLibCheck --target esnext
  cp /tmp/_dts-out/_common-for-tsc.d.ts software/types/common.d.ts
  rm -rf /tmp/_common-for-tsc.js /tmp/_dts-out

  FORMAT_SCRIPT_URL=https://raw.githubusercontent.com/synle/gha-workflows/refs/heads/main/format.sh
  echo ">> formatting script: $FORMAT_SCRIPT_URL"
  curl -s "$FORMAT_SCRIPT_URL" | bash - > /dev/null 2>&1

  exit
}

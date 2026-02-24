#! /bin/sh

if [ "$CI" = "true" ]; then
    echo() {
        local input="$*"

        # 1. Quick check: Does it start with > or <?
        case "$input" in
            ">"* | "<"*)
                # Close previous group
                command echo "::endgroup::"

                local icons=""
                local remainder="$input"

                # 2. Extract leading > signs
                while :; do
                    case "$remainder" in
                        ">"*)
                            icons="${icons}🚀"
                            remainder="${remainder#?}" # Remove first char
                            ;;
                        *) break ;;
                    esac
                done

                # 3. Extract leading < signs
                while :; do
                    case "$remainder" in
                        "<"*)
                            icons="${icons}⭐"
                            remainder="${remainder#?}" # Remove first char
                            ;;
                        *) break ;;
                    esac
                done

                # 4. Output the group
                command echo "::group::${icons}${remainder}"
                ;;
            *)
                # Normal output for everything else
                command echo "$@"
                ;;
        esac
    }
fi

echo '< build.sh'

##########################################################
# Build JSDocs for JS Code
##########################################################
echo '> Build JSDocs for JS Code'
node -e """
const fs = require('fs');
const path = require('path');

const scriptsDir = 'software';
const baseScript = 'software/base-node-script.js'

function getJsFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...getJsFiles(full));
    else if (entry.name.endsWith('.js')) results.push(full);
  }
  return results;
}

for (const file of getJsFiles(scriptsDir)) {
  const relPath = path.relative(path.dirname(file), baseScript);
  const refTag = '/// <reference path=\"' + relPath + '\" />';

  let content = fs.readFileSync(file, 'utf8');

  // remove existing reference tag line
  content = content.replace(/^\/\/\/\s*<reference[^\n]*\n/, '');

  // strip blank lines
  content = content.trim();

  fs.writeFileSync(file, refTag + '\n\n' + content);
  console.log('>> prepended reference tag to', file);
}
"""


##########################################################
# Generate Script List Indexes
##########################################################
echo '> Generate Script List Indexes'
export SCRIPT_INDEX_CONFIG_FILE="software/metadata/script-list.config" && \
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/run.sh | bash -s -- --prod --files="software/metadata/script-list.config.js"
cat $SCRIPT_INDEX_CONFIG_FILE
export SHOULD_PRINT_OS_FLAGS='false'; # only print this flag the first time

##########################################################
# Prebuild Host Mappings
##########################################################
echo '> Prebuilding Host Mappings'
curl -s https://raw.githubusercontent.com/synle/bashrc/master/run.sh | bash -s -- --prod --files="software/metadata/ip-address.config.js"

##########################################################
# Build Raw JSON and Config Artifacts
# Compile common configs used for sublime and vscode keybindings.
# Only process files containing the method "writeToBuildFile".
##########################################################
echo '> Build raw JSON and raw JSON configs'
CONFIG_BUILD_PATH="./.build"
mkdir -p $CONFIG_BUILD_PATH
export DEBUG_WRITE_TO_DIR="$CONFIG_BUILD_PATH" && \
sh run.sh --files="$(grep -R -l 'writeToBuildFile' 'software/' | grep -v 'index.js')"
echo '>> Built Configs:'
find $CONFIG_BUILD_PATH

##########################################################
# Build Host Mappings (skip in CI)
##########################################################
if [ "$CI" != "true" ]; then

  echo '> Build Host Mappings'
  export DEBUG_WRITE_TO_DIR="" && \
    curl -s https://raw.githubusercontent.com/synle/bashrc/master/run.sh | bash -s -- --prod --files="software/metadata/hosts-blocked-ads.config.js"

fi

##########################################################
# Backup XFCE Configuration (if applicable)
##########################################################
if [ -d "$HOME/.config/xfce4" ]; then
  echo "Backing up XFCE configuration..."
  mkdir -p ./linux
  tar -czf ./linux/xfce-config.tar.gz \
    -C "$HOME/.config" xfce4
  echo "Backup complete: ./linux/xfce-config.tar.gz"
else
  echo "No XFCE configuration found. Skipping backup."
fi

##########################################################
# Build Web App
##########################################################
echo '> Building webapp'
echo '>> Installing npm dependencies'
npm install
echo '>> Building webapp with Vite'
npm run build
echo '>> Built webapp artifacts:'
find dist

echo '> DONE Building'


##########################################################
# Update README.md Install Command from bootstrap/setup.sh
##########################################################
echo '> Updating README.md install command from bootstrap/setup.sh'
node -e """
const fs = require('fs');

const setupContent = fs.readFileSync('bootstrap/setup.sh', 'utf8');
const commandLines = setupContent
  .split('\n')
  .filter(line => !line.startsWith('#') && line.trim() !== '')
  .join('\n')
  .trim();

const installSection = [
  '## Installation',
  '',
  'Run this on full system (e.g., macOS, Ubuntu, or Windows Subsystem for Linux):',
  '',
  '\`\`\`bash',
  commandLines,
  '\`\`\`',
].join('\n');

const readme = fs.readFileSync('README.md', 'utf8');
const replaced = readme.replace(
  /## Installation[\s\S]*?(?=\n## )/,
  installSection + '\n\n'
);

if (replaced !== readme) {
  fs.writeFileSync('README.md', replaced);
  console.log('>> Updated README.md install command');
} else {
  console.log('>> No changes needed in README.md');
}
"""

echo '> DONE Building'

let idx = Date.now();
const configs = [
  {
    text: 'Setup Dependencies',
    script: `<OS_FLAGS> . /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-dependencies.sh)"`,
    shouldShowOsSelectionInput: true,
  },
  {
    text: 'Setup Full Profile',
    script: `<OS_FLAGS> . /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-full.sh?$(date +%s))"`,
    checked: true,
    shouldShowOsSelectionInput: true,
  },
  {
    text: 'Setup Lightweight Profile',
    script: `. /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-lightweight.sh?$(date +%s))"`,
  },
  {
    text: 'Setup etc Hosts',
    script: `curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-hosts.sh | sudo -E bash`,
  },
  {
    text: 'Test Full Run live',
    script: `curl -s https://raw.githubusercontent.com/synle/bashrc/master/test-full-run-live.sh | bash`,
    shouldShowOsSelectionInput: true,
  },
  {
    text: 'Test Single Script',
    script: `<OS_FLAGS>\\\nexport TEST_SCRIPT_FILES="""\n<SELECT_SCRIPTS>\n""" <DEBUG_WRITE_TO_DIR> && \\\n\\\n curl -s https://raw.githubusercontent.com/synle/bashrc/master/<SELECTED_RUNNER_SCRIPT> | bash`,
    shouldShowScriptNameInput: true,
    shouldShowOsSelectionInput: true,
  },
].map((config) => ({
  idx: `command-option-${++idx}`,
  ...config,
}));

const configsByKey = {};
for (const config of configs) {
  configsByKey[config.idx] = config;
}

async function init() {
  // available scripts
  let scriptToRunOptions = await fetch(`https://raw.githubusercontent.com/synle/bashrc/master/software/metadata/script-list.config`).then(
    (res) => res.text(),
  );
  scriptToRunOptions = scriptToRunOptions
    .split('\n')
    .map((s) => s.replace('./', '').trim())
    .filter((s) => !!s && (s.includes('.js') || s.includes('.sh')))
    .sort()
    .map((scriptName) => `<option>${scriptName}</option>`)
    .join('\n');
  document.querySelector('#scriptToRunOptions').innerHTML = scriptToRunOptions;

  // back it up
  window.SCRIPT_TO_RUN_OPTIONS = document.querySelector('#scriptToRunOptions').innerHTML;

  for (const config of configs) {
    const domCommand = document.createElement('div');
    domCommand.innerHTML = `
          <input onchange='updateScript()' type='radio' name='choice-setup' id='${config.idx}' value='${config.idx}' ${
      config.checked ? 'checked' : ''
    } />
          <label for='${config.idx}'>${config.text}</label>
        `;
    document.querySelector('#commands').appendChild(domCommand);
  }

  // select the previous values from local storage
  document.querySelector('#osToRun').value = localStorage.osToRun || 'windows';
  document.querySelector('#addBootstrapScript').value = localStorage.addBootstrapScript !== '' ? 'yes' : '';

  // add the first script textbox
  addScriptTextbox();

  // initial setup to fix up the script
  updateScript();
}

function updateScript() {
  let newCommands = [];

  const selectedScriptIdx = document.querySelector("[name='choice-setup']:checked").value;
  const selectedScript = configsByKey[selectedScriptIdx];

  let debugWriteToDirValue = '';
  try {
    debugWriteToDirValue = document.querySelector('#debugWriteToDir').value.trim();
    if (debugWriteToDirValue) {
      debugWriteToDirValue = `&& export DEBUG_WRITE_TO_DIR="${debugWriteToDirValue}"`;
    }
  } catch (err) {}

  newCommands.push(
    selectedScript.script
      .replace(
        '<SELECT_SCRIPTS>',
        [...new Set([...document.querySelectorAll('.scriptToUse')].map((s) => s.value.trim()).filter((s) => !!s.trim()))].join('\n'),
      )
      .replace('<DEBUG_WRITE_TO_DIR>', debugWriteToDirValue)
      .replace('<SELECTED_RUNNER_SCRIPT>', document.querySelector('#runnerToUse').value.trim())
      .replace('<OS_FLAGS>', _getOsFlags(document.querySelector('#osToRun').value.trim())),
  );

  document.querySelector('#scriptToRunContainer').classList.toggle('hidden', selectedScript.shouldShowScriptNameInput !== true);
  document.querySelector('#osToRunContainer').classList.toggle('hidden', selectedScript.shouldShowOsSelectionInput !== true);

  document.querySelector('#output').value = newCommands
    .join('\n')
    .split('\\')
    .filter((s) => s.trim())
    .join('\\')
    .trim();
}

function addScriptTextbox() {
  const notEmptyScriptTextboxes = [...document.querySelectorAll('.scriptToUse')].filter((s) => !s.value.trim());
  if (notEmptyScriptTextboxes.length > 0) {
    notEmptyScriptTextboxes[0].focus();
  }

  document.querySelector('#btnAddScript').insertAdjacentHTML(
    'beforeBegin',
    `
          <input
            class="scriptToUse"
            list="scriptToRunOptions"
            type="text"
            onkeydown="keyDownScriptTextbox(event)"
            onchange="updateScript()"
            onblur="cleanupUnusedScriptTextBox(this)"
            placeholder="Script To Run"
            autofocus
            required
            />
        `,
  );

  // focus on the last one
  [...document.querySelectorAll('.scriptToUse')].slice(-1)[0].focus();
}

function keyDownScriptTextbox(e) {
  if (e.key === 'Enter' && e.target.value) {
    addScriptTextbox();
  }
}

function updateAutoComplete() {
  const selectedScriptSet = new Set([...document.querySelectorAll('.scriptToUse')].map((s) => s.value.trim()));

  document.querySelector('#scriptToRunOptions').innerHTML = window.SCRIPT_TO_RUN_OPTIONS;

  [...document.querySelectorAll('#scriptToRunOptions option')].forEach((scriptElem) => {
    if (selectedScriptSet.has(scriptElem.innerText.trim())) {
      scriptElem.remove();
    }
  });
}

function cleanupUnusedScriptTextBox(elem) {
  elem.value = elem.value.trim();

  if (!elem.value.trim() && [...document.querySelectorAll('.scriptToUse')].length > 1) {
    elem.remove();
    return;
  }

  //
  updateAutoComplete();
}

function _getOsFlags(osFlag) {
  if (!document.querySelector('#addBootstrapScript').value.trim()) {
    // don't add os bootstrap script
    return '';
  }

  const osFlags = {
    is_os_darwin_mac: osFlag === 'mac' ? '1' : '0',
    is_os_window: osFlag === 'windows' ? '1' : '0',
    is_os_wsl: osFlag === 'windows' ? '1' : '0',
    is_os_ubuntu: ['windows', 'chrome_os', 'ubuntu'].indexOf(osFlag) >= 0 ? '1' : '0',
    is_os_chromeos: osFlag === 'chrome_os' ? '1' : '0',
    is_os_mingw64: osFlag === 'ming_64' ? '1' : '0',
    is_os_android_termux: osFlag === 'android_termux' ? '1' : '0',
  };

  const osKeys = Object.keys(osFlags);

  return (
    [
      "sudo echo '> Initializing Environment'",
      'NODE_VERSION_TO_USE=12.22.1',
      'nvm install $NODE_VERSION_TO_USE',
      'nvm use $NODE_VERSION_TO_USE',
      `echo """\n${osKeys.map((key) => `export ${key}='${osFlags[key]}'`).join('\n')}\n""" > ~/.bash_syle_os && source ~/.bash_syle_os`,
    ].join(' && \\\n') + ' && '
  ).trim();
}

async function selectCommands() {
  try {
    await navigator.clipboard.writeText(document.querySelector('#output').value);
  } catch (err) {}
  document.querySelector('#output').focus();
  document.querySelector('#output').select();
  document.execCommand('copy');
}

init();

// getting and setting the page title
try {
  document.querySelector('h1').innerText = document.title;
} catch (err) {}

let idx = Date.now();

let configs;
let configsByKey = {};

async function init() {
  configs = [
    {
      text: 'Setup Profile',
      script: `<OS_FLAGS> <SETUP_DEPS> . /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-full.sh?$(date +%s))"`,
      checked: true,
      shouldShowOsSelectionInput: true,
      shouldShowSetupDependencies: true,
    },
    {
      text: 'Setup Lightweight Profile',
      script: `. /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-lightweight.sh?$(date +%s))"`,
    },
    {
      text: 'Setup etc Hosts',
      script: `
        curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-hosts.sh | sudo -E bash
        
        # Windows
        #c:\\Windows\\System32\\Drivers\\etc\\hosts

        # Linux
        #/etc/hosts

        ${await fetch(`https://raw.githubusercontent.com/synle/bashrc/master/software/metadata/ip-address.config`)
          .then((res) => res.text())
          .then((s) =>
            s
              .trim()
              .split('\n')
              .map((s) => '# ' + s.trim())
              .join('\n'),
          )}

      `
        .split('\n')
        .map((s) => s.trim())
        .join('\n'),
    },
    {
      text: 'Test Full Run live',
      script: `<OS_FLAGS> curl -s https://raw.githubusercontent.com/synle/bashrc/master/test-full-run-live.sh | bash`,
      shouldShowOsSelectionInput: true,
    },
    {
      text: 'Test Single Script',
      script: `<OS_FLAGS>\\\nexport TEST_SCRIPT_FILES="""\n<SELECT_SCRIPTS>\n""" <DEBUG_WRITE_TO_DIR> && \\\n\\\n curl -s https://raw.githubusercontent.com/synle/bashrc/master/<SELECTED_RUNNER_SCRIPT> | bash`,
      shouldShowScriptNameInput: true,
      shouldShowOsSelectionInput: true,
    },

    {
      text: 'Environment Vars',
      script: `<ENV_VARS>`,
      shouldShowOsSelectionInput: true,
      shouldHideBootstrap: true,
      shouldShowEnvInput: true,
    },
  ].map((config) => ({
    idx: `command-option-${config.text.toLowerCase().replace(/[ -]/g, '-')}`,
    ...config,
  }));

  for (const config of configs) {
    configsByKey[config.idx] = config;
  }

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

  let selectedIdx = '';
  for (const config of configs) {
    const domCommand = document.createElement('div');
    domCommand.innerHTML = `
      <input onchange='updateScript()' type='radio' name='commandChoice' id='${config.idx}' value='${config.idx}' />
      <label for='${config.idx}'>${config.text}</label>
    `;
    document.querySelector('#commands').appendChild(domCommand);

    if (config.checked) {
      selectedIdx = config.idx;
    }
  }

  document.scriptForm.commandChoice.value = selectedIdx;

  // select the previous values from local storage
  document.querySelector('#osToRun').value = getStorage('osToRun', 'windows');
  document.querySelector('#debugWriteToDir').value = getStorage('debugWriteToDir', '');
  document.scriptForm.runnerToUse.value = getStorage('runnerToUse', 'test-live.sh');
  document.scriptForm.addBootstrapScript.value = getStorage('addBootstrapScript') || 'no';
  document.scriptForm.setupDependencies.value = getStorage('setupDependencies') || 'yes';
  document.scriptForm.envInputValue.value = getStorage('envInputValue') || '';

  getStorage('scriptToUse', '')
    .split('\n')
    .filter((s) => s.trim())
    .forEach((s) => addScriptTextbox(s));

  // add the first script textbox
  addScriptTextbox();

  // initial setup to fix up the script
  updateScript();
}

function updateScript() {
  let newCommands = [];

  const selectedScriptIdx = document.scriptForm.commandChoice.value;
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
      .replace('<SELECTED_RUNNER_SCRIPT>', document.scriptForm.runnerToUse.value)
      .replace('<OS_FLAGS>', _getOsFlagScript())
      .replace(
        '<SETUP_DEPS>',
        document.scriptForm.setupDependencies.value !== 'yes'
          ? ''
          : `. /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-dependencies.sh)" && \\\n`,
      )
      .replace('<ENV_VARS>', getEnvVars()),
  );

  document.querySelector('#scriptToRunContainer').classList.toggle('hidden', selectedScript.shouldShowScriptNameInput !== true);
  document.querySelector('#osToRunContainer').classList.toggle('hidden', selectedScript.shouldShowOsSelectionInput !== true);
  document.querySelector('#setupDependencies').classList.toggle('hidden', selectedScript.shouldShowSetupDependencies !== true);
  document.querySelector('#osBootstrap').classList.toggle('hidden', selectedScript.shouldHideBootstrap === true);
  document.querySelector('#envInput').classList.toggle('hidden', selectedScript.shouldShowEnvInput !== true);

  document.querySelector('#envInputValue').value = getEnvVars('\n');

  document.querySelector('#output').value = newCommands
    .join('\n')
    .split('\\')
    .filter((s) => s.trim())
    .join('\\')
    .trim();

  // fixed up the autocomplete
  updateAutoComplete();
}

function addScriptTextbox(defaultValue = '') {
  const notEmptyScriptTextboxes = [...document.querySelectorAll('.scriptToUse')].filter((s) => !s.value.trim());
  if (notEmptyScriptTextboxes.length > 0) {
    notEmptyScriptTextboxes[0].focus();
  }

  document.querySelector('#scriptToUseContainer').insertAdjacentHTML(
    'beforeBegin',
    `
      <input
        class="scriptToUse"
        list="scriptToRunOptions"
        type="text"
        onkeydown="keyDownScriptTextbox(event)"
        onchange="updateScript()"
        onblur="cleanupUnusedScriptTextBox(this)"
        oninput="persistScriptToUse()"
        placeholder="Script To Run"
        autofocus
        required
        />
    `,
  );

  // focus on the last one
  const lastScriptBox = [...document.querySelectorAll('.scriptToUse')].slice(-1)[0];
  lastScriptBox.value = defaultValue;
  lastScriptBox.focus();
}

function clearAllScriptTextBox() {
  // store it and create new list
  const backupScript = getStorage('scriptToUse', '').trim();
  if (backupScript) {
    setStorage(`scriptToUse.${Date.now()}`, backupScript);
  }

  for (const scriptElem of document.querySelectorAll('.scriptToUse')) {
    scriptElem.remove();
  }
  addScriptTextbox();
}

function keyDownScriptTextbox(e) {
  if (e.key === 'Enter' && e.target.value) {
    addScriptTextbox();
  }
}

function updateAutoComplete() {
  const osFlags = _getOsFlags();
  const selectedScriptSet = new Set([...document.querySelectorAll('.scriptToUse')].map((s) => s.value.trim()));

  document.querySelector('#scriptToRunOptions').innerHTML = window.SCRIPT_TO_RUN_OPTIONS;

  [...document.querySelectorAll('#scriptToRunOptions option')].forEach((scriptElem) => {
    const scriptName = scriptElem.innerText.trim();
    if (selectedScriptSet.has(scriptName)) {
      scriptElem.remove();
    } else if (!osFlags.is_os_window && scriptName.includes('/windows/')) {
      scriptElem.remove();
    } else if (!osFlags.is_os_darwin_mac && scriptName.includes('/mac/')) {
      scriptElem.remove();
    } else if (!osFlags.is_os_android_termux && scriptName.includes('/android-termux/')) {
      scriptElem.remove();
    } else if (!osFlags.is_os_arch_linux && scriptName.includes('/arch-linux/')) {
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
}

function persistScriptToUse() {
  // persist the script into memory for later use
  setStorage(
    'scriptToUse',
    [...document.querySelectorAll('.scriptToUse')]
      .map((s) => s.value.trim())
      .filter((s) => s.trim())
      .join('\n'),
  );
}

function _getOsFlagScript() {
  if (document.scriptForm.addBootstrapScript.value.trim() !== 'yes') {
    // don't add os bootstrap script
    return '';
  }

  const osFlags = _getOsFlags();
  const osKeys = Object.keys(osFlags);

  return (
    [
      "sudo echo '> Initializing Environment'",
      // 'NODE_VERSION_TO_USE=12.22.1',
      // 'nvm install $NODE_VERSION_TO_USE',
      // 'nvm use $NODE_VERSION_TO_USE',
      `echo """\n${osKeys
        .map((key) => `export ${key}='${osFlags[key] ? '1' : '0'}'`)
        .join('\n')}\n""" > ~/.bash_syle_os && source ~/.bash_syle_os`,
    ].join(' && \\\n') + ' && '
  ).trim();
}

function _getOsFlags() {
  const osFlag = document.querySelector('#osToRun').value.trim();

  const osFlags = {
    is_os_darwin_mac: osFlag === 'mac',
    is_os_window: osFlag === 'windows',
    is_os_wsl: osFlag === 'windows',
    is_os_ubuntu: ['windows', 'chrome_os', 'ubuntu'].indexOf(osFlag) >= 0,
    is_os_chromeos: osFlag === 'chrome_os',
    is_os_mingw64: osFlag === 'ming_64',
    is_os_android_termux: osFlag === 'android_termux',
    is_os_arch_linux: osFlag.includes('arch_linux'),
    is_os_steamdeck: osFlag === 'arch_linux_steamdeck',
  };

  return osFlags;
}

async function selectCommands() {
  try {
    await navigator.clipboard.writeText(document.querySelector('#output').value);
  } catch (err) {}
  document.querySelector('#output').focus();
  document.querySelector('#output').select();
  document.execCommand('copy');
}

function getEnvVars(envSepToReturn) {
  const env = document.querySelector('#envInputValue').value.trim();
  const osFlag = document.querySelector('#osToRun').value.trim();
  const shouldUseDefaultEnvs = document.querySelector('#checkboxAddDefaultEnvs').checked;

  let pathSep = '/';
  let defaultEnv = '';
  let envSep = /[\n;\:]/g;

  switch (osFlag) {
    case 'windows':
      envSep = /[\n;]/g;

      if (!envSepToReturn) {
        envSepToReturn = ';';
      }

      pathSep = '\\';

      defaultEnv = `
        %SystemRoot%
        %SystemRoot%/System32
        %SystemRoot%/System32/OpenSSH
        %SystemRoot%/System32/Wbem
        %SystemRoot%/System32/WindowsPowerShell/v1.0
        %UserProfile%/AppData/Local/Microsoft/WindowsApps
        %LocalAppData%/Microsoft/WindowsApps
      `;

      if (shouldUseDefaultEnvs) {
        defaultEnv += `
          #### JDK
          %JAVA_HOME%/bin

          #### NVIDIA
          %ProgramFiles% (x86)/NVIDIA Corporation/PhysX/Common

          #### VS Code
          %ProgramFiles%/Microsoft VS Code
          %ProgramFiles%/Microsoft VS Code/bin

          #### Sublime
          %ProgramFiles%/Sublime Text
        `;
      }
      break;
    case 'mac':
      if (!envSepToReturn) {
        envSepToReturn = ':';
      }

      defaultEnv = `
        /usr/local/bin
        /usr/bin
        /bin
        /usr/sbin
        /sbin
      `;

      if (shouldUseDefaultEnvs) {
        defaultEnv += `
          #### VS Code
          /Applications/Visual Studio Code.app/Contents/Resources/app/bin
        `;
      }
      break;
    default:
      if (!envSepToReturn) {
        envSepToReturn = ';';
      }
      break;
  }

  // convert the env var into arrays
  defaultEnv = defaultEnv.split(envSep);

  const newEnv = [...env.split(envSep), ...defaultEnv]
    .map((s) => s.trim())
    .filter((s) => s && !s.includes('#'))
    .filter((s) => s.includes('\\') || s.includes('/') || (osFlag === 'windows' && s.includes('%')))
    .map((s) => {
      s = s
        .replace(/[/\\]/g, pathSep)
        .replace(/C:\\Windows/i, '%SystemRoot%')
        .replace(/C:\\Program Files (x86)/i, '%ProgramFiles% (x86)')
        .replace(/C:\\Program Files/i, '%ProgramFiles%')
        .replace(/C:\\Users\\[a-z0-9]+\\AppData\\Local/i, '%LocalAppData%')
        .replace(/C:\\Users\\[a-z0-9]+/i, '%UserProfile%')
        .replace(/%LocalAppData%/i, '%LocalAppData%')
        .replace(/%ProgramFiles%/i, '%ProgramFiles%')
        .replace(/%SystemRoot%/i, '%SystemRoot%')
        .replace(/%SystemRoot%\\System32/i, '%SystemRoot%\\System32')
        .replace(/%UserProfile%/i, '%UserProfile%');

      s = s.replace(/[\\/]+$/, pathSep);

      const lastChar = s[s.length - 1];
      if (lastChar !== '/' && lastChar !== '\\') {
        s += pathSep;
      }

      return s;
    })
    .sort();

  const envItems = [...new Set(newEnv)];

  return envItems.join(envSepToReturn);
}

function setStorage(key, value) {
  localStorage[key] = value;
}

function getStorage(key, defaultValue) {
  return localStorage[key] || defaultValue;
}

init();

// getting and setting the page title
try {
  document.querySelector('h1').innerText = document.title;
} catch (err) {}

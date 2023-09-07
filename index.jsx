import React, { useContext, useState, useEffect, useMemo, useRef } from 'https://cdn.skypack.dev/react';
import ReactDOM from 'https://cdn.skypack.dev/react-dom';

function setStorage(key, value) {
  localStorage[key] = value;
}

function getStorage(key, defaultValue) {
  return localStorage[key] || defaultValue;
}

async function copyTextToClipboard(text) {
  text = text.trim();

  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {}

  const toast = Toastify({
    text: 'Text copied to clipboard.',
    duration: 2000,
    onClick: () => toast.hideToast(),
  });
  toast.showToast();
}

function getEnvVars(env, osFlag, shouldUseDefaultEnvs, envSepToReturn) {
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

// create a context
const MainAppContext = React.createContext();

// use it in a component
function RightContainer() {
  const { appData, setAppData, onInputChange } = useContext(MainAppContext);
  const formValue = appData.formValue;

  const selectedScript = appData.configs.find((config) => config.idx === formValue.commandChoice);

  const formValueOutput = useMemo(() => {
    const runnerToUse = formValue.runnerToUse;

    let debugWriteToDirValue = '';
    try {
      debugWriteToDirValue = formValue.debugWriteToDir;
      if (debugWriteToDirValue) {
        debugWriteToDirValue = `&& export DEBUG_WRITE_TO_DIR="${debugWriteToDirValue}"`;
      }
    } catch (err) {}

    const osFlag = formValue.osToRun;
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
    const osKeys = Object.keys(osFlags);

    let bootstrapScript = '';
    if (formValue.addBootstrapScript === 'yes') {
      bootstrapScript = (
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

    let newCommands = [];
    newCommands.push(
      selectedScript.script
        .replace('<SELECT_SCRIPTS>', formValue.scriptsToUse.join('\n'))
        .replace('<DEBUG_WRITE_TO_DIR>', debugWriteToDirValue)
        .replace('<SELECTED_RUNNER_SCRIPT>', runnerToUse)
        .replace('<OS_FLAGS>', bootstrapScript)
        .replace(
          '<SETUP_DEPS>',
          formValue.setupDependencies !== 'yes'
            ? ''
            : `. /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-dependencies.sh)" && \\\n`,
        )
        .replace(
          '<ENV_VARS>',
          `
${getEnvVars(formValue.envInputValue, formValue.osToRun, formValue.shouldAddDefaultEnvs === 'yes')}

===

${getEnvVars(formValue.envInputValue, formValue.osToRun, formValue.shouldAddDefaultEnvs === 'yes', '\n')}
        `.trim(),
        ),
    );

    return newCommands
      .join('\n')
      .split('\\')
      .filter((s) => s.trim())
      .join('\\')
      .trim();
  }, [formValue]);

  let consolidatedEnvInputValue = formValue.envInputValue;
  if (formValue.shouldAddDefaultEnvs === 'yes') {
    consolidatedEnvInputValue = getEnvVars(formValue.envInputValue, formValue.osToRun, formValue.shouldAddDefaultEnvs === 'yes', '\n');
  }

  const onChangeTestScript = (idx, newValue) => {
    formValue.scriptsToUse[idx] = newValue.trim();
    onInputChange('scriptsToUse', formValue.scriptsToUse, formValue.scriptsToUse.join('\n'));
  };

  const onAddTestScript = () => {
    formValue.scriptsToUse.push('software/');
    onInputChange('scriptsToUse', formValue.scriptsToUse, formValue.scriptsToUse.join('\n'));
  };

  const onClearTestScripts = () => {
    setStorage(`scriptsToUse.${Date.now()}`, formValue.scriptsToUse.join('\n'));
    onInputChange('scriptsToUse', [], '');
  };

  return (
    <div id='rightContainer'>
      {selectedScript.shouldShowScriptNameInput === true && (
        <>
          <div className='form-label'>Scripts To Run</div>
          {formValue.scriptsToUse.map((scriptToUse, idx) => (
            <div key={idx}>
              <input
                list='scriptToRunOptions'
                type='text'
                placeholder='Script To Run'
                autofocus
                required
                onBlur={(e) => {
                  e.target.value = e.target.value.trim();
                  onChangeTestScript(idx, e.target.value);
                }}
                defaultValue={scriptToUse}
              />
            </div>
          ))}
          <div className='form-row'>
            <button onClick={onAddTestScript} type='button'>
              Add Script
            </button>
            <button onClick={onClearTestScripts} type='button'>
              Clear All
            </button>
          </div>
          <datalist id='scriptToRunOptions'>
            {appData.scriptToRunOptions.map((option, index) => (
              <option key={index}>{option}</option>
            ))}
          </datalist>

          <div className='form-label'>Runner</div>
          <div className='form-row'>
            <input
              type='radio'
              name='runnerToUse'
              id='runnerToUse-live'
              value='test-live.sh'
              onChange={(e) => {
                onInputChange(e.target.name, e.target.value);
              }}
              checked={formValue.runnerToUse === 'test-live.sh'}
            />
            <label htmlFor='runnerToUse-live'>Live Script</label>
            <input
              type='radio'
              name='runnerToUse'
              id='runnerToUse-local'
              value='test.sh'
              onChange={(e) => {
                onInputChange(e.target.name, e.target.value);
              }}
              checked={formValue.runnerToUse !== 'test-live.sh'}
            />
            <label htmlFor='runnerToUse-local'>Local Script</label>
          </div>
          <div className='form-label'>Debug Write To File</div>
          <div>
            <input
              id='debugWriteToDir'
              name='debugWriteToDir'
              list='writeToFilePathOptions'
              type='text'
              onBlur={(e) => onInputChange(e.target.name, e.target.value.trim())}
              placeholder='Debug Write To File Path'
              defaultValue={formValue.debugWriteToDir}
            />
            <datalist id='writeToFilePathOptions'>
              <option>$(pwd)</option>
              <option>./</option>
              <option>~</option>
            </datalist>
          </div>
        </>
      )}

      {selectedScript.shouldShowOsSelectionInput === true && (
        <>
          <div className='form-label'>OS Type</div>
          <div>
            <select
              id='osToRun'
              name='osToRun'
              onChange={(e) => {
                onInputChange(e.target.name, e.target.value);
              }}
              defaultValue={formValue.osToRun}>
              <option value='windows'>Windows with WSL</option>
              <option value='ming_64'>Windows with Ming_64</option>
              <option value='mac'>Mac OSX</option>
              <option value='chrome_os'>Chrome OS with Linux</option>
              <option value='ubuntu'>Ubuntu</option>
              <option value='arch_linux_steamdeck'>Arch Linux (Steam Deck)</option>
              <option value='android_termux'>Android Termux</option>
            </select>
          </div>
        </>
      )}

      {selectedScript.shouldShowSetupDependencies === true && (
        <>
          <div className='form-label'>Setup Dependencies</div>
          <div className='form-row'>
            <input
              type='radio'
              name='setupDependencies'
              id='setupDependencies-yes'
              value='yes'
              onChange={(e) => {
                onInputChange(e.target.name, e.target.value);
              }}
              checked={formValue.setupDependencies === 'yes'}
            />
            <label htmlFor='setupDependencies-yes'>Yes</label>
            <input
              type='radio'
              name='setupDependencies'
              id='setupDependencies-no'
              value='no'
              onChange={(e) => {
                onInputChange(e.target.name, e.target.value);
              }}
              checked={formValue.setupDependencies !== 'yes'}
            />
            <label htmlFor='setupDependencies-no'>No</label>
          </div>
        </>
      )}

      {selectedScript.shouldHideBootstrap !== true && (
        <>
          <div className='form-label'>Add Bootstrap Script</div>
          <div className='form-row'>
            <input
              type='radio'
              name='addBootstrapScript'
              id='addBootstrapScript-yes'
              value='yes'
              onChange={(e) => {
                onInputChange(e.target.name, e.target.value);
              }}
              checked={formValue.addBootstrapScript === 'yes'}
            />
            <label htmlFor='addBootstrapScript-yes'>Yes</label>
            <input
              type='radio'
              name='addBootstrapScript'
              id='addBootstrapScript-no'
              value='no'
              onChange={(e) => {
                onInputChange(e.target.name, e.target.value);
              }}
              checked={formValue.addBootstrapScript !== 'yes'}
            />
            <label htmlFor='addBootstrapScript-no'>No</label>
          </div>
        </>
      )}

      {selectedScript.shouldShowEnvInput === true && (
        <>
          <div className='form-label'>Env Var Input</div>
          <div>
            <textarea
              id='envInputValue'
              name='envInputValue'
              placeholder='Input'
              onBlur={(e) => {
                onInputChange(e.target.name, e.target.value.trim());
              }}
              defaultValue={consolidatedEnvInputValue}
            />
          </div>
          <div className='form-label'>Add Default Env</div>
          <div>
            <input
              type='checkbox'
              id='shouldAddDefaultEnvs'
              name='shouldAddDefaultEnvs'
              checked={formValue.shouldAddDefaultEnvs === 'yes'}
              onChange={(e) => {
                onInputChange(e.target.name, e.target.checked ? 'yes' : 'no');
                location.reload(); // TODO: improve this - used to trigger the updates of env variable
              }}
            />
          </div>
        </>
      )}

      {selectedScript.shouldHideOutput !== true && (
        <>
          <div className='form-label'>Output</div>
          <div>
            <textarea
              id='formValueOutput'
              placeholder='Output'
              readOnly
              value={formValueOutput}
              onDoubleClick={(e) => copyTextToClipboard(e.target.value)}
            />
          </div>
        </>
      )}

      {selectedScript.shouldShowWindowsNotes === true && <WindowsNotesDom />}
      {selectedScript.shouldShowMacOSXNotes === true && <MacOSXNotesDom />}
      {selectedScript.shouldShowLinuxNotes === true && <LinuxNotesDom />}
    </div>
  );
}

function LeftContainer() {
  const { appData, onInputChange } = useContext(MainAppContext);
  const formValue = appData.formValue;

  return (
    <div id='leftContainer'>
      <div className='form-label'>Type of Script</div>
      {appData.configs.map((config) => (
        <div key={config.idx} className='form-row'>
          <input
            type='radio'
            name='commandChoice'
            key={config.idx}
            id={config.idx}
            value={config.idx}
            onChange={(e) => {
              onInputChange(e.target.name, e.target.value);
            }}
            checked={config.idx === formValue.commandChoice}
          />
          <label htmlFor={config.idx}>{config.text}</label>
        </div>
      ))}
    </div>
  );
}

function BottomContainer() {
  return (
    <div id='bottomContainer' className='form-row'>
      <a href='https://github.com/synle/bashrc' target='_blank'>
        Repo
      </a>
      <a href='https://github.com/synle/bashrc/tree/master/.build' target='_blank'>
        Pre-compiled Configs
      </a>
      <a href='https://github.com/synle/bashrc/find/master' target='_blank'>
        Bashrc Code
      </a>
    </div>
  );
}

function DynamicTextArea(props) {
  const { url, height } = props;
  const [text, setText] = useState('');

  useEffect(() => {
    async function _load() {
      setText('');
      setText(await fetch(url).then((res) => res.text()));
    }

    _load();
  }, []);

  const shortUrl = url.replace('https://raw.githubusercontent.com/synle/bashrc/master/.build/', '');

  return (
    <>
      <div className='form-label'>
        <a href={url} target='_blank'>
          {shortUrl}
        </a>
      </div>
      <textarea value={text} readOnly placeholder={url} onDoubleClick={(e) => copyTextToClipboard(e.target.value)} style={{ height }} />
    </>
  );
}

function MacOSXNotesDom() {
  return (
    <>
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/notes-macosx.md' height='600px' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/gitconfig' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/ssh-config' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/inputrc' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/vimrc' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/sublime-text-configurations' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/sublime-text-extensions' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/sublime-text-keybindings-macosx' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/vs-code-configurations' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/vs-code-extensions-macosx' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/vs-code-keybindings-macosx' />
    </>
  );
}

function LinuxNotesDom() {
  return (
    <>
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/notes-linux.md' height='600px' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/gitconfig' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/ssh-config' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/inputrc' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/vimrc' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/sublime-text-configurations' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/sublime-text-extensions' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/sublime-text-keybindings-linux' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/vs-code-configurations' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/vs-code-extensions-linux' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/vs-code-keybindings-linux' />
    </>
  );
}

function WindowsNotesDom() {
  return (
    <>
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/notes-windows.md' height='600px' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/windows-registry.ps1' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/windows-terminal' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/sublime-text-configurations' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/sublime-text-extensions' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/sublime-text-keybindings-windows' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/vs-code-configurations' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/vs-code-extensions-windows' />
      <DynamicTextArea url='https://raw.githubusercontent.com/synle/bashrc/master/.build/vs-code-keybindings-windows' />

      <div className='form-label'>Other Links</div>
      <div>
        <a target='_blank' href='https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi'>
          WSL Kernel
        </a>
      </div>
      <div>
        <a target='_blank' href='https://apps.microsoft.com/store/detail/raw-image-extension/9nctdw2w1bh8'>
          Raw Image Extension
        </a>
      </div>
      <div>
        <a target='_blank' href='https://apps.microsoft.com/store/detail/heif-image-extensions/9pmmsr1cgpwg'>
          Heif Image Extension
        </a>
      </div>
      <div>
        <a target='_blank' href='https://apps.microsoft.com/store/detail/hevc-video-extensions-from-device-manufacturer/9n4wgh0z6vhq'>
          Hevc Video Extension fro
        </a>
      </div>
      <div>
        <a target='_blank' href='https://apps.microsoft.com/store/detail/mpeg2-video-extension/9n95q1zzpmh4'>
          MPEG-2 Video Extensio
        </a>
      </div>
      <div>
        <a target='_blank' href='https://apps.microsoft.com/store/detail/av1-video-extension/9mvzqvxjbq9v'>
          AV1 Video Extension
        </a>
      </div>
    </>
  );
}

// hook up the context with .Provider value={}
function App() {
  const [appData, setAppData] = useState();

  useEffect(() => {
    async function _loadData() {
      const configsByKey = {};
      const configs = [
        {
          text: 'Setup Profile',
          script: `
        <OS_FLAGS> <SETUP_DEPS> . /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-full.sh?$(date +%s))"
      `,
          checked: true,
          shouldShowOsSelectionInput: true,
          shouldShowSetupDependencies: true,
        },
        {
          text: 'Setup Lightweight Profile',
          shouldHideBootstrap: true,
          script: `
        . /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-lightweight.sh?$(date +%s))"
      `,
        },
        {
          text: 'Setup Etc Hosts',
          shouldHideBootstrap: true,
          script: `
        curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-hosts.sh | sudo -E bash

        # Windows
        # c:\\Windows\\System32\\Drivers\\etc\\hosts

        # Linux
        # /etc/hosts

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
          script: `
        <OS_FLAGS> curl -s https://raw.githubusercontent.com/synle/bashrc/master/test-full-run-live.sh | bash
      `,
          shouldShowOsSelectionInput: true,
        },
        {
          text: 'Test Single Script',
          script: `<OS_FLAGS> \\
        export TEST_SCRIPT_FILES="""
        <SELECT_SCRIPTS>
        """ <DEBUG_WRITE_TO_DIR> && \\
        curl -s https://raw.githubusercontent.com/synle/bashrc/master/<SELECTED_RUNNER_SCRIPT> | bash
      `,
          shouldShowScriptNameInput: true,
          shouldShowOsSelectionInput: true,
        },

        {
          text: 'Environment Vars',
          script: `
        <ENV_VARS>
      `,
          shouldShowOsSelectionInput: true,
          shouldHideBootstrap: true,
          shouldShowEnvInput: true,
        },
        {
          text: 'Windows Notes',
          shouldShowWindowsNotes: true,
          shouldHideOutput: true,
          shouldHideBootstrap: true,
        },
        {
          text: 'Mac OSX Notes',
          shouldShowMacOSXNotes: true,
          shouldHideOutput: true,
          shouldHideBootstrap: true,
        },
        {
          text: 'Linux Notes',
          shouldShowLinuxNotes: true,
          shouldHideOutput: true,
          shouldHideBootstrap: true,
        },
      ].map((config) => {
        config.script = (config.script || '')
          .split('\n')
          .map((s) => s.trim())
          .join('\n');
        return {
          idx: `command-option-${config.text.toLowerCase().replace(/[ -]/g, '-')}`,
          ...config,
        };
      });

      for (const config of configs) {
        configsByKey[config.idx] = config;
      }

      // back it up
      const newAppData = {
        configs,
        configsByKey,
        scriptToRunOptions: await fetch(`https://raw.githubusercontent.com/synle/bashrc/master/software/metadata/script-list.config`)
          .then((res) => res.text())
          .then((res) =>
            res
              .split('\n')
              .map((s) => s.replace('./', '').trim())
              .filter((s) => !!s && (s.includes('.js') || s.includes('.sh')))
              .sort(),
          ),
        formValue: {
          commandChoice: getStorage('commandChoice') || 'command-option-setup-profile',
          osToRun: getStorage('osToRun') || 'windows',
          debugWriteToDir: getStorage('debugWriteToDir') || '',
          runnerToUse: getStorage('runnerToUse') || 'test-live.sh',
          addBootstrapScript: getStorage('addBootstrapScript') || 'no',
          setupDependencies: getStorage('setupDependencies') || 'yes',
          envInputValue: getStorage('envInputValue') || '',
          shouldAddDefaultEnvs: getStorage('shouldAddDefaultEnvs') || 'yes',
          scriptsToUse: (getStorage('scriptsToUse') || '').split('\n').filter((s) => s.trim()),
        },
      };

      setAppData(newAppData);
    }

    _loadData();
  }, []);

  if (!appData) {
    return null;
  }

  const onSetAppData = (newAppData) => {
    setAppData({
      ...newAppData,
    });
  };

  const onInputChange = (key, value, valueAsString) => {
    if (valueAsString === undefined) {
      valueAsString = value;
    }

    appData.formValue = {
      ...appData.formValue,
      [key]: value,
    };
    onSetAppData(appData);
    setStorage(key, valueAsString);
  };

  return (
    <MainAppContext.Provider
      value={{
        appData,
        setAppData: onSetAppData,
        onInputChange,
      }}>
      <div>
        <h1>{window.document.title}</h1>
      </div>
      <div id='container'>
        <LeftContainer />
        <RightContainer />
        <BottomContainer />
      </div>
    </MainAppContext.Provider>
  );
}

ReactDOM.render(<App />, document.body);

import Editor from '@monaco-editor/react';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Toastify from 'toastify-js';
import 'toastify-js/src/toastify.css';
import './styles.scss';

const isSystemMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const isSystemWindows = navigator.platform.indexOf('Win') > -1;
const isSystemUbuntu = !isSystemMac && !isSystemWindows;

// this is the default settings used on the first page load
let defaultCommandOption = 'command-option-setup-lightweight-profile';
if (isSystemMac) {
  defaultCommandOption = 'command-option-setup-mac-osx';
} else if (isSystemWindows) {
  defaultCommandOption = 'command-option-setup-windows';
} else if (isSystemUbuntu) {
  defaultCommandOption = 'command-option-setup-linux';
}

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
  } catch (err) {
    console.log(err);
  }

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

// create contexts
const MainAppContext = React.createContext();
const ThemeContext = React.createContext();

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
          <TargetSystemOSWarningDom targetDomString={formValue.osToRun} />
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
          <EnhancedTextArea
            id='envInputValue'
            name='envInputValue'
            placeholder='Env Var Input'
            onBlur={(e) => {
              onInputChange(e.target.name, e.target.value.trim());
            }}
            defaultValue={consolidatedEnvInputValue}
          />
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
        <EnhancedTextArea id='formValueOutput' placeholder='Output' readOnly value={formValueOutput} />
      )}

      {selectedScript.shouldShowAndroidNotes === true && <AndroidNotesDom />}
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
      <select
        name='commandChoice'
        value={formValue.commandChoice}
        onChange={(e) => {
          onInputChange(e.target.name, e.target.value);
        }}>
        {appData.configs.map((config) => (
          <option key={config.idx} value={config.idx}>
            {config.text}
          </option>
        ))}
      </select>
    </div>
  );
}

function BottomContainer() {
  return (
    <div id='bottomContainer'>
      <hr />
      <div className='link-group'>
        <LinkButton href='https://github.com/synle/bashrc'>Repo</LinkButton>
        <LinkButton href='https://github.com/synle/bashrc/tree/master/.build'>Pre-compiled Configs</LinkButton>
        <LinkButton href='https://github.com/synle/bashrc/find/master'>Bashrc Code</LinkButton>
      </div>
    </div>
  );
}

function LinkButton(props) {
  const { children, block, ...restProps } = props;

  if (block) {
    return (
      <div>
        <a {...restProps} role='button' target='_blank'>
          {children}
        </a>
      </div>
    );
  }
  return (
    <a {...restProps} role='button' target='_blank'>
      {children}
    </a>
  );
}

function LinkText(props) {
  const { children, block, ...restProps } = props;

  if (block) {
    return (
      <div>
        <a {...restProps} target='_blank'>
          {children}
        </a>
      </div>
    );
  }
  return (
    <a {...restProps} target='_blank'>
      {children}
    </a>
  );
}

function ActionButton(props) {
  const { children, ...restProps } = props;

  return <button {...restProps}>{children}</button>;
}

function DynamicTextArea(props) {
  let { path, url, height } = props;
  const [text, setText] = useState('');

  url = url || `https://raw.githubusercontent.com/synle/bashrc/master/${path}`;

  useEffect(() => {
    async function _load() {
      setText('');
      setText(
        await fetch(url)
          .then((r) => r.text())
          .then((r) => r.trim()),
      );
    }

    _load();
  }, []);

  return <EnhancedTextArea height={height} url={url} value={text} readOnly />;
}

function MultipleUrlDynamicTextArea(props) {
  const { urls, height, commentString } = props;
  const [text, setText] = useState('');
  const [label, setLabel] = useState('');

  useEffect(() => {
    async function _load() {
      setText('');
      setLabel(props.label || urls.join(', '));

      let resp = [];
      for (const url of urls) {
        const newInput = await fetch(url)
          .then((r) => r.text())
          .then((r) => r.trim());

        resp.push(`${commentString} ${url}\n${newInput}`);
      }

      setText(resp.join('\n\n'));
    }

    _load();
  }, []);

  return <EnhancedTextArea height={height} label={label} value={text} readOnly />;
}

function detectLanguageFromUrl(url) {
  if (!url) return null;

  const extension = url.split('.').pop().toLowerCase();
  const extensionMap = {
    sh: 'shell',
    bash: 'shell',
    md: 'markdown',
    ps1: 'powershell',
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    yml: 'yaml',
    yaml: 'yaml',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    html: 'html',
    css: 'css',
    xml: 'xml',
    sql: 'sql',
  };

  return extensionMap[extension] || null;
}

function detectLanguageFromLabel(label) {
  if (!label) return null;

  const extension = label.split('.').pop().toLowerCase();
  return detectLanguageFromUrl(extension);
}

function detectLanguageFromContent(content) {
  if (!content || typeof content !== 'string') return 'shell';

  const trimmedContent = content.trim();

  // Check for shebang
  if (trimmedContent.startsWith('#!')) {
    if (trimmedContent.includes('/bash') || trimmedContent.includes('/sh')) return 'shell';
    if (trimmedContent.includes('/python')) return 'python';
    if (trimmedContent.includes('/node')) return 'javascript';
  }

  // Check for markdown headers
  if (/^#+\s/.test(trimmedContent) || /^-{3,}$|^\*{3,}$/m.test(trimmedContent)) {
    return 'markdown';
  }

  // Check for PowerShell cmdlets
  if (/\b(Get-|Set-|New-|Remove-|Invoke-|Test-|Write-Host|param\()/i.test(trimmedContent)) {
    return 'powershell';
  }

  // Check for common shell patterns
  if (/^(export|alias|function|sudo|apt-get|yum|brew|echo|cd|ls|mkdir)\s/m.test(trimmedContent)) {
    return 'shell';
  }

  // Check for JSON
  if (/^\s*[\{\[]/.test(trimmedContent) && /[\}\]]\s*$/.test(trimmedContent)) {
    try {
      JSON.parse(trimmedContent);
      return 'json';
    } catch (e) {}
  }

  // Default to shell for most bash scripts
  return 'shell';
}

function Modal(props) {
  const { isOpen, onClose, title, children } = props;

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        padding: '1rem',
      }}
      onClick={onClose}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          color: 'var(--text)',
        }}
        onClick={(e) => e.stopPropagation()}>
        {title && <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{title}</h2>}
        <button
          onClick={onClose}
          style={{
            marginLeft: 'auto',
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            cursor: 'pointer',
          }}>
          Close (ESC)
        </button>
      </div>
      <div
        style={{
          flex: 1,
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '4px',
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function FullScreenTextViewer(props) {
  const { value, label } = props;
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useContext(ThemeContext);
  const editorTheme = theme === 'dark' ? 'vs-dark' : 'light';

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const language = detectLanguageFromLabel(label) || detectLanguageFromContent(value);

  return (
    <>
      <ActionButton onClick={() => setIsOpen(true)}>View Fullscreen</ActionButton>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={label}>
        <Editor
          height='100%'
          language={language}
          value={value || ''}
          theme={editorTheme}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            lineNumbers: 'on',
            wordWrap: 'on',
            automaticLayout: true,
          }}
        />
      </Modal>
    </>
  );
}

function Settings() {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, toggleTheme } = useContext(ThemeContext);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  return (
    <>
      <ActionButton onClick={() => setIsOpen(true)}>Settings</ActionButton>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title='Settings'>
        <div
          style={{
            padding: '2rem',
            color: 'var(--text)',
            backgroundColor: 'var(--bg)',
            height: '100%',
            overflowY: 'auto',
          }}>
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Theme</h3>
            <button onClick={toggleTheme} type='button'>
              Toggle Theme (Current: {theme === 'dark' ? 'Dark' : 'Light'})
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function EnhancedTextArea(props) {
  let { url, label, height, ...restProps } = props;
  label = label || props.placeholder;

  const content = restProps.value || restProps.defaultValue || '';
  const { theme } = useContext(ThemeContext);
  const editorTheme = theme === 'dark' ? 'vs-dark' : 'light';

  // Detect language: first try from URL, then from content
  const languageFromUrl = detectLanguageFromUrl(url);
  const language = languageFromUrl || detectLanguageFromContent(content);

  let editUrl = '';
  let formattedUrl = '';

  if (url) {
    const shortUrl = url.replace('https://raw.githubusercontent.com/synle/bashrc/master/', '').replace(/^(\.\/|\/)+/, '');
    label = label || shortUrl;

    editUrl = `https://github.com/synle/bashrc/edit/master/${shortUrl}`;
    formattedUrl = `https://github.com/synle/bashrc/blob/master/${shortUrl}`;
  }

  return (
    <>
      <div className='editor-header'>
        {formattedUrl ? <LinkText href={formattedUrl}>{label}</LinkText> : <span className='text-info'>{label}</span>}
        <ActionButton onClick={() => copyTextToClipboard(content)}>Copy</ActionButton>
        {editUrl && <LinkButton href={editUrl}>Edit</LinkButton>}
        {url && <LinkButton href={url}>View Raw</LinkButton>}
        <FullScreenTextViewer value={content} label={label} />
      </div>
      <Editor
        height={height || '300px'}
        language={language}
        value={content}
        theme={editorTheme}
        options={{
          readOnly: restProps.readOnly || false,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          lineNumbers: 'on',
          wordWrap: 'on',
          automaticLayout: true,
        }}
      />
    </>
  );
}

/**
 * Common applciations links DOM
 */
const CommonOtherAppDom = (
  <>
    <LinkButton block href='https://github.com/synle/bashrc/tree/master/fonts'>
      Custom Fonts
    </LinkButton>
    <LinkButton block href='https://www.sublimetext.com/download'>
      Sublime Text
    </LinkButton>
    <LinkButton block href='https://www.sublimemerge.com/download'>
      Sublime Merge
    </LinkButton>
    <LinkButton block href='https://www.charlesproxy.com/download/latest-release/'>
      Charles Proxy
    </LinkButton>
    <LinkButton block href='https://ultimaker.com/software/ultimaker-cura/#links'>
      Ultimaker Cura
    </LinkButton>
    <LinkButton block href='https://design.cricut.com/#/'>
      Cricut Design Space
    </LinkButton>
    <LinkButton block href='https://download.battle.net/en-us/?product=bnetdesk'>
      Battle Net
    </LinkButton>
  </>
);

// This is used to show the warning about OS not matching intended system
function TargetSystemOSWarningDom(props) {
  let { is_os_darwin_mac, is_os_window, is_os_ubuntu, is_os_android_termux, targetDomString } = props;

  // if input was a string
  switch (targetDomString) {
    case 'mac':
      is_os_darwin_mac = true;
      break;
    case 'windows':
      is_os_window = true;
      break;
    case 'ubuntu':
      is_os_ubuntu = true;
      break;
    case 'android':
      is_os_android_termux = true;
      break;
  }

  const styles = {
    background: 'var(--bg)',
    position: 'sticky',
    padding: '0.5rem 0',
    top: 0,
  };

  if (is_os_android_termux === true) {
    return (
      <h3 className='text-error' style={styles}>
        This is only meant for Android.
      </h3>
    );
  } else if (is_os_darwin_mac === true) {
    if (!isSystemMac) {
      return (
        <h3 className='text-error' style={styles}>
          OS choice (OSX) doesn't match your system.
        </h3>
      );
    }
    return (
      <h3 className='text-info' style={styles}>
        OS Choice matches your OS
      </h3>
    );
  } else if (is_os_window === true) {
    if (!isSystemWindows) {
      return (
        <h3 className='text-error' style={styles}>
          OS choice (Windows) doesn't match your system.
        </h3>
      );
    }
    return (
      <h3 className='text-info' style={styles}>
        OS Choice matches your OS
      </h3>
    );
  } else if (is_os_ubuntu === true) {
    if (!isSystemUbuntu) {
      return (
        <h3 className='text-error' style={styles}>
          OS choice (Linux (Ubuntu) doesn't match your system.
        </h3>
      );
    }
    return (
      <h3 className='text-info' style={styles}>
        OS Choice matches your OS
      </h3>
    );
  }
  return null;
}

/////////////////////////////////////////////
// This is the main DOM for MacOSX
/////////////////////////////////////////////
function MacOSXNotesDom() {
  return (
    <>
      <TargetSystemOSWarningDom targetDomString='android' />
      <DynamicTextArea path='/.build/install-macosx.sh' height='350px' />
      <DynamicTextArea path='/.build/notes-macosx.md' height='350px' />
      <DynamicTextArea path='/.build/font-linux.md' />
      <DynamicTextArea path='/.build/gitconfig' />
      <DynamicTextArea path='/.build/ssh-config' />
      <DynamicTextArea path='/.build/inputrc' />
      <DynamicTextArea path='/.build/vimrc' />
      <DynamicTextArea path='/android/sponsorblock.json' height='350px' />
      <CommonEditorSetupDom is_os_darwin_mac={true} />

      {/* Mac */}
      <div className='form-label'>Other Applications</div>
      <div className='link-group'>{CommonOtherAppDom}</div>
    </>
  );
}

/////////////////////////////////////////////
// This is the main DOM for Linux
/////////////////////////////////////////////
function LinuxNotesDom() {
  return (
    <>
      <TargetSystemOSWarningDom is_os_ubuntu={true} />
      <DynamicTextArea path='/.build/install-linux.sh' height='300px' />
      <DynamicTextArea path='/linux/linux-mint-config.sh' height='200px' />
      <DynamicTextArea path='/linux/linux-mint-xcfe.md' height='300px' />
      <DynamicTextArea path='/.build/notes-linux.md' height='300px' />
      <DynamicTextArea path='/.build/font-linux.md' />
      <DynamicTextArea path='/.build/gitconfig' />
      <DynamicTextArea path='/.build/gitignore_global' />
      <DynamicTextArea path='/.build/ssh-config' />
      <DynamicTextArea path='/.build/inputrc' />
      <DynamicTextArea path='/.build/vimrc' />
      <DynamicTextArea path='/android/sponsorblock.json' height='350px' />
      <CommonEditorSetupDom />
      {/* Linux */}
      <div className='form-label'>Other Applications</div>
      <div className='link-group'>{CommonOtherAppDom}</div>
    </>
  );
}

/////////////////////////////////////////////
// This is the main DOM for Android
/////////////////////////////////////////////
function AndroidNotesDom() {
  return (
    <>
      <TargetSystemOSWarningDom is_os_android_termux={true} />

      <DynamicTextArea path='/android/android.sh' height='350px' />
      <DynamicTextArea path='/android/sponsorblock.json' height='350px' />
      <DynamicTextArea path='/android/rvx-yt.txt' height='350px' />
      <DynamicTextArea path='/android/rvx-yt-music.txt' height='350px' />

      {/* Android */}
      <div className='form-label'>Android Applications</div>
      <div className='link-group'>
        <LinkButton block href='https://vanced.to/gmscore-microg'>
          MicroG
        </LinkButton>
        <LinkButton block href='https://vanced.to/revanced-google-photos'>
          Google photo
        </LinkButton>
        <LinkButton block href='https://vanced.to/revanced-youtube-extended'>
          Youtube
        </LinkButton>
        <LinkButton block href='https://vanced.to/revanced-youtube-music-extended'>
          Youtube Music
        </LinkButton>
        <LinkButton block href='https://vanced.to/revanced-google-news'>
          Google News
        </LinkButton>
        <LinkButton
          block
          href='https://teslacoilapps.com/tesladirect/download.pl?packageName=com.teslacoilsw.launcherclientproxy&betaType=public'>
          Nova Companion
        </LinkButton>
      </div>
    </>
  );
}

/////////////////////////////////////////////
// This is the main DOM for Windows
/////////////////////////////////////////////
function WindowsNotesDom() {
  return (
    <>
      <TargetSystemOSWarningDom is_os_window={true} />
      <DynamicTextArea path='/.build/install-windows.sh' height='350px' />
      <DynamicTextArea path='/.build/notes-windows.md' height='350px' />
      <DynamicTextArea path='/.build/winget-install-windows.ps1' />
      <DynamicTextArea path='/.build/font-windows.md' />
      <DynamicTextArea path='/.build/windows-powershell-profile.ps1' />
      <DynamicTextArea path='/.build/windows-registry.ps1' />
      <DynamicTextArea path='/.build/windows-terminal' />
      <DynamicTextArea path='/android/sponsorblock.json' height='350px' />
      <CommonEditorSetupDom is_os_window={true} />

      {/* other links */}
      <div className='form-label'>Windows Related</div>
      <div className='link-group'>
        <LinkButton block href='https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi'>
          WSL Kernel
        </LinkButton>
        <LinkButton block href='https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170'>
          Microsoft Visual C++ Redistributable
        </LinkButton>
        <LinkButton
          block
          href='https://dotnet.microsoft.com/en-us/download/dotnet/thank-you/runtime-desktop-7.0.14-windows-x64-installer?cid=getdotnetcore'>
          Microsoft .NET 7.0 Desktop Runtime (v7.0.14)
        </LinkButton>
      </div>

      <div className='form-label'>SFTP Mount Applications</div>
      <div>
        <div>
          <strong>Using username and password</strong>
        </div>
        <code>\\sshfs\syle@127.0.0.1</code>
      </div>
      <div>
        <div>
          <strong>Using id_rsa keys</strong>
        </div>
        <code>\\sshfs.k\syle@127.0.0.1</code>
      </div>
      <div className='link-group'>
        <LinkButton block href='https://github.com/winfsp/winfsp/releases/latest'>
          WinFSP {/* https://github.com/winfsp/sshfs-win */}
        </LinkButton>
        <LinkButton block href='https://github.com/winfsp/sshfs-win/releases/latest'>
          SSHFS
        </LinkButton>
      </div>

      <div className='form-label'>Other Applications</div>
      <div className='link-group'>
        <LinkButton block href='https://github.com/synle/bashrc/raw/master/.build/Applications.zip'>
          Prebuilt Windows Applications
        </LinkButton>
        <LinkButton block href='https://ninite.com/'>
          Ninite
        </LinkButton>
        {CommonOtherAppDom}
      </div>

      {/* extensions */}
      <div className='form-label'>Extensions</div>
      <div className='link-group'>
        <LinkButton block href='https://apps.microsoft.com/detail/9P9TQF7MRM4R'>
          Windows Subsystem for Linux (Windows 11)
        </LinkButton>
        <LinkButton
          block
          href='https://developer.nvidia.com/cuda-downloads?target_os=Linux&target_arch=x86_64&Distribution=WSL-Ubuntu&target_version=2.0&target_type=runfile_local'>
          CUDA Toolkit Driver for WSL
        </LinkButton>
        <LinkButton block href='https://apps.microsoft.com/store/detail/raw-image-extension/9nctdw2w1bh8'>
          Raw Image Extension
        </LinkButton>
        <LinkButton block href='https://apps.microsoft.com/store/detail/heif-image-extensions/9pmmsr1cgpwg'>
          Heif Image Extension
        </LinkButton>
        <LinkButton href='https://apps.microsoft.com/store/detail/hevc-video-extensions-from-device-manufacturer/9n4wgh0z6vhq'>
          Hevc Video Extension (Device Manager)
        </LinkButton>
        <LinkButton block href='https://apps.microsoft.com/store/detail/mpeg2-video-extension/9n95q1zzpmh4'>
          MPEG-2 Video Extension
        </LinkButton>
        <LinkButton block href='https://apps.microsoft.com/store/detail/av1-video-extension/9mvzqvxjbq9v'>
          AV1 Video Extension
        </LinkButton>
      </div>
    </>
  );
}

function CommonEditorSetupDom(props) {
  const { is_os_darwin_mac, is_os_window, is_os_ubuntu } = props;

  let domVSCodeExtension = <DynamicTextArea path='/.build/vs-code-extensions-linux' />;
  if (is_os_darwin_mac) {
    domVSCodeExtension = <DynamicTextArea path='/.build/vs-code-extensions-macosx' />;
  } else if (is_os_window) {
    domVSCodeExtension = <DynamicTextArea path='/.build/vs-code-extensions-windows' />;
  }

  return (
    <>
      <MultipleUrlDynamicTextArea
        label='VSCode / VSCodium / SublimeText Setup'
        urls={[
          'https://raw.githubusercontent.com/synle/bashrc/master/.build/sublime-text.sh',
          'https://raw.githubusercontent.com/synle/bashrc/master/.build/vs-code.sh',
        ]}
        commentString='#'
      />
      <DynamicTextArea path='/.build/sublime-text-extensions' height='75px' />
      {domVSCodeExtension}
    </>
  );
}

// hook up the context with .Provider value={}
function App() {
  const [appData, setAppData] = useState();
  const [theme, setTheme] = useState(() => {
    return getStorage('theme', 'light');
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    setStorage('theme', newTheme);
  };

  useEffect(() => {
    async function _loadData() {
      try {
        const configsByKey = {};
        const configs = [
          {
            text: 'Setup Windows',
            shouldShowWindowsNotes: true,
            shouldHideOutput: true,
            shouldHideBootstrap: true,
          },
          {
            text: 'Setup Mac OSX',
            shouldShowMacOSXNotes: true,
            shouldHideOutput: true,
            shouldHideBootstrap: true,
          },
          {
            text: 'Setup Linux',
            shouldShowLinuxNotes: true,
            shouldHideOutput: true,
            shouldHideBootstrap: true,
          },
          {
            text: 'Setup Android with Termux',
            shouldShowAndroidNotes: true,
            shouldHideBootstrap: true,
            shouldHideOutput: true,
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
            commandChoice: getStorage('commandChoice') || defaultCommandOption,
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
      } catch (err) {
        // if there's an error, let's fall back and clear storage
        localStorage.clear();
      }
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
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <MainAppContext.Provider
        value={{
          appData,
          setAppData: onSetAppData,
          onInputChange,
        }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'space-between', flexWrap: 'wrap', width: '100%' }}>
          <h1 style={{ margin: 0 }}>{window.document.title}</h1>
          <Settings />
        </div>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <code style={{ display: 'block', whiteSpace: 'nowrap' }}>git clone git@github.com:synle/bashrc.git</code>
        </div>
        <div id='container'>
          <LeftContainer />
          <RightContainer />
          <BottomContainer />
        </div>
      </MainAppContext.Provider>
    </ThemeContext.Provider>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);

import Editor from "@monaco-editor/react";
import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Toastify from "toastify-js";
import "toastify-js/src/toastify.css";
import "./index.scss";

const REPO_PATH_IDENTIFIER = window.REPO_PATH_IDENTIFIER;
const REPO_BRANCH_NAME = window.REPO_BRANCH_NAME;
const BASH_SYLE_COMMON = window.BASH_SYLE_COMMON;
const REPO_URL = `https://github.com/${REPO_PATH_IDENTIFIER}`;
const BASH_PROFILE_CODE_REPO_RAW_URL = `https://raw.githubusercontent.com/${REPO_PATH_IDENTIFIER}/${REPO_BRANCH_NAME}`;
const BASH_PROFILE_CODE_REPO_VIEW_URL = `${REPO_URL}/blob/${REPO_BRANCH_NAME}`;
const BASH_PROFILE_CODE_REPO_EDIT_URL = `${REPO_URL}/edit/${REPO_BRANCH_NAME}`;

const isSystemMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
const isSystemWindows = navigator.platform.indexOf("Win") > -1;
const isSystemUbuntu = !isSystemMac && !isSystemWindows;

// this is the default settings used on the first page load
let defaultCommandOption = "command-option-setup-lightweight-profile";
if (isSystemMac) {
  defaultCommandOption = "command-option-setup-mac-osx";
} else if (isSystemWindows) {
  defaultCommandOption = "command-option-setup-windows";
} else if (isSystemUbuntu) {
  defaultCommandOption = "command-option-setup-linux";
}

/**
 * Writes a value to localStorage under the given key.
 * @param {string} key - The localStorage key to write to.
 * @param {string} value - The value to store.
 */
function setStorage(key, value) {
  localStorage[key] = value;
}

/**
 * Reads a value from localStorage, returning a default if the key is not set or falsy.
 * @param {string} key - The localStorage key to read from.
 * @param {string} [defaultValue] - The fallback value if the key is missing or falsy.
 * @returns {string} The stored value or the default.
 */
function getStorage(key, defaultValue) {
  return localStorage[key] || defaultValue;
}

/**
 * Copies the provided text to the system clipboard and displays a toast notification.
 * @param {string} text - The text to copy. Leading/trailing whitespace is trimmed before copying.
 * @returns {Promise<void>}
 */
async function copyTextToClipboard(text) {
  text = text.trim();

  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.log(err);
  }

  const toast = Toastify({
    text: "Text copied to clipboard.",
    duration: 2000,
    onClick: () => toast.hideToast(),
  });
  toast.showToast();
}

/**
 * Parses, normalizes, deduplicates, and sorts environment variable paths for a given OS.
 * Merges user-provided paths with OS-specific defaults, normalizes path separators,
 * replaces well-known Windows directories with environment variable placeholders,
 * and removes duplicates.
 * @param {string} env - Raw environment variable paths input (newline, semicolon, or colon separated).
 * @param {string} osFlag - The target OS identifier ('windows', 'mac', or other for generic).
 * @param {boolean} shouldUseDefaultEnvs - Whether to include OS-specific default environment paths.
 * @param {string} [envSepToReturn] - The separator to join the resulting paths. Defaults to ';' for Windows/generic or ':' for Mac.
 * @returns {string} The deduplicated, sorted, and joined environment variable paths.
 */
function getEnvVars(env, osFlag, shouldUseDefaultEnvs, envSepToReturn) {
  let pathSep = "/";
  let defaultEnv = "";
  let envSep = /[\n;\:]/g;

  switch (osFlag) {
    case "windows":
      envSep = /[\n;]/g;

      if (!envSepToReturn) {
        envSepToReturn = ";";
      }

      pathSep = "\\";

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
    case "mac":
      if (!envSepToReturn) {
        envSepToReturn = ":";
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
        envSepToReturn = ";";
      }
      break;
  }

  // convert the env var into arrays
  defaultEnv = defaultEnv.split(envSep);

  const newEnv = [...env.split(envSep), ...defaultEnv]
    .map((s) => s.trim())
    .filter((s) => s && !s.includes("#"))
    .filter((s) => s.includes("\\") || s.includes("/") || (osFlag === "windows" && s.includes("%")))
    .map((s) => {
      s = s
        .replace(/[/\\]/g, pathSep)
        .replace(/C:\\Windows/i, "%SystemRoot%")
        .replace(/C:\\Program Files (x86)/i, "%ProgramFiles% (x86)")
        .replace(/C:\\Program Files/i, "%ProgramFiles%")
        .replace(/C:\\Users\\[a-z0-9]+\\AppData\\Local/i, "%LocalAppData%")
        .replace(/C:\\Users\\[a-z0-9]+/i, "%UserProfile%")
        .replace(/%LocalAppData%/i, "%LocalAppData%")
        .replace(/%ProgramFiles%/i, "%ProgramFiles%")
        .replace(/%SystemRoot%/i, "%SystemRoot%")
        .replace(/%SystemRoot%\\System32/i, "%SystemRoot%\\System32")
        .replace(/%UserProfile%/i, "%UserProfile%");

      s = s.replace(/[\\/]+$/, pathSep);

      const lastChar = s[s.length - 1];
      if (lastChar !== "/" && lastChar !== "\\") {
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
const EditorCollapseContext = React.createContext({ collapseAll: false, tick: 0 });

/**
 * Form section for managing the list of scripts to run.
 * Provides inputs for selecting scripts from a datalist, adding/clearing scripts,
 * choosing between live and local runner modes, and specifying a debug write-to-file path.
 * Consumes MainAppContext for form state and input change handling.
 * @returns {React.ReactElement} The script name input form section.
 */
function ScriptNameInputSection() {
  const { appData, setAppData, onInputChange } = useContext(MainAppContext);
  const formValue = appData.formValue;

  const _onScriptChange = () => {
    onInputChange("scriptsToUse", formValue.scriptsToUse, formValue.scriptsToUse.join("\n"));
  };

  const onChangeTestScript = (idx, newValue) => {
    formValue.scriptsToUse[idx] = newValue.trim();
    if (formValue?.scriptsToUse.length === 0) {
      formValue.scriptsToUse.push("software/");
    }
    _onScriptChange();
  };

  const onAddTestScript = () => {
    formValue.scriptsToUse.push("software/");
    _onScriptChange();
  };

  const onClearTestScripts = () => {
    setStorage(`scriptsToUse.${Date.now()}`, formValue.scriptsToUse.join("\n"));
    formValue.scriptsToUse = ["software/"];
    _onScriptChange();
  };

  return (
    <>
      <div className="form-label">
        Scripts To Run
        {formValue.scriptsToUse.map((scriptToUse, idx) => (
          <input
            key={idx}
            style={{ width: "100%", marginTop: "1rem", padding: "0.5rem 0.75rem" }}
            list="scriptToRunOptions"
            type="text"
            placeholder="Script To Run"
            autoFocus
            required
            onBlur={(e) => {
              e.target.value = e.target.value.trim();
              onChangeTestScript(idx, e.target.value);
            }}
            defaultValue={scriptToUse}
          />
        ))}
      </div>

      <div className="form-row">
        <button onClick={onAddTestScript} type="button">
          Add Script
        </button>
        <button onClick={onClearTestScripts} type="button">
          Clear All
        </button>
      </div>
      <datalist id="scriptToRunOptions">
        {appData.scriptToRunOptions.map((option, index) => (
          <option key={index}>{option}</option>
        ))}
      </datalist>

      <div className="form-label">
        Runner
        <div className="form-row">
          <input
            type="radio"
            name="runnerToUse"
            id="runnerToUse-live"
            value="prod"
            onChange={(e) => {
              onInputChange(e.target.name, e.target.value);
            }}
            checked={formValue.runnerToUse === "prod"}
          />
          <label htmlFor="runnerToUse-live">Live Script</label>
          <input
            type="radio"
            name="runnerToUse"
            id="runnerToUse-local"
            value="local"
            onChange={(e) => {
              onInputChange(e.target.name, e.target.value);
            }}
            checked={formValue.runnerToUse !== "prod"}
          />
          <label htmlFor="runnerToUse-local">Local Script</label>
        </div>
      </div>
      <div className="form-label">
        Debug Write To File
        <div className="form-row">
          <input
            id="debugWriteToDir"
            name="debugWriteToDir"
            list="writeToFilePathOptions"
            type="text"
            onBlur={(e) => onInputChange(e.target.name, e.target.value.trim())}
            placeholder="Debug Write To File Path"
            defaultValue={formValue.debugWriteToDir}
          />
          <datalist id="writeToFilePathOptions">
            <option>$(pwd)</option>
            <option>./</option>
            <option>~</option>
          </datalist>
        </div>
      </div>
    </>
  );
}

/**
 * Dropdown section for selecting the target operating system type.
 * Renders a select element with OS options (Windows WSL, Ming_64, Mac OSX, Chrome OS, Ubuntu,
 * Arch Linux/Steam Deck, Android Termux) and displays an OS mismatch warning below it.
 * Consumes MainAppContext for form state and input change handling.
 * @returns {React.ReactElement} The OS selection dropdown section.
 */
function OsSelectionInputSection() {
  const { onInputChange } = useContext(MainAppContext);
  const formValue = useContext(MainAppContext).appData.formValue;

  return (
    <>
      <div className="form-label">
        OS Type
        <div className="form-row">
          <select
            id="osToRun"
            name="osToRun"
            onChange={(e) => {
              onInputChange(e.target.name, e.target.value);
            }}
            defaultValue={formValue.osToRun}
          >
            <option value="windows">Windows with WSL</option>
            <option value="ming_64">Windows with Ming_64</option>
            <option value="mac">Mac OSX</option>
            <option value="chrome_os">Chrome OS with Linux</option>
            <option value="ubuntu">Ubuntu</option>
            <option value="arch_linux_steamdeck">Arch Linux (Steam Deck)</option>
            <option value="android_termux">Android Termux</option>
          </select>
        </div>
      </div>
      <TargetSystemOSWarningDom targetDomString={formValue.osToRun} />
    </>
  );
}

/**
 * Radio button toggle section for enabling or disabling setup dependencies.
 * Allows the user to choose whether dependency installation scripts should be included
 * in the generated output.
 * Consumes MainAppContext for form state and input change handling.
 * @returns {React.ReactElement} The setup dependencies toggle section.
 */
function SetupDependenciesSection() {
  const { onInputChange } = useContext(MainAppContext);
  const formValue = useContext(MainAppContext).appData.formValue;

  return (
    <>
      <div className="form-label">Setup Dependencies</div>
      <div className="form-row">
        <input
          type="radio"
          name="setupDependencies"
          id="setupDependencies-yes"
          value="yes"
          onChange={(e) => {
            onInputChange(e.target.name, e.target.value);
          }}
          checked={formValue.setupDependencies === "yes"}
        />
        <label htmlFor="setupDependencies-yes">Yes</label>
        <input
          type="radio"
          name="setupDependencies"
          id="setupDependencies-no"
          value="no"
          onChange={(e) => {
            onInputChange(e.target.name, e.target.value);
          }}
          checked={formValue.setupDependencies !== "yes"}
        />
        <label htmlFor="setupDependencies-no">No</label>
      </div>
    </>
  );
}

/**
 * Radio button toggle section for enabling or disabling the bootstrap script.
 * When enabled, the generated output will include OS flag exports and environment initialization.
 * Consumes MainAppContext for form state and input change handling.
 * @returns {React.ReactElement} The bootstrap script toggle section.
 */
function BootstrapSection() {
  const { onInputChange } = useContext(MainAppContext);
  const formValue = useContext(MainAppContext).appData.formValue;

  return (
    <>
      <div className="form-label">
        Add Bootstrap Script
        <div className="form-row">
          <input
            type="radio"
            name="addBootstrapScript"
            id="addBootstrapScript-yes"
            value="yes"
            onChange={(e) => {
              onInputChange(e.target.name, e.target.value);
            }}
            checked={formValue.addBootstrapScript === "yes"}
          />
          <label htmlFor="addBootstrapScript-yes">Yes</label>
          <input
            type="radio"
            name="addBootstrapScript"
            id="addBootstrapScript-no"
            value="no"
            onChange={(e) => {
              onInputChange(e.target.name, e.target.value);
            }}
            checked={formValue.addBootstrapScript !== "yes"}
          />
          <label htmlFor="addBootstrapScript-no">No</label>
        </div>
      </div>
    </>
  );
}

/**
 * Textarea section for entering environment variable paths.
 * Displays an enhanced text area pre-populated with consolidated env vars (optionally
 * merged with OS-specific defaults), and a checkbox to toggle default env inclusion.
 * Consumes MainAppContext for form state and input change handling.
 * @returns {React.ReactElement} The environment variable paths input section.
 */
function EnvInputSection() {
  const { onInputChange } = useContext(MainAppContext);
  const formValue = useContext(MainAppContext).appData.formValue;

  let consolidatedEnvInputValue = formValue.envInputValue;
  if (formValue.shouldAddDefaultEnvs === "yes") {
    consolidatedEnvInputValue = getEnvVars(formValue.envInputValue, formValue.osToRun, formValue.shouldAddDefaultEnvs === "yes", "\n");
  }

  return (
    <>
      <EnhancedTextArea
        id="envInputValue"
        name="envInputValue"
        placeholder="Env Var Input"
        onBlur={(e) => {
          onInputChange(e.target.name, e.target.value.trim());
        }}
        defaultValue={consolidatedEnvInputValue}
      />
      <div className="form-label">
        Add Default Env
        <div className="form-row">
          <input
            type="checkbox"
            id="shouldAddDefaultEnvs"
            name="shouldAddDefaultEnvs"
            checked={formValue.shouldAddDefaultEnvs === "yes"}
            onChange={(e) => {
              onInputChange(e.target.name, e.target.checked ? "yes" : "no");
              location.reload(); // TODO: improve this - used to trigger the updates of env variable
            }}
          />
        </div>
      </div>
    </>
  );
}

/**
 * Renders the generated shell script output by interpolating mustache-style template
 * variables (e.g., OS flags, selected scripts, env vars) from the current form state
 * into the provided script template string.
 * @param {Object} props
 * @param {string} props.script - The script template string containing {{KEY}} placeholders.
 * @returns {React.ReactElement} An EnhancedTextArea displaying the rendered script output.
 */
function ScriptOutputSection({ script }) {
  const { appData } = useContext(MainAppContext);
  const formValue = appData.formValue;

  const formValueOutput = useMemo(() => {
    const osFlag = formValue.osToRun;
    const osFlags = {
      is_os_darwin_mac: osFlag === "mac",
      is_os_window: osFlag === "windows",
      is_os_wsl: osFlag === "windows",
      is_os_ubuntu: ["windows", "chrome_os", "ubuntu"].indexOf(osFlag) >= 0,
      is_os_chromeos: osFlag === "chrome_os",
      is_os_mingw64: osFlag === "ming_64",
      is_os_android_termux: osFlag === "android_termux",
      is_os_arch_linux: osFlag.includes("arch_linux"),
      is_os_steamdeck: osFlag === "arch_linux_steamdeck",
    };
    const osKeys = Object.keys(osFlags);

    // Build the template variables
    const templateVars = {
      REPO_PATH_IDENTIFIER: REPO_PATH_IDENTIFIER,
      REPO_BRANCH_NAME: REPO_BRANCH_NAME,
      REPO_URL: REPO_URL,
      BASH_PROFILE_CODE_REPO_RAW_URL: BASH_PROFILE_CODE_REPO_RAW_URL,
      SELECT_SCRIPTS: formValue.scriptsToUse.join("\n"),
      DEBUG_WRITE_TO_DIR: formValue.debugWriteToDir ? `&& export DEBUG_WRITE_TO_DIR="${formValue.debugWriteToDir}"` : "",
      SELECTED_RUNNER_MODE: formValue.runnerToUse,
      OS_FLAGS:
        formValue.addBootstrapScript === "yes"
          ? (
              [
                "sudo echo '> Initializing Environment'",
                `echo """\n${osKeys
                  .map((key) => `export ${key}='${osFlags[key] ? "1" : "0"}'`)
                  .join("\n")}\n""" > ${window.BASH_SYLE_COMMON} && source ${window.BASH_SYLE_COMMON}`,
              ].join(" && \\\n") + " && "
            ).trim()
          : "",
      SETUP_DEPS: formValue.setupDependencies === "yes" ? (appData.setupDepsScript || "") + "\n" : "",
      SETUP_HOSTS_SCRIPT: appData.setupHostsScript || "",
      IP_ADDRESS_MAPPING_CONFIGS: appData.ipAddressMappingConfigs || "",
      ENV_VARS: `
${getEnvVars(formValue.envInputValue, formValue.osToRun, formValue.shouldAddDefaultEnvs === "yes")}

===

${getEnvVars(formValue.envInputValue, formValue.osToRun, formValue.shouldAddDefaultEnvs === "yes", "\n")}
      `.trim(),
    };

    // Mustache-style template rendering: replaces all {{KEY}} with corresponding values
    const rendered = script.replace(/\{\{(\w+)\}\}/g, (_, key) => templateVars[key] || "");

    return rendered
      .split("\\")
      .filter((s) => s.trim())
      .join("\\")
      .trim();
  }, [formValue, script]);

  return <EnhancedTextArea id="formValueOutput" placeholder="Output" readOnly value={formValueOutput} />;
}

/**
 * Main content area that renders the body of the currently selected configuration tab.
 * Provides collapse/expand controls for all editor sections and wraps the content
 * in an EditorCollapseContext provider for coordinated collapse state.
 * @returns {React.ReactElement} The main body container with collapse controls and selected config body.
 */
function MainBodyContainer() {
  const { appData } = useContext(MainAppContext);
  const selectedConfig = appData.configs.find((config) => config.idx === appData.formValue.commandChoice);
  const [collapseSignal, setCollapseSignal] = useState({ collapseAll: false, tick: 0 });

  return (
    <EditorCollapseContext.Provider value={{ collapseAll: collapseSignal.collapseAll, tick: collapseSignal.tick }}>
      <div id="mainBodyContainer">
        <div className="editor-collapse-controls">
          <ActionButton onClick={() => setCollapseSignal((prev) => ({ collapseAll: true, tick: prev.tick + 1 }))}>
            Collapse All
          </ActionButton>
          <ActionButton onClick={() => setCollapseSignal((prev) => ({ collapseAll: false, tick: prev.tick + 1 }))}>Expand All</ActionButton>
        </div>
        {selectedConfig.renderBody()}
      </div>
    </EditorCollapseContext.Provider>
  );
}

/**
 * Top tab bar navigation that renders a button for each available configuration.
 * Highlights the currently selected tab and triggers commandChoice changes on click.
 * Consumes MainAppContext for the configs list and input change handling.
 * @returns {React.ReactElement} The top navigation tab bar.
 */
function TopNavigationContainer() {
  const { appData, onInputChange } = useContext(MainAppContext);
  const formValue = appData.formValue;

  return (
    <div id="topNavigationContainer">
      <div className="nav-radio-group">
        {appData.configs.map((config) => (
          <button
            key={config.idx}
            className={formValue.commandChoice === config.idx ? "selected" : ""}
            onClick={() => onInputChange("commandChoice", config.idx)}
          >
            {config.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Footer section containing links to the GitHub repository, pre-compiled configs,
 * and the bashrc code browser.
 * @returns {React.ReactElement} The bottom footer container with repository links.
 */
function BottomContainer() {
  return (
    <div id="bottomContainer">
      <hr />
      <div className="link-group">
        <LinkButton href={REPO_URL}>Repo</LinkButton>
        <LinkButton href={`${BASH_PROFILE_CODE_REPO_VIEW_URL}/.build`}>Pre-compiled Configs</LinkButton>
        <LinkButton href={`${REPO_URL}/find/${REPO_BRANCH_NAME}`}>Bashrc Code</LinkButton>
      </div>
    </div>
  );
}

/**
 * An anchor element styled as a button that opens links in a new tab.
 * Optionally wraps the anchor in a div for block-level display.
 * @param {Object} props
 * @param {React.ReactNode} props.children - The button label content.
 * @param {boolean} [props.block=false] - If true, wraps the anchor in a div for block-level layout.
 * @param {string} props.href - The URL to link to.
 * @returns {React.ReactElement} An anchor element with role="button" and target="_blank".
 */
function LinkButton(props) {
  const { children, block, ...restProps } = props;

  if (block) {
    return (
      <div>
        <a {...restProps} role="button" target="_blank">
          {children}
        </a>
      </div>
    );
  }
  return (
    <a {...restProps} role="button" target="_blank">
      {children}
    </a>
  );
}

/**
 * An anchor element rendered as a plain text link that opens in a new tab.
 * Optionally wraps the anchor in a div for block-level display.
 * @param {Object} props
 * @param {React.ReactNode} props.children - The link text content.
 * @param {boolean} [props.block=false] - If true, wraps the anchor in a div for block-level layout.
 * @param {string} props.href - The URL to link to.
 * @returns {React.ReactElement} An anchor element with target="_blank".
 */
function LinkText(props) {
  const { children, block, ...restProps } = props;

  if (block) {
    return (
      <div>
        <a {...restProps} target="_blank">
          {children}
        </a>
      </div>
    );
  }
  return (
    <a {...restProps} target="_blank">
      {children}
    </a>
  );
}

/**
 * A simple button element that passes through all props to the underlying HTML button.
 * @param {Object} props
 * @param {React.ReactNode} props.children - The button label content.
 * @param {Function} [props.onClick] - Click handler for the button.
 * @returns {React.ReactElement} A button element.
 */
function ActionButton(props) {
  const { children, ...restProps } = props;

  return <button {...restProps}>{children}</button>;
}

/**
 * Fetches text content from a remote URL and displays it in an EnhancedTextArea.
 * If a relative path is provided, it is resolved against the BASH_PROFILE_CODE_REPO_RAW_URL base.
 * @param {Object} props
 * @param {string} [props.path] - Relative path to the file within the bashrc repository.
 * @param {string} [props.url] - Full URL to fetch content from. Overrides path if provided.
 * @param {string} [props.height] - CSS height for the text area.
 * @returns {React.ReactElement} A read-only EnhancedTextArea with the fetched content.
 */
function DynamicTextArea(props) {
  let { path, url, height } = props;
  const [text, setText] = useState("");
  const [success, setSuccess] = useState(true);

  url = url || `${BASH_PROFILE_CODE_REPO_RAW_URL}/${path}`;

  useEffect(() => {
    async function _load() {
      setText("");
      setText(
        await fetch(url)
          .then((r) => {
            setSuccess(r.ok);
            return r;
          })
          .then((r) => r.text())
          .then((r) => r.trim())
          .catch((r) => setSuccess(false)),
      );
    }

    _load();
  }, [url]);

  return <EnhancedTextArea height={height} url={url} value={text} error={!success} readOnly />;
}

/**
 * Fetches text content from multiple remote URLs, concatenates them with comment headers,
 * and displays the combined result in an EnhancedTextArea.
 * @param {Object} props
 * @param {string[]} props.urls - Array of URLs to fetch content from.
 * @param {string} [props.height] - CSS height for the text area.
 * @param {string} props.commentString - The comment prefix to use before each URL header (e.g., '#').
 * @param {string} [props.label] - Optional label for the text area. Defaults to the joined URLs.
 * @returns {React.ReactElement} A read-only EnhancedTextArea with the combined fetched content.
 */
function MultipleUrlDynamicTextArea(props) {
  const { urls, height, commentString } = props;
  const [text, setText] = useState("");
  const [label, setLabel] = useState("");

  useEffect(() => {
    async function _load() {
      setText("");
      setLabel(props.label || urls.join(", "));

      let resp = [];
      for (const url of urls) {
        const newInput = await fetch(url)
          .then((r) => r.text())
          .then((r) => r.trim());

        resp.push(`${commentString} ${url}\n${newInput}`);
      }

      setText(resp.join("\n\n"));
    }

    _load();
  }, []);

  return <EnhancedTextArea height={height} label={label} value={text} readOnly />;
}

/**
 * Detects a programming language identifier from a file URL based on its extension.
 * Maps common file extensions (e.g., .sh, .py, .js, .md) to Monaco Editor language identifiers.
 * @param {string} url - The file URL to extract the extension from.
 * @returns {string|null} The detected language identifier, or null if the extension is not recognized.
 */
function detectLanguageFromUrl(url) {
  if (!url) return null;

  const extension = url.split(".").pop().toLowerCase();
  const extensionMap = {
    sh: "shell",
    bash: "shell",
    md: "markdown",
    ps1: "powershell",
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    yml: "yaml",
    yaml: "yaml",
    py: "python",
    rb: "ruby",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    php: "php",
    html: "html",
    css: "css",
    xml: "xml",
    sql: "sql",
  };

  return extensionMap[extension] || null;
}

/**
 * Detects a programming language identifier from a label string based on its file extension.
 * Extracts the extension from the label and delegates to detectLanguageFromUrl.
 * @param {string} label - The label or filename to extract the extension from.
 * @returns {string|null} The detected language identifier, or null if the extension is not recognized.
 */
function detectLanguageFromLabel(label) {
  if (!label) return null;

  const extension = label.split(".").pop().toLowerCase();
  return detectLanguageFromUrl(extension);
}

/**
 * Heuristically detects a programming language from the content of a file.
 * Checks for shebangs, markdown headers, PowerShell cmdlets, common shell patterns,
 * and valid JSON. Defaults to 'shell' if no specific language is detected.
 * @param {string} content - The text content to analyze.
 * @returns {string} The detected language identifier (e.g., 'shell', 'python', 'markdown', 'json').
 */
function detectLanguageFromContent(content) {
  if (!content || typeof content !== "string") return "shell";

  const trimmedContent = content.trim();

  // Check for shebang
  if (trimmedContent.startsWith("#!")) {
    if (trimmedContent.includes("/bash") || trimmedContent.includes("/sh")) return "shell";
    if (trimmedContent.includes("/python")) return "python";
    if (trimmedContent.includes("/node")) return "javascript";
  }

  // Check for markdown headers
  if (/^#+\s/.test(trimmedContent) || /^-{3,}$|^\*{3,}$/m.test(trimmedContent)) {
    return "markdown";
  }

  // Check for PowerShell cmdlets
  if (/\b(Get-|Set-|New-|Remove-|Invoke-|Test-|Write-Host|param\()/i.test(trimmedContent)) {
    return "powershell";
  }

  // Check for common shell patterns
  if (/^(export|alias|function|sudo|apt-get|yum|brew|echo|cd|ls|mkdir)\s/m.test(trimmedContent)) {
    return "shell";
  }

  // Check for JSON
  if (/^\s*[\{\[]/.test(trimmedContent) && /[\}\]]\s*$/.test(trimmedContent)) {
    try {
      JSON.parse(trimmedContent);
      return "json";
    } catch (e) {}
  }

  // Default to shell for most bash scripts
  return "shell";
}

/**
 * Full-screen overlay modal component with a semi-transparent dark background.
 * Renders a title bar with a close button and a content area. Clicking the backdrop
 * closes the modal.
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is currently visible.
 * @param {Function} props.onClose - Callback invoked when the modal should be closed.
 * @param {string} [props.title] - Optional title displayed in the modal header.
 * @param {React.ReactNode} props.children - The content to render inside the modal body.
 * @returns {React.ReactElement|null} The modal overlay, or null if not open.
 */
function Modal(props) {
  const { isOpen, onClose, title, children } = props;

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          color: "var(--text)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 style={{ margin: 0, fontSize: "1.5rem" }}>{title}</h2>}
        <button
          onClick={onClose}
          style={{
            marginLeft: "auto",
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          Close (ESC)
        </button>
      </div>
      <div
        style={{
          flex: 1,
          backgroundColor: "var(--bg-secondary)",
          borderRadius: "4px",
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A button that opens a full-screen read-only Monaco Editor modal to view text content.
 * Supports ESC key to close the modal. Auto-detects the language from the label or content.
 * @param {Object} props
 * @param {string} props.value - The text content to display in the full-screen editor.
 * @param {string} [props.label] - Optional label used as the modal title and for language detection.
 * @returns {React.ReactElement} A button and a modal containing a read-only Monaco Editor.
 */
function FullScreenTextViewer(props) {
  const { value, label } = props;
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useContext(ThemeContext);
  const editorTheme = theme === "dark" ? "vs-dark" : "light";

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const language = detectLanguageFromLabel(label) || detectLanguageFromContent(value);

  return (
    <>
      <ActionButton onClick={() => setIsOpen(true)}>Fullscreen</ActionButton>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={label}>
        <Editor
          height="100%"
          language={language}
          value={value || ""}
          theme={editorTheme}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            lineNumbers: "on",
            wordWrap: "on",
            automaticLayout: true,
          }}
        />
      </Modal>
    </>
  );
}

/**
 * A dropdown menu component that uses the first child as the trigger button and
 * renders remaining children as dropdown items. Supports click-outside and ESC key
 * dismissal, and auto-closes after an item is clicked.
 * @param {Object} props
 * @param {string} [props.type=''] - Optional CSS class suffix for the dropdown content container.
 * @param {React.ReactNode} props.children - The first child is used as the trigger button; subsequent children are dropdown items.
 * @returns {React.ReactElement} The dropdown container with trigger and conditional dropdown content.
 */
function DropdownButtons(props) {
  const { type = "", children } = props;
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [triggerButton, ...buttonsElems] = children;

  const toggleDropdown = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Close dropdown when clicking outside
  useLayoutEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        closeDropdown();
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape" && isOpen) {
        closeDropdown();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [isOpen, closeDropdown]);

  // Clone trigger button to add onClick handler
  const enhancedTrigger = React.cloneElement(triggerButton, {
    onClick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown();
      if (triggerButton.props.onClick) {
        triggerButton.props.onClick(e);
      }
    },
    "aria-expanded": isOpen,
    "aria-haspopup": "true",
  });

  // Wrap buttons to close dropdown on click
  const enhancedButtons = React.Children.map(buttonsElems, (child) => {
    if (!child) return null;
    return React.cloneElement(child, {
      onClick: (e) => {
        if (child.props.onClick) {
          child.props.onClick(e);
        }
        // Close dropdown after action
        setTimeout(closeDropdown, 100);
      },
    });
  });

  return (
    <div className="dropdown" ref={dropdownRef}>
      {enhancedTrigger}
      {isOpen && <div className={`dropdown-content ${type}`.trim()}>{enhancedButtons}</div>}
    </div>
  );
}

/**
 * A button that toggles between dark and light themes.
 * Consumes ThemeContext to read the current theme and trigger the toggle.
 * @returns {React.ReactElement} A button displaying "Light Mode" or "Dark Mode" based on the current theme.
 */
function ThemeToggle() {
  const { theme, toggleTheme } = useContext(ThemeContext);

  return <button onClick={toggleTheme}>{theme === "dark" ? "Light Mode" : "Dark Mode"}</button>;
}

/**
 * Settings dropdown menu containing the ThemeToggle button.
 * Renders a DropdownButtons component with "Settings" as the trigger label.
 * @returns {React.ReactElement} A dropdown with settings options.
 */
function Settings() {
  return (
    <DropdownButtons>
      <button className="dropdown-trigger">Settings</button>
      <ThemeToggle />
    </DropdownButtons>
  );
}

/**
 * A Monaco Editor-based text display component with action buttons for copy, edit, view raw,
 * fullscreen, and collapse/expand. Auto-detects the language from the URL or content,
 * computes editor height from line count, and respects the global collapse context.
 * @param {Object} props
 * @param {string} [props.url] - Optional URL of the source file, used for language detection and edit/view links.
 * @param {string} [props.label] - Optional label displayed as the editor header. Falls back to placeholder or derived URL.
 * @param {string} [props.height] - Optional CSS height override. If omitted, height is computed from content line count.
 * @param {string} [props.placeholder] - Fallback label text if no label or URL is provided.
 * @param {string} [props.value] - The text content to display in the editor.
 * @param {string} [props.defaultValue] - Fallback text content if value is not provided.
 * @param {boolean} [props.readOnly] - Whether the editor should be read-only.
 * @returns {React.ReactElement} The enhanced text area section with header actions and Monaco Editor.
 */
/**
 * A reusable Monaco Editor wrapper component.
 * @param {Object} props
 * @param {string} props.content - The text content to display in the editor.
 * @param {string} [props.syntax] - The language/syntax to use. If not provided, auto-detected from content.
 * @param {string} [props.height] - The editor height (e.g., '300px'). If not provided, auto-calculated from content line count.
 * @param {boolean} [props.readOnly] - Whether the editor is read-only.
 * @param {Object} [props.options] - Additional Monaco Editor options to merge.
 * @returns {React.ReactElement} A Monaco Editor instance.
 */
function CodeEditor({ content = "", syntax, height, readOnly = false, options: extraOptions, ...restProps }) {
  const { theme } = useContext(ThemeContext);
  const editorTheme = theme === "dark" ? "vs-dark" : "light";
  const language = syntax || detectLanguageFromContent(content);

  // Calculate height based on content line count so the editor stretches to fit
  const lineHeight = 20;
  const padding = 20;
  const lineCount = content.split("\n").length;
  const computedHeight = height || `${Math.max(100, lineCount * lineHeight + padding)}px`;

  return (
    <Editor
      height={computedHeight}
      language={language}
      value={content}
      theme={editorTheme}
      options={{
        readOnly,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        scrollbar: { vertical: "hidden", horizontal: "hidden", handleMouseWheel: false },
        fontSize: 13,
        lineNumbers: "on",
        wordWrap: "on",
        automaticLayout: true,
        ...extraOptions,
      }}
      {...restProps}
    />
  );
}

function EnhancedTextArea(props) {
  let { url, label, height, error, ...restProps } = props;
  label = label || props.placeholder;

  const content = restProps.value || restProps.defaultValue || "";
  const { collapseAll, tick } = useContext(EditorCollapseContext);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(collapseAll);
  }, [collapseAll, tick]);

  // Detect language: first try from URL, then from content
  const languageFromUrl = detectLanguageFromUrl(url);
  const syntax = languageFromUrl || undefined;

  let editUrl = "";
  let formattedUrl = "";

  if (url) {
    const shortUrl = url.replace(`${BASH_PROFILE_CODE_REPO_RAW_URL}/`, "").replace(/^(\.\/|\/)+/, "");
    label = label || shortUrl;

    editUrl = `${BASH_PROFILE_CODE_REPO_EDIT_URL}/${shortUrl}`;
    formattedUrl = `${BASH_PROFILE_CODE_REPO_VIEW_URL}/${shortUrl}`;
  }

  return (
    <div className={collapsed ? "editor-section editor-collapsed" : "editor-section"}>
      <div className="editor-header">
        <div>{formattedUrl ? <LinkText href={formattedUrl}>{label}</LinkText> : <span>{label}</span>}</div>
        <ActionButton onClick={() => copyTextToClipboard(content)}>Copy</ActionButton>
        {editUrl && <LinkButton href={editUrl}>Edit</LinkButton>}
        {url && <LinkButton href={url}>View Raw</LinkButton>}
        <FullScreenTextViewer value={content} label={label} />
        <ActionButton onClick={() => setCollapsed(!collapsed)}>{collapsed ? "Expand" : "Collapse"}</ActionButton>
      </div>
      {error ? (
        <div className="text-error">Content Error: {content}</div>
      ) : (
        !collapsed && <CodeEditor content={content} syntax={syntax} height={height} readOnly={restProps.readOnly || false} />
      )}
    </div>
  );
}

/**
 * Common applciations links DOM
 */
const CommonOtherAppDom = (
  <>
    <LinkButton block href={`${BASH_PROFILE_CODE_REPO_VIEW_URL}/fonts`}>
      Custom Fonts
    </LinkButton>
    <LinkButton block href="https://www.sublimetext.com/download">
      Sublime Text
    </LinkButton>
    <LinkButton block href="https://www.sublimemerge.com/download">
      Sublime Merge
    </LinkButton>
    <LinkButton block href="https://www.charlesproxy.com/download/latest-release/">
      Charles Proxy
    </LinkButton>
    <LinkButton block href="https://ultimaker.com/software/ultimaker-cura/#links">
      Ultimaker Cura
    </LinkButton>
    <LinkButton block href="https://design.cricut.com/#/">
      Cricut Design Space
    </LinkButton>
    <LinkButton block href="https://download.battle.net/en-us/?product=bnetdesk">
      Battle Net
    </LinkButton>
  </>
);

/**
 * Displays a warning or confirmation message when the selected target OS does not
 * match (or matches) the user's current system. Renders nothing if the target is
 * not in the known OS map.
 * @param {Object} props
 * @param {string} [props.targetDomString] - The target OS identifier ('mac', 'windows', 'ubuntu', 'android').
 * @param {boolean} [props.isSystemMac] - Whether the current system is macOS.
 * @param {boolean} [props.isSystemWindows] - Whether the current system is Windows.
 * @param {boolean} [props.isSystemUbuntu] - Whether the current system is Ubuntu/Linux.
 * @param {boolean} [props.isSystemAndroid] - Whether the current system is Android.
 * @returns {React.ReactElement|null} A styled heading with the match/mismatch message, or null.
 */
function TargetSystemOSWarningDom({ targetDomString, isSystemMac, isSystemWindows, isSystemUbuntu, isSystemAndroid }) {
  // 1. Map target strings to their corresponding system detection booleans
  const osMap = {
    mac: { name: "OSX", isMatch: isSystemMac },
    windows: { name: "Windows", isMatch: isSystemWindows },
    ubuntu: { name: "Linux (Ubuntu)", isMatch: isSystemUbuntu },
    android: { name: "Android", isMatch: isSystemAndroid },
  };

  const target = osMap[targetDomString];

  // 2. Guard clause: if the target isn't in our map, render nothing
  if (!target) return null;

  // 3. Handle the Android edge case or standard mismatch logic
  if (targetDomString === "android") {
    return <h3 className="text-error">This is only meant for Android.</h3>;
  }

  return (
    <h3 className={target.isMatch ? "text-info" : "text-error"}>
      {target.isMatch ? "OS Choice matches your OS" : `OS choice (${target.name}) doesn't match your system.`}
    </h3>
  );
}

/**
 * macOS setup notes page. Renders the bootstrap script, README, font/git/SSH/inputrc/vim configs,
 * SponsorBlock settings, common editor setup for macOS, and links to other useful applications.
 * @returns {React.ReactElement} The macOS setup notes section.
 */
function MacOSXNotesDom() {
  return (
    <>
      <TargetSystemOSWarningDom targetDomString="mac" />
      <DynamicTextArea path="/bootstrap/setup.sh" />
      <DynamicTextArea path="/mac/README.md" />
      <DynamicTextArea path="/.build/font.sh" />
      <DynamicTextArea path="/.build/gitconfig" />
      <DynamicTextArea path="/.build/ssh-config" />
      <DynamicTextArea path="/.build/inputrc" />
      <DynamicTextArea path="/.build/vimrc" />
      <DynamicTextArea path="/android/sponsorblock.json" />
      <CommonEditorSetupDom is_os_darwin_mac={true} />

      {/* Mac */}
      <div className="form-label">Other Applications</div>
      <div className="link-group">{CommonOtherAppDom}</div>
    </>
  );
}

/**
 * Linux setup notes page. Renders the bootstrap script, Linux Mint config, README,
 * font/git/gitignore/SSH/inputrc/vim configs, SponsorBlock settings, common editor setup,
 * and links to other useful applications.
 * @returns {React.ReactElement} The Linux setup notes section.
 */
function LinuxNotesDom() {
  return (
    <>
      <TargetSystemOSWarningDom is_os_ubuntu={true} />
      <DynamicTextArea path="/bootstrap/setup.sh" />
      <DynamicTextArea path="/linux/linux-mint-config.sh" />
      <DynamicTextArea path="/linux/README.md" />
      <DynamicTextArea path="/.build/font.sh" />
      <DynamicTextArea path="/.build/gitconfig" />
      <DynamicTextArea path="/.build/gitignore_global" />
      <DynamicTextArea path="/.build/ssh-config" />
      <DynamicTextArea path="/.build/inputrc" />
      <DynamicTextArea path="/.build/vimrc" />
      <DynamicTextArea path="/android/sponsorblock.json" />
      <CommonEditorSetupDom />
      {/* Linux */}
      <div className="form-label">Other Applications</div>
      <div className="link-group">{CommonOtherAppDom}</div>
    </>
  );
}

/**
 * Android/Termux setup notes page. Renders the Android shell script, SponsorBlock settings,
 * ReVanced Extended patch configs for YouTube and YouTube Music, and links to Android
 * applications (MicroG, YouTube, YouTube Music, Google News, Nova Companion).
 * @returns {React.ReactElement} The Android/Termux setup notes section.
 */
function AndroidNotesDom() {
  return (
    <>
      <TargetSystemOSWarningDom is_os_android_termux={true} />

      <DynamicTextArea path="/android/android.sh" />
      <DynamicTextArea path="/android/sponsorblock.json" />
      <DynamicTextArea path="/android/rvx-yt.txt" />
      <DynamicTextArea path="/android/rvx-yt-music.txt" />

      {/* Android */}
      <div className="form-label">Android Applications</div>
      <div className="link-group">
        <LinkButton block href="https://vanced.to/gmscore-microg">
          MicroG
        </LinkButton>
        <LinkButton block href="https://vanced.to/revanced-google-photos">
          Google photo
        </LinkButton>
        <LinkButton block href="https://vanced.to/revanced-youtube-extended">
          Youtube
        </LinkButton>
        <LinkButton block href="https://vanced.to/revanced-youtube-music-extended">
          Youtube Music
        </LinkButton>
        <LinkButton block href="https://vanced.to/revanced-google-news">
          Google News
        </LinkButton>
        <LinkButton
          block
          href="https://teslacoilapps.com/tesladirect/download.pl?packageName=com.teslacoilsw.launcherclientproxy&betaType=public"
        >
          Nova Companion
        </LinkButton>
      </div>
    </>
  );
}

/**
 * Windows setup notes page. Renders the bootstrap script, README, PowerShell dependencies,
 * font config, PowerShell profile, Windows Terminal settings, SponsorBlock settings,
 * common editor setup for Windows, and links to WSL, SFTP mount tools, Visual C++
 * redistributable, .NET runtime, Ninite, prebuilt applications, and Windows extensions.
 * @returns {React.ReactElement} The Windows setup notes section.
 */
function WindowsNotesDom() {
  return (
    <>
      <TargetSystemOSWarningDom is_os_window={true} />
      <DynamicTextArea path="/bootstrap/setup.sh" />
      <DynamicTextArea path="/windows/README.md" />
      <DynamicTextArea path="/bootstrap/dependencies-windows.ps1" />
      <DynamicTextArea path="/.build/font.sh" />
      <DynamicTextArea path="/.build/windows-terminal" />
      <DynamicTextArea path="/android/sponsorblock.json" />
      <CommonEditorSetupDom is_os_window={true} />

      {/* other links */}
      <div className="form-label">Windows Related</div>
      <div className="link-group">
        <LinkButton block href="https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi">
          WSL Kernel
        </LinkButton>
        <LinkButton block href="https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170">
          Microsoft Visual C++ Redistributable
        </LinkButton>
        <LinkButton
          block
          href="https://dotnet.microsoft.com/en-us/download/dotnet/thank-you/runtime-desktop-7.0.14-windows-x64-installer?cid=getdotnetcore"
        >
          Microsoft .NET 7.0 Desktop Runtime (v7.0.14)
        </LinkButton>
      </div>

      <div className="form-label">SFTP Mount Applications</div>
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
      <div className="link-group">
        <LinkButton block href="https://github.com/winfsp/winfsp/releases/latest">
          WinFSP {/* https://github.com/winfsp/sshfs-win */}
        </LinkButton>
        <LinkButton block href="https://github.com/winfsp/sshfs-win/releases/latest">
          SSHFS
        </LinkButton>
      </div>

      <div className="form-label">Other Applications</div>
      <div className="link-group">
        <LinkButton block href={`${BASH_PROFILE_CODE_REPO_RAW_URL}/.build/Applications.zip`}>
          Prebuilt Windows Applications
        </LinkButton>
        <LinkButton block href="https://ninite.com/">
          Ninite
        </LinkButton>
        {CommonOtherAppDom}
      </div>

      {/* extensions */}
      <div className="form-label">Extensions</div>
      <div className="link-group">
        <LinkButton block href="https://apps.microsoft.com/detail/9P9TQF7MRM4R">
          Windows Subsystem for Linux (Windows 11)
        </LinkButton>
        <LinkButton
          block
          href="https://developer.nvidia.com/cuda-downloads?target_os=Linux&target_arch=x86_64&Distribution=WSL-Ubuntu&target_version=2.0&target_type=runfile_local"
        >
          CUDA Toolkit Driver for WSL
        </LinkButton>
        <LinkButton block href="https://apps.microsoft.com/store/detail/raw-image-extension/9nctdw2w1bh8">
          Raw Image Extension
        </LinkButton>
        <LinkButton block href="https://apps.microsoft.com/store/detail/heif-image-extensions/9pmmsr1cgpwg">
          Heif Image Extension
        </LinkButton>
        <LinkButton href="https://apps.microsoft.com/store/detail/hevc-video-extensions-from-device-manufacturer/9n4wgh0z6vhq">
          Hevc Video Extension (Device Manager)
        </LinkButton>
        <LinkButton block href="https://apps.microsoft.com/store/detail/mpeg2-video-extension/9n95q1zzpmh4">
          MPEG-2 Video Extension
        </LinkButton>
        <LinkButton block href="https://apps.microsoft.com/store/detail/av1-video-extension/9mvzqvxjbq9v">
          AV1 Video Extension
        </LinkButton>
      </div>
    </>
  );
}

/**
 * Shared editor setup section that renders VS Code/VSCodium/Sublime Text setup scripts
 * and the appropriate VS Code extension list for the target OS.
 * @param {Object} props
 * @param {boolean} [props.is_os_darwin_mac] - If true, shows macOS VS Code extensions.
 * @param {boolean} [props.is_os_window] - If true, shows Windows VS Code extensions.
 * @param {boolean} [props.is_os_ubuntu] - If true (or default), shows Linux VS Code extensions.
 * @returns {React.ReactElement} The combined editor setup scripts and extension lists.
 */
function CommonEditorSetupDom(props) {
  const { is_os_darwin_mac, is_os_window, is_os_ubuntu } = props;

  let domVSCodeExtension = <DynamicTextArea path="/.build/vs-code-ext-linux" />;
  if (is_os_darwin_mac) {
    domVSCodeExtension = <DynamicTextArea path="/.build/vs-code-ext-macosx" />;
  } else if (is_os_window) {
    domVSCodeExtension = <DynamicTextArea path="/.build/vs-code-ext-windows" />;
  }

  return (
    <>
      <MultipleUrlDynamicTextArea
        label="VSCode / VSCodium / SublimeText Setup"
        urls={[
          `${BASH_PROFILE_CODE_REPO_RAW_URL}/software/scripts/sublime-text-setup`,
          `${BASH_PROFILE_CODE_REPO_RAW_URL}/software/scripts/vs-code-setup`,
        ]}
        commentString="#"
      />
      <DynamicTextArea path="/.build/sublime-text-ext" />
      {domVSCodeExtension}
    </>
  );
}

/**
 * Root application component. Initializes app state by fetching remote configuration data
 * (setup scripts, script options, hosts config, IP mappings), manages theme state via
 * ThemeContext, provides form state and input handling via MainAppContext, and renders
 * the full application layout (header, navigation tabs, main body, footer).
 * Falls back by clearing localStorage if data loading fails.
 * @returns {React.ReactElement|null} The full application wrapped in context providers, or null while loading.
 */
function App() {
  const [appData, setAppData] = useState();
  const [theme, setTheme] = useState(() => {
    return getStorage("theme", "light");
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    setStorage("theme", newTheme);
  };

  useEffect(() => {
    async function _loadData() {
      try {
        const configsByKey = {};

        const [setupDepsScript, scriptToRunOptions, setupHostsScript, ipAddressMappingConfigs] = await Promise.all([
          fetch(`${BASH_PROFILE_CODE_REPO_RAW_URL}/bootstrap/setup.sh`)
            .then((res) => res.text())
            .then((res) => res.trim()),
          fetch(`${BASH_PROFILE_CODE_REPO_RAW_URL}/software/metadata/script-list.config`)
            .then((res) => res.text())
            .then((res) =>
              res
                .split("\n")
                .map((s) => s.replace("./", "").trim())
                .filter((s) => !!s && (s.includes(".js") || s.includes(".sh")))
                .sort(),
            ),
          fetch(`${BASH_PROFILE_CODE_REPO_RAW_URL}/package.json`)
            .then((res) => res.json())
            .then((pkg) => pkg.scripts["setup:hosts"] || ""),
          fetch(`${BASH_PROFILE_CODE_REPO_RAW_URL}/software/metadata/ip-address.config`)
            .then((res) => res.text())
            .then((s) =>
              s
                .trim()
                .split("\n")
                .map((s) => "# " + s.trim())
                .join("\n"),
            ),
        ]);

        const configs = [
          {
            text: "Setup Windows",
            renderBody: () => <WindowsNotesDom />,
          },
          {
            text: "Setup Mac OSX",
            renderBody: () => <MacOSXNotesDom />,
          },
          {
            text: "Setup Linux",
            renderBody: () => <LinuxNotesDom />,
          },
          {
            text: "Setup Android with Termux",
            renderBody: () => <AndroidNotesDom />,
          },
          {
            text: "Setup Lightweight Profile",
            renderBody: () => (
              <ScriptOutputSection
                script={`curl -s {{BASH_PROFILE_CODE_REPO_RAW_URL}}/run.sh | bash -s -- --prod --lightweight --files="git.js,vim-configurations.js,vim-vundle.sh,bash-inputrc.js,bash-autocomplete.js,bash-syle-content.js"`}
              />
            ),
          },
          {
            text: "Setup Etc Hosts",
            renderBody: () => (
              <ScriptOutputSection
                script={`{{SETUP_HOSTS_SCRIPT}}\n\n# Windows\n# c:\\Windows\\System32\\Drivers\\etc\\hosts\n\n# Linux\n# /etc/hosts\n\n{{IP_ADDRESS_MAPPING_CONFIGS}}`}
              />
            ),
          },
          {
            text: "Test Full Run live",
            renderBody: () => (
              <>
                <OsSelectionInputSection />
                <BootstrapSection />
                <ScriptOutputSection script={`{{OS_FLAGS}} curl -s {{BASH_PROFILE_CODE_REPO_RAW_URL}}/run.sh | bash`} />
              </>
            ),
          },
          {
            text: "Test Single Script",
            renderBody: () => (
              <>
                <ScriptNameInputSection />
                <OsSelectionInputSection />
                <BootstrapSection />
                <ScriptOutputSection
                  script={`{{OS_FLAGS}} {{DEBUG_WRITE_TO_DIR}} \\\ncurl -s {{BASH_PROFILE_CODE_REPO_RAW_URL}}/run.sh | bash -s -- --prod --files="""\n{{SELECT_SCRIPTS}}\n"""`}
                />
              </>
            ),
          },
          {
            text: "Environment Vars",
            renderBody: () => (
              <>
                <OsSelectionInputSection />
                <EnvInputSection />
                <ScriptOutputSection script={`{{ENV_VARS}}`} />
              </>
            ),
          },
        ].map((config) => ({
          idx: `command-option-${config.text.toLowerCase().replace(/[ -]/g, "-")}`,
          ...config,
        }));

        for (const config of configs) {
          configsByKey[config.idx] = config;
        }

        // back it up
        const newAppData = {
          configs,
          configsByKey,
          setupDepsScript,
          scriptToRunOptions,
          setupHostsScript,
          ipAddressMappingConfigs,
          formValue: {
            commandChoice: getStorage("commandChoice") || defaultCommandOption,
            osToRun: getStorage("osToRun") || "windows",
            debugWriteToDir: getStorage("debugWriteToDir") || "",
            runnerToUse: getStorage("runnerToUse") || "prod",
            addBootstrapScript: getStorage("addBootstrapScript") || "no",
            setupDependencies: getStorage("setupDependencies") || "yes",
            envInputValue: getStorage("envInputValue") || "",
            shouldAddDefaultEnvs: getStorage("shouldAddDefaultEnvs") || "yes",
            scriptsToUse: (getStorage("scriptsToUse") || "").split("\n").filter((s) => s.trim()),
          },
        };

        if (newAppData?.formValue?.scriptsToUse.length === 0) {
          newAppData.formValue.scriptsToUse.push("software/");
        }

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
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      <MainAppContext.Provider
        value={{
          appData,
          setAppData: onSetAppData,
          onInputChange,
        }}
      >
        <div id="container">
          <div className="app-header">
            <h1 style={{ textTransform: "uppercase" }}>
              <LinkText href={REPO_URL}>{window.document.title}</LinkText>
            </h1>

            <Settings />
          </div>
          <div className="app-clone-command">
            <code>git clone git@github.com:synle/bashrc.git</code>
            <code>git clone https://github.com/synle/bashrc.git</code>
          </div>
          <TopNavigationContainer />
          <MainBodyContainer />
          <BottomContainer />
        </div>
      </MainAppContext.Provider>
    </ThemeContext.Provider>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);

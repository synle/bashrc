// Auto-generated from base-node-script.js JSDoc — do not edit manually.
// Run: node software/generate-types.js

declare var fs: any;

declare var path: any;

declare var https: any;

declare var http: any;

declare var BASE_HOMEDIR_LINUX: any;

/**
 * Tracks the processing status of each script file during execution.
 * Each entry records whether a script was found and processed successfully or encountered an error.
 * @type {Array<{file: string, path: string, script: string, status: 'success'|'error', description: string}>}
 * @property {string} file - The original file name before prefix expansion
 * @property {string} path - The resolved file path after prefix expansion
 * @property {string} script - The generated bash command used to fetch/execute the script
 * @property {string} status - 'success' if the script was found, 'error' if not found
 * @property {string} description - Error detail message, empty string on success
 */
declare var scriptProcessingResults: any;

/**
 * Resolves a file path, redirecting to DEBUG_WRITE_TO_DIR if set.
 * When DEBUG_WRITE_TO_DIR is configured, the path is flattened into a sanitized filename
 * placed inside that directory. Otherwise, returns the original path.
 * @param {string} filePath - The original file path
 * @returns {string} The resolved file path to use for I/O
 */
declare function _getFilePath(filePath?: any): any;

/**
 * Searches a directory for subdirectories matching a regex pattern.
 * @param {string} srcDir - The directory to search in
 * @param {RegExp} targetMatch - Regex pattern to match directory names against
 * @param {boolean} [returnFirstMatch=false] - If true, returns only the first matching path (or null)
 * @returns {string[]|string|null} Array of matching directory paths, or the first match (or null) if returnFirstMatch is true
 */
declare function findDirList(srcDir?: any, targetMatch?: any, returnFirstMatch?: any): any;

/**
 * Searches a directory and returns the first subdirectory matching a regex pattern.
 * @param {string} srcDir - The directory to search in
 * @param {RegExp} targetMatch - Regex pattern to match directory names against
 * @returns {string|null} The first matching directory path, or null if none found
 */
declare function findDirSingle(srcDir?: any, targetMatch?: any): any;

/**
 * Recursively searches a directory for the first file matching a regex pattern.
 * Unlike findDirSingle which only matches directories at one level, this searches
 * all files and subdirectories recursively.
 * @param {string} srcDir - The directory to start searching from
 * @param {RegExp} targetMatch - Regex pattern to match file names against
 * @returns {string|null} The full path of the first matching file, or null if none found
 */
declare function findFileRecursive(srcDir?: any, targetMatch?: any): any;

/**
 * find and return the first dir that matches the prop
 * @param  {array} findProps must contains "src" and "match"
 * @return {string} the path of the first dir and undefined otherwise
 */
declare function findFirstDirFromList(findProps?: any): any;

/**
 * Writes text content to a file. Skips writing if the content hasn't changed or if override is false.
 * @param {string} filePath - The file path to write to
 * @param {string} text - The text content to write
 * @param {boolean} [override=true] - Whether to overwrite existing content. If false, skips writing when file exists
 * @param {boolean} [suppressError=false] - Whether to suppress the "skipped" log message
 * @returns {void}
 */
declare function writeText(filePath?: any, text?: any, override?: any, suppressError?: any): any;

/**
 * Creates a file if it doesn't already exist. If the file exists, it is left unchanged.
 * @param {string} filePath - The file path to create
 * @param {string} [defaultContent=''] - The default content to write if the file is created
 * @returns {void}
 */
declare function touchFile(filePath?: any, defaultContent?: any): any;

/**
 * Writes text to a file, creating a timestamped backup of the old content if it differs.
 * @param {string} filePath - The file path to write to and back up
 * @param {string} text - The new text content to write
 * @returns {void}
 */
declare function backupText(filePath?: any, text?: any): any;

/**
 * Writes a JSON object to a file, optionally prepending comments.
 * @param {string} filePath - The file path to write to
 * @param {object} json - The JSON object to serialize and write
 * @param {string} [comments=''] - Optional comment text to prepend before the JSON content
 * @returns {void}
 */
declare function writeJson(filePath?: any, json?: any, comments?: any): any;

/**
 * Writes one or more build output files, routing to DEBUG_WRITE_TO_DIR when set.
 * @param {Array<{file: string, data: any, isJson?: boolean, comments?: string}> | {file: string, data: any, isJson?: boolean, comments?: string}} tasks - A single task or array of tasks to write
 * @returns {void}
 */
declare function writeToBuildFile(tasks?: any): any;

/**
 * Appends text to the end of an existing file's content.
 * @param {string} filePath - The file path to append to
 * @param {string} text - The text to append
 * @returns {void}
 */
declare function appendText(filePath?: any, text?: any): any;

/**
 * Reads a file and applies regex replacements line by line. Creates a .bak backup of the original.
 * @param {string} filePath - The file path to read and modify
 * @param {Array<[RegExp, string]>} replacements - Array of [matchRegex, replaceWith] pairs to apply to each line
 * @param {boolean} [makeAdditionalBackup=false] - If true, also creates a timestamped backup
 * @returns {void}
 */
declare function replaceTextLineByLine(filePath?: any, replacements?: any, makeAdditionalBackup?: any): any;

/**
 * Reads an existing JSON file, shallow-merges new properties into it, and writes it back.
 * If the file doesn't exist or is invalid, starts with an empty object.
 * @param {string} filePath - The JSON file path to read and write
 * @param {object} json - The JSON object whose properties will be merged into the existing file
 * @returns {void}
 */
declare function writeJsonWithMerge(filePath?: any, json?: any): any;

/**
 * Reads and parses a JSON file, supporting comments in the JSON content.
 * @param {string} filePath - The JSON file path to read
 * @returns {object} The parsed JSON object
 */
declare function readJson(filePath?: any): any;

/**
 * Reads the contents of a text file, returning an empty string if the file doesn't exist or can't be read.
 * @param {string} filePath - The file path to read
 * @returns {string} The trimmed file contents, or an empty string on error
 */
declare function readText(filePath?: any): any;

/**
 * Parses a JSON string that may contain comments or non-standard syntax by using eval.
 * Exits the process if the input is empty.
 * @param {string} oldText - The raw JSON/JS text to parse
 * @returns {object} The parsed object
 */
declare function parseJsonWithComments(oldText?: any): any;

/**
 * Creates a deep clone of an object via JSON serialization/deserialization.
 * @param {object} obj - The object to clone
 * @returns {object} A deep copy of the input object
 */
declare function clone(obj?: any): any;

/**
 * Detects and returns the Windows user home directory under WSL.
 * Tries two possible mount paths (/mnt/c/Users and /c/Users) and sets
 * global path variables (BASE_WINDOW, BASE_C_DIR_WINDOW, etc.) accordingly.
 * @returns {string|undefined} The Windows user home directory path, or undefined if not found
 */
declare function getWindowUserBaseDir(): any;

/**
 * Checks whether a file or directory exists at the given path.
 * @param {string} targetPath - The path to check
 * @returns {boolean} True if the path exists, false otherwise
 */
declare function filePathExist(targetPath?: any): any;

/**
 * @param  {String} applicationName Optional - the application name to be appended to the base path
 * if present, we will attempt to make a new directory there
 * @return {String} the full path to the application binary which can be used to install or download...
 */
declare function getWindowsApplicationBinaryDir(applicationName?: any): Promise<any>;

/**
 * @return {String} the path for app roaming dir for windows
 */
declare function getWindowAppDataRoamingUserPath(): any;

/**
 * @return {String} the path for app data local dir in windows
 */
declare function getWindowAppDataLocalUserPath(): any;

/**
 * Returns the macOS Application Support directory path for the current user.
 * @returns {string} The path to ~/Library/Application Support
 */
declare function getOsxApplicationSupportCodeUserPath(): any;

/**
 * Inserts or replaces a delimited text block within a larger text body.
 * The block is bounded by "{commentPrefix} {configKey}" and "{commentPrefix} END {configKey}" markers.
 * If the block already exists, it is replaced. Otherwise, it is appended or prepended.
 * @param {string} resultTextContent - The full text content to modify
 * @param {string} configKey - The identifier for the text block (used in delimiter comments)
 * @param {string} configValue - The new content for the block
 * @param {string} commentPrefix - The comment character/prefix (e.g. '#', '//')
 * @param {boolean} isPrepend - If true, prepend the block when inserting new; if false, append
 * @returns {string} The modified text content
 */
declare function updateTextBlock(resultTextContent?: any, configKey?: any, configValue?: any, commentPrefix?: any, isPrepend?: any): any;

/**
 * Appends a delimited text block to the end of a text body (or replaces it if it already exists).
 * @param {string} resultTextContent - The full text content to modify
 * @param {string} configKey - The identifier for the text block
 * @param {string} configValue - The new content for the block
 * @param {string} [commentPrefix='#'] - The comment character/prefix
 * @returns {string} The modified text content
 */
declare function appendTextBlock(resultTextContent?: any, configKey?: any, configValue?: any, commentPrefix?: any): any;

/**
 * Prepends a delimited text block to the beginning of a text body (or replaces it if it already exists).
 * @param {string} resultTextContent - The full text content to modify
 * @param {string} configKey - The identifier for the text block
 * @param {string} configValue - The new content for the block
 * @param {string} [commentPrefix='#'] - The comment character/prefix
 * @returns {string} The modified text content
 */
declare function prependTextBlock(resultTextContent?: any, configKey?: any, configValue?: any, commentPrefix?: any): any;

/**
 * Reads BASE_BASH_SYLE, prepends a config block, and writes it back.
 * Replaces the common 3-line read/prepend/write pattern.
 * @param {string} configKey - The config key for the text block
 * @param {string} content - The content to prepend
 */
declare function registerWithBashSyle(configKey?: any, content?: any): any;

/**
 * Registers a platform-specific tweaks file with BASE_BASH_SYLE and writes the tweaks content.
 * @param {string} platformName - Display name (e.g. "Only Mac")
 * @param {string} fileName - The dotfile name (e.g. ".bash_syle_only_mac")
 * @param {string} content - The tweaks content to write to the file
 * @param {string} [sourceOverride] - Optional override for the source line (e.g. ". ~/filename" for Android Termux)
 */
declare function registerPlatformTweaks(platformName?: any, fileName?: any, content?: any, sourceOverride?: any): any;

/**
 * Guard clause: exits the process if the given path does not exist.
 * @param {string} targetPath - The path to check
 * @param {string} [message] - Optional message (defaults to "Skipped : Not Found")
 */
declare function exitIfPathNotFound(targetPath?: any, message?: any): any;

/**
 * Downloads application binaries from the main repo into the Windows applications directory.
 * @param {string} applicationName - The application name
 * @param {function} findFilter - Filter function for downloadFilesFromMainRepo
 */
declare function downloadWindowsApp(applicationName?: any, findFilter?: any): Promise<any>;

/**
 * Resolves OS_KEY based on current platform flags.
 * @param {object} keys - Object with { windows, mac, linux } key values
 * @returns {string} The resolved OS key
 */
declare function resolveOsKey(keys?: any): any;

/**
 * Collapses runs of 3+ consecutive newlines into double newlines and trims the result.
 * @param {string} text - The text to clean up
 * @returns {string} The cleaned text with excess whitespace removed
 */
declare function cleanupExtraWhitespaces(text?: any): any;

/**
 * Converts one or more multiline text strings into a deduplicated array of non-empty, non-comment lines.
 * Filters out lines starting with //, #, or *.
 * @param {...string} texts - One or more text strings to process
 * @returns {string[]} Unique, trimmed, non-empty lines that are not comments
 */
declare function convertTextToList(...texts: any[]): any;

/**
 * Parses hosts-file formatted text into a deduplicated array of hostnames.
 * Strips leading IP addresses and filters to valid hostname patterns.
 * @param {...string} texts - One or more hosts-file formatted text strings
 * @returns {string[]} Unique hostnames extracted from the input
 */
declare function convertTextToHosts(...texts: any[]): any;

/**
 * Trims leading spaces from each line of a text block by a specified or auto-detected amount.
 * If spaceToTrim is not provided, it is inferred from the indentation of the first non-empty line.
 * @param {string} text - The multiline text to dedent
 * @param {number} [spaceToTrim] - Number of leading spaces to remove from each line. Auto-detected if omitted.
 * @returns {string} The dedented text
 */
declare function trimLeftSpaces(text?: any, spaceToTrim?: any): any;

/**
 * Calculates a percentage value to two decimal places.
 * @param {number} count - The part value
 * @param {number} total - The whole value
 * @returns {string} The percentage as a string with two decimal places (e.g. "75.00")
 */
declare function calculatePercentage(count?: any, total?: any): any;

/**
 * Extracts the root domain (e.g. "example.com") from a URL or hostname string.
 * @param {string} url - The URL or hostname to extract the root domain from
 * @returns {string} The root domain portion of the URL
 */
declare function getRootDomainFrom(url?: any): any;

/**
 * Creates a directory (and any necessary parent directories) at the given path.
 * @param {string} targetPath - The directory path to create
 * @returns {Promise<string>} Resolves with the stdout of the mkdir command
 */
declare function mkdir(targetPath?: any): any;

/**
 * Downloads a file from a URL to a local destination. Skips download if the file already exists.
 * @param {string} url - The URL to download from (can be relative to REPO_PREFIX_URL)
 * @param {string} destination - The local file path to save to
 * @returns {Promise<boolean>} Resolves to true if downloaded, false if skipped (already exists)
 */
declare function downloadFile(url?: any, destination?: any): any;

/**
 * Downloads binary files from the main GitHub repo that match a filter function.
 * Only considers files under the "binaries/" path, excluding markdown files.
 * @param {function(string): boolean} findHandler - Filter function to select which files to download
 * @param {string} destinationBaseDir - The local directory to save downloaded files to
 * @returns {Promise<string[]>} The full list of repo files (not just downloaded ones)
 */
declare function downloadFilesFromMainRepo(findHandler?: any, destinationBaseDir?: any): Promise<any>;

/**
 * Lists all files in the GitHub repository.
 * When fetchFromRemote is true, queries the Git tree API. Otherwise, uses the pre-compiled
 * script list fallback directly.
 * @param {boolean} [fetchFromRemote=true] - If true, fetches the file list from the GitHub API
 * @returns {Promise<string[]>} Array of file paths in the repository
 */
declare function listRepoDir(fetchFromRemote?: any): Promise<any>;

/**
 * Returns all software script files in the repo without OS filtering, using fallback file listing.
 * @returns {Promise<string[]>} Array of all script file paths
 */
declare function getAllRepoSoftwareFiles(): Promise<any>;

/**
 * Discovers and returns the ordered list of software setup script files to execute.
 * Filters scripts based on the current OS platform and applies ordering rules
 * (certain scripts run first/last). Can fetch the file list from the GitHub API or local filesystem.
 * @param {Object} [options={}] - Configuration options
 * @param {boolean} [options.skipOsFiltering=false] - If true, returns all matching scripts without OS filtering or ordering
 * @param {boolean} [options.useLocalFiles=false] - If true, uses local `find` instead of the GitHub API
 * @param {boolean} [options.useFallback=false] - If true, attempts both local `find` and GitHub API as fallbacks, using whichever succeeds last. Errors from either method are silently ignored.
 * @returns {Promise<string[]>} Ordered array of script file paths to execute
 */
declare function getSoftwareScriptFiles(options?: any, useLocalFiles?: any, useFallback?: any): Promise<any>;

/**
 * Converts a relative URL to an absolute URL by prepending REPO_PREFIX_URL.
 * If the URL already starts with "http", it is returned as-is.
 * @param {string} url - The URL or relative path to resolve
 * @returns {string} The fully qualified URL
 */
declare function getFullUrl(url?: any): any;

/**
 * Fetches a URL (or local file in test mode) and returns its content as a string.
 * Tries curl first, then falls back to Node's https module.
 * @param {string} url - The URL or relative path to fetch
 * @returns {Promise<string>} The fetched content as a string
 */
declare function fetchUrlAsString(url?: any): Promise<any>;

/**
 * Performs a shallow git clone of a repository's master branch into the specified directory.
 * @param {string} repo - The git repository URL to clone
 * @param {string} destinationDir - The local directory to clone into
 * @returns {Promise<string>} Resolves with the stdout of the git clone command
 */
declare function gitClone(repo?: any, destinationDir?: any): any;

/**
 * Fetches a URL and parses the response as JSON (supports comments in the JSON).
 * @param {string} url - The URL or relative path to fetch
 * @returns {Promise<object>} The parsed JSON object
 */
declare function fetchUrlAsJson(url?: any): Promise<any>;

/**
 * Executes a bash command synchronously and returns the output as a string.
 * Uses a 50MB max buffer for large outputs.
 * @param {string} cmd - The shell command to execute
 * @param {object} [options] - Optional execSync options (cwd, env, etc.)
 * @returns {Promise<string>} Resolves with the command's stdout
 */
declare function execBash(cmd?: any, options?: any): any;

/**
 * Executes a bash command asynchronously, silently swallowing errors.
 * @param {string} cmd - The shell command to execute
 * @param {object} [options] - Optional exec options (cwd, env, etc.)
 * @returns {Promise<string>} Resolves with the command's stdout (empty string on error)
 */
declare function execBashSilent(cmd?: any, options?: any): any;

/**
 * Generates a bash echo command string that outputs the given text.
 * @param {string} str - The text to echo
 * @returns {string} A bash echo command string
 */
declare function echo(str?: any): any;

/**
 * Generates a bash echo command string that outputs colored text using ANSI escape codes.
 * @param {string} str - The text to echo
 * @param {string} color - The ANSI color code (e.g. '32m' for green)
 * @returns {string} A bash echo command string with color escape sequences
 */
declare function echoColor(str?: any, color?: any): any;

/**
 * Wraps a string with ANSI color escape codes for use with console.log.
 * @param {string} str - The text to colorize
 * @param {string} color - The ANSI color code (e.g. '32m' for green)
 * @returns {string} The string wrapped in ANSI color escape sequences
 */
declare function consoleLogColor(str?: any, color?: any): any;

/**
 * Generates and prints a bash command pipeline for fetching and executing a script file.
 * Determines the appropriate runner (node, bash, sudo) based on the file's extension pattern
 * (e.g. .su.js for sudo node, .sh.js for node piped to bash).
 * @param {string} file - The script file path (relative to the repo), after prefix expansion
 * @param {string} originalFile - The original file name before prefix expansion (e.g. before adding 'software/scripts/')
 * @param {string[]} allRepoFiles - List of all file paths in the repository for regex matching
 * @returns {void}
 */
declare function processScriptFile(file?: any, originalFile?: any, allRepoFiles?: any): any;

/**
 * Fetches a remote script file and evaluates its content in the current context.
 * @param {string} file - The file path or URL to fetch and eval
 * @returns {Promise<void>}
 */
declare function includeSource(file?: any): Promise<any>;

/**
 * Prints a formatted table of OS flags (is_os_*) to stdout via a generated node command.
 * Respects the SHOULD_PRINT_OS_FLAGS environment variable to suppress output.
 * @returns {void}
 */
declare function printOsFlags(): any;

/**
 * Prints a formatted list of script files that will be executed to stdout via a generated node command.
 * @param {string[]} scriptsToRun - Array of script file paths to display
 * @returns {void}
 */
declare function printScriptsToRun(scriptsToRun?: any): any;

/**
 * Prints a formatted section block with a header and optional content lines to stdout via a generated node command.
 * @param {string} header - The section header text
 * @param {string[]} [lines=[]] - Optional array of content lines to display between the header and footer
 * @returns {void}
 */
declare function printSectionBlock(header?: any, lines?: any): any;

/**
 * Prints the script processing results with a section header.
 * Success entries are printed in green, error entries in red.
 * @param {Array<{file: string, path: string, description: string, status: string}>} results - The scriptProcessingResults array
 * @returns {void}
 */
declare function printScriptProcessingResults(results?: any): any;

declare function _doWorkTestFiles(): Promise<any>;

declare function _doWorkFullRun(): Promise<any>;

/** Optional static shell-portability checks; never executes the input scripts. */
const fs = require("fs");
const { spawnSync } = require("child_process");

/** Supported independent checks; Make's pattern target delegates validation here. */
const RULES = ["quoting", "printf", "options", "syntax"];
/** ShellCheck diagnostics belonging to each focused check. */
const DIAGNOSTICS = { quoting: [2086, 2068, 2248], printf: [2059, 3037] };
/** Bound each external analyzer independently. */
const TOOL_TIMEOUT_MS = 5000;
/** AST output can be considerably larger than its input source. */
const MAX_TOOL_OUTPUT_BYTES = 16 * 1024 * 1024;

/** Expected analyzer failures that a file batch can report without stopping. */
class AnalyzerError extends Error {}

/**
 * Run an analyzer on stdin and decode its JSON without executing shell source.
 * @param {string} binary Analyzer executable.
 * @param {string[]} args Argument vector, never interpreted by a shell.
 * @param {string} source Input shell source.
 * @param {number[]} acceptedStatuses Accepted analyzer exit statuses.
 * @returns {object|object[]} Decoded analyzer output.
 * @throws {AnalyzerError} Missing tools, timeout, analyzer failure, or invalid JSON.
 */
function analyze(binary, args, source, acceptedStatuses) {
  const result = spawnSync(binary, args, {
    input: source,
    encoding: "utf8",
    timeout: TOOL_TIMEOUT_MS,
    maxBuffer: MAX_TOOL_OUTPUT_BYTES,
  });
  if (result.error)
    throw new AnalyzerError(`${binary}: ${result.error.code}; install/check the analyzer and retry.`, { cause: result.error });
  if (!acceptedStatuses.includes(result.status)) throw new AnalyzerError(`${binary}: ${result.stderr.trim() || "analyzer failed"}`);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new AnalyzerError(`${binary}: expected JSON output; check the installed analyzer version.`, { cause: error });
  }
}

/**
 * Recover a constant shell word, returning null for expansions or executable parts.
 * @param {{Parts?: object[]}} word Parsed shell word.
 * @returns {string|null} Constant value, or null when statically unknown.
 */
function literalWord(word) {
  let value = "";
  for (const part of word.Parts || []) {
    if (part.Type === "Lit" || part.Type === "SglQuoted") value += part.Value;
    else if (part.Type === "DblQuoted") {
      const nested = literalWord(part);
      if (nested === null) return null;
      value += nested;
    } else return null;
  }
  return value;
}

/**
 * Report direct option mutations; dynamic option arguments require manual review.
 * @param {string} command Literal command name after supported wrappers.
 * @param {(string|null)[]} args Constant arguments, or null for dynamic values.
 * @returns {boolean} Whether the command may change shell options.
 */
function changesOptions(command, args) {
  if (!["set", "shopt", "setopt", "unsetopt"].includes(command)) return false;
  if (args.length === 0) return false;
  if (command === "set") {
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (arg === "--") return false;
      if (arg === null) return true;
      if ((arg === "-o" || arg === "+o") && index === args.length - 1) continue;
      if (/^[+-][a-zA-Z]|^-$/.test(arg)) return true;
    }
    return false;
  }
  if (command === "shopt") return args.some((arg) => arg === null || /^-[a-zA-Z]*[su]/.test(arg));
  return true;
}

/**
 * Inspect parsed command nodes, ignoring inert comments and quoted/heredoc text.
 * @param {object} tree shfmt syntax tree.
 * @param {string[]} rules Selected checks.
 * @returns {{code: string, line: number, column: number, message: string}[]} Policy findings.
 */
function commandFindings(tree, rules) {
  const findings = [];
  const pending = [tree];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node || typeof node !== "object") continue;
    pending.push(...Object.values(node));
    if (node.Type !== "CallExpr" || !Array.isArray(node.Args)) continue;
    const words = node.Args.map(literalWord);
    let command = words.shift();
    while (command === "command" || command === "builtin") {
      if (words[0] === "-v" || words[0] === "-V") break;
      if (words[0] === "--" || words[0] === "-p") words.shift();
      command = words.shift();
    }
    let code;
    let message;
    if (rules.includes("printf") && command === "echo") {
      code = "AGNOSTIC_PRINTF";
      message = "Use fixed-format printf for portable output; this optional check flags all echo calls.";
    }
    if (rules.includes("options") && changesOptions(command, words)) {
      code = "AGNOSTIC_OPTIONS";
      message = "Review shell-option mutation; shared helpers must preserve caller options, and strict mode is not boilerplate.";
    }
    if (code) findings.push({ code, line: node.Pos.Line, column: node.Pos.Col, message });
  }
  return findings;
}

/**
 * Validate one source string with selected static checks, without executing it.
 * @param {string} source Shell source supplied by the caller.
 * @param {string} rule One supported check, or all.
 * @returns {{code: string, line: number, column: number, message: string}[]} Findings.
 * @throws {Error} Invalid source or rule.
 * @throws {AnalyzerError} Unsupported syntax, unavailable tools, or malformed analyzer output.
 */
function validateShellSource(source, rule) {
  if (typeof source !== "string") throw new Error("source: expected a string.");
  if (rule !== "all" && !RULES.includes(rule)) throw new Error(`rule: expected all or ${RULES.join(", ")}.`);
  const rules = rule === "all" ? RULES : [rule];
  const findings = [];
  if (rules.some((item) => item === "options" || item === "printf" || item === "syntax")) {
    const dialect = rules.includes("syntax") ? "posix" : "bash";
    const tree = analyze("shfmt", ["-ln", dialect, "--to-json"], source, [0]);
    if (!tree || tree.Type !== "File") throw new AnalyzerError("shfmt: expected a File syntax tree.");
    findings.push(...commandFindings(tree, rules));
  }
  if (rules.some((item) => item === "quoting" || item === "printf" || item === "syntax")) {
    const diagnostics = analyze(
      "shellcheck",
      ["--norc", "--shell=sh", "--enable=quote-safe-variables", "--format=json", "-"],
      source,
      [0, 1],
    );
    if (!Array.isArray(diagnostics)) throw new AnalyzerError("shellcheck: expected a diagnostic array.");
    for (const item of diagnostics) {
      if (!item || !Number.isInteger(item.code) || typeof item.message !== "string")
        throw new AnalyzerError("shellcheck: malformed diagnostic.");
      const selected = item.code < 2000 || rules.some((name) => (DIAGNOSTICS[name] || []).includes(item.code));
      const nonPosix = rules.includes("syntax") && item.code >= 3000 && item.code < 4000;
      if (selected || nonPosix) findings.push({ code: `SC${item.code}`, line: item.line, column: item.column, message: item.message });
    }
  }
  return findings;
}

/**
 * Validate every selected regular file, retaining findings and file-level analyzer failures.
 * @param {string[]} files Literal filenames; no shell expansion or recursive discovery.
 * @param {string} rule One supported check, or all.
 * @returns {{ok: boolean, rule: string, checkedFiles: number, findings: object[], errors?: object[]}} Result; checkedFiles counts distinct attempted files.
 * @throws {Error} Missing/invalid scope or rule, sensitive paths, filesystem failures, or unexpected errors.
 * @sideEffects Reads selected files and invokes static analyzers without executing source.
 */
function validateShellFiles(files, rule) {
  if (!Array.isArray(files) || files.length === 0 || files.some((file) => typeof file !== "string" || file.length === 0)) {
    throw new Error("files: expected a nonempty filename or JSON array of nonempty filenames.");
  }
  const findings = [];
  const errors = [];
  for (const file of new Set(files)) {
    const sensitive = /\.secret\.|(?:^|[/\\])\.env(?:[./\\]|$)|\.(?:pem|key)$/i;
    if (sensitive.test(file)) throw new Error("files: sensitive paths are not accepted.");
    const resolved = fs.realpathSync(file);
    if (sensitive.test(resolved)) throw new Error("files: resolved sensitive paths are not accepted.");
    if (!fs.statSync(resolved).isFile()) throw new Error("files: each input must be a regular file.");
    const source = fs.readFileSync(resolved, "utf8");
    try {
      for (const finding of validateShellSource(source, rule)) findings.push({ file, ...finding });
    } catch (error) {
      if (!(error instanceof AnalyzerError)) throw error;
      errors.push({ file, code: "VALIDATION_UNAVAILABLE", message: error.message });
    }
  }
  const result = { ok: findings.length === 0 && errors.length === 0, rule, checkedFiles: new Set(files).size, findings };
  if (errors.length > 0) return { ...result, errors };
  return result;
}

/**
 * Run the optional Make/CLI entry point; files is a literal path or JSON array.
 * @returns {void} Writes JSON and sets exit status: 0 clean, 1 findings, 2 invalid/unavailable.
 * @sideEffects Reads selected files and invokes static analyzers; never executes those files.
 */
function main() {
  try {
    const [rule = process.env.SHELL_AGNOSTIC_RULE || "all", ...paths] = process.argv.slice(2);
    const scope = process.env.SHELL_AGNOSTIC_FILES || "";
    const files = paths.length > 0 ? paths : scope.startsWith("[") ? JSON.parse(scope) : scope ? [scope] : [];
    const result = validateShellFiles(files, rule);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.errors) process.exitCode = 2;
    else process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: { code: "VALIDATION_UNAVAILABLE", message: error.message } })}\n`);
    process.exitCode = 2;
  }
}

if (require.main === module) main();
module.exports = { validateShellSource, validateShellFiles };

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { execSync } from "child_process";

import fs from "fs";

import path from "path";

import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const PROFILE_ADVANCED = path.join(ROOT_DIR, "software/bootstrap/profile-advanced.sh");

const REQUIRED_TOOLS = ["head", "tail", "tr", "cat", "mktemp", "rm", "cp", "mv", "mkdir", "sed", "awk", "date", "sleep", "wc", "bash"];

const OPTIONAL_TOOLS = ["timeout"];

let sandbox = "";

const MISSING = "\0missing";

const formatterBins = { prettier: "", oxfmt: "" };

function resolveFormatter(name) {
  if (formatterBins[name]) return formatterBins[name] === MISSING ? "" : formatterBins[name];

  let resolved = "";
  try {
    // execSync defaults to /bin/sh — dash on Ubuntu CI doesn't support `type -P`. Force bash.
    resolved = execSync(`type -P ${name}`, { encoding: "utf-8", shell: "/bin/bash" }).trim();
  } catch {
    resolved = "";
  }

  if (!resolved) {
    const localBin = path.join(ROOT_DIR, "node_modules", ".bin", name);
    if (fs.existsSync(localBin)) resolved = fs.realpathSync(localBin);
  }

  formatterBins[name] = resolved || MISSING;
  return resolved;
}

function linkIntoSandbox(name, target) {
  const dest = path.join(sandbox, "bin", name);
  if (!fs.existsSync(dest)) fs.symlinkSync(target, dest);
}

function findHostTool(tool) {
  for (const dir of ["/usr/bin", "/bin", "/usr/local/bin", "/opt/homebrew/bin"]) {
    const src = path.join(dir, tool);
    if (fs.existsSync(src)) return src;
  }
  return "";
}

function writeSandboxBin(name, lines) {
  const dest = path.join(sandbox, "bin", name);
  fs.rmSync(dest, { force: true });
  fs.writeFileSync(dest, lines.join("\n"), { mode: 0o755 });
}

function stubFormatter(name) {
  writeSandboxBin(name, [
    "#!/usr/bin/env bash",
    'target=""',
    'flags=""',
    'for arg in "$@"; do',
    '  case "$arg" in',
    '    -*) flags="$flags $arg" ;;',
    '    *) target="$arg" ;;',
    "  esac",
    "done",
    '[ -z "$target" ] && exit 1',
    `printf 'FMT|${name}|%s|%s\\n' "\${target##*.}" "\${flags# }" > "$target"`,
    "exit 0",
  ]);
}

function fmtMarker(name, extension) {
  return `FMT|${name}|${extension}|${name === "prettier" ? "--write" : ""}\n`;
}

beforeEach(() => {
  sandbox = fs.mkdtempSync("/tmp/_curl_fmt_test_");
  fs.mkdirSync(path.join(sandbox, "bin"));

  for (const tool of [...REQUIRED_TOOLS, ...OPTIONAL_TOOLS]) {
    const src = findHostTool(tool);
    if (src) linkIntoSandbox(tool, src);
  }

  for (const name of ["prettier", "oxfmt"]) stubFormatter(name);

  // Both formatters are Node shims, and _curl_json_body falls back to node when
  // jq/python3 are absent (they are — the sandbox PATH is hermetic).
  let nodeBin = "";
  try {
    nodeBin = execSync("type -P node", { encoding: "utf-8", shell: "/bin/bash" }).trim();
  } catch {
    nodeBin = process.execPath;
  }
  if (nodeBin) linkIntoSandbox("node", nodeBin);
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

function extractCurlSection() {
  const src = fs.readFileSync(PROFILE_ADVANCED, "utf-8").split("\n");

  const sectionIdx = src.findIndex((l) => l.startsWith("export BASHRC_CURL_HAR_FOLDER="));
  if (sectionIdx < 0) throw new Error("could not locate the curl section in profile-advanced.sh");

  const startIdx = src.findIndex((l) => l.startsWith("function curl()"));
  if (startIdx < 0) throw new Error("could not locate `function curl()` in profile-advanced.sh");

  const endIdx = src.findIndex((l, i) => i > startIdx && l === "}");
  if (endIdx < 0) throw new Error("could not locate closing `}` for curl() function");

  let block = src.slice(sectionIdx, endIdx + 1).join("\n");

  // Patch TTY guard — test subprocess is non-TTY, but we need the buffered path.
  block = block.replace("[ -t 1 ] || {", "false && {");

  return block;
}

function runCurl(opts) {
  const fixturePath = path.join(sandbox, "fixture.body");
  fs.writeFileSync(fixturePath, opts.body);

  const harFolder = path.join(sandbox, "har");
  const httpCode = opts.httpCode ?? "200";
  const contentType = opts.contentType ?? "text/plain";
  const size = Buffer.byteLength(opts.body);

  // Sandbox curl shim: honors -o / -D, then prints the newline-separated -w
  // payload the wrapper parses. Uses cp for non-empty bodies and `: > file`
  // (truncate) for empty ones so the wrapper's `! -s "$tmpfile"` branch fires.
  const writeBody = opts.body.length === 0 ? ': > "$output_file"' : `cp "${fixturePath}" "$output_file"`;
  writeSandboxBin("curl", [
    "#!/usr/bin/env bash",
    "output_file=''",
    "dump_file=''",
    "while [ $# -gt 0 ]; do",
    '  case "$1" in',
    '    -o|--output) output_file="$2"; shift 2 ;;',
    '    -D|--dump-header) dump_file="$2"; shift 2 ;;',
    "    *) shift ;;",
    "  esac",
    "done",
    `[ -n "$output_file" ] && ${writeBody}`,
    `[ -n "$dump_file" ] && printf 'HTTP/1.1 ${httpCode} OK\\r\\ncontent-type: ${contentType}\\r\\nx-fixture: yes\\r\\n\\r\\n' > "$dump_file"`,
    `printf '%s\\n' '${httpCode}' '0.250000' '0.200000' '${size}' '${contentType}' '${opts.url}' '1.1'`,
    "exit 0",
  ]);

  // Optional slow-formatter shim to exercise the BASHRC_CURL_FORMAT_TIMEOUT path.
  if (opts.slowFormatter) {
    writeSandboxBin(opts.slowFormatter, ["#!/usr/bin/env bash", "sleep 30", "exit 0"]);
  }

  // Swap a stub out for the genuine binary when a test asserts real formatter output.
  if (opts.realFormatter) {
    fs.rmSync(path.join(sandbox, "bin", opts.realFormatter), { force: true });
    linkIntoSandbox(opts.realFormatter, resolveFormatter(opts.realFormatter));
  }

  // Remove a formatter entirely to exercise the "formatter unavailable" branch.
  if (opts.dropFormatter) {
    fs.rmSync(path.join(sandbox, "bin", opts.dropFormatter), { force: true });
  }

  const runner = path.join(sandbox, "runner.sh");
  const envLines = Object.entries({ BASHRC_CURL_HAR_FOLDER: harFolder, ...opts.env }).map(([k, v]) => `export ${k}=${JSON.stringify(v)}`);

  fs.writeFileSync(
    runner,
    [
      "#!/usr/bin/env bash",
      // Hermetic PATH: sandbox bin only. No /usr/bin leakage.
      `export PATH="${path.join(sandbox, "bin")}"`,
      ...envLines,
      // Shims for profile helpers defined outside the extracted section.
      "function is_help_arg() { return 1; }",
      'function is_truthy() { case "${1:-}" in 1|[Tt]rue|[Yy]|[Yy]es|TRUE|Y|YES) return 0 ;; esac; return 1; }',
      "function prompt_yes_no() { return 1; }",
      "function _ensure_npm_binary() { return 1; }",
      extractCurlSection(),
      `curl ${[opts.url, ...(opts.extraArgs ?? [])].map((a) => JSON.stringify(a)).join(" ")}`,
    ].join("\n"),
  );

  const stdout = execSync(`bash "${runner}" 2>&1`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  return { stdout, harFolder };
}

function formatDirect(body, formatter, extension) {
  const tmp = path.join(sandbox, `direct.${extension}`);
  fs.writeFileSync(tmp, body);
  const bin = resolveFormatter(formatter);
  const flags = formatter === "prettier" ? "--write" : "";
  execSync(`"${bin}" ${flags} "${tmp}"`, { encoding: "utf-8", stdio: "pipe" });
  return fs.readFileSync(tmp, "utf-8");
}

function readHar(harFolder) {
  const files = fs.readdirSync(harFolder).filter((f) => f.endsWith(".har"));
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^\d{2}-\d{2}-\d{4}\.har$/);
  return JSON.parse(fs.readFileSync(path.join(harFolder, files[0]), "utf-8"));
}

describe("curl wrapper HAR capture", () => {
it("truncates bodies larger than BASHRC_CURL_HAR_MAX_BODY", () => {
    const body = "x".repeat(5000);
    const { harFolder } = runCurl({
      url: "https://example.com/big.dat",
      body,
      env: { BASHRC_CURL_HAR_MAX_BODY: "100" },
    });

    const entry = readHar(harFolder).log.entries[0];
    expect(entry.response.content.text).toHaveLength(100);
    expect(entry.response.content.comment).toContain("truncated");
  });

it("records empty-body responses too", () => {
    const { harFolder } = runCurl({ url: "https://example.com/empty", body: "", httpCode: "204" });

    const entry = readHar(harFolder).log.entries[0];
    expect(entry.response.status).toBe(204);
    expect(entry.response.content.text).toBe("");
  });

it("skips HAR capture when BASHRC_CURL_NO_HAR=1", () => {
    const { harFolder } = runCurl({
      url: "https://example.com/quiet.json",
      body: '{"a":1}',
      env: { BASHRC_CURL_NO_HAR: "1" },
    });

    expect(fs.existsSync(harFolder)).toBe(false);
  });

it("moves a corrupted archive aside instead of appending onto invalid JSON", () => {
    const harFolder = path.join(sandbox, "har");
    fs.mkdirSync(harFolder, { recursive: true });

    // Pre-seed today's archive with a truncated (terminator-less) file.
    runCurl({ url: "https://example.com/first.json", body: '{"a":1}' });
    const harName = fs.readdirSync(harFolder).find((f) => f.endsWith(".har"));
    const harPath = path.join(harFolder, harName);
    fs.writeFileSync(harPath, '{"log":{"entries":[\n{"broken":true}\n');

    runCurl({ url: "https://example.com/second.json", body: '{"a":2}' });

    const har = JSON.parse(fs.readFileSync(harPath, "utf-8"));
    expect(har.log.entries).toHaveLength(1);
    expect(har.log.entries[0].request.url).toBe("https://example.com/second.json");
    expect(fs.readdirSync(harFolder).some((f) => f.includes(".corrupt."))).toBe(true);
  });
});

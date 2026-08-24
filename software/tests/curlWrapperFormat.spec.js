/**
 * Behavior tests for the curl() wrapper in software/bootstrap/profile-advanced.sh.
 *
 * Two things are under test:
 *   1. Format dispatch — which formatter (oxfmt / prettier) the wrapper picks
 *      for a given body shape or URL extension, and its fallbacks.
 *   2. HAR capture — the per-day $BASHRC_CURL_HAR_FOLDER/mm-dd-yyyy.har archive
 *      the wrapper appends every buffered request to.
 *
 * Strategy (mirrors osDetection.spec.js):
 *   1. Extract the whole "HTTP / Networking Utilities" section (the _curl_*
 *      helpers plus curl() itself) from profile-advanced.sh by line markers, so
 *      the tests stay robust against line-number shifts.
 *   2. Patch out the `[ -t 1 ]` TTY guard so the buffered path runs in a
 *      non-TTY test subprocess.
 *   3. Build a hermetic sandbox PATH with: a `curl` shim that writes a fixture
 *      body to the wrapper's `-o <tmpfile>` capture, a header block to its
 *      `-D <dumpfile>`, and the newline-separated `-w` stats on stdout; the real
 *      oxfmt + prettier binaries; and the coreutils the wrapper invokes.
 *   4. Inject no-op shims for the profile helpers that live outside this section
 *      (is_help_arg, is_truthy, prompt_yes_no, _ensure_npm_binary).
 *   5. Invoke `curl <fake-url>` and assert stdout matches the formatter's own
 *      output against the same fixture (the wrapper's contract).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE_ADVANCED = path.join(ROOT_DIR, "software/bootstrap/profile-advanced.sh");

/** Coreutils the wrapper + sandbox shims invoke — symlinked from host into sandbox PATH. */
const REQUIRED_TOOLS = ["head", "tail", "tr", "cat", "mktemp", "rm", "cp", "mv", "mkdir", "sed", "awk", "date", "sleep", "wc", "bash"];

/** Coreutils that are nice to have but whose absence the wrapper tolerates. */
const OPTIONAL_TOOLS = ["timeout"];

/** Per-test sandbox dir. */
let sandbox = "";
/** Sentinel cached for a formatter that is not installed anywhere on this box. */
const MISSING = "\0missing";
/** Cached formatter binary paths, resolved once per file. */
const formatterBins = { prettier: "", oxfmt: "" };

/**
 * Resolve a formatter binary: PATH first, then this repo's node_modules/.bin.
 *
 * Never throws. Neither formatter is a build dependency of this repo — oxfmt
 * ships as a devDependency, prettier is only ever reached through `npx` — so a
 * clean `npm ci` box (CI) legitimately has no prettier at all. Callers get ""
 * back and fall through to the hermetic stubs.
 *
 * @param {string} name - binary name (prettier / oxfmt)
 * @returns {string} absolute path to the binary, or "" when unavailable
 */
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

/**
 * Symlink a host binary into the sandbox PATH.
 *
 * @param {string} name - name the binary should have inside the sandbox
 * @param {string} target - absolute path to the host binary
 */
function linkIntoSandbox(name, target) {
  const dest = path.join(sandbox, "bin", name);
  if (!fs.existsSync(dest)) fs.symlinkSync(target, dest);
}

/**
 * Find a tool on the host in the usual bin folders.
 *
 * @param {string} tool - binary name
 * @returns {string} absolute path, or "" when not found
 */
function findHostTool(tool) {
  for (const dir of ["/usr/bin", "/bin", "/usr/local/bin", "/opt/homebrew/bin"]) {
    const src = path.join(dir, tool);
    if (fs.existsSync(src)) return src;
  }
  return "";
}

/**
 * Write an executable shim into the sandbox PATH.
 *
 * Unlinks first: several sandbox names (oxfmt, prettier) can already be symlinks
 * to real host binaries, and writeFileSync follows a symlink — writing straight
 * to the path would overwrite the host binary the symlink points at.
 *
 * @param {string} name - binary name inside the sandbox
 * @param {string[]} lines - shim source lines
 */
function writeSandboxBin(name, lines) {
  const dest = path.join(sandbox, "bin", name);
  fs.rmSync(dest, { force: true });
  fs.writeFileSync(dest, lines.join("\n"), { mode: 0o755 });
}

/**
 * Install a recording stub for a formatter.
 *
 * The stub replaces the file it is handed with a single `FMT|<name>|<ext>|<flags>`
 * marker line, which the wrapper then cats to stdout. That makes every dispatch
 * assertion hermetic: it proves the decision the wrapper made (which formatter,
 * which parser extension, which flags) without needing either real binary
 * installed — prettier in particular is not a dependency of this repo.
 *
 * @param {string} name - formatter name to stub (prettier / oxfmt)
 */
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

/**
 * Build the marker a stubbed formatter emits, for use in assertions.
 *
 * @param {string} name - formatter name (prettier / oxfmt)
 * @param {string} extension - parser extension the wrapper should have picked
 * @returns {string} expected stdout
 */
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

/**
 * Extract the HTTP / Networking Utilities section (the `_curl_*` helpers plus
 * `curl()` itself) from profile-advanced.sh. Bounded by the first
 * `export BASHRC_CURL_HAR_FOLDER=` line and the closing `}` of `function curl()`
 * (the first `^}` at column 0 after the opener — convention enforced repo-wide).
 *
 * @returns {string} the extracted bash source, with the TTY guard patched out
 */
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

/**
 * Drive the patched curl() wrapper against a fixture body.
 *
 * @param {object} opts
 * @param {string} opts.url - fake URL passed as the only positional arg
 * @param {string} opts.body - fixture body the sandbox curl shim emits via -o
 * @param {string} [opts.httpCode] - http status the shim reports (default 200)
 * @param {string} [opts.contentType] - Content-Type the shim reports (default text/plain)
 * @param {string[]} [opts.extraArgs] - extra args appended to the curl invocation
 * @param {Record<string, string>} [opts.env] - extra env vars for the runner
 * @param {string} [opts.slowFormatter] - name of a formatter to replace with a sleeping shim
 * @param {string} [opts.realFormatter] - formatter whose stub is swapped for the real host binary
 * @param {string} [opts.dropFormatter] - formatter to delete from the sandbox PATH entirely
 * @returns {{ stdout: string, harFolder: string }}
 */
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

/**
 * Run a formatter directly against a string body — the wrapper's expected output.
 *
 * @param {string} body - source text
 * @param {string} formatter - prettier or oxfmt
 * @param {string} extension - file extension that selects the parser
 * @returns {string}
 */
function formatDirect(body, formatter, extension) {
  const tmp = path.join(sandbox, `direct.${extension}`);
  fs.writeFileSync(tmp, body);
  const bin = resolveFormatter(formatter);
  const flags = formatter === "prettier" ? "--write" : "";
  execSync(`"${bin}" ${flags} "${tmp}"`, { encoding: "utf-8", stdio: "pipe" });
  return fs.readFileSync(tmp, "utf-8");
}

/**
 * Read today's HAR archive out of a sandbox HAR folder.
 *
 * @param {string} harFolder - folder the wrapper wrote into
 * @returns {object} the parsed HAR document
 */
function readHar(harFolder) {
  const files = fs.readdirSync(harFolder).filter((f) => f.endsWith(".har"));
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^\d{2}-\d{2}-\d{4}\.har$/);
  return JSON.parse(fs.readFileSync(path.join(harFolder, files[0]), "utf-8"));
}

describe("curl wrapper format dispatch", () => {
  describe("body sniff (no URL extension hint)", () => {
    it("routes a JSON object to oxfmt with the json parser", () => {
      const { stdout } = runCurl({ url: "https://api.example.com/user", body: '{"name":"sy","nested":{"a":1,"b":[1,2,3]}}' });
      expect(stdout).toBe(fmtMarker("oxfmt", "json"));
    });

    it("routes a JSON array to oxfmt with the json parser", () => {
      const { stdout } = runCurl({ url: "https://api.example.com/list", body: '[1,2,3,{"k":"v"}]' });
      expect(stdout).toBe(fmtMarker("oxfmt", "json"));
    });

    it("routes angle-bracket bodies to oxfmt with the html parser", () => {
      const { stdout } = runCurl({ url: "https://example.com/page", body: "<html><body><h1>hi</h1></body></html>" });
      expect(stdout).toBe(fmtMarker("oxfmt", "html"));
    });
  });

  describe("URL extension hint (body sniff inconclusive)", () => {
    it("routes .md to prettier", () => {
      const { stdout } = runCurl({ url: "https://raw.githubusercontent.com/x/y/HEAD/README.md", body: "# Title\nsome **bold** text\n" });
      expect(stdout).toBe(fmtMarker("prettier", "md"));
    });

    it("routes .yml to prettier with the yaml parser", () => {
      const { stdout } = runCurl({ url: "https://example.com/config.yml", body: "key:    value\n" });
      expect(stdout).toBe(fmtMarker("prettier", "yaml"));
    });

    it("routes .yaml to prettier with the yaml parser", () => {
      const { stdout } = runCurl({ url: "https://example.com/config.yaml", body: "a:   1\nb: 2\n" });
      expect(stdout).toBe(fmtMarker("prettier", "yaml"));
    });

    it("routes .js to oxfmt", () => {
      const { stdout } = runCurl({ url: "https://cdn.example.com/lib.js", body: "const   x={a:1,b:2};" });
      expect(stdout).toBe(fmtMarker("oxfmt", "js"));
    });

    it("routes .ts to oxfmt", () => {
      const { stdout } = runCurl({ url: "https://cdn.example.com/lib.ts", body: "type T={a:number};" });
      expect(stdout).toBe(fmtMarker("oxfmt", "ts"));
    });

    it("routes .css to oxfmt", () => {
      const { stdout } = runCurl({ url: "https://example.com/site.css", body: "a{color:red}" });
      expect(stdout).toBe(fmtMarker("oxfmt", "css"));
    });

    it("routes .xml to oxfmt with the html parser", () => {
      const { stdout } = runCurl({ url: "https://example.com/data.xml", body: "<root><item>a</item></root>" });
      expect(stdout).toBe(fmtMarker("oxfmt", "html"));
    });

    it("strips query + fragment before reading extension", () => {
      const { stdout } = runCurl({ url: "https://example.com/doc.md?v=1#section", body: "# H\n" });
      expect(stdout).toBe(fmtMarker("prettier", "md"));
    });

    it("lowercases the extension before matching", () => {
      const { stdout } = runCurl({ url: "https://example.com/DOC.MD", body: "# H\n" });
      expect(stdout).toBe(fmtMarker("prettier", "md"));
    });
  });

  describe("fallback paths", () => {
    it("emits raw body when neither sniff nor extension matches", () => {
      const body = "plain text with no shape clue\nsecond line\n";
      const { stdout } = runCurl({ url: "https://example.com/raw.dat", body });
      expect(stdout).toBe(body);
    });

    it("emits empty-body stderr summary and skips formatting on 0-byte response", () => {
      // runCurl detects an empty `body` and rewrites the shim to truncate the
      // capture file, so the wrapper hits its `! -s "$tmpfile"` branch.
      const { stdout } = runCurl({ url: "https://example.com/empty", body: "", httpCode: "204" });
      expect(stdout).toContain("empty body");
      expect(stdout).toContain("http 204");
    });

    it("emits raw body when the formatter blows BASHRC_CURL_FORMAT_TIMEOUT", () => {
      if (!findHostTool("timeout")) return; // no coreutils timeout: nothing to enforce
      const body = '{"a":1}';
      const { stdout } = runCurl({
        url: "https://example.com/slow.json",
        body,
        env: { BASHRC_CURL_FORMAT_TIMEOUT: "1" },
        slowFormatter: "oxfmt",
      });
      expect(stdout).toBe(body);
    });

    it("emits raw body when the chosen formatter is missing from PATH", () => {
      const body = '{"a":1,"b":2}';
      const { stdout } = runCurl({ url: "https://example.com/data.json", body, dropFormatter: "oxfmt" });
      expect(stdout).toBe(body);
    });
  });
});

// Real-binary output checks. Neither formatter is guaranteed on a clean box —
// oxfmt is a devDependency, prettier is only ever reached through npx — so each
// case is gated on the binary actually resolving. Dispatch itself is covered
// hermetically above, so skipping here never leaves a decision branch untested.
describe("curl wrapper formatter integration", () => {
  it.skipIf(!resolveFormatter("oxfmt"))("reformats JSON through the real oxfmt", () => {
    const body = '{"name":"sy","nested":{"a":1,"b":[1,2,3]}}';
    const { stdout } = runCurl({ url: "https://api.example.com/user", body, realFormatter: "oxfmt" });
    expect(stdout).toBe(formatDirect(body, "oxfmt", "json"));
    expect(stdout).toContain('"name": "sy"'); // sanity: reformatting happened
  });

  it.skipIf(!resolveFormatter("prettier"))("reformats markdown through the real prettier", () => {
    const body = "# Title\nsome   **bold**   text\n\n-   item1\n-   item2\n";
    const { stdout } = runCurl({ url: "https://example.com/README.md", body, realFormatter: "prettier" });
    expect(stdout).toBe(formatDirect(body, "prettier", "md"));
  });
});

describe("curl wrapper HAR capture", () => {
  it("writes a valid mm-dd-yyyy.har with one entry per request", () => {
    const body = '{"a":1}';
    const { harFolder } = runCurl({
      url: "https://api.example.com/thing.json",
      body,
      contentType: "application/json",
    });

    const har = readHar(harFolder);
    expect(har.log.version).toBe("1.2");
    expect(har.log.entries).toHaveLength(1);

    const entry = har.log.entries[0];
    expect(entry.request.method).toBe("GET");
    expect(entry.request.url).toBe("https://api.example.com/thing.json");
    expect(entry.response.status).toBe(200);
    expect(entry.response.content.mimeType).toBe("application/json");
    expect(entry.response.content.text).toBe(body);
    expect(entry.startedDateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
    expect(entry.timings.wait).toBeGreaterThan(0);
    expect(entry.response.headers).toContainEqual({ name: "x-fixture", value: "yes" });
  });

  it("appends to the same daily archive instead of overwriting it", () => {
    const harFolder = path.join(sandbox, "har");

    runCurl({ url: "https://example.com/one.json", body: '{"n":1}' });
    runCurl({ url: "https://example.com/two.json", body: '{"n":2}' });
    runCurl({ url: "https://example.com/three.json", body: '{"n":3}' });

    const har = readHar(harFolder);
    expect(har.log.entries.map((e) => e.request.url)).toEqual([
      "https://example.com/one.json",
      "https://example.com/two.json",
      "https://example.com/three.json",
    ]);
  });

  it("records the resolved method and request headers", () => {
    const { harFolder } = runCurl({
      url: "https://example.com/post.json",
      body: '{"ok":true}',
      extraArgs: ["-X", "POST", "-H", "X-Trace: abc123"],
    });

    const entry = readHar(harFolder).log.entries[0];
    expect(entry.request.method).toBe("POST");
    expect(entry.request.headers).toContainEqual({ name: "X-Trace", value: "abc123" });
  });

  it("masks sensitive header values", () => {
    const { harFolder } = runCurl({
      url: "https://example.com/secure.json",
      body: '{"ok":true}',
      extraArgs: ["-H", "Authorization: Bearer super-secret-token"],
    });

    const raw = fs.readFileSync(path.join(harFolder, fs.readdirSync(harFolder)[0]), "utf-8");
    expect(raw).not.toContain("super-secret-token");

    const entry = readHar(harFolder).log.entries[0];
    expect(entry.request.headers).toContainEqual({ name: "Authorization", value: "[REDACTED]" });
  });

  it("stores sensitive values verbatim when BASHRC_CURL_HAR_NO_REDACT=1", () => {
    const { harFolder } = runCurl({
      url: "https://example.com/secure.json",
      body: '{"ok":true}',
      extraArgs: ["-H", "Authorization: Bearer keep-me"],
      env: { BASHRC_CURL_HAR_NO_REDACT: "1" },
    });

    const entry = readHar(harFolder).log.entries[0];
    expect(entry.request.headers).toContainEqual({ name: "Authorization", value: "Bearer keep-me" });
  });

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

/**
 * Format-dispatch tests for the curl() wrapper in software/bootstrap/profile-advanced.sh.
 *
 * Strategy (mirrors osDetection.spec.js):
 *   1. Extract the curl() function body by line markers from profile-advanced.sh
 *      so tests stay robust against line-number shifts.
 *   2. Patch out the `[ -t 1 ]` TTY guard so the formatting path runs in a
 *      non-TTY test subprocess.
 *   3. Build a hermetic sandbox PATH with: a `curl` shim that emits a fixture
 *      body to the wrapper's `-o <tmpfile>` capture + prints the requested
 *      http_code on stdout, the real `prettier` binary, and the coreutils the
 *      wrapper invokes (head, tail, tr, cat, mktemp, rm).
 *   4. Inject a no-op `is_help_arg` shim (the real one lives in profile-core.sh,
 *      out of scope here — we only care about the format-dispatch branch).
 *   5. Invoke `curl <fake-url>` and assert stdout matches `prettier --parser X`
 *      against the same fixture (the wrapper's contract).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE_ADVANCED = path.join(ROOT_DIR, "software/bootstrap/profile-advanced.sh");

/** Coreutils the wrapper + sandbox shims invoke — symlinked from host into sandbox PATH. */
const REQUIRED_TOOLS = ["head", "tail", "tr", "cat", "mktemp", "rm", "cp", "bash"];

/** Per-test sandbox dir. */
let sandbox = "";
/** Cached prettier binary path resolved once per file. */
let prettierBin = "";

beforeEach(() => {
  sandbox = fs.mkdtempSync("/tmp/_curl_fmt_test_");
  fs.mkdirSync(path.join(sandbox, "bin"));

  for (const tool of REQUIRED_TOOLS) {
    for (const dir of ["/usr/bin", "/bin", "/usr/local/bin", "/opt/homebrew/bin"]) {
      const src = path.join(dir, tool);
      if (fs.existsSync(src)) {
        fs.symlinkSync(src, path.join(sandbox, "bin", tool));
        break;
      }
    }
  }

  // Resolve and symlink prettier (real binary — formatting is the unit under test).
  if (!prettierBin) {
    prettierBin = execSync("type -P prettier", { encoding: "utf-8" }).trim();
    if (!prettierBin) throw new Error("prettier not on PATH; cannot run curl-wrapper format tests");
  }
  fs.symlinkSync(prettierBin, path.join(sandbox, "bin", "prettier"));
  // Prettier itself is a Node shim — node must also resolve from sandbox PATH.
  const nodeBin = execSync("type -P node", { encoding: "utf-8" }).trim();
  if (nodeBin) fs.symlinkSync(nodeBin, path.join(sandbox, "bin", "node"));
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

/**
 * Extract `curl()` function from profile-advanced.sh by scanning for the
 * `function curl()` opener and its matching closing `}` (first `^}` at col 0
 * after the opener — convention enforced repo-wide by codestyle).
 */
function extractCurlFunction() {
  const src = fs.readFileSync(PROFILE_ADVANCED, "utf-8").split("\n");
  const startIdx = src.findIndex((l) => l.startsWith("function curl()"));
  if (startIdx < 0) throw new Error("could not locate `function curl()` in profile-advanced.sh");
  const endIdx = src.findIndex((l, i) => i > startIdx && l === "}");
  if (endIdx < 0) throw new Error("could not locate closing `}` for curl() function");
  let block = src.slice(startIdx, endIdx + 1).join("\n");

  // Patch TTY guard — test subprocess is non-TTY, but we need the format path.
  block = block.replace("[ -t 1 ] || {", "false && {");

  return block;
}

/**
 * Drive the patched curl() wrapper against a fixture body and return stdout/stderr.
 *
 * @param {object} opts
 * @param {string} opts.url - fake URL passed as the only positional arg
 * @param {string} opts.body - fixture body the sandbox curl shim emits via -o
 * @param {string} [opts.httpCode] - http status the shim prints to stdout (default 200)
 * @param {boolean} [opts.captureStderr] - merge stderr into stdout (for empty-body assertion)
 * @returns {string}
 */
function runCurl(opts) {
  const fixturePath = path.join(sandbox, "fixture.body");
  fs.writeFileSync(fixturePath, opts.body);

  // Sandbox curl shim — parses -o, copies fixture, prints http_code on stdout.
  // Uses cp for non-empty bodies; `: > file` (truncate) for empty bodies so the
  // wrapper's `! -s "$tmpfile"` empty-body branch fires.
  const curlShim = path.join(sandbox, "bin", "curl");
  const writeBody = opts.body.length === 0 ? ': > "$output_file"' : `cp "${fixturePath}" "$output_file"`;
  fs.writeFileSync(
    curlShim,
    [
      "#!/usr/bin/env bash",
      "output_file=''",
      "while [ $# -gt 0 ]; do",
      "  case \"$1\" in",
      "    -o|--output) output_file=\"$2\"; shift 2 ;;",
      "    *) shift ;;",
      "  esac",
      "done",
      `[ -n "$output_file" ] && ${writeBody}`,
      `printf '%s' "${opts.httpCode ?? "200"}"`,
      "exit 0",
    ].join("\n"),
  );
  fs.chmodSync(curlShim, 0o755);

  const block = extractCurlFunction();
  const runner = path.join(sandbox, "runner.sh");
  fs.writeFileSync(
    runner,
    [
      "#!/usr/bin/env bash",
      // Hermetic PATH: sandbox bin only. No /usr/bin leakage.
      `export PATH="${path.join(sandbox, "bin")}"`,
      // Stub is_help_arg — real one is in profile-core.sh, out of scope here.
      "function is_help_arg() { return 1; }",
      block,
      `curl "${opts.url}"`,
    ].join("\n"),
  );

  const stdio = ["pipe", "pipe", "pipe"];
  return execSync(`bash "${runner}" 2>&1`, { encoding: "utf-8", stdio });
}

/** Run prettier directly against a string body — the wrapper's expected output. */
function prettierFormat(body, parser) {
  const tmp = path.join(sandbox, `direct.${parser}`);
  fs.writeFileSync(tmp, body);
  return execSync(`"${prettierBin}" --parser "${parser}" "${tmp}"`, { encoding: "utf-8" });
}

describe("curl wrapper format dispatch", () => {
  describe("body sniff (no URL extension hint)", () => {
    it("formats JSON object via body sniff", () => {
      const body = '{"name":"sy","nested":{"a":1,"b":[1,2,3]}}';
      const out = runCurl({ url: "https://api.example.com/user", body });
      expect(out).toBe(prettierFormat(body, "json"));
      expect(out).toContain('"name": "sy"'); // sanity: indentation happened
    });

    it("formats JSON array via body sniff", () => {
      const body = '[1,2,3,{"k":"v"}]';
      const out = runCurl({ url: "https://api.example.com/list", body });
      expect(out).toBe(prettierFormat(body, "json"));
    });

    it("formats HTML via body sniff (angle brackets)", () => {
      const body = "<html><body><h1>hi</h1><p>there</p></body></html>";
      const out = runCurl({ url: "https://example.com/page", body });
      expect(out).toBe(prettierFormat(body, "html"));
      expect(out).toContain("<h1>hi</h1>"); // sanity: structure preserved
    });
  });

  describe("URL extension hint (body sniff inconclusive)", () => {
    it("formats markdown from .md URL", () => {
      const body = "# Title\nsome **bold** text\n\n- item1\n- item2\n";
      const out = runCurl({ url: "https://raw.githubusercontent.com/x/y/HEAD/README.md", body });
      expect(out).toBe(prettierFormat(body, "markdown"));
    });

    it("formats YAML from .yml URL", () => {
      const body = "key:    value\nlist:\n  -   a\n  -    b\n";
      const out = runCurl({ url: "https://example.com/config.yml", body });
      expect(out).toBe(prettierFormat(body, "yaml"));
    });

    it("formats YAML from .yaml URL", () => {
      const body = "a:   1\nb: 2\n";
      const out = runCurl({ url: "https://example.com/config.yaml", body });
      expect(out).toBe(prettierFormat(body, "yaml"));
    });

    it("formats JS from .js URL (babel parser)", () => {
      const body = "const   x={a:1,b:2};function f(){return x.a+x.b}";
      const out = runCurl({ url: "https://cdn.example.com/lib.js", body });
      expect(out).toBe(prettierFormat(body, "babel"));
      expect(out).toContain("const x = { a: 1, b: 2 };");
    });

    it("formats TS from .ts URL (typescript parser)", () => {
      const body = "type T={a:number;b:string};const x:T={a:1,b:'hi'};";
      const out = runCurl({ url: "https://cdn.example.com/lib.ts", body });
      expect(out).toBe(prettierFormat(body, "typescript"));
    });

    it("formats XML from .xml URL (html parser)", () => {
      const body = "<root><item id='1'>a</item><item id='2'>b</item></root>";
      const out = runCurl({ url: "https://example.com/data.xml", body });
      expect(out).toBe(prettierFormat(body, "html"));
    });

    it("formats JSON from .json URL even without body shape", () => {
      // Body deliberately has no leading { or [ trimmed — extension hint takes over.
      // (Still well-formed JSON so prettier accepts it.)
      const body = '{"hint":"by-extension"}';
      const out = runCurl({ url: "https://example.com/data.json?token=abc", body });
      expect(out).toBe(prettierFormat(body, "json"));
    });

    it("strips query + fragment before reading extension", () => {
      const body = "# H\n";
      const out = runCurl({ url: "https://example.com/doc.md?v=1#section", body });
      expect(out).toBe(prettierFormat(body, "markdown"));
    });
  });

  describe("fallback paths", () => {
    it("emits raw body when neither sniff nor extension matches", () => {
      const body = "plain text with no shape clue\nsecond line\n";
      const out = runCurl({ url: "https://example.com/raw.dat", body });
      expect(out).toBe(body);
    });

    it("emits empty-body stderr summary and skips prettier on 0-byte response", () => {
      // runCurl helper detects empty `body` and rewrites the shim to truncate
      // the capture file (`: > "$tmpfile"`), so the wrapper hits its
      // `! -s "$tmpfile"` empty-body branch and writes the status summary.
      const out = runCurl({ url: "https://example.com/empty", body: "", httpCode: "204" });
      expect(out).toContain("empty body");
      expect(out).toContain("http 204");
    });
  });
});

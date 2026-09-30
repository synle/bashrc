/**
 * Runs the real text-server (`software/scripts/text-server.cjs`) against a temp folder and
 * checks the behavior that broke during development: path confinement, error mapping
 * (status + readable message), the busy-port fallback, the quiet `/.well-known/` probe,
 * and the bundle builder's tolerance of oxfmt's self-closing `<link />` tags.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import net from "net";
import path from "path";
import { spawn } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SERVER_SCRIPT = path.join(ROOT_DIR, "software/scripts/text-server.cjs");
const { STYLESHEET_TAG_PATTERN, SCRIPT_TAG_PATTERN } = createRequire(import.meta.url)(
  path.join(ROOT_DIR, "software/tools/build-text-server.js"),
);
/** Max wait for a server to print its "open http://localhost:<port>/" line, in ms. */
const START_TIMEOUT_MS = 10000;
/** Root bypasses file permission bits, so the EACCES case cannot be staged. */
const IS_ROOT = typeof process.getuid === "function" && process.getuid() === 0;

const running = [];
let sandbox = "";

/**
 * Reserve a currently free TCP port by binding port 0 and releasing it.
 * @returns {Promise<number>} A port that was free a moment ago.
 */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "0.0.0.0", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/**
 * Start text-server and wait until it reports the port it actually bound.
 * @param {string} folder Folder to serve.
 * @param {number} port Requested port.
 * @param {"0"|"1"} allowCd "1" allows subfolders.
 * @returns {Promise<{port: number, stderr: () => string}>} Bound port and a live view of stderr.
 */
function startServer(folder, port, allowCd) {
  const child = spawn(process.execPath, [SERVER_SCRIPT, folder, String(port), allowCd], { stdio: ["ignore", "ignore", "pipe"] });
  running.push(child);
  let stderr = "";
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`text-server did not start:\n${stderr}`)), START_TIMEOUT_MS);
    child.once("exit", (code) => reject(new Error(`text-server exited ${code}:\n${stderr}`)));
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      const match = stderr.match(/open http:\/\/localhost:(\d+)\//);
      if (match) {
        clearTimeout(timer);
        resolve({ port: Number(match[1]), stderr: () => stderr });
      }
    });
  });
}

/**
 * Wait until the server's stderr contains `text` (the log line is written after the response is sent).
 * @param {() => string} stderr Live stderr view from startServer.
 * @param {string} text Text to wait for.
 * @returns {Promise<void>} Resolves once seen.
 * @throws {Error} When the text does not appear within START_TIMEOUT_MS.
 */
async function waitForLog(stderr, text) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (!stderr().includes(text)) {
    if (Date.now() > deadline) throw new Error(`log line never appeared: ${text}\n${stderr()}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/**
 * Call the server and decode the reply.
 * @param {number} port Server port.
 * @param {string} route Path + query, e.g. "/api/file?path=a.txt".
 * @param {string} [method="GET"] HTTP method.
 * @returns {Promise<{status: number, body: any}>} Status and parsed JSON body (raw text when not JSON).
 */
async function call(port, route, method = "GET") {
  const res = await fetch(`http://127.0.0.1:${port}${route}`, { method });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // non-JSON bodies (the page, empty 404s) stay as text
  }
  return { status: res.status, body };
}

beforeAll(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "text-server-spec-"));
  fs.mkdirSync(path.join(sandbox, "root"));
  fs.mkdirSync(path.join(sandbox, "root", "existing"));
  fs.mkdirSync(path.join(sandbox, "root", "locked"));
  fs.writeFileSync(path.join(sandbox, "root", "a.txt"), "hello");
  fs.writeFileSync(path.join(sandbox, "outside.txt"), "secret");
  fs.symlinkSync(path.join(sandbox, "outside.txt"), path.join(sandbox, "root", "escape.txt"));
  fs.chmodSync(path.join(sandbox, "root", "locked"), 0o000);
});

afterAll(() => {
  for (const child of running) child.kill();
  fs.chmodSync(path.join(sandbox, "root", "locked"), 0o755);
  fs.rmSync(sandbox, { recursive: true, force: true });
});

describe("text-server path confinement", () => {
  let port;
  beforeAll(async () => {
    ({ port } = await startServer(path.join(sandbox, "root"), await freePort(), "1"));
  });

  it("serves a file inside the root", async () => {
    expect(await call(port, "/api/file?path=a.txt")).toEqual({ status: 200, body: { path: "a.txt", content: "hello" } });
  });

  it("rejects a .. escape with 403", async () => {
    expect(await call(port, "/api/file?path=" + encodeURIComponent("../outside.txt"))).toEqual({ status: 403, body: { error: "path outside root" } });
  });

  it("rejects an absolute path with 403", async () => {
    expect(await call(port, "/api/file?path=" + encodeURIComponent(path.join(sandbox, "outside.txt")))).toEqual({
      status: 403,
      body: { error: "path outside root" },
    });
  });

  it("rejects a symlink that points outside the root with 403", async () => {
    expect(await call(port, "/api/file?path=escape.txt")).toEqual({ status: 403, body: { error: "path outside root" } });
  });
});

describe("text-server error mapping", () => {
  let port;
  beforeAll(async () => {
    ({ port } = await startServer(path.join(sandbox, "root"), await freePort(), "1"));
  });

  it("returns 404 not found for a missing file", async () => {
    expect(await call(port, "/api/file?path=missing.txt")).toEqual({ status: 404, body: { error: "not found" } });
  });

  it.skipIf(IS_ROOT)("returns 403 permission denied for an unreadable folder", async () => {
    expect(await call(port, "/api/list?path=locked")).toEqual({ status: 403, body: { error: "permission denied (EACCES)" } });
  });

  it("returns 409 already exists when creating an existing folder", async () => {
    expect(await call(port, "/api/folder?path=existing", "POST")).toEqual({ status: 409, body: { error: "already exists (EEXIST)" } });
  });

  it("returns 404 unknown route for an unknown API path", async () => {
    expect(await call(port, "/api/bogus")).toEqual({ status: 404, body: { error: "unknown route" } });
  });

  it("answers the deep-link lookup on /api/info, not the ad-blocked /api/stat", async () => {
    expect(await call(port, "/api/info?path=a.txt")).toEqual({ status: 200, body: { path: "a.txt", folder: false } });
    expect((await call(port, "/api/stat?path=a.txt")).status).toBe(404);
  });
});

describe("text-server startup", () => {
  it("falls back to a free port when the requested one is busy", async () => {
    const blocker = net.createServer();
    const busyPort = await new Promise((resolve) => blocker.listen(0, "0.0.0.0", () => resolve(blocker.address().port)));
    try {
      const server = await startServer(path.join(sandbox, "root"), busyPort, "0");
      expect(server.port).not.toBe(busyPort);
      expect(server.stderr()).toContain(`port ${busyPort} in use, picking a free port`);
      expect((await call(server.port, "/api/file?path=a.txt")).status).toBe(200);
    } finally {
      blocker.close();
    }
  });

  it("embeds the app version in the page and the startup log", async () => {
    const server = await startServer(path.join(sandbox, "root"), await freePort(), "0");
    const version = server.stderr().match(/version (\S+),/)[1];
    expect(version).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect((await call(server.port, "/")).body).toContain(`const APP_VERSION = ${JSON.stringify(version)};`);
  });
});

describe("text-server request log", () => {
  it("answers /.well-known/ probes with 404 without logging them", async () => {
    const server = await startServer(path.join(sandbox, "root"), await freePort(), "0");
    expect((await call(server.port, "/.well-known/appspecific/com.chrome.devtools.json")).status).toBe(404);
    expect((await call(server.port, "/nope")).status).toBe(404);
    // Requests are logged in order, so once the later /nope line is in, a /.well-known/ line would be too.
    await waitForLog(server.stderr, "GET /nope -> 404");
    expect(server.stderr()).not.toContain(".well-known");
  });
});

describe("build-text-server tag patterns", () => {
  const CSS_URL = "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css";

  it("matches a plain stylesheet link", () => {
    expect([...`<link rel="stylesheet" href="${CSS_URL}">`.matchAll(STYLESHEET_TAG_PATTERN)].map((m) => m[1])).toEqual([CSS_URL]);
  });

  it("matches oxfmt's self-closing stylesheet link", () => {
    expect([...`<link rel="stylesheet" href="${CSS_URL}" />`.matchAll(STYLESHEET_TAG_PATTERN)].map((m) => m[1])).toEqual([CSS_URL]);
  });

  it("matches a CDN script tag", () => {
    const url = "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js";
    expect([...`<script src="${url}"></script>`.matchAll(SCRIPT_TAG_PATTERN)].map((m) => m[1])).toEqual([url]);
  });
});

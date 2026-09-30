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

describe("text-server upload (drag and drop)", () => {
  let port;
  beforeAll(async () => {
    ({ port } = await startServer(path.join(sandbox, "root"), await freePort(), "1"));
  });

  /**
   * POST a body to /api/upload.
   * @param {string} rel Target relative path.
   * @param {string} content File content.
   * @returns {Promise<{status: number, body: any}>} Status and JSON body.
   */
  async function upload(rel, content) {
    const res = await fetch(`http://127.0.0.1:${port}/api/upload?path=${encodeURIComponent(rel)}`, { method: "POST", body: content });
    return { status: res.status, body: await res.json() };
  }

  it("creates a new file with the dropped content", async () => {
    expect(await upload("dropped.txt", "one")).toEqual({ status: 200, body: { path: "dropped.txt" } });
    expect(fs.readFileSync(path.join(sandbox, "root", "dropped.txt"), "utf8")).toBe("one");
  });

  it("stores binary bytes unchanged (no utf8 round-trip)", async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe, 0x80]);
    const res = await fetch(`http://127.0.0.1:${port}/api/upload?path=img.png`, { method: "POST", body: bytes });
    expect(await res.json()).toEqual({ path: "img.png" });
    expect(fs.readFileSync(path.join(sandbox, "root", "img.png")).equals(bytes)).toBe(true);
  });

  it("saves a clashing name as <name>.<timestamp> and leaves the original untouched", async () => {
    const { status, body } = await upload("a.txt", "two");
    expect(status).toBe(200);
    expect(body.duplicate).toBe(true);
    expect(body.path).toMatch(/^a\.txt\.\d{2}-\d{2}-\d{4}_\d{2}-\d{2}(-\d+)?$/);
    expect(fs.readFileSync(path.join(sandbox, "root", body.path), "utf8")).toBe("two");
    expect(fs.readFileSync(path.join(sandbox, "root", "a.txt"), "utf8")).toBe("hello");
  });

  it("gives a second clash in the same minute its own -N name instead of failing", async () => {
    fs.writeFileSync(path.join(sandbox, "root", "burst.txt"), "orig");
    const first = await upload("burst.txt", "x");
    const second = await upload("burst.txt", "y");
    expect(second.status).toBe(200);
    expect(second.body.path).not.toBe(first.body.path);
    expect(fs.readFileSync(path.join(sandbox, "root", first.body.path), "utf8")).toBe("x");
    expect(fs.readFileSync(path.join(sandbox, "root", second.body.path), "utf8")).toBe("y");
  });

  it("onclash=suffix inserts -1, -2 right after the stamp, keeping the extension last", async () => {
    const rel = "clipboard.picture.09-30-2026_14-44.png";
    const suffix = async (content) => {
      const res = await fetch(`http://127.0.0.1:${port}/api/upload?path=${encodeURIComponent(rel)}&onclash=suffix`, { method: "POST", body: content });
      return res.json();
    };
    expect(await suffix("p0")).toEqual({ path: "clipboard.picture.09-30-2026_14-44.png" });
    expect(await suffix("p1")).toEqual({ path: "clipboard.picture.09-30-2026_14-44-1.png", duplicate: true });
    expect(await suffix("p2")).toEqual({ path: "clipboard.picture.09-30-2026_14-44-2.png", duplicate: true });
    expect(fs.readFileSync(path.join(sandbox, "root", "clipboard.picture.09-30-2026_14-44-2.png"), "utf8")).toBe("p2");
  });

  it("rejects an unknown onclash mode with 400", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/upload?path=x.txt&onclash=overwrite`, { method: "POST", body: "z" });
    expect({ status: res.status, body: await res.json() }).toEqual({ status: 400, body: { error: "invalid onclash" } });
  });
});

describe("text-server raw media and download", () => {
  let port;
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);
  beforeAll(async () => {
    fs.writeFileSync(path.join(sandbox, "root", "pic.png"), PNG);
    fs.writeFileSync(path.join(sandbox, "root", "notes.txt"), "text body");
    ({ port } = await startServer(path.join(sandbox, "root"), await freePort(), "1"));
  });

  it("serves an image's exact bytes with its content type", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/raw?path=pic.png`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it("answers a byte range with 206 and only that slice (video seeking)", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/raw?path=pic.png`, { headers: { Range: "bytes=1-3" } });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 1-3/10");
    expect(Buffer.from(await res.arrayBuffer()).equals(Buffer.from([0x50, 0x4e, 0x47]))).toBe(true);
  });

  it("rejects an unsatisfiable range with 416", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/raw?path=pic.png`, { headers: { Range: "bytes=50-60" } });
    expect(res.status).toBe(416);
  });

  it("refuses to view a non-media file inline with 415", async () => {
    expect(await call(port, "/api/raw?path=notes.txt")).toEqual({ status: 415, body: { error: "not a viewable media type" } });
  });

  it("downloads any file as an attachment named after it", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/raw?path=notes.txt&download=1`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("content-disposition")).toBe(`attachment; filename="notes.txt"; filename*=UTF-8''notes.txt`);
    expect(await res.text()).toBe("text body");
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

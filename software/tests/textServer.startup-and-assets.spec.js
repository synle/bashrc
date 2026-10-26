import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import http from "http";
import os from "os";
import net from "net";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { createTextServerHarness } from "./textServer.helpers.js";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { STYLESHEET_TAG_PATTERN, SCRIPT_TAG_PATTERN } = createRequire(import.meta.url)(
  path.join(ROOT_DIR, "software/tools/build-text-server.js"),
);
const IS_ROOT = typeof process.getuid === "function" && process.getuid() === 0;
const serverHarness = createTextServerHarness();
let sandbox = "";

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

afterAll(async () => {
  try {
    await serverHarness.stop();
  } finally {
    fs.chmodSync(path.join(sandbox, "root", "locked"), 0o755);
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

describe("text-server startup", () => {
  it("answers the HEAD / liveness probe with 200 and no body, not 404", async () => {
    const { port } = await serverHarness.start(path.join(sandbox, "root"), await serverHarness.freePort(), "1");
    const res = await fetch(`http://127.0.0.1:${port}/`, { method: "HEAD" });
    expect({ status: res.status, body: await res.text() }).toEqual({ status: 200, body: "" });
  });

  it("injects the server's upload limit into the page", async () => {
    const { port } = await serverHarness.start(path.join(sandbox, "root"), await serverHarness.freePort(), "1");
    const page = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    expect(page).toContain(`const MAX_BODY_BYTES = ${300 * 1024 * 1024};`);
  });
  it("falls back to a free port when the requested one is busy", async () => {
    const blocker = net.createServer();
    const busyPort = await new Promise((resolve) => blocker.listen(0, "0.0.0.0", () => resolve(blocker.address().port)));
    try {
      const server = await serverHarness.start(path.join(sandbox, "root"), busyPort, "0");
      expect(server.port).not.toBe(busyPort);
      expect(server.stderr()).toContain(`port ${busyPort} in use, picking a free port`);
      expect((await serverHarness.call(server.port, "/api/file?path=a.txt")).status).toBe(200);
    } finally {
      blocker.close();
    }
  });

  it("embeds the app version in the page and the startup log", async () => {
    const server = await serverHarness.start(path.join(sandbox, "root"), await serverHarness.freePort(), "0");
    const version = server.stderr().match(/version (\S+),/)[1];
    expect(version).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect((await serverHarness.call(server.port, "/")).body).toContain(`const APP_VERSION = ${JSON.stringify(version)};`);
  });
});

describe("text-server request log", () => {
  it("answers /.well-known/ probes with 404 without logging them", async () => {
    const server = await serverHarness.start(path.join(sandbox, "root"), await serverHarness.freePort(), "0");
    expect((await serverHarness.call(server.port, "/.well-known/appspecific/com.chrome.devtools.json")).status).toBe(404);
    expect((await serverHarness.call(server.port, "/nope")).status).toBe(404);
    // Requests are logged in order, so once the later /nope line is in, a /.well-known/ line would be too.
    await serverHarness.waitForLog(server.stderr, "GET /nope -> 404");
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

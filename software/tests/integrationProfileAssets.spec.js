/** Isolated request checks for real-profile recovery and the Arch build prerequisite. */
import { describe, expect, it, onTestFinished } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath, pathToFileURL } from "url";
import { parse } from "yaml";
import { PUBLISHED_WEBAPP_URL } from "./integration/webapp/urls.js";

/** Actual integration setup, evaluated without module syntax or a real listener. */
const setupFile = path.resolve("software/tests/integration/webapp/local.setup.js");
/** Keep the same import-relative dist location as the real setup module. */
const distFolder = path.resolve("dist");
/** Load the complete server implementation, replacing only module-loading syntax. */
const setupSource = fs
  .readFileSync(setupFile, "utf8")
  .replace(/^import .*;\n/gm, "")
  .replace(/import\.meta\.url/g, JSON.stringify(pathToFileURL(setupFile).href))
  .replace(/^export /gm, "");

/**
 * Start the public setup entry point with isolated filesystem and HTTP boundaries.
 * @param {Array<{status: number, content?: string} | Error>} responses - Ordered upstream responses.
 * @param {Record<string, string>} [files={}] - Existing dist assets, keyed by absolute filename.
 * @returns {Promise<object>} Request operation, recorded destinations, signals, and diagnostics.
 * @throws {Error} When setup or the actual request handler fails unexpectedly.
 * @sideEffects Registers teardown; never opens sockets, writes files, or contacts the network.
 */
async function fixture(responses, files = {}) {
  const requests = [];
  const errors = [];
  let handler;
  const listener = {
    once() {},
    off() {},
    listen(_port, ready) {
      ready();
    },
    close(ready) {
      ready();
    },
  };
  const sandbox = {
    URL,
    AbortSignal,
    join: path.join,
    extname: path.extname,
    fileURLToPath,
    PUBLISHED_WEBAPP_URL,
    existsSync: (file) => file === distFolder || Object.prototype.hasOwnProperty.call(files, file),
    statSync: () => ({ isDirectory: () => false }),
    readFileSync: (file) => files[file],
    createServer(callback) {
      handler = callback;
      return listener;
    },
    /**
     * Return the next isolated upstream response and retain the actual request destination.
     * @param {URL} url - Allowlisted source selected by the real handler.
     * @param {{signal: AbortSignal}} options - Shared request deadline.
     * @returns {Promise<object>} Minimal HTTP response consumed by the handler.
     * @throws {Error} When the fixture supplies a transport error or exhausts its responses.
     */
    async fetch(url, { signal }) {
      requests.push({ url: url.href, signal });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      if (!response) throw new Error("Unexpected upstream request");
      return {
        status: response.status,
        ok: response.status >= 200 && response.status < 300,
        body: { async cancel() {} },
        text: async () => response.content || "",
      };
    },
    console: { log() {}, error: (...args) => errors.push(args) },
  };
  vm.runInNewContext(setupSource, sandbox, { filename: setupFile });
  onTestFinished(() => sandbox.teardown());
  await sandbox.setup();
  return {
    requests,
    errors,
    /**
     * Send one request through the real handler and capture its public response.
     * @param {string} url - Local request target.
     * @returns {Promise<object>} Response status, headers, and exact content.
     * @throws {Error} When the actual handler rejects unexpectedly.
     */
    async request(url) {
      const response = {};
      await handler(
        { url },
        {
          writeHead(status, headers) {
            Object.assign(response, { status, headers });
          },
          end(content) {
            response.content = content;
          },
        },
      );
      return response;
    },
  };
}

describe("local integration profile assets", () => {
  it("retains successful Pages content without contacting the release", async () => {
    const f = await fixture([{ status: 200, content: "# published profile\n" }]);
    const response = await f.request("/profile_bashrc_arch_linux.sh");
    expect(response.status).toBe(200);
    expect(response.headers["Content-Type"]).toBe("text/plain");
    expect(response.content).toBe("# published profile\n");
    expect(f.requests.map(({ url }) => url)).toMatchInlineSnapshot(`
      [
        "https://synle.github.io/bashrc/profile_bashrc_arch_linux.sh",
      ]
    `);
    expect(f.errors).toEqual([]);
  });

  it("recovers a Pages 404 from the canonical release and shares one deadline", async () => {
    const f = await fixture([{ status: 404 }, { status: 200, content: "# cached Arch profile\n" }]);
    const response = await f.request("/profile_bashrc_arch_linux.sh");
    expect(response.status).toBe(200);
    expect(response.content).toBe("# cached Arch profile\n");
    expect(f.requests.map(({ url }) => url)).toMatchInlineSnapshot(`
      [
        "https://synle.github.io/bashrc/profile_bashrc_arch_linux.sh",
        "https://github.com/synle/bashrc/releases/download/binary-cache/bashrc-profile__profile_bashrc_arch_linux.sh",
      ]
    `);
    expect(f.requests[0].signal).toBeInstanceOf(AbortSignal);
    expect(f.requests[1].signal).toBe(f.requests[0].signal);
    expect(f.errors).toEqual([]);
  });

  it("reuses cached release bytes on subsequent requests", async () => {
    const f = await fixture([{ status: 404 }, { status: 200, content: "# cached profile\n" }]);
    const first = await f.request("/profile_bashrc_arch_linux.sh");
    const second = await f.request("/profile_bashrc_arch_linux.sh");
    expect(first.status).toBe(200);
    expect(second).toEqual(first);
    expect(f.requests.map(({ url }) => url)).toMatchInlineSnapshot(`
      [
        "https://synle.github.io/bashrc/profile_bashrc_arch_linux.sh",
        "https://github.com/synle/bashrc/releases/download/binary-cache/bashrc-profile__profile_bashrc_arch_linux.sh",
      ]
    `);
  });

  it.each([401, 403, 500, 503])("does not hide Pages HTTP %i with a cached profile", async (status) => {
    const f = await fixture([{ status }]);
    const response = await f.request("/profile_bashrc_arch_linux.sh");
    expect(response.status).toBe(502);
    expect(response.content).toBe("Published integration profile unavailable");
    expect(f.requests.map(({ url }) => url)).toMatchInlineSnapshot(`
      [
        "https://synle.github.io/bashrc/profile_bashrc_arch_linux.sh",
      ]
    `);
    expect(f.errors[0][2].message).toBe(`Published profile returned HTTP ${status}`);
  });

  it("does not hide a Pages transport failure", async () => {
    const error = new TypeError("Network unavailable");
    const f = await fixture([error]);
    const response = await f.request("/profile_bashrc_arch_linux.sh");
    expect(response.status).toBe(502);
    expect(response.content).toBe("Published integration profile unavailable");
    expect(f.errors[0][2]).toBe(error);
    expect(f.requests.map(({ url }) => url)).toMatchInlineSnapshot(`
      [
        "https://synle.github.io/bashrc/profile_bashrc_arch_linux.sh",
      ]
    `);
  });

  it("retains a visible error when the canonical release also returns 404", async () => {
    const f = await fixture([{ status: 404 }, { status: 404 }]);
    const response = await f.request("/profile_bashrc_arch_linux.sh");
    expect(response.status).toBe(502);
    expect(response.content).toBe("Published integration profile unavailable");
    expect(f.errors[0][2].message).toBe("Published profile returned HTTP 404");
  });

  it.each(["", "<!doctype html>not a profile", "#".repeat(4 * 1024 * 1024 + 1)])(
    "rejects empty, HTML, and oversized release bodies",
    async (content) => {
      const f = await fixture([{ status: 404 }, { status: 200, content }]);
      const response = await f.request("/profile_bashrc_arch_linux.sh");
      expect(response.status).toBe(502);
      expect(response.content).toBe("Published integration profile unavailable");
      expect(f.errors[0][2].message).toBe("Published profile is not bounded shell content");
    },
  );

  it("prefers an existing dist profile without contacting either upstream", async () => {
    const f = await fixture([], { [path.join(distFolder, "profile_bashrc_arch_linux.sh")]: "# local profile\n" });
    const response = await f.request("/profile_bashrc_arch_linux.sh");
    expect(response.status).toBe(200);
    expect(response.content).toBe("# local profile\n");
    expect(f.requests).toEqual([]);
  });

  it("never forwards unrecognized profile names to the release cache", async () => {
    const f = await fixture([], { [path.join(distFolder, "index.html")]: "<html>app</html>" });
    const response = await f.request("/profile_bashrc_unknown.sh");
    expect(response.status).toBe(200);
    expect(response.content).toBe("<html>app</html>");
    expect(f.requests).toEqual([]);
  });
});

describe("Arch profile production", () => {
  it("upgrades installed packages with the databases before producing the profile", () => {
    const workflow = parse(fs.readFileSync(".github/workflows/build-main.yml", "utf8"));
    const arch = workflow.jobs["build-arch"];
    expect(arch.steps[0].run).toBe("pacman -Syu --noconfirm git curl sudo make unzip");
    expect(arch["continue-on-error"]).toBe(true);
  });
});

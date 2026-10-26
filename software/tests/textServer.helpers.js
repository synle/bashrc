import net from "net";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

/** Repository root resolved from this test helper's location.
 * @type {string}
 */
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Text-server entry point used by subprocess integration tests.
 * @type {string}
 */
const SERVER_SCRIPT = path.join(ROOT_DIR, "software/scripts/text-server.cjs");
/** Maximum wait for server startup or a requested log entry, in milliseconds.
 * @type {number}
 */
const START_TIMEOUT_MS = 10000;

/** @typedef {{ status: number, body: unknown }} TextServerResponse */
/** @typedef {{ port: number, stderr: () => string }} TextServerEndpoint */
/**
 * @typedef {object} TextServerHarness
 * @property {() => Promise<number>} freePort - Reserves then releases an available port.
 * @property {(folder: string, port: number, allowCd: string) => Promise<TextServerEndpoint>} start - Starts and tracks one server.
 * @property {(port: number, route: string, method?: string) => Promise<TextServerResponse>} call - Sends one HTTP request.
 * @property {(stderr: () => string, text: string) => Promise<void>} waitForLog - Waits until captured stderr contains text.
 * @property {() => Promise<void>} stop - Stops tracked servers and waits for their close events.
 */

/** Creates isolated helpers that own the server subprocesses for one test file.
 * @returns {TextServerHarness} Port, request, log, and shutdown helpers.
 */
export function createTextServerHarness() {
  const children = [];
  return {
    freePort,
    start: (folder, port, allowCd) => startServer(folder, port, allowCd, children),
    call: requestTextServer,
    waitForLog,
    stop: () => stopTextServers(children),
  };
}

/** Reserves and releases an available IPv4 port for the server process.
 * @returns {Promise<number>} Released port number.
 */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "0.0.0.0", () => {
      const { port } = probe.address();
      probe.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

/** Starts a server subprocess and resolves after its endpoint appears in stderr.
 * @param {string} folder - Root folder served by the child process.
 * @param {number} port - Requested port; the server may choose a fallback if it is busy.
 * @param {string} allowCd - Whether the server permits folder navigation, as `"0"` or `"1"`.
 * @param {import("child_process").ChildProcess[]} children - Processes owned by this harness.
 * @returns {Promise<TextServerEndpoint>} Selected port and a live stderr accessor.
 */
function startServer(folder, port, allowCd, children) {
  const child = spawn(process.execPath, [SERVER_SCRIPT, folder, String(port), allowCd], { stdio: ["ignore", "ignore", "pipe"] });
  children.push(child);
  let stderr = "";

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const cleanupStartupListeners = () => {
      clearTimeout(timer);
      child.removeListener("error", onError);
      child.removeListener("exit", onExit);
    };
    const settle = (error, endpoint) => {
      if (settled) return;
      settled = true;
      cleanupStartupListeners();
      if (error) {
        child.stderr.removeListener("data", onStderr);
        reject(error);
        return;
      }
      child.once("close", () => child.stderr.removeListener("data", onStderr));
      resolve(endpoint);
    };
    const onError = (error) => settle(error);
    const onExit = (code) => settle(new Error(`text-server exited ${code}:\n${stderr}`));
    const onStderr = (chunk) => {
      stderr += chunk;
      const match = stderr.match(/open http:\/\/localhost:(\d+)\//);
      if (match) settle(null, { port: Number(match[1]), stderr: () => stderr });
    };

    timer = setTimeout(() => settle(new Error(`text-server did not start:\n${stderr}`)), START_TIMEOUT_MS);
    child.once("error", onError);
    child.once("exit", onExit);
    child.stderr.on("data", onStderr);
  });
}

/** Waits until the live stderr buffer contains a requested line or the timeout expires.
 * @param {() => string} stderr - Accessor for the child's captured stderr.
 * @param {string} text - Required log text.
 * @returns {Promise<void>} Resolves when the text appears.
 * @throws {Error} If the text does not appear within the startup timeout.
 */
async function waitForLog(stderr, text) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (!stderr().includes(text)) {
    if (Date.now() > deadline) throw new Error(`log line never appeared: ${text}\n${stderr()}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** Sends an HTTP request to the local server and parses JSON bodies when possible.
 * @param {number} port - Listening port.
 * @param {string} route - Request path and query.
 * @param {string} [method="GET"] - HTTP method.
 * @returns {Promise<TextServerResponse>} Response status and JSON or text body.
 */
async function requestTextServer(port, route, method = "GET") {
  const res = await fetch(`http://127.0.0.1:${port}${route}`, { method });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Non-JSON bodies remain text.
  }
  return { status: res.status, body };
}

/** Stops one owned process and waits until its stdio handles close.
 * @param {import("child_process").ChildProcess} child - Owned server process.
 * @returns {Promise<void>} Resolves after process close.
 */
function stopTextServer(child) {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const onClose = () => {
      child.removeListener("error", onError);
      resolve();
    };
    const onError = (error) => {
      child.removeListener("close", onClose);
      reject(error);
    };
    child.once("close", onClose);
    child.once("error", onError);
    if (!child.kill() && (child.exitCode !== null || child.signalCode !== null)) {
      child.removeListener("close", onClose);
      child.removeListener("error", onError);
      resolve();
    }
  });
}

/** Stops every server owned by one test harness and reports any shutdown error.
 * @param {import("child_process").ChildProcess[]} children - Owned server processes.
 * @returns {Promise<void>} Resolves after every child closes.
 */
async function stopTextServers(children) {
  const results = await Promise.allSettled(children.map(stopTextServer));
  const failure = results.find((result) => result.status === "rejected");
  if (failure) throw failure.reason;
}

/** Global setup that starts a local static server serving the dist folder for integration tests. */
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { PUBLISHED_WEBAPP_URL } from "./urls.js";

const PORT = 4173;
/** Canonical webapp build output, resolved independently of the current working folder. */
const DIST_DIR = fileURLToPath(new URL("../../../../dist/", import.meta.url));
/** Published shell assets are not emitted by the webapp-only build. */
const PROFILE_ASSETS = new Set([
  "/profile_bashrc_mac.sh",
  "/profile_bashrc_ubuntu.sh",
  "/profile_bashrc_redhat.sh",
  "/profile_bashrc_arch_linux.sh",
]);
/** Reuse actual published bytes across browser workers, never synthetic shell fixtures. */
const profileAssets = new Map();

/** MIME type map for common static file extensions. */
const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/** @type {import("node:http").Server | undefined} */
let server;

/**
 * Start the local dist server, retaining real published profile responses for assets absent from a webapp-only build.
 * @returns {Promise<void>} Resolves after listening; rejects if dist is absent or the port cannot bind.
 * @throws {Error} When the required dist folder does not exist.
 */
export async function setup() {
  if (!existsSync(DIST_DIR)) {
    throw new Error(`dist folder not found at ${DIST_DIR}. Run "make build_webapp" first.`);
  }

  server = createServer(async (req, res) => {
    const urlPath = new URL(req.url, `http://localhost:${PORT}`).pathname;
    let filePath = join(DIST_DIR, urlPath === "/" ? "index.html" : urlPath);

    if (PROFILE_ASSETS.has(urlPath) && !existsSync(filePath)) {
      try {
        if (!profileAssets.has(urlPath)) {
          profileAssets.set(
            urlPath,
            fetch(new URL(urlPath.slice(1), PUBLISHED_WEBAPP_URL), { signal: AbortSignal.timeout(30000) }).then(async (response) => {
              if (!response.ok) throw new Error(`Published profile returned HTTP ${response.status}`);
              const content = await response.text();
              if (!content.startsWith("#") || content.length > 4 * 1024 * 1024)
                throw new Error("Published profile is not bounded shell content");
              return content;
            }),
          );
        }
        const content = await profileAssets.get(urlPath);
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(content);
      } catch (error) {
        console.error("Published integration profile unavailable:", urlPath, error);
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("Published integration profile unavailable");
      }
      return;
    }

    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      filePath = join(DIST_DIR, "index.html");
    }

    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    try {
      const content = readFileSync(filePath);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, () => {
      server.off("error", reject);
      resolve();
    });
  });
  console.log(`Local integration test server started at http://localhost:${PORT}/`);
}

/** Stop the owned local server after browser workers close. @returns {Promise<void>} Resolves when the listener closes. */
export async function teardown() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    console.log("Local integration test server stopped.");
  }
}

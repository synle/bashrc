/** Global setup that starts a local static server serving the dist folder for smoke tests. */
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const PORT = 4173;
const DIST_DIR = join(fileURLToPath(import.meta.url), "../../../dist");

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

/** Starts a static file server on the dist folder. */
export async function setup() {
  if (!existsSync(DIST_DIR)) {
    throw new Error(`dist folder not found at ${DIST_DIR}. Run "make build_webapp" first.`);
  }

  server = createServer((req, res) => {
    const urlPath = new URL(req.url, `http://localhost:${PORT}`).pathname;
    let filePath = join(DIST_DIR, urlPath === "/" ? "index.html" : urlPath);

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

  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Local smoke test server started at http://localhost:${PORT}/`);
}

/** Stops the local static server. */
export async function teardown() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    console.log("Local smoke test server stopped.");
  }
}

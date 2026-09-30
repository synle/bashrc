#!/usr/bin/env node
/*
 * text-server — tiny browser file editor for one folder, zero npm dependencies.
 * ===========================================================================
 * Usage: text-server-app <folder> <port> [<allow_cd 0|1>]
 *
 * allow_cd=0 (default): locked to files directly in <folder> — no subfolder
 * listing/navigation, no folder create/delete. allow_cd=1: subfolders allowed,
 * still confined to <folder>.
 *
 * Serves a single-page UI (text-server.html, read from this file's folder; CodeMirror 5
 * from cdnjs) plus a small JSON API:
 *   GET    /api/list?path=<rel>   list a folder
 *   GET    /api/stat?path=<rel>   { path, folder } — lets the UI deep-link ?path= to a file or folder
 *   GET    /api/file?path=<rel>   read a file (utf8)
 *   PUT    /api/file?path=<rel>   create/overwrite a file (body = content)
 *   POST   /api/folder?path=<rel> create a folder
 *   POST   /api/rename?path=<rel>&to=<name>  rename in place (same folder, no overwrite)
 *   GET    /api/search?path=<rel>&q=<text>&mode=name|content  search file names or contents
 *   DELETE /api/file?path=<rel>   delete a file or empty folder
 *
 * No auth: anyone who can reach the port can read/write under <folder>.
 * Paths are confined to <folder>, symlinks included (resolved with realpath
 * before any IO).
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

/** Max request body accepted for a file save, in bytes (10 MiB). */
const MAX_BODY_BYTES = 10 * 1024 * 1024;
/** Max file size served to the editor, in bytes (5 MiB). */
const MAX_READ_BYTES = 5 * 1024 * 1024;
/** Max files a single search visits before stopping (keeps one request bounded). */
const MAX_SEARCH_FILES = 5000;
/** Max hits a single search returns. */
const MAX_SEARCH_RESULTS = 200;
/** Folder names a search never descends into. */
const SEARCH_SKIP_FOLDERS = new Set([".git", "node_modules"]);

const ROOT = fs.realpathSync(path.resolve(process.argv[2] || "."));
const PORT = Number(process.argv[3] || 9998);
/** When false, only files directly inside ROOT are reachable (no folder navigation). */
const ALLOW_CD = process.argv[4] === "1";

/** UI page template (placeholders __ROOT_NAME__, __ALLOW_CD__, __ROOT_PATH__), read once from the sibling file. */
let PAGE_HTML;
try {
  PAGE_HTML = fs.readFileSync(path.join(__dirname, "text-server.html"), "utf8");
} catch (err) {
  process.stderr.write(`text-server: cannot read UI template next to ${__filename}: ${err.code || err.message}\n`);
  process.exit(1);
}

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  process.stderr.write(`text-server: port out of range 1-65535: ${process.argv[3]}\n`);
  process.exit(1);
}

/**
 * Build an HTTP-status-carrying error.
 * @param {number} status HTTP status.
 * @param {string} message Client-safe message.
 * @returns {Error & {status: number}} Error with status.
 */
function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

/**
 * True when `p` is ROOT or strictly below it.
 * @param {string} p Absolute path.
 * @returns {boolean} Whether p is inside ROOT.
 */
function isInsideRoot(p) {
  return p === ROOT || p.startsWith(ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep);
}

/**
 * Resolve a client-relative path inside ROOT, rejecting escapes (incl. via symlinks).
 * Rejects absolute paths, `..` segments, and NUL outright rather than normalizing them.
 * When ALLOW_CD is false the result must be ROOT itself or a direct child of ROOT.
 * @param {string} rel Relative path from the client.
 * @param {boolean} mustExist When false, only the parent folder must exist (create case).
 * @returns {string} Absolute path inside ROOT.
 * @throws {Error} with `status` 403/404 when invalid.
 */
function resolveSafe(rel, mustExist) {
  const raw = String(rel || "");
  const segments = raw.split(/[\\/]+/).filter(Boolean);
  if (raw.includes("\0") || path.isAbsolute(raw) || /^[A-Za-z]:/.test(raw) || segments.includes("..")) {
    throw httpError(403, "path outside root");
  }
  if (!ALLOW_CD && segments.length > 1) throw httpError(403, "folder navigation disabled");
  const target = path.resolve(ROOT, ...segments);
  if (!isInsideRoot(target)) throw httpError(403, "path outside root");
  const probe = mustExist ? target : path.dirname(target);
  let real;
  try {
    real = fs.realpathSync(probe);
  } catch (err) {
    throw httpError(404, "not found");
  }
  if (!isInsideRoot(real)) throw httpError(403, "path outside root");
  const resolved = mustExist ? real : path.join(real, path.basename(target));
  // Symlinked files may point deeper into ROOT; locked mode still only allows ROOT's direct children.
  if (!ALLOW_CD && resolved !== ROOT && path.dirname(resolved) !== ROOT) throw httpError(403, "folder navigation disabled");
  return resolved;
}

/**
 * Send a JSON response.
 * @param {http.ServerResponse} res Response.
 * @param {number} status HTTP status.
 * @param {unknown} body JSON-serializable payload.
 */
function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

/**
 * Collect the request body with a size cap.
 * @param {http.IncomingMessage} req Request.
 * @returns {Promise<string>} Body as utf8.
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("body too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * Search under `folder` by file name or content. Recurses only when ALLOW_CD; never follows
 * symlinks (dirent types are lstat-based), so results stay inside ROOT.
 * @param {string} folder Absolute folder inside ROOT to start from.
 * @param {string} query Case-insensitive needle (non-empty).
 * @param {"name"|"content"} mode What to match.
 * @returns {{results: {path: string, line?: number, text?: string}[], truncated: boolean}} Hits, relative to ROOT.
 */
function searchFiles(folder, query, mode) {
  const needle = query.toLowerCase();
  const results = [];
  const pending = [folder];
  let visited = 0;
  while (pending.length) {
    const current = pending.shift();
    let dirents;
    try {
      dirents = fs.readdirSync(current, { withFileTypes: true });
    } catch (err) {
      continue; // unreadable folder: skip, keep searching the rest
    }
    for (const d of dirents.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, d.name);
      if (d.isDirectory()) {
        if (ALLOW_CD && !SEARCH_SKIP_FOLDERS.has(d.name)) pending.push(full);
        continue;
      }
      if (!d.isFile()) continue;
      if (++visited > MAX_SEARCH_FILES || results.length >= MAX_SEARCH_RESULTS) return { results, truncated: true };
      const rel = path.relative(ROOT, full);
      if (mode === "name") {
        if (d.name.toLowerCase().includes(needle)) results.push({ path: rel });
        continue;
      }
      let buf;
      try {
        if (fs.statSync(full).size > MAX_READ_BYTES) continue;
        buf = fs.readFileSync(full);
      } catch (err) {
        continue;
      }
      if (buf.includes(0)) continue; // binary
      const lines = buf.toString("utf8").split("\n");
      const idx = lines.findIndex((l) => l.toLowerCase().includes(needle));
      if (idx >= 0) results.push({ path: rel, line: idx + 1, text: lines[idx].trim().slice(0, 200) });
    }
  }
  return { results, truncated: false };
}

/**
 * Route one API request.
 * @param {http.IncomingMessage} req Request.
 * @param {http.ServerResponse} res Response.
 * @param {URL} url Parsed URL.
 */
async function handleApi(req, res, url) {
  const rel = url.searchParams.get("path") || "";
  const route = `${req.method} ${url.pathname}`;

  if (route === "GET /api/list") {
    const folder = resolveSafe(rel, true);
    if (!ALLOW_CD && folder !== ROOT) return sendJson(res, 403, { error: "folder navigation disabled" });
    const entries = fs
      .readdirSync(folder, { withFileTypes: true })
      .map((d) => ({ name: d.name, folder: d.isDirectory() }))
      .filter((e) => ALLOW_CD || !e.folder)
      .sort((a, b) => (a.folder === b.folder ? a.name.localeCompare(b.name) : a.folder ? -1 : 1));
    return sendJson(res, 200, { path: path.relative(ROOT, folder), entries });
  }
  if (route === "GET /api/stat") {
    const target = resolveSafe(rel, true);
    const isFolder = fs.statSync(target).isDirectory();
    if (!ALLOW_CD && isFolder && target !== ROOT) return sendJson(res, 403, { error: "folder navigation disabled" });
    return sendJson(res, 200, { path: path.relative(ROOT, target), folder: isFolder });
  }
  if (route === "POST /api/rename") {
    const name = String(url.searchParams.get("to") || "").trim();
    if (!name || name === "." || name === ".." || /[\\/\0]/.test(name)) return sendJson(res, 400, { error: "invalid new name" });
    if (!rel) return sendJson(res, 403, { error: "cannot rename root" });
    const source = resolveSafe(rel, false); // the entry itself, not its symlink target
    fs.lstatSync(source); // ENOENT -> 404
    if (!ALLOW_CD && fs.lstatSync(source).isDirectory()) return sendJson(res, 403, { error: "folder navigation disabled" });
    const dest = path.join(path.dirname(source), name);
    if (fs.existsSync(dest)) return sendJson(res, 409, { error: "name already exists" });
    fs.renameSync(source, dest);
    return sendJson(res, 200, { path: path.relative(ROOT, dest) });
  }
  if (route === "GET /api/search") {
    const query = String(url.searchParams.get("q") || "").trim();
    const mode = url.searchParams.get("mode") === "content" ? "content" : "name";
    if (!query) return sendJson(res, 400, { error: "query required" });
    const folder = resolveSafe(rel, true);
    if (!fs.statSync(folder).isDirectory()) return sendJson(res, 400, { error: "not a folder" });
    return sendJson(res, 200, searchFiles(folder, query, mode));
  }
  if (route === "GET /api/file") {
    const file = resolveSafe(rel, true);
    const stat = fs.statSync(file);
    if (!stat.isFile()) return sendJson(res, 400, { error: "not a file" });
    if (stat.size > MAX_READ_BYTES) return sendJson(res, 413, { error: "file too large to edit" });
    return sendJson(res, 200, { path: path.relative(ROOT, file), content: fs.readFileSync(file, "utf8") });
  }
  if (route === "PUT /api/file") {
    if (!rel) return sendJson(res, 400, { error: "path required" });
    const file = resolveSafe(rel, false);
    if (fs.existsSync(file) && !fs.statSync(file).isFile()) return sendJson(res, 400, { error: "not a file" });
    fs.writeFileSync(file, await readBody(req), "utf8");
    return sendJson(res, 200, { ok: true });
  }
  if (route === "POST /api/folder") {
    if (!ALLOW_CD) return sendJson(res, 403, { error: "folder navigation disabled" });
    if (!rel) return sendJson(res, 400, { error: "path required" });
    fs.mkdirSync(resolveSafe(rel, false));
    return sendJson(res, 200, { ok: true });
  }
  if (route === "DELETE /api/file") {
    const target = resolveSafe(rel, true);
    if (target === ROOT) return sendJson(res, 403, { error: "cannot delete root" });
    if (fs.lstatSync(target).isDirectory()) {
      if (!ALLOW_CD) return sendJson(res, 403, { error: "folder navigation disabled" });
      fs.rmdirSync(target);
    }
    else fs.unlinkSync(target);
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 404, { error: "unknown route" });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      // Function replacers: a `$&`-style sequence in a folder name must stay literal.
      return res.end(
        PAGE_HTML.replace("__ROOT_NAME__", () => path.basename(ROOT).replace(/[<>&"]/g, ""))
          .replace("__ALLOW_CD__", ALLOW_CD ? "true" : "false")
          .replace("__ROOT_PATH__", () => JSON.stringify(ROOT).replace(/</g, "\\u003c")),
      );
    }
    res.writeHead(404);
    res.end();
  } catch (err) {
    const status = err.status || (err.code === "ENOENT" ? 404 : err.code === "EEXIST" || err.code === "ENOTEMPTY" ? 409 : 500);
    if (status === 500) process.stderr.write(`text-server: ${req.method} ${url.pathname} failed: ${err.stack}\n`);
    sendJson(res, status, { error: status === 500 ? "internal error" : err.code || err.message });
  }
});

server.on("error", (err) => {
  process.stderr.write(`text-server: cannot listen on port ${PORT}: ${err.code || err.message}\n`);
  process.exit(1);
});
server.listen(PORT, "0.0.0.0", () => {
  process.stderr.write(`text-server: serving ${ROOT} on 0.0.0.0:${PORT} (${ALLOW_CD ? "subfolders allowed" : "locked to top folder"})\n`);
});


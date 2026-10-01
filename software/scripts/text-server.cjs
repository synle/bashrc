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
 *   GET    /api/info?path=<rel>   { path, folder, size? } — lets the UI deep-link ?path= to a file or folder; size (bytes) for files
 *                                  (not "/api/stat": tracker-blocking extensions match "/stat?" and block it)
 *   GET    /api/file?path=<rel>   read a file (utf8)
 *   GET    /api/raw?path=<rel>    raw bytes of an image / pdf / video for the built-in viewer (supports Range)
 *   GET    /api/raw?path=<rel>&download=1  any file as an attachment download
 *   PUT    /api/file?path=<rel>   create/overwrite a file (body = content)
 *   POST   /api/upload?path=<rel>[&onclash=stamp|suffix]  create a file from raw bytes, never
 *                                  overwrite. On a clash: stamp (default) -> <rel>.<MM-DD-YYYY_HH-MM>,
 *                                  then -1, -2, ...; suffix (<rel> already holds a stamp) -> -1, -2, ...
 *                                  after that stamp. Returns { path, duplicate? }
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

/**
 * Max request body, in bytes (300 MiB): the one knob for every write — editor saves, drag-and-drop
 * uploads, pasted pictures, snapshots. Also handed to the page (__MAX_BODY_BYTES__) so it can refuse
 * an oversized file before sending it.
 */
const MAX_BODY_BYTES = 300 * 1024 * 1024;
/** Past this many bytes an oversized body stops being drained and the socket is dropped (bounds a runaway client). */
const MAX_DRAIN_BYTES = 2 * MAX_BODY_BYTES;
/** Max file size served to the editor, in bytes (5 MiB). */
const MAX_READ_BYTES = 5 * 1024 * 1024;
/** Max files a single search visits before stopping (keeps one request bounded). */
const MAX_SEARCH_FILES = 5000;
/** Max hits a single search returns. */
const MAX_SEARCH_RESULTS = 200;
/** Folder names a search never descends into. */
const SEARCH_SKIP_FOLDERS = new Set([".git", "node_modules"]);
/** Max -N counters tried when several uploads clash within the same minute. */
const MAX_DUPLICATE_ATTEMPTS = 100;
/**
 * Extensions /api/raw serves (lowercase, no dot) -> Content-Type: images, PDF, common browser-playable video.
 * The page's MEDIA_KINDS mirrors these keys; keep both in sync.
 */
const MEDIA_CONTENT_TYPES = Object.freeze({
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  ogv: "video/ogg",
});
/** /api/upload `onclash` modes: STAMP appends .<stamp> first (dropped files); SUFFIX means the name already carries a stamp. */
const UPLOAD_ON_CLASH = Object.freeze({ STAMP: "stamp", SUFFIX: "suffix" });
/** A formatDateTime stamp inside a file name. */
const DATE_TIME_PATTERN = /\d{2}-\d{2}-\d{4}_\d{2}-\d{2}/g;

/**
 * Filename timestamp, local time, 24h: MM-DD-YYYY_HH-MM (e.g. 09-30-2026_14-44).
 * The page (text-server.html) carries a byte-equivalent copy; keep both in sync.
 * @param {Date} d Moment to format.
 * @returns {string} Formatted timestamp.
 */
function formatDateTime(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())}-${d.getFullYear()}_${p(d.getHours())}-${p(d.getMinutes())}`;
}

/**
 * Insert a -N clash counter right after the last timestamp in the file name, so an
 * extension after it survives (Clipboard.Pasted.<stamp>-1.png). No stamp -> append at the end.
 * @param {string} file Absolute path whose basename may carry a formatDateTime stamp.
 * @param {number} n Counter (1-based).
 * @returns {string} Path with the counter inserted.
 */
function withCounter(file, n) {
  const name = path.basename(file);
  const stamps = [...name.matchAll(DATE_TIME_PATTERN)];
  if (!stamps.length) return `${file}-${n}`;
  const last = stamps[stamps.length - 1];
  const cut = last.index + last[0].length;
  return path.join(path.dirname(file), `${name.slice(0, cut)}-${n}${name.slice(cut)}`);
}

const ROOT = fs.realpathSync(path.resolve(process.argv[2] || "."));
const PORT = Number(process.argv[3] || 9998);
/** When false, only files directly inside ROOT are reachable (no folder navigation). */
const ALLOW_CD = process.argv[4] === "1";

/** Keybindings module file name (sibling of this file), inlined into the page at startup. */
const KEYBINDINGS_FILE = "text-server.keybindings.cjs";
/** Exact tag in text-server.html replaced by the inlined keybindings module (build-text-server.js does the same). */
const KEYBINDINGS_TAG = `<script src="${KEYBINDINGS_FILE}"></script>`;

/** UI page template (placeholders __ROOT_NAME__, __ALLOW_CD__, __MAX_BODY_BYTES__, __APP_VERSION__, __ROOT_PATH__), read once from the sibling file. */
let PAGE_HTML;
try {
  PAGE_HTML = fs.readFileSync(path.join(__dirname, "text-server.html"), "utf8");
  // The keybindings module is a sibling file; inline it so the page never makes a second request.
  // The single-file bundle has it inlined already (tag gone), so the sibling read is skipped there.
  if (PAGE_HTML.includes(KEYBINDINGS_TAG)) {
    const keysJs = fs.readFileSync(path.join(__dirname, KEYBINDINGS_FILE), "utf8").replace(/<\/script/gi, "<\\/script");
    PAGE_HTML = PAGE_HTML.replace(KEYBINDINGS_TAG, () => `<script>\n${keysJs}\n</script>`);
  }
} catch (err) {
  process.stderr.write(`text-server: cannot read UI template next to ${__filename}: ${err.code || err.message}\n`);
  process.exit(1);
}

/** Build-time version override; build-text-server.js replaces this literal with a baked ISO time. null = derive from file mtimes. */
const BAKED_VERSION = null;

/**
 * App version: the newer mtime of this file and its UI template, as an ISO timestamp
 * (the text-server wrapper stamps each download with its last git commit time).
 * @returns {string} ISO-8601 timestamp, or "unknown" when neither file can be stat'd.
 */
function computeAppVersion() {
  if (BAKED_VERSION) return BAKED_VERSION;
  const mtimes = [__filename, path.join(__dirname, "text-server.html"), path.join(__dirname, KEYBINDINGS_FILE)].map((file) => {
    try {
      return fs.statSync(file).mtimeMs;
    } catch {
      return 0; // bundled build has no sibling html/keybindings; the other file still counts
    }
  });
  const newest = Math.max(...mtimes);
  return newest > 0 ? new Date(newest).toISOString() : "unknown";
}
/** Version shown in the startup log and the UI. */
const APP_VERSION = computeAppVersion();

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

/** Filesystem error codes surfaced to the UI as a status + readable message; anything else is a 500. */
const FS_ERROR_RESPONSES = {
  ENOENT: { status: 404, message: "not found" },
  ENOTDIR: { status: 404, message: "not found (a parent is not a folder)" },
  EACCES: { status: 403, message: "permission denied" },
  EPERM: { status: 403, message: "operation not permitted" },
  EROFS: { status: 403, message: "read-only file system" },
  EISDIR: { status: 400, message: "is a folder, not a file" },
  EEXIST: { status: 409, message: "already exists" },
  ENOTEMPTY: { status: 409, message: "folder is not empty" },
  EBUSY: { status: 409, message: "file is busy" },
};

/**
 * Map a thrown error to the HTTP status and client-safe message the UI shows.
 * @param {Error & {status?: number, code?: string}} err Error from a handler.
 * @returns {{status: number, message: string}} Response status and message (code appended for fs errors).
 */
function describeError(err) {
  if (err.status) return { status: err.status, message: err.message };
  const known = FS_ERROR_RESPONSES[err.code];
  if (known) return { status: known.status, message: `${known.message} (${err.code})` };
  return { status: 500, message: "internal error" };
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
  // Log every error response so failures are debuggable from the terminal running the server.
  if (status >= 400 && res.req) {
    process.stderr.write(`text-server: ${new Date().toISOString()} ${res.req.method} ${res.req.url} -> ${status} ${body && body.error}\n`);
  }
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

/**
 * Collect the request body with a size cap, as raw bytes (safe for binary uploads).
 * Oversized bodies reject with status 413. The rest of the body is drained, not reset, so the
 * 413 JSON actually reaches the browser (a reset reads as "server down" and Chrome retries the
 * POST); "Connection: close" keeps the socket from being reused. A declared Content-Length over
 * the cap is refused before reading anything.
 * @param {http.IncomingMessage} req Request.
 * @param {http.ServerResponse} res Response (gets "Connection: close" on a 413).
 * @returns {Promise<Buffer>} Body bytes.
 * @throws {Error & {status: 413}} When the body exceeds MAX_BODY_BYTES.
 */
function readBodyBytes(req, res) {
  return new Promise((resolve, reject) => {
    const tooLarge = () => {
      res.setHeader("Connection", "close");
      reject(Object.assign(new Error(`body too large (max ${MAX_BODY_BYTES / (1024 * 1024)} MiB)`), { status: 413 }));
    };
    if (Number(req.headers["content-length"]) > MAX_BODY_BYTES) {
      tooLarge();
      req.resume(); // discard the body so the response can be delivered
      return;
    }
    const chunks = [];
    let size = 0;
    let overflowed = false;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (overflowed) {
        if (size > MAX_DRAIN_BYTES) req.destroy();
        return;
      }
      if (size > MAX_BODY_BYTES) {
        overflowed = true;
        chunks.length = 0; // free what was buffered; keep draining
        tooLarge();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!overflowed) resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });
}

/**
 * Collect the request body with a size cap, decoded as utf8 (editor saves).
 * @param {http.IncomingMessage} req Request.
 * @param {http.ServerResponse} res Response (gets "Connection: close" on a 413).
 * @returns {Promise<string>} Body as utf8.
 */
async function readBody(req, res) {
  return (await readBodyBytes(req, res)).toString("utf8");
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
  if (route === "GET /api/info") {
    const target = resolveSafe(rel, true);
    const stat = fs.statSync(target);
    const isFolder = stat.isDirectory();
    if (!ALLOW_CD && isFolder && target !== ROOT) return sendJson(res, 403, { error: "folder navigation disabled" });
    // size (bytes) for files only: the media viewer footer shows it.
    const body = { path: path.relative(ROOT, target), folder: isFolder };
    if (!isFolder) body.size = stat.size;
    return sendJson(res, 200, body);
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
  if (route === "GET /api/raw") {
    const file = resolveSafe(rel, true);
    const stat = fs.statSync(file);
    if (!stat.isFile()) return sendJson(res, 400, { error: "not a file" });
    const download = url.searchParams.get("download") === "1";
    // Download serves any file (unknown types as octet-stream); inline viewing only known media.
    const type = MEDIA_CONTENT_TYPES[path.extname(file).slice(1).toLowerCase()] || (download ? "application/octet-stream" : null);
    if (!type) return sendJson(res, 415, { error: "not a viewable media type" });
    const headers = {
      "Content-Type": type,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": "bytes",
    };
    // RFC 6266/5987: ASCII fallback name plus the exact UTF-8 name.
    if (download) {
      const name = path.basename(file);
      headers["Content-Disposition"] =
        `attachment; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`;
    }
    // SVG is the one type here that can carry script: lock it down if opened directly at this URL.
    // (Not applied to PDF: a CSP sandbox blocks the browser's built-in PDF viewer.)
    if (type === "image/svg+xml") headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
    // Single "bytes=start-end" range: <video> needs it to seek, and Safari will not play mp4 without it.
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (range && stat.size > 0 && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2])); // "-N" = last N bytes
      let end = range[1] && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
      if (start > end || start >= stat.size) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        return res.end();
      }
      res.writeHead(206, { ...headers, "Content-Length": end - start + 1, "Content-Range": `bytes ${start}-${end}/${stat.size}` });
      fs.createReadStream(file, { start, end })
        .on("error", () => res.destroy())
        .pipe(res);
      return;
    }
    res.writeHead(200, { ...headers, "Content-Length": stat.size });
    fs.createReadStream(file)
      .on("error", () => res.destroy())
      .pipe(res);
    return;
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
    fs.writeFileSync(file, await readBody(req, res), "utf8");
    return sendJson(res, 200, { ok: true });
  }
  if (route === "POST /api/upload") {
    if (!rel) return sendJson(res, 400, { error: "path required" });
    const onClash = url.searchParams.get("onclash") || UPLOAD_ON_CLASH.STAMP;
    if (!Object.values(UPLOAD_ON_CLASH).includes(onClash)) return sendJson(res, 400, { error: "invalid onclash" });
    const file = resolveSafe(rel, false);
    const content = await readBodyBytes(req, res); // raw bytes: images/binaries survive unchanged
    // Never overwrite; "wx" makes each create atomic. Candidates, in order:
    //   stamp:  <name>, <name>.<stamp>, <name>.<stamp>-1, -2, ...
    //   suffix: <name>, then -1, -2, ... inserted right after the stamp already in <name>
    const base = onClash === UPLOAD_ON_CLASH.STAMP ? `${file}.${formatDateTime(new Date())}` : file;
    const candidates = onClash === UPLOAD_ON_CLASH.STAMP ? [file, base] : [file];
    for (let n = 1; n <= MAX_DUPLICATE_ATTEMPTS; n++) candidates.push(withCounter(base, n));
    for (const [index, candidate] of candidates.entries()) {
      try {
        fs.writeFileSync(candidate, content, { flag: "wx" });
        return sendJson(
          res,
          200,
          index === 0 ? { path: path.relative(ROOT, candidate) } : { path: path.relative(ROOT, candidate), duplicate: true },
        );
      } catch (err) {
        if (err.code !== "EEXIST") throw err;
      }
    }
    return sendJson(res, 409, { error: "too many files with this name" });
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
    } else fs.unlinkSync(target);
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 404, { error: "unknown route" });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    // HEAD / is the page's "is the server alive?" probe: same headers, no body.
    if (req.method === "HEAD" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      return res.end();
    }
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      // Function replacers: a `$&`-style sequence in a folder name must stay literal.
      return res.end(
        PAGE_HTML.replace("__ROOT_NAME__", () => path.basename(ROOT).replace(/[<>&"]/g, ""))
          .replace("__ALLOW_CD__", ALLOW_CD ? "true" : "false")
          .replace("__MAX_BODY_BYTES__", String(MAX_BODY_BYTES))
          .replace("__APP_VERSION__", () => JSON.stringify(APP_VERSION))
          .replace("__ROOT_PATH__", () => JSON.stringify(ROOT).replace(/</g, "\\u003c")),
      );
    }
    res.writeHead(404);
    res.end();
    // Browser probes (Chrome DevTools asks every localhost origin for /.well-known/...) are noise, not errors.
    if (url.pathname.startsWith("/.well-known/")) return;
    process.stderr.write(`text-server: ${req.method} ${req.url} -> 404\n`);
  } catch (err) {
    const { status, message } = describeError(err);
    // 500s get the full stack server-side; sendJson logs the status line for every error.
    if (status === 500) process.stderr.write(`text-server: ${req.method} ${req.url} failed: ${err.stack}\n`);
    sendJson(res, status, { error: message });
  }
});

/** Port 0 asks the OS for any free port; used when the requested one is taken. */
const ANY_FREE_PORT = 0;
let fellBack = false;

server.on("error", (err) => {
  // Requested port busy: retry once on an OS-picked free port instead of dying.
  if (err.code === "EADDRINUSE" && !fellBack) {
    fellBack = true;
    process.stderr.write(`text-server: port ${PORT} in use, picking a free port\n`);
    server.listen(ANY_FREE_PORT, "0.0.0.0");
    return;
  }
  process.stderr.write(`text-server: cannot listen on port ${PORT}: ${err.code || err.message}\n`);
  process.exit(1);
});
server.on("listening", () => {
  const port = server.address().port;
  process.stderr.write(
    `text-server: version ${APP_VERSION}, serving ${ROOT} on 0.0.0.0:${port} (${ALLOW_CD ? "subfolders allowed" : "locked to top folder"})\n`,
  );
  process.stderr.write(`text-server: open http://localhost:${port}/\n`);
});
server.listen(PORT, "0.0.0.0");

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
 * Serves a single-page UI (CodeMirror 5 from cdnjs) plus a small JSON API:
 *   GET    /api/list?path=<rel>   list a folder
 *   GET    /api/file?path=<rel>   read a file (utf8)
 *   PUT    /api/file?path=<rel>   create/overwrite a file (body = content)
 *   POST   /api/folder?path=<rel> create a folder
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

const ROOT = fs.realpathSync(path.resolve(process.argv[2] || "."));
const PORT = Number(process.argv[3] || 9998);
/** When false, only files directly inside ROOT are reachable (no folder navigation). */
const ALLOW_CD = process.argv[4] === "1";

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
      return res.end(
        PAGE_HTML.replace("__ROOT_NAME__", path.basename(ROOT).replace(/[<>&"]/g, "")).replace("__ALLOW_CD__", ALLOW_CD ? "true" : "false"),
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

// --- UI ---
const PAGE_HTML = String.raw`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>text-server - __ROOT_NAME__</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/theme/material-darker.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js"></script>
<link rel="icon" href="data:,">
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/mode/loadmode.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/mode/overlay.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/meta.min.js"></script>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; display: flex; height: 100vh; font: 13px system-ui, sans-serif; background: #1e1e1e; color: #ddd; }
  #side { width: 260px; border-right: 1px solid #333; display: flex; flex-direction: column; }
  #side header { padding: 8px; border-bottom: 1px solid #333; display: flex; gap: 4px; flex-wrap: wrap; }
  #crumb { padding: 6px 8px; color: #8ab4f8; word-break: break-all; }
  #list { flex: 1; overflow: auto; list-style: none; margin: 0; padding: 0; }
  #list li { padding: 4px 8px; cursor: pointer; display: flex; justify-content: space-between; }
  #list li:hover { background: #2a2a2a; }
  #list li.active { background: #094771; }
  #list li .del { visibility: hidden; color: #f88; }
  #list li:hover .del { visibility: visible; }
  #main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  #bar { padding: 6px 8px; border-bottom: 1px solid #333; display: flex; gap: 8px; align-items: center; }
  #name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #status { color: #999; }
  button { background: #333; color: #ddd; border: 1px solid #555; padding: 3px 8px; cursor: pointer; border-radius: 3px; }
  button:hover { background: #444; }
  .CodeMirror { flex: 1; height: auto; font-size: 14px; }
  #editorWrap { flex: 1; display: flex; flex-direction: column; min-height: 0; }
</style></head>
<body>
<aside id="side">
  <header><button id="up">..</button><button id="newFile">+ file</button><button id="newFolder">+ folder</button><button id="refresh">&#x21bb;</button></header>
  <div id="crumb"></div>
  <ul id="list"></ul>
</aside>
<main id="main">
  <div id="bar"><span id="name">No file open</span><span id="status"></span><button id="save">Save (Ctrl+S)</button></div>
  <div id="editorWrap"></div>
</main>
<script>
CodeMirror.modeURL = "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/%N/%N.min.js";
const ALLOW_CD = __ALLOW_CD__;
const $ = (id) => document.getElementById(id);
if (!ALLOW_CD) { $("up").style.display = "none"; $("newFolder").style.display = "none"; }
const editor = CodeMirror($("editorWrap"), { theme: "material-darker", lineNumbers: true, lineWrapping: true, readOnly: true });
let cwd = "", openPath = null, clean = true;

const join = (a, b) => (a ? a + "/" + b : b);
const setStatus = (t) => { $("status").textContent = t; };

async function api(method, route, rel, body) {
  const res = await fetch(route + "?path=" + encodeURIComponent(rel), { method, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function loadList(rel) {
  try {
    const data = await api("GET", "/api/list", rel);
    cwd = data.path;
    $("crumb").textContent = "/" + cwd;
    $("up").disabled = cwd === "";
    const ul = $("list");
    ul.innerHTML = "";
    for (const e of data.entries) {
      const li = document.createElement("li");
      const full = join(cwd, e.name);
      if (full === openPath) li.className = "active";
      const label = document.createElement("span");
      label.textContent = (e.folder ? "\u{1F4C1} " : "\u{1F4C4} ") + e.name;
      const del = document.createElement("span");
      del.className = "del"; del.textContent = "\u2715"; del.title = "delete";
      del.onclick = (ev) => { ev.stopPropagation(); removeEntry(full, e.folder); };
      li.append(label, del);
      li.onclick = () => (e.folder ? loadList(full) : openFile(full));
      ul.append(li);
    }
  } catch (err) { alert("List failed: " + err.message); }
}

function confirmDiscard() { return clean || confirm("Discard unsaved changes?"); }

async function openFile(rel) {
  if (!confirmDiscard()) return;
  try {
    const data = await api("GET", "/api/file", rel);
    openPath = data.path;
    editor.setOption("readOnly", false);
    editor.setValue(data.content);
    editor.clearHistory();
    const info = CodeMirror.findModeByFileName(openPath) || { mode: "null" };
    editor.setOption("mode", info.mime || info.mode);
    if (info.mode !== "null") CodeMirror.autoLoadMode(editor, info.mode);
    clean = true;
    $("name").textContent = openPath;
    setStatus("");
    loadList(cwd);
  } catch (err) { alert("Open failed: " + err.message); }
}

async function save() {
  if (!openPath) return;
  try {
    await api("PUT", "/api/file", openPath, editor.getValue());
    clean = true;
    setStatus("saved " + new Date().toLocaleTimeString());
  } catch (err) { alert("Save failed: " + err.message); }
}

async function removeEntry(rel, isFolder) {
  if (!confirm("Delete " + (isFolder ? "folder (must be empty) " : "") + rel + "?")) return;
  try {
    await api("DELETE", "/api/file", rel);
    if (rel === openPath) { openPath = null; clean = true; editor.setValue(""); editor.setOption("readOnly", true); $("name").textContent = "No file open"; }
    loadList(cwd);
  } catch (err) { alert("Delete failed: " + err.message); }
}

$("newFile").onclick = async () => {
  const name = prompt("New file name (relative to /" + cwd + ")");
  if (!name) return;
  try { await api("PUT", "/api/file", join(cwd, name), ""); await loadList(cwd); openFile(join(cwd, name)); }
  catch (err) { alert("Create failed: " + err.message); }
};
$("newFolder").onclick = async () => {
  const name = prompt("New folder name");
  if (!name) return;
  try { await api("POST", "/api/folder", join(cwd, name)); loadList(cwd); }
  catch (err) { alert("Create failed: " + err.message); }
};
$("up").onclick = () => cwd && loadList(cwd.split("/").slice(0, -1).join("/"));
$("refresh").onclick = () => loadList(cwd);
$("save").onclick = save;
editor.on("change", () => { if (openPath && clean) { clean = false; setStatus("modified"); } });
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); }
});
window.addEventListener("beforeunload", (e) => { if (!clean) { e.preventDefault(); e.returnValue = ""; } });
loadList("");
</script>
</body></html>`;

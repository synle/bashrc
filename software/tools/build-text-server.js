/**
 * build-text-server.js - Bundles text-server into ONE self-contained, offline executable.
 *
 * Output: .build/_text-server/text-server   (gitignored via /.build/_*)
 *
 * Inputs: software/scripts/text-server.cjs (Node server) + software/scripts/text-server.html (UI).
 * Every CDN resource the page uses is downloaded at build time and inlined:
 *   - <link rel="stylesheet" href="https://..."> -> <style>...</style>
 *   - <script src="https://..."></script>        -> <script>...</script>
 *   - every CodeMirror mode listed in the page's SYNTAXES table (normally lazy-loaded from
 *     cdnjs via CodeMirror.modeURL) is inlined up front, so requireMode() finds each mode
 *     already registered and never touches the network.
 * The finished HTML is then embedded in the server source in place of its
 * readFileSync("text-server.html") call. The result runs with no sibling files and no CDN:
 *
 *   ./text-server <folder> [<port>] [<allow_cd 0|1>]
 *   node text-server <folder> [<port>] [<allow_cd 0|1>]
 *
 * The build fails loudly (non-zero exit) if a download fails, an anchor it rewrites is
 * missing, or any https:// resource reference survives in the output.
 *
 * Usage:
 *   make build_text_server
 *   node software/tools/build-text-server.js
 *
 * CI publishes the output to the binary-cache rolling release on synle/bashrc as
 * `text-server__text-server` (same `<app>__<file>` namespace as the other cache assets).
 * The `text-server` shell launcher does not use this bundle yet.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const { spawnSync } = require("child_process");

/** Repo root resolved relative to this file's location. */
const REPO_ROOT = path.resolve(__dirname, "..", "..");
/** Server source. */
const SERVER_SOURCE = path.join(REPO_ROOT, "software", "scripts", "text-server.cjs");
/** UI page source. */
const PAGE_SOURCE = path.join(REPO_ROOT, "software", "scripts", "text-server.html");
/** Output folder; `/.build/_*` is gitignored so the bundle never lands in a commit or the CI prep patch. */
const OUTPUT_DIR = path.join(REPO_ROOT, ".build", "_text-server");
/** Final single-file executable. */
const OUTPUT_PATH = path.join(OUTPUT_DIR, "text-server");
/** Exact expression in the server that loads the page; replaced by the inlined page literal. */
const PAGE_READ_EXPRESSION = 'fs.readFileSync(path.join(__dirname, "text-server.html"), "utf8")';
/** Literal in the server replaced by the baked version string. */
const BAKED_VERSION_EXPRESSION = "const BAKED_VERSION = null;";

/**
 * Newest last-commit time across the given files (git's notion of "modified"), falling back to fs mtime
 * for a file git has no history for (uncommitted edit, shallow clone miss).
 * @param {string[]} files Absolute source paths.
 * @returns {string} ISO-8601 timestamp of the newest file.
 */
function newestSourceTime(files) {
  const times = files.map((file) => {
    const git = spawnSync("git", ["log", "-1", "--format=%cI", "--", file], { cwd: REPO_ROOT, encoding: "utf8" });
    const committed = git.status === 0 && git.stdout.trim() ? Date.parse(git.stdout.trim()) : NaN;
    return Number.isNaN(committed) ? fs.statSync(file).mtimeMs : committed;
  });
  return new Date(Math.max(...times)).toISOString();
}

/** Max redirects followed per download. */
const MAX_REDIRECTS = 5;
/** Per-download timeout, in ms. */
const DOWNLOAD_TIMEOUT_MS = 30000;

/**
 * Download a URL as utf8 text, following redirects.
 * @param {string} url https URL.
 * @param {number} [redirects=0] Redirects already followed.
 * @returns {Promise<string>} Response body.
 * @throws {Error} On non-200 status, too many redirects, timeout, or network error.
 */
function download(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects >= MAX_REDIRECTS) return reject(new Error(`too many redirects: ${url}`));
        return resolve(download(new URL(res.headers.location, url).toString(), redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    });
    req.setTimeout(DOWNLOAD_TIMEOUT_MS, () => req.destroy(new Error(`timeout after ${DOWNLOAD_TIMEOUT_MS} ms: ${url}`)));
    req.on("error", reject);
  });
}

/**
 * Make JS safe to embed in an inline <script>: a literal "</script" would end the tag early.
 * @param {string} js JavaScript source.
 * @returns {string} Escaped source (behavior unchanged: "<\/" is "</" inside JS strings/regex).
 */
function escapeInlineScript(js) {
  return js.replace(/<\/script/gi, "<\\/script");
}

/**
 * Collect every CodeMirror mode name referenced by the page's SYNTAXES table, in first-seen
 * order (the table lists dependencies before dependents, e.g. xml before markdown).
 * @param {string} html Page source.
 * @returns {string[]} Unique mode names.
 * @throws {Error} When no `modes: [...]` entries are found (table renamed/restructured).
 */
function collectModes(html) {
  const modes = [];
  for (const match of html.matchAll(/modes:\s*\[([^\]]*)\]/g)) {
    for (const name of match[1].matchAll(/"([a-z0-9-]+)"/g)) if (!modes.includes(name[1])) modes.push(name[1]);
  }
  if (!modes.length) throw new Error("no `modes: [...]` entries found in text-server.html SYNTAXES");
  return modes;
}

/**
 * Inline every CDN stylesheet, script, and CodeMirror mode into the page.
 * @param {string} html Page source.
 * @returns {Promise<string>} Self-contained page.
 * @throws {Error} On download failure or when a surviving https:// resource reference remains.
 */
async function inlinePage(html) {
  const modeUrlMatch = html.match(/CodeMirror\.modeURL = "([^"]+)";/);
  if (!modeUrlMatch) throw new Error("CodeMirror.modeURL assignment not found in text-server.html");
  const modeUrlTemplate = modeUrlMatch[1];

  const styles = [...html.matchAll(/<link rel="stylesheet" href="(https:\/\/[^"]+)"\s*\/?>/g)]; // tolerate oxfmt's self-closing `/>`
  const scripts = [...html.matchAll(/<script src="(https:\/\/[^"]+)"><\/script>/g)];
  const modes = collectModes(html);
  const bodies = new Map();
  const urls = [...styles, ...scripts].map((m) => m[1]).concat(modes.map((m) => modeUrlTemplate.replace(/%N/g, m)));
  await Promise.all(
    urls.map(async (url) => {
      bodies.set(url, await download(url));
      process.stderr.write(`  inlined ${url} (${bodies.get(url).length} bytes)\n`);
    }),
  );

  // Function replacers: minified sources contain `$&`-style sequences that must stay literal.
  let out = html;
  for (const [tag, url] of styles) out = out.replace(tag, () => `<style>\n${bodies.get(url)}\n</style>`);
  for (const [tag, url] of scripts) out = out.replace(tag, () => `<script>\n${escapeInlineScript(bodies.get(url))}\n</script>`);

  // Modes go right after the last inlined library script (core + addons), before the page script.
  const modeScripts = modes
    .map((m) => `<script>/* mode: ${m} */\n${escapeInlineScript(bodies.get(modeUrlTemplate.replace(/%N/g, m)))}\n</script>`)
    .join("\n");
  const lastScript = scripts[scripts.length - 1];
  const lastInlined = `<script>\n${escapeInlineScript(bodies.get(lastScript[1]))}\n</script>`;
  const anchor = out.indexOf(lastInlined);
  if (anchor < 0) throw new Error("could not locate the last inlined library script to insert modes after");
  out = out.slice(0, anchor + lastInlined.length) + "\n" + modeScripts + out.slice(anchor + lastInlined.length);

  // Every mode is pre-registered; an empty modeURL guarantees requireMode never fetches.
  out = out.replace(modeUrlMatch[0], () => 'CodeMirror.modeURL = "";');

  const leftover = out.match(/(?:src|href)="https?:\/\/[^"]+"|modeURL = "https?:/);
  if (leftover) throw new Error(`external resource reference survived inlining: ${leftover[0]}`);
  return out;
}

/**
 * Build the bundle and write it to OUTPUT_PATH (mode 755).
 * @returns {Promise<void>}
 * @throws {Error} When the server's page-read expression is not found exactly once, the version literal is missing, or the output fails `node --check`.
 */
async function main() {
  const server = fs.readFileSync(SERVER_SOURCE, "utf8");
  const page = await inlinePage(fs.readFileSync(PAGE_SOURCE, "utf8"));

  const occurrences = server.split(PAGE_READ_EXPRESSION).length - 1;
  if (occurrences !== 1) throw new Error(`expected 1 occurrence of ${PAGE_READ_EXPRESSION} in text-server.cjs, found ${occurrences}`);
  if (!server.includes(BAKED_VERSION_EXPRESSION)) throw new Error(`${BAKED_VERSION_EXPRESSION} not found in text-server.cjs`);
  const version = newestSourceTime([SERVER_SOURCE, PAGE_SOURCE]);
  const bundled = server
    .replace(PAGE_READ_EXPRESSION, () => JSON.stringify(page))
    .replace(BAKED_VERSION_EXPRESSION, () => `const BAKED_VERSION = ${JSON.stringify(version)};`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, bundled, { mode: 0o755 });
  fs.chmodSync(OUTPUT_PATH, 0o755); // writeFileSync's mode only applies on create

  const check = spawnSync(process.execPath, ["--check", OUTPUT_PATH], { encoding: "utf8" });
  if (check.status !== 0) throw new Error(`bundle failed node --check:\n${check.stderr}`);
  process.stderr.write(`Built ${path.relative(REPO_ROOT, OUTPUT_PATH)} (${bundled.length} bytes, version ${version})\n`);
}

main().catch((err) => {
  process.stderr.write(`build-text-server: ${err.stack || err.message}\n`);
  process.exit(1);
});

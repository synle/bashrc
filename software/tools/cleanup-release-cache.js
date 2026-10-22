/** Delete explicitly selected binary-cache asset groups; preserve the release, tag, and unknown assets. */
const { execFileSync } = require("child_process");

/** Explicit cleanup policy, not automatic eligibility for every future cache producer. */
const TOOL_NAMESPACES = [
  "bashrc-installer",
  "display-dj",
  "proxie",
  "skiff-files",
  "skippy-ff",
  "sqlui-native",
  "text-server",
  "url-porter",
];
/** Workflow checkbox environment names, all disabled when absent. */
const INPUTS = {
  profiles: "CLEAN_PRECOMPILED_PROFILES",
  tools: "CLEAN_TOOL_BINARIES_AND_INSTALLERS",
  decky: "CLEAN_DECKY_BUNDLES",
};
/** Bound release enumeration before any mutation; larger releases need an explicit policy review. */
const MAX_ASSET_PAGES = 10;

/** Request one GitHub API endpoint (string) using method (GET|DELETE); return parsed JSON or undefined; throw on transport/JSON failure. */
function ghRequest(method, endpoint) {
  const output = execFileSync("gh", ["api", endpoint, "--method", method], {
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 4 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return method === "DELETE" ? undefined : JSON.parse(output);
}

/** Classify asset name (string) into a cleanup group or null; unknown names never become deletion targets. */
function groupFor(name) {
  if (/^bashrc-profile__profile_bashrc_[a-z0-9_]+\.sh$/.test(name)) return "profiles";
  if (/^steamos-decky__bundle(?:\.(?:candidate|previous)-[0-9]+-[0-9]+)?\.zip$/.test(name)) return "decky";
  if (TOOL_NAMESPACES.some((prefix) => name.startsWith(`${prefix}__`) && name.length > prefix.length + 2)) return "tools";
  return null;
}

/** Require a GitHub asset object with a positive numeric ID and stable name/size/timestamp; throw before mutation on malformed data. */
function validateAsset(asset) {
  if (
    !asset ||
    typeof asset !== "object" ||
    Array.isArray(asset) ||
    !Number.isSafeInteger(asset.id) ||
    asset.id <= 0 ||
    typeof asset.name !== "string" ||
    !asset.name ||
    !Number.isSafeInteger(asset.size) ||
    asset.size < 0 ||
    typeof asset.updated_at !== "string" ||
    !asset.updated_at
  )
    throw new Error("invalid asset: expected positive id, nonempty name/updated_at, and nonnegative size");
}

/**
 * Clean selected cache groups from env (object); return deleted/kept asset names (object).
 * Options supply an owned request(method, endpoint) transport and JSON-line reporter for tests.
 * Enumerate and report a complete plan before deletion; recheck release and asset identity before each DELETE.
 * Throws on malformed inputs, changed targets, or API failure; prior deletions cannot be rolled back.
 */
function cleanup(env = process.env, { request = ghRequest, report = (line) => process.stdout.write(line + "\n") } = {}) {
  const selected = new Set();
  for (const [group, key] of Object.entries(INPUTS)) {
    const value = env[key];
    if (value === "true") selected.add(group);
    else if (value !== undefined && value !== "false") throw new Error(`${key}: expected true or false; retry only after correcting input`);
  }
  if (!selected.size) {
    report(JSON.stringify({ event: "noop", reason: "No cleanup checkboxes selected" }));
    return { deleted: [], kept: [] };
  }
  const repo = env.CACHE_REPO;
  if (typeof repo !== "string" || !/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(repo))
    throw new Error("CACHE_REPO: expected owner/repo");
  const api = `repos/${repo}/releases`;
  const release = request("GET", `${api}/tags/binary-cache`);
  if (!release || !Number.isSafeInteger(release.id) || release.id <= 0 || release.tag_name !== "binary-cache")
    throw new Error("invalid release: expected binary-cache tag and positive id");
  const assets = [];
  const ids = new Set();
  const names = new Set();
  for (let page = 1; ; page++) {
    if (page > MAX_ASSET_PAGES) throw new Error("asset enumeration exceeded 10 pages; no assets deleted");
    const batch = request("GET", `${api}/${release.id}/assets?per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length > 100) throw new Error("invalid asset page: expected array with at most 100 assets");
    for (const asset of batch) {
      validateAsset(asset);
      if (ids.has(asset.id) || names.has(asset.name)) throw new Error("duplicate asset id/name in cleanup plan; no assets deleted");
      ids.add(asset.id);
      names.add(asset.name);
      assets.push(asset);
    }
    if (batch.length < 100) break;
  }
  const targets = assets.filter((asset) => selected.has(groupFor(asset.name)));
  const kept = assets.filter((asset) => !selected.has(groupFor(asset.name))).map((asset) => asset.name);
  report(
    JSON.stringify({
      event: "plan",
      release: "binary-cache",
      assets: targets.map((asset) => ({ id: asset.id, name: asset.name, size: asset.size })),
      kept,
    }),
  );
  const deleted = [];
  for (const asset of targets) {
    const currentRelease = request("GET", `${api}/tags/binary-cache`);
    if (currentRelease?.id !== release.id || currentRelease.tag_name !== "binary-cache")
      throw new Error("release changed since cleanup plan; stopping");
    const current = request("GET", `${api}/assets/${asset.id}`);
    validateAsset(current);
    if (["id", "name", "size", "updated_at"].some((key) => current[key] !== asset[key]))
      throw new Error("asset changed since cleanup plan; stopping");
    request("DELETE", `${api}/assets/${asset.id}`);
    deleted.push(asset.name);
    report(JSON.stringify({ event: "deleted", id: asset.id, name: asset.name }));
  }
  report(JSON.stringify({ event: "complete", deleted: deleted.length, kept: kept.length }));
  return { deleted, kept };
}

module.exports = { cleanup };
if (require.main === module) {
  try {
    cleanup();
  } catch (error) {
    process.stderr.write(`Release cache cleanup failed; inspect deleted events before retrying: ${error.message}\n`);
    process.exitCode = 1;
  }
}

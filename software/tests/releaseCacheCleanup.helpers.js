/** Owned release-cache API transport and deterministic asset fixtures. */
import cacheCleanup from "../tools/cleanup-release-cache.js";

/** Shared cleanup entry used by the workflow CLI. */
const { cleanup } = cacheCleanup;
/** Independent asset record matching the GitHub release API's observed shape. */
export function asset(id, name, overrides = {}) {
  return { id, name, size: 42, updated_at: "2026-10-21T00:00:00Z", ...overrides };
}
/** Mixed release containing all selectable groups plus explicitly unclassified assets. */
export const original = [
  asset(101, "bashrc-profile__profile_bashrc_mac.sh"),
  asset(102, "url-porter__url-porter.zip"),
  asset(103, "url-porter__version.json"),
  asset(104, "bashrc-installer__install-bashrc.sh"),
  asset(105, "text-server__text-server"),
  asset(106, "steamos-decky__bundle.zip"),
  asset(107, "steamos-decky__bundle.previous-123-1.zip"),
  asset(108, "steamos-decky__bundle.candidate-123-1.zip"),
  asset(109, "unknown__archive.zip"),
  asset(110, "steamos-decky__other.zip"),
];
/** Build an isolated owned transport; return mutable fixture state, recorded requests/logs, and cleanup invocation. */
export function fixture({
  assets = original,
  release = { id: 77, tag_name: "binary-cache" },
  page,
  pages,
  changed,
  failDeleteId,
  failRead = false,
} = {}) {
  const state = { assets: structuredClone(assets), listed: false };
  const requests = [];
  const logs = [];
  const request = (method, endpoint) => {
    requests.push([method, endpoint]);
    if (failRead) throw new Error("fixture API unavailable");
    if (endpoint.endsWith("/tags/binary-cache")) return state.listed && changed === "release" ? { ...release, id: 88 } : release;
    if (endpoint.includes("?per_page=100&page=")) {
      state.listed = true;
      if (pages) return pages[Number(endpoint.split("&page=")[1]) - 1];
      return page === undefined ? structuredClone(state.assets) : page;
    }
    const id = Number(endpoint.split("/").pop());
    if (method === "DELETE") {
      if (id === failDeleteId) throw new Error("fixture deletion denied");
      state.assets = state.assets.filter((record) => record.id !== id);
      return undefined;
    }
    const record = state.assets.find((record) => record.id === id);
    return changed ? { ...record, ...changed } : record;
  };
  return {
    state,
    requests,
    logs,
    run: (env = {}) => cleanup({ CACHE_REPO: "acme/example", ...env }, { request, report: (line) => logs.push(JSON.parse(line)) }),
  };
}

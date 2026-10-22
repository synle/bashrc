/** Exercise cache cleanup through its owned API transport and the actual manual workflow command; no live release mutations. */
import { afterEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import cacheCleanup from "../tools/cleanup-release-cache.js";

/** Shared cleanup entry used by the workflow CLI. */
const { cleanup } = cacheCleanup;
/** Fixture-owned temporary folders for subprocess transport checks. */
const folders = [];
/** Independent asset record matching the GitHub release API's observed shape. */
function asset(id, name, overrides = {}) {
  return { id, name, size: 42, updated_at: "2026-10-21T00:00:00Z", ...overrides };
}
/** Mixed release containing all selectable groups plus explicitly unclassified assets. */
const original = [
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
function fixture({
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

afterEach(() => {
  for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

describe("manual binary-cache cleanup (owned transport simulation)", () => {
  it.each([{}, { CLEAN_PRECOMPILED_PROFILES: "false", CLEAN_TOOL_BINARIES_AND_INSTALLERS: "false", CLEAN_DECKY_BUNDLES: "false" }])(
    "does nothing with disabled or absent checkboxes: %j",
    (env) => {
      const test = fixture();
      expect(test.run(env)).toEqual({ deleted: [], kept: [] });
      expect(test.requests).toEqual([]);
      expect(test.state.assets).toEqual(original);
      expect(test.logs).toEqual([{ event: "noop", reason: "No cleanup checkboxes selected" }]);
    },
  );
  it("deletes only profiles while retaining tools, Decky, and unknown assets", () => {
    const test = fixture();
    expect(test.run({ CLEAN_PRECOMPILED_PROFILES: "true" }).deleted).toEqual(["bashrc-profile__profile_bashrc_mac.sh"]);
    expect(test.state.assets).toEqual(original.slice(1));
    expect(test.requests).toContainEqual(["DELETE", "repos/acme/example/releases/assets/101"]);
    expect(test.logs[0]).toMatchObject({ event: "plan", assets: [{ id: 101, name: "bashrc-profile__profile_bashrc_mac.sh", size: 42 }] });
    expect(test.logs.at(-1)).toEqual({ event: "complete", deleted: 1, kept: 9 });
  });
  it("deletes tool ZIPs, related metadata, bootstrap installer, and unzipped tool binaries without touching Decky", () => {
    const test = fixture();
    expect(test.run({ CLEAN_TOOL_BINARIES_AND_INSTALLERS: "true" }).deleted).toEqual([
      "url-porter__url-porter.zip",
      "url-porter__version.json",
      "bashrc-installer__install-bashrc.sh",
      "text-server__text-server",
    ]);
    expect(test.state.assets).toEqual([original[0], ...original.slice(5)]);
  });
  it("deletes canonical, candidate, and backup Decky bundles only when explicitly selected", () => {
    const test = fixture();
    expect(test.run({ CLEAN_DECKY_BUNDLES: "true" }).deleted).toEqual([
      "steamos-decky__bundle.zip",
      "steamos-decky__bundle.previous-123-1.zip",
      "steamos-decky__bundle.candidate-123-1.zip",
    ]);
    expect(test.state.assets).toEqual([...original.slice(0, 5), ...original.slice(8)]);
  });
  it("combines groups while preserving unknown names and unrelated Decky assets", () => {
    const test = fixture();
    expect(
      test.run({ CLEAN_PRECOMPILED_PROFILES: "true", CLEAN_TOOL_BINARIES_AND_INSTALLERS: "true", CLEAN_DECKY_BUNDLES: "true" }).kept,
    ).toEqual(["unknown__archive.zip", "steamos-decky__other.zip"]);
    expect(test.state.assets).toEqual(original.slice(8));
  });
  it.each([
    "display-dj__version.json",
    "proxie__Proxie_amd64.deb",
    "skiff-files__Skiff.Files_x64.dmg",
    "skippy-ff__skippy-ff.zip",
    "sqlui-native__sqlui-portal.tar.gz",
  ])("includes explicitly supported tool namespace %s", (name) => {
    const test = fixture({ assets: [asset(1, name)] });
    expect(test.run({ CLEAN_TOOL_BINARIES_AND_INSTALLERS: "true" }).deleted).toEqual([name]);
    expect(test.state.assets).toEqual([]);
  });
  it.each([
    "steamos-decky__bundle.previous-x.zip",
    "bashrc-profile__README.md",
    "bashrc-profile__profile_bashrc_../mac.sh",
    "url-porter__",
    "💾 release.zip",
    "steamos-decky__bundle.zip\n",
  ])("retains unknown or malformed asset name %j", (name) => {
    const test = fixture({ assets: [asset(1, name)] });
    expect(
      test.run({ CLEAN_PRECOMPILED_PROFILES: "true", CLEAN_TOOL_BINARIES_AND_INSTALLERS: "true", CLEAN_DECKY_BUNDLES: "true" }),
    ).toEqual({ deleted: [], kept: [name] });
    expect(test.state.assets).toEqual([asset(1, name)]);
  });
  it.each(["yes", "1", "", true, "TRUE"])("rejects non-boolean checkbox input %j without API effects", (value) => {
    const test = fixture();
    expect(() => test.run({ CLEAN_DECKY_BUNDLES: value })).toThrow("CLEAN_DECKY_BUNDLES: expected true or false");
    expect(test.requests).toEqual([]);
    expect(test.state.assets).toEqual(original);
  });
  it.each(["", "../other", "acme/example/releases", "acme/example;echo x", undefined])(
    "rejects invalid repository %j before API effects",
    (repo) => {
      const test = fixture();
      expect(() => test.run({ CLEAN_DECKY_BUNDLES: "true", CACHE_REPO: repo })).toThrow("CACHE_REPO: expected owner/repo");
      expect(test.requests).toEqual([]);
      expect(test.state.assets).toEqual(original);
    },
  );
  it.each([null, { id: -1, tag_name: "binary-cache" }, { id: 77, tag_name: "latest" }])(
    "rejects malformed or wrong release %j without deletion",
    (release) => {
      const test = fixture({ release });
      expect(() => test.run({ CLEAN_DECKY_BUNDLES: "true" })).toThrow("invalid release");
      expect(test.state.assets).toEqual(original);
      expect(test.logs).toEqual([]);
    },
  );
  it.each([
    {},
    Array(101).fill({}),
    [asset(1, "url-porter__x", { size: -1 })],
    [asset(1, "url-porter__x", { id: "1" })],
    [asset(1, "url-porter__x", { updated_at: "" })],
    [asset(1, "url-porter__x"), asset(1, "url-porter__y")],
    [asset(1, "url-porter__x"), asset(2, "url-porter__x")],
  ])("rejects malformed or duplicated enumerated assets %j before mutation", (page) => {
    const test = fixture({ page });
    expect(() => test.run({ CLEAN_TOOL_BINARIES_AND_INSTALLERS: "true" })).toThrow(/invalid asset|duplicate asset/);
    expect(test.state.assets).toEqual(original);
    expect(test.logs).toEqual([]);
  });
  it.each(["release", { name: "unknown__changed.zip" }, { id: 999 }, { size: 0 }, { updated_at: "2026-10-22T00:00:00Z" }])(
    "stops when the release or selected asset changes: %j",
    (changed) => {
      const test = fixture({ changed });
      expect(() => test.run({ CLEAN_PRECOMPILED_PROFILES: "true" })).toThrow(/changed since cleanup plan/);
      expect(test.state.assets).toEqual(original);
      expect(test.logs).toHaveLength(1);
      expect(test.logs[0].event).toBe("plan");
    },
  );
  it("fails visibly on discovery failure without deleting anything", () => {
    const test = fixture({ failRead: true });
    expect(() => test.run({ CLEAN_DECKY_BUNDLES: "true" })).toThrow("fixture API unavailable");
    expect(test.state.assets).toEqual(original);
    expect(test.logs).toEqual([]);
  });
  it("reports only completed deletions on a partial transport failure and does not continue", () => {
    const test = fixture({ failDeleteId: 103 });
    expect(() => test.run({ CLEAN_TOOL_BINARIES_AND_INSTALLERS: "true" })).toThrow("fixture deletion denied");
    expect(test.state.assets).toEqual([original[0], ...original.slice(2)]);
    expect(test.logs.at(-1)).toEqual({ event: "deleted", id: 102, name: "url-porter__url-porter.zip" });
    expect(test.logs).toHaveLength(2);
  });
  it("enumerates the second page before selecting its Decky asset", () => {
    const first = Array.from({ length: 100 }, (_, index) => asset(index + 1, `unknown__${index}.zip`));
    const last = asset(501, "steamos-decky__bundle.zip", { size: 0 });
    const test = fixture({ assets: [...first, last], pages: [first, [last]] });
    const result = test.run({ CLEAN_DECKY_BUNDLES: "true" });
    expect(result.deleted).toEqual(["steamos-decky__bundle.zip"]);
    expect(result.kept).toHaveLength(100);
    expect(test.state.assets).toEqual(first);
    expect(test.requests).toContainEqual(["DELETE", "repos/acme/example/releases/assets/501"]);
  });
  it("bounds enumeration and never deletes after ten full pages", () => {
    const pages = Array.from({ length: 10 }, (_, page) =>
      Array.from({ length: 100 }, (_, index) => asset(page * 100 + index + 1, `unknown__${page}-${index}.zip`)),
    );
    const test = fixture({ pages });
    expect(() => test.run({ CLEAN_DECKY_BUNDLES: "true" })).toThrow("asset enumeration exceeded 10 pages; no assets deleted");
    expect(test.state.assets).toEqual(original);
    expect(test.logs).toEqual([]);
  });
  it("accepts empty releases without deletion", () => {
    const test = fixture({ assets: [] });
    expect(test.run({ CLEAN_DECKY_BUNDLES: "true" })).toEqual({ deleted: [], kept: [] });
    expect(test.logs.at(-1)).toEqual({ event: "complete", deleted: 0, kept: 0 });
  });
});

describe("cache cleanup workflow CLI (subprocess, local gh adapter)", () => {
  it("executes the actual workflow command and deletes only selected fixture assets", () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "release-cleanup-"));
    folders.push(folder);
    const state = path.join(folder, "assets.json");
    fs.writeFileSync(state, JSON.stringify(original));
    fs.writeFileSync(
      path.join(folder, "gh"),
      `#!${process.execPath}
const fs = require("fs");
const args = process.argv.slice(2);
const assets = JSON.parse(fs.readFileSync(process.env.FIXTURE_STATE));
const endpoint = args[1];
const id = Number(endpoint.split("/").pop());
if (args[0] !== "api" || args[2] !== "--method") process.exit(2);
if (args[3] === "DELETE") fs.writeFileSync(process.env.FIXTURE_STATE, JSON.stringify(assets.filter(asset => asset.id !== id)));
else if (endpoint.endsWith("/tags/binary-cache")) process.stdout.write(JSON.stringify({id:77,tag_name:"binary-cache"}));
else if (endpoint.includes("?per_page=100&page=")) process.stdout.write(JSON.stringify(assets));
else process.stdout.write(JSON.stringify(assets.find(asset => asset.id === id)));
`,
      { mode: 0o755 },
    );
    const workflow = fs.readFileSync(".github/workflows/cleanup-release-cache.yml", "utf8");
    const command = workflow.match(/        run: (node [^\n]+)/)[1];
    const result = spawnSync("/bin/bash", ["-e", "-c", command], {
      encoding: "utf8",
      timeout: 15000,
      env: {
        ...process.env,
        PATH: `${folder}:${process.env.PATH}`,
        FIXTURE_STATE: state,
        CACHE_REPO: "acme/example",
        CLEAN_PRECOMPILED_PROFILES: "true",
        CLEAN_TOOL_BINARIES_AND_INSTALLERS: "false",
        CLEAN_DECKY_BUNDLES: "false",
      },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(fs.readFileSync(state, "utf8"))).toEqual(original.slice(1));
    expect(result.stdout).toContain('"event":"complete","deleted":1,"kept":9');
    expect(result.stderr).toBe("");
  });
  it("returns nonzero and a diagnostic for malformed CLI input without transport", () => {
    const result = spawnSync(process.execPath, ["software/tools/cleanup-release-cache.js"], {
      encoding: "utf8",
      env: { ...process.env, CLEAN_DECKY_BUNDLES: "invalid" },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("CLEAN_DECKY_BUNDLES: expected true or false");
    expect(result.stdout).toBe("");
  });
});

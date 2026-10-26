/** Exercise repository ZIP transport and cache invalidation through real public staging/build consumers. */
import { afterEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import runtime from "../scripts/decky/decky-runtime.common.js";
import zip from "../scripts/decky/decky-zip.common.js";

/** Test-owned roots removed after each integration case. */
const roots = [];
/** Return a private repository and minimal entry; write actual ZIP bytes without executing its payload. */
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "decky-repository-"));
  roots.push(root);
  const selection = { path: "assets/steamos/decky_loader_plugins/Example_v2.0.zip", name: "Example", version: "2.0" };
  fs.mkdirSync(path.join(root, path.dirname(selection.path)), { recursive: true });
  return { root, selection };
}
/** Return a built plugin ZIP (Buffer) with a caller-selected payload, always rooted at its native plugin folder. */
function artifact(payload) {
  return zip.writeZip(
    new Map([
      ["native-plugin/plugin.json", Buffer.from('{"name":"Example"}')],
      ["native-plugin/package.json", Buffer.from('{"version":"2.0"}')],
      ["native-plugin/dist/index.js", Buffer.from(payload)],
    ]),
  );
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("Decky repository ZIP distribution (real archives, offline transport)", () => {
  it("builds without upstream and resolves the same native package identity from its own cache", async () => {
    const f = fixture();
    fs.writeFileSync(path.join(f.root, f.selection.path), artifact("repo-selected"));
    const calls = [];
    const options = {
      pins: [f.selection],
      repoRoot: f.root,
      report: () => {},
      downloader: async (url) => {
        calls.push(url);
        throw new Error("no network");
      },
    };
    await runtime.build(path.join(f.root, "bundle.zip"), options);
    expect(calls).toEqual([]);
    const pins = await runtime.stage(path.join(f.root, "staged"), {
      ...options,
      downloader: async (url, target) => {
        calls.push(url);
        fs.writeFileSync(target, fs.readFileSync(path.join(f.root, "bundle.zip")));
      },
    });
    expect(calls).toEqual([runtime.CACHE_URL]);
    expect(pins[0]).toMatchInlineSnapshot(`
      {
        "local_path": "assets/steamos/decky_loader_plugins/Example_v2.0.zip",
        "name": "Example",
        "path": "decky_plugin/Example_v2.0.zip",
        "root": "native-plugin",
        "sha256": "7e09380043a5f87098ada646b99ed869af21acbe75a38d381e76fc4f405707cd",
        "source": "assets/steamos/decky_loader_plugins/Example_v2.0.zip",
        "version": "2.0",
      }
    `);
    expect(fs.readFileSync(path.join(f.root, "staged/decky_plugin/Example_v2.0.zip"))).toEqual(artifact("repo-selected"));
  });

  it("replaces stale cached bytes even when the repo filename and package version did not change", async () => {
    const f = fixture();
    fs.writeFileSync(path.join(f.root, f.selection.path), artifact("old repo payload"));
    await runtime.build(path.join(f.root, "old.zip"), { pins: [f.selection], repoRoot: f.root, report: () => {} });
    fs.writeFileSync(path.join(f.root, f.selection.path), artifact("new repo payload"));
    const calls = [];
    await runtime.stage(path.join(f.root, "staged"), {
      pins: [f.selection],
      repoRoot: f.root,
      report: () => {},
      downloader: async (url, target) => {
        calls.push(url);
        fs.writeFileSync(target, fs.readFileSync(path.join(f.root, "old.zip")));
      },
    });
    expect(calls).toEqual([runtime.CACHE_URL]);
    expect(fs.readFileSync(path.join(f.root, "staged/decky_plugin/Example_v2.0.zip"))).toEqual(artifact("new repo payload"));
  });

  it("fetches compact entries from the trusted repo raw base only when no checkout accompanies a remote run", async () => {
    const f = fixture();
    const calls = [];
    const result = await runtime.stage(path.join(f.root, "staged"), {
      pins: [f.selection],
      repoRoot: f.root,
      repositoryUrl: "https://example.test/repo/HEAD/?raw=1",
      cacheUrl: null,
      report: () => {},
      downloader: async (url, target) => {
        calls.push(url);
        fs.writeFileSync(target, artifact("remote repo bytes"));
      },
    });
    expect(calls).toEqual(["https://example.test/repo/HEAD/assets/steamos/decky_loader_plugins/Example_v2.0.zip"]);
    expect(result[0]).toMatchInlineSnapshot(`
      {
        "local_path": "assets/steamos/decky_loader_plugins/Example_v2.0.zip",
        "name": "Example",
        "path": "decky_plugin/Example_v2.0.zip",
        "root": "native-plugin",
        "sha256": "d230efcaf9675231f97916b38a9b79fcc0bebdc2d74e364aa549db21d9b82e11",
        "source": "assets/steamos/decky_loader_plugins/Example_v2.0.zip",
        "version": "2.0",
      }
    `);
    expect(fs.readFileSync(path.join(f.root, "staged/decky_plugin/Example_v2.0.zip"))).toEqual(artifact("remote repo bytes"));
  });

  it("rejects a repository download failure without publishing packages or metadata", async () => {
    const f = fixture();
    const calls = [];
    await expect(
      runtime.stage(path.join(f.root, "staged"), {
        pins: [f.selection],
        repositoryUrl: "https://example.test/repo/",
        report: () => {},
        downloader: async (url) => {
          calls.push(url);
          throw new Error("repo unavailable");
        },
      }),
    ).rejects.toThrow("repo unavailable");
    expect(calls).toEqual(["https://example.test/repo/assets/steamos/decky_loader_plugins/Example_v2.0.zip"]);
    expect(fs.existsSync(path.join(f.root, "staged/metadata.json"))).toBe(false);
    expect(fs.existsSync(path.join(f.root, "staged/decky_plugin"))).toBe(false);
  });

  it("rejects an unsafe raw path before requesting that URL", async () => {
    const f = fixture();
    const calls = [];
    await expect(
      runtime.stage(path.join(f.root, "staged"), {
        pins: [{ ...f.selection, path: "../outside.zip" }],
        repositoryUrl: "https://example.test/repo/",
        report: () => {},
        downloader: async (url) => {
          calls.push(url);
        },
      }),
    ).rejects.toThrow("package path");
    expect(calls).toEqual([]);
    expect(fs.existsSync(path.join(f.root, "staged/metadata.json"))).toBe(false);
  });
});

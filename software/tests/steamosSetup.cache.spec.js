import { afterEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
import runtime from "../scripts/decky/decky-runtime.common.js";
import zip from "../scripts/decky/decky-zip.common.js";
import pins from "../metadata/decky-packages.json";

/** Test-owned workspaces, never the user's home or release assets. */
const workspaces = [];
/** Return new private test workspace (string). */
function workspace() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "decky-node-"));
  workspaces.push(folder);
  return folder;
}
/** Return installable fixture bytes and a matching trusted pin, with optional manifest overrides. */
function artifact(name = "Example", theme = false, overrides = {}) {
  const manifest = { name, ...(theme ? { version: "2.0", id: "theme-id" } : { flags: [] }), ...overrides };
  const entries = theme
    ? [[`${name}/theme.json`, Buffer.from(JSON.stringify(manifest))]]
    : [
        [`${name}/plugin.json`, Buffer.from(JSON.stringify(manifest))],
        [`${name}/package.json`, Buffer.from('{"version":"2.0"}')],
        [`${name}/dist/index.js`, Buffer.from("compiled payload; never executed")],
      ];
  const bytes = zip.writeZip(new Map(entries));
  const pin = {
    path: `${theme ? "decky_css_loader" : "decky_plugin"}/${name.replace(/ /g, "_")}_v2.0.zip`,
    name,
    version: "2.0",
    root: name,
    source: "acme/example",
    url: `https://example.test/${encodeURIComponent(name)}.zip`,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    ...(theme ? { theme_id: "theme-id" } : {}),
  };
  return { bytes, pin };
}
/** Return real cache ZIP bytes containing metadata and selected package payloads. */
function bundle(artifacts, records = artifacts.map((item) => item.pin)) {
  return zip.writeZip(
    new Map([
      ["metadata.json", Buffer.from(JSON.stringify({ schema_version: 1, packages: records }))],
      ...artifacts.map(({ pin, bytes }) => [pin.path, bytes]),
    ]),
  );
}
/** Return controlled downloader recording URLs while writing actual bytes; unknown requests reject. */
function transport(responses, requests) {
  return async (url, destination) => {
    requests.push(url);
    const bytes = responses.get(url);
    if (!bytes) throw new Error("fixture upstream unavailable");
    fs.writeFileSync(destination, bytes);
  };
}

afterEach(() => {
  for (const folder of workspaces.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

describe("Decky Node cache staging (offline real ZIPs)", () => {
  it("uses the release bundle first, preserves names/metadata, and needs no upstream downloads on a hit", async () => {
    const plugin = artifact();
    const theme = artifact("Example Theme", true);
    const folder = path.join(workspace(), "packages");
    const requests = [];
    await runtime.stage(folder, {
      pins: [plugin.pin, theme.pin],
      downloader: transport(new Map([[runtime.CACHE_URL, bundle([plugin, theme])]]), requests),
      report: () => {},
    });
    expect(requests).toEqual(["https://github.com/synle/bashrc/releases/download/binary-cache/steamos-decky__bundle.zip"]);
    expect(fs.readFileSync(path.join(folder, "decky_plugin/Example_v2.0.zip"))).toEqual(plugin.bytes);
    expect(fs.readFileSync(path.join(folder, "decky_css_loader/Example_Theme_v2.0.zip"))).toEqual(theme.bytes);
    expect(JSON.parse(fs.readFileSync(path.join(folder, "metadata.json"), "utf8"))).toEqual({
      schema_version: 1,
      packages: [plugin.pin, theme.pin],
    });
  });

  it.each(["missing", "stale", "hash", "crc", "unsafe"])(
    "recovers %s cache data upstream while retaining other valid selected payloads",
    async (condition) => {
      const plugin = artifact();
      const theme = artifact("Example Theme", true);
      let cache;
      if (condition === "missing") cache = bundle([theme]);
      if (condition === "stale") cache = bundle([plugin, theme], [{ ...plugin.pin, version: "1.0" }, theme.pin]);
      if (condition === "hash") cache = bundle([{ ...plugin, bytes: Buffer.from("corrupt") }, theme]);
      if (condition === "crc") {
        cache = bundle([plugin, theme]);
        const start = cache.indexOf(plugin.bytes);
        cache[start] ^= 1;
      }
      if (condition === "unsafe") cache = zip.writeZip(new Map([["unselected", Buffer.from("unsafe")]]));
      const requests = [];
      const folder = path.join(workspace(), "packages");
      await runtime.stage(folder, {
        pins: [plugin.pin, theme.pin],
        downloader: transport(
          new Map([
            [runtime.CACHE_URL, cache],
            [plugin.pin.url, plugin.bytes],
            [theme.pin.url, theme.bytes],
          ]),
          requests,
        ),
        report: () => {},
      });
      expect(requests).toEqual(
        condition === "unsafe" ? [runtime.CACHE_URL, plugin.pin.url, theme.pin.url] : [runtime.CACHE_URL, plugin.pin.url],
      );
      expect(fs.readFileSync(path.join(folder, plugin.pin.path))).toEqual(plugin.bytes);
      expect(fs.readFileSync(path.join(folder, theme.pin.path))).toEqual(theme.bytes);
    },
  );

  it("falls back after a cache request failure and leaves no published metadata after upstream failure", async () => {
    const plugin = artifact();
    const folder = path.join(workspace(), "packages");
    const requests = [];
    const diagnostics = [];
    await expect(
      runtime.stage(folder, { pins: [plugin.pin], downloader: transport(new Map(), requests), report: (value) => diagnostics.push(value) }),
    ).rejects.toThrow("fixture upstream unavailable");
    expect(requests).toEqual([runtime.CACHE_URL, plugin.pin.url]);
    expect(fs.existsSync(path.join(folder, plugin.pin.path))).toBe(false);
    expect(fs.existsSync(path.join(folder, "metadata.json"))).toBe(false);
    expect(diagnostics.join("\n")).toContain("cache unavailable or invalid");
  });

  it("awaits complete batches of three, overlaps downloads, and never starts batch two early", async () => {
    const artifacts = [
      artifact("One"),
      artifact("Two"),
      artifact("Three"),
      artifact("Four"),
      artifact("Five"),
      artifact("Six"),
      artifact("Seven"),
    ];
    const folder = path.join(workspace(), "packages");
    const active = new Map();
    const started = [];
    let wake;
    const changed = () =>
      new Promise((resolve) => {
        wake = resolve;
      });
    const downloader = (url, destination) =>
      new Promise((resolve) => {
        started.push(url);
        active.set(url, () => {
          fs.writeFileSync(destination, artifacts.find((item) => item.pin.url === url).bytes);
          active.delete(url);
          resolve();
        });
        wake?.();
      });
    const operation = runtime.stage(folder, { pins: artifacts.map((item) => item.pin), cacheUrl: null, downloader, report: () => {} });
    expect([...active.keys()]).toEqual([artifacts[0].pin.url, artifacts[1].pin.url, artifacts[2].pin.url]);
    active.get(artifacts[1].pin.url)();
    await Promise.resolve();
    expect(started).toHaveLength(3);
    active.get(artifacts[0].pin.url)();
    const secondBatch = changed();
    active.get(artifacts[2].pin.url)();
    await secondBatch;
    expect([...active.keys()]).toEqual([artifacts[3].pin.url, artifacts[4].pin.url, artifacts[5].pin.url]);
    active.get(artifacts[3].pin.url)();
    active.get(artifacts[4].pin.url)();
    const lastBatch = changed();
    active.get(artifacts[5].pin.url)();
    await lastBatch;
    expect([...active.keys()]).toEqual([artifacts[6].pin.url]);
    active.get(artifacts[6].pin.url)();
    await operation;
    expect(fs.readdirSync(path.join(folder, "decky_plugin"))).toHaveLength(7);
  });

  it("waits for all in-flight downloads after one failure and does not start another batch", async () => {
    const artifacts = [artifact("One"), artifact("Two"), artifact("Three"), artifact("Four")];
    const requests = [];
    let finish;
    let completed = false;
    const pending = new Promise((resolve) => {
      finish = resolve;
    });
    const operation = runtime
      .stage(path.join(workspace(), "packages"), {
        pins: artifacts.map((item) => item.pin),
        cacheUrl: null,
        report: () => {},
        downloader: async (url) => {
          requests.push(url);
          if (url === artifacts[0].pin.url) throw new Error("first failed");
          await pending;
          throw new Error("other failed");
        },
      })
      .catch((error) => {
        completed = true;
        return error.message;
      });
    await Promise.resolve();
    expect(completed).toBe(false);
    finish();
    expect(await operation).toBe("first failed");
    expect(requests).toEqual([artifacts[0].pin.url, artifacts[1].pin.url, artifacts[2].pin.url]);
  });

  it("refuses a symlinked staging destination without writing outside it", async () => {
    const folder = workspace();
    fs.mkdirSync(path.join(folder, "outside"));
    fs.symlinkSync(path.join(folder, "outside"), path.join(folder, "packages"));
    await expect(runtime.stage(path.join(folder, "packages"), { pins: [], cacheUrl: null })).rejects.toThrow("EEXIST");
    expect(fs.readdirSync(path.join(folder, "outside"))).toEqual([]);
  });

  it.each([
    ["wrong name", false, { name: "Other" }, "name/version"],
    ["wrong version", true, { version: "1" }, "name/version"],
    ["wrong theme ID", true, { id: "other" }, "theme ID"],
  ])("rejects %s despite a matching byte hash", (_label, theme, overrides, error) => {
    const item = artifact("Example", theme, overrides);
    expect(() => runtime.validatePackage(item.bytes, item.pin)).toThrow(error);
  });

  it("requires compiled plugin code and correct selected root", () => {
    const item = artifact();
    const source = zip.writeZip(
      new Map([
        ["Example/plugin.json", Buffer.from('{"name":"Example"}')],
        ["Example/package.json", Buffer.from('{"version":"2.0"}')],
      ]),
    );
    const hash = crypto.createHash("sha256").update(source).digest("hex");
    expect(() => runtime.validatePackage(source, { ...item.pin, sha256: hash })).toThrow("built dist/index.js");
    expect(() => runtime.validatePackage(item.bytes, { ...item.pin, root: "Other" })).toThrow("root does not match");
    expect(() => runtime.validatePackage(item.bytes, { ...item.pin, sha256: "0".repeat(64) })).toThrow("SHA-256");
  });
});

describe("Decky deterministic bundle build", () => {
  it("builds reproducibly and can stage its own output without upstream", async () => {
    const item = artifact();
    const folder = workspace();
    const options = { pins: [item.pin], downloader: transport(new Map([[item.pin.url, item.bytes]]), []), report: () => {} };
    await runtime.build(path.join(folder, "first.zip"), options);
    await runtime.build(path.join(folder, "second.zip"), options);
    const payload = fs.readFileSync(path.join(folder, "first.zip"));
    expect(payload).toEqual(fs.readFileSync(path.join(folder, "second.zip")));
    const requests = [];
    await runtime.stage(path.join(folder, "staged"), {
      ...options,
      downloader: transport(new Map([[runtime.CACHE_URL, payload]]), requests),
    });
    expect(requests).toEqual([runtime.CACHE_URL]);
    expect(fs.readFileSync(path.join(folder, "staged", item.pin.path))).toEqual(item.bytes);
  });

  it("keeps previous output and cleans only its own work on build failure", async () => {
    const folder = workspace();
    const output = path.join(folder, "previous.zip");
    fs.writeFileSync(output, "previous verified asset");
    await expect(
      runtime.build(output, {
        pins: [artifact().pin],
        downloader: async () => {
          throw new Error("offline");
        },
        report: () => {},
      }),
    ).rejects.toThrow("offline");
    expect(fs.readFileSync(output, "utf8")).toBe("previous verified asset");
    expect(fs.readdirSync(folder)).toEqual(["previous.zip"]);
  });

  it("ships nine plugins and nine themes, including verified newer store releases and Centered Home", () => {
    expect(pins.filter((pin) => pin.path.startsWith("decky_plugin/"))).toHaveLength(9);
    expect(pins.filter((pin) => pin.path.startsWith("decky_css_loader/"))).toHaveLength(9);
    expect(pins.find((pin) => pin.name === "HLTB for Deck").version).toBe("2.0.12");
    expect(pins.find((pin) => pin.name === "ProtonDB Badges").version).toBe("1.3.4");
    expect(pins.find((pin) => pin.name === "Centered Home")).toMatchObject({
      path: "decky_css_loader/Centered_Home_v1.3.zip",
      theme_id: "865407ae-fb14-4db7-b123-61f6995ed757",
    });
    expect(pins.every((pin) => /\/[A-Za-z0-9_-]+_v[0-9.]+\.zip$/.test(pin.path))).toBe(true);
  });

  it("CLI rejects missing output with a nonzero status and usable diagnostic (subprocess)", () => {
    const result = spawnSync(process.execPath, ["software/tools/decky-bundle.js"], { encoding: "utf8", timeout: 10000 });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Usage: node software/tools/decky-bundle.js OUTPUT.zip");
  });
});

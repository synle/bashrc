/** Contract tests for compact repository ZIPs, rich remote pins, and the exact Loader inventory version. */
import { afterEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import packages from "../scripts/decky/decky-packages.common.js";
import zip from "../scripts/decky/decky-zip.common.js";
import inventory from "../metadata/decky-packages.json";

/** Private test roots cleaned after every case, including rejected inputs. */
const roots = [];
/** Return a private repository fixture containing an optional installable plugin or theme ZIP. */
function fixture({ theme = false, entries } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "decky-inventory-"));
  roots.push(root);
  const relative = "assets/steamos/decky_loader_plugins/Example_v2.0.zip";
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload = zip.writeZip(
    new Map(
      entries ??
        (theme
          ? [["Native Root/theme.json", Buffer.from('{"name":"Example","version":"v2.0","id":"theme-id"}')]]
          : [
              ["Native Root/plugin.json", Buffer.from('{"name":"Example","flags":[]}')],
              ["Native Root/package.json", Buffer.from('{"version":"2.0"}')],
              ["Native Root/dist/index.js", Buffer.from("compiled, never executed")],
            ]),
    ),
  );
  fs.writeFileSync(file, payload);
  return { root, file, payload, selection: { path: relative, name: "Example", version: "2.0" } };
}

/** Create an explicitly unsafe filesystem fixture; return its repository paths without invoking the consumer. */
function unsafeSource(kind) {
  const f = fixture();
  if (kind === "symlink") {
    fs.renameSync(f.file, f.file + ".real");
    fs.symlinkSync(f.file + ".real", f.file);
  }
  if (kind === "hardlink") fs.linkSync(f.file, f.file + ".link");
  if (kind === "parent symlink") {
    fs.renameSync(path.dirname(f.file), path.dirname(f.file) + ".real");
    fs.symlinkSync(path.dirname(f.file) + ".real", path.dirname(f.file));
  }
  if (kind === "empty") fs.truncateSync(f.file, 0);
  if (kind === "oversized") fs.truncateSync(f.file, 256 * 1024 * 1024 + 1);
  if (kind === "folder") {
    fs.unlinkSync(f.file);
    fs.mkdirSync(f.file);
  }
  return f;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("compact Decky repository inventory", () => {
  it("resolves all 19 selections while deriving trusted metadata from the 18 repository archives", () => {
    const pins = packages.resolvePackages(inventory.decky_packages);
    expect(pins).toHaveLength(19);
    expect(pins.filter((p) => p.theme_id)).toHaveLength(9);
    expect(pins.filter((p) => !p.theme_id)).toHaveLength(10);
    expect(pins.find((p) => p.name === "Decky LSFG-VK").version).toBe("0.14.4");
    expect(pins.find((p) => p.name === "HLTB for Deck").version).toBe("2.0.12");
    expect(pins.find((p) => p.name === "ProtonDB Badges").version).toBe("1.3.4");
    expect(pins.find((p) => p.name === "HueSync")).toMatchInlineSnapshot(`
      {
        "local_path": "assets/steamos/decky_loader_plugins/HueSync_v3.9.0.zip",
        "name": "HueSync",
        "path": "decky_plugin/HueSync_v3.9.0.zip",
        "root": "HueSync",
        "sha256": "7510c96ed22278a914a3aae591c2393ff4e25812a765d1d633f77baa8a593e1f",
        "source": "assets/steamos/decky_loader_plugins/HueSync_v3.9.0.zip",
        "version": "3.9.0",
      }
    `);
    expect(pins.find((p) => p.name === "Centered Home")).toMatchInlineSnapshot(`
      {
        "local_path": "assets/steamos/decky_loader_plugins/Centered_Home_v1.3.zip",
        "name": "Centered Home",
        "path": "decky_css_loader/Centered_Home_v1.3.zip",
        "root": "Centered Home",
        "sha256": "3432aee99cfbca1fefa5660a819a3223683d8d80c3dd5fe83aa94c4e48e26ba2",
        "source": "assets/steamos/decky_loader_plugins/Centered_Home_v1.3.zip",
        "theme_id": "865407ae-fb14-4db7-b123-61f6995ed757",
        "version": "1.3",
      }
    `);
  });

  it("pins the verified Framegen stable archive without committing the oversized ZIP", () => {
    expect(inventory.decky_packages.find((p) => p.name === "Decky-Framegen")).toMatchInlineSnapshot(`
      {
        "name": "Decky-Framegen",
        "path": "decky_plugin/Decky-Framegen_v0.17.zip",
        "root": "Decky-Framegen",
        "sha256": "3300b617e3d979b483d03f995c75c829d6d54beaa4ac8dfae300c2560e4fc60f",
        "source": "https://github.com/xXJSONDeruloXx/Decky-Framegen",
        "url": "https://github.com/xXJSONDeruloXx/Decky-Framegen/releases/download/v0.17/Decky-Framegen.zip",
        "version": "0.17",
      }
    `);
    expect(fs.existsSync("assets/steamos/decky_loader_plugins/Decky-Framegen_v0.17.zip")).toBe(false);
  });

  it("does not assume the archive root matches the filename or display name", () => {
    const f = fixture();
    const [pin] = packages.resolvePackages([f.selection], f.root);
    expect(pin).toMatchInlineSnapshot(`
      {
        "local_path": "assets/steamos/decky_loader_plugins/Example_v2.0.zip",
        "name": "Example",
        "path": "decky_plugin/Example_v2.0.zip",
        "root": "Native Root",
        "sha256": "b0ca98a642b990cd155956f3cfa1ff16a2cb9dad5ec5774072288466dcae24b1",
        "source": "assets/steamos/decky_loader_plugins/Example_v2.0.zip",
        "version": "2.0",
      }
    `);
    expect(packages.readRepositoryArchive(f.selection.path, f.root)).toEqual(f.payload);
  });

  it("derives theme IDs and verifies their embedded version", () => {
    const f = fixture({ theme: true });
    expect(packages.resolvePackages([f.selection], f.root)[0]).toMatchInlineSnapshot(`
      {
        "local_path": "assets/steamos/decky_loader_plugins/Example_v2.0.zip",
        "name": "Example",
        "path": "decky_css_loader/Example_v2.0.zip",
        "root": "Native Root",
        "sha256": "43d28ab5a10874bd979e9cf643c61423f4fa98737c5c72619468ed5c2e9e8e03",
        "source": "assets/steamos/decky_loader_plugins/Example_v2.0.zip",
        "theme_id": "theme-id",
        "version": "2.0",
      }
    `);
  });

  it("retains rich HTTPS/hash entries without requiring a local ZIP", () => {
    const pin = {
      path: "decky_plugin/Example_v2.0.zip",
      name: "Example",
      version: "2.0",
      root: "Native Root",
      url: "https://example.test/plugin.zip",
      sha256: "a".repeat(64),
    };
    expect(packages.resolvePackages([pin])).toEqual([pin]);
    expect(packages.resolvePackages([])).toEqual([]);
  });

  it.each([null, {}, "bad", 0])("rejects non-array selections %j", (value) => {
    expect(() => packages.resolvePackages(value)).toThrow("decky_packages must be an array");
  });

  it.each([null, [], "bad", false])("rejects non-object entries %j", (value) => {
    expect(() => packages.resolvePackages([value])).toThrow("package entry must be an object");
  });

  it.each(["", "  ", "../escape", "a\\b", "a\nname", "x".repeat(257), 0])("rejects invalid identity %j", (name) => {
    const f = fixture();
    expect(() => packages.resolvePackages([{ ...f.selection, name }], f.root)).toThrow("package name");
    expect(fs.readFileSync(f.file)).toEqual(f.payload);
  });

  it.each(["", "v2.0", "2.0-pre1", "../2", "2".repeat(33), 0])("rejects invalid version %j", (version) => {
    const f = fixture();
    expect(() => packages.resolvePackages([{ ...f.selection, version }], f.root)).toThrow("package version");
  });

  it.each([
    "",
    "/tmp/Example_v2.0.zip",
    "assets/steamos/decky_loader_plugins/../Example_v2.0.zip",
    "assets/steamos/decky_loader_plugins/.hidden_v2.0.zip",
    "assets/steamos/decky_loader_plugins/a/b_v2.0.zip",
    "assets/steamos/decky_loader_plugins/a\n_v2.0.zip",
    "https://example.test/a.zip",
    0,
  ])("rejects unsafe repository path %j", (value) => {
    expect(() => packages.repositoryArchivePath(value)).toThrow("package path");
  });

  it("rejects unknown compact fields instead of weakening hash validation", () => {
    const f = fixture();
    expect(() => packages.resolvePackages([{ ...f.selection, sha256: "ignore" }], f.root)).toThrow("accepts only path, name, and version");
  });

  it.each(["symlink", "hardlink", "parent symlink", "empty", "oversized", "folder"])("rejects a %s source before parsing", (kind) => {
    const f = unsafeSource(kind);
    expect(() => packages.resolvePackages([f.selection], f.root)).toThrow();
    expect(fs.existsSync(path.join(f.root, "homebrew"))).toBe(false);
  });

  it.each([
    {
      entries: [
        ["One/plugin.json", "{}"],
        ["Two/plugin.json", "{}"],
      ],
    },
    { entries: [["Root/file", "no manifest"]] },
    {
      entries: [
        ["Root/plugin.json", "{}"],
        ["Root/theme.json", "{}"],
      ],
    },
    { entries: [[".hidden/plugin.json", "{}"]] },
  ])("rejects ambiguous or unsafe roots %j", ({ entries }) => {
    const f = fixture({ entries: entries.map(([name, value]) => [name, Buffer.from(value)]) });
    expect(() => packages.resolvePackages([f.selection], f.root)).toThrow(/root/);
  });

  it.each(["{}", '{"name":"Example","version":"2.0","id":""}'])("rejects a theme without an ID %s", (manifest) => {
    const f = fixture({ entries: [["Root/theme.json", Buffer.from(manifest)]] });
    expect(() => packages.resolvePackages([f.selection], f.root)).toThrow("theme ID");
  });

  it.each(["{", "[]", "null"])("rejects malformed or non-object JSON %s", (manifest) => {
    const f = fixture({ entries: [["Root/plugin.json", Buffer.from(manifest)]] });
    expect(() => packages.resolvePackages([f.selection], f.root)).toThrow(/JSON/);
  });

  it("rejects duplicate destinations before producing installable selections", () => {
    const f = fixture();
    expect(() => packages.resolvePackages([f.selection, f.selection], f.root)).toThrow("duplicate package");
  });

  it.each([
    { path: "../Example.zip" },
    { root: "../root" },
    { root: "" },
    { url: "http://example.test/a.zip" },
    { sha256: "no hash" },
    { local_path: "assets/steamos/decky_loader_plugins/Example_v2.0.zip" },
  ])("rejects unsafe rich entry overrides %j", (overrides) => {
    const pin = {
      path: "decky_plugin/Example_v2.0.zip",
      name: "Example",
      version: "2.0",
      root: "Root",
      url: "https://example.test/a.zip",
      sha256: "a".repeat(64),
      ...overrides,
    };
    expect(() => packages.resolvePackages([pin])).toThrow("upstream package requires");
  });
});

describe("exact Decky Loader inventory version", () => {
  it("accepts the selected stable Loader version", () => {
    expect(packages.loaderVersion(inventory)).toBe("3.3.0");
  });
  it.each([null, [], {}, { decky_loader_version: "3.3.0" }])("rejects invalid inventory shape %j", (value) => {
    expect(() => packages.loaderVersion(value)).toThrow("inventory requires");
  });
  it.each(["", "latest", "v3.3.0", "3.3", "3.3.0-pre1", 0])("rejects non-exact Loader version %j", (version) => {
    expect(() => packages.loaderVersion({ decky_loader_version: version, decky_packages: [] })).toThrow("decky_loader_version");
  });
});

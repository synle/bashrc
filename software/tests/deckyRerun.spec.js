/** Real archive writes and reruns with only Linux descriptor paths and requested ownership simulated on macOS. */
import { afterEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import protectedInstaller from "../scripts/decky/decky-install.common.js";
import zip from "../scripts/decky/decky-zip.common.js";

/** Homes owned by this spec, removed after success or failure. */
const homes = [];
/** Return a simulated Linux home and its real protected writer, preserving actual no-follow opens and file readback. */
function fixture() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "decky-rerun-"));
  homes.push(home);
  fs.mkdirSync(path.join(home, "homebrew/plugins"), { recursive: true });
  const descriptors = new Map();
  const owners = new Map();
  /** Resolve Linux descriptor-relative filenames into this test-owned filesystem. */
  function resolve(target) {
    return String(target).replace(/^\/proc\/self\/fd\/(\d+)\//, (_match, fd) => descriptors.get(Number(fd)) + "/");
  }
  const filesystem = {
    ...fs,
    openSync(target, flags, mode) {
      const actual = resolve(target);
      const fd = fs.openSync(actual, flags, mode);
      descriptors.set(fd, actual);
      return fd;
    },
    closeSync(fd) {
      descriptors.delete(fd);
      fs.closeSync(fd);
    },
    mkdirSync(target, options) {
      fs.mkdirSync(resolve(target), options);
    },
    lstatSync(target) {
      return fs.lstatSync(resolve(target));
    },
    fchownSync(fd, uid, gid) {
      owners.set(fd, { uid, gid });
    },
    fstatSync(fd) {
      return Object.assign(fs.fstatSync(fd), owners.get(fd));
    },
  };
  const options = { filesystem, accountLookup: () => ({ uid: 12345, gid: 23456, home }), report: () => {} };
  return { home, options };
}
/** Encode a trusted repository package and install it through the real protected public entry point. */
function apply(f, payload) {
  const bytes = zip.writeZip(
    new Map([
      ["native-plugin/plugin.json", Buffer.from('{"name":"Example","flags":[]}')],
      ["native-plugin/package.json", Buffer.from('{"version":"2.0"}')],
      ["native-plugin/dist/index.js", Buffer.from(payload)],
    ]),
  );
  const archive = path.join(f.home, "repo.zip");
  fs.writeFileSync(archive, bytes);
  protectedInstaller.installArchive(archive, f.home, "plugins", 12345, crypto.createHash("sha256").update(bytes).digest("hex"), f.options);
}

afterEach(() => {
  for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
});

describe("Decky selected repository bytes win on every rerun", () => {
  it.each(["2.0", "9.0"])("overwrites installed version %s with the selected ZIP and preserves unrelated settings/plugins", (installed) => {
    const f = fixture();
    apply(f, "first repo payload");
    const plugin = path.join(f.home, "homebrew/plugins/native-plugin");
    fs.writeFileSync(path.join(plugin, "package.json"), JSON.stringify({ version: installed }));
    fs.writeFileSync(path.join(plugin, "dist/index.js"), "modified machine payload");
    fs.writeFileSync(path.join(plugin, "settings.json"), '{"keep":true}', { mode: 0o600 });
    fs.mkdirSync(path.join(f.home, "homebrew/plugins/unrelated-plugin"));
    fs.writeFileSync(path.join(f.home, "homebrew/plugins/unrelated-plugin/plugin.json"), '{"name":"Unrelated"}');
    apply(f, "selected repo payload");
    apply(f, "selected repo payload");
    expect(fs.readFileSync(path.join(plugin, "dist/index.js"), "utf8")).toBe("selected repo payload");
    expect(fs.readFileSync(path.join(plugin, "package.json"), "utf8")).toBe('{"version":"2.0"}');
    expect(fs.readFileSync(path.join(plugin, "settings.json"), "utf8")).toBe('{"keep":true}');
    expect(fs.statSync(path.join(plugin, "settings.json")).mode & 0o777).toBe(0o600);
    expect(fs.readFileSync(path.join(f.home, "homebrew/plugins/unrelated-plugin/plugin.json"), "utf8")).toBe('{"name":"Unrelated"}');
  });
});

import { afterEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import zip from "../scripts/decky/decky-zip.common.js";

/** Test-owned workspaces. */
const folders = [];
/** Return a private fixture workspace. */
function workspace() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "decky-zip-"));
  folders.push(folder);
  return folder;
}
/** Return a real, independently encoded archive using the OS ZIP utility; no network or Python. */
function independentZip() {
  const folder = workspace();
  fs.writeFileSync(path.join(folder, "vector.txt"), "123456789");
  fs.writeFileSync(path.join(folder, "compress.txt"), "compress me\n".repeat(100));
  const result = spawnSync("zip", ["-q", "-9", "fixture.zip", "vector.txt", "compress.txt"], {
    cwd: folder,
    encoding: "utf8",
    timeout: 10000,
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return fs.readFileSync(path.join(folder, "fixture.zip"));
}
/** Return simple one-file ZIP with a selectable name; unsafe bytes can be mutated independently after encoding. */
function simple(name = "safe.txt") {
  return zip.writeZip(new Map([[name, Buffer.from("123456789")]]));
}
/** Update matching local/central member names without changing record lengths. */
function renamed(name) {
  const bytes = simple("x".repeat(Buffer.byteLength(name)));
  const central = bytes.readUInt32LE(bytes.length - 6);
  Buffer.from(name).copy(bytes, 30);
  Buffer.from(name).copy(bytes, central + 46);
  return bytes;
}

/** Generate reproducible valid property inputs, including empty, binary, and non-ASCII names/payloads. */
function generatedEntries(seed) {
  let state = seed;
  const entries = new Map([["empty", Buffer.alloc(0)]]);
  for (let index = 0; index < 64; index++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const payload = Buffer.alloc(state % 4097);
    for (let byte = 0; byte < payload.length; byte++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      payload[byte] = state >>> 24;
    }
    entries.set(`folder/${index}-日本語 אבג 🚀.bin`, payload);
  }
  return entries;
}

afterEach(() => {
  for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

describe("bounded ZIP32 artifact codec", () => {
  it.each([123, 907, 20261021])("round-trips generated valid inputs with property seed=%i", (seed) => {
    const input = generatedEntries(seed);
    const output = zip.readZip(zip.writeZip(input));
    expect(new Map([...output].map(([name, entry]) => [name, entry.read()]))).toEqual(input);
  });
  it("reads independent stored and deflated vectors, including the known IEEE CRC-32 value", () => {
    const bytes = independentZip();
    const entries = zip.readZip(bytes);
    expect(entries.get("vector.txt").read().toString()).toBe("123456789");
    expect(entries.get("compress.txt").read().toString()).toBe("compress me\n".repeat(100));
    const written = simple();
    expect(written.readUInt32LE(14)).toBe(0xcbf43926);
  });
  it("writes archives accepted by independent unzip and recovers empty/unicode payloads", () => {
    const folder = workspace();
    const payload = zip.writeZip(
      new Map([
        ["empty", Buffer.alloc(0)],
        ["日本語 🚀.txt", Buffer.from("héllo")],
      ]),
    );
    fs.writeFileSync(path.join(folder, "output.zip"), payload);
    const result = spawnSync("unzip", ["-t", path.join(folder, "output.zip")], { encoding: "utf8", timeout: 10000 });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("No errors detected");
    expect(zip.readZip(payload).get("empty").read()).toEqual(Buffer.alloc(0));
    expect(zip.readZip(payload).get("日本語 🚀.txt").read().toString()).toBe("héllo");
  });
  it.each(["../escape", "/absolute", "a/./b", "a//b", "a\\b", "a:b", "a\nb", "a\u0000b", "a\u007fb"])("rejects unsafe name %j", (name) => {
    expect(() => zip.readZip(renamed(name))).toThrow("unsafe or duplicate");
  });
  it.each([
    ["encrypted", 8, 1, 6, 1, "encrypted or special"],
    ["symlink", 38, (0o120777 * 65536) >>> 0, null, null, "encrypted or special"],
    ["special device", 38, (0o020644 * 65536) >>> 0, null, null, "encrypted or special"],
    ["oversized", 24, 268435457, null, null, "size limit"],
    ["unsupported method", 10, 99, null, null, "unsupported encoding"],
    ["ZIP64", 20, 0xffffffff, null, null, "unsupported encoding"],
  ])("rejects %s members", (_label, centralField, value, localField, localValue, error) => {
    const bytes = simple();
    const central = bytes.readUInt32LE(bytes.length - 6);
    if (centralField === 38 || centralField === 24 || centralField === 20) bytes.writeUInt32LE(value, central + centralField);
    else bytes.writeUInt16LE(value, central + centralField);
    if (localField !== null) bytes.writeUInt16LE(localValue, localField);
    expect(() => zip.readZip(bytes)).toThrow(error);
  });
  it.each([0, 1, 21, 22, 29, 30, 40, 80])("rejects truncation at %s bytes", (length) => {
    expect(() => zip.readZip(simple().subarray(0, length))).toThrow();
  });
  it.each([41, 97, 203])("rejects deterministic CRC mutation seed=%i", (seed) => {
    const bytes = simple();
    bytes[38 + (seed % 9)] ^= 0x80;
    expect(() => zip.readZip(bytes).get("safe.txt").read()).toThrow("CRC verification failed");
  });
  it("rejects duplicate canonical names and overlapping local members", () => {
    const bytes = zip.writeZip(
      new Map([
        ["aa", Buffer.from("same")],
        ["bb", Buffer.from("same")],
      ]),
    );
    const central = bytes.readUInt32LE(bytes.length - 6);
    const second = central + 48;
    bytes.write("aa", 66);
    bytes.write("aa", second + 46);
    expect(() => zip.readZip(bytes)).toThrow("unsafe or duplicate");
    const overlap = zip.writeZip(
      new Map([
        ["aa", Buffer.from("same")],
        ["bb", Buffer.from("same")],
      ]),
    );
    overlap.writeUInt32LE(0, second + 42);
    expect(() => zip.readZip(overlap)).toThrow("bounds/name invalid");
  });
  it("rejects inconsistent local metadata, central bounds, and multidisk records", () => {
    const local = simple();
    local.writeUInt32LE(0, 14);
    expect(() => zip.readZip(local)).toThrow("sizes/CRC disagree");
    const bounds = simple();
    bounds.writeUInt32LE(0, bounds.length - 6);
    expect(() => zip.readZip(bounds)).toThrow("single-disk ZIP32");
    const disk = simple();
    disk.writeUInt16LE(1, disk.length - 18);
    expect(() => zip.readZip(disk)).toThrow("single-disk ZIP32");
  });
  it("bounds expansion when deflated size metadata lies", () => {
    const bytes = independentZip();
    let offset = bytes.readUInt32LE(bytes.length - 6);
    offset += 46 + bytes.readUInt16LE(offset + 28) + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42);
    bytes.writeUInt32LE(1, offset + 24);
    bytes.writeUInt32LE(1, local + 22);
    expect(() => zip.readZip(bytes).get("compress.txt").read()).toThrow();
  });
  it("supports data-descriptor archives and explicit directories", () => {
    const bytes = zip.writeZip(
      new Map([
        ["folder/", Buffer.alloc(0)],
        ["folder/file", Buffer.from("data")],
      ]),
    );
    const central = bytes.readUInt32LE(bytes.length - 6);
    bytes.writeUInt16LE(0x808, 6);
    bytes.writeUInt16LE(0x808, central + 8);
    expect(zip.readZip(bytes).get("folder/file").read().toString()).toBe("data");
  });
  it("rejects empty archives and invalid writer names", () => {
    expect(() => zip.writeZip(new Map())).toThrow("1 to 10000");
    expect(() => zip.writeZip(new Map([["../outside", Buffer.from("data")]]))).toThrow("unsafe");
  });
});

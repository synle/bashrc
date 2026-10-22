/** Bounded ZIP32 codec for Decky artifacts; supports stored/deflated members, never extraction or execution. */
const zlib = require("zlib");

/** ZIP resource ceilings shared by package and bundle validation. */
const LIMITS = { download: 256 * 1024 * 1024, member: 256 * 1024 * 1024, total: 1024 * 1024 * 1024, metadata: 1024 * 1024, members: 10000 };
/** ZIP32 record signatures and fixed header lengths from the ZIP format. */
const ZIP = { local: 0x04034b50, central: 0x02014b50, end: 0x06054b50, localSize: 30, centralSize: 46, endSize: 22, maxComment: 65535 };
/** Precomputed IEEE CRC-32 lookup table. */
const CRC_TABLE = Array.from({ length: 256 }, (_, byte) => {
  let value = byte;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});

/** Return unsigned IEEE CRC-32 for bytes (Buffer); no side effects. */
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ CRC_TABLE[(value ^ byte) & 255];
  return (value ^ 0xffffffff) >>> 0;
}

/** Reject unsafe member names/types, encryption, duplicates, or resource excesses; return void. */
function validateEntry(entry, seen, total) {
  const { name, size, mode, flags } = entry;
  const key = name.replace(/\/$/, "");
  if (!key || /[\\:\x00-\x1f\x7f]/.test(name) || key.split("/").some((part) => !part || part === "." || part === "..") || seen.has(key))
    throw new Error("ZIP has an unsafe or duplicate member");
  if (![0, 0o100000, 0o040000].includes(mode & 0o170000) || flags & 1) throw new Error("ZIP has an encrypted or special member");
  if (size > LIMITS.member || total + size > LIMITS.total) throw new Error("ZIP exceeds uncompressed size limit");
  seen.add(key);
}

/**
 * Parse and validate ZIP32 bytes (Buffer); return Map<string, {size:number, read:Function}>.
 * Throws Error/RangeError on malformed, unsafe, unsupported, or oversized archives.
 * Member reads verify actual length and CRC with bounded inflation; no filesystem writes.
 */
function readZip(bytes) {
  if (bytes.length > LIMITS.download) throw new Error("ZIP exceeds download limit");
  let end = bytes.length - ZIP.endSize;
  const minimum = Math.max(0, end - ZIP.maxComment);
  while (end >= minimum && !(bytes.readUInt32LE(end) === ZIP.end && end + ZIP.endSize + bytes.readUInt16LE(end + 20) === bytes.length))
    end--;
  if (end < minimum) throw new Error("ZIP end record missing");
  const count = bytes.readUInt16LE(end + 10);
  const centralSize = bytes.readUInt32LE(end + 12);
  const centralOffset = bytes.readUInt32LE(end + 16);
  if (
    bytes.readUInt16LE(end + 4) ||
    bytes.readUInt16LE(end + 6) ||
    bytes.readUInt16LE(end + 8) !== count ||
    !count ||
    count > LIMITS.members ||
    centralOffset + centralSize !== end
  )
    throw new Error("ZIP must be single-disk ZIP32 with 1 to 10000 members");
  const entries = new Map();
  const seen = new Set();
  let offset = centralOffset;
  let total = 0;
  const ranges = [];
  for (let index = 0; index < count; index++) {
    if (offset + ZIP.centralSize > end || bytes.readUInt32LE(offset) !== ZIP.central) throw new Error("ZIP central record invalid");
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const checksum = bytes.readUInt32LE(offset + 16);
    const compressed = bytes.readUInt32LE(offset + 20);
    const size = bytes.readUInt32LE(offset + 24);
    const nameSize = bytes.readUInt16LE(offset + 28);
    const extraSize = bytes.readUInt16LE(offset + 30);
    const commentSize = bytes.readUInt16LE(offset + 32);
    const mode = bytes.readUInt32LE(offset + 38) >>> 16;
    const local = bytes.readUInt32LE(offset + 42);
    const next = offset + ZIP.centralSize + nameSize + extraSize + commentSize;
    if (next > end || bytes.readUInt16LE(offset + 34) || ![0, 8].includes(method) || [size, compressed, local].includes(0xffffffff))
      throw new Error("ZIP record exceeds bounds or uses unsupported encoding");
    const nameBytes = bytes.subarray(offset + ZIP.centralSize, offset + ZIP.centralSize + nameSize);
    const name = nameBytes.toString("utf8");
    if (!Buffer.from(name, "utf8").equals(nameBytes)) throw new Error("ZIP member name must be UTF-8");
    validateEntry({ name, size, mode, flags }, seen, total);
    total += size;
    if (
      local + ZIP.localSize > centralOffset ||
      bytes.readUInt32LE(local) !== ZIP.local ||
      bytes.readUInt16LE(local + 6) !== flags ||
      bytes.readUInt16LE(local + 8) !== method
    )
      throw new Error("ZIP local record invalid");
    const localNameSize = bytes.readUInt16LE(local + 26);
    const start = local + ZIP.localSize + localNameSize + bytes.readUInt16LE(local + 28);
    const stop = start + compressed;
    if (
      stop > centralOffset ||
      localNameSize !== nameSize ||
      !bytes.subarray(local + ZIP.localSize, local + ZIP.localSize + localNameSize).equals(nameBytes)
    )
      throw new Error("ZIP local member bounds/name invalid");
    if (
      !(flags & 8) &&
      (bytes.readUInt32LE(local + 14) !== checksum ||
        bytes.readUInt32LE(local + 18) !== compressed ||
        bytes.readUInt32LE(local + 22) !== size)
    )
      throw new Error("ZIP local sizes/CRC disagree");
    ranges.push([local, stop]);
    entries.set(name, {
      size,
      mode,
      read() {
        const payload = bytes.subarray(start, stop);
        const result = method === 0 ? payload : zlib.inflateRawSync(payload, { maxOutputLength: Math.max(1, size) });
        if (result.length !== size || crc32(result) !== checksum) throw new Error("ZIP member length/CRC verification failed");
        return result;
      },
    });
    offset = next;
  }
  if (offset !== end) throw new Error("ZIP central size/count mismatch");
  ranges.sort((a, b) => a[0] - b[0]);
  if (ranges.some((range, index) => index > 0 && range[0] < ranges[index - 1][1])) throw new Error("ZIP members overlap");
  return entries;
}

/**
 * Encode entries (Map<string, Buffer>) as deterministic stored ZIP32 bytes (Buffer).
 * Throws for unsafe names, excess sizes/count, or non-buffer payloads; no side effects.
 */
function writeZip(entries) {
  if (!entries.size || entries.size > LIMITS.members) throw new Error("ZIP requires 1 to 10000 members");
  const chunks = [];
  const records = [];
  const seen = new Set();
  let offset = 0;
  let total = 0;
  for (const [name, payload] of entries) {
    validateEntry({ name, size: payload.length, mode: 0o100644, flags: 0 }, seen, total);
    total += payload.length;
    const filename = Buffer.from(name, "utf8");
    if (filename.length > 65535 || !Buffer.isBuffer(payload)) throw new Error("ZIP filename/payload invalid");
    const checksum = crc32(payload);
    const header = Buffer.alloc(ZIP.localSize);
    header.writeUInt32LE(ZIP.local, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(33, 12); // 1980-01-01, fixed for reproducible builds.
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(payload.length, 18);
    header.writeUInt32LE(payload.length, 22);
    header.writeUInt16LE(filename.length, 26);
    const record = Buffer.alloc(ZIP.centralSize);
    record.writeUInt32LE(ZIP.central, 0);
    record.writeUInt16LE(0x314, 4);
    record.writeUInt16LE(20, 6);
    header.copy(record, 8, 6, 28);
    record.writeUInt32LE((0o100644 * 65536) >>> 0, 38);
    record.writeUInt32LE(offset, 42);
    chunks.push(header, filename, payload);
    records.push(record, filename);
    offset += header.length + filename.length + payload.length;
  }
  const central = Buffer.concat(records);
  if (offset + central.length + ZIP.endSize > LIMITS.download) throw new Error("ZIP exceeds download limit");
  const end = Buffer.alloc(ZIP.endSize);
  end.writeUInt32LE(ZIP.end, 0);
  end.writeUInt16LE(entries.size, 8);
  end.writeUInt16LE(entries.size, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, central, end]);
}

module.exports = { LIMITS, readZip, writeZip };

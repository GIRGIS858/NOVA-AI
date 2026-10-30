import {
  SOURCE_LIMITS,
  SourceVersionError,
  validateSourcePath,
  type SourceFile,
} from "./versions";

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++)
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Export text as a bounded ZIP in memory. Never extracts or executes source. */
export function buildSourceZip(files: SourceFile[]): Buffer {
  if (!Array.isArray(files))
    throw new SourceVersionError("INVALID_CHANGE", "Expected source files.");
  if (files.length > SOURCE_LIMITS.files)
    throw new SourceVersionError("LIMIT", "Too many source files.");
  const names = new Set<string>();
  let total = 0;
  const entries = files.map((file) => {
    if (
      !file ||
      typeof file.path !== "string" ||
      typeof file.content !== "string"
    )
      throw new SourceVersionError(
        "INVALID_CHANGE",
        "Expected text source files.",
      );
    try {
      validateSourcePath(file.path);
    } catch {
      throw new SourceVersionError(
        "INVALID_PATH",
        "Invalid archive source path.",
      );
    }
    const canonical = file.path.toLowerCase();
    if (names.has(canonical))
      throw new SourceVersionError("INVALID_CHANGE", "Duplicate archive path.");
    names.add(canonical);
    if (file.content.includes("\0"))
      throw new SourceVersionError(
        "INVALID_CHANGE",
        "Only text source files are supported.",
      );
    const content = Buffer.from(file.content, "utf8");
    total += content.length;
    if (
      content.length > SOURCE_LIMITS.fileBytes ||
      total > SOURCE_LIMITS.totalBytes
    )
      throw new SourceVersionError(
        "LIMIT",
        "Source archive exceeds size limits.",
      );
    return { path: file.path, name: Buffer.from(file.path, "utf8"), content };
  });
  for (const canonical of names) {
    const parts = canonical.split("/");
    for (let index = 1; index < parts.length; index++) {
      if (names.has(parts.slice(0, index).join("/")))
        throw new SourceVersionError(
          "INVALID_PATH",
          "File and directory paths conflict.",
        );
    }
  }
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const checksum = crc32(entry.content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // ZIP 2.0; no ZIP64 needed for bounded snapshots.
    local.writeUInt16LE(0x0800, 6); // UTF-8 names.
    local.writeUInt16LE(0, 8); // Stored, not compressed.
    local.writeUInt16LE(0x0021, 12); // Stable DOS date: 1980-01-01.
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(entry.content.length, 18);
    local.writeUInt32LE(entry.content.length, 22);
    local.writeUInt16LE(entry.name.length, 26);
    localParts.push(local, entry.name, entry.content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4); // Unix metadata; always a regular file.
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(entry.content.length, 20);
    central.writeUInt32LE(entry.content.length, 24);
    central.writeUInt16LE(entry.name.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, entry.name);
    offset += local.length + entry.name.length + entry.content.length;
  }
  const centralSize = centralParts.reduce(
    (bytes, part) => bytes + part.length,
    0,
  );
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

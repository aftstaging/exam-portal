import { deflateRawSync } from "zlib";

export type ZipEntry = { name: string; data: Buffer };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value & 0xffff, 0);
  return buffer;
}

function u32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

function dosDateTime(date: Date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = (date.getFullYear() - 1980) << 9 | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/**
 * Build a ZIP archive in memory (no external dependency). Files are DEFLATE
 * compressed (level 6). Returns the complete ZIP archive buffer.
 */
export function buildZipBuffer(entries: ZipEntry[]): Buffer {
  const { time, day } = dosDateTime(new Date());
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, "utf-8");
    const compressed = deflateRawSync(entry.data, { level: 6 });
    const checksum = crc32(entry.data);

    localParts.push(
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(8),
      u16(time),
      u16(day),
      u32(checksum),
      u32(compressed.length),
      u32(entry.data.length),
      u16(nameBuffer.length),
      u16(0),
      nameBuffer,
      compressed,
    );

    centralParts.push(
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(8),
      u16(time),
      u16(day),
      u32(checksum),
      u32(compressed.length),
      u32(entry.data.length),
      u16(nameBuffer.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBuffer,
    );

    offset += 30 + nameBuffer.length + compressed.length;
  }

  const local = Buffer.concat(localParts);
  const central = Buffer.concat(centralParts);
  const centralOffset = local.length;

  const eocd = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(central.length),
    u32(centralOffset),
    u16(0),
  ]);

  return Buffer.concat([local, central, eocd]);
}

/** Sanitize a ZIP entry name so it has no path separators. */
export function sanitizeZipName(name: string): string {
  const cleaned = name.replace(/[\\/]/g, "-").replace(/[^\w .()-]/g, "_").trim();
  return cleaned || "attachment";
}
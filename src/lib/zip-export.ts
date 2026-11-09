// ── Zero-dependency PKZIP Store (Uncompressed) Archive Creator ──
// Standard PKZIP 2.0 format compatible with all operating systems and unzip utilities.
// Uncompressed store mode is optimal for audio stems (WAV files are already PCM binary).

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

/** Compute standard 32-bit cyclic redundancy check (CRC-32) */
export function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Create a standard uncompressed PKZIP file containing the provided entries. */
export function createZipArchive(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const fileRecords: {
    nameBytes: Uint8Array;
    data: Uint8Array;
    crc: number;
    localHeaderOffset: number;
  }[] = [];

  let totalSize = 0;

  // 1. Calculate size and offsets for local headers and file data
  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const localHeaderOffset = totalSize;
    // Local header: 30 bytes + nameBytes.length + data.length
    totalSize += 30 + nameBytes.length + entry.data.length;
    fileRecords.push({
      nameBytes,
      data: entry.data,
      crc,
      localHeaderOffset,
    });
  }

  const centralDirectoryOffset = totalSize;

  // 2. Calculate size of central directory
  let centralDirectorySize = 0;
  for (const record of fileRecords) {
    // Central directory header: 46 bytes + nameBytes.length
    centralDirectorySize += 46 + record.nameBytes.length;
  }

  totalSize += centralDirectorySize;

  // 3. End of Central Directory record: 22 bytes
  totalSize += 22;

  // Allocate total buffer
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  let pos = 0;

  // 4. Write Local File Headers + File Data
  for (const record of fileRecords) {
    // Signature: 0x04034b50 ("PK\x03\x04")
    view.setUint32(pos, 0x04034b50, true);
    view.setUint16(pos + 4, 20, true); // Version needed to extract (2.0)
    view.setUint16(pos + 6, 0x0800, true); // Flags: bit 11 = UTF-8 filename
    view.setUint16(pos + 8, 0, true); // Compression method: 0 = Store (no compression)
    view.setUint16(pos + 10, 0x0000, true); // Last mod time
    view.setUint16(pos + 12, 0x0021, true); // Last mod date (1980-01-01)
    view.setUint32(pos + 14, record.crc, true); // CRC-32
    view.setUint32(pos + 18, record.data.length, true); // Compressed size
    view.setUint32(pos + 22, record.data.length, true); // Uncompressed size
    view.setUint16(pos + 26, record.nameBytes.length, true); // Filename length
    view.setUint16(pos + 28, 0, true); // Extra field length
    pos += 30;

    out.set(record.nameBytes, pos);
    pos += record.nameBytes.length;

    out.set(record.data, pos);
    pos += record.data.length;
  }

  // 5. Write Central Directory Headers
  for (const record of fileRecords) {
    // Signature: 0x02014b50 ("PK\x01\x02")
    view.setUint32(pos, 0x02014b50, true);
    view.setUint16(pos + 4, 20, true); // Version made by (2.0)
    view.setUint16(pos + 6, 20, true); // Version needed (2.0)
    view.setUint16(pos + 8, 0x0800, true); // Flags: UTF-8
    view.setUint16(pos + 10, 0, true); // Compression: Store
    view.setUint16(pos + 12, 0x0000, true); // Mod time
    view.setUint16(pos + 14, 0x0021, true); // Mod date
    view.setUint32(pos + 16, record.crc, true); // CRC-32
    view.setUint32(pos + 20, record.data.length, true); // Compressed size
    view.setUint32(pos + 24, record.data.length, true); // Uncompressed size
    view.setUint16(pos + 28, record.nameBytes.length, true); // Filename length
    view.setUint16(pos + 30, 0, true); // Extra field length
    view.setUint16(pos + 32, 0, true); // Comment length
    view.setUint16(pos + 34, 0, true); // Disk start number
    view.setUint16(pos + 36, 0, true); // Internal attributes
    view.setUint32(pos + 38, 0, true); // External attributes
    view.setUint32(pos + 42, record.localHeaderOffset, true); // Offset of local header
    pos += 46;

    out.set(record.nameBytes, pos);
    pos += record.nameBytes.length;
  }

  // 6. Write End of Central Directory (EOCD) Record
  // Signature: 0x06054b50 ("PK\x05\x06")
  view.setUint32(pos, 0x06054b50, true);
  view.setUint16(pos + 4, 0, true); // Disk number
  view.setUint16(pos + 6, 0, true); // Start disk
  view.setUint16(pos + 8, fileRecords.length, true); // Entries on this disk
  view.setUint16(pos + 10, fileRecords.length, true); // Total entries
  view.setUint32(pos + 12, centralDirectorySize, true); // Size of central directory
  view.setUint32(pos + 16, centralDirectoryOffset, true); // Offset of central directory
  view.setUint16(pos + 20, 0, true); // Comment length

  return out;
}

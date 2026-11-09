// ── Pure TypeScript ID3v2.3 & ID3v2.4 Tag Encoder & Parser ──
// Zero external dependencies. Browser & Node.js compatible.
// Supports standard frames: TIT2 (Title), TPE1 (Artist), TALB (Album),
// TYER/TDRC (Year/Date), TCON (Genre), COMM (Comments).
// Implements syncsafe integer encoding/decoding and MPEG stream alignment.

export type Id3Version = "2.3" | "2.4";

export interface Id3TagMetadata {
  title?: string | undefined;
  artist?: string | undefined;
  album?: string | undefined;
  year?: string | number | undefined;
  genre?: string | undefined;
  comment?: string | undefined;
}

export interface Id3TagOptions {
  version?: Id3Version | undefined;
  paddingBytes?: number | undefined;
}

export interface ParsedId3Tag {
  version: Id3Version;
  revision: number;
  flags: number;
  tagSize: number;
  totalHeaderSize: number;
  metadata: Id3TagMetadata;
  rawFrames: Record<string, string>;
}

/** Encode an integer (0 to 268,435,455) into a 4-byte syncsafe integer where bit 7 of each byte is 0. */
export function encodeSyncsafe(value: number): Uint8Array {
  const n = Math.max(0, Math.min(0x0fffffff, Math.floor(Number.isFinite(value) ? value : 0)));
  return new Uint8Array([
    (n >>> 21) & 0x7f,
    (n >>> 14) & 0x7f,
    (n >>> 7) & 0x7f,
    n & 0x7f,
  ]);
}

/** Decode a 4-byte syncsafe integer into a standard unsigned 28-bit integer. */
export function decodeSyncsafe(
  b0: number,
  b1: number,
  b2: number,
  b3: number
): number {
  return (
    ((b0 & 0x7f) << 21) |
    ((b1 & 0x7f) << 14) |
    ((b2 & 0x7f) << 7) |
    (b3 & 0x7f)
  );
}

/** Helper to decode syncsafe integer from a Uint8Array at a given offset. */
export function decodeSyncsafeBytes(bytes: Uint8Array, offset = 0): number {
  if (offset + 4 > bytes.length) return 0;
  return decodeSyncsafe(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3]
  );
}

/** Encode standard 32-bit big-endian unsigned integer (used for ID3v2.3 frame size). */
function encodeUint32BE(value: number): Uint8Array {
  const n = Math.max(0, Math.min(0xffffffff, Math.floor(Number.isFinite(value) ? value : 0)));
  return new Uint8Array([
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ]);
}

/** Decode standard 32-bit big-endian unsigned integer. */
function decodeUint32BE(bytes: Uint8Array, offset = 0): number {
  if (offset + 4 > bytes.length) return 0;
  return (
    ((bytes[offset] << 24) >>> 0) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  );
}

/** Checks whether a string contains characters beyond Latin-1 range (> 255). */
function isAsciiOrLatin1(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 255) return false;
  }
  return true;
}

/** Encode a string to Latin-1 bytes. */
function encodeLatin1(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    out[i] = text.charCodeAt(i) & 0xff;
  }
  return out;
}

/** Encode a string to UTF-16LE with BOM (Byte Order Mark: 0xFF, 0xFE). */
function encodeUtf16LE(text: string): Uint8Array {
  const out = new Uint8Array(2 + text.length * 2);
  out[0] = 0xff; // BOM Little Endian
  out[1] = 0xfe;
  let offset = 2;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    out[offset] = code & 0xff;
    out[offset + 1] = (code >>> 8) & 0xff;
    offset += 2;
  }
  return out;
}

/** Encode a text payload frame (e.g. TIT2, TPE1, TALB, TYER/TDRC, TCON). */
export function encodeTextFrame(
  frameId: string,
  text: string,
  version: Id3Version
): Uint8Array {
  if (frameId.length !== 4) {
    throw new Error(`Invalid ID3 frame ID: "${frameId}" (must be exactly 4 ASCII characters)`);
  }

  let encodingByte: number;
  let textBytes: Uint8Array;

  if (version === "2.4") {
    // ID3v2.4 natively supports UTF-8 (encoding byte 0x03)
    encodingByte = 0x03;
    textBytes = new TextEncoder().encode(text);
  } else {
    // ID3v2.3: use ISO-8859-1 (0x00) if pure ASCII/Latin-1, else UTF-16LE with BOM (0x01)
    if (isAsciiOrLatin1(text)) {
      encodingByte = 0x00;
      textBytes = encodeLatin1(text);
    } else {
      encodingByte = 0x01;
      textBytes = encodeUtf16LE(text);
    }
  }

  // Frame payload = [EncodingByte, ...TextBytes]
  const payload = new Uint8Array(1 + textBytes.length);
  payload[0] = encodingByte;
  payload.set(textBytes, 1);

  // 10-byte Frame Header: [0..3 ID, 4..7 Size, 8..9 Flags]
  const frameHeader = new Uint8Array(10);
  for (let i = 0; i < 4; i++) {
    frameHeader[i] = frameId.charCodeAt(i) & 0xff;
  }

  // Size field: Syncsafe in ID3v2.4; standard 32-bit BE in ID3v2.3
  const sizeBytes = version === "2.4"
    ? encodeSyncsafe(payload.length)
    : encodeUint32BE(payload.length);
  frameHeader.set(sizeBytes, 4);

  // Frame flags: 0x00, 0x00
  frameHeader[8] = 0x00;
  frameHeader[9] = 0x00;

  const fullFrame = new Uint8Array(10 + payload.length);
  fullFrame.set(frameHeader, 0);
  fullFrame.set(payload, 10);
  return fullFrame;
}

/** Encode a COMM (Comment) frame. */
export function encodeCommentFrame(
  comment: string,
  language = "eng",
  version: Id3Version = "2.3"
): Uint8Array {
  const lang = (language + "eng").slice(0, 3).toLowerCase();
  let encodingByte: number;
  let descNullBytes: Uint8Array;
  let commentBytes: Uint8Array;

  if (version === "2.4") {
    encodingByte = 0x03; // UTF-8
    descNullBytes = new Uint8Array([0x00]); // empty short description null terminator
    commentBytes = new TextEncoder().encode(comment);
  } else {
    if (isAsciiOrLatin1(comment)) {
      encodingByte = 0x00; // ISO-8859-1
      descNullBytes = new Uint8Array([0x00]);
      commentBytes = encodeLatin1(comment);
    } else {
      encodingByte = 0x01; // UTF-16LE
      descNullBytes = new Uint8Array([0x00, 0x00]); // 2-byte null terminator for UTF-16
      commentBytes = encodeUtf16LE(comment);
    }
  }

  // Payload = [Encoding(1), Lang(3), DescNull(1 or 2), CommentBytes]
  const payloadLength = 1 + 3 + descNullBytes.length + commentBytes.length;
  const payload = new Uint8Array(payloadLength);
  payload[0] = encodingByte;
  payload[1] = lang.charCodeAt(0) & 0xff;
  payload[2] = lang.charCodeAt(1) & 0xff;
  payload[3] = lang.charCodeAt(2) & 0xff;
  payload.set(descNullBytes, 4);
  payload.set(commentBytes, 4 + descNullBytes.length);

  const frameHeader = new Uint8Array(10);
  frameHeader[0] = 0x43; // 'C'
  frameHeader[1] = 0x4f; // 'O'
  frameHeader[2] = 0x4d; // 'M'
  frameHeader[3] = 0x4d; // 'M'

  const sizeBytes = version === "2.4"
    ? encodeSyncsafe(payload.length)
    : encodeUint32BE(payload.length);
  frameHeader.set(sizeBytes, 4);
  frameHeader[8] = 0x00;
  frameHeader[9] = 0x00;

  const fullFrame = new Uint8Array(10 + payload.length);
  fullFrame.set(frameHeader, 0);
  fullFrame.set(payload, 10);
  return fullFrame;
}

/** Construct a complete ID3v2 binary tag header and payload. */
export function buildId3v2Tag(
  metadata: Id3TagMetadata,
  options?: Id3TagOptions
): Uint8Array {
  const version: Id3Version = options?.version ?? "2.3";
  const paddingBytes = Math.max(0, options?.paddingBytes ?? 0);

  const frames: Uint8Array[] = [];

  // Title: TIT2
  if (metadata.title && metadata.title.trim().length > 0) {
    frames.push(encodeTextFrame("TIT2", metadata.title.trim(), version));
  }

  // Lead Artist / Performer: TPE1
  if (metadata.artist && metadata.artist.trim().length > 0) {
    frames.push(encodeTextFrame("TPE1", metadata.artist.trim(), version));
  }

  // Album: TALB
  if (metadata.album && metadata.album.trim().length > 0) {
    frames.push(encodeTextFrame("TALB", metadata.album.trim(), version));
  }

  // Year: TYER in v2.3, TDRC in v2.4
  if (metadata.year !== undefined && String(metadata.year).trim().length > 0) {
    const yearStr = String(metadata.year).trim();
    const frameId = version === "2.4" ? "TDRC" : "TYER";
    frames.push(encodeTextFrame(frameId, yearStr, version));
  }

  // Genre: TCON
  if (metadata.genre && metadata.genre.trim().length > 0) {
    frames.push(encodeTextFrame("TCON", metadata.genre.trim(), version));
  }

  // Comment: COMM
  if (metadata.comment && metadata.comment.trim().length > 0) {
    frames.push(encodeCommentFrame(metadata.comment.trim(), "eng", version));
  }

  const framesTotalSize = frames.reduce((acc, f) => acc + f.length, 0);
  const totalPayloadSize = framesTotalSize + paddingBytes;

  // 10-byte ID3 Header
  const header = new Uint8Array(10);
  header[0] = 0x49; // 'I'
  header[1] = 0x44; // 'D'
  header[2] = 0x33; // '3'
  header[3] = version === "2.4" ? 0x04 : 0x03; // Major version
  header[4] = 0x00; // Revision
  header[5] = 0x00; // Flags

  // Bytes 6..9: Tag size (always syncsafe in both v2.3 and v2.4)
  const syncsafeSize = encodeSyncsafe(totalPayloadSize);
  header.set(syncsafeSize, 6);

  const fullTag = new Uint8Array(10 + totalPayloadSize);
  fullTag.set(header, 0);

  let offset = 10;
  for (const frame of frames) {
    fullTag.set(frame, offset);
    offset += frame.length;
  }
  // Any remaining bytes stay zero (standard ID3 padding)

  return fullTag;
}

/** Decode frame text payload given encoding byte. */
function decodeFrameText(bytes: Uint8Array, encoding: number): string {
  if (bytes.length === 0) return "";

  if (encoding === 0x00) {
    // ISO-8859-1 / Latin-1
    let str = "";
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) break; // null terminator
      str += String.fromCharCode(bytes[i]);
    }
    return str;
  }

  if (encoding === 0x03) {
    // UTF-8
    // Strip trailing null bytes
    let end = bytes.length;
    while (end > 0 && bytes[end - 1] === 0) end--;
    return new TextDecoder("utf-8").decode(bytes.subarray(0, end));
  }

  if (encoding === 0x01 || encoding === 0x02) {
    // UTF-16
    let offset = 0;
    let isLittleEndian = true;
    if (bytes.length >= 2) {
      if (bytes[0] === 0xfe && bytes[1] === 0xff) {
        isLittleEndian = false;
        offset = 2;
      } else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
        isLittleEndian = true;
        offset = 2;
      }
    }
    if (encoding === 0x02) isLittleEndian = false;

    let str = "";
    for (let i = offset; i + 1 < bytes.length; i += 2) {
      const code = isLittleEndian
        ? bytes[i] | (bytes[i + 1] << 8)
        : (bytes[i] << 8) | bytes[i + 1];
      if (code === 0) break; // UTF-16 null terminator
      str += String.fromCharCode(code);
    }
    return str;
  }

  // Fallback UTF-8
  return new TextDecoder("utf-8").decode(bytes);
}

/** Parse and inspect an ID3v2 tag buffer, extracting all frames and metadata. */
export function parseId3v2(data: Uint8Array | ArrayBuffer): ParsedId3Tag | null {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length < 10) return null;

  // Check magic 'ID3'
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return null;
  }

  const major = bytes[3];
  const revision = bytes[4];
  const flags = bytes[5];
  if (major !== 3 && major !== 4) {
    return null;
  }

  const version: Id3Version = major === 4 ? "2.4" : "2.3";
  const tagSize = decodeSyncsafeBytes(bytes, 6);
  const totalHeaderSize = 10 + tagSize;

  const rawFrames: Record<string, string> = {};
  const metadata: Id3TagMetadata = {};

  let offset = 10;
  const tagEnd = Math.min(bytes.length, 10 + tagSize);

  while (offset + 10 <= tagEnd) {
    // If we hit padding (0x00 byte for frame ID), we are in the padding area
    if (bytes[offset] === 0x00) break;

    const frameId = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );

    // Frame size: syncsafe in v2.4, standard 32-bit BE in v2.3
    const frameSize = version === "2.4"
      ? decodeSyncsafeBytes(bytes, offset + 4)
      : decodeUint32BE(bytes, offset + 4);

    if (frameSize <= 0 || offset + 10 + frameSize > tagEnd) {
      break;
    }

    const payload = bytes.subarray(offset + 10, offset + 10 + frameSize);

    if (frameId.startsWith("T") && payload.length > 0) {
      // Text information frame
      const encoding = payload[0];
      const text = decodeFrameText(payload.subarray(1), encoding);
      rawFrames[frameId] = text;

      if (frameId === "TIT2") metadata.title = text;
      else if (frameId === "TPE1") metadata.artist = text;
      else if (frameId === "TALB") metadata.album = text;
      else if (frameId === "TYER" || frameId === "TDRC") metadata.year = text;
      else if (frameId === "TCON") metadata.genre = text;
    } else if (frameId === "COMM" && payload.length >= 4) {
      // Comment frame: [Encoding(1), Lang(3), Desc...Null, Text]
      const encoding = payload[0];
      let p = 4;
      if (encoding === 0x01 || encoding === 0x02) {
        // UTF-16 null terminator is 2 consecutive zero bytes
        while (p + 1 < payload.length && (payload[p] !== 0 || payload[p + 1] !== 0)) {
          p += 2;
        }
        p += 2;
      } else {
        // 1-byte null terminator
        while (p < payload.length && payload[p] !== 0) {
          p++;
        }
        p++;
      }
      const commentText = decodeFrameText(payload.subarray(p), encoding);
      rawFrames["COMM"] = commentText;
      metadata.comment = commentText;
    }

    offset += 10 + frameSize;
  }

  return {
    version,
    revision,
    flags,
    tagSize,
    totalHeaderSize,
    metadata,
    rawFrames,
  };
}

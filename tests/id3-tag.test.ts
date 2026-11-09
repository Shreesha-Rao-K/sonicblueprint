// Unit tests: pure TypeScript ID3v2.3 and ID3v2.4 encoder, parser, and syncsafe arithmetic.
import { suite, test, eq, ok } from "./helpers";
import {
  encodeSyncsafe,
  decodeSyncsafe,
  decodeSyncsafeBytes,
  encodeTextFrame,
  encodeCommentFrame,
  buildId3v2Tag,
  parseId3v2,
  type Id3TagMetadata,
} from "@/lib/id3-tag";

suite("ID3 syncsafe integer encoding and decoding");

test("syncsafe integers maintain bit 7 as 0 on every byte", () => {
  const testValues = [0, 1, 127, 128, 255, 256, 16383, 16384, 65535, 1000000, 0x0fffffff];
  for (const v of testValues) {
    const encoded = encodeSyncsafe(v);
    eq(encoded.length, 4, `4 bytes for value ${v}`);
    for (let i = 0; i < 4; i++) {
      eq(encoded[i] & 0x80, 0, `bit 7 is 0 on byte ${i} for ${v}`);
    }
    const decoded = decodeSyncsafe(encoded[0], encoded[1], encoded[2], encoded[3]);
    eq(decoded, v, `roundtrip exact for value ${v}`);
  }
});

test("decodeSyncsafeBytes decodes at arbitrary buffer offsets", () => {
  const buf = new Uint8Array([0xaa, 0xbb, 0x00, 0x00, 0x02, 0x01, 0xcc]);
  // offset 2: bytes [0x00, 0x00, 0x02, 0x01] -> (2 << 7) | 1 = 257
  const val = decodeSyncsafeBytes(buf, 2);
  eq(val, 257);
});

test("guards against non-finite or negative values safely", () => {
  eq(decodeSyncsafeBytes(encodeSyncsafe(-50)), 0);
  eq(decodeSyncsafeBytes(encodeSyncsafe(NaN)), 0);
  eq(decodeSyncsafeBytes(encodeSyncsafe(Infinity)), 0);
});

suite("ID3v2.3 and ID3v2.4 frame generation");

test("encodeTextFrame generates valid frame header and payload for ID3v2.3 (Latin-1)", () => {
  const frame = encodeTextFrame("TIT2", "Midnight Drive", "2.3");
  // 10-byte header: "TIT2" (4), size (4), flags (2)
  eq(String.fromCharCode(...frame.subarray(0, 4)), "TIT2");
  // Payload: encoding byte 0x00 (Latin-1) + 14 chars = 15 bytes
  eq(frame[10], 0x00, "encoding byte is 0 for Latin-1");
  eq(String.fromCharCode(...frame.subarray(11)), "Midnight Drive");
});

test("encodeTextFrame encodes UTF-16LE with BOM for non-Latin characters in ID3v2.3", () => {
  const frame = encodeTextFrame("TIT2", "夜のドライブ 🎵", "2.3");
  eq(String.fromCharCode(...frame.subarray(0, 4)), "TIT2");
  eq(frame[10], 0x01, "encoding byte is 1 for UTF-16 with BOM");
  eq(frame[11], 0xff, "BOM LE byte 0");
  eq(frame[12], 0xfe, "BOM LE byte 1");
});

test("encodeTextFrame uses UTF-8 (encoding 0x03) natively in ID3v2.4", () => {
  const frame = encodeTextFrame("TIT2", "Cyber Synth 🎵", "2.4");
  eq(frame[10], 0x03, "encoding byte is 3 for UTF-8");
  const decoded = new TextDecoder("utf-8").decode(frame.subarray(11));
  eq(decoded, "Cyber Synth 🎵");
});

test("encodeCommentFrame generates valid COMM frame with language and description", () => {
  const comm = encodeCommentFrame("Created with SonicBlueprint DAW", "eng", "2.3");
  eq(String.fromCharCode(...comm.subarray(0, 4)), "COMM");
  // Payload starts at byte 10: encoding(1), lang(3), descNull(1), text
  eq(String.fromCharCode(...comm.subarray(11, 14)), "eng");
});

suite("Full ID3v2 Tag Builder & Round-Trip Parser");

test("buildId3v2Tag creates valid 10-byte ID3v2.3 header and syncsafe tag size", () => {
  const meta: Id3TagMetadata = {
    title: "Neon Horizon",
    artist: "Sonic Wave",
    album: "Blueprint Sessions Vol. 1",
    year: "2026",
    genre: "Synthwave",
    comment: "Mastered in SonicBlueprint",
  };

  const tag = buildId3v2Tag(meta, { version: "2.3" });
  eq(tag[0], 0x49); // 'I'
  eq(tag[1], 0x44); // 'D'
  eq(tag[2], 0x33); // '3'
  eq(tag[3], 0x03); // v2.3
  eq(tag[4], 0x00); // rev 0
  eq(tag[5], 0x00); // flags

  const tagPayloadSize = decodeSyncsafeBytes(tag, 6);
  eq(tag.length, 10 + tagPayloadSize);

  // Parse tag and verify round-trip
  const parsed = parseId3v2(tag);
  ok(parsed !== null, "parsed successfully");
  eq(parsed!.version, "2.3");
  eq(parsed!.metadata.title, "Neon Horizon");
  eq(parsed!.metadata.artist, "Sonic Wave");
  eq(parsed!.metadata.album, "Blueprint Sessions Vol. 1");
  eq(parsed!.metadata.year, "2026");
  eq(parsed!.metadata.genre, "Synthwave");
  eq(parsed!.metadata.comment, "Mastered in SonicBlueprint");
});

test("buildId3v2Tag creates valid ID3v2.4 tag with TDRC frame", () => {
  const meta: Id3TagMetadata = {
    title: "Quantum Drift",
    artist: "Aria Fox",
    year: "2026-11-08",
  };

  const tag = buildId3v2Tag(meta, { version: "2.4" });
  eq(tag[3], 0x04, "v2.4 major version");

  const parsed = parseId3v2(tag);
  ok(parsed !== null, "parsed successfully");
  eq(parsed!.version, "2.4");
  eq(parsed!.metadata.title, "Quantum Drift");
  eq(parsed!.metadata.artist, "Aria Fox");
  eq(parsed!.metadata.year, "2026-11-08");
  ok(parsed!.rawFrames["TDRC"] !== undefined, "TDRC frame used for year in v2.4");
});

test("supports optional padding bytes without corrupting frame parsing", () => {
  const meta: Id3TagMetadata = {
    title: "Padded Track",
    artist: "Test",
  };
  const paddingBytes = 128;
  const tag = buildId3v2Tag(meta, { version: "2.3", paddingBytes });

  const parsed = parseId3v2(tag);
  ok(parsed !== null);
  eq(parsed!.metadata.title, "Padded Track");
  eq(parsed!.metadata.artist, "Test");
});

test("parseId3v2 gracefully returns null on non-ID3 or truncated buffers", () => {
  eq(parseId3v2(new Uint8Array([0x00, 0x00, 0x00])), null);
  eq(parseId3v2(new Uint8Array(20)), null);
  eq(parseId3v2(new TextEncoder().encode("NOT_AN_ID3_TAG_HEADER")), null);
});

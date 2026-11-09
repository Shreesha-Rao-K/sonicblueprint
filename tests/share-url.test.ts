// Unit tests: URL-based portable project sharing (compression, decompression, safety).
import { suite, test, eq, ok } from "./helpers";
import {
  compressProject,
  decompressProject,
  createShareUrl,
  extractPayloadFromUrl,
  uint8ArrayToBase64Url,
  base64UrlToUint8Array,
} from "@/lib/share-url";
import { createProject } from "@/lib/project-schema";

suite("base64url codec");

test("base64url roundtrip preserves raw bytes exactly", () => {
  const bytes = new Uint8Array([0, 1, 2, 255, 128, 64, 32, 16, 8, 4, 2, 1]);
  const encoded = uint8ArrayToBase64Url(bytes);
  ok(!encoded.includes("+"), "no + in base64url");
  ok(!encoded.includes("/"), "no / in base64url");
  ok(!encoded.includes("="), "no = padding in base64url");
  const decoded = base64UrlToUint8Array(encoded);
  eq(Array.from(decoded), Array.from(bytes));
});

suite("project compression and sharing roundtrip");

test("project compresses and decompresses with musical parity", async () => {
  const original = createProject("Share Test Song");
  original.config.bpm = 136;
  original.config.keyTonic = "Eb";
  original.config.scale = "dorian";
  original.chords.voicing = "firstInversion";
  if (original.effects) {
    original.effects.reverb.enabled = true;
    original.effects.reverb.mix = 0.45;
  }

  const payload = await compressProject(original);
  ok(typeof payload === "string" && payload.length > 50, "payload is non-trivial string");
  ok(payload.length < 2500, `payload length is compact (${payload.length} chars)`);

  const restored = await decompressProject(payload);
  eq(restored.meta.name, original.meta.name);
  eq(restored.config.bpm, 136);
  eq(restored.config.keyTonic, "Eb");
  eq(restored.config.scale, "dorian");
  eq(restored.chords.voicing, "firstInversion");
  eq(restored.effects?.reverb.enabled, true);
  eq(restored.effects?.reverb.mix, 0.45);
  // Fresh ID assigned to prevent local collision
  ok(restored.meta.id !== original.meta.id, "fresh project ID is assigned");
});

test("url extraction parses hash and query parameters", () => {
  const dummy = "abc123payload";
  eq(extractPayloadFromUrl(`https://sonicblueprint.app/studio/share#data=${dummy}`), dummy);
  eq(extractPayloadFromUrl(`https://sonicblueprint.app/studio/share#share=${dummy}`), dummy);
  eq(extractPayloadFromUrl(`https://sonicblueprint.app/dashboard?data=${dummy}`), dummy);
  eq(extractPayloadFromUrl(`https://sonicblueprint.app/dashboard?share=${dummy}`), dummy);
  eq(extractPayloadFromUrl(`https://sonicblueprint.app/dashboard`), null);
  eq(extractPayloadFromUrl(""), null);
});

test("createShareUrl constructs valid studio link", async () => {
  const p = createProject("Link Song");
  const url = await createShareUrl(p, "https://sonicblueprint.example.com");
  ok(url.startsWith("https://sonicblueprint.example.com/studio/share#data="));
  const payload = extractPayloadFromUrl(url);
  ok(payload !== null, "payload extractable");
  const restored = await decompressProject(payload!);
  eq(restored.meta.name, "Link Song");
});

suite("share safety and error handling");

test("oversized payload strings are rejected immediately", async () => {
  const huge = "A".repeat(40000);
  let failed = false;
  try {
    await decompressProject(huge);
  } catch (e) {
    failed = true;
    ok(String(e).includes("exceeds maximum safe length"));
  }
  ok(failed, "huge payload throws error");
});

test("corrupted base64 or gzip payloads throw friendly error", async () => {
  let failed = false;
  try {
    await decompressProject("invalid_not_gzipped_data");
  } catch (e) {
    failed = true;
    ok(String(e).includes("corrupted") || String(e).includes("Failed"));
  }
  ok(failed, "corrupted payload throws error");
});

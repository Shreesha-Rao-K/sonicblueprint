// Unit tests: multi-track stem export, ZIP packaging, alignment, and layer isolation.
import { suite, test, eq, ok, approx } from "./helpers";
import { crc32, createZipArchive } from "@/lib/zip-export";
import {
  STEM_LAYERS,
  exportStemsZip,
  renderAllStems,
  stemWavFilename,
  stemZipFilename,
} from "@/lib/stem-export";
import { parseWav } from "@/lib/wav-export";
import { createProject } from "@/lib/project-schema";

suite("CRC-32 and PKZIP archive generation");

test("computes accurate CRC-32 for standard test vectors", () => {
  // Empty buffer CRC-32 is 0x00000000
  eq(crc32(new Uint8Array(0)), 0);

  // Standard ASCII vector "123456789" -> 0xcbf43926
  const v1 = new TextEncoder().encode("123456789");
  eq(crc32(v1), 0xcbf43926);
});

test("createZipArchive generates valid PKZIP structure with local and central headers", () => {
  const enc = new TextEncoder();
  const file1 = { name: "test1.txt", data: enc.encode("Hello World!") };
  const file2 = { name: "test2.bin", data: new Uint8Array([1, 2, 3, 4, 5]) };

  const zipBytes = createZipArchive([file1, file2]);
  ok(zipBytes.length > 100, "ZIP archive contains data");

  const view = new DataView(zipBytes.buffer);

  // 1. First local file header magic: 0x04034b50 ("PK\x03\x04")
  eq(view.getUint32(0, true), 0x04034b50, "valid first local file header signature");

  // 2. Scan for End of Central Directory signature (0x06054b50) at the end
  let eocdOffset = -1;
  for (let i = zipBytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true), 0x06054b50) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
  }
  ok(eocdOffset >= 0, "found End of Central Directory record");
  eq(view.getUint16(eocdOffset + 8, true), 2, "records 2 files on disk");
  eq(view.getUint16(eocdOffset + 10, true), 2, "records 2 total files");
});

suite("stem filenames");

test("derives descriptive and sanitized stem filenames", () => {
  eq(stemZipFilename("Cosmic Drift"), "SonicBlueprint_Cosmic_Drift_Stems.zip");
  eq(stemWavFilename("Cosmic Drift", "Drums"), "SonicBlueprint_Cosmic_Drift_Drums.wav");
  eq(stemWavFilename("Cosmic Drift", "Bass"), "SonicBlueprint_Cosmic_Drift_Bass.wav");
  eq(stemWavFilename("Cosmic Drift", "Chords"), "SonicBlueprint_Cosmic_Drift_Chords.wav");
  eq(stemWavFilename("Cosmic Drift", "Melody"), "SonicBlueprint_Cosmic_Drift_Melody.wav");
});

suite("multi-track stem rendering and isolation");

test("renders all 4 stems with identical duration, sample rate, and valid WAV structure", async () => {
  const project = createProject("Stem Test Project");

  const stems = await renderAllStems(project);
  eq(stems.length, 4, "renders 4 isolated stems (chords, drums, bass, melody)");

  const expectedLayers = STEM_LAYERS.map((l) => l.key);
  eq(stems.map((s) => s.key), expectedLayers);

  // Reference duration and sample rate from first stem
  const baseDuration = stems[0].durationSec;
  const baseSampleRate = stems[0].sampleRate;
  eq(baseSampleRate, 44100, "standard 44.1kHz sample rate");
  ok(baseDuration > 0, "positive duration");

  for (const stem of stems) {
    // Exact timeline and sample rate consistency across all stems
    approx(stem.durationSec, baseDuration, 0.001);
    eq(stem.sampleRate, baseSampleRate);
    eq(stem.channels, 2);

    // Parse and verify standard 16-bit PCM WAV headers
    const parsed = parseWav(stem.wavBytes);
    eq(parsed.metadata.audioFormat, 1, "PCM format");
    eq(parsed.metadata.bitsPerSample, 16, "16-bit depth");
    eq(parsed.metadata.numChannels, 2, "stereo channels");
    eq(parsed.metadata.sampleRate, 44100, "sample rate");
    approx(parsed.metadata.duration, baseDuration, 0.05);
  }
});

test("disabled layer generates silent stem with exact duration and timeline alignment", async () => {
  const project = createProject("Muted Drums Test");
  // Explicitly mute drums
  project.layers = {
    chords: true,
    bass: true,
    melody: true,
    drums: false,
  };

  const stems = await renderAllStems(project);
  const drumsStem = stems.find((s) => s.key === "drums");
  const chordsStem = stems.find((s) => s.key === "chords");

  ok(drumsStem !== undefined, "drums stem exists");
  ok(chordsStem !== undefined, "chords stem exists");

  // Muted drums stem must have no audible energy
  eq(drumsStem.hasAudio, false, "muted layer is silent");

  // But must maintain exact sample-accurate timeline alignment and duration
  approx(drumsStem.durationSec, chordsStem.durationSec, 0.001);
  eq(drumsStem.sampleRate, chordsStem.sampleRate);
});

test("exportStemsZip packages all 4 stems into a downloadable ZIP archive", async () => {
  const project = createProject("Zip Package Test");
  let progressCalled = false;

  const zipBlob = await exportStemsZip(project, (p) => {
    progressCalled = true;
    ok(p.fraction >= 0 && p.fraction <= 1.0, "progress is bounded [0, 1]");
  });

  ok(progressCalled, "progress reporter invoked during stem export");
  eq(zipBlob.type, "application/zip");
  ok(zipBlob.size > 1000, "ZIP blob has non-trivial size");

  // Read blob bytes and verify PKZIP magic
  const buffer = await zipBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(bytes.buffer);
  eq(view.getUint32(0, true), 0x04034b50, "valid ZIP archive header");
});

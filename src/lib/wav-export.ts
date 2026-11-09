// ── Lossless PCM WAV export ──
// Standard 16-bit 44.1kHz stereo PCM RIFF/WAVE encoding with full clipping protection,
// offline rendering integration, and structured WAV parsing for test verification.

import { renderToAudioBuffer } from "./audio-engine";
import type { SonicProject } from "./project-schema";

export type WavBitDepth = 16 | 24;

export interface WavExportOptions {
  bitDepth?: WavBitDepth | undefined;
}

export interface WavMetadata {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
  audioFormat: number; // 1 = PCM
  byteRate: number;
  blockAlign: number;
  dataSize: number;
  duration: number; // in seconds
  totalFileSize: number;
}

/** Quantize float32 sample (-1.0 to +1.0) to signed 16-bit PCM integer (-32768 to +32767).
 * Strictly guards against NaN, Infinity, and amplitude clipping. */
export function quantizeSample16(sample: number): number {
  if (!Number.isFinite(sample)) return 0;
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0
    ? Math.round(clamped * 0x8000)
    : Math.round(clamped * 0x7fff);
}

/** Quantize float32 sample (-1.0 to +1.0) to signed 24-bit PCM integer (-8388608 to +8388607).
 * Strictly guards against NaN, Infinity, and amplitude clipping. */
export function quantizeSample24(sample: number): number {
  if (!Number.isFinite(sample)) return 0;
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0
    ? Math.round(clamped * 0x800000)
    : Math.round(clamped * 0x7fffff);
}

/** Encode an AudioBuffer into standard 16-bit or 24-bit signed PCM RIFF/WAVE binary data. */
export function encodeWavBuffer(audioBuffer: AudioBuffer, options?: WavExportOptions): Uint8Array {
  const numChannels = Math.max(1, Math.min(2, audioBuffer.numberOfChannels));
  const sampleRate = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;
  const bitsPerSample: WavBitDepth = options?.bitDepth === 24 ? 24 : 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const headerSize = 44;
  const totalFileSize = headerSize + dataSize;

  const out = new Uint8Array(totalFileSize);
  const view = new DataView(out.buffer);

  // 1. RIFF chunk descriptor
  // "RIFF" in ASCII
  view.setUint8(0, 0x52); // 'R'
  view.setUint8(1, 0x49); // 'I'
  view.setUint8(2, 0x46); // 'F'
  view.setUint8(3, 0x46); // 'F'
  view.setUint32(4, totalFileSize - 8, true); // ChunkSize (total - 8)
  // "WAVE" in ASCII
  view.setUint8(8, 0x57);  // 'W'
  view.setUint8(9, 0x41);  // 'A'
  view.setUint8(10, 0x56); // 'V'
  view.setUint8(11, 0x45); // 'E'

  // 2. "fmt " sub-chunk
  view.setUint8(12, 0x66); // 'f'
  view.setUint8(13, 0x6d); // 'm'
  view.setUint8(14, 0x74); // 't'
  view.setUint8(15, 0x20); // ' '
  view.setUint32(16, 16, true);          // Subchunk1Size = 16 for PCM
  view.setUint16(20, 1, true);           // AudioFormat = 1 (PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true);  // SampleRate
  view.setUint32(28, byteRate, true);    // ByteRate
  view.setUint16(32, blockAlign, true);  // BlockAlign
  view.setUint16(34, bitsPerSample, true);// BitsPerSample

  // 3. "data" sub-chunk
  view.setUint8(36, 0x64); // 'd'
  view.setUint8(37, 0x61); // 'a'
  view.setUint8(38, 0x74); // 't'
  view.setUint8(39, 0x61); // 'a'
  view.setUint32(40, dataSize, true);    // Subchunk2Size

  // 4. Interleaved PCM audio samples (16-bit or 24-bit)
  const left = audioBuffer.getChannelData(0);
  const right = numChannels > 1 ? audioBuffer.getChannelData(1) : left;

  let offset = 44;
  if (bitsPerSample === 24) {
    for (let i = 0; i < numFrames; i++) {
      const sLeft = quantizeSample24(left[i]);
      out[offset] = sLeft & 0xff;
      out[offset + 1] = (sLeft >> 8) & 0xff;
      out[offset + 2] = (sLeft >> 16) & 0xff;
      offset += 3;

      if (numChannels > 1) {
        const sRight = quantizeSample24(right[i]);
        out[offset] = sRight & 0xff;
        out[offset + 1] = (sRight >> 8) & 0xff;
        out[offset + 2] = (sRight >> 16) & 0xff;
        offset += 3;
      }
    }
  } else {
    for (let i = 0; i < numFrames; i++) {
      const sLeft = quantizeSample16(left[i]);
      view.setInt16(offset, sLeft, true);
      offset += 2;

      if (numChannels > 1) {
        const sRight = quantizeSample16(right[i]);
        view.setInt16(offset, sRight, true);
        offset += 2;
      }
    }
  }

  return out;
}

/** Parse and validate a RIFF/WAVE header, extracting key metadata and checking structure integrity. */
export function parseWav(buffer: ArrayBuffer | Uint8Array): {
  metadata: WavMetadata;
  leftChannel: Float32Array;
  rightChannel: Float32Array;
} {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 44) {
    throw new Error(`Invalid WAV: file size (${bytes.length} bytes) is smaller than standard 44-byte header`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // Check RIFF header
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (riff !== "RIFF") throw new Error(`Invalid WAV: missing RIFF header (got "${riff}")`);

  const fileSizeMinus8 = view.getUint32(4, true);
  if (fileSizeMinus8 + 8 > bytes.length) throw new Error("Invalid WAV: corrupted chunk size");
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (wave !== "WAVE") throw new Error(`Invalid WAV: missing WAVE format (got "${wave}")`);

  // Locate fmt and data chunks
  let offset = 12;
  let audioFormat = 0;
  let numChannels = 0;
  let sampleRate = 0;
  let byteRate = 0;
  let blockAlign = 0;
  let bitsPerSample = 0;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === "fmt ") {
      audioFormat = view.getUint16(offset + 8, true);
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      byteRate = view.getUint32(offset + 16, true);
      blockAlign = view.getUint16(offset + 20, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === "data") {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize;
  }

  if (audioFormat !== 1) {
    throw new Error(`Unsupported WAV format: expected PCM (1), got ${audioFormat}`);
  }
  if (numChannels < 1 || numChannels > 2) {
    throw new Error(`Unsupported WAV channel count: expected 1 or 2, got ${numChannels}`);
  }
  if (bitsPerSample !== 16 && bitsPerSample !== 24) {
    throw new Error(`Unsupported WAV bit depth: expected 16-bit or 24-bit, got ${bitsPerSample}`);
  }
  if (dataOffset === 0) {
    throw new Error(`Invalid WAV: no "data" chunk found`);
  }

  const numFrames = Math.floor(dataSize / blockAlign);
  const left = new Float32Array(numFrames);
  const right = new Float32Array(numFrames);

  let p = dataOffset;
  if (bitsPerSample === 24) {
    for (let i = 0; i < numFrames && p + blockAlign <= bytes.length; i++) {
      const b0 = bytes[p];
      const b1 = bytes[p + 1];
      const b2 = bytes[p + 2];
      const rawL = b0 | (b1 << 8) | (b2 << 16);
      // Arithmetic sign extension: (raw << 8) >> 8
      const s24L = (rawL << 8) >> 8;
      left[i] = s24L < 0 ? s24L / 0x800000 : s24L / 0x7fffff;
      p += 3;

      if (numChannels > 1) {
        const rb0 = bytes[p];
        const rb1 = bytes[p + 1];
        const rb2 = bytes[p + 2];
        const rawR = rb0 | (rb1 << 8) | (rb2 << 16);
        const s24R = (rawR << 8) >> 8;
        right[i] = s24R < 0 ? s24R / 0x800000 : s24R / 0x7fffff;
        p += 3;
      } else {
        right[i] = left[i];
      }
    }
  } else {
    for (let i = 0; i < numFrames && p + blockAlign <= bytes.length; i++) {
      const s16L = view.getInt16(p, true);
      left[i] = s16L < 0 ? s16L / 0x8000 : s16L / 0x7fff;
      p += 2;
      if (numChannels > 1) {
        const s16R = view.getInt16(p, true);
        right[i] = s16R < 0 ? s16R / 0x8000 : s16R / 0x7fff;
        p += 2;
      } else {
        right[i] = left[i];
      }
    }
  }

  const duration = numFrames / sampleRate;

  return {
    metadata: {
      numChannels,
      sampleRate,
      bitsPerSample,
      audioFormat,
      byteRate,
      blockAlign,
      dataSize,
      duration,
      totalFileSize: bytes.length,
    },
    leftChannel: left,
    rightChannel: right,
  };
}

/** Render a song project to an uncompressed 16-bit or 24-bit 44.1kHz PCM WAV file blob. */
export async function exportWav(
  project: SonicProject,
  optionsOrProgress?: WavExportOptions | ((stage: string) => void),
  maybeProgress?: (stage: string) => void
): Promise<Blob> {
  let options: WavExportOptions | undefined;
  let onProgress: ((stage: string) => void) | undefined;
  if (typeof optionsOrProgress === "function") {
    onProgress = optionsOrProgress;
  } else {
    options = optionsOrProgress;
    onProgress = maybeProgress;
  }

  onProgress?.("Rendering blueprint to audio… 0%");
  const rendered = await renderToAudioBuffer(project, (fraction) => {
    onProgress?.(`Rendering blueprint to audio… ${Math.round(fraction * 100)}%`);
  });

  const label = options?.bitDepth === 24 ? "24-bit studio WAV" : "lossless WAV";
  onProgress?.(`Encoding ${label}…`);
  // Give UI a tick to refresh
  await new Promise((res) => setTimeout(res, 0));

  const wavBytes = encodeWavBuffer(rendered, options);
  onProgress?.("Done");
  return new Blob([wavBytes.buffer as ArrayBuffer], { type: "audio/wav" });
}

export function wavFilename(projectName: string): string {
  const safe = projectName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Project";
  return `SonicBlueprint_${safe}_Instrumental.wav`;
}

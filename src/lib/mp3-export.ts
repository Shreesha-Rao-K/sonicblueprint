// MP3 export — offline render + client-side encode (Vercel-safe, no backend).
// Uses lamejs (MPEG encoder, pure JS) and ID3v2 tagging engine.

import { renderToAudioBuffer } from "./audio-engine";
import type { SonicProject } from "./project-schema";
import {
  buildId3v2Tag,
  type Id3TagMetadata,
  type Id3TagOptions,
} from "./id3-tag";

export type Mp3Bitrate = 128 | 192 | 320;

export interface Mp3ExportOptions {
  bitrate?: Mp3Bitrate | undefined;
  tags?: Id3TagMetadata | undefined;
  includeTags?: boolean | undefined;
  tagOptions?: Id3TagOptions | undefined;
}

function floatTo16(buf: Float32Array): Int16Array {
  const out = new Int16Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    const s = Math.max(-1, Math.min(1, buf[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** Standalone buffer encoder: Encodes an AudioBuffer into MP3 bytes with selectable bitrates and optional ID3v2 tags. */
export async function encodeMp3Buffer(
  audioBuffer: AudioBuffer,
  options?: Mp3ExportOptions
): Promise<Uint8Array> {
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const sr = audioBuffer.sampleRate;
  const left = floatTo16(audioBuffer.getChannelData(0));
  const right = audioBuffer.numberOfChannels > 1
    ? floatTo16(audioBuffer.getChannelData(1))
    : left;

  const bitrate: Mp3Bitrate = options?.bitrate ?? 192;
  const enc = new Mp3Encoder(2, sr, bitrate);
  const chunk = 1152;
  const audioChunks: Uint8Array[] = [];

  for (let i = 0; i < left.length; i += chunk) {
    const l = left.subarray(i, i + chunk);
    const r = right.subarray(i, i + chunk);
    const data = enc.encodeBuffer(l, r);
    // slice(): encoder reuses its internal buffer, so copy bytes out
    if (data.length > 0) {
      audioChunks.push(new Uint8Array(data.slice()));
    }
  }

  const end = enc.flush();
  if (end.length > 0) {
    audioChunks.push(new Uint8Array(end.slice()));
  }

  const totalAudioBytes = audioChunks.reduce((acc, c) => acc + c.length, 0);

  // Generate ID3v2 metadata header if enabled
  const includeTags = options?.includeTags !== false;
  let id3Bytes: Uint8Array | null = null;
  if (includeTags && options?.tags) {
    id3Bytes = buildId3v2Tag(options.tags, options.tagOptions);
  }

  const tagLength = id3Bytes ? id3Bytes.length : 0;
  const out = new Uint8Array(tagLength + totalAudioBytes);

  let offset = 0;
  if (id3Bytes) {
    out.set(id3Bytes, 0);
    offset += id3Bytes.length;
  }

  for (const chunk of audioChunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }

  return out;
}

export async function exportMp3(
  p: SonicProject,
  optionsOrProgress?: Mp3ExportOptions | ((stage: string) => void),
  maybeProgress?: (stage: string) => void
): Promise<Blob> {
  let options: Mp3ExportOptions | undefined;
  let onProgress: ((stage: string) => void) | undefined;
  if (typeof optionsOrProgress === "function") {
    onProgress = optionsOrProgress;
  } else {
    options = optionsOrProgress;
    onProgress = maybeProgress;
  }

  const bitrate = options?.bitrate ?? 192;
  onProgress?.("Recording your song… 0%");
  const rendered = await renderToAudioBuffer(p, (frac) =>
    onProgress?.(`Recording your song… ${Math.round(frac * 100)}%`)
  );

  onProgress?.(`Compressing MP3 (${bitrate} kbps)…`);

  // Build metadata from project
  const yearFromDate = p.meta.createdAt ? new Date(p.meta.createdAt).getFullYear() : 2026;
  const defaultTags: Id3TagMetadata = {
    title: p.meta.name,
    artist: "SonicBlueprint Artist",
    album: "SonicBlueprint Sessions",
    year: Number.isFinite(yearFromDate) ? yearFromDate : 2026,
    genre: p.config.mood || "Electronic",
    comment: "Created with SonicBlueprint DAW",
  };

  const mergedTags: Id3TagMetadata = {
    ...defaultTags,
    ...(options?.tags ?? {}),
  };

  const mp3Bytes = await encodeMp3Buffer(rendered, {
    bitrate,
    includeTags: options?.includeTags ?? true,
    tags: mergedTags,
    ...(options?.tagOptions ? { tagOptions: options.tagOptions } : {}),
  });

  onProgress?.("Done");
  return new Blob([mp3Bytes.buffer as ArrayBuffer], { type: "audio/mpeg" });
}

export function mp3Filename(projectName: string): string {
  const safe = projectName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Project";
  return `SonicBlueprint_${safe}_Instrumental.mp3`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// MP3 export — offline render + client-side encode (Vercel-safe, no backend).
// Uses lamejs (MPEG encoder, pure JS).

import { renderToAudioBuffer } from "./audio-engine";
import type { SonicProject } from "./project-schema";

function floatTo16(buf: Float32Array): Int16Array {
  const out = new Int16Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    const s = Math.max(-1, Math.min(1, buf[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export async function exportMp3(
  p: SonicProject,
  onProgress?: (stage: string) => void
): Promise<Blob> {
  onProgress?.("Recording your song… 0%");
  const rendered = await renderToAudioBuffer(p, (frac) =>
    onProgress?.(`Recording your song… ${Math.round(frac * 100)}%`)
  );
  onProgress?.("Compressing MP3…");
  // ESM-compatible lamejs fork; dynamic import keeps initial bundle small
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const sr = rendered.sampleRate;
  const left = floatTo16(rendered.getChannelData(0));
  const right = rendered.numberOfChannels > 1 ? floatTo16(rendered.getChannelData(1)) : left;
  const enc = new Mp3Encoder(2, sr, 128);
  const chunk = 1152;
  const parts: BlobPart[] = [];
  for (let i = 0; i < left.length; i += chunk) {
    const l = left.subarray(i, i + chunk);
    const r = right.subarray(i, i + chunk);
    const data = enc.encodeBuffer(l, r);
    // slice(): encoder reuses its internal buffer, so copy bytes out
    if (data.length > 0) parts.push(data.slice());
    if (i % (chunk * 200) === 0) {
      await new Promise((res) => setTimeout(res, 0)); // keep UI responsive
    }
  }
  const end = enc.flush();
  if (end.length > 0) parts.push(end.slice());
  onProgress?.("Done");
  return new Blob(parts, { type: "audio/mpeg" });
}

export function mp3Filename(projectName: string): string {
  const safe = projectName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Project";
  return `SonicBlueprint_${safe}_Instrumental.mp3`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

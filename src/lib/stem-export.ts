// ── Multi-track Stem Export ──
// Renders isolated, sample-accurate, aligned 16-bit 44.1kHz PCM WAV stems
// for Chords, Drums, Bass, and Melody layers, bundled into a standard PKZIP archive.

import { renderToAudioBuffer } from "./audio-engine";
import { encodeWavBuffer } from "./wav-export";
import { createZipArchive, type ZipEntry } from "./zip-export";
import type { SonicProject } from "./project-schema";

export type StemLayerKey = "chords" | "drums" | "bass" | "melody";

export const STEM_LAYERS: { key: StemLayerKey; label: string; suffix: string }[] = [
  { key: "chords", label: "Chords & Harmony", suffix: "Chords" },
  { key: "drums", label: "Drums & Percussion", suffix: "Drums" },
  { key: "bass", label: "Bassline", suffix: "Bass" },
  { key: "melody", label: "Melody & Leads", suffix: "Melody" },
];

export interface StemResult {
  key: StemLayerKey;
  label: string;
  filename: string;
  wavBytes: Uint8Array;
  blob: Blob;
  durationSec: number;
  sampleRate: number;
  channels: number;
  hasAudio: boolean;
}

export interface StemExportProgress {
  layerKey: StemLayerKey;
  layerIndex: number;
  totalLayers: number;
  fraction: number;
  message: string;
}

export function sanitizeProjectBase(name: string): string {
  return name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Project";
}

export function stemZipFilename(projectName: string): string {
  const safe = sanitizeProjectBase(projectName);
  return `SonicBlueprint_${safe}_Stems.zip`;
}

export function stemWavFilename(projectName: string, suffix: string): string {
  const safe = sanitizeProjectBase(projectName);
  return `SonicBlueprint_${safe}_${suffix}.wav`;
}

export interface StemExportOptions {
  bitDepth?: 16 | 24;
}

/** Render isolated audio for all 4 musical layers with matching timeline alignment and sample rate. */
export async function renderAllStems(
  project: SonicProject,
  optionsOrProgress?: StemExportOptions | ((progress: StemExportProgress) => void),
  maybeProgress?: (progress: StemExportProgress) => void
): Promise<StemResult[]> {
  let options: StemExportOptions | undefined;
  let onProgress: ((progress: StemExportProgress) => void) | undefined;
  if (typeof optionsOrProgress === "function") {
    onProgress = optionsOrProgress;
  } else {
    options = optionsOrProgress;
    onProgress = maybeProgress;
  }

  const results: StemResult[] = [];
  const total = STEM_LAYERS.length;
  const safeName = sanitizeProjectBase(project.meta?.name ?? "Project");

  for (let idx = 0; idx < total; idx++) {
    const { key, label, suffix } = STEM_LAYERS[idx];
    const filename = `SonicBlueprint_${safeName}_${suffix}.wav`;

    const isLayerGloballyEnabled = project.layers ? project.layers[key] ?? true : true;

    // Report layer starting
    onProgress?.({
      layerKey: key,
      layerIndex: idx,
      totalLayers: total,
      fraction: idx / total,
      message: `Rendering stem ${idx + 1}/${total}: ${label}…`,
    });

    // Create an isolated snapshot where only this layer is enabled.
    // If the layer is muted by the user, all layers are false, yielding an exact-length silent stem.
    const stemProject: SonicProject = {
      ...project,
      layers: {
        chords: key === "chords" && isLayerGloballyEnabled,
        drums: key === "drums" && isLayerGloballyEnabled,
        bass: key === "bass" && isLayerGloballyEnabled,
        melody: key === "melody" && isLayerGloballyEnabled,
      },
    };

    const rendered = await renderToAudioBuffer(stemProject, (layerFraction) => {
      const overallFraction = (idx + layerFraction) / total;
      onProgress?.({
        layerKey: key,
        layerIndex: idx,
        totalLayers: total,
        fraction: overallFraction,
        message: `Rendering stem ${idx + 1}/${total}: ${label} (${Math.round(layerFraction * 100)}%)`,
      });
    });

    const wavOptions = options?.bitDepth ? { bitDepth: options.bitDepth } : undefined;
    const wavBytes = encodeWavBuffer(rendered, wavOptions);
    const blob = new Blob([wavBytes.buffer as ArrayBuffer], { type: "audio/wav" });

    // Detect if this stem has audible content
    let hasAudio = false;
    const lData = rendered.getChannelData(0);
    for (let s = 0; s < lData.length; s += 256) {
      if (Math.abs(lData[s]) > 1e-4) {
        hasAudio = true;
        break;
      }
    }

    results.push({
      key,
      label,
      filename,
      wavBytes,
      blob,
      durationSec: rendered.duration,
      sampleRate: rendered.sampleRate,
      channels: rendered.numberOfChannels,
      hasAudio,
    });

    // Yield control briefly so UI renders
    await new Promise((res) => setTimeout(res, 0));
  }

  return results;
}

/** Render and package all 4 stems into a single uncompressed PKZIP archive blob. */
export async function exportStemsZip(
  project: SonicProject,
  optionsOrProgress?: StemExportOptions | ((progress: StemExportProgress) => void),
  maybeProgress?: (progress: StemExportProgress) => void
): Promise<Blob> {
  let options: StemExportOptions | undefined;
  let onProgress: ((progress: StemExportProgress) => void) | undefined;
  if (typeof optionsOrProgress === "function") {
    onProgress = optionsOrProgress;
  } else {
    options = optionsOrProgress;
    onProgress = maybeProgress;
  }

  const stems = await renderAllStems(project, options, onProgress);

  onProgress?.({
    layerKey: "melody",
    layerIndex: STEM_LAYERS.length - 1,
    totalLayers: STEM_LAYERS.length,
    fraction: 0.98,
    message: "Packaging stems into ZIP archive…",
  });

  const zipEntries: ZipEntry[] = stems.map((s) => ({
    name: s.filename,
    data: s.wavBytes,
  }));

  const zipBytes = createZipArchive(zipEntries);

  onProgress?.({
    layerKey: "melody",
    layerIndex: STEM_LAYERS.length - 1,
    totalLayers: STEM_LAYERS.length,
    fraction: 1.0,
    message: "Done",
  });

  return new Blob([zipBytes.buffer as ArrayBuffer], { type: "application/zip" });
}

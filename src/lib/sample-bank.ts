// Sample bank: lazy-loaded, cached multisamples for the hybrid engine.
// - One bank per sampled timbre (grand piano, violin ensemble, ...).
// - Notes: nearest-sample mapping, pitch shift capped at ±2 semitones so no
//   note ever stretches unnaturally far (out-of-range falls back to synth).
// - Drums: per-row hit layers picked by velocity (real timbral dynamics).
// - Buffers are plain decoded AudioBuffers: shareable between the realtime
//   AudioContext and OfflineAudioContext export rendering.
// - Loader is injectable so unit tests run without Web Audio.

export interface SampleVelocityLayer {
  /** Minimum note velocity (0..1) selecting this layer. First must be 0. */
  minVel: number;
  url: string;
}

export interface SampleNote {
  /** MIDI number this recording is pitched at. */
  midi: number;
  /** Recorded dynamic layers, ascending minVel. Same pitch, different takes. */
  layers: SampleVelocityLayer[];
}

/** One dynamic layer with round-robin takes: same hit recorded repeatedly.
 * Round-robins defeat the machine-gun effect; velocity layers give dynamics. */
export interface DrumHitGroup {
  /** Minimum velocity (0..1) that selects this group. Groups sorted ascending. */
  minVel: number;
  /** Same hit, multiple takes. ≥1 url; single url = no alternation. */
  urls: string[];
}

/** What the recordings genuinely provide. Only values matching the source
 * material may be used — never fabricate an articulation the bank lacks. */
export type Articulation =
  | "sustain"
  | "sustain-vibrato"
  | "staccato"
  | "pluck"
  | "hit"
  | "natural";

export const ARTICULATIONS: Articulation[] = [
  "sustain",
  "sustain-vibrato",
  "staccato",
  "pluck",
  "hit",
  "natural",
];

export interface SampleBankDef {
  id: string;
  kind: "pitched" | "drums";
  notes: SampleNote[];
  /** Drum rows, only for kind === "drums": hit groups per row. */
  rows?: Record<string, DrumHitGroup[]>;
  /** Recorded articulation. Drives release/duration handling. */
  articulation: Articulation;
  /** Seconds. */
  attack?: number;
  release?: number;
  /** Overall trim applied on top of event volume. */
  gain?: number;
  /** Max pitch distance (semitones) before falling back to synthesis. */
  maxShift?: number;
  /** Wet level into the shared room reverb (0..1). */
  room?: number;
}

export interface LoadedBank {
  def: SampleBankDef;
  /** Decoded audio per recorded pitch, parallel to def note layers. */
  buffers: Map<number, (AudioBufferLike | null)[]>;
  /** Decoded hits per row, parallel to def row groups × variations. */
  drumBuffers: Map<string, (AudioBufferLike | null)[][]>;
}

export interface AudioBufferLike {
  duration: number;
}

export interface BankLoader {
  fetch(url: string): Promise<ArrayBuffer>;
  decode(data: ArrayBuffer): Promise<AudioBufferLike>;
}

const DEFAULT_ATTACK = 0.005;
const DEFAULT_RELEASE = 0.25;
const DEFAULT_MAX_SHIFT = 2;

export function validateBankDef(def: unknown): def is SampleBankDef {
  if (typeof def !== "object" || def === null) return false;
  const d = def as Record<string, unknown>;
  if (typeof d["id"] !== "string" || d["id"].length === 0) return false;
  if (d["kind"] !== "pitched" && d["kind"] !== "drums") return false;
  if (typeof d["articulation"] !== "string" || !(ARTICULATIONS as string[]).includes(d["articulation"] as string)) return false;
  if (!Array.isArray(d["notes"]) || d["notes"].length === 0) return false;
  let prev = -Infinity;
  for (const n of d["notes"]) {
    if (typeof n !== "object" || n === null) return false;
    const rec = n as Record<string, unknown>;
    const midi = rec["midi"];
    if (!Number.isInteger(midi) || (midi as number) < 0 || (midi as number) > 127) return false;
    // sorted ascending, no duplicate recorded pitches
    if ((midi as number) <= prev) return false;
    prev = midi as number;
    const layers = rec["layers"];
    if (!Array.isArray(layers) || layers.length === 0) return false;
    let prevVel = -Infinity;
    for (const l of layers) {
      if (typeof l !== "object" || l === null) return false;
      const lr = l as Record<string, unknown>;
      if (typeof lr["minVel"] !== "number" || (lr["minVel"] as number) < 0 || (lr["minVel"] as number) > 1) return false;
      if (typeof lr["url"] !== "string" || (lr["url"] as string).length === 0) return false;
      if ((lr["minVel"] as number) <= prevVel) return false;
      prevVel = lr["minVel"] as number;
    }
    // full velocity coverage: softest layer starts at 0
    if ((layers[0] as Record<string, unknown>)["minVel"] !== 0) return false;
  }
  if (d["kind"] === "drums") {
    if (typeof d["rows"] !== "object" || d["rows"] === null) return false;
    if (typeof d["rows"] !== "object" || d["rows"] === null) return false;
    const rows = d["rows"] as Record<string, unknown>;
    if (Object.keys(rows).length === 0) return false;
    for (const groups of Object.values(d["rows"] as Record<string, unknown>)) {
      if (!Array.isArray(groups) || groups.length === 0) return false;
      let prevVel = -Infinity;
      for (const g of groups) {
        if (typeof g !== "object" || g === null) return false;
        const rec = g as Record<string, unknown>;
        if (typeof rec["minVel"] !== "number" || (rec["minVel"] as number) < 0 || (rec["minVel"] as number) > 1) return false;
        if ((rec["minVel"] as number) <= prevVel) return false;
        prevVel = rec["minVel"] as number;
        const urls = rec["urls"];
        if (!Array.isArray(urls) || urls.length === 0) return false;
        if (urls.some((u) => typeof u !== "string" || (u as string).length === 0)) return false;
      }
      if ((groups[0] as Record<string, unknown>)["minVel"] !== 0) return false;
    }
  }
  for (const k of ["attack", "release", "gain", "room"]) {
    const v = d[k];
    if (v !== undefined && (typeof v !== "number" || !Number.isFinite(v) || v < 0)) return false;
  }
  if (d["maxShift"] !== undefined && (!Number.isInteger(d["maxShift"]) || (d["maxShift"] as number) < 0)) return false;
  return true;
}

/** Nearest recorded pitch for a MIDI note, or null when unreasonably far. */
export function pickSample(def: SampleBankDef, midi: number): SampleNote | null {
  if (!Number.isFinite(midi)) return null;
  const maxShift = def.maxShift ?? DEFAULT_MAX_SHIFT;
  let best: SampleNote | null = null;
  let bestDist = Infinity;
  for (const n of def.notes) {
    const dist = Math.abs(n.midi - midi);
    if (dist < bestDist) {
      bestDist = dist;
      best = n;
    }
  }
  if (!best || bestDist > maxShift) return null;
  return best;
}

/** Width (velocity units) of the crossfade band below each layer boundary. */
export const LAYER_XFADE = 0.06;

export interface LayerVoice {
  /** Index into the note's layers (and the loaded buffers array). */
  layer: number;
  /** Crossfade weight; weights sum to 1. Single voice outside bands. */
  weight: number;
}

/** Velocity layers for a recorded note: the active layer, plus its quieter
 * neighbor inside the crossfade band so timbre never jumps abruptly.
 * Pure function of (layers, velocity): realtime and offline always agree. */
export function pickLayerVoices(
  layers: SampleVelocityLayer[],
  vel: number
): LayerVoice[] {
  if (layers.length === 0) return [];
  const v = Number.isFinite(vel) ? Math.max(0, Math.min(1, vel)) : 0.5;
  let active = 0;
  for (let i = 0; i < layers.length; i++) {
    if (v >= layers[i].minVel) active = i;
  }
  // Crossfade band just below the next boundary: blend with the neighbor so
  // timbre glides instead of jumping. Endpoints agree with the single-voice
  // cases on either side, so the curve is continuous.
  if (active + 1 < layers.length) {
    const nb = layers[active + 1].minVel;
    if (v > nb - LAYER_XFADE && v < nb) {
      const into = (v - (nb - LAYER_XFADE)) / LAYER_XFADE;
      return [
        { layer: active, weight: 1 - into },
        { layer: active + 1, weight: into },
      ];
    }
  }
  return [{ layer: active, weight: 1 }];
}

/** Semitone shift applied via playbackRate to bridge recorded → target pitch. */
export function shiftSemitones(recordedMidi: number, targetMidi: number): number {
  return targetMidi - recordedMidi;
}

/** Effective note duration for an articulation. Staccato recordings are
 * short hits: sustained note lengths are capped so tails never cut
 * unnaturally. All other articulations play full length. */
export function articulatedDur(def: SampleBankDef, dur: number): number {
  if (def.articulation === "staccato") return Math.min(Math.max(0.08, dur), 0.6);
  return dur;
}

/** Drum group index for a velocity: highest group whose minVel is met. */
export function pickDrumGroup(groups: DrumHitGroup[], vel: number): number {
  let pick = 0;
  for (let i = 0; i < groups.length; i++) {
    if (vel >= groups[i].minVel) pick = i;
  }
  return pick;
}

export interface DrumHitPick {
  group: number;
  variation: number;
}

/** Deterministic drum hit: velocity picks the recorded dynamic group, the
 * event occurrence counter cycles round-robin takes within it. Pure function
 * of (groups, velocity, occurrence) — realtime and offline always agree, and
 * exports reproduce exactly. Never leaves the row's declared groups. */
export function selectDrumHit(
  groups: DrumHitGroup[],
  vol: number,
  occurrence: number
): DrumHitPick | null {
  if (groups.length === 0) return null;
  const v = Number.isFinite(vol) ? Math.max(0, Math.min(1, vol)) : 0.5;
  const group = pickDrumGroup(groups, v);
  const count = groups[group].urls.length;
  if (count === 0) return null;
  const n = Number.isFinite(occurrence) ? Math.max(0, Math.floor(occurrence)) : 0;
  return { group, variation: n % count };
}

export function bankAttack(def: SampleBankDef): number {
  return def.attack ?? DEFAULT_ATTACK;
}

export function bankRelease(def: SampleBankDef): number {
  return def.release ?? DEFAULT_RELEASE;
}

export class SampleBankCache {
  private loaded = new Map<string, LoadedBank>();
  private inflight = new Map<string, Promise<LoadedBank>>();

  has(id: string): boolean {
    return this.loaded.has(id);
  }

  get(id: string): LoadedBank | null {
    return this.loaded.get(id) ?? null;
  }

  clear(): void {
    this.loaded.clear();
    // in-flight loads resolve into an empty cache and are dropped by callers
  }

  /** Drop one bank (e.g. leaving a heavy project). Never evicts anything
   * else; active voices already hold their AudioBuffers, so currently
   * sounding notes are unaffected — only future scheduling falls back. */
  unload(id: string): boolean {
    return this.loaded.delete(id);
  }

  ids(): string[] {
    return [...this.loaded.keys()];
  }

  /** Load (or reuse) a bank. Concurrent callers share one fetch/decode. */
  load(def: SampleBankDef, loader: BankLoader): Promise<LoadedBank> {
    const hit = this.loaded.get(def.id);
    if (hit) return Promise.resolve(hit);
    const flying = this.inflight.get(def.id);
    if (flying) return flying;
    const job = (async (): Promise<LoadedBank> => {
      try {
        // Per-file tolerance: one bad file degrades its layer, never the bank.
        const buffers = new Map<number, (AudioBufferLike | null)[]>();
        for (const n of def.notes) {
          const bufs: (AudioBufferLike | null)[] = [];
          for (const l of n.layers) {
            try {
              const data = await loader.fetch(l.url);
              bufs.push(await loader.decode(data));
            } catch (e) {
              console.warn(`[SonicBlueprint:audio] sample missing: ${l.url}`, e);
              bufs.push(null);
            }
          }
          buffers.set(n.midi, bufs);
        }
        if (![...buffers.values()].some((arr) => arr.some((b) => b !== null))) {
          throw new Error(`no usable audio in bank "${def.id}"`);
        }
        const drumBuffers = new Map<string, (AudioBufferLike | null)[][]>();
        if (def.kind === "drums" && def.rows) {
          for (const [row, groups] of Object.entries(def.rows)) {
            const grid: (AudioBufferLike | null)[][] = [];
            for (const g of [...groups].sort((a, b) => a.minVel - b.minVel)) {
              const takes: (AudioBufferLike | null)[] = [];
              for (const url of g.urls) {
                try {
                  const data = await loader.fetch(url);
                  takes.push(await loader.decode(data));
                } catch (e) {
                  console.warn(`[SonicBlueprint:audio] sample missing: ${url}`, e);
                  takes.push(null);
                }
              }
              grid.push(takes);
            }
            drumBuffers.set(row, grid);
          }
        }
        const bank: LoadedBank = { def, buffers, drumBuffers };
        this.loaded.set(def.id, bank);
        return bank;
      } finally {
        this.inflight.delete(def.id);
      }
    })();
    this.inflight.set(def.id, job);
    return job;
  }
}

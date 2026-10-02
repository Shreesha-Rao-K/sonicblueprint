// ── Sampled instruments (hybrid engine) ──
// Licensed multisamples (see src/lib/sample-manifest.ts) play through
// playSampleVoice, shared by realtime playback and offline MP3 rendering.
// Anything unloaded, out of range, or failed falls back to the existing
// synthesis path — never silence, never a crash.

const sampleCache = new SampleBankCache();

function domLoader(ctx: BaseAudioContext) {
  return {
    fetch: async (url: string): Promise<ArrayBuffer> => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`sample HTTP ${res.status}: ${url}`);
      return res.arrayBuffer();
    },
    decode: (data: ArrayBuffer): Promise<AudioBuffer> => ctx.decodeAudioData(data),
  };
}

/** Load banks for a project (lazy: only referenced + drums). Never throws:
 * returns the ids that failed so the UI can say so and synthesis covers. */
export async function ensureSampleBanks(
  ids: string[],
  ctx: BaseAudioContext
): Promise<{ failed: string[] }> {
  const failed: string[] = [];
  for (const id of ids) {
    const def = SAMPLE_BANKS[id];
    if (!def) continue;
    if (sampleCache.has(id)) continue;
    try {
      await sampleCache.load(def, domLoader(ctx));
    } catch (e) {
      console.warn(`[SonicBlueprint:audio] sample bank "${id}" unavailable, using synthesis`, e);
      failed.push(id);
    }
  }
  return { failed };
}

/** Fire-and-forget warm-up (previews): synth covers until loaded. */
export function warmSampleBanks(ids: string[], ctx: BaseAudioContext): void {
  void ensureSampleBanks(ids, ctx).catch(() => undefined);
}

export function sampleBankReady(id: string): boolean {
  return sampleCache.has(id);
}

/** Ids of currently decoded banks (QA + diagnostics). */
export function loadedSampleBanks(): string[] {
  const ids: string[] = [];
  for (const id of Object.keys(SAMPLE_BANKS)) {
    if (sampleCache.has(id)) ids.push(id);
  }
  return ids;
}

// Generated room: synthesized stereo impulse (no assets), one per context.
const roomCache = new WeakMap<BaseAudioContext, GainNode>();
/** @internal Exported for unit tests; engine wiring calls this internally. */
export function getRoomInput(ctx: BaseAudioContext): GainNode {
  const hit = roomCache.get(ctx);
  if (hit) return hit;
  const sr = ctx.sampleRate || 44100;
  const len = Math.floor(sr * 1.4);
  const ir = ctx.createBuffer(2, len, sr);
  // Deterministic pseudo-noise (fixed seed): exports render identically.
  let seed = 0x2b7f4a1;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296 - 0.5;
  };
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // gently lowpassed noise with exponential decay: small-room character
      last = last * 0.72 + rand() * 0.56;
      d[i] = last * Math.pow(1 - i / len, 2.2) * 0.6;
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  const input = ctx.createGain();
  input.gain.value = 1;
  input.connect(conv);
  conv.connect(wet);
  wet.connect(ctx.destination);
  roomCache.set(ctx, input);
  return input;
}

/** Subtle per-family room send. Level 0 = dry (no nodes created).
 * @internal Exported for unit tests; engine wiring calls this internally. */
export function roomSend(ctx: BaseAudioContext, from: AudioNode, level: number): void {
  if (!(level > 0)) return;
  const send = ctx.createGain();
  send.gain.value = Math.max(0, Math.min(0.5, level));
  from.connect(send);
  send.connect(getRoomInput(ctx));
}

/** Gentle master ceiling: a tanh soft-clipper that is bit-transparent below
 * MASTER_CHAIN.linearUpTo and can never harsh-clip above it. Unlike a
 * DynamicsCompressor (measured to lift quiet material in-browser), this has
 * no detector, no attack/release, and renders identically everywhere.
 * @internal Exported for unit tests; engine wiring calls this internally. */
export function masterLimiter(ctx: BaseAudioContext): WaveShaperNode {
  const shaper = ctx.createWaveShaper();
  shaper.curve = makeSoftClipCurve();
  shaper.oversample = "2x";
  return shaper;
}

interface SampleVoice {
  ctx: BaseAudioContext;
  dry: AudioNode;
  buf: AudioBuffer;
  when: number;
  /** semitones to shift via playbackRate (nearest-sample interpolation). */
  shift: number;
  vol: number;
  pan: number;
  attack: number;
  release: number;
  dur: number;
  roomLevel: number;
  /** Note velocity 0..1 for conservative brightness shaping. Omit (or ≥1)
   * for full brightness: loud notes stay completely unfiltered. */
  brightness?: number;
}

/** Gentle velocity brightness for pitched samples: quieter notes lose a
 * little top end, like a real instrument played softly. Loud notes pass
 * through with no filter at all. Drums never use this (transients intact). */
export function brightnessCutoff(brightness: number): number | null {
  const b = Number.isFinite(brightness) ? Math.max(0, Math.min(1, brightness)) : 1;
  if (b >= 0.999) return null;
  return 1500 * Math.pow(16, b);
}

/** One enveloped, panned sample hit with subtle room. Click-free by design:
 * linear attack from 0, release ramp always lands on a stop.
 * @internal Exported for unit tests; engine wiring calls this internally. */
export function playSampleVoice(v: SampleVoice): void {
  const { ctx, buf } = v;
  const when = Math.max(0, v.when);
  const attack = Math.max(0.002, Math.min(v.attack, Math.max(0.01, v.dur * 0.25)));
  const bufEnd = when + Math.max(0.05, buf.duration - 0.03);
  const end = Math.min(when + Math.max(0.08, v.dur) + v.release, bufEnd);
  const relStart = Math.max(when + attack, end - Math.max(0.03, v.release));
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = Math.pow(2, v.shift / 12);
  const g = ctx.createGain();
  const vol = Math.max(0.0001, Math.min(1, v.vol));
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(vol, when + attack);
  g.gain.setValueAtTime(vol, relStart);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  let node: AudioNode = g;
  const cutoff = brightnessCutoff(v.brightness ?? 1);
  if (cutoff !== null) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = cutoff;
    lp.Q.value = 0.4;
    g.connect(lp);
    node = lp;
  }
  if (v.pan !== 0 && typeof ctx.createStereoPanner === "function") {
    const pn = ctx.createStereoPanner();
    pn.pan.value = Math.max(-1, Math.min(1, v.pan));
    node.connect(pn);
    node = pn;
  }
  node.connect(v.dry);
  if (v.roomLevel > 0) {
    const send = ctx.createGain();
    send.gain.value = Math.max(0, Math.min(1, v.roomLevel));
    node.connect(send);
    send.connect(getRoomInput(ctx));
  }
  src.connect(g);
  src.start(when);
  src.stop(end + 0.05);
}

/** Loaded-voice resolution for a pitched note: nearest sample + velocity
 * layers (with crossfade), restricted to successfully decoded buffers.
 * Empty array = fall back to synthesis. Deterministic: realtime and offline
 * always agree for the same (bank, midi, velocity).
 * @internal Exported for unit tests; engine wiring calls this internally. */
export interface SampledVoice {
  buf: AudioBuffer;
  shift: number;
  weight: number;
  def: SampleBankDef;
}

export function sampledNoteVoices(
  bankId: string,
  midi: number,
  vel: number
): SampledVoice[] | null {
  const bank = sampleCache.get(bankId);
  if (!bank) return null;
  const pick = pickSample(bank.def, midi);
  if (!pick) return null;
  const bufs = bank.buffers.get(pick.midi);
  if (!bufs) return null;
  const voices = pickLayerVoices(pick.layers, vel)
    .filter((v) => bufs[v.layer] !== null)
    .map((v) => ({
      buf: bufs[v.layer] as AudioBuffer,
      shift: midi - pick.midi,
      weight: v.weight,
      def: bank.def,
    }));
  return voices.length > 0 ? voices : null;
}

/** Drum hit buffer for a row/velocity/occurrence, or null (use synth).
 * Velocity picks the recorded dynamic group; the event occurrence counter
 * cycles round-robin takes within it. Missing takes are skipped among the
 * successfully decoded ones — deterministic for a given loaded bank, and
 * realtime/offline share the cache so they always agree.
 * @internal Exported for unit tests; engine wiring calls this internally. */
export function sampledDrum(
  row: string,
  vol: number,
  occurrence = 0
): { buf: AudioBuffer; def: SampleBankDef; group: number; variation: number } | null {
  const bank = sampleCache.get("acoustic-drums");
  if (!bank) return null;
  const groups = bank.def.rows?.[row];
  if (!groups) return null;
  const pick = selectDrumHit(groups, vol, occurrence);
  if (!pick) return null;
  const bufs = bank.drumBuffers.get(row)?.[pick.group];
  if (!bufs) return null;
  const loaded = bufs
    .map((b, i) => (b !== null ? i : -1))
    .filter((i) => i >= 0);
  if (loaded.length === 0) return null;
  const variation = loaded[pick.variation % loaded.length];
  const buf = bufs[variation] as AudioBuffer | undefined;
  if (!buf) return null;
  return { buf, def: bank.def, group: pick.group, variation };
}

// ── AudioEngine abstraction: UI never touches Web Audio directly. ──
// Native Web Audio synthesis (no paid backend, Vercel-safe, SSR-safe).
// Chords → notes, bass → notes, drums → events, melody → events, arrangement → timeline.

import type { SonicProject } from "./project-schema";
import { chordMidiNotes, generateMelody, midiToFreq, rootToPc } from "./music-theory";
import { getLayers } from "./project-schema";
import { MELODY_STYLES } from "@/data/styles";
import {
  drumFeel,
  normalizeLevel,
  performHash,
  seedHash,
} from "./humanize";
import { normalizeBpm, normalizedBeatsPerChord } from "./timing";
import {
  detectPhrases,
  planChordSpread,
  planPhrase,
  profileFor,
  type PlanNote,
} from "./performance";
import type { SampleBankDef } from "./sample-bank";
import { SampleBankCache, articulatedDur, pickSample, pickLayerVoices, selectDrumHit, bankAttack, bankRelease } from "./sample-bank";
import { SAMPLE_BANKS, bankForSlot, banksForProject } from "./sample-manifest";
import {
  MIX_ALL_ON,
  drumRoom,
  familyPanScale,
  familyRoom,
  makeSoftClipCurve,
  type MixSwitches,
} from "./mix";

export interface EngineStatus {
  playing: boolean;
  positionSec: number;
  durationSec: number;
  currentChordIndex: number;
  currentSectionIndex: number;
}

export interface PlayOptions {
  loop?: boolean;
  fromSectionId?: string | null;
  onTick?: (s: EngineStatus) => void;
}

export function quarterBeatsPerBar(ts: string): number {
  if (ts === "6/8") return 3;
  if (ts === "12/8") return 6;
  if (ts === "3/4") return 3;
  return 4;
}

export function projectDurationSec(p: SonicProject): number {
  const bpmRaw = p.config?.bpm;
  const spq = 60 / normalizeBpm(bpmRaw);
  const qpb = quarterBeatsPerBar(p.config?.timeSignature ?? "4/4");
  const sections = Array.isArray(p.arrangement) ? p.arrangement : [];
  const totalBars = sections.reduce((a, s) => a + (Number.isFinite(s?.bars) ? Math.max(0, s.bars) : 0), 0);
  return Math.max(1, totalBars * qpb * spq);
}

interface NoteEvent {
  time: number; // sec offset from render start
  midi: number;
  dur: number;
  synth: string;
  vol: number;
  pan: number;
  /** Sampled bank id when the source slot has licensed multisamples.
   * Scheduling falls back to `synth` whenever the bank isn't loaded —
   * events stay valid with or without sample assets. */
  sample?: string;
  /** Source slot group (piano, winds, …) for instrument-family performance.
   * Synth fallback when unknown; never persisted, rebuilt every render. */
  fam?: string;
}

interface DrumEvent {
  time: number;
  row: string;
  vol: number;
  /** Zero-based hit count for this row within the build. Drives deterministic
   * round-robin takes; absent (old data) = first take. */
  rr?: number;
}

interface BuiltSong {
  notes: NoteEvent[];
  drums: DrumEvent[];
  duration: number;
  chordAt: (sec: number) => number;
  sectionAt: (sec: number) => number;
}

function tonicPcOf(p: SonicProject): number {
  const t = p.config?.keyTonic;
  return typeof t === "string" && t.length > 0 ? rootToPc(t) : 0;
}

function scaleKindOf(p: SonicProject): "major" | "minor" | "dorian" | "mixolydian" | "phrygian" | "lydian" | "harmonicMinor" | "pentMajor" | "pentMinor" {
  return p.config?.scale === "major" ? "major" : "minor";
}

/** Deterministic 0..1 hash for velocity humanization (identical every render). */
function hash01(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 2246822507);
  x = Math.imul(x ^ (x >>> 13), 3266489909);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Performance feel pass: timing/velocity/duration wander per instrument
 * family, deterministic from the project seed. "off" bypasses everything,
 * "subtle" reproduces the historical velocity-only behavior bit for bit,
 * "natural" performs the events. Composition (pitches, rhythm, key, BPM,
 * sections) is never touched — only how each note is played. */
function beatSecFor(p: SonicProject): number {
  const bpmRaw = p.config?.bpm;
  const bpm = normalizeBpm(bpmRaw);
  return 60 / bpm;
}

function applyHumanization(
  p: SonicProject,
  notes: { time: number; midi: number; dur: number; synth: string; vol: number; fam?: string }[],
  drums: { time: number; row: string; vol: number; rr?: number }[],
  beatSec: number,
  sections: { start: number; energy: number }[]
): void {
  const level = normalizeLevel(p.config?.humanize);
  if (level === "off") return;
  const seedRaw = p.originality?.melodySeed;
  const seed = seedHash(typeof seedRaw === "string" && seedRaw.length > 0 ? seedRaw : "x");
  if (level === "subtle") {
    // Historical behavior, preserved exactly: velocity breathes ±12%.
    for (const n of notes) {
      n.vol = clamp01(n.vol * (0.88 + 0.24 * hash01(Math.round(n.time * 1000) * 131 + n.midi * 17)));
    }
    const rowSeed: Record<string, number> = {
      kick: 11, snare: 23, hihat: 37, openhat: 41, clap: 53, perc: 67, tom: 79, shaker: 97,
    };
    for (const d of drums) {
      d.vol = clamp01(d.vol * (0.88 + 0.24 * hash01(Math.round(d.time * 1000) * 131 + (rowSeed[d.row] ?? 7))));
    }
    return;
  }
  // natural / expressive → Human Performer plan: phrase arcs, groove-shared
  // drum timing, piano chord spread. Same (composition, seed, level) always
  // performs identically; composition fields are never rewritten.
  const scale = level === "expressive" ? 1.5 : 1;
  const gapSec = beatSec * 3;
  // Pitched streams plan per instrument family so a piano phrase never
  // inherits string bowing (and vice versa). Order within a stream is
  // already time-ascending from the slot loops.
  const byFam = new Map<string, number[]>();
  notes.forEach((n, i) => {
    const key = `${n.fam ?? ""}|${n.synth}`;
    const arr = byFam.get(key);
    if (arr) arr.push(i);
    else byFam.set(key, [i]);
  });
  for (const idxs of byFam.values()) {
    const first = notes[idxs[0]];
    const profile = profileFor(first.fam, first.synth);
    const times = idxs.map((i) => notes[i].time);
    const midis = idxs.map((i) => notes[i].midi);
    const phrases = detectPhrases(times, midis, gapSec);
    let cursor = 0;
    for (const ph of phrases) {
      const slice: PlanNote[] = [];
      for (let k = 0; k < ph.count; k++) {
        const n = notes[idxs[cursor + k]];
        slice.push({ time: n.time, midi: n.midi, dur: n.dur, vol: n.vol });
      }
      const prevGap = cursor === 0 ? Infinity : times[cursor] - times[cursor - 1];
      planPhrase(
        slice,
        { ...ph, start: times[cursor], end: times[cursor + ph.count - 1] },
        cursor, seed, profile,
        { seed, beatSec, sections, scale },
        prevGap
      );
      for (let k = 0; k < ph.count; k++) {
        const n = notes[idxs[cursor + k]];
        n.time = slice[k].time;
        n.vol = clamp01(slice[k].vol);
        n.dur = Math.max(0.05, slice[k].dur);
      }
      // Piano-family chords bloom bottom-up instead of machine-gunning.
      if ((first.fam === "piano" || first.synth === "piano") && profile.spreadMs > 0) {
        const buckets = new Map<number, number[]>();
        for (let k = 0; k < ph.count; k++) {
          const gi = cursor + k;
          const bucket = Math.round(notes[idxs[gi]].time * 1000);
          const arr = buckets.get(bucket);
          if (arr) arr.push(gi);
          else buckets.set(bucket, [gi]);
        }
        for (const members of buckets.values()) {
          if (members.length < 2) continue;
          const ordered = [...members].sort((a, b) => notes[idxs[a]].midi - notes[idxs[b]].midi);
          planChordSpread(
            ordered.map((gi) => notes[idxs[gi]]),
            ordered.map((_, k) => k),
            seed,
            profile.spreadMs
          );
        }
      }
      cursor += ph.count;
    }
  }
  // Drums: kick/snare/tom share one groove offset per grid instant so the
  // backbeat stays glued; hats and extras get their own subtle voice.
  const CORE_ROWS = new Set(["kick", "snare", "tom"]);
  for (const d of drums) {
    const feel = drumFeel(d.row);
    const t = Math.round(d.time * 1000);
    const shared = CORE_ROWS.has(d.row)
      ? performHash(seed, t, 977, 20)
      : performHash(seed, t, famDrumId(d.row), 20);
    d.time = Math.max(0, d.time + ((shared - 0.5) * 2 * feel.timingMs * scale) / 1000);
    d.vol = clamp01(d.vol * (1 + (performHash(seed, t, famDrumId(d.row), 21) - 0.5) * 2 * feel.vel));
  }
}

function famDrumId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h % 997;
}

function clamp01(v: number): number {
  return Math.max(0.0001, Math.min(1, v));
}

function clampMidi(m: number): number {
  return Math.max(0, Math.min(127, Math.round(m)));
}

/** Expand arrangement + harmony into flat events. Pure function — shared by realtime + offline. */
export function buildSongEvents(p: SonicProject): BuiltSong {
  const bpmRaw = p.config?.bpm;
  const bpm = normalizeBpm(bpmRaw);
  const spq = 60 / bpm;
  const qpb = quarterBeatsPerBar(p.config?.timeSignature ?? "4/4");
  const barDur = qpb * spq;
  const tonicPc = tonicPcOf(p);
  const scaleKind = scaleKindOf(p);

  const melodyDensity = MELODY_STYLES.find((m) => m.id === p.melodyStyle)?.density ?? 0.6;
  // Defensive normalization: project files are user-supplied (imported JSON),
  // so every unbounded value is clamped here. Legitimate editor values
  // (beats ≤ 8, steps ∈ {8,12,16}) are far inside these bounds.
  const rawChords = Array.isArray(p.chords?.chords) && p.chords.chords.length > 0 ? p.chords.chords : ["Am"];
  const chords = rawChords.slice(0, 64).map((c) => (typeof c === "string" ? c : "Am"));
  const beatsPerChordQ = normalizedBeatsPerChord(p);
  // Layer participation: one source of truth for preview, MP3, MIDI and PDF.
  const layers = getLayers(p);

  // Per-build caches: slot membership and chord spellings are loop-invariant
  // per (section, group) and (symbol, octave), so memoize them instead of
  // re-filtering/re-parsing on every chord slot (slots scale with bars).
  const slotsOf = (group: string) =>
    (Array.isArray(p.instruments) ? p.instruments : []).filter((i) => i.group === group && i.enabled);
  const allowedCache = new Map<string, typeof p.instruments>();
  const allowedSlots = (secIdx: number, group: string) => {
    const key = `${secIdx}:${group}`;
    const hit = allowedCache.get(key);
    if (hit) return hit;
    const slots = slotsOf(group);
    const sec = sections[secIdx];
    const out = !sec || !Array.isArray(sec.instruments) || sec.instruments.length === 0
      ? slots
      : slots.filter((s) => sec.instruments.includes(s.id));
    allowedCache.set(key, out);
    return out;
  };
  const midiCache = new Map<string, number[]>();
  const leadCache = new Map<number, typeof p.instruments>();
  // Sample tagging: each note remembers which sampled bank its slot resolves
  // to (null = pure synthesis). Scheduling falls back to `synth` whenever the
  // bank isn't loaded, so events stay valid with or without sample assets.
  // Family tagging (slot group) drives instrument-specific performance.
  let curSample: string | undefined;
  let curFam: string | undefined;
  const pushNote = (n: { time: number; midi: number; dur: number; synth: string; vol: number; pan: number }) => {
    if (curSample === undefined && curFam === undefined) notes.push(n);
    else notes.push({ ...n, ...(curSample !== undefined ? { sample: curSample } : null), ...(curFam !== undefined ? { fam: curFam } : null) });
  };
  // Drum configuration is song-global: resolve rows once instead of per bar.
  const drumCfg = p.drums ?? {};
  const drumSteps = Number.isFinite(drumCfg.steps)
    ? Math.max(1, Math.min(64, Math.round(drumCfg.steps as number)))
    : 16;
  const drumStepDur = barDur / drumSteps;
  const drumSwing = Number.isFinite(drumCfg.swing) ? Math.max(0, Math.min(0.9, drumCfg.swing as number)) : 0;
  const drumGroove = Number.isFinite(drumCfg.velocity) ? Math.max(0.1, Math.min(1, drumCfg.velocity as number)) : 0.9;
  const drumGrid = (drumCfg.grid ?? {}) as Record<string, unknown>;
  const drumRows = Object.keys(drumGrid).map((row) => {
    const col = drumGrid[row];
    return Array.isArray(col) && col.length > 0 ? { row, col, len: col.length } : null;
  }).filter((r): r is { row: string; col: unknown[]; len: number } => r !== null);
  // Per-row hit counters: deterministic round-robin takes, identical for
  // realtime playback and offline export because they share these events.
  const rrCount = new Map<string, number>();
  const chordMidis = (sym: string, octave: number): number[] => {
    const key = `${sym}@${octave}`;
    const hit = midiCache.get(key);
    if (hit) return hit;
    const out = chordMidiNotes(sym, octave);
    midiCache.set(key, out);
    return out;
  };

  const notes: NoteEvent[] = [];
  const drums: DrumEvent[] = [];
  const sectionStarts: number[] = [];
  let t = 0;

  // chord index timeline (for highlighting)
  const chordMarks: { start: number; idx: number }[] = [];

  // Integer quarter-note grid anchors chord selection exactly (no float drift).
  // absBar counts bars from song start; slotQ is an exact integer.
  let absBar = 0;
  let lastSlotIdx = -1;

  const sections = (Array.isArray(p.arrangement) ? p.arrangement : []).slice(0, 128);
  const sectionEnergy: { start: number; energy: number }[] = [];
  sections.forEach((sec, secIdx) => {
    sectionStarts.push(t);
    const energy = Number.isFinite(sec.energy) ? Math.max(1, Math.min(10, sec.energy)) : 6;
    sectionEnergy.push({ start: t, energy });
    const secBars = Number.isFinite(sec.bars) ? Math.max(1, Math.min(64, Math.round(sec.bars))) : 4;
    const energyFactor = 0.6 + (energy / 10) * 0.6;
    for (let bar = 0; bar < secBars; bar++) {
      const barStart = t + bar * barDur;
      const chordsInBar = Math.max(1, Math.round(qpb / beatsPerChordQ));
      for (let c = 0; c < chordsInBar; c++) {
        const slotQ = absBar * qpb + c * beatsPerChordQ;
        const slotIdx = Math.floor(slotQ / beatsPerChordQ);
        // Long chord durations: a slot spanning several bars articulates once.
        if (slotIdx === lastSlotIdx) continue;
        lastSlotIdx = slotIdx;
        const ci = ((slotIdx % chords.length) + chords.length) % chords.length;
        const sym = chords[ci];
        const start = slotQ * spq;
        const dur = beatsPerChordQ * spq * 0.95;
        chordMarks.push({ start, idx: ci });

        const midis = chordMidis(sym, p.chords.octave);

        // harmony instruments (every enabled slot sounds — simultaneous layers).
        // Skipped entirely when the chords layer is OFF (settings are kept).
        if (layers.chords) {
        for (const s of allowedSlots(secIdx, "piano")) {
          curSample = bankForSlot(s.group, s.name) ?? undefined;
          curFam = s.group;
          if (s.patternVariant === "broken") {
            midis.forEach((m, k) => {
              pushNote({ time: start + k * spq * 0.5, midi: m + s.octave * 12, dur: spq * 0.45, synth: "piano", vol: s.volume * 0.8 * energyFactor, pan: s.pan });
            });
          } else {
            midis.forEach((m) => {
              pushNote({ time: start, midi: m + s.octave * 12, dur: Math.min(dur, spq * 3.5), synth: "piano", vol: s.volume * 0.7 * energyFactor, pan: s.pan });
            });
          }
        }
        for (const s of allowedSlots(secIdx, "pads")) {
          curSample = bankForSlot(s.group, s.name) ?? undefined;
          curFam = s.group;
          midis.forEach((m) => {
            pushNote({ time: start, midi: m + s.octave * 12 - 12, dur, synth: "pad", vol: s.volume * 0.5 * energyFactor, pan: s.pan });
          });
        }
        for (const s of allowedSlots(secIdx, "strings")) {
          curSample = bankForSlot(s.group, s.name) ?? undefined;
          curFam = s.group;
          midis.forEach((m) => {
            pushNote({ time: start, midi: m + s.octave * 12, dur, synth: "strings", vol: s.volume * 0.5 * energyFactor, pan: s.pan });
          });
        }
        for (const s of allowedSlots(secIdx, "guitar")) {
          curSample = bankForSlot(s.group, s.name) ?? undefined;
          curFam = s.group;
          midis.forEach((m, k) => {
            pushNote({ time: start + k * 0.03, midi: m + 12 + s.octave * 12, dur: spq * 1.5, synth: "guitar", vol: s.volume * 0.45 * energyFactor, pan: s.pan });
          });
        }
        if (energy >= 4) {
          for (const s of allowedSlots(secIdx, "synth")) {
          curSample = bankForSlot(s.group, s.name) ?? undefined;
          curFam = s.group;
            if (s.role === "melody") continue; // leads handled below
            const arpNotes = [...midis, midis[0] + 12, midis[1] + 12];
            arpNotes.forEach((m, k) => {
              if ((k + bar) % 2 === 0)
                pushNote({ time: start + k * spq * 0.5, midi: m + s.octave * 12 + 12, dur: spq * 0.4, synth: "synth", vol: s.volume * 0.4 * energyFactor, pan: s.pan });
            });
          }
        }
        for (const s of allowedSlots(secIdx, "arps")) {
          curSample = bankForSlot(s.group, s.name) ?? undefined;
          curFam = s.group;
          const arp = [...midis, midis[0] + 12].reverse();
          arp.forEach((m, k) => {
            pushNote({ time: start + k * spq * 0.5, midi: m + s.octave * 12 + 12, dur: spq * 0.35, synth: "pluck", vol: s.volume * 0.5 * energyFactor, pan: s.pan });
          });
        }
        if (energy >= 7) {
          for (const s of allowedSlots(secIdx, "brass")) {
          curSample = bankForSlot(s.group, s.name) ?? undefined;
          curFam = s.group;
            midis.forEach((m) => {
              pushNote({ time: start, midi: m + s.octave * 12, dur: spq * 0.6, synth: "brass", vol: s.volume * 0.6, pan: s.pan });
            });
          }
        }
        for (const s of allowedSlots(secIdx, "atmosphere")) {
          curSample = bankForSlot(s.group, s.name) ?? undefined;
          curFam = s.group;
          // key-aware shimmer: chord root + fifth, two octaves up
          pushNote({ time: start, midi: midis[0] + 24 + s.octave * 12, dur, synth: "atmos", vol: s.volume * 0.25, pan: s.pan });
          pushNote({ time: start, midi: midis[0] + 31 + s.octave * 12, dur, synth: "atmos", vol: s.volume * 0.18, pan: -s.pan });
        }
        }

        // bass (every enabled bass slot follows the chord root).
        // Skipped entirely when the bass layer is OFF (settings are kept).
        if (layers.bass) {
        const bassStyle = p.bass?.styleId ?? "root";
        const bassOct = Number.isFinite(p.bass?.octave) ? (p.bass.octave as number) : 1;
        const bassVol = Number.isFinite(p.bass?.volume) ? (p.bass.volume as number) : 0.85;
        // Loop-invariant per chord slot: parse once, not once per bass slot.
        const rootMidi = chordMidis(sym, 1)[0] + bassOct * 12 - 12;
        for (const bassSlot of allowedSlots(secIdx, "bass")) {
          curSample = bankForSlot(bassSlot.group, bassSlot.name) ?? undefined;
          curFam = bassSlot.group;
          const bv = (bassSlot.volume * bassVol) * energyFactor;
          const st = bassStyle;
          if (st === "sustained" || st === "sub") {
            pushNote({ time: start, midi: rootMidi, dur, synth: "bass", vol: bv, pan: bassSlot.pan });
          } else if (st === "octave") {
            pushNote({ time: start, midi: rootMidi, dur: spq * 0.9, synth: "bass", vol: bv, pan: bassSlot.pan });
            pushNote({ time: start + spq * (beatsPerChordQ / 2), midi: rootMidi + 12, dur: spq * 0.9, synth: "bass", vol: bv * 0.9, pan: bassSlot.pan });
          } else if (st === "arp") {
            [0, 7, 12, 7].forEach((iv, k) => {
              pushNote({ time: start + k * spq * 0.5, midi: rootMidi + iv, dur: spq * 0.4, synth: "bass", vol: bv * 0.85, pan: bassSlot.pan });
            });
          } else if (st === "rhythmic" || st === "electronic" || st === "custom") {
            const rawPat = Array.isArray(p.bass?.pattern) ? p.bass.pattern : [];
            const pat = (rawPat.length > 0 ? rawPat.slice(0, 64) : defaultBassGate(st, beatsPerChordQ));
            const steps = pat.length;
            const stepDur = (beatsPerChordQ * spq) / steps;
            pat.forEach((on, k) => {
              if (on) pushNote({ time: start + k * stepDur, midi: rootMidi, dur: stepDur * 0.9, synth: "bass", vol: bv * 0.9, pan: bassSlot.pan });
            });
          } else {
            pushNote({ time: start, midi: rootMidi, dur: spq * 1.8, synth: "bass", vol: bv, pan: bassSlot.pan });
          }
        }
        } // layers.bass

        // melody leads — generated per chord slot.
        // Skipped entirely when the melody layer is OFF (settings are kept).
        if (layers.melody) {
        // Section-invariant: compute once per section, not once per slot.
        let leads = leadCache.get(secIdx);
        if (!leads) {
          // Melody voices: pluck/synth leads plus winds (flute, clarinet).
          // Winds fall back to the smooth "atmos" timbre when unsampled.
          leads = (Array.isArray(p.instruments) ? p.instruments : []).filter(
            (i) => (i.group === "plucks" || i.group === "synth" || i.group === "winds") && i.enabled && i.role === "melody"
          ).filter((l) => {
            const sec = sections[secIdx];
            return !sec || !Array.isArray(sec.instruments) || sec.instruments.length === 0 || sec.instruments.includes(l.id);
          });
          leadCache.set(secIdx, leads);
        }
        if (leads.length > 0 && energy >= 3) {
          const mel = generateMelody([sym], beatsPerChordQ, tonicPc, scaleKind, `${p.originality?.melodySeed ?? "x"}:${secIdx}:${ci}`, melodyDensity * (0.5 + energy / 14));
          for (const lead of leads) {
            curSample = bankForSlot(lead.group, lead.name) ?? undefined;
          curFam = lead.group;
            for (const n of mel) {
              pushNote({ time: start + n.startBeat * spq, midi: n.midi + lead.octave * 12, dur: n.durBeats * spq * 0.9, synth: lead.group === "synth" ? "synth" : lead.group === "winds" ? "atmos" : "pluck", vol: lead.volume * 0.65 * energyFactor, pan: lead.pan });
            }
          }
        }
        } // layers.melody
      }

      // drums for this bar. Skipped entirely when the drums layer is OFF.
      if (layers.drums) {
      for (let s = 0; s < drumSteps; s++) {
        let tt = barStart + s * drumStepDur;
        if (drumSwing > 0 && s % 2 === 1) tt += drumStepDur * drumSwing * 0.5;
        for (const { row, col, len } of drumRows) {
          if (col[s % len]) {
            // scale drums by section energy: fewer hats in low energy
            if (energy <= 3 && (row === "openhat" || row === "tom")) continue;
            const n = (rrCount.get(row) ?? 0);
            rrCount.set(row, n + 1);
            drums.push({ time: tt, row, vol: drumGroove, rr: n });
          }
        }
      }
      } // layers.drums
      absBar++;
    }
    t += secBars * barDur;
  });

  // Performance humanization (playback/render feel, never composition):
  // identical for realtime and offline. "off" skips everything, "subtle"
  // keeps the historical velocity-only behavior bit for bit, "natural" and
  // "expressive" run the centralized Human Performer plan (phrases, groove).
  applyHumanization(p, notes, drums, beatSecFor(p), sectionEnergy);
  for (const n of notes) {
    n.midi = clampMidi(n.midi);
  }

  const duration = t;
  chordMarks.sort((a, b) => a.start - b.start);

  return {
    notes,
    drums,
    duration,
    chordAt: (sec: number) => {
      let idx = 0;
      for (let i = 0; i < chordMarks.length; i++) {
        if (sec >= chordMarks[i].start - 0.001) idx = chordMarks[i].idx;
        else break;
      }
      return idx;
    },
    sectionAt: (sec: number) => {
      let si = 0;
      for (let i = 0; i < sectionStarts.length; i++) {
        if (sec >= sectionStarts[i] - 0.001) si = i;
        else break;
      }
      return si;
    },
  };
}

function defaultBassGate(style: string, beatsPerChordQ: number): boolean[] {
  const steps = beatsPerChordQ >= 4 ? 8 : 4;
  if (style === "electronic") return [true, false, false, true, false, false, true, false].slice(0, steps);
  return Array.from({ length: steps }, (_, i) => i % 2 === 0);
}

function firstIndexAtOrAfter(
  arr: { time: number }[],
  t: number
): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].time < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ── Realtime engine ──────────────────────────────────────────────

type OscType = OscillatorType;

// ── Startup failure model ──
// The engine never shows UI; it reports failures as AudioStartError with a
// stable kind so the transport bar can show one friendly line. Technical
// detail stays in console output at the call site.

export type AudioFailureKind = "unavailable" | "blocked" | "failed";

export class AudioStartError extends Error {
  readonly kind: AudioFailureKind;
  constructor(kind: AudioFailureKind, detail?: string) {
    super(detail ?? kind);
    this.name = "AudioStartError";
    this.kind = kind;
  }
}

/** Friendly, non-technical copy for each failure kind. Pure and unit-tested. */
export function describeAudioError(err: unknown): string {
  const kind = err instanceof AudioStartError ? err.kind : "failed";
  switch (kind) {
    case "unavailable":
      return "Sound isn't available in this browser. Try a recent Chrome, Edge, Firefox or Safari — your song is safe.";
    case "blocked":
      return "Your browser blocked sound. Press Play again to allow it — your song is safe.";
    case "failed":
      return "Sound couldn't start. Your song is safe — try again.";
  }
}

export class WebAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private song: BuiltSong | null = null;
  private startCtxTime = 0;
  private startOffset = 0;
  private noteIdx = 0;
  private drumIdx = 0;
  // Section start offset (absolute song seconds) and restart indices for loop.
  private playFrom = 0;
  private loopNoteIdx = 0;
  private loopDrumIdx = 0;
  private sortedNotes: NoteEvent[] = [];
  private sortedDrums: DrumEvent[] = [];
  private project: SonicProject | null = null;
  private loop = false;
  private onTick: ((s: EngineStatus) => void) | null = null;
  private volume = 0.8;
  private muted = false;
  // Start token: every play()/stop() bumps it. A play that loses a race
  // (rapid taps) aborts after its awaits instead of starting a ghost timer.
  private startToken = 0;
  // Sampled banks that failed to load for the current song (nonfatal:
  // synthesis covers). Read by the transport for the "using backup sounds" note.
  private sampleFailed: string[] = [];
  // Preview-only round-robin salt: each drum preview rotates takes.
  private previewSalt = 0;

  get analyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  /** Bank ids that failed to load for the current song (fallback: synthesis). */
  sampleIssue(): string | null {
    if (this.sampleFailed.length === 0) return null;
    return `Some sounds couldn't load, so backup synths are playing instead. Check your connection and press Play again to retry.`;
  }

  private ensure(): AudioContext {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    // Voices → master bus → gentle ceiling → analyzer → output. The ceiling
    // only contains stacked peaks; normal levels pass through untouched.
    const limiter = masterLimiter(this.ctx);
    this.master.connect(limiter);
    limiter.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    // noise buffer
    const len = this.ctx.sampleRate * 1.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return this.ctx;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.02);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.02);
  }

  isPlaying(): boolean {
    return this.timer !== null;
  }

  position(): number {
    if (!this.ctx || !this.song) return 0;
    if (!this.isPlaying()) return Math.max(0, this.startOffset);
    return Math.max(0, this.startOffset + (this.ctx.currentTime - this.startCtxTime));
  }

  duration(): number {
    return this.song?.duration ?? 0;
  }

  async play(p: SonicProject, opts: PlayOptions = {}): Promise<void> {
    const token = ++this.startToken;
    let ctx: AudioContext;
    try {
      ctx = this.ensure();
    } catch (e) {
      throw new AudioStartError("unavailable", e instanceof Error ? e.message : undefined);
    }
    try {
      await ctx.resume();
    } catch (e) {
      throw new AudioStartError("failed", e instanceof Error ? e.message : undefined);
    }
    // Lost a rapid-tap race, or stopped while resuming: never start a timer.
    if (token !== this.startToken) return;
    // Autoplay policy / OS interruption can leave the context suspended even
    // after resume(): report it instead of "playing" in silence.
    if (ctx.state !== "running") {
      throw new AudioStartError("blocked");
    }
    // Lazy multisamples for this song's instruments (+ drum hits). The
    // transport already shows "starting"; first play warms the cache.
    this.sampleFailed = [];
    try {
      const { failed } = await ensureSampleBanks(
        [...banksForProject(p.instruments), "acoustic-drums"],
        ctx
      );
      this.sampleFailed = failed;
    } catch {
      // No sample assets at all (offline test envs): pure synthesis covers.
    }
    if (token !== this.startToken) return;
    this.stop(false);
    this.project = p;
    this.loop = opts.loop ?? false;
    this.onTick = opts.onTick ?? null;
    const song = buildSongEvents(p);
    // Section start offset in seconds (absolute song time). Events keep absolute
    // times so chord/section highlighting stays correct when starting mid-song.
    let startAt = 0;
    if (opts.fromSectionId) {
      const sections = Array.isArray(p.arrangement) ? p.arrangement : [];
      const idx = sections.findIndex((s) => s.id === opts.fromSectionId);
      if (idx > 0) {
        const bpmRaw = p.config?.bpm;
        const spq = 60 / normalizeBpm(bpmRaw);
        const qpb = quarterBeatsPerBar(p.config?.timeSignature ?? "4/4");
        for (let i = 0; i < idx; i++) {
          const bars = sections[i];
          startAt += (Number.isFinite(bars?.bars) ? Math.max(0, bars.bars) : 0) * qpb * spq;
        }
      }
    }
    this.song = song;
    this.playFrom = startAt;
    this.sortedNotes = [...song.notes].sort((a, b) => a.time - b.time);
    this.sortedDrums = [...song.drums].sort((a, b) => a.time - b.time);
    this.noteIdx = firstIndexAtOrAfter(this.sortedNotes, startAt);
    this.drumIdx = firstIndexAtOrAfter(this.sortedDrums, startAt);
    this.loopNoteIdx = this.noteIdx;
    this.loopDrumIdx = this.drumIdx;
    this.startOffset = 0;
    this.startCtxTime = this.ctx!.currentTime + 0.06 - startAt;
    this.timer = setInterval(() => this.pump(), 25);
    this.pump();
  }

  private pump() {
    if (!this.ctx || !this.song || !this.master) return;
    const now = this.ctx.currentTime;
    const pos = Math.max(0, now - this.startCtxTime);
    const dur = this.song.duration;
    if (this.onTick) {
      this.onTick({
        playing: true,
        positionSec: Math.min(pos, dur),
        durationSec: dur,
        currentChordIndex: this.song.chordAt(pos),
        currentSectionIndex: this.song.sectionAt(pos),
      });
    }
    // Never pile notes while the context is suspended (e.g. OS interruption):
    // indices stay put and playback continues cleanly on resume.
    if (this.ctx.state !== "running") return;
    const ahead = now + 0.14;
    const base = this.startCtxTime;
    // Late events are clamped to now instead of dropped, so loop restarts and
    // resume points never lose their downbeat to scheduler jitter.
    while (this.noteIdx < this.sortedNotes.length) {
      const n = this.sortedNotes[this.noteIdx];
      const when = base + n.time;
      if (when > ahead) break;
      this.scheduleNote(n, Math.max(when, now));
      this.noteIdx++;
    }
    while (this.drumIdx < this.sortedDrums.length) {
      const d = this.sortedDrums[this.drumIdx];
      const when = base + d.time;
      if (when > ahead) break;
      this.scheduleDrum(d, Math.max(when, now));
      this.drumIdx++;
    }
    if (pos >= dur) {
      if (this.loop) {
        this.noteIdx = this.loopNoteIdx;
        this.drumIdx = this.loopDrumIdx;
        this.startCtxTime = this.ctx.currentTime + 0.05 - this.playFrom;
        this.startOffset = 0;
      } else {
        this.stop(true);
      }
    }
  }

  pause() {
    if (!this.isPlaying() || !this.ctx) return;
    this.startOffset = this.position();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    // Already-scheduled notes (≤0.14s ahead) ring out with natural decay.
    if (this.onTick && this.song) {
      this.onTick({
        playing: false,
        positionSec: this.startOffset,
        durationSec: this.song.duration,
        currentChordIndex: this.song.chordAt(this.startOffset),
        currentSectionIndex: this.song.sectionAt(this.startOffset),
      });
    }
  }

  async resume() {
    if (!this.project || !this.song || !this.ctx) return;
    try {
      await this.ctx.resume();
    } catch (e) {
      throw new AudioStartError("failed", e instanceof Error ? e.message : undefined);
    }
    if (this.ctx.state !== "running") {
      throw new AudioStartError("blocked");
    }
    const off = this.startOffset;
    // Re-enter the absolute event lists just ahead of the pause point so the
    // current chord re-articulates and masks the gap. Never mutate the lists.
    this.noteIdx = firstIndexAtOrAfter(this.sortedNotes, off - 0.06);
    this.drumIdx = firstIndexAtOrAfter(this.sortedDrums, off - 0.05);
    this.startOffset = 0;
    this.startCtxTime = this.ctx.currentTime - off;
    if (!this.timer) this.timer = setInterval(() => this.pump(), 25);
    this.pump();
  }

  stop(notify = true) {
    // Invalidate any play() still awaiting resume() so it can't start late.
    this.startToken++;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (notify && this.onTick && this.song) {
      this.onTick({ playing: false, positionSec: 0, durationSec: this.song.duration, currentChordIndex: 0, currentSectionIndex: 0 });
    }
    this.startOffset = 0;
  }

  /** One-shot chord preview (no scheduler). Failures are preview-only:
   * logged for debugging, never surfaced — the transport owns error UI. */
  async previewChord(symbol: string, octave = 3): Promise<void> {
    let ctx: AudioContext;
    try {
      ctx = this.ensure();
      await ctx.resume();
    } catch (e) {
      console.warn("[SonicBlueprint:audio] preview unavailable", e);
      return;
    }
    if (ctx.state !== "running") return;
    // Warm the piano bank in the background; use it as soon as it's cached.
    warmSampleBanks(["grand-piano"], ctx);
    const pianoBank = sampleCache.has("grand-piano") ? "grand-piano" : undefined;
    const midis = chordMidiNotes(symbol, octave);
    const t = ctx.currentTime + 0.02;
    midis.forEach((m) => this.voice("piano", m, t, 1.4, 0.5, 0, pianoBank));
    const root = chordMidiNotes(symbol, 1)[0] - 12;
    this.voice("bass", root, t, 1.4, 0.5, 0);
  }

  /** One-bar drum preview (same timing + swing as the arrangement). */
  async previewDrums(p: SonicProject): Promise<void> {
    let ctx: AudioContext;
    try {
      ctx = this.ensure();
      await ctx.resume();
    } catch (e) {
      console.warn("[SonicBlueprint:audio] preview unavailable", e);
      return;
    }
    if (ctx.state !== "running") return;
    warmSampleBanks(["acoustic-drums"], ctx);
    const bpmRaw = p.config?.bpm;
    const bpm = normalizeBpm(bpmRaw);
    const spq = 60 / bpm;
    const qpb = quarterBeatsPerBar(p.config?.timeSignature ?? "4/4");
    const barDur = qpb * spq;
    const drumCfg = p.drums ?? {};
    const steps = Number.isFinite(drumCfg.steps)
      ? Math.max(1, Math.min(64, Math.round(drumCfg.steps as number)))
      : 16;
    const stepDur = barDur / steps;
    const swing = Number.isFinite(drumCfg.swing) ? Math.max(0, Math.min(0.9, drumCfg.swing as number)) : 0;
    const t0 = ctx.currentTime + 0.02;
    const grid = (drumCfg.grid ?? {}) as Record<string, unknown>;
    const rows = Object.keys(grid);
    // Previews rotate takes on every press (preview-only salt; exports use
    // the deterministic event counters, never this).
    const salt = this.previewSalt++;
    for (let s = 0; s < steps; s++) {
      let tt = t0 + s * stepDur;
      if (swing > 0 && s % 2 === 1) tt += stepDur * swing * 0.5;
      for (const row of rows) {
        const col = grid[row];
        if (!Array.isArray(col) || col.length === 0) continue;
        if (col[s % col.length]) this.drumVoice(row, tt, 0.9, salt + s);
      }
    }
  }

  // ── synthesis ──
  private voice(synth: string, midi: number, when: number, dur: number, vol: number, pan: number, sample?: string) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    // Articulation + spatial profile resolve from the sampled bank when the
    // event names one; otherwise the synth fallback plays full length.
    const bankDef = sample !== undefined ? SAMPLE_BANKS[sample] : undefined;
    const edur = bankDef ? articulatedDur(bankDef, dur) : dur;
    const effPan = pan * familyPanScale(synth);
    // Sampled path first: licensed multisample when its bank is loaded and
    // covers this pitch; otherwise the synthesis below covers seamlessly.
    if (sample !== undefined) {
      const voices = sampledNoteVoices(sample, midi, vol);
      if (voices) {
        for (const v of voices) {
          playSampleVoice({
            ctx, dry: this.master, buf: v.buf, when,
            shift: v.shift, dur: edur, vol: vol * (v.def.gain ?? 1) * v.weight, pan: effPan,
            attack: bankAttack(v.def), release: bankRelease(v.def),
            roomLevel: v.def.room ?? 0, brightness: vol,
          });
        }
        return;
      }
    }
    const freq = midiToFreq(midi);
    const out = ctx.createGain();
    out.gain.value = Math.max(0.0001, Math.min(1, vol));
    let node: AudioNode = out;
    if (effPan !== 0 && typeof ctx.createStereoPanner === "function") {
      const pn = ctx.createStereoPanner();
      pn.pan.value = Math.max(-1, Math.min(1, effPan));
      out.connect(pn);
      node = pn;
    }
    node.connect(this.master);
    // Subtle per-family room send (data-driven, see mix.ts). Bass stays dry.
    roomSend(ctx, node, familyRoom(synth));

    const mk = (type: OscType, f: number, g0: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = g0;
      o.connect(g);
      g.connect(out);
      return { o, g };
    };

    const t = when;
    const d = Math.max(0.08, edur);
    switch (synth) {
      case "piano": {
        const a = mk("triangle", freq, 0.9);
        const b = mk("sine", freq * 2, 0.25);
        out.gain.setValueAtTime(0.0001, t);
        out.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.012);
        out.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(3.2, d + 1.2));
        a.o.start(t); b.o.start(t);
        a.o.stop(t + Math.min(3.4, d + 1.4)); b.o.stop(t + Math.min(3.4, d + 1.4));
        break;
      }
      case "pluck": {
        const a = mk("triangle", freq, 1);
        const b = mk("square", freq, 0.12);
        out.gain.setValueAtTime(0.0001, t);
        out.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.008);
        out.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(1.6, d + 0.5));
        a.o.start(t); b.o.start(t);
        a.o.stop(t + Math.min(1.8, d + 0.7)); b.o.stop(t + Math.min(1.8, d + 0.7));
        break;
      }
      case "synth": {
        const a = mk("sawtooth", freq, 0.55);
        const b = mk("square", freq * 1.005, 0.22);
        out.gain.setValueAtTime(0.0001, t);
        out.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.02);
        out.gain.setValueAtTime(Math.max(0.001, vol), t + Math.max(0.05, d * 0.7));
        out.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.15);
        a.o.start(t); b.o.start(t);
        a.o.stop(t + d + 0.3); b.o.stop(t + d + 0.3);
        break;
      }
      case "strings": {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.value = 2400; lp.Q.value = 0.4;
        out.disconnect(); out.connect(lp); lp.connect(this.master);
        roomSend(ctx, lp, familyRoom(synth));
        const a = mk("sawtooth", freq * 0.997, 0.4);
        const b = mk("sawtooth", freq * 1.003, 0.4);
        out.gain.setValueAtTime(0.0001, t);
        out.gain.linearRampToValueAtTime(Math.max(0.001, vol), t + Math.min(0.6, d * 0.3));
        out.gain.setValueAtTime(Math.max(0.001, vol), t + Math.max(0.1, d * 0.8));
        out.gain.linearRampToValueAtTime(0.0001, t + d + 0.4);
        a.o.start(t); b.o.start(t);
        a.o.stop(t + d + 0.6); b.o.stop(t + d + 0.6);
        break;
      }
      case "pad": {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.value = 1400; lp.Q.value = 0.3;
        out.disconnect(); out.connect(lp); lp.connect(this.master);
        roomSend(ctx, lp, familyRoom(synth));
        const a = mk("sawtooth", freq * 0.998, 0.32);
        const b = mk("sawtooth", freq * 1.002, 0.32);
        const c = mk("sine", freq / 2, 0.2);
        out.gain.setValueAtTime(0.0001, t);
        out.gain.linearRampToValueAtTime(Math.max(0.001, vol), t + Math.min(1.2, d * 0.4));
        out.gain.setValueAtTime(Math.max(0.001, vol), t + Math.max(0.2, d * 0.85));
        out.gain.linearRampToValueAtTime(0.0001, t + d + 0.6);
        a.o.start(t); b.o.start(t); c.o.start(t);
        a.o.stop(t + d + 0.8); b.o.stop(t + d + 0.8); c.o.stop(t + d + 0.8);
        break;
      }
      case "bass": {
        const a = mk("sine", freq, 0.95);
        const b = mk("triangle", freq, 0.35);
        out.gain.setValueAtTime(0.0001, t);
        out.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.015);
        out.gain.setValueAtTime(Math.max(0.001, vol), t + Math.max(0.05, d * 0.8));
        out.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12);
        a.o.start(t); b.o.start(t);
        a.o.stop(t + d + 0.3); b.o.stop(t + d + 0.3);
        break;
      }
      case "guitar": {
        const a = mk("triangle", freq, 0.8);
        const b = mk("sine", freq * 2.01, 0.18);
        out.gain.setValueAtTime(0.0001, t);
        out.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.01);
        out.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(2.2, d + 0.8));
        a.o.start(t); b.o.start(t);
        a.o.stop(t + Math.min(2.4, d + 1)); b.o.stop(t + Math.min(2.4, d + 1));
        break;
      }
      case "brass": {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.setValueAtTime(900, t);
        lp.frequency.linearRampToValueAtTime(3200, t + 0.12);
        lp.frequency.linearRampToValueAtTime(1200, t + d);
        out.disconnect(); out.connect(lp); lp.connect(this.master);
        roomSend(ctx, lp, familyRoom(synth));
        const a = mk("sawtooth", freq, 0.6);
        out.gain.setValueAtTime(0.0001, t);
        out.gain.linearRampToValueAtTime(Math.max(0.001, vol), t + 0.09);
        out.gain.setValueAtTime(Math.max(0.001, vol), t + Math.max(0.1, d * 0.7));
        out.gain.linearRampToValueAtTime(0.0001, t + d + 0.15);
        a.o.start(t); a.o.stop(t + d + 0.3);
        break;
      }
      case "atmos": {
        // airy shimmer: high sine cluster + filtered noise
        const a = mk("sine", freq * 2, 0.3);
        const b = mk("sine", freq * 2.99, 0.18);
        out.gain.setValueAtTime(0.0001, t);
        out.gain.linearRampToValueAtTime(Math.max(0.001, vol), t + Math.min(1.5, d * 0.5));
        out.gain.linearRampToValueAtTime(0.0001, t + d);
        a.o.start(t); b.o.start(t);
        a.o.stop(t + d + 0.2); b.o.stop(t + d + 0.2);
        break;
      }
      default: {
        const a = mk("triangle", freq, 0.8);
        out.gain.setValueAtTime(0.0001, t);
        out.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.012);
        out.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.2);
        a.o.start(t); a.o.stop(t + d + 0.4);
      }
    }
  }

  private scheduleNote(n: NoteEvent, when: number) {
    this.voice(n.synth, n.midi, when, n.dur, n.vol, n.pan, n.sample);
  }

  private drumVoice(row: string, when: number, vol: number, rr = 0) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const ctx = this.ctx;
    const v = Math.max(0.001, Math.min(1, vol));
    // Sampled acoustic hits first (velocity picks the recorded layer, the
    // event counter cycles round-robin takes); hats/clap/shaker/openhat
    // have no sampled equivalent and stay synth.
    const hit = sampledDrum(row, v, rr);
    if (hit) {
      playSampleVoice({
        ctx, dry: this.master, buf: hit.buf, when,
        shift: 0, dur: 0.5, vol: v * (hit.def.gain ?? 1), pan: 0,
        attack: 0.002, release: 0.06, roomLevel: hit.def.room ?? 0,
      });
      return;
    }
    if (row === "kick") {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(150, when);
      o.frequency.exponentialRampToValueAtTime(42, when + 0.11);
      g.gain.setValueAtTime(0.9 * v, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.32);
      o.connect(g); g.connect(this.master); roomSend(ctx, g, drumRoom(row));
      o.start(when); o.stop(when + 0.4);
    } else if (row === "snare") {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 1900; bp.Q.value = 0.9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.65 * v, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.19);
      src.connect(bp); bp.connect(g); g.connect(this.master); roomSend(ctx, g, drumRoom(row));
      src.start(when, Math.random()); src.stop(when + 0.25);
      const o = ctx.createOscillator();
      const g2 = ctx.createGain();
      o.type = "triangle"; o.frequency.value = 196;
      g2.gain.setValueAtTime(0.4 * v, when);
      g2.gain.exponentialRampToValueAtTime(0.001, when + 0.11);
      o.connect(g2); g2.connect(this.master); roomSend(ctx, g2, drumRoom(row));
      o.start(when); o.stop(when + 0.15);
    } else if (row === "hihat" || row === "shaker") {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = row === "shaker" ? 6000 : 7500;
      const g = ctx.createGain();
      g.gain.setValueAtTime((row === "shaker" ? 0.22 : 0.32) * v, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + (row === "shaker" ? 0.09 : 0.06));
      src.connect(hp); hp.connect(g); g.connect(this.master); roomSend(ctx, g, drumRoom(row));
      src.start(when, Math.random()); src.stop(when + 0.12);
    } else if (row === "openhat") {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 6800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.32 * v, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.42);
      src.connect(hp); hp.connect(g); g.connect(this.master); roomSend(ctx, g, drumRoom(row));
      src.start(when, Math.random()); src.stop(when + 0.5);
    } else if (row === "clap") {
      for (let k = 0; k < 3; k++) {
        const tt = when + k * 0.012;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass"; bp.frequency.value = 1300; bp.Q.value = 1.4;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5 * v, tt);
        g.gain.exponentialRampToValueAtTime(0.001, tt + 0.16);
        src.connect(bp); bp.connect(g); g.connect(this.master); roomSend(ctx, g, drumRoom(row));
        src.start(tt, Math.random()); src.stop(tt + 0.2);
      }
    } else if (row === "tom") {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(180, when);
      o.frequency.exponentialRampToValueAtTime(70, when + 0.22);
      g.gain.setValueAtTime(0.6 * v, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.3);
      o.connect(g); g.connect(this.master); roomSend(ctx, g, drumRoom(row));
      o.start(when); o.stop(when + 0.35);
    } else {
      // perc (4ms attack avoids square-wave clicks)
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(0.16 * v, when + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.07);
      o.connect(g); g.connect(this.master); roomSend(ctx, g, drumRoom(row));
      o.start(when); o.stop(when + 0.1);
    }
  }

  private scheduleDrum(d: DrumEvent, when: number) {
    this.drumVoice(d.row, when, d.vol, d.rr ?? 0);
  }
}

let singleton: WebAudioEngine | null = null;
export function getEngine(): WebAudioEngine {
  if (!singleton) singleton = new WebAudioEngine();
  return singleton;
}

// ── Offline render (shared synthesis path, OfflineAudioContext) ──
// Renders in short segments and concatenates: keeps each render graph small
// so long arrangements export reliably (progress reported per segment).

interface OfflineVoice {
  synth: string;
  midi: number;
  time: number;
  dur: number;
  vol: number;
  pan: number;
  sample?: string;
}

interface OfflineDrum {
  row: string;
  time: number;
  vol: number;
  rr?: number;
}

function scheduleSegment(
  ctx: OfflineAudioContext,
  master: GainNode,
  noiseBuf: AudioBuffer,
  notes: OfflineVoice[],
  drums: OfflineDrum[],
  mix: MixSwitches = MIX_ALL_ON
): void {
  const voice = (synth: string, midi: number, when: number, dur: number, vol: number, pan: number, sample?: string) => {
    // Mirrors realtime voice(): bank articulation/duration/pan apply first,
    // then sampled multisample or the identical synthesis fallback.
    const bankDef = sample !== undefined ? SAMPLE_BANKS[sample] : undefined;
    const edur = bankDef ? articulatedDur(bankDef, dur) : dur;
    const effPan = pan * familyPanScale(synth);
    // Sampled path mirrors realtime: multisample when loaded, else synthesis.
    if (sample !== undefined) {
      const voices = sampledNoteVoices(sample, midi, vol);
      if (voices) {
        for (const v of voices) {
          playSampleVoice({
            ctx, dry: master, buf: v.buf, when,
            shift: v.shift, dur: edur, vol: vol * (v.def.gain ?? 1) * v.weight, pan: effPan,
            attack: bankAttack(v.def), release: bankRelease(v.def),
            roomLevel: mix.sampleRoom ? v.def.room ?? 0 : 0, brightness: vol,
          });
        }
        return;
      }
    }
    const freq = midiToFreq(midi);
    const out = ctx.createGain();
    out.gain.value = Math.max(0.0001, Math.min(1, vol));
    let node: AudioNode = out;
    if (effPan !== 0 && typeof ctx.createStereoPanner === "function") {
      const pn = ctx.createStereoPanner();
      pn.pan.value = Math.max(-1, Math.min(1, effPan));
      out.connect(pn);
      node = pn;
    }
    node.connect(master);
    if (mix.synthRoom) roomSend(ctx, node, familyRoom(synth));
    const osc = (type: OscillatorType, f: number, g0: number) => {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = g0;
      o.connect(g); g.connect(out);
      return o;
    };
    const t = Math.max(0, when);
    const d = Math.max(0.08, edur);
    // Mirrors the realtime voice() timbres exactly so exports match previews.
    if (synth === "piano") {
      const a = osc("triangle", freq, 0.9);
      const b = osc("sine", freq * 2, 0.25);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.012);
      out.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(3.2, d + 1.2));
      a.start(t); b.start(t);
      a.stop(t + Math.min(3.4, d + 1.4)); b.stop(t + Math.min(3.4, d + 1.4));
    } else if (synth === "pluck") {
      const a = osc("triangle", freq, 1);
      const b = osc("square", freq, 0.12);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.008);
      out.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(1.6, d + 0.5));
      a.start(t); b.start(t);
      a.stop(t + Math.min(1.8, d + 0.7)); b.stop(t + Math.min(1.8, d + 0.7));
    } else if (synth === "synth") {
      const a = osc("sawtooth", freq, 0.55);
      const b = osc("square", freq * 1.005, 0.22);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.02);
      out.gain.setValueAtTime(Math.max(0.001, vol), t + Math.max(0.05, d * 0.7));
      out.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.15);
      a.start(t); b.start(t);
      a.stop(t + d + 0.3); b.stop(t + d + 0.3);
    } else if (synth === "bass") {
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.015);
      out.gain.setValueAtTime(Math.max(0.001, vol), t + Math.max(0.05, d * 0.8));
      out.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12);
      const a = osc("sine", freq, 0.95);
      const b = osc("triangle", freq, 0.35);
      a.start(t); b.start(t); a.stop(t + d + 0.3); b.stop(t + d + 0.3);
    } else if (synth === "guitar") {
      const a = osc("triangle", freq, 0.8);
      const b = osc("sine", freq * 2.01, 0.18);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.01);
      out.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(2.2, d + 0.8));
      a.start(t); b.start(t);
      a.stop(t + Math.min(2.4, d + 1)); b.stop(t + Math.min(2.4, d + 1));
    } else if (synth === "brass") {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.setValueAtTime(900, t);
      lp.frequency.linearRampToValueAtTime(3200, t + 0.12);
      lp.frequency.linearRampToValueAtTime(1200, t + d);
      out.disconnect(); out.connect(lp); lp.connect(master);
      if (mix.synthRoom) roomSend(ctx, lp, familyRoom(synth));
      const a = osc("sawtooth", freq, 0.6);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.linearRampToValueAtTime(Math.max(0.001, vol), t + 0.09);
      out.gain.setValueAtTime(Math.max(0.001, vol), t + Math.max(0.1, d * 0.7));
      out.gain.linearRampToValueAtTime(0.0001, t + d + 0.15);
      a.start(t); a.stop(t + d + 0.3);
    } else if (synth === "atmos") {
      const a = osc("sine", freq * 2, 0.3);
      const b = osc("sine", freq * 2.99, 0.18);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.linearRampToValueAtTime(Math.max(0.001, vol), t + Math.min(1.5, d * 0.5));
      out.gain.linearRampToValueAtTime(0.0001, t + d);
      a.start(t); b.start(t);
      a.stop(t + d + 0.2); b.stop(t + d + 0.2);
    } else if (synth === "pad" || synth === "strings") {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = synth === "pad" ? 1400 : 2400;
      if (synth === "strings") lp.Q.value = 0.4;
      else lp.Q.value = 0.3;
      out.disconnect(); out.connect(lp); lp.connect(master);
      if (mix.synthRoom) roomSend(ctx, lp, familyRoom(synth));
      out.gain.setValueAtTime(0.0001, t);
      out.gain.linearRampToValueAtTime(Math.max(0.001, vol), t + Math.min(synth === "pad" ? 1.2 : 0.6, d * (synth === "pad" ? 0.4 : 0.3)));
      out.gain.setValueAtTime(Math.max(0.001, vol), t + Math.max(synth === "pad" ? 0.2 : 0.1, d * (synth === "pad" ? 0.85 : 0.8)));
      out.gain.linearRampToValueAtTime(0.0001, t + d + (synth === "pad" ? 0.6 : 0.4));
      const a = osc("sawtooth", freq * 0.998, synth === "pad" ? 0.32 : 0.4);
      const b = osc("sawtooth", freq * 1.002, synth === "pad" ? 0.32 : 0.4);
      if (synth === "pad") {
        const c = osc("sine", freq / 2, 0.2);
        a.start(t); b.start(t); c.start(t);
        a.stop(t + d + 0.8); b.stop(t + d + 0.8); c.stop(t + d + 0.8);
      } else {
        a.start(t); b.start(t);
        a.stop(t + d + 0.6); b.stop(t + d + 0.6);
      }
    } else {
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.012);
      out.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(3.0, d + 1.0));
      const a = osc(synth === "pluck" ? "triangle" : synth === "synth" ? "sawtooth" : "triangle", freq, 0.9);
      a.start(t); a.stop(t + Math.min(3.2, d + 1.2));
    }
  };

  for (const n of notes) voice(n.synth, n.midi, n.time, n.dur, n.vol, n.pan, n.sample);

  const drum = (row: string, when: number, vol: number, rr = 0) => {
    // Mirrors realtime drumVoice; deterministic noise offset for stable exports.
    const t = Math.max(0, when);
    const v = vol;
    const hit = sampledDrum(row, v, rr);
    if (hit) {
      playSampleVoice({
        ctx, dry: master, buf: hit.buf, when: t,
        shift: 0, dur: 0.5, vol: v * (hit.def.gain ?? 1), pan: 0,
        attack: 0.002, release: 0.06, roomLevel: mix.sampleRoom ? hit.def.room ?? 0 : 0,
      });
      return;
    }
    if (row === "kick") {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
      g.gain.setValueAtTime(0.9 * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.connect(g); g.connect(master); if (mix.synthRoom) roomSend(ctx, g, drumRoom(row));
      o.start(t); o.stop(t + 0.4);
    } else if (row === "snare") {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 1900; bp.Q.value = 0.9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.65 * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
      src.connect(bp); bp.connect(g); g.connect(master); if (mix.synthRoom) roomSend(ctx, g, drumRoom(row));
      src.start(t); src.stop(t + 0.25);
      const o = ctx.createOscillator();
      const g2 = ctx.createGain();
      o.type = "triangle"; o.frequency.value = 196;
      g2.gain.setValueAtTime(0.4 * v, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      o.connect(g2); g2.connect(master); if (mix.synthRoom) roomSend(ctx, g2, drumRoom(row));
      o.start(t); o.stop(t + 0.15);
    } else if (row === "hihat" || row === "shaker") {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = row === "shaker" ? 6000 : 7500;
      const g = ctx.createGain();
      g.gain.setValueAtTime((row === "shaker" ? 0.22 : 0.32) * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (row === "shaker" ? 0.09 : 0.06));
      src.connect(hp); hp.connect(g); g.connect(master); if (mix.synthRoom) roomSend(ctx, g, drumRoom(row));
      src.start(t); src.stop(t + 0.12);
    } else if (row === "openhat") {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 6800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.32 * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      src.connect(hp); hp.connect(g); g.connect(master); if (mix.synthRoom) roomSend(ctx, g, drumRoom(row));
      src.start(t); src.stop(t + 0.5);
    } else if (row === "clap") {
      for (let k = 0; k < 3; k++) {
        const tt = t + k * 0.012;
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass"; bp.frequency.value = 1300; bp.Q.value = 1.4;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5 * v, tt);
        g.gain.exponentialRampToValueAtTime(0.001, tt + 0.16);
        src.connect(bp); bp.connect(g); g.connect(master); if (mix.synthRoom) roomSend(ctx, g, drumRoom(row));
        src.start(tt); src.stop(tt + 0.2);
      }
    } else if (row === "tom") {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.22);
      g.gain.setValueAtTime(0.6 * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g); g.connect(master); if (mix.synthRoom) roomSend(ctx, g, drumRoom(row));
      o.start(t); o.stop(t + 0.35);
    } else {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.16 * v, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      o.connect(g); g.connect(master); if (mix.synthRoom) roomSend(ctx, g, drumRoom(row));
      o.start(t); o.stop(t + 0.1);
    }
  };
  for (const d of drums) drum(d.row, d.time, d.vol, d.rr ?? 0);
}

function makeNoise(ctx: OfflineAudioContext, sr: number): AudioBuffer {
  const noiseLen = Math.floor(sr * 1.0);
  const noiseBuf = ctx.createBuffer(1, noiseLen, sr);
  const nd = noiseBuf.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < noiseLen; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    nd[i] = seed / 4294967296 * 2 - 1;
  }
  return noiseBuf;
}

export async function renderToAudioBuffer(
  p: SonicProject,
  onProgress?: (fraction: number) => void,
  mix: MixSwitches = MIX_ALL_ON
): Promise<AudioBuffer> {
  // Sampled instruments render from the same banks as playback. A throwaway
  // decode context works headless; failures fall back to synthesis silently.
  try {
    const decodeCtx = new OfflineAudioContext(1, 1, 44100);
    await ensureSampleBanks([...banksForProject(p.instruments), "acoustic-drums"], decodeCtx);
  } catch {
    /* synthesis covers */
  }
  const song = buildSongEvents(p);
  const sr = 44100;
  const SEG_SEC = 12;
  const totalSec = Math.max(0.5, song.duration);
  const totalFrames = Math.max(1, Math.ceil(totalSec * sr));
  const numSeg = Math.max(1, Math.ceil(totalSec / SEG_SEC));

  const outL = new Float32Array(totalFrames);
  const outR = new Float32Array(totalFrames);
  const TAIL_SEC = 2.5; // capture ring-outs of notes starting near a boundary

  // Single sort + index ranges: the old per-segment full-array filter was
  // O(segments × events). Partitioning reproduces the exact same windows.
  const sortedNotes = [...song.notes].sort((a, b) => a.time - b.time);
  const sortedDrums = [...song.drums].sort((a, b) => a.time - b.time);

  for (let s = 0; s < numSeg; s++) {
    const segStart = s * SEG_SEC;
    const segDur = Math.min(SEG_SEC, totalSec - segStart);
    const isLast = s === numSeg - 1;
    const renderDur = isLast ? segDur : Math.min(segDur + TAIL_SEC, totalSec - segStart);
    const segFrames = Math.max(1, Math.ceil(renderDur * sr));
    const ctx = new OfflineAudioContext(2, segFrames, sr);
    const master = ctx.createGain();
    master.gain.value = 0.9;
    // Same master chain as realtime: gentle limiter contains stacked peaks.
    if (mix.comp) {
      const limiter = masterLimiter(ctx);
      master.connect(limiter);
      limiter.connect(ctx.destination);
    } else {
      master.connect(ctx.destination);
    }
    const noiseBuf = makeNoise(ctx, sr);

    // Events STARTING in this segment's body window, re-based to segment time.
    // The extended render window (+TAIL) captures their ring-outs; the next
    // segment only picks up notes starting in its own window, so nothing doubles.
    const winEnd = segStart + segDur;
    const nn0 = firstIndexAtOrAfter(sortedNotes, segStart);
    const nn1 = firstIndexAtOrAfter(sortedNotes, winEnd);
    const notes = sortedNotes
      .slice(nn0, nn1)
      .map((n) => ({ ...n, time: n.time - segStart }));
    const nd0 = firstIndexAtOrAfter(sortedDrums, segStart);
    const nd1 = firstIndexAtOrAfter(sortedDrums, winEnd);
    const drums = sortedDrums
      .slice(nd0, nd1)
      .map((d) => ({ ...d, time: d.time - segStart }));
    scheduleSegment(ctx, master, noiseBuf, notes, drums, mix);
    const buf = await ctx.startRendering();
    const off = Math.floor(segStart * sr);
    const n0 = buf.getChannelData(0);
    const n1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : n0;
    // Main body: replace. Tail region: mix additively over next segment's start.
    const bodyLen = Math.min(Math.floor(segDur * sr), n0.length, totalFrames - off);
    for (let i = 0; i < bodyLen; i++) {
      outL[off + i] += n0[i];
      outR[off + i] += n1[i];
    }
    const tailLen = Math.min(n0.length - bodyLen, totalFrames - off - bodyLen);
    for (let i = 0; i < tailLen; i++) {
      outL[off + bodyLen + i] += n0[bodyLen + i];
      outR[off + bodyLen + i] += n1[bodyLen + i];
    }
    onProgress?.((s + 1) / numSeg);
    // Yield so progress UI paints between segments.
    await new Promise((res) => setTimeout(res, 0));
  }

  // Assemble final buffer.
  const asm = new OfflineAudioContext(2, totalFrames, sr);
  const result = asm.createBuffer(2, totalFrames, sr);
  result.copyToChannel(outL, 0);
  result.copyToChannel(outR, 1);
  return result;
}

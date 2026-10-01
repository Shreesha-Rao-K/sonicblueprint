// ── AudioEngine abstraction: UI never touches Web Audio directly. ──
// Native Web Audio synthesis (no paid backend, Vercel-safe, SSR-safe).
// Chords → notes, bass → notes, drums → events, melody → events, arrangement → timeline.

import type { SonicProject } from "./project-schema";
import { chordMidiNotes, generateMelody, midiToFreq, rootToPc } from "./music-theory";
import { getLayers } from "./project-schema";
import { MELODY_STYLES } from "@/data/styles";

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
  const spq = 60 / (Number.isFinite(bpmRaw) ? Math.max(30, Math.min(240, bpmRaw as number)) : 100);
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
}

interface DrumEvent {
  time: number;
  row: string;
  vol: number;
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

function clamp01(v: number): number {
  return Math.max(0.0001, Math.min(1, v));
}

function clampMidi(m: number): number {
  return Math.max(0, Math.min(127, Math.round(m)));
}

/** Expand arrangement + harmony into flat events. Pure function — shared by realtime + offline. */
export function buildSongEvents(p: SonicProject): BuiltSong {
  const bpmRaw = p.config?.bpm;
  const bpm = Number.isFinite(bpmRaw) ? Math.max(30, Math.min(240, bpmRaw as number)) : 100;
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
  const beatsPerChordQ = Math.max(1, Math.min(16, Math.round(p.chords?.beatsPerChord ?? 4)));
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
  sections.forEach((sec, secIdx) => {
    sectionStarts.push(t);
    const energy = Number.isFinite(sec.energy) ? Math.max(1, Math.min(10, sec.energy)) : 6;
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
          if (s.patternVariant === "broken") {
            midis.forEach((m, k) => {
              notes.push({ time: start + k * spq * 0.5, midi: m + s.octave * 12, dur: spq * 0.45, synth: "piano", vol: s.volume * 0.8 * energyFactor, pan: s.pan });
            });
          } else {
            midis.forEach((m) => {
              notes.push({ time: start, midi: m + s.octave * 12, dur: Math.min(dur, spq * 3.5), synth: "piano", vol: s.volume * 0.7 * energyFactor, pan: s.pan });
            });
          }
        }
        for (const s of allowedSlots(secIdx, "pads")) {
          midis.forEach((m) => {
            notes.push({ time: start, midi: m + s.octave * 12 - 12, dur, synth: "pad", vol: s.volume * 0.5 * energyFactor, pan: s.pan });
          });
        }
        for (const s of allowedSlots(secIdx, "strings")) {
          midis.forEach((m) => {
            notes.push({ time: start, midi: m + s.octave * 12, dur, synth: "strings", vol: s.volume * 0.5 * energyFactor, pan: s.pan });
          });
        }
        for (const s of allowedSlots(secIdx, "guitar")) {
          midis.forEach((m, k) => {
            notes.push({ time: start + k * 0.03, midi: m + 12 + s.octave * 12, dur: spq * 1.5, synth: "guitar", vol: s.volume * 0.45 * energyFactor, pan: s.pan });
          });
        }
        if (energy >= 4) {
          for (const s of allowedSlots(secIdx, "synth")) {
            if (s.role === "melody") continue; // leads handled below
            const arpNotes = [...midis, midis[0] + 12, midis[1] + 12];
            arpNotes.forEach((m, k) => {
              if ((k + bar) % 2 === 0)
                notes.push({ time: start + k * spq * 0.5, midi: m + s.octave * 12 + 12, dur: spq * 0.4, synth: "synth", vol: s.volume * 0.4 * energyFactor, pan: s.pan });
            });
          }
        }
        for (const s of allowedSlots(secIdx, "arps")) {
          const arp = [...midis, midis[0] + 12].reverse();
          arp.forEach((m, k) => {
            notes.push({ time: start + k * spq * 0.5, midi: m + s.octave * 12 + 12, dur: spq * 0.35, synth: "pluck", vol: s.volume * 0.5 * energyFactor, pan: s.pan });
          });
        }
        if (energy >= 7) {
          for (const s of allowedSlots(secIdx, "brass")) {
            midis.forEach((m) => {
              notes.push({ time: start, midi: m + s.octave * 12, dur: spq * 0.6, synth: "brass", vol: s.volume * 0.6, pan: s.pan });
            });
          }
        }
        for (const s of allowedSlots(secIdx, "atmosphere")) {
          // key-aware shimmer: chord root + fifth, two octaves up
          notes.push({ time: start, midi: midis[0] + 24 + s.octave * 12, dur, synth: "atmos", vol: s.volume * 0.25, pan: s.pan });
          notes.push({ time: start, midi: midis[0] + 31 + s.octave * 12, dur, synth: "atmos", vol: s.volume * 0.18, pan: -s.pan });
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
          const bv = (bassSlot.volume * bassVol) * energyFactor;
          const st = bassStyle;
          if (st === "sustained" || st === "sub") {
            notes.push({ time: start, midi: rootMidi, dur, synth: "bass", vol: bv, pan: bassSlot.pan });
          } else if (st === "octave") {
            notes.push({ time: start, midi: rootMidi, dur: spq * 0.9, synth: "bass", vol: bv, pan: bassSlot.pan });
            notes.push({ time: start + spq * (beatsPerChordQ / 2), midi: rootMidi + 12, dur: spq * 0.9, synth: "bass", vol: bv * 0.9, pan: bassSlot.pan });
          } else if (st === "arp") {
            [0, 7, 12, 7].forEach((iv, k) => {
              notes.push({ time: start + k * spq * 0.5, midi: rootMidi + iv, dur: spq * 0.4, synth: "bass", vol: bv * 0.85, pan: bassSlot.pan });
            });
          } else if (st === "rhythmic" || st === "electronic" || st === "custom") {
            const rawPat = Array.isArray(p.bass?.pattern) ? p.bass.pattern : [];
            const pat = (rawPat.length > 0 ? rawPat.slice(0, 64) : defaultBassGate(st, beatsPerChordQ));
            const steps = pat.length;
            const stepDur = (beatsPerChordQ * spq) / steps;
            pat.forEach((on, k) => {
              if (on) notes.push({ time: start + k * stepDur, midi: rootMidi, dur: stepDur * 0.9, synth: "bass", vol: bv * 0.9, pan: bassSlot.pan });
            });
          } else {
            notes.push({ time: start, midi: rootMidi, dur: spq * 1.8, synth: "bass", vol: bv, pan: bassSlot.pan });
          }
        }
        } // layers.bass

        // melody leads — generated per chord slot.
        // Skipped entirely when the melody layer is OFF (settings are kept).
        if (layers.melody) {
        // Section-invariant: compute once per section, not once per slot.
        let leads = leadCache.get(secIdx);
        if (!leads) {
          leads = (Array.isArray(p.instruments) ? p.instruments : []).filter(
            (i) => (i.group === "plucks" || i.group === "synth") && i.enabled && i.role === "melody"
          ).filter((l) => {
            const sec = sections[secIdx];
            return !sec || !Array.isArray(sec.instruments) || sec.instruments.length === 0 || sec.instruments.includes(l.id);
          });
          leadCache.set(secIdx, leads);
        }
        if (leads.length > 0 && energy >= 3) {
          const mel = generateMelody([sym], beatsPerChordQ, tonicPc, scaleKind, `${p.originality?.melodySeed ?? "x"}:${secIdx}:${ci}`, melodyDensity * (0.5 + energy / 14));
          for (const lead of leads) {
            for (const n of mel) {
              notes.push({ time: start + n.startBeat * spq, midi: n.midi + lead.octave * 12, dur: n.durBeats * spq * 0.9, synth: lead.group === "synth" ? "synth" : "pluck", vol: lead.volume * 0.65 * energyFactor, pan: lead.pan });
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
            drums.push({ time: tt, row, vol: drumGroove });
          }
        }
      }
      } // layers.drums
      absBar++;
    }
    t += secBars * barDur;
  });

  // Deterministic humanization + safety: identical for realtime and offline.
  // Velocity breathes ±12% per event; MIDI range clamped for crafted imports.
  for (const n of notes) {
    n.midi = clampMidi(n.midi);
    n.vol = clamp01(n.vol * (0.88 + 0.24 * hash01(Math.round(n.time * 1000) * 131 + n.midi * 17)));
  }
  const rowSeed: Record<string, number> = {
    kick: 11, snare: 23, hihat: 37, openhat: 41, clap: 53, perc: 67, tom: 79, shaker: 97,
  };
  for (const d of drums) {
    d.vol = clamp01(d.vol * (0.88 + 0.24 * hash01(Math.round(d.time * 1000) * 131 + (rowSeed[d.row] ?? 7))));
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

  get analyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  private ensure(): AudioContext {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.master.connect(this.analyser);
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
        const spq = 60 / (Number.isFinite(bpmRaw) ? Math.max(30, Math.min(240, bpmRaw as number)) : 100);
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
    const midis = chordMidiNotes(symbol, octave);
    const t = ctx.currentTime + 0.02;
    midis.forEach((m) => this.voice("piano", m, t, 1.4, 0.5, 0));
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
    const bpmRaw = p.config?.bpm;
    const bpm = Number.isFinite(bpmRaw) ? Math.max(30, Math.min(240, bpmRaw as number)) : 100;
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
    for (let s = 0; s < steps; s++) {
      let tt = t0 + s * stepDur;
      if (swing > 0 && s % 2 === 1) tt += stepDur * swing * 0.5;
      for (const row of rows) {
        const col = grid[row];
        if (!Array.isArray(col) || col.length === 0) continue;
        if (col[s % col.length]) this.drumVoice(row, tt, 0.9);
      }
    }
  }

  // ── synthesis ──
  private voice(synth: string, midi: number, when: number, dur: number, vol: number, pan: number) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const freq = midiToFreq(midi);
    const out = ctx.createGain();
    out.gain.value = Math.max(0.0001, Math.min(1, vol));
    let node: AudioNode = out;
    if (pan !== 0 && typeof ctx.createStereoPanner === "function") {
      const pn = ctx.createStereoPanner();
      pn.pan.value = Math.max(-1, Math.min(1, pan));
      out.connect(pn);
      node = pn;
    }
    node.connect(this.master);

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
    const d = Math.max(0.08, dur);
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
    this.voice(n.synth, n.midi, when, n.dur, n.vol, n.pan);
  }

  private drumVoice(row: string, when: number, vol: number) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const ctx = this.ctx;
    const v = Math.max(0.001, Math.min(1, vol));
    if (row === "kick") {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(150, when);
      o.frequency.exponentialRampToValueAtTime(42, when + 0.11);
      g.gain.setValueAtTime(0.9 * v, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.32);
      o.connect(g); g.connect(this.master);
      o.start(when); o.stop(when + 0.4);
    } else if (row === "snare") {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 1900; bp.Q.value = 0.9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.65 * v, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.19);
      src.connect(bp); bp.connect(g); g.connect(this.master);
      src.start(when, Math.random()); src.stop(when + 0.25);
      const o = ctx.createOscillator();
      const g2 = ctx.createGain();
      o.type = "triangle"; o.frequency.value = 196;
      g2.gain.setValueAtTime(0.4 * v, when);
      g2.gain.exponentialRampToValueAtTime(0.001, when + 0.11);
      o.connect(g2); g2.connect(this.master);
      o.start(when); o.stop(when + 0.15);
    } else if (row === "hihat" || row === "shaker") {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = row === "shaker" ? 6000 : 7500;
      const g = ctx.createGain();
      g.gain.setValueAtTime((row === "shaker" ? 0.22 : 0.32) * v, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + (row === "shaker" ? 0.09 : 0.06));
      src.connect(hp); hp.connect(g); g.connect(this.master);
      src.start(when, Math.random()); src.stop(when + 0.12);
    } else if (row === "openhat") {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 6800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.32 * v, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.42);
      src.connect(hp); hp.connect(g); g.connect(this.master);
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
        src.connect(bp); bp.connect(g); g.connect(this.master);
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
      o.connect(g); g.connect(this.master);
      o.start(when); o.stop(when + 0.35);
    } else {
      // perc (4ms attack avoids square-wave clicks)
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(0.16 * v, when + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.07);
      o.connect(g); g.connect(this.master);
      o.start(when); o.stop(when + 0.1);
    }
  }

  private scheduleDrum(d: DrumEvent, when: number) {
    this.drumVoice(d.row, when, d.vol);
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
}

interface OfflineDrum {
  row: string;
  time: number;
  vol: number;
}

function scheduleSegment(
  ctx: OfflineAudioContext,
  master: GainNode,
  noiseBuf: AudioBuffer,
  notes: OfflineVoice[],
  drums: OfflineDrum[]
): void {
  const voice = (synth: string, midi: number, when: number, dur: number, vol: number, pan: number) => {
    const freq = midiToFreq(midi);
    const out = ctx.createGain();
    out.gain.value = Math.max(0.0001, Math.min(1, vol));
    if (pan !== 0 && typeof ctx.createStereoPanner === "function") {
      const pn = ctx.createStereoPanner();
      pn.pan.value = Math.max(-1, Math.min(1, pan));
      out.connect(pn); pn.connect(master);
    } else {
      out.connect(master);
    }
    const osc = (type: OscillatorType, f: number, g0: number) => {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = g0;
      o.connect(g); g.connect(out);
      return o;
    };
    const t = Math.max(0, when);
    const d = Math.max(0.08, dur);
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

  for (const n of notes) voice(n.synth, n.midi, n.time, n.dur, n.vol, n.pan);

  const drum = (row: string, when: number, vol: number) => {
    // Mirrors realtime drumVoice; deterministic noise offset for stable exports.
    const t = Math.max(0, when);
    const v = vol;
    if (row === "kick") {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
      g.gain.setValueAtTime(0.9 * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.4);
    } else if (row === "snare") {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 1900; bp.Q.value = 0.9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.65 * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
      src.connect(bp); bp.connect(g); g.connect(master);
      src.start(t); src.stop(t + 0.25);
      const o = ctx.createOscillator();
      const g2 = ctx.createGain();
      o.type = "triangle"; o.frequency.value = 196;
      g2.gain.setValueAtTime(0.4 * v, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      o.connect(g2); g2.connect(master);
      o.start(t); o.stop(t + 0.15);
    } else if (row === "hihat" || row === "shaker") {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = row === "shaker" ? 6000 : 7500;
      const g = ctx.createGain();
      g.gain.setValueAtTime((row === "shaker" ? 0.22 : 0.32) * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (row === "shaker" ? 0.09 : 0.06));
      src.connect(hp); hp.connect(g); g.connect(master);
      src.start(t); src.stop(t + 0.12);
    } else if (row === "openhat") {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 6800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.32 * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      src.connect(hp); hp.connect(g); g.connect(master);
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
        src.connect(bp); bp.connect(g); g.connect(master);
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
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.35);
    } else {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.16 * v, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.1);
    }
  };
  for (const d of drums) drum(d.row, d.time, d.vol);
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
  onProgress?: (fraction: number) => void
): Promise<AudioBuffer> {
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
    master.connect(ctx.destination);
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
    scheduleSegment(ctx, master, noiseBuf, notes, drums);
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

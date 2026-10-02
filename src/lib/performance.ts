// Human Performer Engine: context-aware performance planning.
//
// V2 humanization applies independent per-note jitter. V3 instead interprets
// the composition: detect musical phrases, then shape timing, velocity and
// duration from phrase position, peaks, endings, beats and instrument family.
// Same (composition, seed, level) always performs identically; only the seed
// changes the details. Composition (pitches, rhythm, key, BPM, sections) is
// never touched — only how each note is played.

import { performHash } from "./humanize";

export type PerformLevel = "off" | "subtle" | "natural" | "expressive";

export interface PlanNote {
  time: number;
  midi: number;
  dur: number;
  vol: number;
}

export interface Phrase {
  id: number;
  start: number;
  end: number;
  /** index (within the phrase) of the melodic peak; ties go to the latest. */
  peakIdx: number;
  count: number;
}

/** Split a time-ordered note stream into phrases at rests/gaps.
 * Pure and deterministic; gap threshold is musical (beats), not arbitrary. */
export function detectPhrases(
  times: number[],
  midis: number[],
  gapSec: number
): Phrase[] {
  const phrases: Phrase[] = [];
  let start = 0;
  const flush = (endExclusive: number, id: number): void => {
    if (endExclusive <= start) return;
    let peakIdx = 0;
    for (let i = start; i < endExclusive; i++) {
      if (midis[i] >= midis[start + peakIdx]) peakIdx = i - start;
    }
    phrases.push({
      id,
      start: times[start],
      end: times[endExclusive - 1],
      peakIdx,
      count: endExclusive - start,
    });
  };
  let id = 0;
  for (let i = 1; i <= times.length; i++) {
    if (i === times.length || times[i] - times[i - 1] > gapSec) {
      flush(i, id++);
      start = i;
    }
  }
  return phrases;
}

export interface PerfProfile {
  /** total timing budget each way, milliseconds (phrase + note shares). */
  timingMs: number;
  /** phrase-arc depth, fraction of velocity. */
  velContour: number;
  /** residual seeded jitter, fraction of velocity. */
  velJitter: number;
  /** duration wander each way, fraction. */
  durVar: number;
  /** legato overlap extension, milliseconds (0 = none). */
  legatoMs: number;
  /** first-note delay after a long rest, milliseconds (winds breathing). */
  breathMs: number;
  /** chord spread across simultaneous notes, milliseconds (piano only). */
  spreadMs: number;
  /** downbeat emphasis, fraction of velocity. */
  accent: number;
}

function prof(
  timingMs: number,
  velContour: number,
  velJitter: number,
  durVar: number,
  legatoMs: number,
  breathMs: number,
  spreadMs: number,
  accent: number
): PerfProfile {
  return { timingMs, velContour, velJitter, durVar, legatoMs, breathMs, spreadMs, accent };
}

export const PERFORM_PROFILES: Record<string, PerfProfile> = {
  piano: prof(6, 0.1, 0.05, 0.05, 0, 0, 8, 0.04),
  strings: prof(10, 0.14, 0.05, 0.06, 30, 0, 0, 0.03),
  winds: prof(7, 0.12, 0.05, 0.06, 25, 12, 0, 0.03),
  brass: prof(5, 0.12, 0.05, 0.04, 15, 0, 0, 0.06),
  harp: prof(6, 0.1, 0.05, 0.05, 0, 0, 0, 0.03),
  bass: prof(3, 0.06, 0.03, 0.04, 0, 0, 0, 0.05),
  drums: prof(2, 0, 0.04, 0, 0, 0, 0, 0.05),
  pads: prof(2, 0.04, 0.02, 0.03, 0, 0, 0, 0),
  synth: prof(6, 0.08, 0.04, 0.05, 0, 0, 0, 0.03),
  pluck: prof(6, 0.08, 0.05, 0.05, 0, 0, 0, 0.03),
  guitar: prof(6, 0.08, 0.05, 0.05, 0, 0, 0, 0.03),
  atmos: prof(4, 0.04, 0.02, 0.03, 0, 0, 0, 0),
  perc: prof(4, 0.06, 0.04, 0, 0, 0, 0, 0.03),
};

export function profileFor(fam: string | undefined, synth: string): PerfProfile {
  return PERFORM_PROFILES[fam ?? ""] ?? PERFORM_PROFILES[synth] ?? PERFORM_PROFILES["synth"];
}

export interface PlanContext {
  seed: number;
  beatSec: number;
  /** energy 1..10 per section start, for subtle dynamic shaping. */
  sections: { start: number; energy: number }[];
  /** 1 for natural, ~1.5 for expressive. */
  scale: number;
}

function energyAt(sections: { start: number; energy: number }[], time: number): number {
  let e = 6;
  for (const s of sections) {
    if (time >= s.start) e = s.energy;
    else break;
  }
  return Math.max(1, Math.min(10, e));
}

function j01(seed: number, key: number, channel: number): number {
  return performHash(seed, key, 0, channel);
}

/** Shape one phrase stream in place (time/vol/dur only). Returns nothing;
 * determinism comes from (seed, event order, profile) alone. */
export function planPhrase(
  notes: PlanNote[],
  phrase: Phrase,
  globalOffset: number,
  seed: number,
  profile: PerfProfile,
  ctx: PlanContext,
  prevGapSec: number
): void {
  const { count, peakIdx } = phrase;
  // One shared groove offset per phrase: correlated, never scattered noise.
  const groove = (j01(seed, phrase.id * 131 + 7, 11) - 0.5) * 2 * profile.timingMs * 0.4;
  let prevMidi = -1;
  let repeatFlip = 1;
  for (let k = 0; k < count; k++) {
    const n = notes[k];
    const seq = globalOffset + k;
    const pos = count > 1 ? k / (count - 1) : 0.5;
    // Triangle arc peaking at the melodic peak: rise, climax, release.
    const peakPos = count > 1 ? peakIdx / (count - 1) : 0.5;
    const rise = peakPos > 0 && peakPos < 1
      ? pos < peakPos
        ? pos / peakPos
        : (1 - pos) / (1 - peakPos)
      : Math.sin(Math.PI * pos);
    const energy = energyAt(ctx.sections, n.time) / 10;
    const isEnding = k === count - 1 && count > 1;
    const isDownbeat = Math.abs(n.time / ctx.beatSec - Math.round(n.time / ctx.beatSec)) < 0.03;
    // Timing: shared groove + small individual voice + ending ease.
    let dt = groove + (j01(seed, seq * 17 + 3, 12) - 0.5) * 2 * profile.timingMs * 0.6;
    if (isEnding) dt += Math.min(6, profile.timingMs * 0.5);
    if (k === 0 && prevGapSec > ctx.beatSec && profile.breathMs > 0) dt += profile.breathMs;
    if (n.midi === prevMidi) {
      repeatFlip = -repeatFlip;
      dt += repeatFlip * Math.min(3, profile.timingMs * 0.3);
    }
    prevMidi = n.midi;
    // Clamp: never cross a musically meaningful boundary (quarter beat).
    const maxShift = Math.min(profile.timingMs, (ctx.beatSec * 1000) / 4) * ctx.scale;
    n.time = Math.max(0, n.time + Math.max(-maxShift, Math.min(maxShift, dt)) / 1000);
    // Velocity: phrase arc + peak emphasis + ending release + downbeat.
    let vel = 1 + profile.velContour * (rise - 0.5) * ctx.scale;
    if (k === peakIdx) vel += profile.velContour * 0.5;
    if (isEnding) vel *= 1 - profile.velContour * 0.35;
    if (isDownbeat) vel *= 1 + profile.accent * (0.6 + energy * 0.08);
    vel *= 1 + (j01(seed, seq * 29 + 5, 13) - 0.5) * 2 * profile.velJitter;
    n.vol = Math.max(0.0001, Math.min(1, n.vol * vel));
    // Duration: endings bloom, legato overlaps, staccato stays short.
    const short = n.dur < ctx.beatSec * 0.3;
    let dur = n.dur * (1 + (j01(seed, seq * 41 + 9, 14) - 0.5) * 2 * profile.durVar);
    if (isEnding && !short) dur *= 1.15;
    if (short) dur = Math.min(dur, n.dur * 1.05);
    if (k + 1 < count && profile.legatoMs > 0 && !short) {
      const next = notes[k + 1];
      const gap = next.time - (n.time + dur);
      if (gap >= 0 && gap * 1000 <= 120) {
        dur = next.time - n.time + (profile.legatoMs / 1000) * 0.5;
      }
    }
    n.dur = Math.max(0.05, dur);
  }
}

/** Piano-style chord spread: simultaneous notes bloom bottom-up within a few
 * milliseconds, lower notes slightly stronger. Pads/synths excluded. */
export function planChordSpread(
  notes: PlanNote[],
  indices: number[],
  seed: number,
  spreadMs: number
): void {
  if (spreadMs <= 0 || indices.length < 2) return;
  const ordered = [...indices].sort((a, b) => notes[a].midi - notes[b].midi);
  ordered.forEach((idx, k) => {
    const n = notes[idx];
    n.time = n.time + (k / Math.max(1, ordered.length - 1)) * (spreadMs / 1000);
    n.vol = Math.max(0.0001, Math.min(1, n.vol * (k === 0 ? 1.03 : 0.99)));
  });
  void seed;
}

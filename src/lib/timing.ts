// Centralized project timing + chord-progression helpers.
//
// AUDIO, MIDI and PDF must agree about a project's BPM and about which chord
// sounds where. The audio engine historically normalized defensively at each
// call site; exporters read raw config values. This module is the single
// source of truth both sides import, so malformed imports can never produce
// division-by-zero, Infinity timing, or diverging progressions.

import type { SonicProject } from "./project-schema";

export const BPM_MIN = 30;
export const BPM_MAX = 240;
export const BPM_DEFAULT = 100;

/** Clamp any input to the musical BPM range. Non-numbers (undefined, NaN,
 * Infinity, strings, null) fall back to BPM_DEFAULT — never NaN/Infinity. */
export function normalizeBpm(v: unknown, fallback = BPM_DEFAULT): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.max(BPM_MIN, Math.min(BPM_MAX, v));
}

/** Seconds per quarter-note beat for a project. Always finite and positive. */
export function beatSecOf(p: SonicProject): number {
  return 60 / normalizeBpm(p.config?.bpm);
}

/** Quarter-note beats per bar. Mirrors the engine's mapping exactly. */
export function quarterBeatsOf(timeSignature: unknown): number {
  if (timeSignature === "6/8") return 3;
  if (timeSignature === "12/8") return 6;
  if (timeSignature === "3/4") return 3;
  return 4;
}

/** Sanitized chord symbols: capped, non-strings replaced, never empty. */
export function normalizedChordSymbols(p: SonicProject): string[] {
  const raw = Array.isArray(p.chords?.chords) && p.chords.chords.length > 0
    ? p.chords.chords
    : ["Am"];
  return raw
    .slice(0, 64)
    .map((c) => (typeof c === "string" ? c : "Am"));
}

/** Chord slots per bar, clamped exactly like the audio engine. Non-finite
 * input falls back to the 4-beat default (validated projects always carry a
 * finite value; this only guards hand-built or imported edge cases). */
export function normalizedBeatsPerChord(p: SonicProject): number {
  const raw = p.chords?.beatsPerChord;
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : 4;
  return Math.max(1, Math.min(16, n));
}

export interface ChordSlot {
  sectionIdx: number;
  /** Bars from song start at this slot's bar. */
  absBar: number;
  /** Integer quarter-note offset from song start. */
  slotQ: number;
  /** Monotonic chord-slot index from song start. */
  slotIdx: number;
  /** Index into the chord list (wraps). */
  chordIdx: number;
  symbol: string;
}

/** Flat chord timeline across the whole arrangement, in song order.
 * Uses the accumulated arrangement position (not a per-section bar counter),
 * so a VERSE after a 4-bar INTRO continues the progression instead of
 * restarting it. Long chord durations articulate once per slot, matching
 * buildSongEvents(). Pure and deterministic. */
export function chordSlots(p: SonicProject): ChordSlot[] {
  const chords = normalizedChordSymbols(p);
  const beatsPerChordQ = normalizedBeatsPerChord(p);
  const qpb = quarterBeatsOf(p.config?.timeSignature ?? "4/4");
  const sections = (Array.isArray(p.arrangement) ? p.arrangement : []).slice(0, 128);
  const out: ChordSlot[] = [];
  const chordsInBar = Math.max(1, Math.round(qpb / beatsPerChordQ));
  let absBar = 0;
  let lastSlotIdx = -1;
  sections.forEach((sec, secIdx) => {
    const secBars = Number.isFinite(sec?.bars)
      ? Math.max(1, Math.min(64, Math.round(sec.bars)))
      : 4;
    for (let bar = 0; bar < secBars; bar++) {
      for (let c = 0; c < chordsInBar; c++) {
        const slotQ = absBar * qpb + c * beatsPerChordQ;
        const slotIdx = Math.floor(slotQ / beatsPerChordQ);
        if (slotIdx === lastSlotIdx) continue;
        lastSlotIdx = slotIdx;
        const ci = ((slotIdx % chords.length) + chords.length) % chords.length;
        out.push({
          sectionIdx: secIdx,
          absBar,
          slotQ,
          slotIdx,
          chordIdx: ci,
          symbol: chords[ci],
        });
      }
      absBar++;
    }
  });
  return out;
}

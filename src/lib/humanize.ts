// Deterministic performance humanization: performed feel without touching
// the composition. Same (project seed, events) always renders the same
// performance; a new melody seed performs it differently.
//
// Applied ONLY in buildSongEvents (playback + MP3 render). MIDI export is a
// separate path with fixed reference velocities and never sees this — MIDI
// is composition data, not a rendered performance.

export type HumanizeLevel = "off" | "subtle" | "natural";

export interface FamilyFeel {
  /** Max timing wander each way, milliseconds. */
  timingMs: number;
  /** Max velocity scaling each way, fraction. */
  vel: number;
  /** Max duration scaling each way, fraction. */
  dur: number;
}

export const FAMILY_FEEL: Record<string, FamilyFeel> = {
  piano: { timingMs: 6, vel: 0.1, dur: 0.05 },
  strings: { timingMs: 14, vel: 0.12, dur: 0.06 },
  brass: { timingMs: 8, vel: 0.1, dur: 0.05 },
  guitar: { timingMs: 6, vel: 0.1, dur: 0.05 },
  pluck: { timingMs: 6, vel: 0.1, dur: 0.05 },
  synth: { timingMs: 6, vel: 0.08, dur: 0.05 },
  pad: { timingMs: 2, vel: 0.05, dur: 0.03 },
  atmos: { timingMs: 4, vel: 0.05, dur: 0.03 },
  bass: { timingMs: 3, vel: 0.06, dur: 0.04 },
  perc: { timingMs: 4, vel: 0.08, dur: 0 },
};

/** Drum rows share the family idea: kit stays tight, shakers breathe. */
export function drumFeel(row: string): FamilyFeel {
  switch (row) {
    case "kick":
    case "snare":
    case "tom":
      return { timingMs: 2, vel: 0.08, dur: 0 };
    default:
      return { timingMs: 4, vel: 0.08, dur: 0 };
  }
}

export function familyFeel(synth: string): FamilyFeel {
  return FAMILY_FEEL[synth] ?? { timingMs: 6, vel: 0.08, dur: 0.04 };
}

/** FNV-1a string hash: the project seed as a 32-bit number. */
export function seedHash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic 0..1 from (seed, event identity, channel). Integer mix
 * (imul/xorshift): stable across engines, renders and exports. */
export function performHash(seed: number, timeMs: number, id: number, channel: number): number {
  let x = (seed ^ Math.imul(timeMs | 0, 0x85ebca6b) ^ Math.imul(id, 0xc2b2ae35) ^ Math.imul(channel, 0x27d4eb2d)) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d);
  x ^= x >>> 12;
  x = Math.imul(x, 0x297a2d39);
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}

export function normalizeLevel(level: unknown): HumanizeLevel {
  return level === "off" || level === "natural" ? level : "subtle";
}

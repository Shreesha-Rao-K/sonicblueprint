// Studio mix architecture (conservative, data-driven).
//
// Voices → [per-family room send] → master bus → gentle limiter → output.
// - No per-instrument compression; one transparent soft-clip ceiling catches
//   only stacked peaks (bit-exact below 0.9), so normal levels pass untouched.
// - Room is subtle generated ambience (see getRoomInput in audio-engine),
//   sent per family, never an obvious echo.
// - Everything here is data: families and the master chain are presets,
//   not per-voice hacks. Realtime and offline build the same chain.

export interface FamilyMix {
  /** Room send level 0..1 (0 = dry). */
  room: number;
}

export const FAMILY_MIX: Record<string, FamilyMix> = {
  piano: { room: 0.1 },
  strings: { room: 0.14 },
  brass: { room: 0.1 },
  pad: { room: 0.12 },
  atmos: { room: 0.12 },
  guitar: { room: 0.08 },
  pluck: { room: 0.06 },
  synth: { room: 0.05 },
  bass: { room: 0 },
  perc: { room: 0.05 },
};

/** Drum rows share the family idea: transients stay dry-ish, shells breathe. */
export const DRUM_SEND: Record<string, number> = {
  kick: 0.06,
  snare: 0.08,
  tom: 0.08,
  perc: 0.06,
  clap: 0.04,
  openhat: 0.03,
  hihat: 0.02,
  shaker: 0.02,
};

export interface MasterChain {
  /** Signals below this level pass through bit-exactly. */
  linearUpTo: number;
  /** Absolute output ceiling (prevents harsh digital clipping). */
  ceiling: number;
  /** Curve resolution. */
  points: number;
}

export const MASTER_CHAIN: MasterChain = {
  linearUpTo: 0.9,
  ceiling: 1.0,
  points: 1024,
};

/** Soft-clip transfer curve: identity below `linearUpTo`, smooth tanh blend
 * to `ceiling` above. Pure function of the preset — realtime and offline
 * build the identical curve, so renders match exactly. */
export function makeSoftClipCurve(chain: MasterChain = MASTER_CHAIN): Float32Array<ArrayBuffer> {
  const values: number[] = [];
  for (let i = 0; i < chain.points; i++) {
    const x = (i / (chain.points - 1)) * 2 - 1;
    const ax = Math.abs(x);
    let y: number;
    if (ax <= chain.linearUpTo) {
      y = ax;
    } else {
      const t = (ax - chain.linearUpTo) / (1 - chain.linearUpTo);
      y = chain.linearUpTo + (chain.ceiling - chain.linearUpTo) * Math.tanh(3 * t) / Math.tanh(3);
    }
    values.push(Math.sign(x) * Math.min(y, chain.ceiling));
  }
  return Float32Array.from(values);
}

/** Render-time mix switches (QA + tests). Production always uses all-on. */
export interface MixSwitches {
  /** Sample-voice room sends on/off. */
  sampleRoom: boolean;
  /** Synth-voice room sends on/off. */
  synthRoom: boolean;
  /** Master limiter on/off. */
  comp: boolean;
}

export const MIX_ALL_ON: MixSwitches = { sampleRoom: true, synthRoom: true, comp: true };
export const MIX_DRY: MixSwitches = { sampleRoom: false, synthRoom: false, comp: false };
/** Previous behavior: sampled room only, no synth room, no limiter. */
export const MIX_LEGACY: MixSwitches = { sampleRoom: true, synthRoom: false, comp: false };

export function familyRoom(synth: string): number {
  return FAMILY_MIX[synth]?.room ?? 0;
}

export function drumRoom(row: string): number {
  return DRUM_SEND[row] ?? 0;
}

/** Stereo placement scale per synth family. Low-frequency families stay near
 * center for mono compatibility; everything else passes pan through.
 * Narrowing only — never widens, never invents stereo. */
export function familyPanScale(synth: string): number {
  if (synth === "bass") return 0.3;
  return 1;
}

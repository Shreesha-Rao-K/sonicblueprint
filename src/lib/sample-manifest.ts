// Licensed sample manifest: which files back each sampled bank.
// - Grand Piano: Salamander Grand Piano v3 (Yamaha C5), Alexander Holm,
//   CC-BY-3.0. Three genuine velocities (v5 soft / v12 mf / v16 ff).
//   Recorded every minor 3rd, so runtime pitch shift never exceeds ±2 semitones.
// - Strings/brass/drums: VSCO-2 Community Edition, Versilian Studios, CC0-1.0.
//   Violin v1+v2, cello v1+v3, trumpet v1+v2+v3 are measured dynamic layers
//   (v3 ≈ +14–19 dB over v1); drums carry per-hit velocity layers.
// Full attributions in THIRD-PARTY-NOTICES.md. MP3s are converted subsets
// (44.1kHz); see scripts/make-samples.md for the exact recipe.
import type { SampleBankDef, SampleNote } from "./sample-bank";
import { INSTRUMENT_DEFS } from "@/data/styles";

type VelLayer = { minVel: number; sub: string };

/** Build layered notes: same pitches, one recorded file per dynamic layer. */
function velNotes(
  pairs: [string, number][],
  dir: string,
  layers: VelLayer[]
): SampleNote[] {
  return pairs.map(([n, midi]) => ({
    midi,
    layers: layers.map((l) => ({ minVel: l.minVel, url: `/samples/${dir}/${l.sub}/${n}.mp3` })),
  }));
}

const PIANO: [string, number][] = [
  ["A1", 33], ["C2", 36], ["Eb2", 39], ["Gb2", 42], ["A2", 45], ["C3", 48],
  ["Eb3", 51], ["Gb3", 54], ["A3", 57], ["C4", 60], ["Eb4", 63], ["Gb4", 66],
  ["A4", 69], ["C5", 72], ["Eb5", 75], ["Gb5", 78], ["A5", 81], ["C6", 84],
  ["Eb6", 87], ["Gb6", 90], ["A6", 93], ["C7", 96],
];
const PIANO_LAYERS: VelLayer[] = [
  { minVel: 0, sub: "soft" },
  { minVel: 0.45, sub: "med" },
  { minVel: 0.75, sub: "loud" },
];

export const GRAND_PIANO_BANK: SampleBankDef = {
  id: "grand-piano",
  articulation: "natural",
  kind: "pitched",
  notes: velNotes(PIANO, "piano", PIANO_LAYERS),
  attack: 0.004,
  release: 1.2,
  gain: 0.9,
  maxShift: 2,
  room: 0.14,
};

const VIOLIN: [string, number][] = [
  ["G2", 43], ["A2", 45], ["B2", 47], ["D3", 50], ["Gb3", 54], ["A3", 57],
  ["C4", 60], ["E4", 64], ["G4", 67], ["B4", 71], ["D5", 74],
];

export const VIOLIN_ENSEMBLE_BANK: SampleBankDef = {
  id: "violin-ensemble",
  articulation: "sustain-vibrato",
  kind: "pitched",
  notes: velNotes(VIOLIN, "violin", [
    { minVel: 0, sub: "soft" },
    { minVel: 0.55, sub: "loud" },
  ]),
  attack: 0.09,
  release: 0.45,
  gain: 0.8,
  maxShift: 2,
  room: 0.2,
};

const CELLO: [string, number][] = [
  ["C1", 24], ["E1", 28], ["G1", 31], ["B1", 35], ["D2", 38], ["F2", 41],
  ["A2", 45], ["C3", 48], ["E3", 52], ["G3", 55], ["B3", 59], ["D4", 62], ["F4", 65],
];

export const CELLO_BANK: SampleBankDef = {
  id: "cello",
  articulation: "sustain",
  kind: "pitched",
  notes: velNotes(CELLO, "cello", [
    { minVel: 0, sub: "soft" },
    { minVel: 0.55, sub: "loud" },
  ]),
  attack: 0.1,
  release: 0.5,
  gain: 0.85,
  maxShift: 2,
  room: 0.2,
};

const TRUMPET: [string, number][] = [
  ["F2", 41], ["A2", 45], ["C3", 48], ["Eb3", 51], ["F3", 53],
  ["G3", 55], ["Bb3", 58], ["D4", 62], ["F4", 65], ["A4", 69], ["C5", 72],
];

export const TRUMPET_BANK: SampleBankDef = {
  id: "trumpet",
  articulation: "staccato",
  kind: "pitched",
  notes: velNotes(TRUMPET, "trumpet", [
    { minVel: 0, sub: "soft" },
    { minVel: 0.45, sub: "med" },
    { minVel: 0.75, sub: "loud" },
  ]),
  attack: 0.02,
  release: 0.18,
  gain: 0.85,
  maxShift: 2,
  room: 0.12,
};

const HORN: [string, number][] = [
  ["A0", 21], ["C1", 24], ["Eb1", 27], ["G1", 31], ["Bb1", 34],
  ["D2", 38], ["F2", 41], ["A2", 45], ["C3", 48], ["D4", 62], ["F4", 65],
];

export const FRENCH_HORN_BANK: SampleBankDef = {
  id: "french-horn",
  articulation: "sustain",
  kind: "pitched",
  // Single mf layer (gain-only velocity). Range hole C#3–C4 falls back
  // to synthesis; documented in scripts/make-samples.md.
  notes: velNotes(HORN, "horn", [{ minVel: 0, sub: "sus" }]),
  attack: 0.12,
  release: 0.5,
  gain: 0.8,
  maxShift: 2,
  room: 0.18,
};

const FLUTE: [string, number][] = [
  ["C3", 48], ["E3", 52], ["A3", 57], ["C4", 60], ["E4", 64],
  ["A4", 69], ["C5", 72], ["E5", 76], ["A5", 81], ["C6", 84],
];

export const FLUTE_BANK: SampleBankDef = {
  id: "flute",
  articulation: "sustain-vibrato",
  kind: "pitched",
  notes: velNotes(FLUTE, "flute", [{ minVel: 0, sub: "sus" }]),
  attack: 0.09,
  release: 0.45,
  gain: 0.8,
  maxShift: 2,
  room: 0.16,
};

const CLARINET: [string, number][] = [
  ["D2", 38], ["F2", 41], ["Bb2", 46], ["D3", 50], ["F3", 53],
  ["Bb3", 58], ["D4", 62], ["F4", 65], ["Bb4", 70], ["D5", 74], ["Gb5", 78],
];

export const CLARINET_BANK: SampleBankDef = {
  id: "clarinet",
  articulation: "sustain",
  kind: "pitched",
  notes: velNotes(CLARINET, "clarinet", [{ minVel: 0, sub: "sus" }]),
  attack: 0.07,
  release: 0.4,
  gain: 0.8,
  maxShift: 2,
  room: 0.14,
};

const HARP: [string, number][] = [
  ["E1", 28], ["G1", 31], ["B1", 35], ["D2", 38], ["F2", 41], ["A2", 45],
  ["C3", 48], ["E3", 52], ["G3", 55], ["B3", 59], ["D4", 62], ["F4", 65],
  ["A4", 69], ["C5", 72], ["E5", 76], ["G5", 79], ["B5", 83], ["D6", 90],
];

export const HARP_BANK: SampleBankDef = {
  id: "harp",
  articulation: "pluck",
  kind: "pitched",
  notes: velNotes(HARP, "harp", [{ minVel: 0, sub: "pluck" }]),
  attack: 0.004,
  release: 0.9,
  gain: 0.85,
  maxShift: 2,
  room: 0.12,
};

export const ACOUSTIC_DRUMS_BANK: SampleBankDef = {
  id: "acoustic-drums",
  articulation: "hit",
  kind: "drums",
  // A pitched fallback note so the def validates; drum rows carry the hits.
  notes: [{ midi: 60, layers: [{ minVel: 0, url: "/samples/drums/snare_med.mp3" }] }],
  rows: {
    kick: [
      { minVel: 0, urls: ["/samples/drums/kick_soft.mp3", "/samples/drums/kick_soft2.mp3"] },
      { minVel: 0.45, urls: ["/samples/drums/kick_med.mp3", "/samples/drums/kick_med2.mp3"] },
      { minVel: 0.75, urls: ["/samples/drums/kick_loud.mp3", "/samples/drums/kick_loud2.mp3"] },
    ],
    snare: [
      { minVel: 0, urls: ["/samples/drums/snare_soft.mp3", "/samples/drums/snare_soft2.mp3"] },
      { minVel: 0.45, urls: ["/samples/drums/snare_med.mp3", "/samples/drums/snare_med2.mp3"] },
      { minVel: 0.75, urls: ["/samples/drums/snare_loud.mp3", "/samples/drums/snare_loud2.mp3"] },
    ],
    tom: [
      { minVel: 0, urls: ["/samples/drums/tom_soft.mp3", "/samples/drums/tom_soft2.mp3"] },
      { minVel: 0.55, urls: ["/samples/drums/tom_loud.mp3", "/samples/drums/tom_loud2.mp3"] },
    ],
    perc: [
      { minVel: 0, urls: ["/samples/drums/perc_soft.mp3", "/samples/drums/perc_soft2.mp3"] },
      { minVel: 0.55, urls: ["/samples/drums/perc_loud.mp3", "/samples/drums/perc_loud2.mp3"] },
    ],
  },
  attack: 0.002,
  release: 0.05,
  gain: 0.9,
  room: 0.1,
};

/** All bundled banks, keyed for the engine + tests. */
export const SAMPLE_BANKS: Record<string, SampleBankDef> = {
  "grand-piano": GRAND_PIANO_BANK,
  "violin-ensemble": VIOLIN_ENSEMBLE_BANK,
  cello: CELLO_BANK,
  trumpet: TRUMPET_BANK,
  "french-horn": FRENCH_HORN_BANK,
  flute: FLUTE_BANK,
  clarinet: CLARINET_BANK,
  harp: HARP_BANK,
  "acoustic-drums": ACOUSTIC_DRUMS_BANK,
};

/** Sampled bank id for an instrument slot, or null for pure synthesis.
 * Looks up the canonical def by group + name; unknown/custom slots stay synth. */
export function bankForSlot(group: string, name: string): string | null {
  return INSTRUMENT_DEFS.find((d) => d.group === group && d.name === name)?.sampleBank ?? null;
}

/** Bank ids referenced by a project's instruments (for lazy preload). */
export function banksForProject(instruments: { group: string; name: string; enabled: boolean }[]): string[] {
  const out = new Set<string>();
  for (const s of instruments) {
    if (!s.enabled) continue;
    const b = bankForSlot(s.group, s.name);
    if (b) out.add(b);
  }
  return [...out];
}

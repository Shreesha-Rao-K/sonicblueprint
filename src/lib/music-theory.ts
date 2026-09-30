// ── Music theory core: notes, scales, chords, transposition ──
// No dependencies. All functions pure.

export const SHARP_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const;
export const FLAT_NAMES = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"] as const;

export type ScaleKind = "major" | "minor" | "dorian" | "mixolydian" | "phrygian" | "lydian" | "harmonicMinor" | "pentMajor" | "pentMinor";

export const SCALE_INTERVALS: Record<ScaleKind, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  pentMajor: [0, 2, 4, 7, 9],
  pentMinor: [0, 3, 5, 7, 10],
};

const NOTE_TO_PC: Record<string, number> = {
  C: 0, "B#": 0,
  "C#": 1, Db: 1,
  D: 2,
  "D#": 3, Eb: 3,
  E: 4, Fb: 4,
  "E#": 5, F: 5,
  "F#": 6, Gb: 6,
  G: 7,
  "G#": 8, Ab: 8,
  A: 9,
  "A#": 10, Bb: 10,
  B: 11, Cb: 11,
};

export function normalizeRoot(root: string): string {
  const t = root.trim();
  if (t.length === 0) return "C";
  const letter = t[0].toUpperCase();
  const acc = t.slice(1);
  if (acc === "#" || acc === "b" || acc === "♭" || acc === "♯") {
    const a = acc === "♭" ? "b" : acc === "♯" ? "#" : acc;
    return letter + a;
  }
  if (acc === "##" || acc === "bb") return letter + acc[0];
  return letter;
}

export function rootToPc(root: string): number {
  const n = normalizeRoot(root);
  const v = NOTE_TO_PC[n];
  if (v === undefined) return 0;
  return v;
}

export function pcToName(pc: number, preferFlats = true): string {
  const i = ((pc % 12) + 12) % 12;
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[i];
}

/** Parse chord symbol into root + quality. Supports m, min, maj, M, dim, aug, sus2/4, 7, maj7, m7, 9, add9, 5, etc. */
export interface ParsedChord {
  root: string;
  rootPc: number;
  quality: string; // canonical: maj, min, dim, aug, sus2, sus4, 7, maj7, m7, mMaj7, dim7, 9, m9, add9, 5, sus47...
  bass?: string;
}

export function parseChord(symbol: string): ParsedChord {
  const raw = symbol.trim();
  // slash bass
  const slashIdx = raw.indexOf("/");
  let main = raw;
  let bass: string | undefined;
  if (slashIdx > 0) {
    main = raw.slice(0, slashIdx);
    bass = normalizeRoot(raw.slice(slashIdx + 1));
  }
  const m = main.match(/^([A-Ga-g])([#b♭♯]?)(.*)$/);
  if (!m) return { root: "C", rootPc: 0, quality: "maj", bass };
  const root = normalizeRoot(m[1] + (m[2] || ""));
  const suffix = (m[3] || "").trim();
  const s = suffix.toLowerCase().replace(/\s+/g, "");
  let quality = "maj";
  if (s === "" || s === "maj" || s === "M".toLowerCase() && suffix === "M") quality = "maj";
  else if (s === "m" || s === "min" || s === "-") quality = "min";
  else if (s === "dim" || s === "°" || s === "mb5") quality = "dim";
  else if (s === "aug" || s === "+") quality = "aug";
  else if (s === "sus2") quality = "sus2";
  else if (s === "sus4" || s === "sus") quality = "sus4";
  else if (s === "7sus4" || s === "7sus") quality = "sus47";
  else if (s === "7") quality = "7";
  // NOTE: minor-7 is checked before major-7 because suffixes are lowercased
  // first, so "m7" must not fall into the "maj7" branch.
  else if (s === "m7" || s === "min7" || s === "-7") quality = "m7";
  else if (s === "maj7" || s === "∆7") quality = "maj7";
  else if (s === "mmaj7" || s === "m(maj7)") quality = "mMaj7";
  else if (s === "dim7" || s === "°7") quality = "dim7";
  else if (s === "m7b5" || s === "ø" || s === "ø7") quality = "m7b5";
  else if (s === "9" || s === "add9" || s === "add2") quality = "add9";
  else if (s === "m9" || s === "min9") quality = "m9";
  else if (s === "maj9") quality = "maj9";
  else if (s === "6" || s === "maj6") quality = "6";
  else if (s === "m6") quality = "m6";
  else if (s === "5" || s === "power") quality = "5";
  else if (s.includes("sus2")) quality = "sus2";
  else if (s.includes("sus4") || s.includes("sus")) quality = "sus4";
  else if (s.startsWith("m") || s.startsWith("min")) quality = "min";
  else quality = "maj";
  // fix: suffix exactly "M" means major
  if (suffix === "M") quality = "maj";
  return { root, rootPc: rootToPc(root), quality, bass };
}

const CHORD_INTERVALS: Record<string, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  sus47: [0, 5, 7, 10],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  mMaj7: [0, 3, 7, 11],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  add9: [0, 4, 7, 14],
  m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  "6": [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  "5": [0, 7],
};

export function chordIntervals(quality: string): number[] {
  return CHORD_INTERVALS[quality] ?? CHORD_INTERVALS["maj"];
}

/** MIDI note number for root at given octave (C4 = 60). */
export function rootMidi(rootPc: number, octave = 3): number {
  return (octave + 1) * 12 + rootPc;
}

export function chordMidiNotes(symbol: string, octave = 3): number[] {
  const p = parseChord(symbol);
  const base = rootMidi(p.rootPc, octave);
  return chordIntervals(p.quality).map((iv) => base + iv);
}

export function midiToName(midi: number, preferFlats = true): string {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return pcToName(pc, preferFlats) + oct;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Transpose a chord symbol by semitones, preserving quality. */
export function transposeChord(symbol: string, semitones: number): string {
  const p = parseChord(symbol);
  const newPc = (((p.rootPc + semitones) % 12) + 12) % 12;
  const newRoot = pcToName(newPc, true);
  const suffix = qualitySuffix(p.quality, symbol);
  const bass = p.bass
    ? "/" + pcToName((((rootToPc(p.bass) + semitones) % 12) + 12) % 12, true)
    : "";
  return newRoot + suffix + bass;
}

function qualitySuffix(quality: string, original: string): string {
  // preserve original suffix text when possible by extracting it
  const m = original.match(/^([A-Ga-g][#b♭♯]?)(.*?)(\/[A-Ga-g][#b♭♯]?)?$/);
  if (m) {
    const sfx = (m[2] || "").trim();
    if (sfx) return sfx;
  }
  switch (quality) {
    case "maj": return "";
    case "min": return "m";
    default: return quality;
  }
}

/** Friendly long name: "Dm" -> "D minor". */
export function chordLongName(symbol: string): string {
  const p = parseChord(symbol);
  const rootDisp = p.root.replace("b", "♭").replace("#", "♯");
  const map: Record<string, string> = {
    maj: "major", min: "minor", dim: "diminished", aug: "augmented",
    sus2: "sus2", sus4: "sus4", sus47: "7sus4", "7": "7",
    maj7: "major 7", m7: "minor 7", mMaj7: "minor/major 7",
    dim7: "diminished 7", m7b5: "half-diminished", add9: "add9",
    m9: "minor 9", maj9: "major 9", "6": "6", m6: "minor 6", "5": "5 (power)",
  };
  return `${rootDisp} ${map[p.quality] ?? ""}`.trim();
}

/** All major + minor keys. */
export interface KeyDef { key: string; tonic: string; scale: ScaleKind; label: string; }
export const ALL_KEYS: KeyDef[] = (() => {
  const majors = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
  const minors = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];
  const out: KeyDef[] = [];
  for (const k of majors) out.push({ key: `${k} major`, tonic: k, scale: "major", label: `${k.replace("b","♭")} Major` });
  for (const k of minors) out.push({ key: `${k} minor`, tonic: k, scale: "minor", label: `${k.replace("b","♭").replace("#","♯")} Minor` });
  return out;
})();

/** Scale MIDI pcs for a tonic + scale kind. */
export function scalePcs(tonicPc: number, scale: ScaleKind): number[] {
  return SCALE_INTERVALS[scale].map((iv) => (tonicPc + iv) % 12);
}

/** Diatonic triad qualities for major/minor degrees. */
export function diatonicChord(tonicPc: number, scale: ScaleKind, degree: number): string {
  const deg = ((degree % 7) + 7) % 7;
  const ivs = SCALE_INTERVALS[scale];
  const rootPc = (tonicPc + ivs[deg]) % 12;
  const root = pcToName(rootPc, true);
  let quality = "";
  if (scale === "major") quality = ["", "m", "m", "", "", "m", "dim"][deg];
  else if (scale === "minor") quality = ["m", "dim", "", "m", "m", "", ""][deg];
  else quality = deg === 0 ? "m" : "";
  return root + quality;
}

/** Transpose whole progression when key changes: shift by tonic delta. */
export function transposeProgression(chords: string[], fromTonicPc: number, toTonicPc: number): string[] {
  const delta = (((toTonicPc - fromTonicPc) % 12) + 12) % 12;
  // choose shortest path
  const d = delta > 6 ? delta - 12 : delta;
  return chords.map((c) => transposeChord(c, d));
}

/** Deterministic pseudo-random from seed string. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** Generate a singable melody: array of {midi, beats, durBeats} over chord loop. */
export interface MelodyNote { midi: number; startBeat: number; durBeats: number; }
export function generateMelody(
  chords: string[],
  beatsPerChord: number,
  tonicPc: number,
  scale: ScaleKind,
  seed: string,
  density = 0.6
): MelodyNote[] {
  const rand = seededRandom(seed);
  const baseOct = 4;
  const baseMidi = (baseOct + 1) * 12 + tonicPc;
  const scaleMidis: number[] = [];
  for (let o = 0; o < 2; o++) {
    for (const iv of SCALE_INTERVALS[scale]) scaleMidis.push(baseMidi + iv + o * 12);
  }
  const out: MelodyNote[] = [];
  let current = scaleMidis[Math.floor(scaleMidis.length / 2)];
  chords.forEach((ch, ci) => {
    const chordTones = chordMidiNotes(ch, 4);
    const start = ci * beatsPerChord;
    const steps = Math.max(1, Math.round(beatsPerChord / 0.5));
    for (let s = 0; s < steps; s++) {
      const r = rand();
      if (r > density && s !== 0) continue; // rest
      const onChordTone = rand() < 0.55;
      let midi: number;
      if (onChordTone) {
        const ct = chordTones[Math.floor(rand() * chordTones.length)];
        midi = ct + 12; // up octave for melody
      } else {
        const step = Math.floor(rand() * 5) - 2;
        const idx = Math.max(0, Math.min(scaleMidis.length - 1, scaleMidis.indexOf(current) + step));
        midi = scaleMidis[idx] ?? current;
      }
      current = midi;
      out.push({ midi, startBeat: start + s * 0.5, durBeats: rand() < 0.25 ? 1 : 0.5 });
    }
  });
  return out;
}

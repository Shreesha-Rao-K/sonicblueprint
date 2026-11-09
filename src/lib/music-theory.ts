// ── Music theory core: notes, scales, chords, transposition ──
// No dependencies. All functions pure.

export const SHARP_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const;
export const FLAT_NAMES = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"] as const;

export type ScaleKind =
  | "major"
  | "minor"
  | "dorian"
  | "mixolydian"
  | "phrygian"
  | "lydian"
  | "harmonicMinor"
  | "pentMajor"
  | "pentMinor"
  | "blues";

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
  blues: [0, 3, 5, 6, 7, 10],
};

export interface ScaleDef {
  id: ScaleKind;
  name: string;
  description: string;
  intervals: number[];
}

export const SCALE_DEFS: ScaleDef[] = [
  { id: "minor", name: "Natural Minor (Aeolian)", description: "Emotional, melancholic, standard for ballads, pop, and dance", intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: "major", name: "Major (Ionian)", description: "Bright, uplifting, triumphant, standard pop / folk feel", intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: "dorian", name: "Dorian", description: "Jazzy, funky, soul feel with a bright major 6th", intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: "mixolydian", name: "Mixolydian", description: "Bluesy, classic rock sound with a relaxed flat 7th", intervals: [0, 2, 4, 5, 7, 9, 10] },
  { id: "lydian", name: "Lydian", description: "Dreamy, cinematic, otherworldly with a raised 4th", intervals: [0, 2, 4, 6, 7, 9, 11] },
  { id: "phrygian", name: "Phrygian", description: "Exotic, Spanish, flamenco, dark minor 2nd", intervals: [0, 1, 3, 5, 7, 8, 10] },
  { id: "harmonicMinor", name: "Harmonic Minor", description: "Classical, dramatic, neoclassical with leading tone", intervals: [0, 2, 3, 5, 7, 8, 11] },
  { id: "pentMinor", name: "Minor Pentatonic", description: "Essential rock, blues, and pop 5-note scale", intervals: [0, 3, 5, 7, 10] },
  { id: "pentMajor", name: "Major Pentatonic", description: "Pure, sweet country and gospel 5-note scale", intervals: [0, 2, 4, 7, 9] },
  { id: "blues", name: "Blues Scale", description: "Gritty, expressive 6-note scale with the iconic blue note", intervals: [0, 3, 5, 6, 7, 10] },
];

export type MicrotonalScaleId =
  | "maqamRast"
  | "maqamBayati"
  | "maqamSikah"
  | "gamelanSlendro"
  | "gamelanPelog"
  | "gamelanPelogSelisir"
  | "justIntonation5Limit"
  | "justIntonation7Limit"
  | "quarterTone24Edo"
  | "deltaBluesMicro"
  | "hirajoshi"
  | "insen"
  | "quarterTone24"
  | "quarterToneNeutral"
  | "justIntonationMajor"
  | "justIntonationMinor"
  | "harmonic7Limit"
  | "indonesianSlendro"
  | "indonesianPelog"
  | "indonesianPelogSelisir"
  | "japaneseHirajoshi"
  | "japaneseInsen"
  | "microtonalBlues";

export type MicrotonalScaleKind = MicrotonalScaleId;

export interface MicrotonalScaleDef {
  id: MicrotonalScaleId;
  name: string;
  category:
    | "arabic"
    | "indonesian"
    | "justIntonation"
    | "edo"
    | "blues"
    | "japanese"
    | "microtonal"
    | "just-intonation"
    | "middle-eastern"
    | "southeast-asian"
    | "east-asian";
  cents: number[]; // cents offsets from tonic, 0 <= cents < 1200
  description: string;
  ratioStrings?: string[] | undefined;
}

export const MICROTONAL_SCALE_DEFS: MicrotonalScaleDef[] = [
  {
    id: "maqamRast",
    name: "Arabic Maqam Rast",
    category: "arabic",
    cents: [0, 200, 350, 500, 700, 900, 1050],
    description: "Foundational Arabic maqam featuring Sikah neutral 3rd (350c) and neutral 7th (1050c)",
    ratioStrings: ["1/1", "9/8", "11/9", "4/3", "3/2", "27/16", "11/6"],
  },
  {
    id: "maqamBayati",
    name: "Arabic Maqam Bayati",
    category: "arabic",
    cents: [0, 150, 300, 500, 700, 800, 1000],
    description: "Deeply expressive Arabic maqam with iconic neutral 2nd (150c)",
    ratioStrings: ["1/1", "12/11", "6/5", "4/3", "3/2", "8/5", "9/5"],
  },
  {
    id: "maqamSikah",
    name: "Arabic Maqam Sikah",
    category: "arabic",
    cents: [0, 150, 350, 500, 650, 850, 1000],
    description: "Introspective maqam rooted on the Sikah neutral tone",
  },
  {
    id: "gamelanSlendro",
    name: "Gamelan Slendro (5-tone Equidistant)",
    category: "indonesian",
    cents: [0, 240, 480, 720, 960],
    description: "Javanese/Balinese 5-tone near-equidistant tuning (~240 cents per step)",
  },
  {
    id: "indonesianSlendro",
    name: "Indonesian Slendro",
    category: "southeast-asian",
    cents: [0, 240, 480, 720, 960],
    description: "Traditional 5-tone equidistant gamelan tuning (~240c per step) with acoustic shimmer",
  },
  {
    id: "gamelanPelog",
    name: "Gamelan Pelog (7-tone)",
    category: "indonesian",
    cents: [0, 120, 270, 540, 670, 785, 950],
    description: "7-tone asymmetric Javanese tuning with narrow and wide steps",
  },
  {
    id: "indonesianPelog",
    name: "Indonesian Pelog (7-tone)",
    category: "southeast-asian",
    cents: [0, 120, 270, 540, 670, 785, 950],
    description: "Javanese gamelan heptatonic scale featuring dramatic narrow and wide steps",
  },
  {
    id: "gamelanPelogSelisir",
    name: "Gamelan Pelog Selisir (5-tone)",
    category: "indonesian",
    cents: [0, 120, 540, 670, 785],
    description: "Classic 5-tone Balinese Gong Kebyar pentatonic subset of Pelog",
  },
  {
    id: "indonesianPelogSelisir",
    name: "Balinese Pelog Selisir (5-tone)",
    category: "southeast-asian",
    cents: [0, 120, 540, 670, 785],
    description: "Balinese Gong Kebyar pentatonic mode with bright metallic character",
  },
  {
    id: "justIntonation5Limit",
    name: "5-Limit Just Intonation",
    category: "justIntonation",
    cents: [0, 203.91, 386.31, 498.04, 701.96, 884.36, 1088.27],
    description: "Pure harmonic intervals based on prime limits 2, 3, and 5 (beating-free pure major 3rd and 5th)",
    ratioStrings: ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "15/8"],
  },
  {
    id: "justIntonationMajor",
    name: "5-Limit Just Intonation (Major)",
    category: "just-intonation",
    cents: [0, 203.91, 386.31, 498.04, 701.96, 884.36, 1088.27],
    description: "Acoustically pure, beat-free diatonic triad harmonies based on integer ratios",
    ratioStrings: ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "15/8"],
  },
  {
    id: "justIntonationMinor",
    name: "5-Limit Just Intonation (Minor)",
    category: "just-intonation",
    cents: [0, 203.91, 315.64, 498.04, 701.96, 813.69, 1017.60],
    description: "Acoustically pure natural minor tuning with consonant 6/5 minor third",
    ratioStrings: ["1/1", "9/8", "6/5", "4/3", "3/2", "8/5", "9/5"],
  },
  {
    id: "justIntonation7Limit",
    name: "7-Limit Just Intonation",
    category: "justIntonation",
    cents: [0, 231.17, 386.31, 498.04, 582.51, 701.96, 884.36, 968.83],
    description: "Harmonic series tuning including septimal whole tone (8/7), tritone (7/5), and septimal minor 7th (7/4)",
  },
  {
    id: "harmonic7Limit",
    name: "7-Limit Septimal Blues / Harmonic",
    category: "just-intonation",
    cents: [0, 266.87, 386.31, 498.04, 701.96, 968.83],
    description: "Overtones 4 through 7 featuring pure harmonic natural seventh (7/4)",
    ratioStrings: ["1/1", "7/6", "5/4", "4/3", "3/2", "7/4"],
  },
  {
    id: "quarterTone24Edo",
    name: "24-EDO Quarter-Tone",
    category: "edo",
    cents: Array.from({ length: 24 }, (_, i) => i * 50),
    description: "24 Equal Divisions of the Octave with 50-cent quarter-tone steps",
  },
  {
    id: "quarterTone24",
    name: "24-EDO Quarter-Tone Chromatic",
    category: "microtonal",
    cents: Array.from({ length: 24 }, (_, i) => i * 50),
    description: "24 equal divisions of the octave with 50-cent step resolution",
  },
  {
    id: "quarterToneNeutral",
    name: "24-EDO Neutral Diatonic",
    category: "microtonal",
    cents: [0, 150, 350, 500, 700, 850, 1050],
    description: "Diatonic mode featuring Zalzal's neutral third and seventh",
  },
  {
    id: "deltaBluesMicro",
    name: "Delta Blues Microtonal Inflections",
    category: "blues",
    cents: [0, 350, 500, 582.51, 700, 968.83],
    description: "Authentic acoustic blues scale featuring worried neutral 3rd (350c) and septimal minor 7th (968.8c)",
  },
  {
    id: "microtonalBlues",
    name: "Microtonal Delta Blues",
    category: "blues",
    cents: [0, 350, 500, 582.5, 700, 968.8],
    description: "Authentic blues intonation with worried third (350c), septimal tritone (582.5c), and harmonic 7th (968.8c)",
  },
  {
    id: "hirajoshi",
    name: "Japanese Hirajoshi Pentatonic",
    category: "japanese",
    cents: [0, 200, 300, 700, 800],
    description: "Traditional Japanese koto tuning with poignant semitone drops",
  },
  {
    id: "japaneseHirajoshi",
    name: "Japanese Hirajoshi",
    category: "east-asian",
    cents: [0, 200, 300, 700, 800],
    description: "Traditional Japanese Koto and Shamisen pentatonic mode (1, 2, b3, 5, b6)",
  },
  {
    id: "insen",
    name: "Japanese Insen Pentatonic",
    category: "japanese",
    cents: [0, 100, 500, 700, 1000],
    description: "Traditional shamisen and shakuhachi folk tuning with minor second tension",
  },
  {
    id: "japaneseInsen",
    name: "Japanese Insen",
    category: "east-asian",
    cents: [0, 100, 500, 700, 1000],
    description: "Shakuhachi flute pentatonic mode featuring minor 2nd (1, b2, 4, 5, b7)",
  },
];

export const MICROTONAL_SCALE_MAP: Record<string, MicrotonalScaleDef> =
  MICROTONAL_SCALE_DEFS.reduce((acc, def) => {
    acc[def.id] = def;
    return acc;
  }, {} as Record<string, MicrotonalScaleDef>);

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
  bass?: string | undefined;
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
  else if (s === "9" || s === "dom9") quality = "9";
  else if (s === "add9" || s === "add2") quality = "add9";
  else if (s === "m9" || s === "min9") quality = "m9";
  else if (s === "maj9") quality = "maj9";
  else if (s === "11" || s === "dom11") quality = "11";
  else if (s === "m11" || s === "min11") quality = "m11";
  else if (s === "maj11") quality = "maj11";
  else if (s === "13" || s === "dom13") quality = "13";
  else if (s === "m13" || s === "min13") quality = "m13";
  else if (s === "maj13") quality = "maj13";
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
  "9": [0, 4, 7, 10, 14],
  add9: [0, 4, 7, 14],
  m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  "11": [0, 4, 7, 10, 14, 17],
  m11: [0, 3, 7, 10, 14, 17],
  maj11: [0, 4, 7, 11, 14, 17],
  "13": [0, 4, 7, 10, 14, 21],
  m13: [0, 3, 7, 10, 14, 21],
  maj13: [0, 4, 7, 11, 14, 21],
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

export type ChordVoicing = "root" | "firstInversion" | "secondInversion" | "thirdInversion" | "open" | "drop2" | "drop3" | "spread";

export interface VoicingDef {
  id: ChordVoicing;
  label: string;
  description: string;
}

export const CHORD_VOICINGS: VoicingDef[] = [
  { id: "root", label: "Root Position", description: "Standard close voicing with the root note at the bottom" },
  { id: "firstInversion", label: "1st Inversion", description: "Third in the bass, lowest note shifted up one octave" },
  { id: "secondInversion", label: "2nd Inversion", description: "Fifth in the bass, lower two notes shifted up one octave" },
  { id: "thirdInversion", label: "3rd Inversion", description: "Seventh in the bass, lower three notes shifted up one octave" },
  { id: "open", label: "Open / Drop-2", description: "Second note from top dropped an octave for rich modern spacing" },
  { id: "drop2", label: "Drop-2", description: "Second note from top dropped an octave" },
  { id: "drop3", label: "Drop-3", description: "Third note from top dropped an octave for spacious guitar voicings" },
  { id: "spread", label: "Spread", description: "Bass grounded lower with upper color tones floating higher" },
];

export function applyVoicing(notes: number[], voicing: ChordVoicing = "root"): number[] {
  if (notes.length <= 1 || voicing === "root") return [...notes];
  const sorted = [...notes].sort((a, b) => a - b);
  if (voicing === "firstInversion") {
    return [...sorted.slice(1), sorted[0] + 12].sort((a, b) => a - b);
  }
  if (voicing === "secondInversion") {
    if (sorted.length < 3) return sorted;
    return [...sorted.slice(2), sorted[0] + 12, sorted[1] + 12].sort((a, b) => a - b);
  }
  if (voicing === "thirdInversion") {
    if (sorted.length < 4) return sorted;
    return [...sorted.slice(3), sorted[0] + 12, sorted[1] + 12, sorted[2] + 12].sort((a, b) => a - b);
  }
  if (voicing === "open" || voicing === "drop2") {
    if (sorted.length < 3) return sorted;
    // Drop-2: take the 2nd note from the top and drop it by an octave
    const dropIdx = sorted.length - 2;
    const dropped = sorted[dropIdx] - 12;
    const rest = sorted.filter((_, idx) => idx !== dropIdx);
    return [dropped, ...rest].sort((a, b) => a - b);
  }
  if (voicing === "drop3") {
    if (sorted.length < 3) return sorted;
    // Drop-3: take the 3rd note from the top and drop it by an octave
    const dropIdx = sorted.length - 3;
    const dropped = sorted[dropIdx] - 12;
    const rest = sorted.filter((_, idx) => idx !== dropIdx);
    return [dropped, ...rest].sort((a, b) => a - b);
  }
  if (voicing === "spread") {
    const lowest = sorted[0] - 12;
    const highest = sorted[sorted.length - 1] + 12;
    const middle = sorted.slice(1, -1);
    return [lowest, ...middle, highest].sort((a, b) => a - b);
  }
  return sorted;
}

export function chordMidiNotes(symbol: string, octave = 3, voicing: ChordVoicing = "root"): number[] {
  const p = parseChord(symbol);
  const base = rootMidi(p.rootPc, octave);
  const rawNotes = chordIntervals(p.quality).map((iv) => base + iv);
  return applyVoicing(rawNotes, voicing);
}

export function midiToName(midi: number, preferFlats = true): string {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return pcToName(pc, preferFlats) + oct;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export interface IntervalDetails {
  label: string; // "R", "b3", "3", "5", "b7", "7", "9", "11", "13", etc.
  role: "root" | "third" | "fifth" | "seventh" | "extension" | "sus" | "altered";
  color: string;
}

export function getIntervalDetails(semitones: number, quality = "maj"): IntervalDetails {
  const norm = ((semitones % 12) + 12) % 12;
  switch (norm) {
    case 0:
      return { label: "R", role: "root", color: "#f59e0b" };
    case 1:
      return { label: "♭9", role: "altered", color: "#f97316" };
    case 2:
      return quality.includes("sus2")
        ? { label: "2", role: "sus", color: "#3b82f6" }
        : { label: "9", role: "extension", color: "#8b5cf6" };
    case 3:
      return { label: "♭3", role: "third", color: "#10b981" };
    case 4:
      return { label: "3", role: "third", color: "#10b981" };
    case 5:
      return quality.includes("sus4")
        ? { label: "4", role: "sus", color: "#3b82f6" }
        : { label: "11", role: "extension", color: "#8b5cf6" };
    case 6:
      return quality.includes("dim") || quality.includes("b5")
        ? { label: "♭5", role: "fifth", color: "#06b6d4" }
        : { label: "♯11", role: "extension", color: "#8b5cf6" };
    case 7:
      return { label: "5", role: "fifth", color: "#06b6d4" };
    case 8:
      return quality.includes("aug") || quality.includes("#5")
        ? { label: "♯5", role: "fifth", color: "#06b6d4" }
        : { label: "♭13", role: "extension", color: "#8b5cf6" };
    case 9:
      return quality.includes("dim7")
        ? { label: "dim7", role: "seventh", color: "#ec4899" }
        : { label: quality.includes("6") ? "6" : "13", role: "extension", color: "#8b5cf6" };
    case 10:
      return { label: "♭7", role: "seventh", color: "#ec4899" };
    case 11:
      return { label: "7", role: "seventh", color: "#ec4899" };
    default:
      return { label: `${norm}`, role: "extension", color: "#8b5cf6" };
  }
}

export interface VoicingNoteMetadata {
  midi: number;
  pitchClass: number;
  noteName: string;
  interval: IntervalDetails;
  freqHz: number;
}

export function getVoicingNotesMetadata(
  symbol: string,
  octave = 3,
  voicing: ChordVoicing = "root"
): VoicingNoteMetadata[] {
  const p = parseChord(symbol);
  const midis = chordMidiNotes(symbol, octave, voicing);
  return midis.map((m) => {
    const pc = ((m % 12) + 12) % 12;
    const diff = ((pc - p.rootPc) % 12 + 12) % 12;
    return {
      midi: m,
      pitchClass: pc,
      noteName: midiToName(m, true),
      interval: getIntervalDetails(diff, p.quality),
      freqHz: Math.round(midiToFreq(m) * 100) / 100,
    };
  });
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

export function qualitySuffix(quality: string, original: string): string {
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

/** All major, minor, and modal keys. */
export interface KeyDef { key: string; tonic: string; scale: ScaleKind; label: string; }
export const ALL_KEYS: KeyDef[] = (() => {
  const tonics = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
  const minors = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];
  const out: KeyDef[] = [];
  // 1. Classic major and minor (preserves historical order for backwards compatibility)
  for (const k of tonics) out.push({ key: `${k} major`, tonic: k, scale: "major", label: `${k.replace("b","♭")} Major` });
  for (const k of minors) out.push({ key: `${k} minor`, tonic: k, scale: "minor", label: `${k.replace("b","♭").replace("#","♯")} Minor` });

  // 2. Extended modal scales
  for (const scaleDef of SCALE_DEFS) {
    if (scaleDef.id === "major" || scaleDef.id === "minor") continue;
    for (const k of tonics) {
      out.push({
        key: `${k} ${scaleDef.id}`,
        tonic: k,
        scale: scaleDef.id,
        label: `${k.replace("b","♭")} ${scaleDef.name}`,
      });
    }
  }
  return out;
})();

/** Scale MIDI pcs for a tonic + scale kind. */
export function scalePcs(tonicPc: number, scale: ScaleKind): number[] {
  return SCALE_INTERVALS[scale].map((iv) => (tonicPc + iv) % 12);
}

/** Diatonic triad qualities for major/minor and modal degrees. */
export function diatonicChord(tonicPc: number, scale: ScaleKind, degree: number): string {
  const ivs = SCALE_INTERVALS[scale];
  const numDegrees = ivs.length;
  const deg = ((degree % numDegrees) + numDegrees) % numDegrees;
  const rootPc = (tonicPc + ivs[deg]) % 12;
  const root = pcToName(rootPc, true);
  let quality = "";
  if (scale === "major") quality = ["", "m", "m", "", "", "m", "dim"][deg];
  else if (scale === "minor") quality = ["m", "dim", "", "m", "m", "", ""][deg];
  else if (scale === "dorian") quality = ["m", "m", "", "", "m", "dim", ""][deg];
  else if (scale === "mixolydian") quality = ["", "m", "dim", "", "m", "m", ""][deg];
  else if (scale === "lydian") quality = ["", "", "m", "dim", "", "m", "m"][deg];
  else if (scale === "phrygian") quality = ["m", "", "", "m", "dim", "", "m"][deg];
  else if (scale === "harmonicMinor") quality = ["m", "dim", "aug", "m", "", "", "dim"][deg];
  else quality = deg === 0 ? (scale === "pentMinor" || scale === "blues" ? "m" : "") : "";
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

// ── Microtonal & Non-Western Scale Tuning Core ──
// Pure functions for frequency ratio calculation, cents offsets,
// and microtonal scale mapping. Bounded and mathematically exact.

/** Convert cents interval to frequency ratio: 2^(cents / 1200) */
export function centsToRatio(cents: number): number {
  return Math.pow(2, cents / 1200);
}

/** Convert frequency ratio to cents interval: 1200 * log2(ratio) */
export function ratioToCents(ratio: number): number {
  if (ratio <= 0) return 0;
  return 1200 * Math.log2(ratio);
}

/** Convert base frequency and cents offset into resulting Hertz: baseFreq * 2^(cents / 1200) */
export function centsToFreq(baseFreq: number, cents: number): number {
  return baseFreq * centsToRatio(cents);
}

/** Convert base frequency and rational ratio into resulting Hertz: baseFreq * ratio */
export function ratioToFreq(baseFreq: number, ratio: number): number {
  return baseFreq * ratio;
}

/** Convert frequency to cents relative to a base frequency (default 440 Hz). */
export function freqToCents(freq: number, baseFreq = 440): number {
  if (freq <= 0 || baseFreq <= 0) return 0;
  return ratioToCents(freq / baseFreq);
}

/** Look up a microtonal scale definition by its ID. */
export function getMicrotonalScale(id: string): MicrotonalScaleDef | undefined {
  return MICROTONAL_SCALE_MAP[id];
}

/**
 * Calculate the exact continuous frequency (Hz) for a degree in a microtonal scale.
 * 
 * @param scaleId The microtonal scale preset
 * @param degree 0-indexed scale degree
 * @param tonicMidi Base MIDI note for degree 0 (e.g. 60 for C4, 62 for D4)
 * @returns Frequency in Hertz
 */
export function scaleDegreeToFrequency(
  scaleId: MicrotonalScaleId,
  degree: number,
  tonicMidi = 60
): number {
  const def = getMicrotonalScale(scaleId);
  if (!def || def.cents.length === 0) {
    return midiToFreq(tonicMidi + degree);
  }

  const numDegrees = def.cents.length;
  // Handle octave wrapping (positive and negative degrees)
  const octaveShift = Math.floor(degree / numDegrees);
  const normalizedDegree = ((degree % numDegrees) + numDegrees) % numDegrees;

  const centsWithinOctave = def.cents[normalizedDegree];
  const totalCents = octaveShift * 1200 + centsWithinOctave;
  const tonicFreq = midiToFreq(tonicMidi);

  return centsToFreq(tonicFreq, totalCents);
}

/**
 * Calculate the exact continuous frequency (Hz) given tonic frequency directly.
 */
export function microtonalDegreeToFreq(
  tonicFreq: number,
  scaleId: MicrotonalScaleId,
  degreeIndex: number
): number {
  const def = getMicrotonalScale(scaleId);
  if (!def || def.cents.length === 0) {
    return tonicFreq * Math.pow(2, degreeIndex / 12);
  }
  const len = def.cents.length;
  const octaves = Math.floor(degreeIndex / len);
  const deg = ((degreeIndex % len) + len) % len;
  const totalCents = octaves * 1200 + def.cents[deg];
  return tonicFreq * centsToRatio(totalCents);
}

/**
 * Calculate detune offset in cents relative to a reference 12-EDO MIDI note.
 * Useful for Web Audio OscillatorNode.detune.
 * 
 * @param targetFreq Desired frequency in Hertz
 * @param referenceMidi Reference 12-EDO MIDI note number
 * @returns Detune in cents (-1200..+1200)
 */
export function frequencyToDetuneCents(targetFreq: number, referenceMidi: number): number {
  if (targetFreq <= 0) return 0;
  const refFreq = midiToFreq(referenceMidi);
  return 1200 * Math.log2(targetFreq / refFreq);
}

/** Alias for frequencyToDetuneCents */
export function midiToCentsDetune(targetFreq: number, nearestMidi: number): number {
  return frequencyToDetuneCents(targetFreq, nearestMidi);
}

/**
 * Find the nearest 12-EDO MIDI note and remaining detune in cents for any arbitrary frequency.
 */
export function findNearestMidi(freq: number): { midi: number; detune: number } {
  if (freq <= 0) return { midi: 69, detune: 0 };
  const fractionalMidi = 69 + 12 * Math.log2(freq / 440);
  const nearestMidi = Math.round(fractionalMidi);
  const detune = (fractionalMidi - nearestMidi) * 100;
  return { midi: nearestMidi, detune };
}

/**
 * Quantize any cents value to the nearest 24-EDO quarter-tone step.
 */
export function quantizeCentsTo24EDO(cents: number): number {
  return Math.round(cents / 50) * 50;
}

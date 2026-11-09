// SonicBlueprint Fretboard Engine
// Pure mathematical engine for string tunings, fret geometry, CAGED shapes, and human hand playable fingerings.

import { parseChord, pcToName, chordIntervals, getIntervalDetails } from "./music-theory";

export type InstrumentId = "guitar-standard" | "guitar-drop-d" | "bass-standard" | "bass-5string";

export interface InstrumentTuning {
  id: InstrumentId;
  name: string;
  strings: number[]; // MIDI note open pitch per string (low to high, index 0 is lowest string)
  stringNames: string[];
  totalFrets: number;
}

export const INSTRUMENT_TUNINGS: Record<InstrumentId, InstrumentTuning> = {
  "guitar-standard": {
    id: "guitar-standard",
    name: "Guitar (Standard 6-String)",
    strings: [40, 45, 50, 55, 59, 64], // E2, A2, D3, G3, B3, E4
    stringNames: ["E2", "A2", "D3", "G3", "B3", "E4"],
    totalFrets: 15,
  },
  "guitar-drop-d": {
    id: "guitar-drop-d",
    name: "Guitar (Drop D)",
    strings: [38, 45, 50, 55, 59, 64], // D2, A2, D3, G3, B3, E4
    stringNames: ["D2", "A2", "D3", "G3", "B3", "E4"],
    totalFrets: 15,
  },
  "bass-standard": {
    id: "bass-standard",
    name: "Bass (Standard 4-String)",
    strings: [28, 33, 38, 43], // E1, A1, D2, G2
    stringNames: ["E1", "A1", "D2", "G2"],
    totalFrets: 15,
  },
  "bass-5string": {
    id: "bass-5string",
    name: "Bass (5-String Low B)",
    strings: [23, 28, 33, 38, 43], // B0, E1, A1, D2, G2
    stringNames: ["B0", "E1", "A1", "D2", "G2"],
    totalFrets: 15,
  },
};

export type ChordShapeType =
  | "caged-c"
  | "caged-a"
  | "caged-g"
  | "caged-e"
  | "caged-d"
  | "drop2"
  | "open"
  | "custom";

export interface ChordFingering {
  id: string;
  name: string; // e.g. "CAGED Shape E (Fret 8)"
  shapeType: ChordShapeType;
  /** Fret number per string (0..totalFrets), or 'x' if muted. Low string at index 0. */
  frets: (number | "x")[];
  /** Finger recommendations: 1=Index, 2=Middle, 3=Ring, 4=Pinky, or null for open/muted */
  fingers?: (number | null)[] | undefined;
  barreFret?: number | undefined;
  barreStrings?: [number, number] | undefined;
  rootFret: number;
  baseFret: number; // Lowest fretted position (>0) or 1
  midis: number[];  // Sounding MIDI pitches
}

export interface FretMarkerNote {
  stringIndex: number;
  fret: number;
  midi: number;
  pitchClass: number;
  noteName: string;
  intervalLabel: string;
  role: "root" | "third" | "fifth" | "seventh" | "extension" | "sus" | "altered";
  color: string;
  isRoot: boolean;
}

/** Pure function: calculates note metadata at any string and fret coordinate */
export function getFretNote(
  stringIndex: number,
  fret: number,
  tuning: InstrumentTuning,
  rootPc: number,
  chordQuality = "maj"
): FretMarkerNote {
  const openMidi = tuning.strings[stringIndex] ?? 40;
  const midi = openMidi + fret;
  const pitchClass = ((midi % 12) + 12) % 12;
  const semitonesFromRoot = ((pitchClass - rootPc) % 12 + 12) % 12;
  const { label, role, color } = getIntervalDetails(semitonesFromRoot, chordQuality);
  return {
    stringIndex,
    fret,
    midi,
    pitchClass,
    noteName: pcToName(pitchClass, true),
    intervalLabel: label,
    role,
    color,
    isRoot: semitonesFromRoot === 0,
  };
}

/**
 * Calculates proportional horizontal pixel position of a fret.
 * Uses physical fret spacing formula: x_n = L * (1 - 2^(-n / 17.817))
 */
export function calculateFretX(fret: number, totalFrets: number, width: number): number {
  if (fret <= 0) return 0;
  const scaleLength = width / (1 - Math.pow(2, -totalFrets / 17.817));
  const dist = scaleLength * (1 - Math.pow(2, -fret / 17.817));
  return Math.min(width, Math.max(0, dist));
}

/**
 * Generates canonical CAGED shapes for standard 6-string guitar.
 */
export function generateCagedShapes(chordSymbol: string, maxFret = 15): ChordFingering[] {
  const p = parseChord(chordSymbol);
  const rootPc = p.rootPc;
  const isMinor = p.quality.startsWith("min") || p.quality === "m";
  const is7th = p.quality === "7";
  const isMaj7 = p.quality === "maj7";
  const isMin7 = p.quality === "m7";

  const fingerings: ChordFingering[] = [];

  // Helper to test if all frets are within [0, maxFret] and fret span <= 4
  const validateFingering = (
    id: string,
    name: string,
    shapeType: ChordShapeType,
    frets: (number | "x")[],
    rootFret: number
  ): ChordFingering | null => {
    const fretted = frets.filter((f): f is number => typeof f === "number" && f > 0);
    if (fretted.length === 0) return null;
    const minF = Math.min(...fretted);
    const maxF = Math.max(...fretted);
    if (maxF > maxFret || minF < 0) return null;
    if (maxF - minF > 4) return null;

    // Check sounding pitches
    const midis: number[] = [];
    const openPitches = INSTRUMENT_TUNINGS["guitar-standard"].strings;
    frets.forEach((f, sIdx) => {
      if (typeof f === "number") {
        midis.push(openPitches[sIdx] + f);
      }
    });

    // Determine barre
    let barreFret: number | undefined;
    let barreStrings: [number, number] | undefined;
    const lowestFrets = frets
      .map((f, i) => ({ f, i }))
      .filter((item) => item.f === minF);
    if (lowestFrets.length >= 2 && minF > 0) {
      barreFret = minF;
      barreStrings = [lowestFrets[0].i, lowestFrets[lowestFrets.length - 1].i];
    }

    // Assign fingers (1=index, 2=middle, 3=ring, 4=pinky)
    const fingers: (number | null)[] = frets.map((f) => {
      if (typeof f !== "number" || f === 0) return null;
      if (f === minF) return 1;
      const offset = f - minF;
      if (offset === 1) return 2;
      if (offset === 2) return 3;
      return 4;
    });

    return {
      id,
      name,
      shapeType,
      frets,
      fingers,
      barreFret,
      barreStrings,
      rootFret,
      baseFret: minF,
      midis,
    };
  };

  // E shape: Root on String 0 (Low E string, open E=4)
  const rootFretE = ((rootPc - 4) % 12 + 12) % 12;
  for (const fR of [rootFretE, rootFretE + 12]) {
    if (fR > maxFret) continue;
    let fretsE: (number | "x")[];
    if (fR === 0) {
      // Open E
      if (isMinor) fretsE = [0, 2, 2, 0, 0, 0];
      else if (is7th) fretsE = [0, 2, 0, 1, 0, 0];
      else if (isMaj7) fretsE = [0, 2, 1, 1, 0, 0];
      else if (isMin7) fretsE = [0, 2, 0, 0, 0, 0];
      else fretsE = [0, 2, 2, 1, 0, 0];
    } else {
      // Barre E
      if (isMinor) fretsE = [fR, fR + 2, fR + 2, fR, fR, fR];
      else if (is7th) fretsE = [fR, fR + 2, fR, fR + 1, fR, fR];
      else if (isMaj7) fretsE = [fR, fR + 2, fR + 1, fR + 1, fR, fR];
      else if (isMin7) fretsE = [fR, fR + 2, fR, fR, fR, fR];
      else fretsE = [fR, fR + 2, fR + 2, fR + 1, fR, fR];
    }
    const res = validateFingering(
      `caged-e-${fR}`,
      `E Shape (Fret ${fR})`,
      "caged-e",
      fretsE,
      fR
    );
    if (res) fingerings.push(res);
  }

  // A shape: Root on String 1 (A string, open A=9)
  const rootFretA = ((rootPc - 9) % 12 + 12) % 12;
  for (const fR of [rootFretA, rootFretA + 12]) {
    if (fR > maxFret) continue;
    let fretsA: (number | "x")[];
    if (fR === 0) {
      // Open A
      if (isMinor) fretsA = ["x", 0, 2, 2, 1, 0];
      else if (is7th) fretsA = ["x", 0, 2, 0, 2, 0];
      else if (isMaj7) fretsA = ["x", 0, 2, 1, 2, 0];
      else if (isMin7) fretsA = ["x", 0, 2, 0, 1, 0];
      else fretsA = ["x", 0, 2, 2, 2, 0];
    } else {
      // Barre A
      if (isMinor) fretsA = ["x", fR, fR + 2, fR + 2, fR + 1, fR];
      else if (is7th) fretsA = ["x", fR, fR + 2, fR, fR + 2, fR];
      else if (isMaj7) fretsA = ["x", fR, fR + 2, fR + 1, fR + 2, fR];
      else if (isMin7) fretsA = ["x", fR, fR + 2, fR, fR + 1, fR];
      else fretsA = ["x", fR, fR + 2, fR + 2, fR + 2, fR];
    }
    const res = validateFingering(
      `caged-a-${fR}`,
      `A Shape (Fret ${fR})`,
      "caged-a",
      fretsA,
      fR
    );
    if (res) fingerings.push(res);
  }

  // C shape: Root on String 1 (A string, open A=9)
  for (const fR of [rootFretA, rootFretA + 12]) {
    if (fR > maxFret) continue;
    if (fR >= 3) {
      const fretsC: (number | "x")[] = isMinor
        ? ["x", fR, fR - 2, fR - 3, fR - 2, "x"]
        : ["x", fR, fR - 1, fR - 3, fR - 2, fR - 3];
      const res = validateFingering(
        `caged-c-${fR}`,
        `C Shape (Fret ${fR})`,
        "caged-c",
        fretsC,
        fR
      );
      if (res) fingerings.push(res);
    } else if (fR === 3 && rootPc === 0) {
      // Standard open C major
      const res = validateFingering(
        `caged-c-open`,
        `C Shape Open`,
        "caged-c",
        ["x", 3, 2, 0, 1, 0],
        3
      );
      if (res) fingerings.push(res);
    }
  }

  // D shape: Root on String 2 (D string, open D=2)
  const rootFretD = ((rootPc - 2) % 12 + 12) % 12;
  for (const fR of [rootFretD, rootFretD + 12]) {
    if (fR > maxFret) continue;
    let fretsD: (number | "x")[];
    if (fR === 0) {
      if (isMinor) fretsD = ["x", "x", 0, 2, 3, 1];
      else if (is7th) fretsD = ["x", "x", 0, 2, 1, 2];
      else fretsD = ["x", "x", 0, 2, 3, 2];
    } else {
      if (isMinor) fretsD = ["x", "x", fR, fR + 2, fR + 3, fR + 1];
      else if (is7th) fretsD = ["x", "x", fR, fR + 2, fR + 1, fR + 2];
      else fretsD = ["x", "x", fR, fR + 2, fR + 3, fR + 2];
    }
    const res = validateFingering(
      `caged-d-${fR}`,
      `D Shape (Fret ${fR})`,
      "caged-d",
      fretsD,
      fR
    );
    if (res) fingerings.push(res);
  }

  // G shape: Root on String 0 (Low E string)
  for (const fR of [rootFretE, rootFretE + 12]) {
    if (fR > maxFret) continue;
    if (fR >= 3) {
      const fretsG: (number | "x")[] = [fR, fR - 1, fR - 3, fR - 3, fR - 3, fR];
      const res = validateFingering(
        `caged-g-${fR}`,
        `G Shape (Fret ${fR})`,
        "caged-g",
        fretsG,
        fR
      );
      if (res) fingerings.push(res);
    } else if (fR === 3 && rootPc === 7) {
      // Standard open G major
      const res = validateFingering(
        `caged-g-open`,
        `G Shape Open`,
        "caged-g",
        [3, 2, 0, 0, 0, 3],
        3
      );
      if (res) fingerings.push(res);
    }
  }

  return fingerings;
}

/**
 * Searches for playable guitar or bass chord fingerings.
 * Enforces human hand ergonomic limits: fret span <= 4 (excluding open strings 0),
 * maximum 1 note per string, and presence of essential chord pitch classes.
 */
export function findPlayableFingerings(
  chordSymbol: string,
  tuning: InstrumentTuning = INSTRUMENT_TUNINGS["guitar-standard"],
  maxFret = 15
): ChordFingering[] {
  const p = parseChord(chordSymbol);
  const chordPcs = new Set(chordIntervals(p.quality).map((iv) => ((p.rootPc + iv) % 12 + 12) % 12));
  const numStrings = tuning.strings.length;

  const results: ChordFingering[] = [];
  const seenKeys = new Set<string>();

  // If standard guitar, first include CAGED shapes
  if (tuning.id === "guitar-standard") {
    const caged = generateCagedShapes(chordSymbol, maxFret);
    for (const cf of caged) {
      const key = cf.frets.join("-");
      seenKeys.add(key);
      results.push(cf);
    }
  }

  // Sliding 4-fret window search for general chords and bass instruments
  for (let windowStart = 0; windowStart <= maxFret - 3; windowStart++) {
    const windowEnd = Math.min(maxFret, windowStart + 3);

    // For each string, collect valid frets within window plus open string 0
    const stringCandidates: number[][] = [];
    for (let s = 0; s < numStrings; s++) {
      const candidates: number[] = [];
      const openMidi = tuning.strings[s];
      for (let f = 0; f <= maxFret; f++) {
        if (f === 0 || (f >= windowStart && f <= windowEnd)) {
          const pc = ((openMidi + f) % 12 + 12) % 12;
          if (chordPcs.has(pc)) {
            candidates.push(f);
          }
        }
      }
      stringCandidates.push(candidates);
    }

    // Build combinations across strings (preferring strings with notes)
    // For bass (4/5 strings), minimum 2 sounding notes; guitar, minimum 3.
    const minNotes = numStrings <= 4 ? 2 : 3;

    // Pick a primary configuration for this window
    const buildFingering = (pickBassFret?: number): (number | "x")[] | null => {
      const config: (number | "x")[] = new Array(numStrings).fill("x");
      let soundingCount = 0;
      let hasRoot = false;

      for (let s = 0; s < numStrings; s++) {
        const cands = stringCandidates[s];
        if (cands.length === 0) continue;

        // Choose the best candidate fret on this string
        let chosen: number | undefined;
        if (s === 0 && pickBassFret !== undefined && cands.includes(pickBassFret)) {
          chosen = pickBassFret;
        } else {
          // Prefer root if available, otherwise lowest fretted note
          const rootCand = cands.find((f) => ((tuning.strings[s] + f) % 12 + 12) % 12 === p.rootPc);
          if (rootCand !== undefined && !hasRoot) {
            chosen = rootCand;
          } else {
            chosen = cands[0];
          }
        }

        if (chosen !== undefined) {
          config[s] = chosen;
          soundingCount++;
          if (((tuning.strings[s] + chosen) % 12 + 12) % 12 === p.rootPc) {
            hasRoot = true;
          }
        }
      }

      if (soundingCount >= minNotes && hasRoot) {
        return config;
      }
      return null;
    };

    const cfg = buildFingering();
    if (cfg) {
      const fretted = cfg.filter((f): f is number => typeof f === "number" && f > 0);
      if (fretted.length > 0) {
        const minF = Math.min(...fretted);
        const maxF = Math.max(...fretted);
        if (maxF - minF <= 4) {
          const key = cfg.join("-");
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            const midis: number[] = [];
            cfg.forEach((f, idx) => {
              if (typeof f === "number") midis.push(tuning.strings[idx] + f);
            });
            results.push({
              id: `custom-w${windowStart}-${key}`,
              name: `Voicing at Fret ${minF}`,
              shapeType: "custom",
              frets: cfg,
              rootFret: minF,
              baseFret: minF,
              midis,
            });
          }
        }
      }
    }
  }

  return results;
}

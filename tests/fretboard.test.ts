// Tests for Fretboard Engine, CAGED shapes, playable fingering solver, and extended voicings.
import { suite, test, ok, eq, approx } from "./helpers.js";
import {
  INSTRUMENT_TUNINGS,
  getFretNote,
  calculateFretX,
  generateCagedShapes,
  findPlayableFingerings,
} from "@/lib/fretboard-engine";
import {
  chordMidiNotes,
  getIntervalDetails,
  getVoicingNotesMetadata,
  midiToFreq,
} from "@/lib/music-theory";

suite("Fretboard Engine & Instrument Tunings");

test("standard guitar tuning has correct open pitches and string count", () => {
  const g = INSTRUMENT_TUNINGS["guitar-standard"];
  eq(g.strings.length, 6);
  eq(g.strings, [40, 45, 50, 55, 59, 64]);
  eq(g.stringNames, ["E2", "A2", "D3", "G3", "B3", "E4"]);
});

test("drop D guitar tuning lowers string 0 to D2", () => {
  const d = INSTRUMENT_TUNINGS["guitar-drop-d"];
  eq(d.strings[0], 38);
  eq(d.strings.slice(1), [45, 50, 55, 59, 64]);
});

test("bass standard tuning has 4 strings and correct octaves", () => {
  const b = INSTRUMENT_TUNINGS["bass-standard"];
  eq(b.strings.length, 4);
  eq(b.strings, [28, 33, 38, 43]);
  eq(b.stringNames, ["E1", "A1", "D2", "G2"]);
});

test("bass 5-string includes low B0 (MIDI 23)", () => {
  const b5 = INSTRUMENT_TUNINGS["bass-5string"];
  eq(b5.strings.length, 5);
  eq(b5.strings[0], 23);
  eq(b5.stringNames[0], "B0");
});

test("fret note calculation accurately identifies octaves and intervals", () => {
  const g = INSTRUMENT_TUNINGS["guitar-standard"];
  // Fret 12 on low E string is E3 (MIDI 52, octave higher than E2 40)
  const f12 = getFretNote(0, 12, g, 4, "maj");
  eq(f12.midi, 52);
  eq(f12.pitchClass, 4);
  eq(f12.noteName, "E");
  eq(f12.isRoot, true);
  eq(f12.intervalLabel, "R");

  // Fret 5 on low E string is A2 (MIDI 45), equal to open A string
  const f5 = getFretNote(0, 5, g, 4, "maj");
  eq(f5.midi, 45);
  eq(f5.noteName, "A");
  eq(f5.intervalLabel, "11"); // 4th/11th from E
});

test("calculateFretX returns monotonically increasing pixel coordinates", () => {
  const total = 15;
  const width = 1000;
  let prevX = -1;
  for (let f = 0; f <= total; f++) {
    const x = calculateFretX(f, total, width);
    ok(x >= prevX, `Fret ${f} X (${x}) must be >= previous X (${prevX})`);
    prevX = x;
  }
  eq(calculateFretX(0, total, width), 0);
  approx(calculateFretX(total, total, width), width, 1.0);
});

suite("CAGED Shapes & Playable Fingering Invariants");

test("generateCagedShapes produces standard open C major chord", () => {
  const shapes = generateCagedShapes("C", 15);
  ok(shapes.length >= 3, "C major should yield multiple CAGED forms");
  const openC = shapes.find((s) => s.id === "caged-c-open" || s.shapeType === "caged-c");
  ok(openC, "Must find C-shape for C major");
  eq(openC?.frets, ["x", 3, 2, 0, 1, 0]);
});

test("generateCagedShapes produces E-shape barre chord at fret 8 for C major", () => {
  const shapes = generateCagedShapes("C", 15);
  const eShape = shapes.find((s) => s.name.includes("E Shape (Fret 8)"));
  ok(eShape, "Must find E-shape barre at fret 8 for C major");
  eq(eShape?.frets, [8, 10, 10, 9, 8, 8]);
  eq(eShape?.barreFret, 8);
});

test("generateCagedShapes produces A-shape barre chord at fret 3 for C major", () => {
  const shapes = generateCagedShapes("C", 15);
  const aShape = shapes.find((s) => s.name.includes("A Shape (Fret 3)"));
  ok(aShape, "Must find A-shape barre at fret 3 for C major");
  eq(aShape?.frets, ["x", 3, 5, 5, 5, 3]);
  eq(aShape?.barreFret, 3);
});

test("every generated fingering satisfies human hand span <= 4 frets", () => {
  for (const chord of ["C", "Am", "G", "Dm", "F#m7", "Bb", "E7"]) {
    const fingerings = findPlayableFingerings(chord, INSTRUMENT_TUNINGS["guitar-standard"], 15);
    ok(fingerings.length > 0, `Chord ${chord} must have fingerings`);
    for (const f of fingerings) {
      const fretted = f.frets.filter((fr): fr is number => typeof fr === "number" && fr > 0);
      if (fretted.length > 0) {
        const minF = Math.min(...fretted);
        const maxF = Math.max(...fretted);
        ok(
          maxF - minF <= 4,
          `${f.name} for ${chord} exceeded 4-fret span: [${f.frets.join(",")}] (span: ${maxF - minF})`
        );
      }
    }
  }
});

test("no fingering has more than one note on a single string", () => {
  const fingerings = findPlayableFingerings("Dm", INSTRUMENT_TUNINGS["guitar-standard"], 15);
  for (const f of fingerings) {
    eq(f.frets.length, 6, "Must have exactly 6 string entries");
    for (const fr of f.frets) {
      ok(typeof fr === "number" || fr === "x", "Fret must be number or 'x'");
    }
  }
});

suite("Voicing Inversions, Drop-3, and Interval Metadata");

test("thirdInversion places 7th in the bass for 7th chords", () => {
  // Cmaj7: [C3=48, E3=52, G3=55, B3=59]
  const rootNotes = chordMidiNotes("Cmaj7", 3, "root");
  eq(rootNotes, [48, 52, 55, 59]);

  // 1st inversion: [52, 55, 59, 60] (E in bass)
  eq(chordMidiNotes("Cmaj7", 3, "firstInversion"), [52, 55, 59, 60]);

  // 2nd inversion: [55, 59, 60, 64] (G in bass)
  eq(chordMidiNotes("Cmaj7", 3, "secondInversion"), [55, 59, 60, 64]);

  // 3rd inversion: [59, 60, 64, 67] (B in bass)
  const thirdInv = chordMidiNotes("Cmaj7", 3, "thirdInversion");
  eq(thirdInv, [59, 60, 64, 67]);
  eq(thirdInv[0] % 12, 11); // B is pitch class 11
});

test("drop3 drops the 3rd note from the top by 12 semitones", () => {
  const rootNotes = chordMidiNotes("Cmaj7", 3, "root"); // [48, 52, 55, 59]
  eq(rootNotes, [48, 52, 55, 59]);
  // sorted length 4 -> 3rd from top is index 4 - 3 = 1 -> note 52 (E3) dropped to 40 (E2)
  // remaining [48, 55, 59], so result is [40, 48, 55, 59]
  const d3 = chordMidiNotes("Cmaj7", 3, "drop3");
  eq(d3, [40, 48, 55, 59]);
});

test("getIntervalDetails identifies roles and colors accurately", () => {
  const root = getIntervalDetails(0);
  eq(root.label, "R");
  eq(root.role, "root");

  const min3 = getIntervalDetails(3);
  eq(min3.label, "♭3");
  eq(min3.role, "third");

  const maj3 = getIntervalDetails(4);
  eq(maj3.label, "3");
  eq(maj3.role, "third");

  const p5 = getIntervalDetails(7);
  eq(p5.label, "5");
  eq(p5.role, "fifth");

  const min7 = getIntervalDetails(10);
  eq(min7.label, "♭7");
  eq(min7.role, "seventh");

  const maj7 = getIntervalDetails(11);
  eq(maj7.label, "7");
  eq(maj7.role, "seventh");
});

test("getVoicingNotesMetadata outputs rich note information with exact frequencies", () => {
  const meta = getVoicingNotesMetadata("C", 3, "root");
  eq(meta.length, 3);
  eq(meta[0].noteName, "C3");
  eq(meta[0].interval.label, "R");
  approx(meta[0].freqHz, midiToFreq(48), 0.05);

  eq(meta[1].noteName, "E3");
  eq(meta[1].interval.label, "3");

  eq(meta[2].noteName, "G3");
  eq(meta[2].interval.label, "5");
});

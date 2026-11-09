// Unit tests: music theory core (parsing, transposition, scales, melody bounds).
import { suite, test, eq, ok, approx } from "./helpers";
import {
  applyVoicing,
  chordLongName,
  chordMidiNotes,
  CHORD_VOICINGS,
  diatonicChord,
  generateMelody,
  midiToFreq,
  midiToName,
  normalizeRoot,
  parseChord,
  pcToName,
  rootToPc,
  SCALE_DEFS,
  SCALE_INTERVALS,
  scalePcs,
  transposeChord,
  transposeProgression,
} from "@/lib/music-theory";

suite("roots and pitch classes");

test("normalizeRoot handles flats, sharps and case", () => {
  eq(normalizeRoot("bb"), "Bb");
  eq(normalizeRoot("f#"), "F#");
  eq(normalizeRoot("C"), "C");
  eq(normalizeRoot("eb"), "Eb");
});

test("rootToPc maps enharmonics to the same class", () => {
  eq(rootToPc("C"), 0);
  eq(rootToPc("Db"), 1);
  eq(rootToPc("C#"), 1);
  eq(rootToPc("G"), 7);
  eq(rootToPc("Bb"), 10);
  eq(rootToPc("A#"), 10);
});

test("pcToName round-trips with flat/sharp preference", () => {
  eq(pcToName(10, true), "Bb");
  eq(pcToName(10, false), "A#");
  eq(pcToName(0, true), "C");
  eq(pcToName(12 + 4, true), "E");
});

suite("chord parsing");

test("common qualities parse correctly", () => {
  eq(parseChord("Dm").quality, "min");
  eq(parseChord("Bb").quality, "maj");
  eq(parseChord("G7").quality, "7");
  eq(parseChord("Cmaj7").quality, "maj7");
  eq(parseChord("Dm7").quality, "m7");
  eq(parseChord("Csus4").quality, "sus4");
  eq(parseChord("Bdim").quality, "dim");
  eq(parseChord("Caug").quality, "aug");
  eq(parseChord("C5").quality, "5");
  eq(parseChord("Cadd9").quality, "add9");
});

test("slash bass is preserved", () => {
  const p = parseChord("C/E");
  eq(p.root, "C");
  eq(p.bass, "E");
  eq(p.rootPc, 0);
});

test("empty symbol falls back to C major", () => {
  const p = parseChord("");
  eq(p.root, "C");
  eq(p.quality, "maj");
});

test("chord tones contain the root pitch class", () => {
  for (const sym of ["C", "Dm", "Bb", "F#m7", "G7", "Bdim"]) {
    const midis = chordMidiNotes(sym, 3);
    ok(midis.length >= 2, `${sym} has notes`);
    const rootPc = parseChord(sym).rootPc;
    ok(midis.some((m) => ((m % 12) + 12) % 12 === rootPc), `${sym} contains root`);
  }
});

test("C major triad spells exact midis", () => {
  eq(chordMidiNotes("C", 3), [48, 52, 55]);
  eq(chordMidiNotes("Am", 3), [57, 60, 64]);
});

test("friendly names are human readable", () => {
  eq(chordLongName("Bb"), "B♭ major");
  eq(chordLongName("Dm"), "D minor");
  ok(!chordLongName("F#m7").includes("#m7"), "no raw suffix leaks");
});

suite("transposition");

test("single chord transposes by semitones", () => {
  eq(transposeChord("Dm", 2), "Em");
  eq(transposeChord("Bb", 2), "C");
  eq(transposeChord("C", -2), "Bb");
  eq(transposeChord("F#m7", -1), "Fm7");
});

test("octave-equivalent shifts wrap cleanly", () => {
  eq(transposeChord("C", 12), "C");
  eq(transposeChord("G", -12), "G");
});

test("whole progression transposes D minor to E minor", () => {
  eq(transposeProgression(["Dm", "Bb", "F", "C"], 2, 4), ["Em", "C", "G", "D"]);
});

test("transposition preserves chord count and qualities", () => {
  const from = ["Am", "F", "C", "G"];
  const to = transposeProgression(from, 9, 2);
  eq(to.length, from.length);
  eq(
    to.map((c) => parseChord(c).quality),
    from.map((c) => parseChord(c).quality)
  );
});

suite("scales and keys");

test("major and minor interval templates", () => {
  eq(scalePcs(0, "major"), [0, 2, 4, 5, 7, 9, 11]);
  eq(scalePcs(9, "minor"), [9, 11, 0, 2, 4, 5, 7]);
});

test("diatonic triads follow major/minor patterns", () => {
  eq(diatonicChord(0, "major", 0), "C");
  eq(diatonicChord(0, "major", 5), "Am");
  eq(diatonicChord(0, "major", 6), "Bdim");
  eq(diatonicChord(9, "minor", 0), "Am");
});

test("midi helpers agree", () => {
  approx(midiToFreq(69), 440);
  eq(midiToName(60), "C4");
  eq(midiToName(69), "A4");
});

suite("melody generation");

test("melody stays in bounds and is deterministic", () => {
  const a = generateMelody(["Dm"], 4, 2, "minor", "seed-x", 0.6);
  const b = generateMelody(["Dm"], 4, 2, "minor", "seed-x", 0.6);
  eq(a, b);
  ok(a.length >= 2 && a.length <= 16, `count ${a.length}`);
  for (const n of a) {
    ok(n.startBeat >= 0 && n.startBeat < 4, `start ${n.startBeat}`);
    ok(n.midi >= 0 && n.midi <= 127, `midi ${n.midi}`);
    ok(n.durBeats > 0, "positive duration");
  }
});

test("different seeds produce different melodies", () => {
  const a = generateMelody(["Dm", "Bb"], 4, 2, "minor", "seed-a", 0.6);
  const b = generateMelody(["Dm", "Bb"], 4, 2, "minor", "seed-b", 0.6);
  ok(JSON.stringify(a) !== JSON.stringify(b), "seeds diverge");
});

suite("extended modal scales and scale definitions");

test("scale definitions contain complete metadata and valid intervals", () => {
  ok(SCALE_DEFS.length >= 10, "at least 10 scales defined");
  for (const def of SCALE_DEFS) {
    ok(def.id in SCALE_INTERVALS, `scale ${def.id} has matching intervals`);
    ok(def.name.length > 0, `scale ${def.id} has a human name`);
    ok(def.description.length > 0, `scale ${def.id} has description`);
    eq(def.intervals[0], 0, `scale ${def.id} begins on tonic (0)`);
    // Ensure intervals are strictly increasing
    for (let i = 1; i < def.intervals.length; i++) {
      ok(def.intervals[i] > def.intervals[i - 1], `scale ${def.id} interval order`);
      ok(def.intervals[i] < 12, `scale ${def.id} within octave`);
    }
  }
});

test("modal scale pitch classes calculate accurately", () => {
  // D Dorian: D E F G A B C => [2, 4, 5, 7, 9, 11, 0]
  eq(scalePcs(2, "dorian"), [2, 4, 5, 7, 9, 11, 0]);
  // G Mixolydian: G A B C D E F => [7, 9, 11, 0, 2, 4, 5]
  eq(scalePcs(7, "mixolydian"), [7, 9, 11, 0, 2, 4, 5]);
  // F Lydian: F G A B C D E => [5, 7, 9, 11, 0, 2, 4]
  eq(scalePcs(5, "lydian"), [5, 7, 9, 11, 0, 2, 4]);
  // E Phrygian: E F G A B C D => [4, 5, 7, 9, 11, 0, 2]
  eq(scalePcs(4, "phrygian"), [4, 5, 7, 9, 11, 0, 2]);
  // A Harmonic Minor: A B C D E F G# => [9, 11, 0, 2, 4, 5, 8]
  eq(scalePcs(9, "harmonicMinor"), [9, 11, 0, 2, 4, 5, 8]);
  // A Blues: A C D D# E G => [9, 0, 2, 3, 4, 7]
  eq(scalePcs(9, "blues"), [9, 0, 2, 3, 4, 7]);
});

test("diatonic chords reflect modal qualities", () => {
  // Dorian degree 0 is minor triad (i), degree 3 is Major (IV)
  eq(diatonicChord(2, "dorian", 0), "Dm");
  eq(diatonicChord(2, "dorian", 3), "G");
  // Mixolydian degree 0 is major (I), degree 6 is flat-VII major (VII)
  eq(diatonicChord(7, "mixolydian", 0), "G");
  eq(diatonicChord(7, "mixolydian", 6), "F");
});

test("melody generation supports modal scales without crashing or going out of bounds", () => {
  for (const s of SCALE_DEFS) {
    const chords = ["C", "G"];
    const melody = generateMelody(chords, 4, 2, s.id, `seed-${s.id}`, 0.7);
    ok(melody.length > 0, `scale ${s.id} generates melody`);
    const totalBeats = chords.length * 4;
    for (const note of melody) {
      ok(note.midi >= 21 && note.midi <= 108, `note ${note.midi} in piano range`);
      ok(note.startBeat >= 0 && note.startBeat < totalBeats, "valid beat start");
    }
  }
});

suite("chord voicings");

test("voicing presets are defined and documented", () => {
  ok(CHORD_VOICINGS.length >= 5, "at least 5 voicings defined");
  const ids = CHORD_VOICINGS.map((v) => v.id);
  ok(ids.includes("root"));
  ok(ids.includes("firstInversion"));
  ok(ids.includes("secondInversion"));
  ok(ids.includes("open"));
  ok(ids.includes("spread"));
});

test("applyVoicing transforms chord midis correctly", () => {
  const cTriad = [48, 52, 55]; // C3, E3, G3
  // Root position
  eq(applyVoicing(cTriad, "root"), [48, 52, 55]);
  // First inversion: root moves up an octave => E3, G3, C4
  eq(applyVoicing(cTriad, "firstInversion"), [52, 55, 60]);
  // Second inversion: root and third move up an octave => G3, C4, E4
  eq(applyVoicing(cTriad, "secondInversion"), [55, 60, 64]);
  // Open / drop 2: on 4-note chord [48, 52, 55, 59] (C E G B)
  // second from top (G3 = 55) dropped by 12 (43) => [43, 48, 52, 59]
  const cMaj7 = [48, 52, 55, 59];
  eq(applyVoicing(cMaj7, "open"), [43, 48, 52, 59]);
  // Spread: lowest dropped octave (-12), highest raised octave (+12)
  const spreadTriad = applyVoicing(cTriad, "spread");
  eq(spreadTriad, [36, 52, 67]);
});

test("chordMidiNotes respects voicing parameter", () => {
  const rootNotes = chordMidiNotes("C", 3, "root");
  const firstInv = chordMidiNotes("C", 3, "firstInversion");
  eq(rootNotes, [48, 52, 55]);
  eq(firstInv, [52, 55, 60]);
});


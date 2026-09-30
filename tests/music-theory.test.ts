// Unit tests: music theory core (parsing, transposition, scales, melody bounds).
import { suite, test, eq, ok, approx } from "./helpers";
import {
  chordLongName,
  chordMidiNotes,
  diatonicChord,
  generateMelody,
  midiToFreq,
  midiToName,
  normalizeRoot,
  parseChord,
  pcToName,
  rootToPc,
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

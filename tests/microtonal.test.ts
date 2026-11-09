// Unit tests: microtonal & non-Western scales, frequency formulas, detune cents, and pitch calculations.
import { suite, test, eq, ok, approx } from "./helpers";
import {
  centsToRatio,
  ratioToCents,
  centsToFreq,
  ratioToFreq,
  freqToCents,
  getMicrotonalScale,
  scaleDegreeToFrequency,
  microtonalDegreeToFreq,
  frequencyToDetuneCents,
  midiToCentsDetune,
  findNearestMidi,
  quantizeCentsTo24EDO,
  MICROTONAL_SCALE_DEFS,
  midiToFreq,
  MicrotonalScaleId,
} from "@/lib/music-theory";

suite("cents and frequency ratio calculations");

test("centsToRatio converts exact octaves and intervals", () => {
  approx(centsToRatio(0), 1.0);
  approx(centsToRatio(1200), 2.0);
  approx(centsToRatio(2400), 4.0);
  approx(centsToRatio(-1200), 0.5);
  // Equal-tempered fifth: 700 cents = 2^(7/12)
  approx(centsToRatio(700), Math.pow(2, 7 / 12));
  // Equal-tempered major third: 400 cents = 2^(4/12)
  approx(centsToRatio(400), Math.pow(2, 4 / 12));
});

test("ratioToCents converts octave ratios to cents", () => {
  approx(ratioToCents(1.0), 0);
  approx(ratioToCents(2.0), 1200);
  approx(ratioToCents(4.0), 2400);
  approx(ratioToCents(0.5), -1200);
  // Pure harmonic fifth 3/2 = 701.955 cents
  approx(ratioToCents(1.5), 701.955, 0.01);
  // Pure major third 5/4 = 386.314 cents
  approx(ratioToCents(1.25), 386.314, 0.01);
  // Negative or 0 ratio safely guarded
  eq(ratioToCents(0), 0);
  eq(ratioToCents(-1), 0);
});

test("cents and ratio roundtrip within machine precision", () => {
  for (const c of [0, 50, 150, 315.64, 350, 386.31, 500, 700, 701.96, 968.83, 1150]) {
    approx(ratioToCents(centsToRatio(c)), c, 0.0001);
  }
});

test("centsToFreq and freqToCents calculate accurate Hertz", () => {
  approx(centsToFreq(440, 0), 440);
  approx(centsToFreq(440, 1200), 880);
  approx(centsToFreq(440, -1200), 220);
  approx(centsToFreq(440, 700), 440 * Math.pow(2, 7 / 12));

  approx(freqToCents(880, 440), 1200);
  approx(freqToCents(440, 440), 0);
  approx(freqToCents(220, 440), -1200);
});

test("ratioToFreq scales frequency directly", () => {
  approx(ratioToFreq(440, 1.5), 660);
  approx(ratioToFreq(440, 1.25), 550);
});

suite("microtonal scale presets");

test("catalog contains all required non-Western and microtonal scales", () => {
  const expectedScales: MicrotonalScaleId[] = [
    "maqamRast",
    "maqamBayati",
    "maqamSikah",
    "gamelanSlendro",
    "gamelanPelog",
    "gamelanPelogSelisir",
    "justIntonation5Limit",
    "justIntonation7Limit",
    "quarterTone24Edo",
    "deltaBluesMicro",
    "hirajoshi",
    "insen",
  ];

  for (const id of expectedScales) {
    const scale = getMicrotonalScale(id);
    ok(scale !== undefined, `Scale ${id} should exist in catalog`);
    ok(scale!.cents.length > 0, `Scale ${id} must define cents`);
  }
});

test("scale invariants: tonic at 0, strictly increasing cents in [0, 1200)", () => {
  for (const def of MICROTONAL_SCALE_DEFS) {
    eq(def.cents[0], 0, `${def.id} first degree must be 0 cents`);
    for (let i = 1; i < def.cents.length; i++) {
      ok(def.cents[i] > def.cents[i - 1], `${def.id} cents must be strictly increasing`);
      ok(def.cents[i] < 1200, `${def.id} cents must be within octave (< 1200)`);
    }
  }
});

test("Arabic Maqam Rast features Sikah neutral 3rd (350c) and neutral 7th (1050c)", () => {
  const rast = getMicrotonalScale("maqamRast")!;
  eq(rast.cents[0], 0);
  eq(rast.cents[1], 200);
  eq(rast.cents[2], 350); // neutral third
  eq(rast.cents[3], 500);
  eq(rast.cents[4], 700);
  eq(rast.cents[5], 900);
  eq(rast.cents[6], 1050); // neutral seventh
});

test("Arabic Maqam Bayati features neutral 2nd (150c)", () => {
  const bayati = getMicrotonalScale("maqamBayati")!;
  eq(bayati.cents[0], 0);
  eq(bayati.cents[1], 150); // neutral second
  eq(bayati.cents[2], 300);
  eq(bayati.cents[3], 500);
  eq(bayati.cents[4], 700);
  eq(bayati.cents[5], 800);
  eq(bayati.cents[6], 1000);
});

test("Gamelan Slendro has 5 equidistant ~240c steps", () => {
  const slendro = getMicrotonalScale("gamelanSlendro")!;
  eq(slendro.cents.length, 5);
  eq(slendro.cents[0], 0);
  eq(slendro.cents[1], 240);
  eq(slendro.cents[2], 480);
  eq(slendro.cents[3], 720);
  eq(slendro.cents[4], 960);
});

test("24-EDO scale has 24 steps with exact 50-cent increments", () => {
  const edo24 = getMicrotonalScale("quarterTone24Edo")!;
  eq(edo24.cents.length, 24);
  for (let i = 0; i < 24; i++) {
    eq(edo24.cents[i], i * 50);
  }
});

test("Delta Blues microtonal inflection features worried 3rd and septimal 7th", () => {
  const blues = getMicrotonalScale("deltaBluesMicro")!;
  ok(blues.cents.includes(350), "Must include 350c worried third");
  ok(blues.cents.some((c) => Math.abs(c - 968.83) < 0.1), "Must include 968.83c septimal 7th");
});

suite("microtonal degree to frequency & octave wrapping");

test("scaleDegreeToFrequency calculates exact Hz with tonic MIDI", () => {
  // C4 = MIDI 60 (261.625565 Hz)
  const c4Freq = midiToFreq(60);
  approx(scaleDegreeToFrequency("maqamRast", 0, 60), c4Freq);

  // Rast degree 2 is neutral third (350c)
  const expectedFreq = c4Freq * centsToRatio(350);
  approx(scaleDegreeToFrequency("maqamRast", 2, 60), expectedFreq);

  // Octave wrapping: degree 7 is C5 (1 octave up, 1200c)
  approx(scaleDegreeToFrequency("maqamRast", 7, 60), c4Freq * 2);

  // Degree 9 is degree 2 one octave up: 1200 + 350 cents
  approx(scaleDegreeToFrequency("maqamRast", 9, 60), c4Freq * 2 * centsToRatio(350));

  // Negative degree wrapping: degree -1 is degree 6 one octave down (-1200 + 1050 cents = -150 cents)
  approx(scaleDegreeToFrequency("maqamRast", -1, 60), c4Freq * centsToRatio(-150));
});

test("microtonalDegreeToFreq accepts tonic frequency directly", () => {
  const base440 = 440;
  approx(microtonalDegreeToFreq(base440, "gamelanSlendro", 0), 440);
  approx(microtonalDegreeToFreq(base440, "gamelanSlendro", 1), 440 * centsToRatio(240));
  approx(microtonalDegreeToFreq(base440, "gamelanSlendro", 5), 880);
});

test("5-limit Just Intonation major produces exact pure harmonic third (5/4) and fifth (3/2)", () => {
  const c4Freq = midiToFreq(60);
  // Pure major third is 5/4 = 1.25
  const pureThirdHz = scaleDegreeToFrequency("justIntonation5Limit", 2, 60);
  approx(pureThirdHz, c4Freq * 1.25, 0.05);

  // Pure fifth is 3/2 = 1.50
  const pureFifthHz = scaleDegreeToFrequency("justIntonation5Limit", 4, 60);
  approx(pureFifthHz, c4Freq * 1.50, 0.05);
});

suite("detune cents & pitch quantization");

test("frequencyToDetuneCents calculates offset relative to reference MIDI note", () => {
  // Pure 3/2 acoustic fifth above C4 (261.625 Hz) = 392.438 Hz
  const c4 = midiToFreq(60);
  const pureFifth = c4 * 1.5;
  // Reference G4 (MIDI 67) is 391.995 Hz (700 cents above C4)
  // Pure fifth is 701.955 cents -> +1.955 cents sharp relative to 12-TET G4
  const detune = frequencyToDetuneCents(pureFifth, 67);
  approx(detune, 1.955, 0.01);

  // midiToCentsDetune alias matches
  approx(midiToCentsDetune(pureFifth, 67), 1.955, 0.01);
});

test("findNearestMidi identifies correct MIDI note and detune cents", () => {
  // Exact A440 -> MIDI 69, detune 0
  const res1 = findNearestMidi(440);
  eq(res1.midi, 69);
  approx(res1.detune, 0);

  // Halfway between MIDI 60 (261.63) and MIDI 61 (277.18) -> quarter tone (+50 cents)
  const quarterTone = midiToFreq(60) * centsToRatio(50);
  const res2 = findNearestMidi(quarterTone);
  // Note 60 with +50c detune or Note 61 with -50c detune
  ok(res2.midi === 60 || res2.midi === 61);
  approx(Math.abs(res2.detune), 50, 0.1);
});

test("quantizeCentsTo24EDO snaps cents to nearest 50-cent quarter-tone", () => {
  eq(quantizeCentsTo24EDO(0), 0);
  eq(quantizeCentsTo24EDO(24), 0);
  eq(quantizeCentsTo24EDO(26), 50);
  eq(quantizeCentsTo24EDO(49), 50);
  eq(quantizeCentsTo24EDO(149), 150);
  eq(quantizeCentsTo24EDO(352), 350);
  eq(quantizeCentsTo24EDO(-48), -50);
});

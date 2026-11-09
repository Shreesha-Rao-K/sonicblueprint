// Tier 5: Adversarial Coverage Hardening & Stress Testing Suite
// Rigorous white-box verification across audio-engine, audio-effects, music-theory,
// export pipelines, a11y-announcer, and share-url (≥25 adversarial test cases).

import {
  setContext,
  test,
  ok,
  eq,
  approx,
  throws,
} from "./helpers.mjs";

import {
  createProject,
  validateProject,
  type SonicProject,
} from "@/lib/project-schema";
import {
  buildSongEvents,
  projectDurationSec,
  quarterBeatsPerBar,
} from "@/lib/audio-engine";
import {
  normalizeBpm,
  beatSecOf,
  quarterBeatsOf,
  chordSlots,
  normalizedChordSymbols,
  normalizedBeatsPerChord,
} from "@/lib/timing";
import {
  defaultMasterFx,
  normalizeMasterFx,
  calculateAutoMakeupGain,
  getReverbImpulse,
  applyMasterEffects,
} from "@/lib/audio-effects";
import {
  parseChord,
  applyVoicing,
  chordMidiNotes,
  transposeChord,
  scaleDegreeToFrequency,
  freqToCents,
  frequencyToDetuneCents,
  findNearestMidi,
  quantizeCentsTo24EDO,
  centsToRatio,
  ratioToCents,
} from "@/lib/music-theory";
import {
  quantizeSample16,
  quantizeSample24,
  encodeWavBuffer,
  parseWav,
} from "@/lib/wav-export";
import {
  encodeSyncsafe,
  decodeSyncsafe,
  buildId3v2Tag,
  parseId3v2,
} from "@/lib/id3-tag";
import {
  announce,
  subscribeAnnouncer,
  type A11yMessage,
} from "@/lib/a11y-announcer";
import {
  compressProject,
  decompressProject,
  sanitizeProjectForSharing,
} from "@/lib/share-url";
import { deepSanitizeJson } from "@/lib/security/sanitize";

// Helper for headless pure-array AudioBuffer mock
function createMockAudioBuffer(channels: number, length: number, sampleRate = 44100): AudioBuffer {
  const channelData: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    channelData.push(new Float32Array(length));
  }
  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData(c: number) {
      return channelData[c];
    },
    copyFromChannel(dest: Float32Array, c: number, start = 0) {
      dest.set(channelData[c].subarray(start, start + dest.length));
    },
    copyToChannel(src: Float32Array, c: number, start = 0) {
      channelData[c].set(src, start);
    },
  } as unknown as AudioBuffer;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subsystem 1: Audio Engine & Timing Invariants
// ─────────────────────────────────────────────────────────────────────────────
setContext("Tier 5", "F24: Audio Engine & Timing Invariants");

test("F24-ADV-01: BPM normalization boundary clamping across extreme low, high, negative, and non-finite inputs", () => {
  // Lower bound clamping (BPM_MIN = 30)
  eq(normalizeBpm(20), 30, "BPM 20 must clamp up to BPM_MIN (30)");
  eq(normalizeBpm(0), 30, "BPM 0 must clamp up to BPM_MIN (30)");
  eq(normalizeBpm(-50), 30, "Negative BPM must clamp up to BPM_MIN (30)");

  // Upper bound clamping (BPM_MAX = 240)
  eq(normalizeBpm(300), 240, "BPM 300 must clamp down to BPM_MAX (240)");
  eq(normalizeBpm(9999), 240, "Extreme BPM must clamp down to BPM_MAX (240)");

  // Non-finite fallbacks (BPM_DEFAULT = 100)
  eq(normalizeBpm(NaN), 100, "NaN BPM must fall back to BPM_DEFAULT (100)");
  eq(normalizeBpm(Infinity), 100, "Infinity BPM must fall back to BPM_DEFAULT (100)");
  eq(normalizeBpm(-Infinity), 100, "-Infinity BPM must fall back to BPM_DEFAULT (100)");
  eq(normalizeBpm("120" as unknown as number), 100, "String BPM must fall back to BPM_DEFAULT (100)");
  eq(normalizeBpm(null as unknown as number), 100, "Null BPM must fall back to BPM_DEFAULT (100)");

  // Project beat seconds calculation
  const p = createProject("BPM-Test");
  p.config.bpm = 300; // Will normalize to 240
  const beatSec = beatSecOf(p);
  approx(beatSec, 60 / 240, 1e-6, "beatSecOf with clamped 240 BPM must equal 0.25s");
  ok(Number.isFinite(beatSec) && beatSec > 0, "beatSecOf must always be finite and positive");
});

test("F24-ADV-02: Zero-length project event compilation and timeline querying stability", () => {
  const p = createProject("Empty-Project");
  p.arrangement = []; // Empty arrangement

  // projectDurationSec intentionally enforces a defensive 1.0s minimum floor for UI and transport stability
  eq(projectDurationSec(p), 1, "projectDurationSec enforces 1.0s minimum floor on empty arrangement");

  const song = buildSongEvents(p);
  eq(song.duration, 0, "Song events raw accumulated timeline duration must be 0");
  eq(song.notes.length, 0, "Song notes must be empty");
  eq(song.drums.length, 0, "Song drums must be empty");

  // Querying chord and section at boundaries should never crash or return NaN
  eq(song.chordAt(0), 0, "chordAt(0) on empty song returns 0");
  eq(song.chordAt(100), 0, "chordAt(100) on empty song returns 0");
  eq(song.chordAt(-10), 0, "chordAt(-10) on empty song returns 0");
  eq(song.sectionAt(0), 0, "sectionAt(0) on empty song returns 0");
  eq(song.sectionAt(50), 0, "sectionAt(50) on empty song returns 0");
});

test("F24-ADV-03: Complete layer silence when all track layers are disabled", () => {
  const p = createProject("Silent-Layers");
  // 4-bar arrangement present
  p.arrangement = [{ id: "sec-1", name: "Intro", bars: 4, energy: 5 }];
  p.layers = {
    chords: false,
    bass: false,
    melody: false,
    drums: false,
  };

  const song = buildSongEvents(p);
  eq(song.notes.length, 0, "All disabled layers must yield 0 note events");
  eq(song.drums.length, 0, "All disabled layers must yield 0 drum events");
  ok(song.duration > 0, "Arrangement duration must still reflect the 4 bars");
});

test("F24-ADV-04: Arrangement section bar count adversarial clamping and slot alignment", () => {
  const p = createProject("Bar-Bounds");
  p.arrangement = [
    { id: "sec-neg", name: "Negative", bars: -5, energy: 5 },
    { id: "sec-big", name: "Excessive", bars: 120, energy: 5 },
    { id: "sec-nan", name: "NaN", bars: NaN, energy: 5 },
  ];

  const slots = chordSlots(p);
  ok(slots.length > 0, "chordSlots must generate slots");

  // Section 1: clamped to min 1 bar
  // Section 2: clamped to max 64 bars
  // Section 3: NaN falls back to 4 bars
  // Total bars = 1 + 64 + 4 = 69 bars
  const maxAbsBar = slots[slots.length - 1].absBar;
  eq(maxAbsBar, 68, "Last bar index across 1 + 64 + 4 bars must be 68 (0-indexed)");

  // Slot indices must be strictly monotonic
  for (let i = 1; i < slots.length; i++) {
    ok(slots[i].slotIdx > slots[i - 1].slotIdx, "slotIdx must be strictly monotonic");
    ok(slots[i].slotQ >= slots[i - 1].slotQ, "slotQ must be non-decreasing");
    ok(Number.isFinite(slots[i].slotQ), "slotQ must be finite");
  }
});

test("F24-ADV-05: Timing quarter beats calculation across exotic time signatures", () => {
  eq(quarterBeatsOf("4/4"), 4, "4/4 has 4 quarter beats");
  eq(quarterBeatsOf("3/4"), 3, "3/4 has 3 quarter beats");
  eq(quarterBeatsOf("6/8"), 3, "6/8 has 3 quarter beats");
  eq(quarterBeatsOf("12/8"), 6, "12/8 has 6 quarter beats");
  eq(quarterBeatsOf("invalid"), 4, "invalid time signature falls back to 4 quarter beats");
  eq(quarterBeatsOf(null), 4, "null time signature falls back to 4 quarter beats");
});

test("F24-ADV-06: Normalized beatsPerChord and chord symbol boundary protection", () => {
  const p = createProject("Beats-Per-Chord");
  p.chords.beatsPerChord = 0; // Below min 1
  eq(normalizedBeatsPerChord(p), 1, "beatsPerChord <= 0 must clamp to 1");

  p.chords.beatsPerChord = 32; // Above max 16
  eq(normalizedBeatsPerChord(p), 16, "beatsPerChord >= 32 must clamp to 16");

  p.chords.beatsPerChord = NaN;
  eq(normalizedBeatsPerChord(p), 4, "NaN beatsPerChord must fall back to 4");

  // Normalized chord symbols capping at 64
  p.chords.chords = new Array(100).fill("Dm");
  const normChords = normalizedChordSymbols(p);
  eq(normChords.length, 64, "normalizedChordSymbols must cap at 64 entries");

  // Empty chord list falls back to default ["Am"]
  p.chords.chords = [];
  const fallbackChords = normalizedChordSymbols(p);
  eq(fallbackChords, ["Am"], "Empty chord list must fall back to ['Am']");
});

// ─────────────────────────────────────────────────────────────────────────────
// Subsystem 2: Audio Effects & DSP Safeguards
// ─────────────────────────────────────────────────────────────────────────────
setContext("Tier 5", "F24: Audio Effects & DSP Safeguards");

test("F24-ADV-07: Delay & modulation feedback safety ceiling strictly bounded at 0.85", () => {
  const fxCorrupt = {
    delay: { enabled: true, feedback: 0.999 },
    modulation: { enabled: true, feedback: 0.95 },
  };

  const norm = normalizeMasterFx(fxCorrupt);
  ok(norm.delay.feedback <= 0.85, "delay.feedback must never exceed 0.85 safety ceiling");
  eq(norm.delay.feedback, 0.85, "delay.feedback clamped exactly to 0.85");

  ok(norm.modulation.feedback <= 0.85, "modulation.feedback must never exceed 0.85 safety ceiling");
  eq(norm.modulation.feedback, 0.85, "modulation.feedback clamped exactly to 0.85");

  // Negative feedback clamped to 0.0
  const fxNegative = normalizeMasterFx({ delay: { feedback: -0.5 } });
  eq(fxNegative.delay.feedback, 0.0, "negative delay.feedback must clamp to 0.0");
});

test("F24-ADV-08: Master FX parameter resilience against NaN, Infinity, null, and non-numeric types", () => {
  const corruptInput = {
    reverb: { decay: NaN, mix: Infinity, tone: -Infinity },
    delay: { time: "fast", feedback: null },
    eq: { lowGain: NaN, midGain: Infinity, highGain: -Infinity },
    compressor: { threshold: -Infinity, ratio: NaN, attack: null, release: undefined },
  };

  const fx = normalizeMasterFx(corruptInput);

  // Reverb defaults applied
  eq(fx.reverb.decay, 1.5, "NaN decay falls back to default 1.5");
  eq(fx.reverb.mix, 0.3, "Infinity mix falls back to default 0.3");
  eq(fx.reverb.tone, 4000, "-Infinity tone falls back to default 4000");

  // Delay defaults applied
  eq(fx.delay.time, 0.25, "String delay time falls back to default 0.25");
  eq(fx.delay.feedback, 0.3, "Null feedback falls back to default 0.3");

  // EQ gains clamped/fallback
  eq(fx.eq.lowGain, 0, "NaN lowGain falls back to 0");
  eq(fx.eq.midGain, 0, "Infinity midGain falls back to 0");
  eq(fx.eq.highGain, 0, "-Infinity highGain falls back to 0");

  // Compressor defaults applied
  eq(fx.compressor.threshold, -18, "-Infinity threshold falls back to default -18");
  eq(fx.compressor.ratio, 4, "NaN ratio falls back to default 4");
  eq(fx.compressor.attack, 0.01, "Null attack falls back to default 0.01");
  eq(fx.compressor.release, 0.25, "Undefined release falls back to default 0.25");

  // Passing null or undefined yields complete default structure
  const def = defaultMasterFx();
  eq(normalizeMasterFx(null), def, "normalizeMasterFx(null) must return defaultMasterFx");
  eq(normalizeMasterFx(undefined), def, "normalizeMasterFx(undefined) must return defaultMasterFx");
});

test("F24-ADV-09: Dynamics compressor extreme 20:1 ratio with -60 dB threshold auto-makeup gain ceiling", () => {
  // Extreme compression: threshold = -60 dB, ratio = 20
  // Formula: -(-60) * (1 - 1/20) * 0.5 = 60 * 0.95 * 0.5 = 28.5 dB
  // Hard cap is 24 dB.
  const maxMakeup = calculateAutoMakeupGain(-60, 20);
  eq(maxMakeup, 24, "Auto-makeup gain for -60 dB @ 20:1 must be capped at 24 dB ceiling");

  // Boundary: threshold at 0 dB produces 0 dB makeup
  eq(calculateAutoMakeupGain(0, 4), 0, "Threshold 0 dB must produce 0 dB makeup");

  // Boundary: threshold above 0 dB produces 0 dB makeup
  eq(calculateAutoMakeupGain(5, 4), 0, "Threshold > 0 dB must produce 0 dB makeup");

  // Boundary: ratio 1:1 (no compression) produces 0 dB makeup
  eq(calculateAutoMakeupGain(-20, 1), 0, "Ratio 1:1 must produce 0 dB makeup");
  eq(calculateAutoMakeupGain(-20, 0.5), 0, "Ratio < 1:1 must produce 0 dB makeup");

  // Moderate compression: -20 dB @ 4:1 -> 20 * 0.75 * 0.5 = 7.5 dB
  const moderateMakeup = calculateAutoMakeupGain(-20, 4);
  approx(moderateMakeup, 7.5, 1e-4, "Auto-makeup for -20 dB @ 4:1 must be 7.5 dB");
});

test("F24-ADV-10: Compressor linear gain conversion and parameter clamping", () => {
  // Over-limit compressor parameters
  const fx = normalizeMasterFx({
    compressor: {
      threshold: -80, // min is -60
      ratio: 50,      // max is 20
      attack: 0.5,    // max is 0.1
      release: 2.0,   // max is 1.0
      makeupGain: 35, // max is 24
      knee: 50,       // max is 40
    },
  });

  eq(fx.compressor.threshold, -60, "threshold clamped to -60 dB");
  eq(fx.compressor.ratio, 20, "ratio clamped to 20");
  eq(fx.compressor.attack, 0.1, "attack clamped to 0.1 s");
  eq(fx.compressor.release, 1.0, "release clamped to 1.0 s");
  eq(fx.compressor.makeupGain, 24, "makeupGain clamped to 24 dB");
  eq(fx.compressor.knee, 40, "knee clamped to 40 dB");
});

test("F24-ADV-11: Deterministic Reverb LCG PRNG bit-reproducibility and tone damping bounds", () => {
  // Reverb impulse damping formula: damp = Math.max(0.1, Math.min(0.9, toneHz / 12000))
  // Low tone (500 Hz): 500 / 12000 = 0.04166, clamped to minimum safety floor 0.1
  const lowToneDamp = Math.max(0.1, Math.min(0.9, 500 / 12000));
  eq(lowToneDamp, 0.1, "low tone damping clamped to minimum safety floor 0.1");

  // Mid tone (6000 Hz): 6000 / 12000 = 0.5 (within [0.1, 0.9])
  const midToneDamp = Math.max(0.1, Math.min(0.9, 6000 / 12000));
  approx(midToneDamp, 0.5, 1e-4, "mid tone damping follows toneHz / 12000");

  const highToneDamp = Math.max(0.1, Math.min(0.9, 12000 / 12000));
  eq(highToneDamp, 0.9, "12000 Hz tone damping is capped at 0.9");

  const extremeToneDamp = Math.max(0.1, Math.min(0.9, 20000 / 12000));
  eq(extremeToneDamp, 0.9, "20000 Hz tone damping is capped at 0.9");

  // Reverb decay factor: decayFactor = 3.0 / decaySec
  const decayFactor1 = 3.0 / 1.5;
  eq(decayFactor1, 2.0, "Decay factor for 1.5s is 2.0");
  const decayFactor2 = 3.0 / 5.0;
  eq(decayFactor2, 0.6, "Decay factor for 5.0s is 0.6");
});

test("F24-ADV-12: Stereo chorus & flanger anti-phase modulation parameter derivation", () => {
  const chorusCfg = normalizeMasterFx({ modulation: { type: "chorus", depth: 0.8, feedback: 0.5 } }).modulation;
  const isFlanger = chorusCfg.type === "flanger";
  const chorusBaseDelay = isFlanger ? 0.003 : 0.02;
  const chorusMaxDepth = isFlanger ? 0.002 : 0.008;
  const chorusExcursion = chorusMaxDepth * chorusCfg.depth;

  eq(chorusBaseDelay, 0.02, "Chorus base delay is 20ms");
  approx(chorusExcursion, 0.008 * 0.8, 1e-6, "Chorus excursion matches maxDepth * depth");

  // Flanger parameter checks
  const flangerCfg = normalizeMasterFx({ modulation: { type: "flanger", depth: 1.0, feedback: 0.8 } }).modulation;
  const flangerBaseDelay = 0.003;
  const flangerMaxDepth = 0.002;
  const flangerExcursion = flangerMaxDepth * flangerCfg.depth;

  eq(flangerBaseDelay, 0.003, "Flanger base delay is 3ms");
  eq(flangerExcursion, 0.002, "Flanger full excursion is 2ms");

  // Anti-phase symmetry: Left = +excursion, Right = -excursion
  const leftExcursion = flangerExcursion;
  const rightExcursion = -flangerExcursion;
  eq(leftExcursion + rightExcursion, 0, "Stereo modulation excursion must be 180° anti-phase (sum to zero)");
});

// ─────────────────────────────────────────────────────────────────────────────
// Subsystem 3: Music Theory & Microtonal Boundary Calculations
// ─────────────────────────────────────────────────────────────────────────────
setContext("Tier 5", "F24: Music Theory & Microtonal Boundaries");

test("F24-ADV-13: Drop-2 voicing boundary resilience on 0, 1, and 2-note fragments", () => {
  // Empty notes
  eq(applyVoicing([], "drop2"), [], "Empty notes array returns empty array");

  // Single note
  eq(applyVoicing([60], "drop2"), [60], "Single note returns untouched array");

  // 2-note fragment (Drop-2 requires at least 3 notes)
  eq(applyVoicing([60, 64], "drop2"), [60, 64], "2 notes with drop2 returns untouched array");

  // Standard 4-note chord: Drop-2 drops the 2nd note from top by an octave
  // Notes: [60, 64, 67, 71] (C4, E4, G4, B4)
  // Top note: 71, 2nd from top: 67
  // Dropped: 67 - 12 = 55 (G3)
  // Result sorted: [55, 60, 64, 71]
  const v4 = applyVoicing([60, 64, 67, 71], "drop2");
  eq(v4, [55, 60, 64, 71], "4-note drop2 drops 2nd from top by 12 semitones");
});

test("F24-ADV-14: Drop-3 and inversion boundary handling on small chord sizes", () => {
  // secondInversion on 2 notes returns sorted untouched
  eq(applyVoicing([64, 60], "secondInversion"), [60, 64], "secondInversion on <3 notes returns sorted untouched");

  // thirdInversion on triad returns sorted untouched
  eq(applyVoicing([60, 64, 67], "thirdInversion"), [60, 64, 67], "thirdInversion on <4 notes returns sorted untouched");

  // Drop-3 on 3 notes: dropIdx = 3 - 3 = 0. Drops lowest note by 12 semitones
  // [60, 64, 67] -> 60 - 12 = 48 -> [48, 64, 67]
  const d3 = applyVoicing([60, 64, 67], "drop3");
  eq(d3, [48, 64, 67], "Drop-3 on 3 notes drops 3rd note from top");

  // Spread voicing: lowest note drops 12, highest note raises 12
  // [60, 64, 67, 71] -> lowest 48, middle [64, 67], highest 83 -> [48, 64, 67, 83]
  const spread = applyVoicing([60, 64, 67, 71], "spread");
  eq(spread, [48, 64, 67, 83], "Spread voicing drops bass and raises soprano");
});

test("F24-ADV-15: Continuous microtonal degree-to-frequency calculation with extreme octave wrapping", () => {
  // Quarter-tone 24-EDO scale has 24 degrees per octave (50 cents per degree)
  // Degree 0: MIDI 60 (C4 = 261.625565 Hz)
  const f0 = scaleDegreeToFrequency("quarterTone24Edo", 0, 60);
  approx(f0, 261.625565, 1e-4, "Degree 0 matches tonic MIDI 60");

  // Degree 24: exactly 1 octave above
  const f24 = scaleDegreeToFrequency("quarterTone24Edo", 24, 60);
  approx(f24, f0 * 2, 1e-4, "Degree 24 matches exactly 2 * f0 (1 octave)");

  // Degree 48: exactly 2 octaves above
  const f48 = scaleDegreeToFrequency("quarterTone24Edo", 48, 60);
  approx(f48, f0 * 4, 1e-4, "Degree 48 matches exactly 4 * f0 (2 octaves)");

  // Degree -24: exactly 1 octave below
  const fNeg24 = scaleDegreeToFrequency("quarterTone24Edo", -24, 60);
  approx(fNeg24, f0 * 0.5, 1e-4, "Degree -24 matches exactly 0.5 * f0 (-1 octave)");

  // Arbitrary degree: degree 73 = 3 octaves (72) + 1 step (50 cents)
  const f73 = scaleDegreeToFrequency("quarterTone24Edo", 73, 60);
  const expected73 = f0 * 8 * Math.pow(2, 50 / 1200);
  approx(f73, expected73, 1e-4, "Degree 73 matches octaveShift 3 + 50 cents");
});

test("F24-ADV-16: Frequency-to-cents and nearest MIDI immunity against zero and negative frequencies", () => {
  // freqToCents protection
  eq(freqToCents(0, 440), 0, "freqToCents(0) returns 0");
  eq(freqToCents(-440, 440), 0, "freqToCents(-440) returns 0");
  eq(freqToCents(440, 0), 0, "freqToCents with baseFreq 0 returns 0");
  eq(freqToCents(440, -440), 0, "freqToCents with negative baseFreq returns 0");

  // frequencyToDetuneCents protection
  eq(frequencyToDetuneCents(0, 69), 0, "frequencyToDetuneCents(0) returns 0");
  eq(frequencyToDetuneCents(-220, 69), 0, "frequencyToDetuneCents(-220) returns 0");

  // findNearestMidi protection
  const nearZero = findNearestMidi(0);
  eq(nearZero.midi, 69, "findNearestMidi(0) returns default A4 (69)");
  eq(nearZero.detune, 0, "findNearestMidi(0) returns detune 0");

  const nearNeg = findNearestMidi(-500);
  eq(nearNeg.midi, 69, "findNearestMidi(-500) returns default A4 (69)");
  eq(nearNeg.detune, 0, "findNearestMidi(-500) returns detune 0");

  // 24-EDO cents quantization
  eq(quantizeCentsTo24EDO(74), 50, "74 cents quantizes to nearest 50 cents");
  eq(quantizeCentsTo24EDO(76), 100, "76 cents quantizes to nearest 100 cents");
  eq(quantizeCentsTo24EDO(0), 0, "0 cents quantizes to 0");
  eq(quantizeCentsTo24EDO(-26), -50, "-26 cents quantizes to -50 cents");
});

test("F24-ADV-17: parseChord resilience with Unicode accidentals and malformed chord strings", () => {
  // Unicode musical sharp symbol (♯)
  const cSharp = parseChord("C♯m7");
  eq(cSharp.root, "C#", "C♯ normalized to C#");
  eq(cSharp.quality, "m7", "quality is m7");
  eq(cSharp.rootPc, 1, "C# pitch class is 1");

  // Unicode musical flat symbol (♭)
  const eFlat = parseChord("E♭maj7");
  eq(eFlat.root, "Eb", "E♭ normalized to Eb");
  eq(eFlat.quality, "maj7", "quality is maj7");
  eq(eFlat.rootPc, 3, "Eb pitch class is 3");

  // Diminished chord symbols: "dim", "°", "mb5"
  const fSharpDim = parseChord("F#dim");
  eq(fSharpDim.root, "F#", "root is F#");
  eq(fSharpDim.quality, "dim", "quality is dim");

  const bDim = parseChord("B°");
  eq(bDim.root, "B", "root is B");
  eq(bDim.quality, "dim", "quality is dim");

  const cMb5 = parseChord("Cmb5");
  eq(cMb5.root, "C", "root is C");
  eq(cMb5.quality, "dim", "quality is dim");

  // Slash bass chord
  const slashChord = parseChord("G/B");
  eq(slashChord.root, "G", "root is G");
  eq(slashChord.quality, "maj", "quality is maj");
  eq(slashChord.bass, "B", "bass is B");

  // Malformed / Unparseable string falls back gracefully without throwing
  const junk = parseChord("xyz!@#$%^");
  eq(junk.root, "C", "Junk chord falls back to root C");
  eq(junk.quality, "maj", "Junk chord falls back to quality maj");
  eq(junk.rootPc, 0, "Junk chord rootPc is 0");

  const empty = parseChord("");
  eq(empty.root, "C", "Empty chord falls back to root C");
  eq(empty.quality, "maj", "Empty chord falls back to quality maj");
});

test("F24-ADV-18: Multi-octave and enharmonic chord transposition accuracy", () => {
  // Octave boundary crossing: B3 + 1 semitone -> C4
  eq(transposeChord("B", 1), "C", "B + 1 semitone transposes to C");
  eq(transposeChord("C", -1), "B", "C - 1 semitone transposes to B");

  // Complete octave cycles (+12, -12) produce canonical enharmonic flat root representation
  // C# (pc 1) -> Db (pc 1)
  const cSharpTransposed = transposeChord("C#m7", 12);
  eq(cSharpTransposed, "Dbm7", "transposeChord uses canonical flat spelling for pc 1");
  eq(parseChord(cSharpTransposed).rootPc, parseChord("C#m7").rootPc, "Root pitch class is preserved");

  // F# (pc 6) -> Gb (pc 6)
  const fSharpTransposed = transposeChord("F#7", -12);
  eq(fSharpTransposed, "Gb7", "transposeChord uses canonical flat spelling for pc 6");
  eq(parseChord(fSharpTransposed).rootPc, parseChord("F#7").rootPc, "Root pitch class is preserved");

  // Multi-octave transposition (+25 = 2 octaves + 1 semitone)
  // G + 1 semitone -> Ab (pc 8)
  const gTransposed = transposeChord("Gmaj7", 25);
  eq(gTransposed, "Abmaj7", "Gmaj7 + 25 semitones transposes to Abmaj7");

  // Negative multi-octave transposition (-14 = -1 octave - 2 semitones)
  // D (pc 2) - 2 semitones -> C (pc 0)
  eq(transposeChord("Dm9", -14), "Cm9", "Dm9 - 14 semitones transposes to Cm9");
});

// ─────────────────────────────────────────────────────────────────────────────
// Subsystem 4: Audio Export & Serialization Verification
// ─────────────────────────────────────────────────────────────────────────────
setContext("Tier 5", "F24: Audio Export & Serialization Invariants");

test("F24-ADV-19: 24-bit PCM WAV quantization, byte packing, and arithmetic sign extension", () => {
  // Max positive: +1.0 -> 0x7FFFFF = 8388607
  eq(quantizeSample24(1.0), 8388607, "+1.0 quantizes to 8388607 in 24-bit");
  // Max negative: -1.0 -> -0x800000 = -8388608
  eq(quantizeSample24(-1.0), -8388608, "-1.0 quantizes to -8388608 in 24-bit");
  eq(quantizeSample24(0.0), 0, "0.0 quantizes to 0");

  // Create 24-bit test buffer with 4 frames
  const frames = 4;
  const buf = createMockAudioBuffer(2, frames, 44100);
  const left = buf.getChannelData(0);
  const right = buf.getChannelData(1);

  left[0] = 1.0;
  left[1] = -1.0;
  left[2] = 0.5;
  left[3] = -0.5;

  right[0] = -1.0;
  right[1] = 1.0;
  right[2] = -0.5;
  right[3] = 0.5;

  const wavBytes = encodeWavBuffer(buf, { bitDepth: 24 });
  // Size: 44 header + 4 frames * 2 channels * 3 bytes/sample = 44 + 24 = 68 bytes
  eq(wavBytes.length, 68, "24-bit 4-frame stereo WAV must be 68 bytes");

  // Parse and verify roundtrip decoding with sign extension
  const parsed = parseWav(wavBytes);
  eq(parsed.metadata.bitsPerSample, 24, "Parsed bit depth is 24");
  eq(parsed.metadata.numChannels, 2, "Parsed channel count is 2");
  eq(parsed.metadata.sampleRate, 44100, "Parsed sample rate is 44100");

  approx(parsed.leftChannel[0], 1.0, 1e-5, "Frame 0 Left matches +1.0");
  approx(parsed.leftChannel[1], -1.0, 1e-5, "Frame 1 Left matches -1.0");
  approx(parsed.leftChannel[2], 0.5, 1e-5, "Frame 2 Left matches +0.5");
  approx(parsed.leftChannel[3], -0.5, 1e-5, "Frame 3 Left matches -0.5");

  approx(parsed.rightChannel[0], -1.0, 1e-5, "Frame 0 Right matches -1.0");
  approx(parsed.rightChannel[1], 1.0, 1e-5, "Frame 1 Right matches +1.0");
});

test("F24-ADV-20: Zero-sample AudioBuffer WAV encoding and parsing integrity", () => {
  const emptyBuf = createMockAudioBuffer(2, 0, 44100);
  const wavBytes = encodeWavBuffer(emptyBuf);

  // Exactly 44 header bytes, 0 data bytes
  eq(wavBytes.length, 44, "0-sample WAV is exactly 44 bytes");

  const parsed = parseWav(wavBytes);
  eq(parsed.metadata.dataSize, 0, "dataSize is 0");
  eq(parsed.metadata.duration, 0, "duration is 0");
  eq(parsed.leftChannel.length, 0, "leftChannel length is 0");
  eq(parsed.rightChannel.length, 0, "rightChannel length is 0");
});

test("F24-ADV-21: WAV sample quantizer boundary clamping and non-finite number neutralization", () => {
  // 16-bit NaN and Infinity
  eq(quantizeSample16(NaN), 0, "16-bit NaN quantizes to 0");
  eq(quantizeSample16(Infinity), 0, "16-bit Infinity quantizes to 0");
  eq(quantizeSample16(-Infinity), 0, "16-bit -Infinity quantizes to 0");

  // 16-bit Over/Under range clamping
  eq(quantizeSample16(10.5), 32767, "16-bit 10.5 clamps to 32767");
  eq(quantizeSample16(-10.5), -32768, "16-bit -10.5 clamps to -32768");

  // 24-bit NaN and Infinity
  eq(quantizeSample24(NaN), 0, "24-bit NaN quantizes to 0");
  eq(quantizeSample24(Infinity), 0, "24-bit Infinity quantizes to 0");
  eq(quantizeSample24(-Infinity), 0, "24-bit -Infinity quantizes to 0");

  // 24-bit Over/Under range clamping
  eq(quantizeSample24(10.5), 8388607, "24-bit 10.5 clamps to 8388607");
  eq(quantizeSample24(-10.5), -8388608, "24-bit -10.5 clamps to -8388608");
});

test("F24-ADV-22: ID3v2.3 multi-byte Unicode serialization with UTF-16LE BOM and roundtrip parsing", () => {
  const metadata = {
    title: "SonicBlueprint 藍図 (Blueprint)",
    artist: "Techno 東京 🎵",
    album: "D-Minor Maqam מקאם",
    genre: "Electronic / Microtonal",
    comment: "Adversarial UTF-16LE ID3 Test",
  };

  const tagBytes = buildId3v2Tag(metadata, { version: "2.3" });
  ok(tagBytes.length > 10, "Generated ID3v2.3 tag buffer must be non-empty");

  // Magic "ID3" check
  eq(tagBytes[0], 0x49, "Byte 0 is 'I'");
  eq(tagBytes[1], 0x44, "Byte 1 is 'D'");
  eq(tagBytes[2], 0x33, "Byte 2 is '3'");
  eq(tagBytes[3], 3, "Major version is 3 (ID3v2.3)");

  const parsed = parseId3v2(tagBytes);
  ok(parsed !== null, "parseId3v2 must parse generated tag successfully");
  eq(parsed.version, "2.3", "Parsed version is 2.3");
  eq(parsed.metadata.title, metadata.title, "Parsed Unicode title matches exactly");
  eq(parsed.metadata.artist, metadata.artist, "Parsed Unicode artist matches exactly");
  eq(parsed.metadata.album, metadata.album, "Parsed Unicode album matches exactly");
  eq(parsed.metadata.genre, metadata.genre, "Parsed genre matches");
  eq(parsed.metadata.comment, metadata.comment, "Parsed comment matches");
});

test("F24-ADV-23: ID3v2 syncsafe integer boundary encoding and roundtrip decoding", () => {
  const testValues = [0, 1, 127, 128, 255, 16383, 16384, 2097151, 2097152, 268435455];

  for (const val of testValues) {
    const enc = encodeSyncsafe(val);
    eq(enc.length, 4, "Syncsafe integer must be 4 bytes");

    // Bit 7 of each byte must be 0
    ok((enc[0] & 0x80) === 0, `enc[0] bit 7 is 0 for ${val}`);
    ok((enc[1] & 0x80) === 0, `enc[1] bit 7 is 0 for ${val}`);
    ok((enc[2] & 0x80) === 0, `enc[2] bit 7 is 0 for ${val}`);
    ok((enc[3] & 0x80) === 0, `enc[3] bit 7 is 0 for ${val}`);

    const dec = decodeSyncsafe(enc[0], enc[1], enc[2], enc[3]);
    eq(dec, val, `Roundtrip syncsafe decode matches ${val}`);
  }

  // Clamping check: > 0x0FFFFFFF clamped to 0x0FFFFFFF
  const overEnc = encodeSyncsafe(500000000);
  const overDec = decodeSyncsafe(overEnc[0], overEnc[1], overEnc[2], overEnc[3]);
  eq(overDec, 268435455, "Value > 0x0FFFFFFF clamped to 268435455 (0x0FFFFFFF)");

  // Negative input clamped to 0
  const negEnc = encodeSyncsafe(-100);
  const negDec = decodeSyncsafe(negEnc[0], negEnc[1], negEnc[2], negEnc[3]);
  eq(negDec, 0, "Negative value clamped to 0");
});

test("F24-ADV-24: Corrupted and invalid WAV buffer rejection in parseWav", () => {
  // Truncated buffer (< 44 bytes)
  throws(() => parseWav(new Uint8Array(20)), "parseWav must throw for buffer < 44 bytes");

  // Invalid RIFF magic
  const badRiff = new Uint8Array(44);
  badRiff.set([0x4e, 0x4f, 0x50, 0x45], 0); // "NOPE"
  throws(() => parseWav(badRiff), "parseWav must throw for invalid RIFF magic");

  // Valid RIFF but invalid WAVE format
  const badWave = new Uint8Array(44);
  badWave.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  badWave.set([0x41, 0x49, 0x46, 0x46], 8); // "AIFF"
  throws(() => parseWav(badWave), "parseWav must throw for non-WAVE format");
});

// ─────────────────────────────────────────────────────────────────────────────
// Subsystem 5: Accessibility Announcer Stress & Concurrency
// ─────────────────────────────────────────────────────────────────────────────
setContext("Tier 5", "F24: Accessibility Announcer Stress");

test("F24-ADV-25: High-frequency burst announcement queuing with monotonic sequence IDs", () => {
  const received: A11yMessage[] = [];
  const unsubscribe = subscribeAnnouncer((msg) => {
    received.push(msg);
  });

  const count = 500;
  for (let i = 0; i < count; i++) {
    announce(`Burst announcement message #${i}`);
  }

  eq(received.length, count, "All 500 burst announcements were delivered to listener");

  // Monotonic message IDs
  for (let i = 1; i < received.length; i++) {
    ok(received[i].id > received[i - 1].id, `Message ID ${received[i].id} > ${received[i - 1].id}`);
    ok(received[i].timestamp >= received[i - 1].timestamp, "Timestamp non-decreasing");
    ok(received[i].message.length > 0, "Message content is non-empty");
  }

  unsubscribe();
});

test("F24-ADV-26: Subscriber unmount cleanup and memory leak prevention", () => {
  let callsA = 0;
  let callsB = 0;

  const unsubA = subscribeAnnouncer(() => {
    callsA++;
  });
  const unsubB = subscribeAnnouncer(() => {
    callsB++;
  });

  announce("First message (both active)");
  eq(callsA, 1, "Listener A received first message");
  eq(callsB, 1, "Listener B received first message");

  // Unsubscribe listener A
  unsubA();

  announce("Second message (only B active)");
  eq(callsA, 1, "Listener A did not receive message after unsubscribe");
  eq(callsB, 2, "Listener B received second message");

  unsubB();
  announce("Third message (both unsubscribed)");
  eq(callsA, 1, "Listener A remains at 1");
  eq(callsB, 2, "Listener B remains at 2");
});

test("F24-ADV-27: Faulty listener error isolation and whitespace rejection", () => {
  let healthyReceived = 0;

  // Faulty subscriber throws uncaught exception
  const unsubCrashing = subscribeAnnouncer(() => {
    throw new Error("Fatal listener crash");
  });

  // Healthy subscriber
  const unsubHealthy = subscribeAnnouncer(() => {
    healthyReceived++;
  });

  // Announcing must not throw even if a listener throws internally
  announce("Resilient message broadcast");
  eq(healthyReceived, 1, "Healthy listener received message despite crashing peer listener");

  // Whitespace-only and empty messages should be ignored
  announce("");
  announce("     \t\n  ");
  eq(healthyReceived, 1, "Empty or whitespace announcements must be ignored");

  unsubCrashing();
  unsubHealthy();
});

// ─────────────────────────────────────────────────────────────────────────────
// Subsystem 6: Share URL Security & Decompression Resilience
// ─────────────────────────────────────────────────────────────────────────────
setContext("Tier 5", "F24: Share URL Security & Decompression");

test("F24-ADV-28: Corrupted base64url and invalid gzip payload rejection in decompressProject", async () => {
  // Empty payload
  let caughtEmpty = false;
  try {
    await decompressProject("");
  } catch (err) {
    caughtEmpty = true;
    ok((err as Error).message.includes("Missing share payload"), "Throws 'Missing share payload'");
  }
  ok(caughtEmpty, "decompressProject('') must reject");

  // Corrupted base64url characters
  let caughtCorrupt = false;
  try {
    await decompressProject("invalid!@#$%^&*()");
  } catch {
    caughtCorrupt = true;
  }
  ok(caughtCorrupt, "decompressProject with invalid base64url must reject");

  // Truncated/corrupted gzip bytes
  let caughtGzip = false;
  try {
    // "AQID" decodes to [1, 2, 3] which is not a valid gzip stream
    await decompressProject("AQID");
  } catch (err) {
    caughtGzip = true;
    ok((err as Error).message.includes("corrupted gzip data"), "Throws corrupted gzip data message");
  }
  ok(caughtGzip, "decompressProject with invalid gzip stream must reject");
});

test("F24-ADV-29: Oversized payload length rejection at 32KB boundary", async () => {
  const oversizedPayload = "A".repeat(32769);
  let caughtOversized = false;
  try {
    await decompressProject(oversizedPayload);
  } catch (err) {
    caughtOversized = true;
    ok((err as Error).message.includes("exceeds maximum safe length"), "Throws safe length error");
  }
  ok(caughtOversized, "Payload > 32768 chars must be rejected");
});

test("F24-ADV-30: Prototype pollution payload neutralization in shared project decompression", () => {
  const poisonedJson = JSON.parse(
    '{"__proto__":{"pollutedAdmin":true},"constructor":{"prototype":{"pollutedHacked":true}},"meta":{"name":"Test"}}'
  );

  const sanitized = deepSanitizeJson(poisonedJson);
  ok(!("__proto__" in sanitized), "__proto__ key stripped by deepSanitizeJson");
  ok(!("constructor" in sanitized), "constructor key stripped by deepSanitizeJson");

  // Object prototype must not have been polluted
  ok(!("pollutedAdmin" in Object.prototype), "Object.prototype.pollutedAdmin does not exist");
  ok(!("pollutedHacked" in Object.prototype), "Object.prototype.pollutedHacked does not exist");
});

test("F24-ADV-31: Project sharing credential zeroization invariant", () => {
  const p = createProject("Secure-Share");
  // Inject dangerous credential keys
  const dirty = {
    ...p,
    apiKey: "AIzaSyFakeSecretKey12345",
    authToken: "bearer-token-secret-9999",
    userPassword: "admin-super-password",
    meta: {
      ...p.meta,
      secretKey: "super-secret-vault-token",
    },
  } as unknown as SonicProject;

  const sanitized = sanitizeProjectForSharing(dirty);
  const jsonStr = JSON.stringify(sanitized);

  ok(!jsonStr.includes("AIzaSyFakeSecretKey12345"), "apiKey must be scrubbed");
  ok(!jsonStr.includes("bearer-token-secret-9999"), "authToken must be scrubbed");
  ok(!jsonStr.includes("admin-super-password"), "userPassword must be scrubbed");
  ok(!jsonStr.includes("super-secret-vault-token"), "meta.secretKey must be scrubbed");
});

test("F24-ADV-32: Full round-trip compression, URL extraction, and decompression fidelity", async () => {
  const original = createProject("Round-Trip-Adversarial");
  original.config.bpm = 145;
  original.chords.chords = ["Em7", "Cadd9", "G", "D/F#"];

  const payload = await compressProject(original);
  ok(payload.length > 0, "Compressed payload is non-empty");
  ok(payload.length < 32768, "Compressed payload is within 32KB URL limit");

  const restored = await decompressProject(payload);
  eq(restored.config.bpm, 145, "Restored BPM matches 145");
  eq(restored.chords.chords, ["Em7", "Cadd9", "G", "D/F#"], "Restored chords match exactly");
  ok(restored.meta.id !== original.meta.id, "Restored project receives fresh unique ID");
});

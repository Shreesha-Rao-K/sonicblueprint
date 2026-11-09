// Unit tests: multi-pattern instrument arpeggiator engine (Feature 7).
import { suite, test, eq, ok, approx } from "./helpers";
import {
  defaultArpeggiatorConfig,
  normalizeArpeggiatorConfig,
  rateToBeatFraction,
  rateToStepsPerBar,
  expandOctaves,
  buildUpDownCycle,
  arpeggiateChord,
  generateArpEvents,
  generateArpNoteEvents,
  type ArpeggiatorConfig,
} from "@/lib/arpeggiator";

suite("arpeggiator configuration and rate helpers");

test("defaultArpeggiatorConfig returns canonical 1/16 up arpeggio", () => {
  const def = defaultArpeggiatorConfig();
  eq(def.enabled, true);
  eq(def.pattern, "up");
  eq(def.rate, "1/16");
  eq(def.octaves, 1);
  eq(def.gate, 0.85);
});

test("normalizeArpeggiatorConfig sanitizes and clamps corrupt or out-of-bounds parameters", () => {
  const norm1 = normalizeArpeggiatorConfig(null);
  eq(norm1, defaultArpeggiatorConfig());

  const norm2 = normalizeArpeggiatorConfig({
    pattern: "invalid_pattern",
    rate: "99/99",
    octaves: 10,
    gate: -5,
    enabled: "yes",
  });
  eq(norm2.pattern, "up", "invalid pattern falls back to up");
  eq(norm2.rate, "1/16", "invalid rate falls back to 1/16");
  eq(norm2.octaves, 3, "octaves clamped to maximum 3");
  approx(norm2.gate!, 0.1, 0.01, "gate clamped to minimum 0.1");
  eq(norm2.enabled, true, "non-boolean enabled falls back to true");

  const norm3 = normalizeArpeggiatorConfig({
    pattern: "upDown",
    rate: "1/8t",
    octaves: 2,
    gate: 0.95,
    enabled: false,
  });
  eq(norm3.pattern, "upDown");
  eq(norm3.rate, "1/8t");
  eq(norm3.octaves, 2);
  eq(norm3.gate, 0.95);
  eq(norm3.enabled, false);
});

test("rateToBeatFraction and rateToStepsPerBar calculate exact metric and triplet intervals", () => {
  // 1/4 note
  approx(rateToBeatFraction("1/4"), 1.0);
  eq(rateToStepsPerBar("1/4", 4), 4);

  // 1/8 note
  approx(rateToBeatFraction("1/8"), 0.5);
  eq(rateToStepsPerBar("1/8", 4), 8);

  // 1/16 note
  approx(rateToBeatFraction("1/16"), 0.25);
  eq(rateToStepsPerBar("1/16", 4), 16);

  // 1/8 triplet (3 per quarter beat)
  approx(rateToBeatFraction("1/8t"), 1 / 3);
  eq(rateToStepsPerBar("1/8t", 4), 12);

  // 1/16 triplet (6 per quarter beat)
  approx(rateToBeatFraction("1/16t"), 1 / 6);
  eq(rateToStepsPerBar("1/16t", 4), 24);
});

suite("octave expansion and bounce cycle");

test("expandOctaves stacks notes across 1, 2, and 3 octaves", () => {
  const triad = [60, 64, 67]; // C4, E4, G4

  // 1 octave sorted
  const oct1 = expandOctaves(triad, 1);
  eq(oct1, [60, 64, 67]);

  // 2 octaves
  const oct2 = expandOctaves(triad, 2);
  eq(oct2, [60, 64, 67, 72, 76, 79]);

  // 3 octaves
  const oct3 = expandOctaves(triad, 3);
  eq(oct3, [60, 64, 67, 72, 76, 79, 84, 88, 91]);

  // preserveOrder for asPlayed
  const unsorted = [67, 60, 64];
  const octPreserved = expandOctaves(unsorted, 2, true);
  eq(octPreserved, [67, 60, 64, 79, 72, 76]);
});

test("buildUpDownCycle creates smooth ping-pong bounce without double-triggering extremities", () => {
  // Empty or single element
  eq(buildUpDownCycle([]), []);
  eq(buildUpDownCycle([60]), [60]);
  eq(buildUpDownCycle([60, 64]), [60, 64]);

  // 3 elements: [A, B, C] -> [A, B, C, B] (length 2M - 2 = 4)
  const cycle3 = buildUpDownCycle([60, 64, 67]);
  eq(cycle3, [60, 64, 67, 64]);

  // 4 elements: [A, B, C, D] -> [A, B, C, D, C, B] (length 2M - 2 = 6)
  const cycle4 = buildUpDownCycle([60, 64, 67, 72]);
  eq(cycle4, [60, 64, 67, 72, 67, 64]);
});

suite("arpeggiateChord pattern algorithms");

test("up pattern produces ascending cyclic sequence", () => {
  const triad = [60, 64, 67];
  const cfg: ArpeggiatorConfig = { enabled: true, pattern: "up", rate: "1/16", octaves: 1 };
  const seq = arpeggiateChord(triad, cfg, 7);
  eq(seq, [60, 64, 67, 60, 64, 67, 60]);
});

test("down pattern produces descending cyclic sequence", () => {
  const triad = [60, 64, 67];
  const cfg: ArpeggiatorConfig = { enabled: true, pattern: "down", rate: "1/16", octaves: 1 };
  const seq = arpeggiateChord(triad, cfg, 7);
  eq(seq, [67, 64, 60, 67, 64, 60, 67]);
});

test("upDown pattern creates seamless bounce over 2 octaves", () => {
  const triad = [60, 64, 67];
  const cfg: ArpeggiatorConfig = { enabled: true, pattern: "upDown", rate: "1/16", octaves: 2 };
  // Expanded pool (length 6): [60, 64, 67, 72, 76, 79]
  // Cycle length 2*6 - 2 = 10: [60, 64, 67, 72, 76, 79, 76, 72, 67, 64]
  const seq = arpeggiateChord(triad, cfg, 12);
  eq(seq, [60, 64, 67, 72, 76, 79, 76, 72, 67, 64, 60, 64]);
});

test("asPlayed pattern respects user chord voicing / inversion order", () => {
  const secondInversion = [67, 60, 64]; // G4, C4, E4
  const cfg: ArpeggiatorConfig = { enabled: true, pattern: "asPlayed", rate: "1/16", octaves: 1 };
  const seq = arpeggiateChord(secondInversion, cfg, 6);
  eq(seq, [67, 60, 64, 67, 60, 64]);
});

test("random pattern produces deterministic, seeded output", () => {
  const triad = [60, 64, 67, 72];
  const cfg: ArpeggiatorConfig = { enabled: true, pattern: "random", rate: "1/16", octaves: 1 };

  const run1 = arpeggiateChord(triad, cfg, 8, "seed-abc");
  const run2 = arpeggiateChord(triad, cfg, 8, "seed-abc");
  const runDiffSeed = arpeggiateChord(triad, cfg, 8, "seed-xyz");

  eq(run1, run2, "Identical seeds must produce bit-exact identical sequences");
  ok(run1.every((note) => triad.includes(note)), "Every random note must come from chord pool");
  ok(run1.join(",") !== runDiffSeed.join(","), "Different seeds should generate different sequences");
});

test("handles edge cases: empty chord, non-positive step counts, single note", () => {
  const cfg = defaultArpeggiatorConfig();
  eq(arpeggiateChord([], cfg, 8), []);
  eq(arpeggiateChord([60, 64], cfg, 0), []);
  eq(arpeggiateChord([60, 64], cfg, -3), []);

  // Single note chord produces steady rhythm
  const single = arpeggiateChord([60], cfg, 4);
  eq(single, [60, 60, 60, 60]);
});

suite("timeline event generation");

test("generateArpEvents creates fully scheduled note events with duration and gate", () => {
  const chord = [60, 64, 67];
  const cfg: ArpeggiatorConfig = { enabled: true, pattern: "up", rate: "1/16", octaves: 1, gate: 0.8 };
  const spq = 0.5; // 120 bpm -> 0.5s per quarter note
  const totalDur = 1.0; // 2 quarter notes = 8 sixteenth steps

  const events = generateArpEvents(chord, cfg, 2.0, totalDur, spq, {
    volume: 0.6,
    pan: -0.2,
    accentFirstStep: true,
  });

  // Step duration = 0.25 * 0.5 = 0.125s
  // In 1.0s, there are 8 steps
  eq(events.length, 8);
  approx(events[0].time, 2.0);
  approx(events[1].time, 2.125);
  approx(events[2].time, 2.25);
  approx(events[7].time, 2.875);

  // Active duration = 0.125 * 0.8 = 0.1s
  approx(events[0].dur, 0.1);
  approx(events[1].dur, 0.1);

  // Accent on first step
  ok(events[0].vol > events[1].vol, "First step accented");
  eq(events[0].pan, -0.2);

  // Pitches follow up pattern
  eq(events.map((e) => e.midi), [60, 64, 67, 60, 64, 67, 60, 64]);

  // Alias generateArpNoteEvents produces identical output
  const aliasEvents = generateArpNoteEvents(chord, cfg, 2.0, totalDur, spq, { volume: 0.6 });
  eq(aliasEvents.length, 8);
});
